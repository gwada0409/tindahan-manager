# Phase 21 - Inventory/sales synchronization and device restoration

Status: implemented and verified locally on 2026-08-03

## Delivered

- Existing account-linking runs now queue inventory batches, immutable stock movements, completed sale headers, sale items, and matching payment records after catalog data.
- Previously completed account-linking states without the Phase 21 transaction marker reopen once, retain their original backup and mode, and resume without duplicating already processed master rows.
- Legacy batches without a complete ledger receive explicit opening/reconciliation movements so the cloud ledger preserves the current cached quantity. These additive records are labeled and included in validation.
- Completed sale headers and sale items now have server-owned cursor timestamps and participate in dependency-ordered incremental pull.
- Duplicate sale and sale-item pull pages are ignored by UUID and never requeue data.
- Store owners can restore a revoked registration through restore_store_device; the registration and timestamps remain intact.
- Direct device unrevocation stays blocked. The restore RPC sets a transaction-local authorization flag only after validating the owner role.
- The Settings device list does not offer revocation for the current browser and shows a confirmed Restore action for revoked registrations.

## Data safety

No Dexie schema changes are required. The Supabase migration adds two cursor columns, their triggers/indexes, one owner-only RPC, and a guarded trigger update. It does not delete or overwrite inventory, sales, device registrations, or local backups.

Account-linking still creates a complete local backup first. It rejects orphan inventory movements, incomplete sales, service sale lines, and missing required Utang/GCash effects instead of silently omitting them.

## Deployment

Apply supabase/migrations/202608030004_phase21_inventory_sales_restore.sql after Phase 20. Then deploy the frontend so the new pull entity types and Restore control match the database contract.

## Verification

- TypeScript project build passes.
- Vitest passes: 37 files and 132 tests.
- Production/PWA build passes: 2,867 modules and 10 precache entries.
- The live Supabase migration completed successfully. Read-only verification returned true for both cursor columns, the restore RPC, and both sales pull branches.
- ESLint remains unavailable because the repository has no ESLint 9 flat configuration.
