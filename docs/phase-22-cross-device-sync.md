# Phase 22 - Cross-device post-link synchronization repair

Status: implemented and verified locally on 2026-08-04

## Root cause

An authenticated browser without a local `storeSettings` row used `local-store-unassigned` as the repository context. Product, inventory, and sale writes remained durable in IndexedDB, but their queue entries did not match the authenticated cloud store. Store-scoped queue counts therefore reported zero and the UI could display Synced without uploading those records. New products also used the non-UUID category marker `default`, which cannot satisfy the cloud product foreign key.

## Implemented repair

- Verified authentication now supplies the active store, user, and device context to every repository write, independently of optional local business settings.
- After a completed account link, an online sync run adopts only unassigned pending records and queue payloads created by the current device. Records from other devices or an unlinked installation are left untouched.
- Adoption rewrites nested inventory and completed-sale envelopes, so previously stranded mobile data can retain its UUIDs and original timestamps while uploading normally.
- Products using the legacy `default` category marker are moved to a stable UUID General category. The category operation is queued before products.
- New products automatically create and synchronize that General category when no category is supplied.
- Authentication failures and logout clear the repository context so one account cannot leak into a later local session.
- Confirmed inventory-operation receipts now release their local batch metadata before pull, preventing a successful restock from being misclassified as a concurrent-edit conflict and blocking the following sale.
- Inventory-batch conflicts can now be resolved explicitly with the existing keep-device or keep-cloud controls; ledger and financial records remain protected.
- Initial migration waits for queued retry eligibility instead of exhausting its batch loop immediately, and reports the failed entity plus the server-safe reason when an operation is rejected.
- A resumed migration recognizes an already-uploaded master record only when its UUID, version, editor, device, and update timestamp all match; it then acknowledges the stale local queue receipt without rewriting cloud data.
- When the recorded pre-migration count for a master table is zero, a same-ID cloud row is authoritative even if account-reset metadata differs; the stale queue receipt is removed without deleting or rewriting that cloud row.
- A resumed migration also acknowledges a same-ID, same-version category, supplier, product, or customer when all synchronized business fields match, even if receipt editor, device, or timestamp metadata changed. Different business content remains queued and is never overwritten automatically.
- Final create/merge validation now rejects only shrinking baseline counts or tracked totals. Records pulled from cloud or written locally while a migration was paused are additive and no longer cause a false inventory-batch validation failure.
- Every authenticated sync attempt repairs a local or queued product whose category is the legacy `default` marker, reuses an existing synchronized General category when available, and immediately resets failed product, inventory, and sale dependencies for retry. This repair also runs before account linking reaches complete.
- Cloud push RPCs now execute dependency groups in the order master data, inventory restocks/movements, completed sales, financial records, then sale compensation. A product and batch therefore exist before dependent inventory or sale operations are submitted.
- A user-initiated Retry sync resets retry eligibility for failed operations in the selected store before pushing. Background attempts still use exponential backoff, so a manual retry no longer reports success while leaving one failed change waiting.

## Data safety

The repair does not delete or replace local or cloud business rows. Automatic adoption requires a completed migration state for the selected store and a matching current-device ID. Existing unrelated generated files and environment secrets remain outside the commit.

## Verification

The regression suite covers authenticated context selection, device-scoped queue adoption, nested sale payload repair, legacy category repair, queue ordering, and the normal sync lifecycle. Live diagnostics before deployment confirmed the affected account had four active device registrations but zero cloud catalog, inventory, sale, or operation rows, matching the stranded-local-queue failure mode. Post-deployment testing confirmed that a newly created product and its restock reached Supabase; that test exposed and led to the inventory receipt-acknowledgement repair above.

- TypeScript project build passes.
- Vitest passes: 41 files and 149 tests.
- Production/PWA build passes: 2,875 modules and 10 precache entries.
