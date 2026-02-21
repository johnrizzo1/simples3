use thiserror::Error;

/// Application error types
#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("S3 error: {0}")]
    S3(String),

    #[error("Keystore error: {0}")]
    Keystore(String),

    #[error("Invalid endpoint: {0}")]
    InvalidEndpoint(String),

    #[error("Transfer error: {0}")]
    Transfer(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Already exists: {0}")]
    AlreadyExists(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}

/// Convert AppError to String for Tauri command responses
impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.to_string()
    }
}

/// Result type alias for application results
pub type AppResult<T> = Result<T, AppError>;
