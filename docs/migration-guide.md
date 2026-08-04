# Initial account linking and migration guide

Status: account linking implemented with current synchronized entity coverage  
Date: 2026-08-03

## Before starting

Sign in online, select the intended store, and keep the browser open. The wizard inventories every local Dexie table and creates a complete backup in the `migrationBackups` IndexedDB table before changing IDs, metadata, or working records. Do not clear site data during migration. A normal Settings JSON export remains advisable for an additional off-device copy.

## Choices

### Create a new cloud store using local data

Use this immediately after account creation when the selected cloud store is empty. The wizard refuses this path when supported cloud records already exist. The account sign-up flow creates the cloud store; the wizard links this installation to that selected empty store.

### Merge local data into an existing store

The wizard compares supported local and remote records and displays likely duplicates based on SKU, barcode, phone, or normalized name. IDs are never merged automatically. Supported local catalog rows, inventory batches/movements, and completed product sales upload, followed by incremental cloud download.

### Download cloud data into an empty local database

Use this for a new browser or device. After the backup, the explicit choice clears local working tables and synchronization state, then rebuilds supported master, inventory, and financial records available through incremental cloud pull. Completed product sales and their line items participate in cloud pull. Use a Phase 17 backup when local-only Notes/Services or other unsupported history is required. Store settings and local account profiles are retained.

## Migration mechanics

1. Inventory counts and selected numeric totals are recorded.
2. A full local backup is persisted.
3. Non-UUID category, supplier, customer, and product IDs are replaced with UUIDs in one transaction; dependent references are updated.
4. Missing store, device, actor, and sync metadata are filled while original timestamps are retained when present.
5. Each table is committed separately and recorded in `migrationState`.
6. Catalog rows and reconstructed inventory/sale transaction envelopes are queued for idempotent upload. Legacy inventory caches receive labeled opening/reconciliation ledger entries only when required.
7. Bounded synchronization runs continue until that queue is empty.
8. Counts and totals are recalculated before completion.

A failed run retains its backup, processed-table list, queue entries, and error. Reopen the wizard and choose the same mode to resume. Already processed tables are skipped. After linking completes, authenticated writes use the selected cloud store directly even when the optional local `storeSettings` row is absent. Phase 22 adopts only matching current-device changes stranded by older builds under `local-store-unassigned`.

## Validation

For create and merge modes, every pre-migration table count and tracked total must remain at least as large afterward. Additive cloud pulls and local writes made while a resumable migration is paused are accepted; any shrink still fails validation. Download mode records its resulting counts and totals but intentionally replaces the active working set after explicit confirmation.

## Recovery

Do not downgrade IndexedDB after v7. If migration fails, preserve browser data, inspect `migrationState.lastError`, restore from the retained `migrationBackups` record through a reviewed forward-recovery tool, or use a separately downloaded Settings export. Never clear the queue or backup tables to force completion.

## Current scope

Account linking uploads categories, suppliers, products, customers, batch-based inventory history, and completed product sales. Normal synchronization also covers implemented financial modules. Local-only Notes/Services and sales containing service lines remain outside cloud reconstruction; use a Phase 17 backup for those records.