use crate::utils::{AppError, AppResult};
use keyring::Entry;
use uuid::Uuid;

/// Service for managing credentials in platform-specific keystores
pub struct KeystoreService {
    service_name: String,
}

impl KeystoreService {
    pub fn new() -> Self {
        Self {
            service_name: "com.simples3.app".to_string(),
        }
    }

    /// Store credentials for an endpoint in the keystore
    pub async fn store_credentials(
        &self,
        endpoint_id: Uuid,
        access_key_id: String,
        secret_access_key: String,
    ) -> AppResult<()> {
        let service_name = self.service_name.clone();
        tokio::task::spawn_blocking(move || {
            let access_key_entry = Entry::new(&service_name, &format!("{}_access_key", endpoint_id))
                .map_err(|e| AppError::Keystore(format!("Failed to create keystore entry: {}", e)))?;

            access_key_entry
                .set_password(&access_key_id)
                .map_err(|e| AppError::Keystore(format!("Failed to store access key: {}", e)))?;

            let secret_key_entry = Entry::new(&service_name, &format!("{}_secret_key", endpoint_id))
                .map_err(|e| AppError::Keystore(format!("Failed to create keystore entry: {}", e)))?;

            secret_key_entry
                .set_password(&secret_access_key)
                .map_err(|e| AppError::Keystore(format!("Failed to store secret key: {}", e)))?;

            Ok(())
        })
        .await
        .map_err(|e| AppError::Keystore(format!("Keystore task failed: {}", e)))?
    }

    /// Retrieve credentials for an endpoint from the keystore
    pub async fn retrieve_credentials(
        &self,
        endpoint_id: Uuid,
    ) -> AppResult<(String, String)> {
        let service_name = self.service_name.clone();
        tokio::task::spawn_blocking(move || {
            let access_key_entry = Entry::new(&service_name, &format!("{}_access_key", endpoint_id))
                .map_err(|e| AppError::Keystore(format!("Failed to create keystore entry: {}", e)))?;

            let access_key = access_key_entry
                .get_password()
                .map_err(|e| AppError::Keystore(format!("Failed to retrieve access key: {}", e)))?;

            let secret_key_entry = Entry::new(&service_name, &format!("{}_secret_key", endpoint_id))
                .map_err(|e| AppError::Keystore(format!("Failed to create keystore entry: {}", e)))?;

            let secret_key = secret_key_entry
                .get_password()
                .map_err(|e| AppError::Keystore(format!("Failed to retrieve secret key: {}", e)))?;

            Ok((access_key, secret_key))
        })
        .await
        .map_err(|e| AppError::Keystore(format!("Keystore task failed: {}", e)))?
    }

    /// Delete credentials for an endpoint from the keystore
    pub async fn delete_credentials(&self, endpoint_id: Uuid) -> AppResult<()> {
        let service_name = self.service_name.clone();
        tokio::task::spawn_blocking(move || {
            let access_key_entry = Entry::new(&service_name, &format!("{}_access_key", endpoint_id))
                .map_err(|e| AppError::Keystore(format!("Failed to create keystore entry: {}", e)))?;

            access_key_entry
                .delete_credential()
                .map_err(|e| AppError::Keystore(format!("Failed to delete access key: {}", e)))?;

            let secret_key_entry = Entry::new(&service_name, &format!("{}_secret_key", endpoint_id))
                .map_err(|e| AppError::Keystore(format!("Failed to create keystore entry: {}", e)))?;

            secret_key_entry
                .delete_credential()
                .map_err(|e| AppError::Keystore(format!("Failed to delete secret key: {}", e)))?;

            Ok(())
        })
        .await
        .map_err(|e| AppError::Keystore(format!("Keystore task failed: {}", e)))?
    }

    /// Check if credentials exist for an endpoint
    pub async fn has_credentials(&self, endpoint_id: Uuid) -> AppResult<bool> {
        let service_name = self.service_name.clone();
        tokio::task::spawn_blocking(move || {
            let access_key_entry = Entry::new(&service_name, &format!("{}_access_key", endpoint_id))
                .map_err(|e| AppError::Keystore(format!("Failed to create keystore entry: {}", e)))?;

            match access_key_entry.get_password() {
                Ok(_) => Ok(true),
                Err(_) => Ok(false),
            }
        })
        .await
        .map_err(|e| AppError::Keystore(format!("Keystore task failed: {}", e)))?
    }
}

impl Default for KeystoreService {
    fn default() -> Self {
        Self::new()
    }
}
