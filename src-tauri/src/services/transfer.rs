use crate::models::{
    CompletedPart, ResumePoint, S3Endpoint, TransferJob, TransferLocation, TransferStatus,
    TransferType,
};
use crate::utils::{AppError, AppResult};
use aws_sdk_s3::Client;
use aws_sdk_s3::primitives::ByteStream;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio::sync::Mutex;
use uuid::Uuid;

const MULTIPART_THRESHOLD: u64 = 100 * 1024 * 1024; // 100 MB
const MULTIPART_CHUNK_SIZE: u64 = 10 * 1024 * 1024; // 10 MB per part
const MAX_RETRY_DELAY_MS: u64 = 30_000; // Cap retry delay at 30 seconds
const BASE_RETRY_DELAY_MS: u64 = 1_000; // 1 second base delay

/// Service for managing file transfer operations
pub struct TransferService {
    jobs: Arc<Mutex<Vec<TransferJob>>>,
    persist_path: PathBuf,
}

impl TransferService {
    pub fn new() -> Self {
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("com.simples3.app");
        std::fs::create_dir_all(&config_dir).ok();
        let persist_path = config_dir.join("transfers.json");

        let mut service = Self {
            jobs: Arc::new(Mutex::new(Vec::new())),
            persist_path,
        };

        // Load persisted transfers on startup (blocking since this is init)
        service.load_from_disk_sync();
        service
    }

    /// Load persisted transfer state from disk (sync, for init)
    fn load_from_disk_sync(&mut self) {
        if !self.persist_path.exists() {
            return;
        }
        match std::fs::read_to_string(&self.persist_path) {
            Ok(content) => {
                match serde_json::from_str::<Vec<TransferJob>>(&content) {
                    Ok(mut jobs) => {
                        // Convert any Active jobs to Paused (they were interrupted)
                        for job in jobs.iter_mut() {
                            if job.status == TransferStatus::Active {
                                job.status = TransferStatus::Paused;
                            }
                        }
                        *self.jobs.blocking_lock() = jobs;
                        tracing::info!("Loaded {} persisted transfers", self.jobs.blocking_lock().len());
                    }
                    Err(e) => {
                        tracing::warn!("Failed to parse transfers.json: {}", e);
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Failed to read transfers.json: {}", e);
            }
        }
    }

    /// Save current transfer state to disk
    async fn save_to_disk(&self) {
        let jobs = self.jobs.lock().await;
        match serde_json::to_string_pretty(&*jobs) {
            Ok(content) => {
                if let Err(e) = std::fs::write(&self.persist_path, content) {
                    tracing::warn!("Failed to write transfers.json: {}", e);
                }
            }
            Err(e) => {
                tracing::warn!("Failed to serialize transfers: {}", e);
            }
        }
    }

    /// Clear completed, failed, and cancelled transfers
    pub async fn clear_finished(&self) -> AppResult<()> {
        let mut jobs = self.jobs.lock().await;
        jobs.retain(|j| {
            j.status != TransferStatus::Completed
                && j.status != TransferStatus::Failed
                && j.status != TransferStatus::Cancelled
        });
        drop(jobs);
        self.save_to_disk().await;
        Ok(())
    }

    /// Create S3 client from endpoint
    async fn create_client(&self, endpoint: &S3Endpoint) -> AppResult<Client> {
        use aws_config::meta::region::RegionProviderChain;
        use aws_config::BehaviorVersion;
        use aws_sdk_s3::config::{Credentials, Region};

        let access_key = endpoint
            .access_key_id
            .as_ref()
            .ok_or_else(|| AppError::S3("Access key not available".to_string()))?;

        let secret_key = endpoint
            .secret_access_key
            .as_ref()
            .ok_or_else(|| AppError::S3("Secret key not available".to_string()))?;

        let credentials = Credentials::new(access_key, secret_key, None, None, "simples3");
        let region_provider = RegionProviderChain::first_try(Region::new(endpoint.region.clone()));

        let config = aws_config::defaults(BehaviorVersion::latest())
            .region(region_provider)
            .credentials_provider(credentials)
            .endpoint_url(&endpoint.url)
            .load()
            .await;

        let s3_config = aws_sdk_s3::config::Builder::from(&config)
            .force_path_style(endpoint.path_style)
            .build();

        Ok(Client::from_conf(s3_config))
    }

    /// Queue a new upload transfer
    pub async fn queue_upload(
        &self,
        endpoint: &S3Endpoint,
        local_path: String,
        bucket: String,
        s3_key: String,
    ) -> AppResult<Uuid> {
        // Get file size
        let path = PathBuf::from(&local_path);
        let metadata = tokio::fs::metadata(&path)
            .await
            .map_err(AppError::Io)?;

        let file_size = metadata.len();

        // Create transfer job
        let job = TransferJob::new(
            TransferType::Upload,
            TransferLocation::Local { path: local_path },
            TransferLocation::S3 {
                bucket: bucket.clone(),
                key: s3_key.clone(),
            },
            file_size,
        );

        let job_id = job.id;

        // Add to queue
        let mut jobs = self.jobs.lock().await;
        jobs.push(job);
        drop(jobs);
        self.save_to_disk().await;

        // Start upload in background
        let service = self.clone_for_background();
        let endpoint_clone = endpoint.clone();
        tokio::spawn(async move {
            let _ = service.execute_upload(job_id, &endpoint_clone).await;
        });

        Ok(job_id)
    }

    /// Execute an upload transfer
    async fn execute_upload(&self, job_id: Uuid, endpoint: &S3Endpoint) -> AppResult<()> {
        // Get job
        let mut jobs = self.jobs.lock().await;
        let job = jobs
            .iter_mut()
            .find(|j| j.id == job_id)
            .ok_or_else(|| AppError::NotFound("Transfer job not found".to_string()))?;

        // Update status to active
        job.status = TransferStatus::Active;
        job.started_at = Some(chrono::Utc::now());

        let (local_path, bucket, s3_key, file_size) = match (&job.source, &job.destination) {
            (TransferLocation::Local { path }, TransferLocation::S3 { bucket, key }) => {
                (path.clone(), bucket.clone(), key.clone(), job.file_size)
            }
            _ => {
                return Err(AppError::Transfer(
                    "Invalid transfer source/destination".to_string(),
                ))
            }
        };

        drop(jobs);

        // Decide upload strategy based on file size
        let result = if file_size > MULTIPART_THRESHOLD {
            self.multipart_upload(job_id, endpoint, &local_path, &bucket, &s3_key, file_size)
                .await
        } else {
            self.simple_upload(job_id, endpoint, &local_path, &bucket, &s3_key)
                .await
        };

        // Update job status based on result
        let mut jobs = self.jobs.lock().await;
        if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
            match &result {
                Ok(_) => {
                    // Only mark completed if not paused
                    if job.status != TransferStatus::Paused {
                        job.status = TransferStatus::Completed;
                        job.completed_at = Some(chrono::Utc::now());
                        job.progress_bytes = file_size;
                    }
                }
                Err(e) => {
                    if job.status != TransferStatus::Cancelled {
                        job.status = TransferStatus::Failed;
                        job.error_message = Some(e.to_string());
                    }
                }
            }
        }
        drop(jobs);
        self.save_to_disk().await;

        result
    }

    /// Simple upload for files <= 100MB
    async fn simple_upload(
        &self,
        job_id: Uuid,
        endpoint: &S3Endpoint,
        local_path: &str,
        bucket: &str,
        s3_key: &str,
    ) -> AppResult<()> {
        let client = self.create_client(endpoint).await?;
        let local_path = local_path.to_string();
        let bucket = bucket.to_string();
        let s3_key = s3_key.to_string();

        self.retry_s3_op(job_id, 3, || {
            let client = client.clone();
            let local_path = local_path.clone();
            let bucket = bucket.clone();
            let s3_key = s3_key.clone();
            async move {
                let body = ByteStream::from_path(PathBuf::from(&local_path))
                    .await
                    .map_err(|e| AppError::S3(format!("Failed to read file: {}", e)))?;

                client
                    .put_object()
                    .bucket(&bucket)
                    .key(&s3_key)
                    .body(body)
                    .send()
                    .await
                    .map_err(|e| AppError::S3(format!("Upload failed: {}", e)))?;

                Ok(())
            }
        })
        .await
    }

    /// Multipart upload for files > 100MB
    async fn multipart_upload(
        &self,
        job_id: Uuid,
        endpoint: &S3Endpoint,
        local_path: &str,
        bucket: &str,
        s3_key: &str,
        file_size: u64,
    ) -> AppResult<()> {
        let client = self.create_client(endpoint).await?;

        // Initiate multipart upload
        let create_multipart_response = client
            .create_multipart_upload()
            .bucket(bucket)
            .key(s3_key)
            .send()
            .await
            .map_err(|e| AppError::S3(format!("Failed to initiate multipart upload: {}", e)))?;

        let upload_id = create_multipart_response
            .upload_id()
            .ok_or_else(|| AppError::S3("No upload ID returned".to_string()))?
            .to_string();

        // Calculate number of parts
        let num_parts = file_size.div_ceil(MULTIPART_CHUNK_SIZE);

        // Open file
        let mut file = File::open(local_path)
            .await
            .map_err(AppError::Io)?;

        let mut completed_parts = Vec::new();

        // Upload each part
        for part_number in 1..=num_parts {
            // Check if transfer is paused or cancelled
            let jobs = self.jobs.lock().await;
            if let Some(job) = jobs.iter().find(|j| j.id == job_id) {
                match job.status {
                    TransferStatus::Paused => {
                        drop(jobs);
                        // Save resume point
                        self.save_resume_point(
                            job_id,
                            upload_id.clone(),
                            completed_parts,
                            part_number as i32,
                        )
                        .await?;
                        return Ok(());
                    }
                    TransferStatus::Cancelled => {
                        drop(jobs);
                        // Abort multipart upload
                        client
                            .abort_multipart_upload()
                            .bucket(bucket)
                            .key(s3_key)
                            .upload_id(&upload_id)
                            .send()
                            .await
                            .ok();
                        return Err(AppError::Transfer("Transfer cancelled".to_string()));
                    }
                    _ => {}
                }
            }
            drop(jobs);

            // Read chunk
            let chunk_size = if part_number == num_parts {
                // Last part might be smaller
                file_size - (part_number - 1) * MULTIPART_CHUNK_SIZE
            } else {
                MULTIPART_CHUNK_SIZE
            };

            let mut buffer = vec![0u8; chunk_size as usize];
            file.read_exact(&mut buffer)
                .await
                .map_err(AppError::Io)?;

            // Upload part with retry
            let buffer_clone = buffer.clone();
            let upload_part_response = self.retry_s3_op(job_id, 3, || {
                let client = client.clone();
                let bucket = bucket.to_string();
                let s3_key = s3_key.to_string();
                let upload_id = upload_id.clone();
                let buf = buffer_clone.clone();
                let pn = part_number;
                async move {
                    client
                        .upload_part()
                        .bucket(&bucket)
                        .key(&s3_key)
                        .upload_id(&upload_id)
                        .part_number(pn as i32)
                        .body(ByteStream::from(buf))
                        .send()
                        .await
                        .map_err(|e| AppError::S3(format!("Failed to upload part {}: {}", pn, e)))
                }
            })
            .await?;

            let etag = upload_part_response
                .e_tag()
                .ok_or_else(|| AppError::S3("No ETag returned for part".to_string()))?
                .to_string();

            completed_parts.push(CompletedPart {
                part_number: part_number as i32,
                etag: etag.clone(),
                size: chunk_size,
            });

            // Update progress
            let mut jobs = self.jobs.lock().await;
            if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
                job.progress_bytes = (part_number * MULTIPART_CHUNK_SIZE).min(file_size);
            }
        }

        // Complete multipart upload
        let completed_parts_for_s3: Vec<_> = completed_parts
            .iter()
            .map(|p| {
                aws_sdk_s3::types::CompletedPart::builder()
                    .part_number(p.part_number)
                    .e_tag(&p.etag)
                    .build()
            })
            .collect();

        let completed_multipart_upload = aws_sdk_s3::types::CompletedMultipartUpload::builder()
            .set_parts(Some(completed_parts_for_s3))
            .build();

        client
            .complete_multipart_upload()
            .bucket(bucket)
            .key(s3_key)
            .upload_id(&upload_id)
            .multipart_upload(completed_multipart_upload)
            .send()
            .await
            .map_err(|e| AppError::S3(format!("Failed to complete multipart upload: {}", e)))?;

        Ok(())
    }

    /// Save resume point for paused transfer
    async fn save_resume_point(
        &self,
        job_id: Uuid,
        upload_id: String,
        parts_completed: Vec<CompletedPart>,
        next_part_number: i32,
    ) -> AppResult<()> {
        let mut jobs = self.jobs.lock().await;
        if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
            job.resume_point = Some(ResumePoint {
                upload_id: Some(upload_id),
                parts_completed,
                next_part_number,
                chunk_size: MULTIPART_CHUNK_SIZE,
            });
        }
        Ok(())
    }

    /// Pause a transfer
    pub async fn pause_transfer(&self, job_id: Uuid) -> AppResult<()> {
        let mut jobs = self.jobs.lock().await;
        let job = jobs
            .iter_mut()
            .find(|j| j.id == job_id)
            .ok_or_else(|| AppError::NotFound("Transfer job not found".to_string()))?;

        if job.status == TransferStatus::Active {
            job.status = TransferStatus::Paused;
        }
        drop(jobs);
        self.save_to_disk().await;

        Ok(())
    }

    /// Resume a paused transfer
    pub async fn resume_transfer(&self, job_id: Uuid, endpoint: &S3Endpoint) -> AppResult<()> {
        let jobs = self.jobs.lock().await;
        let job = jobs
            .iter()
            .find(|j| j.id == job_id)
            .ok_or_else(|| AppError::NotFound("Transfer job not found".to_string()))?;

        if job.status != TransferStatus::Paused {
            return Err(AppError::Transfer("Transfer is not paused".to_string()));
        }

        let transfer_type = job.transfer_type.clone();

        drop(jobs);

        // Update status to active
        let mut jobs = self.jobs.lock().await;
        if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
            job.status = TransferStatus::Active;
        }
        drop(jobs);

        // Re-spawn the transfer in background
        let service = self.clone_for_background();
        let endpoint_clone = endpoint.clone();
        match transfer_type {
            TransferType::Upload => {
                tokio::spawn(async move {
                    let _ = service.execute_upload(job_id, &endpoint_clone).await;
                });
            }
            TransferType::Download => {
                tokio::spawn(async move {
                    let _ = service.execute_download(job_id, &endpoint_clone).await;
                });
            }
        }

        Ok(())
    }

    /// Cancel a transfer
    pub async fn cancel_transfer(&self, job_id: Uuid) -> AppResult<()> {
        let mut jobs = self.jobs.lock().await;
        let job = jobs
            .iter_mut()
            .find(|j| j.id == job_id)
            .ok_or_else(|| AppError::NotFound("Transfer job not found".to_string()))?;

        job.status = TransferStatus::Cancelled;
        drop(jobs);
        self.save_to_disk().await;

        Ok(())
    }

    /// Get all transfers in the queue
    pub async fn get_transfer_queue(&self) -> AppResult<Vec<TransferJob>> {
        let jobs = self.jobs.lock().await;
        Ok(jobs.clone())
    }

    /// Queue a new download transfer
    pub async fn queue_download(
        &self,
        endpoint: &S3Endpoint,
        bucket: String,
        s3_key: String,
        local_path: String,
    ) -> AppResult<Uuid> {
        // Get object metadata to determine file size
        let client = self.create_client(endpoint).await?;
        let head_response = client
            .head_object()
            .bucket(&bucket)
            .key(&s3_key)
            .send()
            .await
            .map_err(|e| AppError::S3(format!("Failed to get object metadata: {}", e)))?;

        let file_size = head_response.content_length().unwrap_or(0) as u64;

        // Create transfer job
        let job = TransferJob::new(
            TransferType::Download,
            TransferLocation::S3 {
                bucket: bucket.clone(),
                key: s3_key.clone(),
            },
            TransferLocation::Local { path: local_path },
            file_size,
        );

        let job_id = job.id;

        // Add to queue
        let mut jobs = self.jobs.lock().await;
        jobs.push(job);
        drop(jobs);
        self.save_to_disk().await;

        // Start download in background
        let service = self.clone_for_background();
        let endpoint_clone = endpoint.clone();
        tokio::spawn(async move {
            let _ = service.execute_download(job_id, &endpoint_clone).await;
        });

        Ok(job_id)
    }

    /// Execute a download transfer
    async fn execute_download(&self, job_id: Uuid, endpoint: &S3Endpoint) -> AppResult<()> {
        // Get job info
        let mut jobs = self.jobs.lock().await;
        let job = jobs
            .iter_mut()
            .find(|j| j.id == job_id)
            .ok_or_else(|| AppError::NotFound("Transfer job not found".to_string()))?;

        // Update status to active
        job.status = TransferStatus::Active;
        job.started_at = Some(chrono::Utc::now());

        let (bucket, s3_key, local_path, file_size) = match (&job.source, &job.destination) {
            (TransferLocation::S3 { bucket, key }, TransferLocation::Local { path }) => {
                (bucket.clone(), key.clone(), path.clone(), job.file_size)
            }
            _ => {
                return Err(AppError::Transfer(
                    "Invalid transfer source/destination".to_string(),
                ))
            }
        };

        // Check for resume point
        let resume_point = job.resume_point.clone();

        drop(jobs);

        // Ensure parent directories exist
        let dest = PathBuf::from(&local_path);
        if let Some(parent) = dest.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(AppError::Io)?;
        }

        // Decide download strategy based on file size
        let result = if file_size > MULTIPART_THRESHOLD {
            self.chunked_download(job_id, endpoint, &bucket, &s3_key, &local_path, file_size, resume_point)
                .await
        } else {
            self.simple_download(job_id, endpoint, &bucket, &s3_key, &local_path, file_size)
                .await
        };

        // Update job status based on result
        let mut jobs = self.jobs.lock().await;
        if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
            match &result {
                Ok(_) => {
                    // Only mark completed if not paused
                    if job.status != TransferStatus::Paused {
                        job.status = TransferStatus::Completed;
                        job.completed_at = Some(chrono::Utc::now());
                        job.progress_bytes = file_size;
                    }
                }
                Err(e) => {
                    if job.status != TransferStatus::Cancelled {
                        job.status = TransferStatus::Failed;
                        job.error_message = Some(e.to_string());
                    }
                }
            }
        }
        drop(jobs);
        self.save_to_disk().await;

        result
    }

    /// Simple download for files <= 100MB
    async fn simple_download(
        &self,
        job_id: Uuid,
        endpoint: &S3Endpoint,
        bucket: &str,
        s3_key: &str,
        local_path: &str,
        _file_size: u64,
    ) -> AppResult<()> {
        let client = self.create_client(endpoint).await?;

        // Check for cancel before starting
        {
            let jobs = self.jobs.lock().await;
            if let Some(job) = jobs.iter().find(|j| j.id == job_id) {
                if job.status == TransferStatus::Cancelled {
                    return Err(AppError::Transfer("Transfer cancelled".to_string()));
                }
            }
        }

        let bucket = bucket.to_string();
        let s3_key = s3_key.to_string();
        let local_path = local_path.to_string();

        let bytes = self.retry_s3_op(job_id, 3, || {
            let client = client.clone();
            let bucket = bucket.clone();
            let s3_key = s3_key.clone();
            async move {
                let response = client
                    .get_object()
                    .bucket(&bucket)
                    .key(&s3_key)
                    .send()
                    .await
                    .map_err(|e| AppError::S3(format!("Failed to download object: {}", e)))?;

                let body = response.body.collect().await
                    .map_err(|e| AppError::S3(format!("Failed to read download stream: {}", e)))?;

                Ok(body.into_bytes())
            }
        })
        .await?;

        // Write to file
        tokio::fs::write(&local_path, &bytes)
            .await
            .map_err(AppError::Io)?;

        Ok(())
    }

    /// Chunked range-based download for files > 100MB with pause/resume support
    #[allow(clippy::too_many_arguments)]
    async fn chunked_download(
        &self,
        job_id: Uuid,
        endpoint: &S3Endpoint,
        bucket: &str,
        s3_key: &str,
        local_path: &str,
        file_size: u64,
        resume_point: Option<ResumePoint>,
    ) -> AppResult<()> {
        let client = self.create_client(endpoint).await?;

        let num_chunks = file_size.div_ceil(MULTIPART_CHUNK_SIZE);

        // Determine starting chunk (for resume)
        let start_chunk = if let Some(ref rp) = resume_point {
            rp.next_part_number as u64
        } else {
            1
        };

        // Open file: create new or open existing for resume
        let mut file = if start_chunk > 1 {
            let mut f = tokio::fs::OpenOptions::new()
                .write(true)
                .open(local_path)
                .await
                .map_err(AppError::Io)?;
            // Seek to where we left off
            let offset = (start_chunk - 1) * MULTIPART_CHUNK_SIZE;
            f.seek(std::io::SeekFrom::Start(offset)).await.map_err(AppError::Io)?;
            f
        } else {
            File::create(local_path).await.map_err(AppError::Io)?
        };

        // Set initial progress for resumed downloads
        if start_chunk > 1 {
            let already_downloaded = (start_chunk - 1) * MULTIPART_CHUNK_SIZE;
            let mut jobs = self.jobs.lock().await;
            if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
                job.progress_bytes = already_downloaded.min(file_size);
            }
        }

        for chunk_number in start_chunk..=num_chunks {
            // Check if transfer is paused or cancelled
            {
                let jobs = self.jobs.lock().await;
                if let Some(job) = jobs.iter().find(|j| j.id == job_id) {
                    match job.status {
                        TransferStatus::Paused => {
                            drop(jobs);
                            file.flush().await.map_err(AppError::Io)?;
                            // Save resume point
                            let mut jobs = self.jobs.lock().await;
                            if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
                                job.resume_point = Some(ResumePoint {
                                    upload_id: None,
                                    parts_completed: Vec::new(),
                                    next_part_number: chunk_number as i32,
                                    chunk_size: MULTIPART_CHUNK_SIZE,
                                });
                            }
                            return Ok(());
                        }
                        TransferStatus::Cancelled => {
                            drop(jobs);
                            drop(file);
                            tokio::fs::remove_file(local_path).await.ok();
                            return Err(AppError::Transfer("Transfer cancelled".to_string()));
                        }
                        _ => {}
                    }
                }
            }

            // Calculate byte range for this chunk
            let range_start = (chunk_number - 1) * MULTIPART_CHUNK_SIZE;
            let range_end = std::cmp::min(range_start + MULTIPART_CHUNK_SIZE - 1, file_size - 1);
            let range_header = format!("bytes={}-{}", range_start, range_end);

            // Download this chunk using a range request with retry
            let chunk_bytes = self.retry_s3_op(job_id, 3, || {
                let client = client.clone();
                let bucket = bucket.to_string();
                let s3_key = s3_key.to_string();
                let range = range_header.clone();
                let cn = chunk_number;
                async move {
                    let response = client
                        .get_object()
                        .bucket(&bucket)
                        .key(&s3_key)
                        .range(&range)
                        .send()
                        .await
                        .map_err(|e| AppError::S3(format!("Failed to download chunk {}: {}", cn, e)))?;

                    let body = response.body.collect().await
                        .map_err(|e| AppError::S3(format!("Failed to read chunk {} data: {}", cn, e)))?;

                    Ok(body.into_bytes())
                }
            })
            .await?;

            file.write_all(&chunk_bytes).await.map_err(AppError::Io)?;

            // Update progress after each chunk
            let chunk_end_bytes = (chunk_number * MULTIPART_CHUNK_SIZE).min(file_size);
            let mut jobs = self.jobs.lock().await;
            if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
                job.progress_bytes = chunk_end_bytes;
            }
        }

        file.flush().await.map_err(AppError::Io)?;
        Ok(())
    }

    /// Retry an async S3 operation with exponential backoff
    async fn retry_s3_op<F, Fut, T>(
        &self,
        job_id: Uuid,
        max_retries: u32,
        mut op: F,
    ) -> AppResult<T>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = AppResult<T>>,
    {
        let mut last_err = AppError::S3("Unknown error".to_string());

        for attempt in 0..=max_retries {
            match op().await {
                Ok(val) => return Ok(val),
                Err(e) => {
                    last_err = e;

                    if attempt < max_retries {
                        // Update retry count on the job
                        let mut jobs = self.jobs.lock().await;
                        if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
                            job.retry_count = attempt + 1;
                            // Check if cancelled/paused
                            if job.status == TransferStatus::Cancelled
                                || job.status == TransferStatus::Paused
                            {
                                return Err(last_err);
                            }
                        }
                        drop(jobs);

                        let delay = std::cmp::min(
                            BASE_RETRY_DELAY_MS * 2u64.pow(attempt),
                            MAX_RETRY_DELAY_MS,
                        );
                        tracing::warn!(
                            "S3 operation failed (attempt {}/{}), retrying in {}ms: {}",
                            attempt + 1,
                            max_retries + 1,
                            delay,
                            last_err
                        );
                        tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                    }
                }
            }
        }

        Err(last_err)
    }

    /// Helper to clone for background tasks
    fn clone_for_background(&self) -> Self {
        Self {
            jobs: Arc::clone(&self.jobs),
            persist_path: self.persist_path.clone(),
        }
    }

    /// Check if S3 object exists (for conflict detection)
    pub async fn check_object_exists(
        &self,
        endpoint: &S3Endpoint,
        bucket: &str,
        key: &str,
    ) -> AppResult<bool> {
        let client = self.create_client(endpoint).await?;

        match client.head_object().bucket(bucket).key(key).send().await {
            Ok(_) => Ok(true),
            Err(e) => {
                // Check if it's a 404 error
                if e.to_string().contains("404") || e.to_string().contains("NotFound") {
                    Ok(false)
                } else {
                    Err(AppError::S3(format!("Failed to check object: {}", e)))
                }
            }
        }
    }
}

impl Default for TransferService {
    fn default() -> Self {
        Self::new()
    }
}
