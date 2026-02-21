use crate::models::AppConfig;

/// Get application configuration
#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    // TODO: Implement using ConfigService
    Ok(AppConfig::default())
}

/// Update application configuration
#[tauri::command]
pub async fn update_config(_config: AppConfig) -> Result<(), String> {
    // TODO: Implement using ConfigService
    Err("Not implemented yet".to_string())
}
