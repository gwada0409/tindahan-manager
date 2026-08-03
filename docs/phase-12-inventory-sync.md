# Phase 12 — Inventory synchronization

Status: completed in source control
Date: 2026-08-01

Phase 12 synchronizes inventory as immutable signed movements instead of overwriting final quantities. Restocks commit a batch, positive movement, audit record, and durable inventory_restock operation together. Sales, returns, damage, expiry, transfers, and manual adjustments use inventory_movement operations. Movement UUIDs and operation receipts make retries idempotent.

The cloud RPC inserts each movement once and transactionally updates inventory_batches.remaining_quantity as a cache. Pull synchronization downloads batches before movements. The local apply path ignores movement UUIDs already present and increments the cached batch only for new movements, so independent device movements merge rather than replace each other.

Concurrent offline devices can legitimately oversell before either sees the other's movement. The server retains both movements and creates an inventory_reconciliation_issues record when their merged total becomes negative. It never discards a completed sale to hide the conflict.

The Inventory page reports local cached-versus-ledger discrepancies. It does not silently rewrite historical data.

## Existing-data behavior

No Dexie schema migration is required. Existing batches and movements remain unchanged. New Phase 12 operations synchronize automatically. A legacy batch that was created before inventory synchronization and has no cloud batch cannot accept new cloud movements until it is explicitly baselined or restocked through a reviewed migration; Phase 12 does not infer missing historical movements.

## Verification

Focused Phase 12 suite: 5 files, 14 tests passed.
Full Vitest suite: 28 files, 96 tests passed.
TypeScript and production/PWA build: passed with 10 precache entries.
ESLint: unavailable because no ESLint 9 flat configuration exists.
Live PostgreSQL and RLS execution requires a Supabase-capable environment.
Build advisory: the main minified JavaScript chunk remains larger than 500 kB.