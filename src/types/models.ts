// TypeScript interfaces matching Rust data models
// See specs/001-s3-client/data-model.md for complete definitions

export interface LocalFileItem {
  path: string;
  name: string;
  size: number; // Bytes (0 for directories)
  modified: string; // ISO 8601 datetime
  is_directory: boolean;
  file_type: string | null; // Extension or MIME type
}

export interface S3Object {
  bucket: string;
  key: string;
  size: number;
  modified: string; // ISO 8601 datetime
  storage_class: string | null;
  etag: string | null;
  is_prefix: boolean; // True for folder-like prefixes
}

export interface S3Bucket {
  name: string;
  created: string; // ISO 8601 datetime
  region: string | null;
}

export enum ValidationStatus {
  Pending = "Pending",
  Validated = "Validated",
  Failed = "Failed",
}

export interface S3Endpoint {
  id: string; // UUID
  name: string;
  url: string;
  region: string;
  validation_status: ValidationStatus | { Failed: { reason: string } };
  is_active: boolean;
  path_style: boolean;
  created_at: string; // ISO 8601 datetime
  last_validated_at: string | null; // ISO 8601 datetime
}

export enum TransferType {
  Upload = "Upload",
  Download = "Download",
}

export enum TransferStatus {
  Queued = "Queued",
  Active = "Active",
  Paused = "Paused",
  Cancelled = "Cancelled",
  Completed = "Completed",
  Failed = "Failed",
}

export interface TransferLocation {
  Local?: { path: string };
  S3?: { bucket: string; key: string };
}

export interface TransferJob {
  id: string; // UUID
  transfer_type: TransferType;
  source: TransferLocation;
  destination: TransferLocation;
  file_size: number;
  progress_bytes: number;
  status: TransferStatus;
  resume_point: any | null; // Complex type, null for now
  queue_position: number;
  error_message: string | null;
  created_at: string; // ISO 8601 datetime
  started_at: string | null; // ISO 8601 datetime
  completed_at: string | null; // ISO 8601 datetime
  retry_count: number;
  max_retries: number;
}

export enum Theme {
  Light = "Light",
  Dark = "Dark",
  System = "System",
}

export interface DiskSpaceInfo {
  available_bytes: number;
  total_bytes: number;
}

export type ConflictResolution = "overwrite" | "skip" | "rename";

export interface ConflictItem {
  name: string;
  path: string; // source path (local or S3 key)
  resolution: ConflictResolution;
  newName?: string; // only when resolution is "rename"
}

export interface AppState {
  current_view: string; // "files" | "endpoints" | "settings"
  local_path: string | null;
  s3_bucket: string | null;
  s3_prefix: string | null;
}

export interface AppConfig {
  selected_endpoint_id: string | null; // UUID
  max_concurrent_transfers: number; // Default: 3, Range: 1-10
  theme: Theme;
  auto_validate_endpoints: boolean;
  show_hidden_files: boolean;
  default_local_path: string | null;
  multipart_chunk_size: number; // Default: 10 MB
  multipart_threshold: number; // Default: 100 MB
}
