# Cloud database schema

Status: Phase 16 schema and device-management additions implemented in source control; remote application requires a Supabase project  
Date: 2026-08-01

## Scope

The cloud schema mirrors implemented local business data while Dexie/IndexedDB remains the working database. Phase 6 does not upload, download, relabel, or otherwise mutate local records.

Apply migrations in timestamp order:

```text
202607310001_phase5_auth_ownership.sql
202607310002_phase6_business_schema_rls.sql
202607310003_phase8_push_sync_rpc.sql
202607310004_phase9_pull_sync_rpc.sql
202608010001_phase11_sales_sync.sql
202608010002_phase12_inventory_sync.sql
202608010003_phase13_financial_sync.sql
202608010004_phase16_realtime_devices.sql
202608030001_phase18_retention_indexes.sql
202608030002_phase19_security_hardening.sql
202608030003_phase20_sync_device_repair.sql
```

The first migration creates account ownership. The second adds business tables, role/device-aware Row Level Security, store settings, indexes, operation-ID constraints, and generated-compatible TypeScript types. Phase 20 restores the Phase 16 device timestamp, owner policy/RPC, and Realtime registrations without rewriting business rows.

## Included tables

| Table | Local counterpart | Lifecycle |
|---|---|---|
| `stores` | `storeSettings` | Manager-updatable; owner identity is trigger-protected |
| `store_members` | Cloud membership only | Owner hierarchy protected |
| `devices` | Persistent browser identity | Registration, name, activity/sync timestamps, and owner-controlled revocation/restoration |
| `product_categories` | `categories` | Mutable, manager-controlled soft deletion |
| `suppliers` | `suppliers` | Mutable prerequisite for product/batch relationships |
| `products` | `products` | Mutable, manager-controlled soft deletion |
| `inventory_batches` | `inventoryBatches` | Mutable remaining quantity; manager-controlled soft deletion |
| `stock_movements` | `stockMovements` | Append-only for authenticated clients |
| `customers` | `customers` | Mutable, manager-controlled soft deletion |
| `sales` | `sales` | Append-only for authenticated clients |
| `sale_items` | `saleItems` | Append-only product snapshots |
| `utang_entries` | `utangEntries` | Append-only charge/payment/adjustment ledger |
| `gcash_transactions` | `gcashTransactions` | Append-only ledger |
| `bills` | `bills` | Mutable because the implemented workflow marks bills paid |
| `employees` | `employees` | Manager-only mutable records |
| `payroll_entries` | `payrollEntries` | Manager-only append |
| `vault_transactions` | `vaultTransactions` | Manager-only append |
| `audit_logs` | `auditLogs` | Append-only events |
| `sync_operations` | `syncQueue` receipts | Protected operation-ID registry for idempotent transaction processing |

Services and Notes are excluded because their management pages are not implemented. Expenses are excluded because there is no local expense entity. Suppliers are included despite lacking a management page because existing products and inventory batches already reference supplier records.

## Common business metadata

Every Phase 6 business table contains:

```text
id uuid
store_id uuid
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz
version bigint
updated_by uuid
device_id text
```

Business IDs are caller-supplied UUIDs so offline-created identifiers can be preserved. `store_id` is required. `updated_by` references `auth.users`, while `(store_id, updated_by, device_id)` references a registered device. RLS additionally requires that device to be unrevoked.

`updated_at` is maintained by database triggers. Version increments and optimistic concurrency checks are intentionally left for the synchronization/RPC phases.

## Store-scoped relationships

Relationships use composite `(store_id, id)` foreign keys where a child references another business row. This prevents a row in one store from referencing a product, customer, batch, sale, employee, category, or supplier in another store.

All material relationships use `ON DELETE RESTRICT`. Master data is retired through `deleted_at`; authenticated clients receive no hard-delete grant.

IndexedDB still does not enforce these cloud foreign keys. A future initial-upload process must validate and reconcile legacy relationships before pushing.

## Monetary and time fields

Money uses PostgreSQL `bigint` integer centavos, matching the local integer convention. Business dates use `timestamptz`. Generated-compatible frontend types expose these values as JavaScript numbers and ISO strings; synchronization code must reject values outside JavaScript's safe-integer range.

## Transaction and operation identity

Stock movements, sales, utang entries, GCash transactions, payroll entries, vault transactions, and audit logs require an `operation_id` unique within a store. `sync_operations.operation_id` is globally unique and is reserved as the later server idempotency registry.

Phase 7 adds a local durable queue for four master-data entity types. It does not add a push adapter, processing RPC, pull workflow, or end-to-end exactly-once transaction protocol. See [sync-protocol.md](sync-protocol.md).

## Indexes

Every business table has indexes for:

- `store_id`;
- `(store_id, updated_at, id)` incremental cursors;
- `(store_id, deleted_at)` tombstones.

Additional indexes cover foreign keys, due/status queries, transaction timestamps, entity references, and operation processing. Partial unique indexes protect active category names, SKUs, and barcodes without preventing reuse after a soft deletion.

## TypeScript database types

[`src/types/supabase.database.ts`](../src/types/supabase.database.ts) describes ownership and business rows, inserts, updates, functions, and the membership enum. The Supabase client is parameterized with this `Database` type.

The file is checked against TypeScript but was authored from the migration because the Supabase CLI was unavailable. Regenerate and review it after applying migrations to a real project:

```bash
supabase gen types typescript --local > src/types/supabase.database.ts
```

Do not overwrite reviewed application-specific constraints without comparing the generated diff.

## Migration verification

Vitest structurally verifies table coverage, metadata, RLS enablement, restrictive deletion, immutable policies, role restrictions, and operation uniqueness.

[`supabase/tests/phase6_rls_verification.sql`](../supabase/tests/phase6_rls_verification.sql) is a transactional pgTAP test for a disposable local Supabase database. It checks cross-store reads/writes, cashier restrictions, and duplicate operation rejection, then rolls back its fixtures.

A local Supabase CLI/PostgreSQL runtime was not available during Phase 6, so SQL execution remains a required deployment check.

## Phase 8 push RPC

`202607310003_phase8_push_sync_rpc.sql` adds `process_sync_operations(jsonb)`. It processes batches of at most 50 supported master-data operations, validates identity and version boundaries, and records a unique receipt in `sync_operations`. Per-operation exception blocks permit partial batch results without acknowledging failed mutations.
## Phase 9 change cursor

The four synchronized master tables have a trigger-maintained `server_changed_at` column and `(store_id, server_changed_at, id)` pull index. `pull_sync_changes` returns authorized rows, including tombstones, in deterministic pages using the timestamp and UUID cursor.
## Phase 10 local migration records

Dexie v6 adds `migrationBackups` for complete pre-migration snapshots and `migrationState` for mode, status, processed tables, validation counts/totals, and resumable errors. These are local-only tables and do not change the Supabase schema.
## Phase 11 additions

Local Dexie v7 adds saleAdjustments, indexed by sale ID, adjustment type, date, store, and sync status. The migration is additive and does not update existing rows.

The Phase 11 cloud migration adds immutable sale_adjustments plus authenticated process_sale_transaction and process_sale_compensation functions. Sale ingestion writes the header, complete items, payment/debt side effect, audit record, and operation receipt transactionally. Phase 12 also queues sale and return movements as separate idempotent inventory-ledger operations.

## Phase 12 inventory synchronization

The cloud inventory batch and stock movement tables now have server-owned pull timestamps. inventory_reconciliation_issues records negative merged balances caused by concurrent offline work. process_inventory_operation accepts atomic restock or movement envelopes, records a unique receipt, and updates the batch cache by signed delta. No new Dexie table or data rewrite is required.

## Phase 13 financial synchronization

Server-owned pull timestamps now cover Utang, GCash, bills, employees, payroll, and vault. process_financial_operation validates store/device access and records idempotent receipts. Ledger balances remain derived sums. No Dexie schema change is required.

## Phase 16 additions

Devices record last activity and successful sync timestamps. Owners can list store registrations and revoke active devices. Realtime publication events remain invalidation hints; the authenticated incremental pull is authoritative.

## Phase 18 operational indexes and retention

Indexes support store/processed-time receipt cleanup, store device-activity ordering, and open inventory-reconciliation review. `cleanup_sync_receipts` validates active membership and bounded retention/limit arguments, then deletes at most the requested batch of confirmed receipts. It does not touch failed local queue entries or business rows.
## Phase 19 security enforcement

The additive Phase 19 migration forces RLS on every implemented ownership and business table, revokes anonymous table access, removes public/anonymous RPC execution, and bounds newly written names and audit payloads without rewriting existing rows. Authenticated capabilities continue to depend on the grants and store/role/device checks defined by earlier migrations.

## Phase 21 sales pull and device restoration

Sales and sale items have server-owned cursor timestamps, triggers, and store/cursor/UUID indexes. The pull RPC orders sale headers before dependent items. Owners can revoke an active registration through revoke_store_device and restore it through restore_store_device. Both RPCs validate the owner role, while the row trigger blocks direct unrevocation. No device row or business row is deleted.
