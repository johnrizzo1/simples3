use crate::models::S3Endpoint;
use crate::services::{KeystoreService, S3ClientService};
use crate::utils::{AppError, AppResult};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

/// Service for managing S3 endpoints
pub struct EndpointService {
    endpoints: Arc<Mutex<Vec<S3Endpoint>>>,
    keystore: KeystoreService,
    s3_client: S3ClientService,
    config_path: PathBuf,
}

impl EndpointService {
    pub fn new() -> AppResult<Self> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| AppError::Config("Could not determine config directory".to_string()))?;

        let app_config_dir = config_dir.join("com.simples3.app");

        // Create config directory if it doesn't exist
        if !app_config_dir.exists() {
            fs::create_dir_all(&app_config_dir).map_err(AppError::Io)?;
        }

        let config_path = app_config_dir.join("endpoints.json");

        Ok(Self {
            endpoints: Arc::new(Mutex::new(Vec::new())),
            keystore: KeystoreService::new(),
            s3_client: S3ClientService::new(),
            config_path,
        })
    }

    /// Load endpoints from JSON file
    pub async fn load_endpoints(&self) -> AppResult<Vec<S3Endpoint>> {
        if !self.config_path.exists() {
            return Ok(vec![]);
        }

        let content = fs::read_to_string(&self.config_path).map_err(AppError::Io)?;
        let endpoints: Vec<S3Endpoint> =
            serde_json::from_str(&content).map_err(|e| {
                AppError::Config(format!("Failed to parse endpoints file: {}", e))
            })?;

        let mut cache = self.endpoints.lock().await;
        *cache = endpoints.clone();

        Ok(endpoints)
    }

    /// Save endpoints to JSON file
    async fn save_endpoints(&self) -> AppResult<()> {
        let endpoints = self.endpoints.lock().await;
        let content = serde_json::to_string_pretty(&*endpoints).map_err(|e| {
            AppError::Config(format!("Failed to serialize endpoints: {}", e))
        })?;

        fs::write(&self.config_path, content).map_err(AppError::Io)?;
        Ok(())
    }

    /// Add a new endpoint with credential storage
    pub async fn add_endpoint(
        &self,
        mut endpoint: S3Endpoint,
        access_key_id: String,
        secret_access_key: String,
    ) -> AppResult<S3Endpoint> {
        // Validate endpoint name is unique
        let endpoints = self.endpoints.lock().await;
        if endpoints.iter().any(|e| e.name == endpoint.name) {
            return Err(AppError::AlreadyExists(format!(
                "Endpoint with name '{}' already exists",
                endpoint.name
            )));
        }
        drop(endpoints);

        // Store credentials in keystore
        self.keystore
            .store_credentials(endpoint.id, access_key_id.clone(), secret_access_key.clone())
            .await?;

        // Set credentials for validation (but won't be serialized)
        endpoint.access_key_id = Some(access_key_id);
        endpoint.secret_access_key = Some(secret_access_key);

        // Add to endpoints list
        let mut endpoints = self.endpoints.lock().await;
        endpoints.push(endpoint.clone());
        drop(endpoints);

        // Save to file
        self.save_endpoints().await?;

        Ok(endpoint)
    }

    /// Update an existing endpoint
    pub async fn update_endpoint(
        &self,
        updated_endpoint: S3Endpoint,
        access_key_id: Option<String>,
        secret_access_key: Option<String>,
    ) -> AppResult<S3Endpoint> {
        let mut endpoints = self.endpoints.lock().await;

        let index = endpoints
            .iter()
            .position(|e| e.id == updated_endpoint.id)
            .ok_or_else(|| AppError::NotFound("Endpoint not found".to_string()))?;

        // Check name uniqueness (excluding current endpoint)
        if endpoints
            .iter()
            .enumerate()
            .any(|(i, e)| i != index && e.name == updated_endpoint.name)
        {
            return Err(AppError::AlreadyExists(format!(
                "Endpoint with name '{}' already exists",
                updated_endpoint.name
            )));
        }

        // Update credentials if provided
        if let (Some(access_key), Some(secret_key)) = (access_key_id, secret_access_key) {
            self.keystore
                .store_credentials(updated_endpoint.id, access_key, secret_key)
                .await?;
        }

        endpoints[index] = updated_endpoint.clone();
        drop(endpoints);

        self.save_endpoints().await?;

        Ok(updated_endpoint)
    }

    /// Delete an endpoint with credential removal
    pub async fn delete_endpoint(&self, endpoint_id: Uuid) -> AppResult<()> {
        let mut endpoints = self.endpoints.lock().await;

        let index = endpoints
            .iter()
            .position(|e| e.id == endpoint_id)
            .ok_or_else(|| AppError::NotFound("Endpoint not found".to_string()))?;

        endpoints.remove(index);
        drop(endpoints);

        // Delete credentials from keystore
        self.keystore.delete_credentials(endpoint_id).await?;

        self.save_endpoints().await?;

        Ok(())
    }

    /// Validate endpoint using S3 ListBuckets API call
    pub async fn validate_endpoint(&self, endpoint_id: Uuid) -> AppResult<()> {
        tracing::info!("validate_endpoint called for endpoint_id: {}", endpoint_id);

        let mut endpoints = self.endpoints.lock().await;

        let endpoint = endpoints
            .iter_mut()
            .find(|e| e.id == endpoint_id)
            .ok_or_else(|| {
                tracing::error!("Endpoint {} not found", endpoint_id);
                AppError::NotFound("Endpoint not found".to_string())
            })?;

        tracing::info!("Found endpoint: {} ({})", endpoint.name, endpoint.url);

        // Retrieve credentials
        tracing::info!("Retrieving credentials from keystore...");
        let (access_key, secret_key) = self.keystore.retrieve_credentials(endpoint_id).await.map_err(|e| {
            tracing::error!("Failed to retrieve credentials: {}", e);
            e
        })?;

        tracing::info!("Credentials retrieved successfully, access_key length: {}", access_key.len());

        endpoint.access_key_id = Some(access_key);
        endpoint.secret_access_key = Some(secret_key);

        // Validate using S3 client
        let validation_result = match self.s3_client.validate_endpoint(endpoint).await {
            Ok(_) => {
                tracing::info!("Endpoint validated successfully");
                endpoint.mark_validated();
                Ok(())
            }
            Err(e) => {
                tracing::error!("Endpoint validation failed: {}", e);
                endpoint.mark_failed(e.to_string());
                Err(e)
            }
        };

        drop(endpoints);
        self.save_endpoints().await?;

        validation_result
    }

    /// Set the active endpoint (ensuring only one active)
    pub async fn set_active_endpoint(&self, endpoint_id: Uuid) -> AppResult<()> {
        let mut endpoints = self.endpoints.lock().await;

        // Find the endpoint
        let endpoint_exists = endpoints.iter().any(|e| e.id == endpoint_id);
        if !endpoint_exists {
            return Err(AppError::NotFound("Endpoint not found".to_string()));
        }

        // Set all endpoints to inactive, then set the target to active
        for endpoint in endpoints.iter_mut() {
            endpoint.is_active = endpoint.id == endpoint_id;
        }

        drop(endpoints);
        self.save_endpoints().await?;

        Ok(())
    }

    /// Get all endpoints
    pub async fn list_endpoints(&self) -> AppResult<Vec<S3Endpoint>> {
        let endpoints = self.endpoints.lock().await;
        Ok(endpoints.clone())
    }

    /// Get a specific endpoint by ID
    pub async fn get_endpoint(&self, endpoint_id: Uuid) -> AppResult<S3Endpoint> {
        let endpoints = self.endpoints.lock().await;
        endpoints
            .iter()
            .find(|e| e.id == endpoint_id)
            .cloned()
            .ok_or_else(|| AppError::NotFound("Endpoint not found".to_string()))
    }
}

impl Default for EndpointService {
    fn default() -> Self {
        Self::new().expect("Failed to create EndpointService")
    }
}
