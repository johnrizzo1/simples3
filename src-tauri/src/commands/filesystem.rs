use crate::models::LocalFileItem;
use crate::services::FilesystemService;
use std::path::PathBuf;

/// List files and directories at the given path
#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<LocalFileItem>, String> {
    tracing::info!("list_directory called with path: '{}'", path);

    let service = FilesystemService::new();
    let path_buf = PathBuf::from(&path);

    let result = service
        .list_directory(path_buf)
        .await
        .map_err(|e| e.to_string());

    match &result {
        Ok(items) => tracing::info!("list_directory returned {} items", items.len()),
        Err(e) => tracing::error!("list_directory failed for '{}': {}", path, e),
    }

    result
}

/// Get the user's home directory path
#[tauri::command]
pub fn get_home_directory() -> Result<String, String> {
    let service = FilesystemService::new();

    let result = service
        .get_home_directory()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|e| e.to_string());

    match &result {
        Ok(path) => tracing::info!("get_home_directory returned: '{}'", path),
        Err(e) => tracing::error!("get_home_directory failed: {}", e),
    }

    result
}

/// Delete a local file or directory
#[tauri::command]
pub async fn delete_local_item(path: String) -> Result<(), String> {
    let service = FilesystemService::new();
    let path_buf = PathBuf::from(path);

    service
        .delete_item(path_buf)
        .await
        .map_err(|e| e.to_string())
}

/// Create a new directory
#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    let service = FilesystemService::new();
    let path_buf = PathBuf::from(path);

    service
        .create_directory(path_buf)
        .map_err(|e| e.to_string())
}

/// Copy local files/directories to a destination directory
#[tauri::command]
pub fn copy_local_items(sources: Vec<String>, dest_dir: String) -> Result<(), String> {
    let service = FilesystemService::new();
    let source_paths: Vec<PathBuf> = sources.into_iter().map(PathBuf::from).collect();
    let dest_path = PathBuf::from(dest_dir);

    service
        .copy_items(source_paths, dest_path)
        .map_err(|e| e.to_string())
}
