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

        Ok(Client::new(&config))
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

    /// List objects in a bucket with optional prefix
    pub async fn list_objects(
        &self,
        endpoint: &S3Endpoint,
        bucket: String,
        prefix: Option<String>,
    ) -> AppResult<Vec<S3Object>> {
        let client = self.create_client(endpoint).await?;

        let mut request = client.list_objects_v2().bucket(&bucket);

        if let Some(p) = prefix {
            request = request.prefix(p);
        }

        let response = request
            .send()
            .await
            .map_err(|e| AppError::S3(format!("Failed to list objects: {}", e)))?;

        let objects = response
            .contents()
            .iter()
            .filter_map(|obj| {
                let key = obj.key()?.to_string();
                let size = obj.size()? as u64;
                let last_modified = obj.last_modified()?;
                let modified = chrono::DateTime::from_timestamp(
                    last_modified.secs(),
                    last_modified.subsec_nanos(),
                )?;
                Some(S3Object {
                    bucket: bucket.clone(),
                    key,
                    size,
                    modified,
                    storage_class: obj.storage_class().map(|s| s.as_str().to_string()),
                    etag: obj.e_tag().map(|e| e.to_string()),
                    is_prefix: false,
                })
            })
            .collect();

        Ok(objects)
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
