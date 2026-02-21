# Data Model: S3 Client Desktop Application

**Feature**: 001-s3-client
**Date**: 2026-02-20
**Status**: Phase 1 Design

This document defines all data entities, their relationships, validation rules, and state transitions for the S3 Client application.

---

## Entity Definitions

### 1. S3Endpoint

Represents a configured S3-compatible service endpoint with credentials and validation status.

**Rust Struct**:
```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Endpoint {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub region: String,
    #[serde(skip_serializing)]
    pub access_key_id: Option<String>,  // Stored in keystore, not serialized
    #[serde(skip_serializing)]
    pub secret_access_key: Option<String>,  // Stored in keystore, not serialized
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
```

**Fields**:
| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `id` | UUID | Unique identifier | Auto-generated |
| `name` | String | User-friendly endpoint name | 1-100 chars, unique |
| `url` | String | S3 endpoint URL | Valid URL with http/https protocol |
| `region` | String | AWS region or custom region | 1-50 chars |
| `access_key_id` | Option<String> | S3 access key (from keystore) | 16-128 chars when present |
| `secret_access_key` | Option<String> | S3 secret key (from keystore) | 40-128 chars when present |
| `validation_status` | ValidationStatus | Credential validation state | Enum variant |
| `is_active` | bool | Currently selected endpoint | Only one endpoint can be active |
| `created_at` | DateTime | Creation timestamp | Auto-set on creation |
| `last_validated_at` | Option<DateTime> | Last successful validation | Updated on validation success |

**Relationships**:
- One-to-many with `TransferJob` (endpoint → transfers)
- Zero-to-one active endpoint per application instance

**State Transitions**:
```
Pending → Validated (on successful credential test)
Pending → Failed (on credential test failure)
Validated → Failed (on subsequent validation failure)
Failed → Validated (on successful re-validation)
```

**Validation Rules**:
- Name must be unique across all endpoints
- URL must be valid http:// or https:// URL
- Only one endpoint can have `is_active = true` at a time
- Credentials (access_key_id, secret_access_key) stored in OS keystore, never in files

---

### 2. LocalFileItem

Represents a file or directory in the local filesystem.

**Rust Struct**:
```rust
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalFileItem {
    pub path: PathBuf,
    pub name: String,
    pub size: u64,  // Bytes (0 for directories)
    pub modified: chrono::DateTime<chrono::Utc>,
    pub is_directory: bool,
    pub file_type: Option<String>,  // Extension or MIME type
}
```

**Fields**:
| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `path` | PathBuf | Absolute filesystem path | Must exist, readable by app |
| `name` | String | File/directory name | Non-empty |
| `size` | u64 | File size in bytes (0 for dirs) | >= 0 |
| `modified` | DateTime | Last modification timestamp | Valid timestamp |
| `is_directory` | bool | True if directory | - |
| `file_type` | Option<String> | File extension or MIME type | - |

**Relationships**:
- Parent-child with other `LocalFileItem` (directory hierarchy)
- Source for `TransferJob` (upload operations)

**Usage**:
- Returned by `list_directory` Tauri command
- Used in local pane file browser
- Selected for upload operations

---

### 3. S3Object

Represents an object (file) or prefix (folder) in S3 storage.

**Rust Struct**:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Object {
    pub bucket: String,
    pub key: String,  // Full S3 key (path)
    pub name: String,  // Display name (last component of key)
    pub size: u64,  // Bytes (0 for folders)
    pub modified: chrono::DateTime<chrono::Utc>,
    pub storage_class: String,  // STANDARD, GLACIER, etc.
    pub is_prefix: bool,  // True for folders (common prefixes)
    pub etag: Option<String>,  // For files only
}
```

**Fields**:
| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `bucket` | String | S3 bucket name | Non-empty, valid bucket name |
| `key` | String | Full S3 object key | Non-empty, S3 key rules |
| `name` | String | Display name (last path component) | Non-empty |
| `size` | u64 | Object size in bytes (0 for prefixes) | >= 0 |
| `modified` | DateTime | Last modification timestamp | Valid timestamp |
| `storage_class` | String | S3 storage class | STANDARD, GLACIER, etc. |
| `is_prefix` | bool | True if common prefix (folder) | - |
| `etag` | Option<String> | S3 ETag (for files only) | - |

**Relationships**:
- Belongs to one `S3Bucket`
- Parent-child with other `S3Object` (prefix hierarchy)
- Destination for `TransferJob` (upload) or source (download)

**Usage**:
- Returned by `list_objects` Tauri command
- Used in S3 pane file browser
- Selected for download/delete operations

---

### 4. S3Bucket

Represents an S3 bucket.

**Rust Struct**:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Bucket {
    pub name: String,
    pub region: Option<String>,
    pub creation_date: chrono::DateTime<chrono::Utc>,
}
```

**Fields**:
| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `name` | String | Bucket name | Non-empty, valid DNS name |
| `region` | Option<String> | Bucket region | - |
| `creation_date` | DateTime | Bucket creation timestamp | Valid timestamp |

**Relationships**:
- One-to-many with `S3Object`
- Associated with one `S3Endpoint`

**Usage**:
- Returned by `list_buckets` Tauri command
- Root level of S3 pane navigation

---

### 5. TransferJob

Represents a file transfer operation (upload or download) with progress tracking and state management.

**Rust Struct**:
```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::path::PathBuf;

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
    pub transfer_speed: Option<u64>,  // Bytes per second
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TransferType {
    Upload,
    Download,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransferLocation {
    Local { path: PathBuf },
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
    pub upload_id: Option<String>,  // S3 multipart upload ID
    pub completed_parts: Vec<u32>,  // Part numbers for multipart
    pub completed_bytes: Vec<ByteRange>,  // For range downloads
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ByteRange {
    pub start: u64,
    pub end: u64,
}
```

**Fields**:
| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `id` | UUID | Unique transfer identifier | Auto-generated |
| `transfer_type` | TransferType | Upload or Download | Enum variant |
| `source` | TransferLocation | Source location | Valid path or S3 location |
| `destination` | TransferLocation | Destination location | Valid path or S3 location |
| `file_size` | u64 | Total file size in bytes | > 0 |
| `progress_bytes` | u64 | Bytes transferred | 0 <= progress <= file_size |
| `status` | TransferStatus | Current transfer state | Enum variant |
| `resume_point` | Option<ResumePoint> | Data for pause/resume | Present when status = Paused |
| `queue_position` | usize | Position in transfer queue | >= 0 |
| `error_message` | Option<String> | Error details if failed | Present when status = Failed |
| `created_at` | DateTime | Creation timestamp | Auto-set |
| `started_at` | Option<DateTime> | When transfer became active | Set on status → Active |
| `completed_at` | Option<DateTime> | Completion timestamp | Set on status → Completed/Failed |
| `transfer_speed` | Option<u64> | Current transfer speed (B/s) | Calculated from progress |

**Relationships**:
- Many-to-one with `S3Endpoint` (for upload/download operations)
- Belongs to global transfer queue

**State Transitions**:
```
Queued → Active (when slot available in concurrency limit)
Active → Paused (user pause or network failure)
Active → Cancelled (user cancel)
Active → Completed (successful transfer)
Active → Failed (unrecoverable error)
Paused → Active (user resume)
Paused → Cancelled (user cancel)
```

**Validation Rules**:
- `file_size > 0`
- `progress_bytes <= file_size`
- `queue_position` unique within queue
- `resume_point` required when `status = Paused`
- `error_message` required when `status = Failed`
- `upload_id` in resume_point required for multipart uploads (file_size > 100 MB)

**Lifecycle**:
1. Created with `status = Queued`
2. Moves to `status = Active` when concurrency slot available
3. Progress tracked via `progress_bytes` updates
4. Can transition to Paused, Cancelled, Completed, or Failed
5. Persisted to disk when Paused for resume after app restart
6. Removed from queue after Completed/Cancelled/Failed (optionally kept in history)

---

### 6. AppConfig

Represents application configuration and user preferences.

**Rust Struct**:
```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub selected_endpoint_id: Option<Uuid>,
    pub max_concurrent_transfers: u8,  // 1-10
    pub multipart_chunk_size: u64,  // Bytes (default: 10 MB)
    pub multipart_threshold: u64,  // Bytes (default: 100 MB)
    pub theme: Theme,
    pub show_hidden_files: bool,
    pub default_local_path: Option<std::path::PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Theme {
    Light,
    Dark,
    System,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            selected_endpoint_id: None,
            max_concurrent_transfers: 3,
            multipart_chunk_size: 10 * 1024 * 1024,  // 10 MB
            multipart_threshold: 100 * 1024 * 1024,  // 100 MB
            theme: Theme::System,
            show_hidden_files: false,
            default_local_path: None,
        }
    }
}
```

**Fields**:
| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `selected_endpoint_id` | Option<UUID> | Currently active endpoint | Must reference valid endpoint |
| `max_concurrent_transfers` | u8 | Max simultaneous transfers | 1-10 |
| `multipart_chunk_size` | u64 | Chunk size for multipart (bytes) | >= 5 MB, <= 5 GB |
| `multipart_threshold` | u64 | File size to trigger multipart (bytes) | >= 100 MB |
| `theme` | Theme | UI theme preference | Enum variant |
| `show_hidden_files` | bool | Show hidden files in local browser | - |
| `default_local_path` | Option<PathBuf> | Default starting directory | Valid directory path |

**Storage**: Persisted to Tauri app data directory as `config.json`

**Validation Rules**:
- `max_concurrent_transfers` must be 1-10
- `multipart_chunk_size` must be >= 5 MB (S3 minimum)
- `multipart_threshold` >= 100 MB (clarified requirement)
- `selected_endpoint_id` must reference existing endpoint or be None

---

## Entity Relationships

### Diagram

```
┌─────────────┐     1:N      ┌──────────────┐
│ S3Endpoint  │─────────────→│ TransferJob  │
└─────────────┘              └──────────────┘
      │                             │
      │ 0:1                         │ N:1
      │ (active)                    │
      ↓                             │
┌─────────────┐                     │
│  AppConfig  │                     │
└─────────────┘                     │
                                    │
┌──────────────┐     N:1            │
│  S3Bucket    │←───────────────────┘
└──────────────┘         (destination/source)
      │
      │ 1:N
      ↓
┌──────────────┐
│  S3Object    │
└──────────────┘

┌──────────────────┐
│ LocalFileItem    │  (source/destination for TransferJob)
└──────────────────┘
```

### Constraints

1. **One Active Endpoint**: Only one `S3Endpoint` can have `is_active = true`
2. **Transfer Queue Limit**: Number of `TransferJob` with `status = Active` <= `AppConfig.max_concurrent_transfers`
3. **Endpoint References**: `AppConfig.selected_endpoint_id` must reference existing `S3Endpoint.id`
4. **Resume Point Requirements**: `TransferJob.resume_point` must be present when `status = Paused`

---

## Serialization

All entities use `serde` for JSON serialization:
- **To Frontend**: Serialize to JSON for Tauri IPC
- **To Storage**: Serialize to JSON files (AppConfig, paused TransferJobs)
- **Sensitive Data**: Credentials (access keys) never serialized, stored in OS keystore only

---

## Database/Storage

### No Database Required

This application uses file-based storage:

1. **AppConfig**: Single JSON file in Tauri app data directory
2. **S3Endpoint Metadata**: JSON file (credentials in OS keystore separately)
3. **Paused TransferJobs**: JSON file with array of paused transfers
4. **Runtime State**: In-memory Rust structs, no persistence needed (except paused transfers)

### Storage Locations

| Platform | App Data Directory |
|----------|--------------------|
| macOS | `~/Library/Application Support/com.simples3.app/` |
| Windows | `%APPDATA%\com.simples3.app\` |
| Linux | `~/.config/com.simples3.app/` |

### Files

- `config.json` → AppConfig
- `endpoints.json` → Array of S3Endpoint (without credentials)
- `paused-transfers.json` → Array of TransferJob with status = Paused
- Credentials stored in OS keystore (keyring-rs) with service name `simples3` and username `endpoint-{uuid}`

---

## Validation Summary

| Entity | Key Validations |
|--------|----------------|
| S3Endpoint | Unique name, valid URL, only one active |
| LocalFileItem | Path exists, readable |
| S3Object | Valid bucket name, non-empty key |
| TransferJob | file_size > 0, progress <= size, resume_point when paused |
| AppConfig | max_concurrent 1-10, chunk size >= 5MB, threshold >= 100MB |

---

## Next Steps

- Implement Rust structs in `src-tauri/src/models/`
- Create validation functions for each entity
- Implement serialization/deserialization tests
- Document API contracts using these models (see `contracts/`)
