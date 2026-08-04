# Tindahan Manager

Tindahan Manager is a local-first point-of-sale and store-management Progressive Web App for small retail and sari-sari store operations. It uses React, TypeScript, Vite, Dexie/IndexedDB, Zustand, Tailwind CSS, and optional Supabase services.

Phase 22 repairs cross-device writes created after account linking: authenticated repository writes now use the selected cloud store even when local store settings are absent, stranded per-device queue entries are adopted safely, products without a category receive a synchronized General category, acknowledged inventory operations no longer create false pull conflicts before a sale, migration retries respect queue backoff while exposing the failed entity reason, and interrupted same-version uploads are acknowledged without overwriting cloud data.

Phase 21 completes account-linking upload and multi-device pull for inventory and completed sales, and adds owner-controlled restoration for revoked device registrations without deleting business data.

Phase 19 hardens the deployed browser and cloud boundary with forced RLS, anonymous-access revocation, bounded new text inputs, a restrictive browser security policy, and audited backup restores.

See the [Phase 22 cross-device sync repair](docs/phase-22-cross-device-sync.md), [Phase 21 synchronization and restore record](docs/phase-21-inventory-sales-restore.md), [Phase 20 sync repair](docs/phase-20-sync-device-repair.md), [Phase 19 record](docs/phase-19-security-hardening.md), [Phase 18 record](docs/phase-18-performance-free-tier.md), [performance guide](docs/performance-and-free-tier.md), [Phase 17 record](docs/phase-17-backup-recovery.md), [recovery guide](docs/recovery-guide.md), [Phase 16 record](docs/phase-16-realtime-devices.md), [device-management guide](docs/device-management.md), [Phase 15 record](docs/phase-15-sync-status-ui.md), [sync-status guide](docs/sync-status.md), [Phase 14 record](docs/phase-14-conflict-resolution.md), [conflict guide](docs/conflict-resolution.md), [migration guide](docs/migration-guide.md), [sync protocol](docs/sync-protocol.md), [cloud schema](docs/database-schema.md), [security model](docs/security-model.md), and [audit/refactor record](docs/offline-sync-refactor.md).

## Implemented features

- Local point of sale with cash and utang checkout
- Product inventory, batch restocking, FEFO/FIFO deduction, stock indicators, and barcode scanning
- Customer/utang, GCash, vault, bills, employee, and payroll records
- Dashboard and seven-day reports
- Store branding, JSON export/import, and local database reset
- Installable PWA shell with GitHub Pages-safe hash routing, offline relaunch, and user-controlled updates
- UUID record IDs, persistent browser identity, sync metadata, soft deletion, and non-destructive IndexedDB migrations through v7
- Optional Supabase Auth sign-up, email/password sign-in, session restoration, sign-out, email confirmation redirect, and password recovery
- Durable queueing, push/pull, and explicit resumable account linking for catalog data, inventory batches/movements, and completed product sales
- Authenticated post-link writes use the active account/store context, with device-scoped recovery for records previously stranded under the unassigned local-store marker
- Atomic, idempotent upload and incremental pull of completed sales with complete items, payments, debt effects, stock-movement envelopes, and audit records
- Movement-based multi-device inventory synchronization with duplicate suppression, transactional quantity caches, and reconciliation reporting
- Idempotent synchronization for Utang, GCash, bills, employees/payroll, and vault
- Durable mutable-record conflict capture with an administrator-only base/local/cloud review screen and audited keep-local or keep-cloud decisions
- Global sync-status indicator with pending count, last success, friendly errors, manual retry, conflicts, connectivity, cursor, device, and queue diagnostics
- Debounced Realtime change notifications with incremental-pull refresh, periodic missed-event recovery, device activity tracking, and owner-only device revocation/restoration
- Versioned SHA-256 backups of every Dexie table with metadata/count validation, transactional full restore, date rehydration, and pre-restore/pre-reset safety copies
- Adaptive idle synchronization, unchanged-update suppression, indexed queue selection, bounded confirmed-receipt retention, queue/failure warning thresholds, and optional large-backup gzip
- Forced-RLS cloud ownership and business schemas with anonymous-access revocation, store-scoped relationships, role/device checks, restrictive deletion, bounded text inputs, and operation-ID constraints
- Multi-store selection for accounts with more than one active membership
- Previously verified offline account reopening on the same browser/device
- Development-only, password-free local admin/staff quick access

The Services route is a coming-soon placeholder. Supplier and Notes tables exist without management pages.

## Authentication and security

When Supabase is configured and all listed SQL migrations are applied:

- Supabase Auth owns passwords and cloud sessions; the application never persists a password itself.
- A successful online verification registers the current browser for the selected store.
- The local offline cache contains only the user ID, email, display name, store ID/name, role, device ID, and verification timestamp.
- A cached identity reopens only when its device ID matches the persistent ID in that browser.
- First sign-in on a new device requires Supabase connectivity.
- Cloud ownership rows use RLS membership checks; the owner-store creation RPC derives the user from `auth.uid()`.
- Owner/administrator memberships map to the existing local `admin` permissions; cashier/staff map to `employee`.

Local route and permission guards remain user-interface controls. The cloud schema enforces membership, role, registered-device, and store-scoped relationship checks through PostgreSQL and RLS. Supported queued records upload only after authenticated membership and device validation; unsupported entities remain local.

Development builds show password-free Admin demo and Staff demo buttons. Those controls are removed from production builds and do not create cloud identities. The former hard-coded frontend passwords and unsigned legacy session are no longer used.

## Offline and local-data behavior

Dexie/IndexedDB remains the business database. Normal business screens continue to read and write local data, and signing out does not delete it. If pending local records exist, sign-out shows a warning before continuing.

Supported repository and transaction mutations create durable pending operations atomically with local records. Local writes succeed without network access, queues survive reloads, and verified online sessions synchronize automatically or through **Sync now**.

After an online Supabase verification on the same browser, the account can reopen while Supabase is unreachable. The application displays:

> Working offline using the last verified account session. Cloud access requires an internet connection.

Offline account reopening does not validate a currently active server session and cannot provide cloud access. Signing out clears the verified identity cache, so signing in again requires connectivity. Clearing browser storage can lose business data unless a JSON export exists.

## Architecture

```text
React UI
  -> auth service -> Supabase Auth + ownership tables/RLS (when configured)
  -> feature services/repositories -> Dexie/IndexedDB v7
  -> durable local sync queue (catalog, inventory, sales, and financial operations)
  -> authenticated push/pull engine -> idempotent Supabase RPC/RLS
  -> transactional Dexie apply + per-store server cursor
  -> account-linking backup/progress validation
  -> atomic immutable sale upload and compensation records
  -> immutable inventory movement merge and cached-stock reconciliation
  -> durable conflict review for independently edited mutable records
```

Business records retain their sync envelope. Selected repository writes create durable queue operations. The push engine consumes confirmed operations while leaving failed or unconfirmed work queued. Repository reads exclude soft-deleted records by default.

## Technology and requirements

- React 19, React Router, TypeScript 6, Vite 5, and Tailwind CSS 4
- Dexie 4/IndexedDB, Zustand, Supabase JS, Vitest, Happy DOM, and Workbox
- Node.js 20 or later and npm compatible with the committed lockfile
- A modern browser with IndexedDB; HTTPS or localhost for service workers and camera access
- A Supabase project only when cloud accounts are required

## Local database and migration

The database is TindahanDB version 7. The additive v7 migration creates the empty saleAdjustments table; opening the database does not alter existing business rows. The v6 migration continues to provide migrationBackups and migrationState.

Money remains integer centavos. IndexedDB does not enforce foreign keys.

## Supabase setup

1. Create a Supabase project.
2. Apply migrations in timestamp order:

```text
supabase/migrations/202607310001_phase5_auth_ownership.sql
supabase/migrations/202607310002_phase6_business_schema_rls.sql
supabase/migrations/202607310003_phase8_push_sync_rpc.sql
supabase/migrations/202607310004_phase9_pull_sync_rpc.sql
supabase/migrations/202608010001_phase11_sales_sync.sql
supabase/migrations/202608010002_phase12_inventory_sync.sql
supabase/migrations/202608010003_phase13_financial_sync.sql
supabase/migrations/202608010004_phase16_realtime_devices.sql
supabase/migrations/202608030001_phase18_retention_indexes.sql
supabase/migrations/202608030002_phase19_security_hardening.sql
supabase/migrations/202608030003_phase20_sync_device_repair.sql
supabase/migrations/202608030004_phase21_inventory_sales_restore.sql
```

With a linked Supabase CLI project, review the target and run `supabase db push`. For a disposable local project, use `supabase db reset`, then `supabase test db` for the pgTAP RLS checks. Never test destructive reset commands against production.

3. Copy `.env.example` to an ignored `.env` and provide only public browser values:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
```

4. In Supabase Auth URL Configuration, set the Site URL and add both local and production redirect URLs. For the current project use:

```text
http://localhost:5173
http://localhost:5173/**
https://localhost:5173/**
https://127.0.0.1:5173/**
https://gwada0409.github.io/tindahan-manager/**
```

The application uses PKCE and generates confirmation/recovery redirects from `window.location.origin` plus Vite's active base, followed by hash routes such as `#/login` and `#/reset-password`. Prefer exact production allowlist entries in a real deployment.

The client temporarily accepts `VITE_SUPABASE_ANON_KEY` if the publishable-key variable is absent. Never expose a service-role key, secret key, database password, or JWT secret.

## Existing-user and new-device migration

After a verified cloud sign-in, an unlinked installation opens an explicit wizard. It shows local counts and three choices: use the selected empty cloud store with local data, merge into an existing store, or rebuild a new device from cloud data. The wizard persists a complete IndexedDB backup and resumable progress before modifying the active data. Likely duplicates are displayed but never merged automatically.

For download mode, the user explicitly authorizes replacement of the local working set after backup. For create/merge modes, original IDs are retained when valid UUIDs; supported legacy IDs and dependent references are converted safely. Counts and selected financial totals must validate before completion. See [the migration guide](docs/migration-guide.md).
## Movement-based inventory

Stock synchronization sends immutable signed movements, never a last-write-wins final quantity. Restocks and later movements update local batches and durable queue entries atomically. The cloud stores each movement UUID once, applies its signed delta to the cached batch quantity, and exposes batches and movements to incremental pull.

Local checkout blocks insufficient stock unless Allow Negative Inventory is enabled. Concurrent offline devices cannot see one another's pending sales, so the merged cloud ledger can become negative; the server preserves both legitimate operations and records a reconciliation issue. The Inventory page reports cached-versus-ledger discrepancies without automatically changing history. See [inventory reconciliation](docs/inventory-reconciliation.md).
## Offline sales and transaction safety

Checkout writes the completed sale UUID, all item snapshots, payment or Utang effect, per-batch stock movements, audit entry, and one durable operation in a single Dexie transaction. It succeeds without internet and rolls back completely if any local step fails. The server validates totals and processes the envelope in one PostgreSQL transaction; duplicate operation IDs return the prior receipt.

Completed sales are never overwritten. Void, refund, reversal, and adjustment corrections use immutable compensation records, restore recorded batch allocations where item quantities are returned, and create inverse Utang or GCash entries. The compensation service is implemented and tested; Sales history and compensation controls are not yet exposed in the UI. See [sales synchronization](docs/sales-synchronization.md).
## Synchronization overview

Supported changes upload first, then download incrementally using a server-generated timestamp plus UUID cursor. Pull pages include soft deletions and commit records with the next cursor in one Dexie transaction. Categories and suppliers apply before dependent products; duplicate pages upsert by UUID and do not requeue. Failed pages retain the previous cursor. Verified startup/sign-in, browser online events, 60-second intervals, debounced mutations, and **Sync now** trigger push followed by pull. A pending local edit is never overwritten. A different cloud version creates or refreshes a durable conflict record, marks the local row as conflicted, preserves the pull cursor, and pauses that page until an administrator explicitly keeps the local or cloud version. The review screen shows available base/local/cloud versions and provenance. Financial ledgers, completed sales, and inventory movements cannot be overwritten there; corrections remain compensating entries created in their source modules. See [the synchronization protocol](docs/sync-protocol.md).

## Sync status and troubleshooting

The global status control reports **Offline mode**, **Online**, **Pending changes**, **Syncing**, **Synced**, **Sync failed**, **Authentication required**, **Conflict detected**, or **Cloud unavailable**. Expand it to see the pending count, last successful synchronization, failed items and retry count, connectivity/push/pull times, pull cursor, device ID, and app version. **Retry sync** starts the same authenticated push-then-pull workflow used by automatic synchronization.

**Offline does not mean unsaved.** Business writes commit to IndexedDB on this device first. Supported cloud changes remain in the durable queue until acknowledged. Keep the browser storage intact and reconnect later.

If synchronization does not recover:

1. Expand the status control and read its user-facing message.
2. Confirm internet access and that the account still has access to the selected store.
3. Choose **Retry sync**. Authentication-required states need an online sign-in.
4. If a conflict is reported, an administrator must review **Conflicts**.
5. Export a backup before clearing browser data; reset now reports how many pending changes would be deleted.

Initial account linking shows its persisted stage and table-step progress. Closing the application does not erase completed migration steps.
## Multi-device, Realtime, and device management

Online devices subscribe to store-scoped Supabase Realtime database-change notifications for synchronized tables. Notifications are debounced for 750 ms and only trigger the normal authenticated synchronization engine; event payloads never replace IndexedDB records directly. The incremental pull RPC remains authoritative, and the existing 60-second interval recovers notifications missed while sleeping, disconnected, or unsubscribed.

Each verified browser registration records a stable device ID, browser/platform name, registration time, last activity, last successful sync, and revocation time. Store owners can review, revoke, and restore devices under **Settings -> Store devices**. Revocation blocks future cloud writes through existing device-aware RLS/RPC checks. Only an authenticated store owner can restore the preserved registration; the revoked device cannot restore itself.

Revocation cannot erase local IndexedDB or immediately stop an already-offline browser. That device learns of revocation only when it reconnects; physical/browser-profile access must be handled separately. See [device management](docs/device-management.md).
## GitHub Pages deployment

Local development uses `/`; GitHub Actions builds use `/tindahan-manager/`; `VITE_DEPLOY_BASE` can override the base for a custom domain. React uses `HashRouter`, and the workflow deploys `dist`.

Configure the two Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, select GitHub Actions as the Pages source, and configure the corresponding Supabase redirect allowlist. See [deployment.md](docs/deployment.md).

## PWA installation

Open the deployed HTTPS site, load it successfully once, then use the browser's **Install app** or **Add to Home Screen** action. The manifest and service-worker scope follow the active deployment base. Cached shell assets can relaunch offline; Supabase calls are not runtime-cached. When an update waits, choose **Update** to activate it or **Later** to keep the current build for the session.

## Installation and checks

```bash
git clone https://github.com/gwada0409/tindahan-manager.git
cd tindahan-manager
npm ci --legacy-peer-deps
npm run dev
```

| Command | Purpose | Phase 18 status |
|---|---|---|
| `npm test` | Vitest suite | Passes: 36 files, 127 tests |
| `npm run build` | Type-check, production build, PWA output | Passes; 2,867 modules and 10 PWA precache entries |
| `npm run lint` | ESLint | Blocked: ESLint 9 flat config is absent |
| `npm run preview` | Preview production build | Available |

Automated coverage includes authentication, schema/RLS and sync-RPC contracts, Dexie migrations, durable queue behavior, push failures/idempotency, incremental pagination, dependency ordering, cursor rollback, tombstones, duplicates, and cloud-origin bypass. The production Supabase project has been verified for the Phase 20 device/Realtime repair; disposable-database pgTAP checks remain a deployment check.

## Performance and free-tier operation

Synchronization is cursor-based and paginated; normal runs request only records after the saved `(server_changed_at, id)` cursor. Uploads are batched, retries use exponential backoff, and identical mutable updates are discarded locally instead of creating a new version or queue item.

The browser checks locally once per minute but does not contact Supabase while hidden or recently synchronized with an empty queue. Pending work triggers synchronization; otherwise the periodic missed-event recovery becomes eligible after 15 minutes. Realtime events remain debounced invalidation hints.

Confirmed local queue entries are deleted only after server acknowledgement. Failed entries and diagnostics remain. At most once per running app instance per day, the client may request bounded cleanup of at most 1,000 server operation receipts older than 30 days; the RPC permits only 7–365 day retention values and validates active membership. Queue warnings appear at 100 pending items or 10 failed items.

No product-image feature is implemented, and images/base64 blobs are not stored in PostgreSQL. If file uploads are added, use private Supabase Storage objects plus references in business rows. Backups at least 1 MB are downloaded as gzip when the browser supports CompressionStream; smaller or unsupported cases remain portable JSON.

Monitor database/storage size, egress, Realtime messages, active users, queue growth, and sync failures in the Supabase dashboard and the application sync diagnostics. Exact free-tier quotas are plan-specific and should be checked before deployment. See [performance and free-tier guidance](docs/performance-and-free-tier.md).
## Backup and recovery

Settings exports every Dexie table in a schema-v7 envelope containing application version, store/device identity, export time, per-table counts, and a SHA-256 checksum. Restore validates the complete table set, metadata, counts, primary keys, dates, and checksum before any write; a confirmed restore replaces all tables in one transaction and retains the prior database as an IndexedDB recovery point. Reset downloads a fresh checksummed pre-reset file before deleting local storage. A backup file can restore a new device without relying on complete cloud-history coverage. See the [recovery guide](docs/recovery-guide.md).

## Project structure

```text
src/
  components/       shared UI, layout, and PWA status
  db/               versioned Dexie schema and migrations
  domain/sync/      sync envelopes plus queue/state/conflict contracts
  features/auth/    authentication service, backend adapter, cache, state, guards
  features/migration/ account-linking inventory, backup, resume, and validation
  features/sales/   atomic checkout and immutable compensation services
  features/inventory/ movement ledger, cached quantities, and reconciliation
  features/         business services and feature components
  lib/              optional Supabase browser client
  pages/            route-level screens
  repositories/     metadata-aware local data access
  services/device/  persistent browser identity
  services/sync/    durable queue retry and crash-recovery logic
supabase/migrations/ ordered ownership and business-schema SQL
supabase/tests/      disposable pgTAP RLS verification
docs/                audit, deployment, and phase records
```

## Documentation

- [Phase 21 inventory/sales synchronization and device restoration](docs/phase-21-inventory-sales-restore.md)
- [Phase 20 sync device repair](docs/phase-20-sync-device-repair.md)
- [Phase 18 performance/free-tier record](docs/phase-18-performance-free-tier.md)
- [Performance and free-tier guidance](docs/performance-and-free-tier.md)
- [Phase 17 backup and disaster-recovery record](docs/phase-17-backup-recovery.md)
- [Backup, restore, and recovery guide](docs/recovery-guide.md)
- [Phase 16 Realtime and device-management record](docs/phase-16-realtime-devices.md)
- [Device management and revocation](docs/device-management.md)
- [Phase 15 sync-status UI record](docs/phase-15-sync-status-ui.md)
- [Sync statuses and troubleshooting](docs/sync-status.md)
- [Phase 14 conflict-resolution record](docs/phase-14-conflict-resolution.md)
- [Conflict resolution and administrator responsibilities](docs/conflict-resolution.md)
- [Phase 13 financial synchronization record](docs/phase-13-financial-sync.md)
- [Financial synchronization](docs/financial-synchronization.md)
- [Phase 12 inventory synchronization record](docs/phase-12-inventory-sync.md)
- [Inventory ledger and reconciliation](docs/inventory-reconciliation.md)
- [Phase 11 sales synchronization record](docs/phase-11-sales-sync.md)
- [Sales synchronization and compensation](docs/sales-synchronization.md)
- [Phase 10 account-linking record](docs/phase-10-account-linking.md)
- [Initial migration guide](docs/migration-guide.md)
- [Phase 9 pull synchronization record](docs/phase-9-pull-sync.md)
- [Phase 8 push synchronization record](docs/phase-8-push-sync.md)
- [Phase 7 durable queue record](docs/phase-7-durable-sync-queue.md)
- [Synchronization protocol](docs/sync-protocol.md)
- [Phase 6 cloud schema and RLS record](docs/phase-6-cloud-schema-rls.md)
- [Cloud database schema](docs/database-schema.md)
- [Security model and role matrix](docs/security-model.md)
- [Phase 5 authentication and store ownership](docs/phase-5-authentication.md)
- [Deployment, environment, migrations, redirects, and Pages](docs/deployment.md)
- [Offline-first audit and cumulative refactor record](docs/offline-sync-refactor.md)
- [Phase 4 routing and PWA lifecycle](docs/phase-4-routing-pwa.md)
- [Phase 1 data foundation](docs/phase-1-data-foundation.md)

## Troubleshooting

- **Supabase sign-in is disabled:** configure both public environment values, restart Vite, apply all migrations in order, and verify Auth redirect URLs.
- **Account-linking wizard appears:** review counts, select the correct cloud-store workflow, keep the browser open, and do not clear site data. A local backup is created before migration.
- **Changes remain pending:** confirm an online session, apply all migrations, verify store/device membership, choose **Sync now**, and inspect only redacted browser sync status/logs.
- **Recovery/confirmation returns to the wrong location:** confirm the Site URL, local/Pages allowlist, and active `VITE_DEPLOY_BASE`.
- **ESLint cannot start:** the repository still needs an ESLint 9 `eslint.config.*` flat configuration.
- **Local data appears missing:** IndexedDB is origin/browser-profile scoped; check the exact origin and browser profile.
- **Camera scanning fails:** use HTTPS or localhost and grant camera access.
- **A rollback build cannot open the database:** retain the IndexedDB v5 declarations and queued operations; use a forward repair rather than downgrading the schema.

## Known business limitations

- Pre-Phase-11 sales remain local because missing stock-allocation history is not inferred
- Legacy batches without a cloud baseline cannot upload dependent movements until explicitly baselined or restocked
- Compensation services exist, but the Sales history/void/refund UI is not implemented
- No hardened backup/restore format
- No Services, supplier, or notes management UI
- Expenses and supplier payments are not implemented or synchronized
- No sale void/refund/reversal workflow
- No customer credit-limit enforcement
- GCash and discounted-cash checkout defects recorded in the audit remain
- Sale stock movements are missing
- TypeScript strict mode is not enabled
- ESLint flat configuration is missing
- Dependency audit findings remain unresolved
- The main production bundle exceeds Vite's 500 kB warning threshold

## Security reporting

Do not include credentials, customer records, backups, or exploit details in a public issue. Report a suspected vulnerability privately to the repository owner through GitHub's private vulnerability-reporting channel when enabled; otherwise request a private contact channel without publishing sensitive evidence.

## Contributing

Preserve `TindahanDB`, existing records, UUIDs, and local-first behavior. Use additive tested migrations, route business writes through services/repositories, keep privileged credentials out of browser code, run tests/build, and document only behavior that exists.

## License

No license file is present. The repository owner must add one before others should assume permission to copy, modify, or redistribute the project.