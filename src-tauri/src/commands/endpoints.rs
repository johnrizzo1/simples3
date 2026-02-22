use crate::models::S3Endpoint;
use crate::services::EndpointService;
use uuid::Uuid;

/// List all configured S3 endpoints
#[tauri::command]
pub async fn list_endpoints() -> Result<Vec<S3Endpoint>, String> {
    let service = EndpointService::new().map_err(|e| e.to_string())?;

    // Load endpoints from file first
    service.load_endpoints().await.map_err(|e| e.to_string())?;

    service.list_endpoints().await.map_err(|e| e.to_string())
}

/// Add a new S3 endpoint
#[tauri::command]
pub async fn add_endpoint(
    name: String,
    url: String,
    region: String,
    access_key_id: String,
    secret_access_key: String,
    path_style: Option<bool>,
) -> Result<S3Endpoint, String> {
    let service = EndpointService::new().map_err(|e| e.to_string())?;

    // Load existing endpoints
    service.load_endpoints().await.map_err(|e| e.to_string())?;

    // Create new endpoint
    let mut endpoint = S3Endpoint::new(name, url, region);
    endpoint.path_style = path_style.unwrap_or(true);

    service
        .add_endpoint(endpoint, access_key_id, secret_access_key)
        .await
        .map_err(|e| e.to_string())
}

/// Update an existing endpoint
#[tauri::command]
pub async fn update_endpoint(
    endpoint: S3Endpoint,
    access_key_id: Option<String>,
    secret_access_key: Option<String>,
) -> Result<S3Endpoint, String> {
    let service = EndpointService::new().map_err(|e| e.to_string())?;

    // Load existing endpoints
    service.load_endpoints().await.map_err(|e| e.to_string())?;

    service
        .update_endpoint(endpoint, access_key_id, secret_access_key)
        .await
        .map_err(|e| e.to_string())
}

/// Delete an endpoint
#[tauri::command]
pub async fn delete_endpoint(endpoint_id: String) -> Result<(), String> {
    let service = EndpointService::new().map_err(|e| e.to_string())?;

    // Load existing endpoints
    service.load_endpoints().await.map_err(|e| e.to_string())?;

    let id = Uuid::parse_str(&endpoint_id).map_err(|e| e.to_string())?;

    service.delete_endpoint(id).await.map_err(|e| e.to_string())
}

/// Validate endpoint credentials
#[tauri::command]
pub async fn validate_endpoint(endpoint_id: String) -> Result<(), String> {
    tracing::info!("TAURI COMMAND validate_endpoint called with endpoint_id: {}", endpoint_id);

    let service = EndpointService::new().map_err(|e| {
        tracing::error!("Failed to create EndpointService: {}", e);
        e.to_string()
    })?;

    // Load existing endpoints
    service.load_endpoints().await.map_err(|e| {
        tracing::error!("Failed to load endpoints: {}", e);
        e.to_string()
    })?;

    let id = Uuid::parse_str(&endpoint_id).map_err(|e| {
        tracing::error!("Failed to parse UUID from '{}': {}", endpoint_id, e);
        e.to_string()
    })?;

    tracing::info!("Calling service.validate_endpoint for UUID: {}", id);

    service.validate_endpoint(id).await.map_err(|e| {
        tracing::error!("validate_endpoint service call failed: {}", e);
        e.to_string()
    })?;

    tracing::info!("validate_endpoint completed successfully");
    Ok(())
}

/// Set the active endpoint
#[tauri::command]
pub async fn set_active_endpoint(endpoint_id: String) -> Result<(), String> {
    let service = EndpointService::new().map_err(|e| e.to_string())?;

    // Load existing endpoints
    service.load_endpoints().await.map_err(|e| e.to_string())?;

    let id = Uuid::parse_str(&endpoint_id).map_err(|e| e.to_string())?;

    service
        .set_active_endpoint(id)
        .await
        .map_err(|e| e.to_string())
}
