use crate::models::TransferJob;
use crate::services::{EndpointService, KeystoreService, TransferService};
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

    let transfer_service = TRANSFER_SERVICE.lock().await;
    transfer_service
        .resume_transfer(uuid)
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

/// Set the maximum number of concurrent transfers
#[tauri::command]
pub async fn set_concurrency_limit(_limit: usize) -> Result<(), String> {
    // TODO: Implement in TransferQueue
    Ok(())
}
