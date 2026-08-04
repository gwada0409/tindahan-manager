# Synchronization protocol

Status: Phase 16 authenticated synchronization, conflict review, Realtime invalidation, and device management implemented  
Date: 2026-08-01

## Local-first write path

Supported mutable records and immutable business transactions write to Dexie first. Each local create, update, or soft delete writes the resulting entity and a `syncQueue` operation inside the same Dexie transaction. If either write fails, Dexie rolls both back. The UI continues to read from IndexedDB and does not wait for Supabase.

Each operation has a UUID `operationId`, store/entity identity, `upsert` or `delete` intent, a complete payload snapshot, creation time, attempt count, and processing state. The unique `operationId` index prevents duplicate receipts locally. Operations remain stored until a future cloud worker explicitly acknowledges server processing.

## Dexie v5 tables

| Table | Purpose |
|---|---|
| `syncQueue` | Durable pending, processing, and failed local operations |
| `syncState` | Per-store pull and successful-sync timestamps for later phases |
| `syncConflicts` | Durable unresolved/resolved conflict records, value snapshots, provenance, versions, and audited resolution metadata |

The v4-to-v5 migration only creates these empty tables. It does not transform, delete, upload, or relabel existing business records.

## Retry and crash recovery

`SyncQueueService` increments the attempt count when work enters `processing`, records the last attempt, and schedules failures with exponential backoff from one second to a five-minute cap. Processing entries older than two minutes can be recovered to `pending` after an interrupted browser session. Readiness is based on persisted timestamps rather than `navigator.onLine`.

Phase 8 consumes due operations after verified session and authenticated reachability checks. Failed requests retain their persisted backoff state.

## Cloud-originated writes

Pulled records are translated to local domain shapes and written directly within the pull transaction. They do not use mutation repositories or create queue entries, preventing pull/echo loops.

## Current entity coverage

Versioned mutable synchronization covers products, product categories, customers, suppliers, bills, and employees. Immutable transaction synchronization covers sales and compensation entries, inventory batches and movements, Utang, GCash, payroll, and vault records.

## Invariants

- Dexie remains the working database.
- Queue deletion occurs only through explicit acknowledgement.
- Failed synchronization must not block local application use.
- Operation IDs are unique.
- Cloud-applied rows are never requeued.
- Pull cursors advance only in the same transaction as a successfully applied page.

## Phase 8 push behavior

The engine verifies local context, a valid Supabase session, authenticated reachability, and crash recovery before sending dependency-aware batches. Before each push it repairs the legacy `default` product-category marker in both IndexedDB rows and durable queue payloads, then clears retry backoff for affected inventory and sale dependencies. RPC groups execute master data first, followed by inventory, completed sales, financial records, and compensation. The RPC validates membership, device, store/payload identity, entity type, format, and record versions. Only server-confirmed operation IDs are acknowledged locally.

Automatic attempts occur after verified startup/sign-in, browser online events, every 60 seconds while open, and 1.5 seconds after a queued mutation. The layout provides **Sync now**. Concurrent triggers share one active run, and synchronization failures are retained rather than thrown into local workflows.

## Phase 9 pull behavior

After push, the engine downloads only rows after the per-store `(server_changed_at, id)` cursor. The server owns the timestamp and uses the UUID as a deterministic tie-breaker. Pages include soft-deleted rows and are applied as categories, suppliers, customers, then products.

Every page and its next cursor commit in one Dexie transaction. Missing product parents, interrupted application, or a pending local version roll back the complete page and preserve the previous cursor. Duplicate pages are safe primary-key upserts. `lastSuccessfulSyncAt` changes only after the final page commits.
## Phase 10 initial linking

Verified online installations that are empty or contain records linked to another local store enter an explicit wizard before normal application routes. The wizard records every table count and selected numeric totals, stores a full local backup, normalizes supported UUID references, and persists completed table names for resume. Supported records enter the normal durable queue; unsupported records remain local. New-device download clears active working tables only after explicit confirmation and backup.
## Verification

Automated tests cover atomic queueing, rollback, persistence, retry, crash recovery, orchestration order, full-request failure, partial batch failure, duplicate confirmation, server validation contracts, and the non-destructive v4-to-v5 migration. A disposable pgTAP script verifies first processing and duplicate replay against a local Supabase runtime.

## Rollback

Do not downgrade IndexedDB after clients have opened v5. Disable automatic triggers and deploy a forward RPC repair while retaining v5 table declarations and every unconfirmed queue operation. Do not remove the Phase 8 migration from a database where it has been applied.

## Not implemented

- notes/services synchronization and note preserve-both conflict handling;
- automatic field-level merging when no common base snapshot is available;


## Phase 11 sale transactions

A new sale is queued as one sale_transaction operation after all local effects commit in the same Dexie transaction. The adapter routes that operation to an authenticated PostgreSQL function instead of the mutable master-data RPC. PostgreSQL validates item, sale, payment, debt, and movement totals and writes one operation receipt. A repeated operation UUID is acknowledged as a duplicate. Completed sale headers are immutable; corrections use sale_compensation operations and immutable adjustment records.

## Phase 12 inventory merge

Inventory restocks and movements use transaction queue operations. The server stores signed movement UUIDs once and updates batch quantity caches in the same PostgreSQL transaction. Pull pages order inventory batches before movements locally; existing movement UUIDs are ignored and new UUIDs increment the cache. Final quantities are never pushed as competing last-write-wins values.

## Phase 13 financial synchronization

Utang, GCash, payroll, and vault entries are immutable UUID ledgers. Bills and employees use versioned records. Durable local queue operations push before incremental pull; duplicate operation receipts are acknowledged without duplicating balances.

## Phase 14 conflict handling

Before a mutable pulled row is applied, the client compares it with any pending local version. A version mismatch writes a durable `syncConflicts` row before the pull page runs, marks the local row `conflict`, throws without advancing the cursor, and deduplicates repeated detections for the same entity.

Administrators can review base-version metadata plus complete local/cloud values, editors, devices, and timestamps at `/conflicts`. **Keep this device** rebases the local version over the observed server version and returns its existing queue work to pending. **Keep cloud** replaces the mutable local row and removes its obsolete queued edits. Both choices and their versions are written to `auditLogs` in the same local transaction.

Completed sales, compensation records, stock movements, Utang, GCash, payroll, and vault entries are protected ledgers. The generic resolver refuses to overwrite them. Corrections must use the source module's immutable adjustment/compensation workflow. Automatic merge is intentionally unavailable when the client does not hold a trustworthy base snapshot; the UI displays this limitation instead of guessing.
## Phase 16 Realtime invalidation

Store-scoped Postgres-change subscriptions cover synchronized business tables. Events are debounced for 750 ms and trigger the normal engine; payloads are not applied. The engine continues its 60-second interval so missed events cannot permanently suppress incremental pull. Successful runs update the current device last-activity and last-sync timestamps on a best-effort basis.