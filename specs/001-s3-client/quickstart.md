# Quick Start: S3 Client Desktop Application

**Feature**: 001-s3-client
**Date**: 2026-02-20
**Status**: Development Setup Guide

This guide helps developers set up the development environment and start working on the S3 Client application.

---

## Prerequisites

### Required Software

1. **Rust** (1.75+)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup update
   ```

2. **Node.js** (18+ LTS)
   ```bash
   # macOS (Homebrew)
   brew install node@18

   # Windows (nvm-windows)
   nvm install 18
   nvm use 18

   # Linux (nvm)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   ```

3. **Platform-Specific Dependencies**

   **macOS**:
   ```bash
   xcode-select --install
   ```

   **Windows**:
   - Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
   - Install WebView2 Runtime (usually pre-installed on Windows 11)

   **Linux** (Debian/Ubuntu):
   ```bash
   sudo apt update
   sudo apt install libwebkit2gtk-4.0-dev \
       build-essential \
       curl \
       wget \
       file \
       libssl-dev \
       libgtk-3-dev \
       libayatana-appindicator3-dev \
       librsvg2-dev \
       libsecret-1-dev
   ```

---

## Project Setup

### 1. Initialize Tauri Project

```bash
# Install Tauri CLI
cargo install tauri-cli

# Create new Tauri project
npm create tauri-app@latest

# Select options:
# - Project name: simples3
# - Package manager: npm
# - UI template: React + TypeScript
# - Tauri version: 2.x
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
cd simples3
npm install

# Install additional frontend packages
npm install @tanstack/react-query lucide-react tailwindcss

# Install Tauri plugins
npm install @tauri-apps/plugin-fs
npm install @tauri-apps/plugin-http
npm install @tauri-apps/plugin-store
npm install @tauri-apps/plugin-dialog
npm install tauri-plugin-keyring-api
```

### 3. Configure Rust Dependencies

Edit `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2.10", features = [] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.35", features = ["full"] }
uuid = { version = "1.6", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "2.0"
tracing = "0.1"
tracing-subscriber = "0.3"

# S3 SDK
aws-config = { version = "1.1", features = ["behavior-version-latest"] }
aws-sdk-s3 = "1.56"

# Keystore
keyring = { version = "3.6", features = [
    "apple-native",
    "windows-native",
    "async-secret-service",
    "tokio",
    "crypto-rust",
] }

# Tauri Plugins
tauri-plugin-fs = "2.0"
tauri-plugin-http = "2.0"
tauri-plugin-store = "2.0"
tauri-plugin-dialog = "2.0"
```

### 4. Project Structure

Create the following directory structure:

```bash
mkdir -p src-tauri/src/{models,services,commands,utils}
mkdir -p src/{components,services,hooks}
mkdir -p tests/{unit,integration}
```

---

## Development Workflow

### Running the Application

```bash
# Development mode (hot reload)
npm run tauri dev

# Build for production
npm run tauri build
```

### Running Tests

```bash
# Rust unit tests
cd src-tauri
cargo test

# Rust integration tests
cargo test --test integration_test

# Frontend tests
cd ..
npm test
```

### Linting & Formatting

```bash
# Rust formatting
cd src-tauri
cargo fmt

# Rust linting
cargo clippy

# Frontend formatting
cd ..
npm run format

# Frontend linting
npm run lint
```

---

## Local S3 Testing with MinIO

For development and testing, use MinIO as a local S3-compatible server:

### 1. Install MinIO

**macOS**:
```bash
brew install minio/stable/minio
```

**Windows**:
```powershell
# Download from https://min.io/download
# Or use Chocolatey
choco install minio
```

**Linux**:
```bash
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/
```

### 2. Start MinIO Server

```bash
# Create data directory
mkdir -p ~/minio-data

# Start server
minio server ~/minio-data --console-address ":9001"

# Default credentials:
# Access Key: minioadmin
# Secret Key: minioadmin
```

### 3. Configure Test Endpoint in App

- **Endpoint Name**: Local MinIO
- **URL**: `http://localhost:9000`
- **Region**: `us-east-1`
- **Access Key**: `minioadmin`
- **Secret Key**: `minioadmin`

### 4. Create Test Bucket

```bash
# Install MinIO Client
brew install minio/stable/mc  # macOS
# or download from https://min.io/download

# Configure mc
mc alias set local http://localhost:9000 minioadmin minioadmin

# Create test bucket
mc mb local/test-bucket

# Upload test files
mc cp /path/to/file.txt local/test-bucket/
```

---

## Configuration Files

### Tauri Config (`src-tauri/tauri.conf.json`)

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "productName": "SimpleS3",
  "identifier": "com.simples3.app",
  "version": "0.1.0"
}
```

### TypeScript Config (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## Debugging

### Rust Backend Debugging

Add to `src-tauri/src/main.rs`:

```rust
use tracing_subscriber;

fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .init();

    tauri::Builder::default()
        // ... rest of setup
}
```

View logs:
- **macOS**: `~/Library/Logs/com.simples3.app/`
- **Windows**: `%APPDATA%\com.simples3.app\logs\`
- **Linux**: `~/.local/share/com.simples3.app/logs/`

### Frontend Debugging

Open DevTools in development mode:
- Right-click → Inspect Element
- Or press `Cmd+Opt+I` (macOS) / `Ctrl+Shift+I` (Windows/Linux)

---

## Common Issues

### Build Failures

**Issue**: `error: linker 'cc' not found`
**Solution**: Install build tools (see Prerequisites)

**Issue**: `gtk-rs` compilation errors on Linux
**Solution**: Install all required GTK dependencies:
```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev
```

### Runtime Issues

**Issue**: "Failed to load keyring"
**Solution**: Ensure platform keystore is available:
- macOS: Keychain should be unlocked
- Windows: User must be logged in
- Linux: Ensure `gnome-keyring` or `kwallet` is running

**Issue**: S3 connection timeout
**Solution**: Check network, firewall settings, and endpoint URL

---

## VS Code Setup (Optional)

Recommended extensions:

```json
{
  "recommendations": [
    "rust-lang.rust-analyzer",
    "tauri-apps.tauri-vscode",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss"
  ]
}
```

Add to `.vscode/settings.json`:

```json
{
  "rust-analyzer.checkOnSave.command": "clippy",
  "editor.formatOnSave": true,
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## Next Steps

After setup:

1. Review [data-model.md](./data-model.md) for entity definitions
2. Review [contracts/tauri-commands.md](./contracts/tauri-commands.md) for API contracts
3. Run `/speckit.tasks` to generate implementation task list
4. Start implementing following TDD approach:
   - Write tests first
   - Verify tests fail
   - Implement feature
   - Verify tests pass

---

## Useful Commands Reference

| Command | Description |
|---------|-------------|
| `npm run tauri dev` | Start development server with hot reload |
| `npm run tauri build` | Build production application |
| `cargo test` | Run Rust unit tests |
| `cargo test --test integration_test` | Run integration tests |
| `cargo fmt` | Format Rust code |
| `cargo clippy` | Lint Rust code |
| `npm test` | Run frontend tests |
| `npm run lint` | Lint frontend code |
| `npm run format` | Format frontend code |

---

## Resources

- [Tauri Documentation](https://v2.tauri.app/)
- [AWS SDK for Rust](https://docs.aws.amazon.com/sdk-for-rust/latest/dg/welcome.html)
- [keyring-rs Documentation](https://docs.rs/keyring/latest/keyring/)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

For questions or issues, refer to the project documentation in `specs/001-s3-client/`.
