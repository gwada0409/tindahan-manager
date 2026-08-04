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

## Data safety

The repair does not delete or replace local or cloud business rows. Automatic adoption requires a completed migration state for the selected store and a matching current-device ID. Existing unrelated generated files and environment secrets remain outside the commit.

## Verification

The regression suite covers authenticated context selection, device-scoped queue adoption, nested sale payload repair, legacy category repair, queue ordering, and the normal sync lifecycle. Live diagnostics before deployment confirmed the affected account had four active device registrations but zero cloud catalog, inventory, sale, or operation rows, matching the stranded-local-queue failure mode. Post-deployment testing confirmed that a newly created product and its restock reached Supabase; that test exposed and led to the inventory receipt-acknowledgement repair above.

- TypeScript project build passes.
- Vitest passes: 40 files and 137 tests.
- Production/PWA build passes: 2,875 modules and 10 precache entries.
