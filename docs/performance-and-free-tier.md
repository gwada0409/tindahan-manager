# Performance and free-tier guidance

## Synchronization

Keep incremental cursors intact. Normal sync must not reset cursors or download full tables. Pull is paginated and push uses bounded batches. Realtime only shortens notification latency; periodic recovery handles missed events.

The application performs local eligibility checks every minute. It contacts Supabase for pending work or when an idle store has not completed a sync for 15 minutes. Hidden tabs skip interval work. Manual retry, sign-in, online events, mutations, and Realtime notifications can still trigger immediate runs.

## Retention and warnings

Successful local queue items disappear only after acknowledgement. Failed items remain with attempts, next retry, and error. The server retains operation receipts for at least 30 days; daily cleanup is capped at 1,000 rows. Do not shorten retention below the RPC’s seven-day minimum without redesigning idempotency assumptions.

Investigate 100 queued changes or 10 failures promptly. Review connectivity, authentication, conflicts, payload errors, and device revocation before deleting anything.

## Storage and files

The current product model has no image/file field. Do not add base64 or binary image data to PostgreSQL business rows. Use private Supabase Storage with RLS-aligned object paths and store only object references and metadata in PostgreSQL. Define lifecycle and orphan cleanup before enabling uploads.

Large JSON backups use gzip when browser support is available. Keep downloaded backups outside browser storage. Compression reduces file size, not record counts or database storage.

## Monitoring

Use application diagnostics for queue depth, failures, retries, cursor, and last synchronization. Use Supabase project reporting for database and Storage size, egress, Realtime usage, and active users. Configure external alerts according to the currently purchased plan; this repository intentionally does not encode changing provider quota numbers.

The production build still emits a large-chunk warning. Route-level code splitting remains future work and should be measured before changing offline/PWA caching behavior.