use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Represents a file or directory in the local filesystem
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalFileItem {
    pub path: PathBuf,
    pub name: String,
    pub size: u64, // Bytes (0 for directories)
    pub modified: chrono::DateTime<chrono::Utc>,
    pub is_directory: bool,
    pub file_type: Option<String>, // Extension or MIME type
}

/// Represents an object in S3 storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Object {
    pub bucket: String,
    pub key: String,
    pub size: u64,
    pub modified: chrono::DateTime<chrono::Utc>,
    pub storage_class: Option<String>,
    pub etag: Option<String>,
    pub is_prefix: bool, // True for folder-like prefixes
}

/// Represents an S3 bucket
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Bucket {
    pub name: String,
    pub created: chrono::DateTime<chrono::Utc>,
    pub region: Option<String>,
}
