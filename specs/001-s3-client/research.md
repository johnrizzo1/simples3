# Research & Technology Selection

**Feature**: S3 Client Desktop Application
**Branch**: `001-s3-client`
**Date**: 2026-02-20
**Status**: Complete

This document captures all technology decisions and their rationales for the S3 Client implementation.

---

## 1. Tauri Framework Version

**Decision**: Tauri 2.x (Latest: 2.10.2)

**Rationale**:
- Tauri 2.0 became stable in October 2024 and is the recommended version for all new projects in 2025
- Mature plugin architecture with modular functionality
- Improved capability-based security (ACL system) for fine-grained permissions
- 95% smaller binary size than Electron
- Active development with regular updates
- Better system integration for desktop file operations

**Key Features for S3 Client**:
- **File System Plugin**: Scoped read/write operations for local file browsing
- **HTTP Plugin**: Native Rust HTTP client for S3 API calls
- **Store Plugin**: Persistent key-value storage for app configuration
- **Dialog API**: Native file/folder selection dialogs
- **ACL Security**: Capability-based permissions for sensitive operations

**Project Structure**:
```
simples3/
├── package.json              # Frontend dependencies
├── index.html
├── src/                      # Frontend (TypeScript/React)
│   ├── components/
│   ├── services/
│   └── main.tsx
└── src-tauri/                # Rust backend
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/         # Permission definitions
    └── src/
        ├── main.rs          # Desktop entry
        ├── lib.rs           # Shared code
        ├── commands/        # Tauri command handlers
        └── services/        # Business logic
```

**Alternatives Considered**:
- Tauri 1.x: Deprecated, ecosystem moved to 2.x
- Electron: Much larger binaries, heavier resource usage
- Native platforms (SwiftUI/WinUI/GTK): Requires 3 separate codebases

---

## 2. S3 SDK Selection

**Decision**: aws-sdk-s3 (Official AWS SDK for Rust)

**Rationale**:
- Official AWS maintenance and regular updates
- Production-ready with 46+ million downloads
- Code-generated from Smithy models ensuring S3 API completeness
- Proven stability and comprehensive features
- Full async/await support with Tokio runtime
- Excellent support for S3-compatible services (MinIO, Backblaze B2, Wasabi, R2)

**Multipart Support**:
```rust
// Initiate multipart upload
let response = client
    .create_multipart_upload()
    .bucket(bucket)
    .key(key)
    .send()
    .await?;

let upload_id = response.upload_id().unwrap();

// Upload parts (min 5MB, max 10,000 parts)
let part_resp = client
    .upload_part()
    .bucket(bucket)
    .key(key)
    .upload_id(&upload_id)
    .part_number(1)
    .body(ByteStream::from_path("file_path").await?)
    .send()
    .await?;

// Complete upload
client
    .complete_multipart_upload()
    .bucket(bucket)
    .key(key)
    .upload_id(&upload_id)
    .multipart_upload(completed_upload)
    .send()
    .await?;
```

**Pause/Resume Implementation**:
- Store `upload_id` and completed part numbers in persistent state
- Use `list_parts()` to query existing parts if connection drops
- Resume by uploading only remaining parts
- Complete when all parts uploaded

**S3-Compatible Services**:
```rust
let config = aws_config::defaults(BehaviorVersion::latest())
    .credentials_provider(Credentials::new(access_key, secret_key, None, None, ""))
    .endpoint_url("https://s3.us-west-002.backblazeb2.com")  // Custom endpoint
    .region(Region::new("us-west-2"))
    .load()
    .await;

let client = aws_sdk_s3::Client::new(&config);
```

**Verified Compatibility**:
- AWS S3: Full support
- Backblaze B2: Full support
- MinIO: Full support (use `force_path_style` setting)
- Wasabi: Full support
- Cloudflare R2: Full support

**Alternatives Considered**:
- **rusoto_s3**: DEPRECATED - in maintenance mode, AWS recommends migration to official SDK
- **rust-s3**: Community-maintained, had B2 compatibility issues, smaller ecosystem
- **opendal**: Better for filesystem abstraction than direct S3 operations
- **aws-s3-transfer-manager-rs**: Developer preview, not production-ready in 2025

---

## 3. Keystore Integration

**Decision**: keyring-rs with tauri-plugin-keyring wrapper

**Rationale**:
- Unified API across macOS, Windows, and Linux
- Uses native OS credential stores (Keychain, Credential Manager, Secret Service)
- Actively maintained with regular releases
- Excellent Tauri integration via community plugin
- No additional user passwords required
- Battle-tested with Python implementation and Tauri demo apps

**Platform Coverage**:
| Platform | Implementation | Security Model |
|----------|----------------|----------------|
| macOS | Keychain Services | Native macOS Keychain |
| Windows | Credential Manager | Native Windows Credential Storage |
| Linux | Secret Service API | GNOME Keyring, KWallet, libsecret |

**API Example**:
```rust
use keyring::Entry;

#[tauri::command]
pub fn store_credentials(service: String, username: String, password: String) -> Result<(), String> {
    let entry = Entry::new(&service, &username)
        .map_err(|e| e.to_string())?;
    entry.set_password(&password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn retrieve_credentials(service: String, username: String) -> Result<String, String> {
    let entry = Entry::new(&service, &username)
        .map_err(|e| e.to_string())?;
    entry.get_password()
        .map_err(|e| e.to_string())
}
```

**Frontend Usage**:
```typescript
import { getPassword, setPassword, deletePassword } from "tauri-plugin-keyring-api";

await setPassword("simples3", "endpoint-name", "secret-key");
const secretKey = await getPassword("simples3", "endpoint-name");
```

**Cargo Dependencies**:
```toml
[dependencies]
keyring = { version = "3.6", features = [
    "apple-native",           # macOS/iOS Keychain
    "windows-native",         # Windows Credential Manager
    "async-secret-service",   # Linux Secret Service
    "tokio",
    "crypto-rust",
] }
```

**Alternatives Considered**:
- **security-framework**: macOS-only, doesn't meet cross-platform requirement
- **windows-rs credentials**: Windows-only
- **libsecret / secret-rs**: Linux-only
- **Tauri Stronghold Plugin**: DEPRECATED, will be removed in Tauri v3
- **tauri-plugin-keystore**: Mobile-focused (Android/iOS only)

---

## 4. Frontend Framework

**Decision**: React with TypeScript

**Rationale**:
- Largest ecosystem and community support for desktop apps
- Excellent TypeScript integration for type-safe Tauri command calls
- Rich component libraries for file browsers and transfer queues
- Vite build tool (recommended by Tauri) works seamlessly with React
- Team familiarity and extensive learning resources

**Key Libraries**:
- **React**: UI components and state management
- **TypeScript**: Type safety across frontend-backend boundary
- **@tauri-apps/api**: Tauri IPC bindings
- **@tanstack/react-query**: Async state management for Tauri commands
- **tailwindcss**: Utility-first CSS for responsive UI
- **lucide-react**: Icon library for file types and actions

**Alternatives Considered**:
- **Vue**: Good option, but smaller desktop app ecosystem than React
- **Svelte**: Excellent performance, but fewer UI libraries for complex file browsers
- **Vanilla JS**: Too much boilerplate for complex state management

---

## 5. Transfer State Persistence

**Decision**: JSON files in Tauri app data directory with Store plugin

**Rationale**:
- Simple, human-readable format for debugging
- Tauri Store plugin provides atomic writes and corruption protection
- Easy to version and migrate as schema evolves
- No need for SQLite overhead for simple state persistence
- Cross-platform path handling via Tauri path APIs

**Storage Location**:
- macOS: `~/Library/Application Support/com.simples3.app/transfer-state.json`
- Windows: `C:\Users\<User>\AppData\Roaming\com.simples3.app\transfer-state.json`
- Linux: `~/.config/com.simples3.app/transfer-state.json`

**State Schema**:
```json
{
  "version": "1.0.0",
  "paused_transfers": [
    {
      "id": "uuid-here",
      "source": "/path/to/file",
      "destination": "s3://bucket/key",
      "upload_id": "s3-multipart-upload-id",
      "completed_parts": [1, 2, 3],
      "file_size": 524288000,
      "progress_bytes": 314572800,
      "status": "paused",
      "timestamp": "2026-02-20T10:30:00Z"
    }
  ]
}
```

**Alternatives Considered**:
- **SQLite**: Overkill for simple state, adds dependency complexity
- **Binary formats (bincode, MessagePack)**: Harder to debug, version migration complexity
- **OS-specific storage APIs**: Complicates cross-platform development

---

## 6. Multipart Transfer Implementation

**Decision**: Custom implementation using aws-sdk-s3 multipart APIs with 10 MB chunks

**Rationale**:
- S3 multipart minimum is 5 MB (except last part), 10 MB provides good balance
- Enables pause/resume by tracking completed parts
- Standard S3 approach for files >100 MB
- Part numbers (1-10,000) stored with upload_id for resume capability

**Chunk Size**: 10 MB (10 * 1024 * 1024 bytes)

**Upload Flow**:
1. If file size > 100 MB → initiate multipart upload → store upload_id
2. Split file into 10 MB chunks (last chunk can be smaller)
3. Upload each chunk as a numbered part
4. Store completed part numbers in transfer state after each success
5. On pause: stop uploads, persist state with upload_id and completed parts
6. On resume: query S3 for existing parts via `list_parts()`, upload remaining
7. On completion: call `complete_multipart_upload` with all part ETags

**Download Flow**:
1. If file size > 100 MB → use HTTP range requests (byte ranges)
2. Download in 10 MB ranges: `Range: bytes=0-10485759`, `bytes=10485760-20971519`, etc.
3. Store downloaded byte ranges in transfer state
4. On pause: stop downloads, persist completed ranges
5. On resume: request only missing byte ranges
6. Concatenate all ranges into final file

**Error Handling**:
- Network failures → auto-pause, allow resume
- Invalid credentials → fail immediately with clear error
- S3 rate limiting → exponential backoff with retry
- Disk space errors → fail with actionable message

**Alternatives Considered**:
- **5 MB chunks**: Closer to S3 minimum, but more parts for large files (harder to manage)
- **50 MB chunks**: Fewer parts, but longer retry time on failure
- **aws-s3-transfer-manager-rs**: Not production-ready in 2025

---

## 7. Testing Strategy

**Decision**: Multi-layered testing with Rust unit tests, integration tests, and minimal E2E tests

**Test Layers**:

### Unit Tests (Rust - `cargo test`)
- **Location**: `src-tauri/src/` (inline with modules)
- **Scope**: Individual functions and modules in isolation
- **Mocking**:
  - S3 client: Use trait objects and mock implementations
  - Filesystem: Use tempdir for isolated file operations
  - Keystore: Mock keyring::Entry with in-memory storage

Example:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_list_directory() {
        let temp_dir = tempdir::TempDir::new("test").unwrap();
        let result = list_directory(temp_dir.path()).await;
        assert!(result.is_ok());
    }
}
```

### Integration Tests (Rust)
- **Location**: `tests/` directory at project root
- **Scope**: Multiple modules working together
- **Test Scenarios**:
  - S3 operations against local MinIO container (Docker)
  - Transfer queue with concurrent uploads/downloads
  - Keystore integration (platform-specific)

Setup:
```rust
// tests/integration_test.rs
use simples3::*;

#[tokio::test]
async fn test_multipart_upload() {
    let minio = start_minio_container().await;
    let s3_client = create_test_s3_client(&minio).await;

    // Test multipart upload with pause/resume
    // ...
}
```

### Frontend Tests (Vitest)
- **Location**: `src/__tests__/`
- **Scope**: React components and UI logic
- **Tools**: Vitest + React Testing Library

### E2E Tests (Optional, Manual)
- **Location**: `tests/e2e/`
- **Tool**: WebDriver (if needed)
- **Scope**: Full user workflows (expensive to maintain, minimize)

**Testing Approach**:
1. **TDD for critical paths**: Transfer logic, multipart resume, keystore operations
2. **Mock external services**: S3 API (use MinIO for integration tests)
3. **Platform-specific tests**: Keystore tests run on each OS in CI
4. **Performance tests**: Upload/download speed benchmarks for large files

**CI/CD**:
- GitHub Actions with matrix builds (macOS, Windows, Linux)
- MinIO container for S3 integration tests
- Codecov for coverage reporting

**Alternatives Considered**:
- **Playwright for E2E**: Overkill for desktop app, WebDriver sufficient
- **Property-based testing (proptest)**: Useful but not critical for MVP
- **Manual testing only**: Insufficient for regression prevention

---

## 8. Error Handling

**Decision**: Custom error types with `thiserror` crate and structured error propagation

**Rationale**:
- `thiserror` generates From implementations automatically
- Clear error messages for users vs developers
- Structured errors enable better logging and debugging
- Propagate errors to frontend as serializable JSON

**Error Types**:
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum S3Error {
    #[error("S3 operation failed: {0}")]
    S3Operation(#[from] aws_sdk_s3::Error),

    #[error("Invalid credentials for endpoint {endpoint}")]
    InvalidCredentials { endpoint: String },

    #[error("Network error: {0}")]
    Network(#[from] std::io::Error),

    #[error("File not found: {path}")]
    FileNotFound { path: String },
}

#[derive(Error, Debug)]
pub enum TransferError {
    #[error("Transfer paused by user")]
    Paused,

    #[error("Transfer cancelled: {reason}")]
    Cancelled { reason: String },

    #[error("Insufficient disk space: need {needed} bytes, available {available}")]
    InsufficientDiskSpace { needed: u64, available: u64 },
}

#[derive(Error, Debug)]
pub enum KeystoreError {
    #[error("Keystore access denied")]
    AccessDenied,

    #[error("Credential not found: {service}/{user}")]
    NotFound { service: String, user: String },
}
```

**Frontend Error Handling**:
```typescript
try {
  await invoke("upload_file", { source, destination });
} catch (error) {
  if (error.includes("InvalidCredentials")) {
    showNotification("Invalid S3 credentials. Please check endpoint settings.");
  } else if (error.includes("InsufficientDiskSpace")) {
    showNotification("Not enough disk space to complete download.");
  } else {
    showNotification(`Upload failed: ${error}`);
  }
}
```

**Logging Strategy**:
- **Backend**: `tracing` crate with structured logging
- **Frontend**: Console logging in development, Tauri log file in production
- **Log Levels**: ERROR (user-facing failures), WARN (recoverable issues), INFO (operations), DEBUG (development)

**Alternatives Considered**:
- **anyhow**: Less structured, harder to match specific errors on frontend
- **Plain Result<T, String>**: Loses type information, harder to handle programmatically
- **Panic on errors**: Crashes app, unacceptable for production

---

## Summary of Decisions

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Framework** | Tauri 2.x | Cross-platform, small binaries, native system access |
| **S3 SDK** | aws-sdk-s3 | Official, production-ready, full S3-compatible support |
| **Keystore** | keyring-rs | Unified API, native OS stores, Tauri integration |
| **Frontend** | React + TypeScript | Large ecosystem, type safety, Vite integration |
| **State Persistence** | JSON + Tauri Store | Simple, debuggable, atomic writes |
| **Multipart** | Custom 10MB chunks | Balance of performance and resume granularity |
| **Testing** | Multi-layer (unit/integration/e2e) | TDD for critical paths, MinIO for integration |
| **Error Handling** | thiserror + structured types | Type-safe, clear user messages, debuggable |

**Constitution Compliance**:
- ✅ **Library-First**: Rust modules are self-contained and testable
- ✅ **Test-First**: TDD planned for critical paths (transfers, keystore, S3 ops)
- ✅ **Simplicity**: All complexity justified (see Complexity Tracking in plan.md)

**Next Steps**: Proceed to Phase 1 (Design Artifacts)
