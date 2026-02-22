use crate::models::{AppConfig, AppState};
use crate::utils::{AppError, AppResult};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Service for managing application configuration
pub struct ConfigService {
    config_cache: Arc<Mutex<Option<AppConfig>>>,
    config_path: PathBuf,
}

impl ConfigService {
    pub fn new() -> AppResult<Self> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| AppError::Config("Could not determine config directory".to_string()))?;

        let app_config_dir = config_dir.join("com.simples3.app");

        if !app_config_dir.exists() {
            fs::create_dir_all(&app_config_dir).map_err(AppError::Io)?;
        }

        let config_path = app_config_dir.join("config.json");

        Ok(Self {
            config_cache: Arc::new(Mutex::new(None)),
            config_path,
        })
    }

    /// Load application configuration from JSON file or return defaults
    pub async fn load_config(&self) -> AppResult<AppConfig> {
        let cache = self.config_cache.lock().await;
        if let Some(config) = cache.as_ref() {
            return Ok(config.clone());
        }
        drop(cache);

        let config = if self.config_path.exists() {
            let content = fs::read_to_string(&self.config_path).map_err(AppError::Io)?;
            serde_json::from_str(&content).map_err(|e| {
                AppError::Config(format!("Failed to parse config: {}", e))
            })?
        } else {
            AppConfig::default()
        };

        let mut cache = self.config_cache.lock().await;
        *cache = Some(config.clone());

        Ok(config)
    }

    /// Save application configuration to JSON file
    pub async fn save_config(&self, config: AppConfig) -> AppResult<()> {
        self.validate_config(&config)?;

        let content = serde_json::to_string_pretty(&config).map_err(|e| {
            AppError::Config(format!("Failed to serialize config: {}", e))
        })?;

        fs::write(&self.config_path, content).map_err(AppError::Io)?;

        let mut cache = self.config_cache.lock().await;
        *cache = Some(config);

        Ok(())
    }

    /// Load app state from JSON file or return defaults
    pub async fn load_app_state(&self) -> AppResult<AppState> {
        let state_path = self.config_path.parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .join("state.json");

        if state_path.exists() {
            let content = fs::read_to_string(&state_path).map_err(AppError::Io)?;
            serde_json::from_str(&content).map_err(|e| {
                AppError::Config(format!("Failed to parse app state: {}", e))
            })
        } else {
            Ok(AppState::default())
        }
    }

    /// Save app state to JSON file
    pub async fn save_app_state(&self, state: AppState) -> AppResult<()> {
        let state_path = self.config_path.parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .join("state.json");

        let content = serde_json::to_string_pretty(&state).map_err(|e| {
            AppError::Config(format!("Failed to serialize app state: {}", e))
        })?;

        fs::write(&state_path, content).map_err(AppError::Io)?;
        Ok(())
    }

    /// Validate configuration values
    fn validate_config(&self, config: &AppConfig) -> AppResult<()> {
        if config.max_concurrent_transfers < 1 || config.max_concurrent_transfers > 10 {
            return Err(AppError::Validation(
                "max_concurrent_transfers must be between 1 and 10".to_string(),
            ));
        }

        if config.multipart_chunk_size < 5 * 1024 * 1024
            || config.multipart_chunk_size > 100 * 1024 * 1024
        {
            return Err(AppError::Validation(
                "multipart_chunk_size must be between 5 MB and 100 MB".to_string(),
            ));
        }

        if config.multipart_threshold < 10 * 1024 * 1024 {
            return Err(AppError::Validation(
                "multipart_threshold must be at least 10 MB".to_string(),
            ));
        }

        Ok(())
    }
}

impl Default for ConfigService {
    fn default() -> Self {
        Self::new().expect("Failed to create ConfigService")
    }
}
