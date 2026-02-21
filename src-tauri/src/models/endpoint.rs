use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Endpoint {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub region: String,
    #[serde(skip_serializing)]
    pub access_key_id: Option<String>, // Stored in keystore, not serialized
    #[serde(skip_serializing)]
    pub secret_access_key: Option<String>, // Stored in keystore, not serialized
    pub validation_status: ValidationStatus,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_validated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ValidationStatus {
    Pending,
    Validated,
    Failed { reason: String },
}

impl S3Endpoint {
    /// Create a new endpoint with default values
    pub fn new(name: String, url: String, region: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            name,
            url,
            region,
            access_key_id: None,
            secret_access_key: None,
            validation_status: ValidationStatus::Pending,
            is_active: false,
            created_at: chrono::Utc::now(),
            last_validated_at: None,
        }
    }

    /// Mark this endpoint as validated
    pub fn mark_validated(&mut self) {
        self.validation_status = ValidationStatus::Validated;
        self.last_validated_at = Some(chrono::Utc::now());
    }

    /// Mark this endpoint as failed with a reason
    pub fn mark_failed(&mut self, reason: String) {
        self.validation_status = ValidationStatus::Failed { reason };
    }
}
