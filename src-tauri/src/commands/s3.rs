use crate::models::{S3Bucket, S3Object};
use crate::services::{EndpointService, KeystoreService, S3ClientService};

/// List all buckets for the active endpoint
#[tauri::command]
pub async fn list_buckets() -> Result<Vec<S3Bucket>, String> {
    tracing::info!("list_buckets command called");

    // Get the active endpoint
    let endpoint_service = EndpointService::new().map_err(|e| {
        tracing::error!("Failed to create endpoint service: {}", e);
        e.to_string()
    })?;
    endpoint_service.load_endpoints().await.map_err(|e| {
        tracing::error!("Failed to load endpoints: {}", e);
        e.to_string()
    })?;

    let endpoints = endpoint_service.list_endpoints().await.map_err(|e| {
        tracing::error!("Failed to list endpoints: {}", e);
        e.to_string()
    })?;

    tracing::info!("Found {} total endpoints", endpoints.len());

    let active_endpoint = endpoints
        .iter()
        .find(|e| e.is_active)
        .ok_or_else(|| {
            tracing::warn!("No active endpoint configured");
            "No active endpoint configured".to_string()
        })?;

    tracing::info!("Using active endpoint: {} ({})", active_endpoint.name, active_endpoint.url);

    // Load credentials from keystore
    let keystore = KeystoreService::new();
    let (access_key, secret_key) = keystore
        .retrieve_credentials(active_endpoint.id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to retrieve credentials for endpoint {}: {}", active_endpoint.id, e);
            e.to_string()
        })?;

    tracing::info!("Credentials retrieved for endpoint {}", active_endpoint.name);

    // Create endpoint with credentials
    let mut endpoint_with_creds = active_endpoint.clone();
    endpoint_with_creds.access_key_id = Some(access_key);
    endpoint_with_creds.secret_access_key = Some(secret_key);

    // List buckets using S3 client
    tracing::info!("Calling S3 list_buckets API...");
    let s3_client = S3ClientService::new();
    let result = s3_client
        .list_buckets(&endpoint_with_creds)
        .await
        .map_err(|e| {
            tracing::error!("S3 list_buckets API failed: {}", e);
            e.to_string()
        })?;

    tracing::info!("Successfully listed {} buckets", result.len());
    Ok(result)
}

/// List objects in a bucket with optional prefix
#[tauri::command]
pub async fn list_objects(
    bucket: String,
    prefix: Option<String>,
) -> Result<Vec<S3Object>, String> {
    // Get the active endpoint
    let endpoint_service = EndpointService::new().map_err(|e| e.to_string())?;
    endpoint_service.load_endpoints().await.map_err(|e| e.to_string())?;

    let endpoints = endpoint_service.list_endpoints().await.map_err(|e| e.to_string())?;
    let active_endpoint = endpoints
        .iter()
        .find(|e| e.is_active)
        .ok_or_else(|| "No active endpoint configured".to_string())?;

    // Load credentials from keystore
    let keystore = KeystoreService::new();
    let (access_key, secret_key) = keystore
        .retrieve_credentials(active_endpoint.id)
        .await
        .map_err(|e| e.to_string())?;

    // Create endpoint with credentials
    let mut endpoint_with_creds = active_endpoint.clone();
    endpoint_with_creds.access_key_id = Some(access_key);
    endpoint_with_creds.secret_access_key = Some(secret_key);

    // List objects using S3 client
    let s3_client = S3ClientService::new();
    s3_client
        .list_objects(&endpoint_with_creds, bucket, prefix)
        .await
        .map_err(|e| e.to_string())
}

/// Delete an S3 object
#[tauri::command]
pub async fn delete_s3_object(bucket: String, key: String) -> Result<(), String> {
    // Get active endpoint
    let endpoint_service = EndpointService::new().map_err(|e| e.to_string())?;
    endpoint_service.load_endpoints().await.map_err(|e| e.to_string())?;

    let endpoints = endpoint_service.list_endpoints().await.map_err(|e| e.to_string())?;
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

    // Delete object
    let s3_client = S3ClientService::new();
    s3_client
        .delete_object(&endpoint_with_creds, bucket, key)
        .await
        .map_err(|e| e.to_string())
}
