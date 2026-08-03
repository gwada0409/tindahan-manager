# Phase 15 — Sync status user interface

Status: completed locally on 2026-08-01

## Delivered

- Replaced the narrow online-only queue strip with a global expandable status control.
- Added distinct Offline, Online, Pending, Syncing, Synced, Failed, Authentication required, Conflict, and Cloud unavailable presentations.
- Clearly states that offline work is saved on the device.
- Shows pending count, last successful sync, friendly error, and manual retry.
- Adds administrator diagnostics for failed items, accumulated retry attempts, last connectivity check, last push/pull, last failed attempt, pull cursor, device ID, and app version.
- Sync engine snapshots retain diagnostic timestamps across state transitions.
- Initial account linking displays its persisted stage and completed table-step progress.
- Reset confirmation reports the number of pending cloud changes that local reset would delete. Existing sign-out pending-work protection remains active.

## Data safety

No IndexedDB or Supabase schema changed. The interface reads existing queue, conflict, migration, state, and identity records. It does not alter business data. Manual retry invokes the existing safe synchronization engine.

## Verification

- TypeScript project build: passed.
- Vitest: 32 files and 113 tests passed, including all ten display-state mappings.
- Production/PWA build: passed (2,865 modules; 10 precache entries).
- ESLint: unavailable because the repository has no ESLint 9 flat configuration.
- Diff whitespace and credential-value review: passed.