use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub selected_endpoint_id: Option<Uuid>,
    pub max_concurrent_transfers: usize, // Default: 3, Range: 1-10
    pub theme: Theme,
    pub auto_validate_endpoints: bool,
    pub show_hidden_files: bool,
    pub default_local_path: Option<String>,
    pub multipart_chunk_size: u64, // Default: 10 MB
    pub multipart_threshold: u64,  // Default: 100 MB
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Theme {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    pub current_view: String,      // "files", "endpoints", "settings"
    pub local_path: Option<String>,
    pub s3_bucket: Option<String>,
    pub s3_prefix: Option<String>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current_view: "files".to_string(),
            local_path: None,
            s3_bucket: None,
            s3_prefix: None,
        }
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            selected_endpoint_id: None,
            max_concurrent_transfers: 3,
            theme: Theme::System,
            auto_validate_endpoints: true,
            show_hidden_files: false,
            default_local_path: None,
            multipart_chunk_size: 10 * 1024 * 1024,  // 10 MB
            multipart_threshold: 100 * 1024 * 1024,   // 100 MB
        }
    }
}
