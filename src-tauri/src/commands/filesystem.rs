use crate::models::LocalFileItem;
use crate::services::FilesystemService;
use serde::{Deserialize, Serialize};
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

/// Check if a local file exists at the given path
#[tauri::command]
pub fn check_local_file_exists(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).exists())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskSpaceInfo {
    pub available_bytes: u64,
    pub total_bytes: u64,
}

/// Get available disk space at a given path
#[tauri::command]
pub fn get_disk_space(path: String) -> Result<DiskSpaceInfo, String> {
    use fs2::available_space;
    use fs2::total_space;

    let path = PathBuf::from(&path);
    // Use parent directory if path doesn't exist yet
    let check_path = if path.exists() {
        path
    } else {
        path.parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("/"))
    };

    let available = available_space(&check_path).map_err(|e| format!("Failed to get available space: {}", e))?;
    let total = total_space(&check_path).map_err(|e| format!("Failed to get total space: {}", e))?;

    Ok(DiskSpaceInfo {
        available_bytes: available,
        total_bytes: total,
    })
}
