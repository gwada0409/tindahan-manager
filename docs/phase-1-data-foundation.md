# Phase 1: local data and repository foundation

Status: Completed  
Date: 2026-07-31  
Database transition: `TindahanDB` v3 -> v4

## Scope completed

Phase 1 adds the local data structures required by later synchronization work without introducing any network dependency:

- one common nested sync envelope for every domain entity;
- UUID generation through Web Crypto with a UUID-library fallback;
- UTC ISO-8601 helpers for sync timestamps;
- a persistent browser/device identifier stored under `tindahan_device_id`;
- metadata-aware generic repositories with list, lookup, count, create, add, update, soft delete, delete alias, and bulk upsert operations;
- repositories for products, categories, customers, suppliers, sales, financial records, store/user/employee records, stock movements, and audit logs;
- active feature writes routed through repository or transaction-owned metadata creation;
- product archival in place of hard deletion;
- default filtering of archived records from active lists, dashboards, reports, checkout, and ledgers;
- JSON import backfill for rows that do not already contain sync metadata.

No Supabase client, remote schema, authentication replacement, outbox, sync worker, cursor, network monitor, device-management UI, or conflict-resolution UI is included.

## Sync envelope

Each entity type extends the shared sync-capable contract. The `sync` property is optional at the TypeScript boundary so legacy fixtures and imported data remain readable before normalization. Repository writes and the v4 migration populate it.

| Field | Meaning |
|---|---|
| `storeId` | Local store association; uses `local-store-unassigned` only if no store exists |
| `createdAt` | Creation timestamp as UTC ISO text |
| `updatedAt` | Last local change timestamp as UTC ISO text |
| `deletedAt` | Soft-deletion timestamp or `null` |
| `version` | Monotonic local record version |
| `baseVersion` | Version on which the first pending change was based |
| `updatedBy` | Local user identifier when supplied, otherwise `null` |
| `deviceId` | Stable identifier for the browser profile |
| `syncStatus` | `pending`, `synced`, or `conflict`; Phase 1 writes `pending` |

## Migration behavior

Dexie schema v4 adds nested indexes for `sync.storeId`, `sync.syncStatus`, `sync.updatedAt`, and `sync.deletedAt` to all 19 entity tables.

The v3-to-v4 upgrade:

1. reads the existing store identifier when present;
2. obtains or creates the persistent device identifier;
3. visits every existing row in the upgrade transaction;
4. leaves rows with an existing sync envelope unchanged;
5. preserves IDs and all business fields;
6. derives creation time from an existing `createdAt`, `date`, `restockDate`, `startDate`, `payPeriodStart`, `dueDate`, or `paidDate` when available;
7. adds a version-1 pending envelope.

The migration does not clear, replace, or hard-delete any table.

## Repository behavior

Normal repository reads exclude rows whose `sync.deletedAt` is set. Administrative or migration callers may pass `{ includeDeleted: true }`.

Create operations generate a UUID and version-1 envelope. Updates preserve the primary key, increment `version`, retain the initial `baseVersion` for the pending change chain, update the device/user fields, and set status to pending. Soft deletion uses the same update rules and writes a UTC deletion timestamp. Bulk upsert preserves supplied IDs and existing envelopes while normalizing legacy-shaped rows.

Multi-table checkout and restock behavior remains transactional. Metadata is created inside those existing atomic transaction boundaries.

## Verification coverage

Phase 1 adds automated tests for:

- persistent device identity;
- UUID and UTC timestamp helpers;
- repository creation, update versioning, soft-delete filtering, count, lookup, and bulk upsert;
- a real fake-IndexedDB v3 fixture upgraded through `TindahanDB` v4, asserting preserved IDs, dates, and business data;
- existing checkout, auth, inventory, money, and color behavior through the full regression suite.

## Final verification

| Check | Result |
|---|---|
| Forced TypeScript project build | Passed |
| Vitest regression suite | Passed: 11 files, 33 tests |
| Production Vite/PWA build | Passed: 2,790 modules and six precache entries |
| Built-app smoke test | Passed: HTTP 200 at `/tindahan-manager/` |
| Diff whitespace check | Passed |
| ESLint | Could not analyze source because the existing ESLint 9 flat configuration is missing |

The production build retains the existing warning for a JavaScript chunk above 500 kB. The ESLint configuration and bundle splitting are deferred; neither was introduced by the data-foundation phase.

## Deferred work

- cloud schema and Row Level Security;
- Supabase Auth and store membership;
- durable operation outbox/inbox;
- sync cursors, retries, reachability, and diagnostics;
- remote device registration/revocation;
- version conflict detection and resolution UI;
- immutable movement coverage for completed sales;
- versioned and validated backup envelopes;
- strict TypeScript and ESLint configuration.
