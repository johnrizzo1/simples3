# Tauri Commands API Contract

**Feature**: 001-s3-client
**Date**: 2026-02-20

Complete API contract for all Tauri commands in the S3 Client application.

---

## Filesystem Commands

### `list_directory`

Lists contents of a local directory.

**Request**:
```rust
#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<LocalFileItem>, String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `path` | String | Absolute directory path | Must be valid directory, readable |

**Response**: `Result<Vec<LocalFileItem>, String>`
- **Success**: Array of file/folder items in directory
- **Error**: String describing failure (permission denied, not found, etc.)

**Frontend Usage**:
```typescript
const items = await invoke<LocalFileItem[]>('list_directory', {
  path: '/Users/username/Documents'
});
```

---

### `get_home_directory`

Returns the user's home directory path.

**Request**:
```rust
#[tauri::command]
pub fn get_home_directory() -> Result<String, String>
```

**Parameters**: None

**Response**: `Result<String, String>`
- **Success**: Absolute path to user's home directory
- **Error**: String if home directory cannot be determined

**Frontend Usage**:
```typescript
const homePath = await invoke<string>('get_home_directory');
```

---

### `delete_local_item`

Moves a local file or folder to system trash/recycle bin.

**Request**:
```rust
#[tauri::command]
pub async fn delete_local_item(path: String) -> Result<(), String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `path` | String | Absolute path to file/folder | Must exist, writable |

**Response**: `Result<(), String>`
- **Success**: Empty (item moved to trash)
- **Error**: String describing failure

**Frontend Usage**:
```typescript
await invoke('delete_local_item', { path: '/path/to/file.txt' });
```

---

## Endpoint Management Commands

### `list_endpoints`

Lists all configured S3 endpoints.

**Request**:
```rust
#[tauri::command]
pub async fn list_endpoints() -> Result<Vec<S3Endpoint>, String>
```

**Parameters**: None

**Response**: `Result<Vec<S3Endpoint>, String>`
- **Success**: Array of endpoints (credentials not included)
- **Error**: String if configuration cannot be read

**Note**: Credentials (access_key_id, secret_access_key) are filtered out for security.

**Frontend Usage**:
```typescript
const endpoints = await invoke<S3Endpoint[]>('list_endpoints');
```

---

### `add_endpoint`

Adds and validates a new S3 endpoint.

**Request**:
```rust
#[tauri::command]
pub async fn add_endpoint(
    name: String,
    url: String,
    region: String,
    access_key_id: String,
    secret_access_key: String,
) -> Result<S3Endpoint, String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `name` | String | Endpoint display name | 1-100 chars, unique |
| `url` | String | S3 endpoint URL | Valid http/https URL |
| `region` | String | AWS region or custom | 1-50 chars |
| `access_key_id` | String | S3 access key | 16-128 chars |
| `secret_access_key` | String | S3 secret key | 40-128 chars |

**Response**: `Result<S3Endpoint, String>`
- **Success**: Created endpoint with Validated status
- **Error**: String describing validation failure or conflict

**Process**:
1. Validates credentials by testing S3 connection
2. On success: stores credentials in OS keystore, saves endpoint metadata
3. On failure: rejects endpoint, returns error

**Frontend Usage**:
```typescript
const endpoint = await invoke<S3Endpoint>('add_endpoint', {
  name: 'My S3',
  url: 'https://s3.amazonaws.com',
  region: 'us-east-1',
  accessKeyId: 'AKIA...',
  secretAccessKey: 'secret...'
});
```

---

### `update_endpoint`

Updates an existing endpoint and re-validates if credentials changed.

**Request**:
```rust
#[tauri::command]
pub async fn update_endpoint(
    id: Uuid,
    name: Option<String>,
    url: Option<String>,
    region: Option<String>,
    access_key_id: Option<String>,
    secret_access_key: Option<String>,
) -> Result<S3Endpoint, String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `id` | UUID | Endpoint identifier | Must exist |
| `name` | Option<String> | New name (if changing) | 1-100 chars, unique |
| `url` | Option<String> | New URL (if changing) | Valid http/https URL |
| `region` | Option<String> | New region (if changing) | 1-50 chars |
| `access_key_id` | Option<String> | New access key (if changing) | 16-128 chars |
| `secret_access_key` | Option<String> | New secret key (if changing) | 40-128 chars |

**Response**: `Result<S3Endpoint, String>`
- **Success**: Updated endpoint
- **Error**: String describing failure

**Process**:
- If credentials changed: validates before updating
- Updates keystore if credentials provided
- Updates metadata file

**Frontend Usage**:
```typescript
const updated = await invoke<S3Endpoint>('update_endpoint', {
  id: 'uuid-here',
  name: 'Renamed Endpoint'
});
```

---

### `delete_endpoint`

Deletes an endpoint and removes credentials from keystore.

**Request**:
```rust
#[tauri::command]
pub async fn delete_endpoint(id: Uuid) -> Result<(), String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `id` | UUID | Endpoint identifier | Must exist |

**Response**: `Result<(), String>`
- **Success**: Empty (endpoint deleted)
- **Error**: String if endpoint not found or in use

**Process**:
1. Cancels any active transfers using this endpoint
2. Removes credentials from OS keystore
3. Removes endpoint from configuration

**Frontend Usage**:
```typescript
await invoke('delete_endpoint', { id: 'uuid-here' });
```

---

### `validate_endpoint`

Validates endpoint credentials by testing S3 connection.

**Request**:
```rust
#[tauri::command]
pub async fn validate_endpoint(id: Uuid) -> Result<ValidationStatus, String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `id` | UUID | Endpoint identifier | Must exist |

**Response**: `Result<ValidationStatus, String>`
- **Success**: ValidationStatus (Validated or Failed with reason)
- **Error**: String if endpoint not found

**Frontend Usage**:
```typescript
const status = await invoke<ValidationStatus>('validate_endpoint', {
  id: 'uuid-here'
});
```

---

### `set_active_endpoint`

Sets an endpoint as the active (currently selected) endpoint.

**Request**:
```rust
#[tauri::command]
pub async fn set_active_endpoint(id: Option<Uuid>) -> Result<(), String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `id` | Option<UUID> | Endpoint to activate (None to deactivate all) | Must exist if Some |

**Response**: `Result<(), String>`
- **Success**: Empty
- **Error**: String if endpoint not found

**Frontend Usage**:
```typescript
await invoke('set_active_endpoint', { id: 'uuid-here' });
```

---

## S3 Operations Commands

### `list_buckets`

Lists all S3 buckets for the active endpoint.

**Request**:
```rust
#[tauri::command]
pub async fn list_buckets() -> Result<Vec<S3Bucket>, String>
```

**Parameters**: None (uses active endpoint)

**Response**: `Result<Vec<S3Bucket>, String>`
- **Success**: Array of buckets
- **Error**: String if no active endpoint or S3 error

**Frontend Usage**:
```typescript
const buckets = await invoke<S3Bucket[]>('list_buckets');
```

---

### `list_objects`

Lists objects in an S3 bucket with optional prefix (folder).

**Request**:
```rust
#[tauri::command]
pub async fn list_objects(bucket: String, prefix: Option<String>) -> Result<Vec<S3Object>, String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `bucket` | String | Bucket name | Non-empty |
| `prefix` | Option<String> | Folder path (optional) | Valid S3 prefix |

**Response**: `Result<Vec<S3Object>, String>`
- **Success**: Array of objects and prefixes (folders)
- **Error**: String if bucket not found or S3 error

**Frontend Usage**:
```typescript
const objects = await invoke<S3Object[]>('list_objects', {
  bucket: 'my-bucket',
  prefix: 'folder/'
});
```

---

### `delete_s3_object`

Permanently deletes an S3 object or prefix (folder).

**Request**:
```rust
#[tauri::command]
pub async fn delete_s3_object(bucket: String, key: String) -> Result<(), String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `bucket` | String | Bucket name | Non-empty |
| `key` | String | Object key (path) | Non-empty |

**Response**: `Result<(), String>`
- **Success**: Empty (object deleted)
- **Error**: String describing failure

**Note**: For folders, deletes all objects with matching prefix.

**Frontend Usage**:
```typescript
await invoke('delete_s3_object', {
  bucket: 'my-bucket',
  key: 'folder/file.txt'
});
```

---

## Transfer Management Commands

### `upload_file`

Starts file upload from local path to S3.

**Request**:
```rust
#[tauri::command]
pub async fn upload_file(
    local_path: String,
    bucket: String,
    s3_key: String,
) -> Result<Uuid, String>  // Returns transfer job ID
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `local_path` | String | Absolute local file path | Must exist, readable |
| `bucket` | String | Destination bucket | Non-empty |
| `s3_key` | String | Destination S3 key | Non-empty |

**Response**: `Result<Uuid, String>`
- **Success**: Transfer job ID (UUID)
- **Error**: String if file not found or validation fails

**Process**:
1. Creates TransferJob with status=Queued
2. Adds to transfer queue
3. Returns immediately with job ID
4. Transfer executes asynchronously

**Frontend Usage**:
```typescript
const jobId = await invoke<string>('upload_file', {
  localPath: '/path/to/file.txt',
  bucket: 'my-bucket',
  s3Key: 'uploads/file.txt'
});
```

---

### `download_file`

Starts file download from S3 to local path.

**Request**:
```rust
#[tauri::command]
pub async fn download_file(
    bucket: String,
    s3_key: String,
    local_path: String,
) -> Result<Uuid, String>  // Returns transfer job ID
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `bucket` | String | Source bucket | Non-empty |
| `s3_key` | String | Source S3 key | Non-empty |
| `local_path` | String | Destination local path | Parent dir must exist, writable |

**Response**: `Result<Uuid, String>`
- **Success**: Transfer job ID (UUID)
- **Error**: String if object not found or validation fails

**Frontend Usage**:
```typescript
const jobId = await invoke<string>('download_file', {
  bucket: 'my-bucket',
  s3Key: 'file.txt',
  localPath: '/Users/name/Downloads/file.txt'
});
```

---

### `pause_transfer`

Pauses an active transfer.

**Request**:
```rust
#[tauri::command]
pub async fn pause_transfer(job_id: Uuid) -> Result<(), String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `job_id` | UUID | Transfer job identifier | Must exist, status=Active |

**Response**: `Result<(), String>`
- **Success**: Empty (transfer paused)
- **Error**: String if job not found or not pausable

**Process**:
1. Stops transfer operation
2. Persists resume point (upload_id, completed parts/ranges)
3. Updates status to Paused

**Frontend Usage**:
```typescript
await invoke('pause_transfer', { jobId: 'uuid-here' });
```

---

### `resume_transfer`

Resumes a paused transfer.

**Request**:
```rust
#[tauri::command]
pub async fn resume_transfer(job_id: Uuid) -> Result<(), String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `job_id` | UUID | Transfer job identifier | Must exist, status=Paused |

**Response**: `Result<(), String>`
- **Success**: Empty (transfer resumed)
- **Error**: String if job not found or not resumable

**Process**:
1. Restores resume point (upload_id, completed parts)
2. Updates status to Queued (will become Active when slot available)
3. Continues from last completed part/byte range

**Frontend Usage**:
```typescript
await invoke('resume_transfer', { jobId: 'uuid-here' });
```

---

### `cancel_transfer`

Cancels an active or paused transfer.

**Request**:
```rust
#[tauri::command]
pub async fn cancel_transfer(job_id: Uuid) -> Result<(), String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `job_id` | UUID | Transfer job identifier | Must exist |

**Response**: `Result<(), String>`
- **Success**: Empty (transfer cancelled)
- **Error**: String if job not found

**Process**:
1. Stops transfer if active
2. Cleans up partial data (S3 multipart upload, temp files)
3. Updates status to Cancelled
4. Removes from queue

**Frontend Usage**:
```typescript
await invoke('cancel_transfer', { jobId: 'uuid-here' });
```

---

### `get_transfer_queue`

Returns all transfers in queue (active, queued, paused).

**Request**:
```rust
#[tauri::command]
pub async fn get_transfer_queue() -> Result<Vec<TransferJob>, String>
```

**Parameters**: None

**Response**: `Result<Vec<TransferJob>, String>`
- **Success**: Array of transfer jobs
- **Error**: String if queue cannot be read

**Frontend Usage**:
```typescript
const queue = await invoke<TransferJob[]>('get_transfer_queue');
```

---

### `set_concurrency_limit`

Sets maximum number of simultaneous transfers.

**Request**:
```rust
#[tauri::command]
pub async fn set_concurrency_limit(limit: u8) -> Result<(), String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `limit` | u8 | Max concurrent transfers | 1-10 |

**Response**: `Result<(), String>`
- **Success**: Empty (limit updated)
- **Error**: String if limit out of range

**Frontend Usage**:
```typescript
await invoke('set_concurrency_limit', { limit: 5 });
```

---

## Configuration Commands

### `get_config`

Returns current application configuration.

**Request**:
```rust
#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String>
```

**Parameters**: None

**Response**: `Result<AppConfig, String>`
- **Success**: Current configuration
- **Error**: String if config cannot be read

**Frontend Usage**:
```typescript
const config = await invoke<AppConfig>('get_config');
```

---

### `update_config`

Updates application configuration.

**Request**:
```rust
#[tauri::command]
pub async fn update_config(config: AppConfig) -> Result<(), String>
```

**Parameters**:
| Name | Type | Description | Validation |
|------|------|-------------|------------|
| `config` | AppConfig | New configuration | Validate all fields |

**Response**: `Result<(), String>`
- **Success**: Empty (config saved)
- **Error**: String if validation fails

**Frontend Usage**:
```typescript
await invoke('update_config', { config: newConfig });
```

---

## Events (Tauri → Frontend)

Tauri emits events for real-time updates:

### `transfer-progress`

Emitted during active transfers (every 1 second).

**Payload**:
```typescript
{
  jobId: string,
  progressBytes: number,
  transferSpeed: number  // bytes/second
}
```

**Frontend Subscription**:
```typescript
import { listen } from '@tauri-apps/api/event';

listen<{jobId: string, progressBytes: number, transferSpeed: number}>(
  'transfer-progress',
  (event) => {
    console.log('Progress:', event.payload);
  }
);
```

---

### `transfer-status-changed`

Emitted when transfer status changes.

**Payload**:
```typescript
{
  jobId: string,
  status: 'Queued' | 'Active' | 'Paused' | 'Cancelled' | 'Completed' | 'Failed',
  errorMessage?: string
}
```

**Frontend Subscription**:
```typescript
listen<{jobId: string, status: string, errorMessage?: string}>(
  'transfer-status-changed',
  (event) => {
    console.log('Status changed:', event.payload);
  }
);
```

---

## Error Codes

All errors are returned as strings with descriptive messages:

| Error Type | Example Message |
|------------|-----------------|
| Not Found | "File not found: /path/to/file" |
| Permission Denied | "Permission denied: cannot read directory" |
| Invalid Credentials | "Invalid S3 credentials for endpoint 'My S3'" |
| Network Error | "Network error: connection timeout" |
| Validation Error | "Invalid configuration: max_concurrent_transfers must be 1-10" |
| Conflict | "Endpoint name 'My S3' already exists" |

---

## Type Mappings (Rust ↔ TypeScript)

| Rust Type | TypeScript Type | Notes |
|-----------|-----------------|-------|
| `String` | `string` | - |
| `u8`, `u64` | `number` | - |
| `bool` | `boolean` | - |
| `Uuid` | `string` | UUID string representation |
| `Option<T>` | `T \| null` | - |
| `Vec<T>` | `T[]` | Array |
| `chrono::DateTime<Utc>` | `string` | ISO 8601 format |
| `PathBuf` | `string` | Absolute path string |
| Custom Enum | `string` | Enum variant name |
| Custom Struct | `object` | JSON object with fields |

---

## Next Steps

- Implement Tauri commands in `src-tauri/src/commands/`
- Add integration tests for each command
- Generate TypeScript type definitions from Rust structs
