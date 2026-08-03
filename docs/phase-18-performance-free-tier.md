# Phase 18 — Performance and free-tier optimization

Status: completed locally on 2026-08-03

## Delivered

- Retains cursor-based incremental pull, bounded pagination, 25-operation upload batches, Realtime debounce, and exponential retry backoff.
- Replaces unconditional minute-by-minute cloud polling with local eligibility checks: pending queues sync promptly; empty, recently synchronized stores wait until the 15-minute recovery threshold; hidden tabs skip interval work.
- Suppresses identical mutable updates before version creation and queue insertion.
- Uses the queue status index instead of scanning every queue row for ready work.
- Adds best-effort server receipt cleanup at most once per running app instance per day, capped at 1,000 confirmed receipts older than 30 days.
- Preserves all failed queue items and diagnostic state.
- Adds PostgreSQL indexes for receipt retention, device activity, and open reconciliation issues.
- Adds UI warnings at 100 queued changes and 10 failed changes.
- Compresses backups of at least 1 MB with browser-native gzip when supported and accepts gzip restore files.
- Documents that files/images are not currently implemented and future files belong in Supabase Storage rather than PostgreSQL/base64 columns.

## Data safety

The additive Phase 18 migration adds indexes and a validated cleanup RPC only. Cleanup affects confirmed operation receipts after retention, never business rows. No Dexie schema or existing local record changes.

## Verification

Focused tests cover idle/stale/pending scheduling, unchanged-update suppression, and bounded authenticated cleanup/index contracts.

- TypeScript project build: passed.
- Vitest: passed, 35 files and 124 tests.
- Vite production/PWA build: passed, 2,867 modules and 10 precache entries.
- ESLint: unavailable because the repository does not yet contain the ESLint 9 flat configuration required by the installed version.
- Live migration and pgTAP execution: unavailable because Supabase CLI/runtime tooling is not installed in this workspace.