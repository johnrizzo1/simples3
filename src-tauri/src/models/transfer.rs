use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferJob {
    pub id: Uuid,
    pub transfer_type: TransferType,
    pub source: TransferLocation,
    pub destination: TransferLocation,
    pub file_size: u64,
    pub progress_bytes: u64,
    pub status: TransferStatus,
    pub resume_point: Option<ResumePoint>,
    pub queue_position: usize,
    pub error_message: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TransferType {
    Upload,
    Download,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransferLocation {
    Local { path: String },
    S3 { bucket: String, key: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TransferStatus {
    Queued,
    Active,
    Paused,
    Cancelled,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumePoint {
    pub upload_id: Option<String>, // For multipart uploads
    pub parts_completed: Vec<CompletedPart>,
    pub next_part_number: i32,
    pub chunk_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletedPart {
    pub part_number: i32,
    pub etag: String,
    pub size: u64,
}

impl TransferJob {
    /// Create a new transfer job
    pub fn new(
        transfer_type: TransferType,
        source: TransferLocation,
        destination: TransferLocation,
        file_size: u64,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            transfer_type,
            source,
            destination,
            file_size,
            progress_bytes: 0,
            status: TransferStatus::Queued,
            resume_point: None,
            queue_position: 0,
            error_message: None,
            created_at: chrono::Utc::now(),
            started_at: None,
            completed_at: None,
        }
    }

    /// Calculate transfer progress percentage
    pub fn progress_percentage(&self) -> f64 {
        if self.file_size == 0 {
            return 0.0;
        }
        (self.progress_bytes as f64 / self.file_size as f64) * 100.0
    }

    /// Check if transfer should use multipart (>100 MB)
    pub fn should_use_multipart(&self) -> bool {
        self.file_size > 100 * 1024 * 1024 // 100 MB
    }
}
