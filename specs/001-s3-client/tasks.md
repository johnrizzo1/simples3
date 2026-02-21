# Tasks: S3 Client Desktop Application

**Feature**: 001-s3-client
**Input**: Design documents from `/specs/001-s3-client/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/, research.md, quickstart.md

**Tests**: Tests are RECOMMENDED but not strictly required per project constitution. Test tasks are included for critical paths (transfers, keystore, S3 operations) following TDD approach.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Tauri backend**: `src-tauri/src/`
- **Frontend**: `src/`
- **Tests**: `tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Initialize Tauri 2.x project with React + TypeScript template
- [X] T002 [P] Configure Cargo.toml with dependencies (tauri, serde, tokio, uuid, chrono, thiserror, aws-sdk-s3, keyring)
- [X] T003 [P] Configure package.json with dependencies (React, TypeScript, @tanstack/react-query, lucide-react, tailwindcss)
- [X] T004 [P] Create directory structure: src-tauri/src/{models,services,commands,utils}
- [X] T005 [P] Create directory structure: src/{components,services,hooks}
- [X] T006 [P] Create directory structure: tests/{unit,integration,fixtures}
- [X] T007 [P] Configure tauri.conf.json with app metadata and permissions
- [X] T008 [P] Configure Tauri plugins in Cargo.toml (fs, http, store, dialog)
- [X] T009 [P] Install tauri-plugin-keyring-api for frontend
- [X] T010 [P] Setup linting and formatting (cargo fmt, cargo clippy, eslint, prettier)
- [X] T011 [P] Configure tracing-subscriber for backend logging in src-tauri/src/main.rs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Data Models (Core Entities)

- [X] T012 [P] Create ValidationStatus enum in src-tauri/src/models/endpoint.rs
- [X] T013 [P] Create S3Endpoint struct in src-tauri/src/models/endpoint.rs
- [X] T014 [P] Create LocalFileItem struct in src-tauri/src/models/file_item.rs
- [X] T015 [P] Create S3Object struct in src-tauri/src/models/file_item.rs
- [X] T016 [P] Create S3Bucket struct in src-tauri/src/models/file_item.rs
- [X] T017 [P] Create TransferJob and related enums in src-tauri/src/models/transfer.rs
- [X] T018 [P] Create AppConfig struct in src-tauri/src/models/config.rs

### Error Handling

- [X] T019 [P] Define S3Error enum with thiserror in src-tauri/src/utils/error.rs (as AppError::S3)
- [X] T020 [P] Define TransferError enum in src-tauri/src/utils/error.rs (as AppError::Transfer)
- [X] T021 [P] Define KeystoreError enum in src-tauri/src/utils/error.rs (as AppError::Keystore)

### Configuration Service

- [X] T022 Create ConfigService for loading/saving app config in src-tauri/src/services/config.rs
- [X] T023 Implement get_config() method using Tauri Store plugin
- [X] T024 Implement update_config() method with validation

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Browse Local Files (Priority: P1) 🎯 MVP

**Goal**: Enable users to browse local filesystem in left pane

**Independent Test**: Launch app, navigate local directories from home directory, view file metadata

### Implementation for User Story 1

- [X] T025 [P] [US1] Create FilesystemService in src-tauri/src/services/filesystem.rs
- [X] T026 [US1] Implement list_directory() method returning Vec<LocalFileItem>
- [X] T027 [US1] Implement get_home_directory() method
- [X] T028 [US1] Add file metadata extraction (size, modified date, type)
- [X] T029 [P] [US1] Create list_directory Tauri command in src-tauri/src/commands/filesystem.rs
- [X] T030 [P] [US1] Create get_home_directory Tauri command in src-tauri/src/commands/filesystem.rs
- [X] T031 [P] [US1] Create LocalFileItem TypeScript interface in src/types/models.ts
- [X] T032 [P] [US1] Create LocalPane React component in src/components/LocalPane.tsx
- [X] T033 [P] [US1] Create FileItem component for list rendering in src/components/FileItem.tsx
- [X] T034 [US1] Implement directory navigation (double-click folders, parent directory button)
- [X] T035 [US1] Implement file selection and metadata display
- [X] T036 [US1] Add error handling for permission denied, not found cases
- [X] T037 [US1] Integrate LocalPane into main App.tsx with initial home directory load

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Manage S3 Endpoints (Priority: P1)

**Goal**: Enable users to add, edit, delete, and validate S3 endpoint configurations with secure credential storage

**Independent Test**: Add endpoint with test credentials, validate connection, edit endpoint, delete endpoint

### Implementation for User Story 2

- [X] T038 [P] [US2] Create KeystoreService in src-tauri/src/services/keystore.rs
- [X] T039 [US2] Implement store_credentials() using keyring-rs
- [X] T040 [US2] Implement retrieve_credentials() from keystore
- [X] T041 [US2] Implement delete_credentials() from keystore
- [X] T042 [P] [US2] Create EndpointService in src-tauri/src/services/endpoint.rs
- [X] T043 [US2] Implement load_endpoints() from JSON file
- [X] T044 [US2] Implement save_endpoints() to JSON file
- [X] T045 [US2] Implement add_endpoint() with credential storage
- [X] T046 [US2] Implement update_endpoint() with credential update
- [X] T047 [US2] Implement delete_endpoint() with credential removal
- [X] T048 [US2] Implement validate_endpoint() using S3 ListBuckets API call
- [X] T049 [US2] Implement set_active_endpoint() ensuring only one active
- [X] T050 [P] [US2] Create list_endpoints Tauri command in src-tauri/src/commands/endpoints.rs
- [X] T051 [P] [US2] Create add_endpoint Tauri command with validation
- [X] T052 [P] [US2] Create update_endpoint Tauri command
- [X] T053 [P] [US2] Create delete_endpoint Tauri command
- [X] T054 [P] [US2] Create validate_endpoint Tauri command
- [X] T055 [P] [US2] Create set_active_endpoint Tauri command
- [X] T056 [P] [US2] Create S3Endpoint TypeScript interface in src/types/models.ts
- [X] T057 [P] [US2] Create EndpointManager React component in src/components/EndpointManager.tsx
- [X] T058 [US2] Implement endpoint list view with active indicator
- [X] T059 [US2] Implement Add Endpoint form with validation
- [X] T060 [US2] Implement Edit Endpoint form with credential retrieval
- [X] T061 [US2] Implement Delete Endpoint confirmation dialog
- [X] T062 [US2] Add validation progress indicator during credential testing
- [X] T063 [US2] Add error handling and display for validation failures
- [X] T064 [US2] Integrate EndpointManager into App.tsx navigation

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Browse S3 Buckets and Objects (Priority: P2)

**Goal**: Enable users to browse S3 buckets and objects in right pane

**Independent Test**: With configured endpoint, browse buckets, navigate folders, view object metadata

### Implementation for User Story 3

- [x] T065 [P] [US3] Create S3ClientService in src-tauri/src/services/s3_client.rs
- [x] T066 [US3] Implement create_client() from endpoint credentials
- [x] T067 [US3] Implement list_buckets() method
- [x] T068 [US3] Implement list_objects() with prefix support for folders
- [x] T069 [US3] Add S3 object metadata extraction (size, modified, storage class)
- [x] T070 [P] [US3] Create list_buckets Tauri command in src-tauri/src/commands/s3.rs
- [x] T071 [P] [US3] Create list_objects Tauri command
- [x] T072 [P] [US3] Create S3Bucket and S3Object TypeScript interfaces in src/types/models.ts
- [x] T073 [P] [US3] Create S3Pane React component in src/components/S3Pane.tsx
- [x] T074 [US3] Implement bucket list view
- [x] T075 [US3] Implement object list view with folder support (prefixes)
- [x] T076 [US3] Implement folder navigation (double-click, parent folder button)
- [x] T077 [US3] Implement object selection and metadata display
- [x] T078 [US3] Add loading states for S3 API calls
- [x] T079 [US3] Add error handling for network errors, invalid credentials
- [x] T080 [US3] Integrate S3Pane into App.tsx with active endpoint binding

**Checkpoint**: All browsing functionality (local + S3) should now work independently

---

## Phase 6: User Story 4 - Upload Files to S3 (Priority: P2)

**Goal**: Enable file uploads from local to S3 with progress, pause/resume, conflict resolution, and queue management

**Independent Test**: Select local file, upload to S3, pause/resume transfer, handle name conflicts, queue multiple files

### Implementation for User Story 4

- [ ] T081 [P] [US4] Create TransferService in src-tauri/src/services/transfer.rs
- [ ] T082 [US4] Implement create_transfer_job() for upload
- [ ] T083 [US4] Implement simple upload for files <=100MB
- [ ] T084 [US4] Implement multipart upload initiation for files >100MB
- [ ] T085 [US4] Implement multipart part upload with retry logic
- [ ] T086 [US4] Implement multipart upload completion
- [ ] T087 [US4] Implement upload progress tracking and speed calculation
- [ ] T088 [US4] Implement pause_transfer() saving resume point (upload_id, completed parts)
- [ ] T089 [US4] Implement resume_transfer() continuing from last part
- [ ] T090 [US4] Implement cancel_transfer() with cleanup (abort multipart upload)
- [ ] T091 [US4] Implement conflict detection (check if S3 key exists)
- [ ] T092 [US4] Implement conflict resolution dialog logic (overwrite, skip, rename, apply to all)
- [ ] T093 [P] [US4] Create TransferQueue manager in src-tauri/src/services/transfer_queue.rs
- [ ] T094 [US4] Implement add_to_queue() with concurrency limit check
- [ ] T095 [US4] Implement process_queue() executor with max concurrent transfers
- [ ] T096 [US4] Implement queue position management
- [ ] T097 [P] [US4] Create upload_file Tauri command in src-tauri/src/commands/transfers.rs
- [ ] T098 [P] [US4] Create pause_transfer Tauri command
- [ ] T099 [P] [US4] Create resume_transfer Tauri command
- [ ] T100 [P] [US4] Create cancel_transfer Tauri command
- [ ] T101 [P] [US4] Create get_transfer_queue Tauri command
- [ ] T102 [P] [US4] Implement transfer-progress event emission to frontend
- [ ] T103 [P] [US4] Implement transfer-status-changed event emission
- [ ] T104 [P] [US4] Create TransferJob TypeScript interface in src/types/models.ts
- [ ] T105 [P] [US4] Create TransferQueue React component in src/components/TransferQueue.tsx
- [ ] T106 [US4] Implement transfer list with status (queued, active, paused, completed, failed)
- [ ] T107 [US4] Implement progress bar and speed display per transfer
- [ ] T108 [US4] Implement pause/resume/cancel buttons
- [ ] T109 [US4] Add event listeners for real-time progress updates
- [ ] T110 [P] [US4] Create ConflictDialog React component in src/components/ConflictDialog.tsx
- [ ] T111 [US4] Add upload trigger in LocalPane (drag-and-drop or button)
- [ ] T112 [US4] Integrate TransferQueue into App.tsx
- [ ] T113 [US4] Implement transfer state persistence on pause for app restart
- [ ] T114 [US4] Add error handling and retry logic for network failures

**Checkpoint**: Upload functionality fully working with queue, progress, and pause/resume

---

## Phase 7: User Story 5 - Download Files from S3 (Priority: P2)

**Goal**: Enable file downloads from S3 to local with progress, pause/resume, conflict resolution, and queue management

**Independent Test**: Select S3 object, download to local, pause/resume transfer, handle name conflicts, queue multiple files

### Implementation for User Story 5

- [ ] T115 [US5] Implement create_transfer_job() for download in src-tauri/src/services/transfer.rs
- [ ] T116 [US5] Implement simple download for files <=100MB
- [ ] T117 [US5] Implement range download for files >100MB (byte ranges)
- [ ] T118 [US5] Implement download progress tracking and speed calculation
- [ ] T119 [US5] Implement pause_download() saving completed byte ranges
- [ ] T120 [US5] Implement resume_download() continuing from last byte
- [ ] T121 [US5] Implement cancel_download() with partial file cleanup
- [ ] T122 [US5] Implement conflict detection (check if local file exists)
- [ ] T123 [US5] Reuse conflict resolution dialog logic from upload
- [ ] T124 [P] [US5] Create download_file Tauri command in src-tauri/src/commands/transfers.rs
- [ ] T125 [US5] Add download trigger in S3Pane (drag-and-drop or button)
- [ ] T126 [US5] Add disk space check before download
- [ ] T127 [US5] Add error handling for insufficient disk space
- [ ] T128 [US5] Integrate downloads into TransferQueue component
- [ ] T129 [US5] Implement download state persistence on pause

**Checkpoint**: Both upload and download fully working with all transfer features

---

## Phase 8: User Story 6 - Delete Files and Folders (Priority: P3)

**Goal**: Enable deletion of local files and S3 objects with confirmation dialogs

**Independent Test**: Delete local file (moves to trash), delete S3 object (permanent), handle multiple selection

### Implementation for User Story 6

- [ ] T130 [P] [US6] Implement delete_local_item() in src-tauri/src/services/filesystem.rs
- [ ] T131 [US6] Use platform trash/recycle bin API (not permanent deletion)
- [ ] T132 [P] [US6] Implement delete_s3_object() in src-tauri/src/services/s3_client.rs
- [ ] T133 [US6] Implement recursive delete for S3 prefixes (folders)
- [ ] T134 [P] [US6] Create delete_local_item Tauri command in src-tauri/src/commands/filesystem.rs
- [ ] T135 [P] [US6] Create delete_s3_object Tauri command in src-tauri/src/commands/s3.rs
- [ ] T136 [P] [US6] Create ConfirmDeleteDialog React component in src/components/ConfirmDeleteDialog.tsx
- [ ] T137 [US6] Implement different warnings for local (trash) vs S3 (permanent)
- [ ] T138 [US6] Add delete button/action in LocalPane with confirmation
- [ ] T139 [US6] Add delete button/action in S3Pane with confirmation
- [ ] T140 [US6] Implement multi-select delete with single confirmation
- [ ] T141 [US6] Add error handling for permission denied, not found

**Checkpoint**: All user stories should now be independently functional

---

## Phase 9: Configuration and Settings

**Purpose**: User preferences for concurrency, theme, and other settings

- [ ] T142 [P] Create set_concurrency_limit Tauri command in src-tauri/src/commands/config.rs
- [ ] T143 [P] Create get_config Tauri command
- [ ] T144 [P] Create update_config Tauri command
- [ ] T145 [P] Create Settings React component in src/components/Settings.tsx
- [ ] T146 Implement concurrency limit setting (1-10 slider)
- [ ] T147 [P] Implement theme selection (Light, Dark, System)
- [ ] T148 [P] Implement show hidden files toggle
- [ ] T149 Integrate Settings into App.tsx navigation

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T150 [P] Add application menu bar with File, Edit, View, Help menus
- [ ] T151 [P] Implement keyboard shortcuts (Cmd/Ctrl+R refresh, Cmd/Ctrl+D delete, etc.)
- [ ] T152 [P] Add global loading states and error boundaries
- [ ] T153 [P] Implement auto-save for app state on window close
- [ ] T154 [P] Add restore paused transfers on app startup
- [ ] T155 [P] Implement network connectivity detection
- [ ] T156 [P] Add auto-pause transfers on network loss
- [ ] T157 [P] Implement retry logic with exponential backoff for S3 errors
- [ ] T158 [P] Add application icons for all platforms (macOS, Windows, Linux)
- [ ] T159 [P] Create README.md with installation and usage instructions
- [ ] T160 [P] Add logging to file for debugging
- [ ] T161 Perform cross-platform testing (macOS, Windows, Linux)
- [ ] T162 Optimize bundle size and startup time

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Configuration (Phase 9)**: Can run in parallel with user stories or after
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Browse Local Files - No dependencies on other stories
- **User Story 2 (P1)**: Manage S3 Endpoints - No dependencies on other stories
- **User Story 3 (P2)**: Browse S3 - Requires US2 (need endpoint to browse)
- **User Story 4 (P2)**: Upload Files - Requires US1 (local browsing) and US3 (S3 browsing)
- **User Story 5 (P2)**: Download Files - Requires US3 (S3 browsing) and US1 (local browsing)
- **User Story 6 (P3)**: Delete Files - Requires US1 and US3 (browsing both sides)

### Within Each User Story

- Models and errors before services
- Services before commands
- Commands before UI components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Within each user story, tasks marked [P] can run in parallel
- User Story 1 (Local Browse) and User Story 2 (Endpoints) can run in parallel after Foundation
- User Story 4 (Upload) and User Story 5 (Download) can run in parallel if US1, US2, US3 complete

---

## Parallel Example: User Story 4 (Upload)

```bash
# These can run in parallel (different files):
Task T081: Create TransferService
Task T093: Create TransferQueue manager
Task T097-T103: Create all Tauri commands (different command functions)
Task T104: Create TypeScript interfaces
Task T105: Create TransferQueue component
Task T110: Create ConflictDialog component

# Sequential after above:
Task T112: Integrate TransferQueue into App.tsx
Task T113: Implement state persistence
Task T114: Add error handling
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Local Browse)
4. Complete Phase 4: User Story 2 (Manage Endpoints)
5. **STOP and VALIDATE**: Test both stories independently
6. Deploy/demo if ready - **Users can now browse local files and configure endpoints**

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 + US2 → Test independently → Deploy/Demo (MVP!)
3. Add US3 (S3 Browse) → Test independently → Deploy/Demo
4. Add US4 (Upload) + US5 (Download) in parallel → Test both → Deploy/Demo
5. Add US6 (Delete) → Test independently → Deploy/Demo
6. Add Configuration → Test → Deploy/Demo
7. Add Polish → Final release

Each increment adds value without breaking previous functionality.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Local Browse)
   - Developer B: User Story 2 (Endpoints)
3. After US1 + US2 complete:
   - Developer A: User Story 3 (S3 Browse)
   - Developer B: User Story 4 (Upload)
   - Developer C: User Story 5 (Download)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests are RECOMMENDED for critical paths (per constitution): transfers, keystore, S3 ops, multipart logic
- Verify tests fail before implementing (TDD approach for critical paths)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

## Task Count Summary

- **Total Tasks**: 162
- **Setup Phase**: 11 tasks
- **Foundational Phase**: 13 tasks
- **User Story 1 (P1)**: 13 tasks
- **User Story 2 (P1)**: 27 tasks
- **User Story 3 (P2)**: 16 tasks
- **User Story 4 (P2)**: 34 tasks
- **User Story 5 (P2)**: 15 tasks
- **User Story 6 (P3)**: 12 tasks
- **Configuration Phase**: 8 tasks
- **Polish Phase**: 13 tasks

**Parallel Tasks**: 89 tasks marked [P] can run in parallel within their phase

**MVP Scope (Suggested)**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (US1) + Phase 4 (US2) = **64 tasks** for first deployable version

**Independent Test Criteria**:
- US1: Browse local directories, view file metadata
- US2: Add/edit/delete endpoints, validate credentials
- US3: Browse S3 buckets and objects
- US4: Upload files with progress, pause/resume
- US5: Download files with progress, pause/resume
- US6: Delete local/S3 items with confirmation

**Format Validation**: ✅ All tasks follow checklist format: `- [ ] [TID] [P?] [Story?] Description with file path`
