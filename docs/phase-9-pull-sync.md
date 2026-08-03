# Phase 9 — Pull synchronization

Status: completed in source control; live Supabase execution pending  
Date: 2026-07-31

Phase 9 adds incremental download for products, product categories, customers, and suppliers after the Phase 8 push step. The server owns `server_changed_at`; the cursor combines that timestamp with the row UUID so equal timestamps remain deterministic. Pull pages include soft-deleted rows and are restricted to active store members.

The client requests pages of 100 changes, orders local application as categories, suppliers, customers, then products, and commits every page plus its next cursor in one Dexie transaction. Missing product parents, interrupted writes, or pending local edits roll back the page and retain the previous cursor. Replayed pages use primary-key puts and do not duplicate records or create outbox entries.

The cursor is stored per store in `syncState`. `lastSuccessfulSyncAt` is updated only after the final page commits. The existing startup, sign-in, online, periodic, debounced mutation, and manual triggers now perform push followed by pull.

No conflict resolution is attempted: pending local data is preserved and blocks the affected page for Phase 10 handling. Pull remains limited to the four lower-risk entity types.
## Verification results

- TypeScript project build: passed.
- Focused Phase 9 suite: 3 files, 12 tests passed.
- Full Vitest suite: 22 files, 75 tests passed.
- Production/PWA build: passed with 10 precache entries.
- ESLint: could not initialize because the repository has no ESLint 9 flat configuration.
- Live SQL/pgTAP and two-device verification: unavailable because Supabase CLI, PostgreSQL, and Docker are not installed.
- Build advisory: the main minified JavaScript chunk remains larger than 500 kB.