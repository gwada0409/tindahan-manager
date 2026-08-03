# Phase 7 — Durable local sync queue

Status: completed in source control  
Date: 2026-07-31

Phase 7 upgrades `TindahanDB` from v4 to v5 by adding durable queue, state, and conflict tables without changing existing entity rows. Local product, category, customer, and supplier mutations now atomically store both the entity and a unique queue operation. Cloud-originated bulk upserts explicitly bypass queue creation.

Retry bookkeeping includes attempt counts, last-attempt timestamps, persisted exponential-backoff deadlines, and recovery of stale processing entries. No background worker or Supabase business-data request is included.

Verification covers atomic writes, transaction rollback, duplicate prevention, browser-database reopen persistence, retry readiness, crash recovery, cloud-origin bypass, and v4 data preservation. See [sync-protocol.md](sync-protocol.md) for the detailed contract.
## Verification results

- TypeScript project build: passed.
- Focused Phase 7 suite: 3 files, 11 tests passed.
- Full Vitest suite: 18 files, 60 tests passed.
- Production/PWA build: passed with 10 precache entries.
- ESLint: could not initialize because no ESLint 9 flat configuration exists.
- Build advisory: the main minified chunk remains larger than 500 kB.