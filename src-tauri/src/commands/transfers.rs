use crate::models::TransferJob;
use crate::services::{EndpointService, FilesystemService, KeystoreService, S3ClientService, TransferService};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

// Global transfer service instance
lazy_static::lazy_static! {
    static ref TRANSFER_SERVICE: Arc<Mutex<TransferService>> =
        Arc::new(Mutex::new(TransferService::new()));
}

/// Upload a file to S3
#[tauri::command]
pub async fn upload_file(
    local_path: String,
    bucket: String,
    s3_key: String,
) -> Result<String, String> {
    // Get active endpoint
    let endpoint_service = EndpointService::new().map_err(|e| e.to_string())?;
    endpoint_service
        .load_endpoints()
        .await
        .map_err(|e| e.to_string())?;

    let endpoints = endpoint_service
        .list_endpoints()
        .await
        .map_err(|e| e.to_string())?;
    let active_endpoint = endpoints
        .iter()
        .find(|e| e.is_active)
        .ok_or_else(|| "No active endpoint configured".to_string())?;

    // Load credentials
    let keystore = KeystoreService::new();
    let (access_key, secret_key) = keystore
        .retrieve_credentials(active_endpoint.id)
        .await
        .map_err(|e| e.to_string())?;

    // Create endpoint with credentials
    let mut endpoint_with_creds = active_endpoint.clone();
    endpoint_with_creds.access_key_id = Some(access_key);
    endpoint_with_creds.secret_access_key = Some(secret_key);

    // Queue upload
    let transfer_service = TRANSFER_SERVICE.lock().await;
    let job_id = transfer_service
        .queue_upload(&endpoint_with_creds, local_path, bucket, s3_key)
        .await
        .map_err(|e| e.to_string())?;

    Ok(job_id.to_string())
}

/// Pause a transfer
#[tauri::command]
pub async fn pause_transfer(job_id: String) -> Result<(), String> {
    let uuid = Uuid::parse_str(&job_id).map_err(|e| e.to_string())?;

    let transfer_service = TRANSFER_SERVICE.lock().await;
    transfer_service
        .pause_transfer(uuid)
        .await
        .map_err(|e| e.to_string())
}

/// Resume a paused transfer
#[tauri::command]
pub async fn resume_transfer(job_id: String) -> Result<(), String> {
    let uuid = Uuid::parse_str(&job_id).map_err(|e| e.to_string())?;

    // Load active endpoint + credentials for re-spawning the transfer
    let endpoint_service = EndpointService::new().map_err(|e| e.to_string())?;
    endpoint_service
        .load_endpoints()
        .await
        .map_err(|e| e.to_string())?;
    let endpoints = endpoint_service
        .list_endpoints()
        .await
        .map_err(|e| e.to_string())?;
    let active_endpoint = endpoints
        .iter()
        .find(|e| e.is_active)
        .ok_or_else(|| "No active endpoint configured".to_string())?;

    let keystore = KeystoreService::new();
    let (access_key, secret_key) = keystore
        .retrieve_credentials(active_endpoint.id)
        .await
        .map_err(|e| e.to_string())?;

    let mut endpoint_with_creds = active_endpoint.clone();
    endpoint_with_creds.access_key_id = Some(access_key);
    endpoint_with_creds.secret_access_key = Some(secret_key);

    let transfer_service = TRANSFER_SERVICE.lock().await;
    transfer_service
        .resume_transfer(uuid, &endpoint_with_creds)
        .await
        .map_err(|e| e.to_string())
}

/// Cancel a transfer
#[tauri::command]
pub async fn cancel_transfer(job_id: String) -> Result<(), String> {
    let uuid = Uuid::parse_str(&job_id).map_err(|e| e.to_string())?;

    let transfer_service = TRANSFER_SERVICE.lock().await;
    transfer_service
        .cancel_transfer(uuid)
        .await
        .map_err(|e| e.to_string())
}

/// Get all transfers in the queue
#[tauri::command]
pub async fn get_transfer_queue() -> Result<Vec<TransferJob>, String> {
    let transfer_service = TRANSFER_SERVICE.lock().await;
    transfer_service
        .get_transfer_queue()
        .await
        .map_err(|e| e.to_string())
}

/// Download a file from S3
#[tauri::command]
pub async fn download_file(
    bucket: String,
    s3_key: String,
    local_path: String,
) -> Result<String, String> {
    // Get active endpoint
    let endpoint_service = EndpointService::new().map_err(|e| e.to_string())?;
    endpoint_service
        .load_endpoints()
        .await
        .map_err(|e| e.to_string())?;

    let endpoints = endpoint_service
        .list_endpoints()
        .await
        .map_err(|e| e.to_string())?;
    let active_endpoint = endpoints
        .iter()
        .find(|e| e.is_active)
        .ok_or_else(|| "No active endpoint configured".to_string())?;

    // Load credentials
    let keystore = KeystoreService::new();
    let (access_key, secret_key) = keystore
        .retrieve_credentials(active_endpoint.id)
        .await
        .map_err(|e| e.to_string())?;

    // Create endpoint with credentials
    let mut endpoint_with_creds = active_endpoint.clone();
    endpoint_with_creds.access_key_id = Some(access_key);
    endpoint_with_creds.secret_access_key = Some(secret_key);

    // Queue download
    let transfer_service = TRANSFER_SERVICE.lock().await;
    let job_id = transfer_service
        .queue_download(&endpoint_with_creds, bucket, s3_key, local_path)
        .await
        .map_err(|e| e.to_string())?;

    Ok(job_id.to_string())
}

/// Check if an S3 object exists (for conflict detection)
#[tauri::command]
pub async fn check_object_exists(bucket: String, key: String) -> Result<bool, String> {
    // Get active endpoint
    let endpoint_service = EndpointService::new().map_err(|e| e.to_string())?;
    endpoint_service
        .load_endpoints()
        .await
        .map_err(|e| e.to_string())?;

    let endpoints = endpoint_service
        .list_endpoints()
        .await
        .map_err(|e| e.to_string())?;
    let active_endpoint = endpoints
        .iter()
        .find(|e| e.is_active)
        .ok_or_else(|| "No active endpoint configured".to_string())?;

    // Load credentials
    let keystore = KeystoreService::new();
    let (access_key, secret_key) = keystore
        .retrieve_credentials(active_endpoint.id)
        .await
        .map_err(|e| e.to_string())?;

    // Create endpoint with credentials
    let mut endpoint_with_creds = active_endpoint.clone();
    endpoint_with_creds.access_key_id = Some(access_key);
    endpoint_with_creds.secret_access_key = Some(secret_key);

    // Check if object exists
    let transfer_service = TRANSFER_SERVICE.lock().await;
    transfer_service
        .check_object_exists(&endpoint_with_creds, &bucket, &key)
        .await
        .map_err(|e| e.to_string())
}

/// Upload a local directory recursively to S3
#[tauri::command]
pub async fn upload_directory(
    local_path: String,
    bucket: String,
    s3_prefix: String,
) -> Result<Vec<String>, String> {
    let root = PathBuf::from(&local_path);

    // Recursively list all files
    let fs_service = FilesystemService::new();
    let files = fs_service
        .list_directory_recursive(&root)
        .map_err(|e| e.to_string())?;

    if files.is_empty() {
        return Err("Directory is empty or contains no files".to_string());
    }

    // Get active endpoint + credentials
    let endpoint_service = EndpointService::new().map_err(|e| e.to_string())?;
    endpoint_service
        .load_endpoints()
        .await
        .map_err(|e| e.to_string())?;
    let endpoints = endpoint_service
        .list_endpoints()
        .await
        .map_err(|e| e.to_string())?;
    let active_endpoint = endpoints
        .iter()
        .find(|e| e.is_active)
        .ok_or_else(|| "No active endpoint configured".to_string())?;

    let keystore = KeystoreService::new();
    let (access_key, secret_key) = keystore
        .retrieve_credentials(active_endpoint.id)
        .await
        .map_err(|e| e.to_string())?;

    let mut endpoint_with_creds = active_endpoint.clone();
    endpoint_with_creds.access_key_id = Some(access_key);
    endpoint_with_creds.secret_access_key = Some(secret_key);

    // Queue individual uploads
    let mut job_ids = Vec::new();
    let transfer_service = TRANSFER_SERVICE.lock().await;

    for file_path in files {
        let relative = file_path
            .strip_prefix(&root)
            .map_err(|e| e.to_string())?;
        // Use forward slashes for S3 keys
        let relative_key = relative
            .to_string_lossy()
            .replace('\\', "/");
        let s3_key = format!("{}{}", s3_prefix, relative_key);

        let job_id = transfer_service
            .queue_upload(
                &endpoint_with_creds,
                file_path.to_string_lossy().to_string(),
                bucket.clone(),
                s3_key,
            )
            .await
            .map_err(|e| e.to_string())?;

        job_ids.push(job_id.to_string());
    }

    Ok(job_ids)
}

/// Download an S3 prefix (folder) recursively to a local directory
#[tauri::command]
pub async fn download_prefix(
    bucket: String,
    s3_prefix: String,
    local_path: String,
) -> Result<Vec<String>, String> {
    // Get active endpoint + credentials
    let endpoint_service = EndpointService::new().map_err(|e| e.to_string())?;
    endpoint_service
        .load_endpoints()
        .await
        .map_err(|e| e.to_string())?;
    let endpoints = endpoint_service
        .list_endpoints()
        .await
        .map_err(|e| e.to_string())?;
    let active_endpoint = endpoints
        .iter()
        .find(|e| e.is_active)
        .ok_or_else(|| "No active endpoint configured".to_string())?;

    let keystore = KeystoreService::new();
    let (access_key, secret_key) = keystore
        .retrieve_credentials(active_endpoint.id)
        .await
        .map_err(|e| e.to_string())?;

    let mut endpoint_with_creds = active_endpoint.clone();
    endpoint_with_creds.access_key_id = Some(access_key);
    endpoint_with_creds.secret_access_key = Some(secret_key);

    // List all objects under the prefix
    let s3_service = S3ClientService::new();
    let objects = s3_service
        .list_objects(&endpoint_with_creds, bucket.clone(), Some(s3_prefix.clone()))
        .await
        .map_err(|e| e.to_string())?;

    // Filter out zero-size "directory marker" objects (keys ending with /)
    let file_objects: Vec<_> = objects
        .into_iter()
        .filter(|o| !o.key.ends_with('/'))
        .collect();

    if file_objects.is_empty() {
        return Err("No files found under this prefix".to_string());
    }

    // Queue individual downloads
    let mut job_ids = Vec::new();
    let transfer_service = TRANSFER_SERVICE.lock().await;

    for object in file_objects {
        // Strip the prefix to get the relative path
        let relative_key = object.key.strip_prefix(&s3_prefix).unwrap_or(&object.key);
        let dest = PathBuf::from(&local_path).join(relative_key);

        // Create parent directories
        if let Some(parent) = dest.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }

        let job_id = transfer_service
            .queue_download(
                &endpoint_with_creds,
                bucket.clone(),
                object.key.clone(),
                dest.to_string_lossy().to_string(),
            )
            .await
            .map_err(|e| e.to_string())?;

        job_ids.push(job_id.to_string());
    }

    Ok(job_ids)
}

/// Clear completed, failed, and cancelled transfers
#[tauri::command]
pub async fn clear_finished_transfers() -> Result<(), String> {
    TRANSFER_SERVICE
        .lock()
        .await
        .clear_finished()
        .await
        .map_err(|e| e.to_string())
}
