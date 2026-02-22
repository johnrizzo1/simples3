use crate::models::{AppConfig, AppState};
use crate::services::ConfigService;
use lazy_static::lazy_static;
use std::sync::Arc;
use tokio::sync::Mutex;

lazy_static! {
    static ref CONFIG_SERVICE: Arc<Mutex<ConfigService>> =
        Arc::new(Mutex::new(ConfigService::default()));
}

/// Get application configuration
#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    let service = CONFIG_SERVICE.lock().await;
    service.load_config().await.map_err(|e| e.to_string())
}

/// Update application configuration
#[tauri::command]
pub async fn update_config(config: AppConfig) -> Result<(), String> {
    let service = CONFIG_SERVICE.lock().await;
    service.save_config(config).await.map_err(|e| e.to_string())
}

/// Get saved app state
#[tauri::command]
pub async fn get_app_state() -> Result<AppState, String> {
    let service = CONFIG_SERVICE.lock().await;
    service.load_app_state().await.map_err(|e| e.to_string())
}

/// Save app state
#[tauri::command]
pub async fn save_app_state(state: AppState) -> Result<(), String> {
    let service = CONFIG_SERVICE.lock().await;
    service.save_app_state(state).await.map_err(|e| e.to_string())
}
