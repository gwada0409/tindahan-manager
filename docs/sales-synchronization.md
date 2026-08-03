# Sales synchronization and compensation

## Offline checkout

Checkout does not wait for Supabase. One Dexie transaction writes all local effects and the durable queue envelope. If product lookup, stock allocation, customer validation, or any write fails, no sale or queue entry remains.

The envelope contains:

- completed sale header and UUID;
- complete item snapshots;
- cash, GCash, or Utang effect;
- signed per-batch sale movements;
- audit record;
- one operation UUID.

The background engine retries safely. Queue entries remain until the authenticated server function confirms the operation receipt.

## Cloud reconciliation

The sale RPC rejects empty item sets, identity mismatch, invalid status, mismatched item/subtotal/sale totals, invalid cash change, missing GCash records, mismatched credit charges, and stock quantities that do not reconcile with sold quantities. PostgreSQL transactions make partial cloud sales impossible.

## Voids, refunds, reversals, and adjustments

Completed sale rows remain immutable. Corrections use a new immutable compensation record with a reason, positive compensation amount, optional returned item quantities, and its own operation UUID. The local service prevents duplicate voids, over-refunds, and over-returns. Returned products restore the batches recorded by the original sale movements. Utang and GCash corrections create inverse entries.

The compensation service is implemented and tested, but the Sales page does not yet expose history or compensation controls. A future UI must call the service rather than editing a sale directly.

## Recovery and limitations

- New Phase 11 queue entries survive reloads and timeouts.
- Pre-Phase-11 sales stay local because missing allocation history cannot be inferred safely.
- Pull synchronization for sales is not implemented; a new device does not download sales yet.
- Phase 12 queues sale and return movements separately into the idempotent cloud inventory ledger.
- Apply the Phase 11 SQL migration before enabling sale upload.