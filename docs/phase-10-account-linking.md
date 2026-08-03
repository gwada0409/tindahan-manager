# Phase 10 — Initial account linking and migration

Status: completed in source control  
Date: 2026-08-01

Phase 10 introduces an explicit account-linking wizard and additive Dexie v6 bookkeeping. It detects unlinked or empty installations, inventories local and cloud data, offers create/merge/download paths, stores a full local backup, normalizes supported legacy IDs and references, records resumable progress, drains supported migration queues, and validates counts and totals.

No path executes automatically. Development and offline sessions bypass the cloud-linking guard. Unsupported business entities are preserved locally and in the backup but are not represented as cloud-synchronized in documentation or UI.

See [migration-guide.md](migration-guide.md) for workflow, warnings, recovery, and current scope.
## Verification results

- TypeScript project build: passed.
- Focused Phase 10 suite: 3 files, 12 tests passed; final UUID normalization test: 4 tests passed.
- Full Vitest suite: 23 files, 80 tests passed.
- Production/PWA build: passed with 10 precache entries.
- ESLint: could not initialize because the repository has no ESLint 9 flat configuration.
- Live cloud migration and new-device verification: unavailable because Supabase CLI, PostgreSQL, and Docker are not installed.
- Build advisory: the main minified JavaScript chunk remains larger than 500 kB.