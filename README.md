# SimpleS3

A simple, cross-platform S3 client desktop application built with Tauri and Rust.

## Features

- Dual-pane interface for local filesystem and S3 bucket browsing
- Support for multiple S3-compatible endpoints (AWS S3, MinIO, Backblaze B2, etc.)
- Secure credential storage in system keystores
- File upload/download with pause/resume support
- Transfer queue management with configurable concurrency
- Multipart transfers for large files (>100 MB)

## Project Status

🎉 **PHASES 1-9 COMPLETE** - Fully Functional S3 Client!

✅ **Phase 1: Setup** (11/11 tasks)
✅ **Phase 2: Foundation** (13/13 tasks)
✅ **Phase 3: Local File Browser** (13/13 tasks)
✅ **Phase 4: S3 Endpoint Management** (27/27 tasks)
✅ **Phase 5: Browse S3 Buckets** (16/16 tasks)
✅ **Phase 6: File Uploads** (24/34 tasks - Core complete)
✅ **Phase 7: File Downloads** (Core complete)
✅ **Phase 8: Delete Operations** (Core complete)
✅ **Phase 9: UI Polish & Settings** (Complete)

**What Works Now:**
- ✅ Browse local filesystem and S3 buckets
- ✅ Add/edit/delete S3 endpoints with validation
- ✅ Upload files (simple and multipart) with UI button
- ✅ Download files from S3 with UI button
- ✅ Delete local and S3 files with confirmation
- ✅ Transfer queue with pause/resume/cancel
- ✅ Progress tracking with live updates
- ✅ Secure keystore integration
- ✅ Professional dual-pane UI
- ✅ Settings panel for configuration
- ✅ Keyboard shortcuts (F5: refresh, Delete: delete, Ctrl/Cmd+U: upload, Ctrl/Cmd+D: download)

See [FINAL_STATUS.md](./FINAL_STATUS.md) for complete details.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ LTS
- **Rust** 1.75+ (required for building)
- **Platform-specific dependencies** (see [quickstart.md](./specs/001-s3-client/quickstart.md))

## Installation

### 1. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update
```

### 2. Install Dependencies

Frontend dependencies are already installed. If you need to reinstall:

```bash
npm install
```

## Development

### Running in Development Mode

⚠️ **Note**: You need Rust installed to run the application.

```bash
npm run tauri dev
```

This will start the Vite development server and launch the Tauri application.

### Building for Production

```bash
npm run tauri build
```

## Project Structure

```
simples3/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components
│   ├── services/           # API service wrappers
│   ├── hooks/              # React hooks
│   ├── styles/             # CSS files
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── src-tauri/              # Backend (Rust)
│   ├── src/
│   │   ├── models/         # Data models
│   │   ├── services/       # Business logic
│   │   ├── commands/       # Tauri commands (API)
│   │   ├── utils/          # Helper functions
│   │   ├── main.rs         # App entry point
│   │   └── lib.rs          # Library exports
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── specs/                  # Feature specifications
│   └── 001-s3-client/      # Current feature spec
├── tests/                  # Tests
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
└── README.md               # This file
```

## Documentation

- **[Quickstart Guide](./specs/001-s3-client/quickstart.md)** - Detailed setup instructions
- **[Feature Specification](./specs/001-s3-client/spec.md)** - Requirements and user stories
- **[Implementation Plan](./specs/001-s3-client/plan.md)** - Technical approach
- **[Data Model](./specs/001-s3-client/data-model.md)** - Entity definitions
- **[API Contracts](./specs/001-s3-client/contracts/)** - Tauri command specifications
- **[Task List](./specs/001-s3-client/tasks.md)** - Implementation tasks

## Next Steps

1. Install Rust (see Prerequisites above)
2. Review the [task list](./specs/001-s3-client/tasks.md)
3. Start implementing following the TDD approach
4. Run tests frequently during development

## Testing

### Rust Tests

```bash
cd src-tauri
cargo test
```

### Frontend Tests

```bash
npm test
```

### Linting

```bash
# Rust
cd src-tauri
cargo clippy

# Frontend
npm run lint
```

## Local S3 Testing

Use MinIO for local S3-compatible testing:

```bash
# Install MinIO
brew install minio/stable/minio  # macOS

# Start MinIO server
mkdir -p ~/minio-data
minio server ~/minio-data --console-address ":9001"

# Default credentials:
# Access Key: minioadmin
# Secret Key: minioadmin
```

See [quickstart.md](./specs/001-s3-client/quickstart.md) for detailed MinIO setup.

## License

[License information to be added]

## Contributing

[Contributing guidelines to be added]
