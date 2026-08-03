# Initial account linking and migration guide

Status: account linking implemented with current synchronized entity coverage  
Date: 2026-08-01

## Before starting

Sign in online, select the intended store, and keep the browser open. The wizard inventories every local Dexie table and creates a complete backup in the `migrationBackups` IndexedDB table before changing IDs, metadata, or working records. Do not clear site data during migration. A normal Settings JSON export remains advisable for an additional off-device copy.

## Choices

### Create a new cloud store using local data

Use this immediately after account creation when the selected cloud store is empty. The wizard refuses this path when supported cloud records already exist. The account sign-up flow creates the cloud store; the wizard links this installation to that selected empty store.

### Merge local data into an existing store

The wizard compares supported local and remote records and displays likely duplicates based on SKU, barcode, phone, or normalized name. IDs are never merged automatically. Supported local rows upload, followed by incremental cloud download.

### Download cloud data into an empty local database

Use this for a new browser or device. After the backup, the explicit choice clears local working tables and synchronization state, then rebuilds supported master, inventory, and financial records available through incremental cloud pull. Completed sales are not currently part of new-device cloud pull; use a Phase 17 backup file when full local history is required. Store settings and local account profiles are retained.

## Migration mechanics

1. Inventory counts and selected numeric totals are recorded.
2. A full local backup is persisted.
3. Non-UUID category, supplier, customer, and product IDs are replaced with UUIDs in one transaction; dependent references are updated.
4. Missing store, device, actor, and sync metadata are filled while original timestamps are retained when present.
5. Each table is committed separately and recorded in `migrationState`.
6. Supported rows are queued for idempotent upload.
7. Bounded synchronization runs continue until that queue is empty.
8. Counts and totals are recalculated before completion.

A failed run retains its backup, processed-table list, queue entries, and error. Reopen the wizard and choose the same mode to resume. Already processed tables are skipped.

## Validation

For create and merge modes, every pre-migration table count and tracked total must match afterward. Download mode records its resulting counts and totals but intentionally replaces the active working set after explicit confirmation.

## Recovery

Do not downgrade IndexedDB after v7. If migration fails, preserve browser data, inspect `migrationState.lastError`, restore from the retained `migrationBackups` record through a reviewed forward-recovery tool, or use a separately downloaded Settings export. Never clear the queue or backup tables to force completion.

## Current scope

Account-linking queue preparation remains limited to categories, suppliers, products, and customers. Normal synchronization additionally covers transactional sales uploads, inventory movements, and implemented financial modules. A downloaded Phase 17 backup is the complete-device restore path because cloud pull does not yet reconstruct completed sales or local-only Notes/Services.