use crate::models::LocalFileItem;
use crate::utils::{AppError, AppResult};
use std::fs;
use std::path::PathBuf;

/// Service for local filesystem operations
pub struct FilesystemService;

impl FilesystemService {
    pub fn new() -> Self {
        Self
    }

    /// List files and directories at the given path
    pub async fn list_directory(&self, path: PathBuf) -> AppResult<Vec<LocalFileItem>> {
        if !path.exists() {
            return Err(AppError::NotFound(format!(
                "Directory not found: {}",
                path.display()
            )));
        }

        if !path.is_dir() {
            return Err(AppError::Validation(format!(
                "Path is not a directory: {}",
                path.display()
            )));
        }

        let mut items = Vec::new();

        let entries = fs::read_dir(&path).map_err(|e| {
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                AppError::PermissionDenied(format!(
                    "Permission denied accessing directory: {}",
                    path.display()
                ))
            } else {
                AppError::Io(e)
            }
        })?;

        for entry in entries {
            let entry = entry.map_err(AppError::Io)?;
            let item = self.extract_file_metadata(entry.path()).await?;
            items.push(item);
        }

        // Sort: directories first, then files, alphabetically within each group
        items.sort_by(|a, b| {
            match (a.is_directory, b.is_directory) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });

        Ok(items)
    }

    /// Get the user's home directory
    pub fn get_home_directory(&self) -> AppResult<PathBuf> {
        dirs::home_dir().ok_or_else(|| {
            AppError::NotFound("Could not determine home directory".to_string())
        })
    }

    /// Get the user's documents directory
    /// This is more accessible in macOS dev mode without Full Disk Access
    pub fn get_documents_directory(&self) -> AppResult<PathBuf> {
        dirs::document_dir().ok_or_else(|| {
            AppError::NotFound("Could not determine documents directory".to_string())
        })
    }

    /// Recursively list all files (not directories) under a directory.
    /// Returns absolute paths.
    pub fn list_directory_recursive(&self, root: &PathBuf) -> AppResult<Vec<PathBuf>> {
        let mut files = Vec::new();
        self.walk_directory(root, &mut files)?;
        Ok(files)
    }

    fn walk_directory(&self, dir: &PathBuf, files: &mut Vec<PathBuf>) -> AppResult<()> {
        let entries = fs::read_dir(dir).map_err(|e| {
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                AppError::PermissionDenied(format!(
                    "Permission denied accessing directory: {}",
                    dir.display()
                ))
            } else {
                AppError::Io(e)
            }
        })?;

        for entry in entries {
            let entry = entry.map_err(AppError::Io)?;
            let path = entry.path();
            let meta = fs::symlink_metadata(&path).map_err(AppError::Io)?;

            if meta.is_dir() {
                self.walk_directory(&path, files)?;
            } else if meta.is_file() {
                files.push(path);
            }
            // Skip symlinks and other special files
        }

        Ok(())
    }

    /// Create a new directory
    pub fn create_directory(&self, path: PathBuf) -> AppResult<()> {
        if path.exists() {
            return Err(AppError::Validation(format!(
                "Path already exists: {}",
                path.display()
            )));
        }

        fs::create_dir(&path).map_err(|e| {
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                AppError::PermissionDenied(format!(
                    "Permission denied creating directory: {}",
                    path.display()
                ))
            } else {
                AppError::Io(e)
            }
        })?;

        Ok(())
    }

    /// Copy files/directories to a destination directory
    pub fn copy_items(&self, sources: Vec<PathBuf>, dest_dir: PathBuf) -> AppResult<()> {
        if !dest_dir.is_dir() {
            return Err(AppError::Validation(format!(
                "Destination is not a directory: {}",
                dest_dir.display()
            )));
        }

        for src in sources {
            let file_name = src
                .file_name()
                .ok_or_else(|| AppError::Validation("Invalid source path".to_string()))?;
            let target = dest_dir.join(file_name);

            if src.is_dir() {
                self.copy_dir_recursive(&src, &target)?;
            } else {
                fs::copy(&src, &target).map_err(AppError::Io)?;
            }
        }

        Ok(())
    }

    fn copy_dir_recursive(&self, src: &PathBuf, dest: &PathBuf) -> AppResult<()> {
        fs::create_dir_all(dest).map_err(AppError::Io)?;

        for entry in fs::read_dir(src).map_err(AppError::Io)? {
            let entry = entry.map_err(AppError::Io)?;
            let entry_path = entry.path();
            let target = dest.join(entry.file_name());

            if entry_path.is_dir() {
                self.copy_dir_recursive(&entry_path, &target)?;
            } else {
                fs::copy(&entry_path, &target).map_err(AppError::Io)?;
            }
        }

        Ok(())
    }

    /// Delete a local file or directory
    pub async fn delete_item(&self, path: PathBuf) -> AppResult<()> {
        if !path.exists() {
            return Err(AppError::NotFound(format!(
                "Item not found: {}",
                path.display()
            )));
        }

        if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|e| {
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                    AppError::PermissionDenied(format!(
                        "Permission denied deleting directory: {}",
                        path.display()
                    ))
                } else {
                    AppError::Io(e)
                }
            })?;
        } else {
            fs::remove_file(&path).map_err(|e| {
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                    AppError::PermissionDenied(format!(
                        "Permission denied deleting file: {}",
                        path.display()
                    ))
                } else {
                    AppError::Io(e)
                }
            })?;
        }

        Ok(())
    }

    /// Get file metadata
    pub async fn get_metadata(&self, path: PathBuf) -> AppResult<LocalFileItem> {
        self.extract_file_metadata(path).await
    }

    /// Extract file metadata from a path
    async fn extract_file_metadata(&self, path: PathBuf) -> AppResult<LocalFileItem> {
        let metadata = fs::symlink_metadata(&path).map_err(|e| {
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                AppError::PermissionDenied(format!(
                    "Permission denied accessing: {}",
                    path.display()
                ))
            } else {
                AppError::Io(e)
            }
        })?;

        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let size = if metadata.is_dir() {
            0
        } else {
            metadata.len()
        };

        let modified = metadata
            .modified()
            .map_err(AppError::Io)?
            .into();

        let is_directory = metadata.is_dir();

        let file_type = if is_directory {
            None
        } else {
            path.extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.to_string())
        };

        Ok(LocalFileItem {
            path,
            name,
            size,
            modified,
            is_directory,
            file_type,
        })
    }
}

impl Default for FilesystemService {
    fn default() -> Self {
        Self::new()
    }
}
