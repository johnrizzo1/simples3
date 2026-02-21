# API Contracts: S3 Client Desktop Application

**Feature**: 001-s3-client
**Date**: 2026-02-20
**Status**: Phase 1 Design

This directory contains API contract definitions for all Tauri commands (backend-to-frontend IPC).

## Contract Files

- **[filesystem.md](./filesystem.md)**: Local filesystem operations
- **[endpoints.md](./endpoints.md)**: S3 endpoint management
- **[s3.md](./s3.md)**: S3 bucket and object operations
- **[transfers.md](./transfers.md)**: File transfer queue management
- **[config.md](./config.md)**: Application configuration

## Command Naming Convention

All Tauri commands use snake_case following Rust conventions:
- `list_directory` ✅ (not `listDirectory`)
- `get_home_directory` ✅ (not `getHomeDirectory`)

## Error Handling

All commands return `Result<T, String>` where:
- `Ok(T)` → Success with result data
- `Err(String)` → Error with user-friendly message

Frontend should catch errors and display appropriate UI feedback.

## Type Definitions

All types reference entities defined in [data-model.md](../data-model.md).

## Invocation Example

```typescript
import { invoke } from '@tauri-apps/api/tauri';

try {
  const items = await invoke<LocalFileItem[]>('list_directory', {
    path: '/Users/username/Documents'
  });
  // Handle success
} catch (error) {
  // Handle error (error is a string)
  console.error('Failed to list directory:', error);
}
```
