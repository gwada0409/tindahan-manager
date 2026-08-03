# Phase 11 — Sales synchronization

Status: completed in source control
Date: 2026-08-01

Phase 11 makes each newly completed sale one durable local transaction and one logical cloud submission. Checkout atomically stores the sale UUID, item snapshots, payment or customer-debt effect, per-batch stock movements, audit record, and globally unique queue operation ID. A failure rolls back the entire local checkout.

The authenticated process_sale_transaction PostgreSQL function validates identity, membership, device registration, item totals, sale totals, payment totals, and stock-movement quantities before inserting the immutable cloud header, every item, financial side effects, audit record, and operation receipt in one transaction. Retrying the same operation ID returns the existing receipt instead of creating another sale.

Completed sales are never overwritten. saleAdjustments and sale_adjustments store immutable void, refund, reversal, and adjustment records. The local compensation service restores exact recorded batch allocations when item quantities are returned and creates inverse Utang or GCash records where applicable. Compensation totals cannot exceed the original sale.

## Current inventory boundary

Phase 11 creates and reconciles local sale/return stock movements. Cloud transaction receipts retain the movement envelope, but do not insert it into the cloud stock ledger because cloud inventory-batch synchronization is Phase 12. This avoids broken batch foreign keys and prevents incomplete inventory histories. The Phase 12 migration must consume retained movement envelopes idempotently.

## Existing-data behavior

Dexie v7 adds only the empty saleAdjustments table. Existing sales, items, inventory, queue entries, and migration backups are unchanged. Historical pre-Phase-11 sales are preserved locally but are not reconstructed or uploaded automatically because they may lack the stock allocations required for safe reconciliation.

## Verification

- TypeScript: passed.
- Focused Phase 11 tests: 5 files, 18 tests passed.
- Full Vitest suite: 25 files, 89 tests passed.
- Production/PWA build: passed with 10 precache entries.
- ESLint: unavailable because no ESLint 9 flat configuration exists.
- Live PostgreSQL/RLS verification requires a Supabase-capable environment.
- Build advisory: the main minified JavaScript chunk remains larger than 500 kB.