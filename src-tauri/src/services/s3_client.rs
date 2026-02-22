use crate::models::{S3Bucket, S3Endpoint, S3Object};
use crate::utils::{AppError, AppResult};
use aws_config::meta::region::RegionProviderChain;
use aws_config::BehaviorVersion;
use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::Client;

/// Service for S3 operations
pub struct S3ClientService;

impl S3ClientService {
    pub fn new() -> Self {
        Self
    }

    /// Create an S3 client from endpoint configuration
    async fn create_client(&self, endpoint: &S3Endpoint) -> AppResult<Client> {
        let access_key = endpoint
            .access_key_id
            .as_ref()
            .ok_or_else(|| AppError::S3("Access key not available".to_string()))?;

        let secret_key = endpoint
            .secret_access_key
            .as_ref()
            .ok_or_else(|| AppError::S3("Secret key not available".to_string()))?;

        // Create credentials
        let credentials = Credentials::new(
            access_key,
            secret_key,
            None, // session token
            None, // expiration
            "simples3",
        );

        // Create region provider
        let region_provider = RegionProviderChain::first_try(Region::new(endpoint.region.clone()));

        // Build config
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

    /// Validate S3 endpoint credentials by attempting to list buckets
    pub async fn validate_endpoint(&self, endpoint: &S3Endpoint) -> AppResult<()> {
        tracing::info!("Validating endpoint: {} at {}", endpoint.name, endpoint.url);

        let client = self.create_client(endpoint).await.map_err(|e| {
            tracing::error!("Failed to create S3 client: {}", e);
            e
        })?;

        tracing::info!("S3 client created, attempting to list buckets...");

        // Attempt to list buckets as a validation check
        let result = client
            .list_buckets()
            .send()
            .await
            .map_err(|e| {
                tracing::error!("S3 list_buckets failed: {:?}", e);
                AppError::S3(format!("Failed to validate endpoint: {}", e))
            })?;

        tracing::info!("Successfully validated endpoint, found {} buckets", result.buckets().len());

        Ok(())
    }

    /// List all buckets for the given endpoint
    pub async fn list_buckets(&self, endpoint: &S3Endpoint) -> AppResult<Vec<S3Bucket>> {
        let client = self.create_client(endpoint).await?;

        let response = client
            .list_buckets()
            .send()
            .await
            .map_err(|e| {
                tracing::error!("S3 list_buckets error details: {:?}", e);
                tracing::error!("S3 list_buckets error display: {}", e);
                AppError::S3(format!("Failed to list buckets: {}", e))
            })?;

        let buckets = response
            .buckets()
            .iter()
            .filter_map(|b| {
                let name = b.name()?.to_string();
                let creation_date = b.creation_date()?;
                let created = chrono::DateTime::from_timestamp(
                    creation_date.secs(),
                    creation_date.subsec_nanos(),
                )?;
                Some(S3Bucket {
                    name,
                    created,
                    region: Some(endpoint.region.clone()),
                })
            })
            .collect();

        Ok(buckets)
    }

    /// List objects in a bucket with optional prefix, using delimiter for folder navigation
    pub async fn list_objects(
        &self,
        endpoint: &S3Endpoint,
        bucket: String,
        prefix: Option<String>,
    ) -> AppResult<Vec<S3Object>> {
        let client = self.create_client(endpoint).await?;

        let mut request = client.list_objects_v2().bucket(&bucket).delimiter("/");

        if let Some(ref p) = prefix {
            request = request.prefix(p);
        }

        let response = request
            .send()
            .await
            .map_err(|e| AppError::S3(format!("Failed to list objects: {}", e)))?;

        let mut objects: Vec<S3Object> = Vec::new();

        // Add common prefixes (folders) first
        for cp in response.common_prefixes() {
            if let Some(prefix_str) = cp.prefix() {
                objects.push(S3Object {
                    bucket: bucket.clone(),
                    key: prefix_str.to_string(),
                    size: 0,
                    modified: chrono::Utc::now(),
                    storage_class: None,
                    etag: None,
                    is_prefix: true,
                });
            }
        }

        // Add objects (files) at this level
        for obj in response.contents() {
            let Some(key) = obj.key() else { continue };
            let key = key.to_string();

            // Skip directory marker objects (keys ending with / that match the current prefix)
            if key.ends_with('/') {
                continue;
            }

            let size = obj.size().unwrap_or(0) as u64;
            let modified = obj
                .last_modified()
                .and_then(|lm| {
                    chrono::DateTime::from_timestamp(lm.secs(), lm.subsec_nanos())
                })
                .unwrap_or_else(chrono::Utc::now);

            objects.push(S3Object {
                bucket: bucket.clone(),
                key,
                size,
                modified,
                storage_class: obj.storage_class().map(|s| s.as_str().to_string()),
                etag: obj.e_tag().map(|e| e.to_string()),
                is_prefix: false,
            });
        }

        Ok(objects)
    }

    /// Copy an object within the same bucket
    pub async fn copy_object(
        &self,
        endpoint: &S3Endpoint,
        bucket: String,
        source_key: String,
        dest_key: String,
    ) -> AppResult<()> {
        let client = self.create_client(endpoint).await?;

        let copy_source = format!("{}/{}", bucket, source_key);

        client
            .copy_object()
            .bucket(&bucket)
            .copy_source(&copy_source)
            .key(&dest_key)
            .send()
            .await
            .map_err(|e| AppError::S3(format!("Failed to copy object: {}", e)))?;

        Ok(())
    }

    /// Delete all objects under a prefix (recursive)
    pub async fn delete_prefix(
        &self,
        endpoint: &S3Endpoint,
        bucket: String,
        prefix: String,
    ) -> AppResult<u32> {
        let client = self.create_client(endpoint).await?;

        // List all objects under this prefix (no delimiter = recursive)
        let mut deleted_count: u32 = 0;
        let mut continuation_token: Option<String> = None;

        loop {
            let mut request = client
                .list_objects_v2()
                .bucket(&bucket)
                .prefix(&prefix);

            if let Some(token) = &continuation_token {
                request = request.continuation_token(token);
            }

            let response = request
                .send()
                .await
                .map_err(|e| AppError::S3(format!("Failed to list objects for deletion: {}", e)))?;

            for obj in response.contents() {
                if let Some(key) = obj.key() {
                    client
                        .delete_object()
                        .bucket(&bucket)
                        .key(key)
                        .send()
                        .await
                        .map_err(|e| AppError::S3(format!("Failed to delete {}: {}", key, e)))?;
                    deleted_count += 1;
                }
            }

            if response.is_truncated() == Some(true) {
                continuation_token = response.next_continuation_token().map(|s| s.to_string());
            } else {
                break;
            }
        }

        Ok(deleted_count)
    }

    /// Delete an object from S3
    pub async fn delete_object(
        &self,
        endpoint: &S3Endpoint,
        bucket: String,
        key: String,
    ) -> AppResult<()> {
        let client = self.create_client(endpoint).await?;

        client
            .delete_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| AppError::S3(format!("Failed to delete object: {}", e)))?;

        Ok(())
    }
}

impl Default for S3ClientService {
    fn default() -> Self {
        Self::new()
    }
}
