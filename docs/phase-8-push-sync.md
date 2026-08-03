# Phase 8 — Push synchronization

Status: completed in source control; live Supabase execution pending  
Date: 2026-07-31

Phase 8 adds authenticated, non-blocking upload of the Phase 7 queue for products, product categories, customers, and suppliers. The client verifies its session and an authenticated membership query before recovering abandoned work and sending dependency-aware batches of up to 25 operations.

The `process_sync_operations` RPC validates authentication, active membership, registered device, store and payload identity, supported entity type, operation shape, and record version. It writes the entity and unique operation receipt within a per-operation database subtransaction. Duplicate operation IDs return confirmation without duplicating rows. Partial batch failures return individually and remain in IndexedDB with retry state.

Successful confirmation removes only the matching queue item. The local entity becomes `synced` only if it still has the uploaded version; newer local changes remain pending.

Push attempts occur after verified sign-in/startup, browser `online`, every 60 seconds while an online session is open, 1.5 seconds after important queued mutations, and through the layout's **Sync now** control. Concurrent triggers share one run. Cloud failures are converted to status and retry state and never reject into ordinary local workflows.

Structured logs include trigger and counts or an error class, never payloads, credentials, or session tokens.

No pull synchronization, Realtime subscription, conflict-resolution UI, or queue coverage beyond the four Phase 7 entity types is implemented.
## Verification results

- TypeScript project build: passed.
- Focused Phase 8 suite: 3 files, 13 tests passed.
- Full Vitest suite: 20 files, 67 tests passed.
- Production/PWA build: passed with 10 precache entries.
- ESLint: could not initialize because the repository has no ESLint 9 flat configuration.
- Live SQL/pgTAP execution: unavailable because Supabase CLI, PostgreSQL, and Docker are not installed.
- Build advisory: the main minified JavaScript chunk remains larger than 500 kB.