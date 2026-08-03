# Offline-first and multi-device refactor record

Status: Phase 10 initial account linking completed in source control  
Audit date: 2026-07-31  
Phase 1 completion date: 2026-07-31  
Phase 2 completion date: 2026-07-31  
Phase 3 completion date: 2026-07-31  
Phase 4 completion date: 2026-07-31  
Phase 5 completion date: 2026-07-31  
Phase 6 completion date: 2026-07-31  
Phase 7 completion date: 2026-07-31  
Phase 8 completion date: 2026-07-31  
Phase 9 completion date: 2026-07-31  
Phase 10 completion date: 2026-08-01  
Repository: `gwada0409/tindahan-manager`  
Audited branch: `main`  
Phase 0 baseline commit: `c1fe671`


## Phase 10 implementation update

Dexie v6 adds persistent pre-migration backups and resumable account-linking state. The explicit wizard inventories local/cloud records, shows create/merge/download paths, detects likely duplicates, normalizes supported UUID relationships, drains supported queues, and validates counts/totals. See [the migration guide](migration-guide.md).

## Phase 9 implementation update

The sync engine now pulls supported master data incrementally after push using a server-owned composite cursor. Pages, tombstones, and cursor updates apply transactionally without requeueing. Missing parents or pending local edits preserve the old cursor. See [the Phase 9 record](phase-9-pull-sync.md).

## Phase 8 implementation update

Authenticated, idempotent push now processes the four Phase 7 entity types through a validated Supabase RPC. Confirmed operations are removed; failures remain queued. Automatic and manual triggers are non-blocking. Pull and conflicts remain future work. See [the Phase 8 record](phase-8-push-sync.md).

## Phase 7 implementation update

Dexie v5 additively introduces `syncQueue`, `syncState`, and `syncConflicts`. Product, category, customer, and supplier repository mutations store the changed record and unique operation receipt in one transaction. Cloud-originated bulk upserts bypass the queue. Persisted retry deadlines use exponential backoff, and stale processing operations can be recovered after interruption.

Phase 7 does not start a worker or communicate business data to Supabase. See [the Phase 7 record](phase-7-durable-sync-queue.md) and [sync protocol](sync-protocol.md).
## Phase 6 implementation update

The additive Phase 6 migration creates store-scoped cloud tables for the implemented catalog, inventory, customer/utang, sales, GCash, bills, employee/payroll, vault, supplier, audit, and future operation-receipt models. Services, Notes, and Expenses are excluded because their application workflows are not implemented.

Every business table requires UUID/store/timestamp/version/actor/device metadata and enables RLS. Active membership controls reads; role plus unrevoked device controls writes. Composite foreign keys block cross-store relationships, material deletions are restrictive, manager triggers protect soft deletion, and authenticated transaction/event access is append-only. Store ownership and membership hierarchy policies are tightened.

No Dexie schema or local record changed. The application still does not synchronize business data. Structural Vitest coverage and a disposable pgTAP RLS script were added, but no local Supabase/PostgreSQL runtime was available to execute the migration. See [the Phase 6 record](phase-6-cloud-schema-rls.md), [database schema](database-schema.md), and [security model](security-model.md).

## Phase 5 implementation update

Supabase Auth now handles production sign-up, sign-in, session verification/restoration, sign-out, email-confirmation redirects, and password recovery. Active cloud memberships select the store and register a per-account browser device. Accounts with multiple active memberships receive a store-selection screen. Owner/administrator map to the existing admin permission set; cashier/staff map to employee.

A minimal device-bound verified identity permits an explicit offline reopen only after prior online verification on that browser. Legacy hard-coded passwords and the unsigned production session are removed; password-free quick access remains development-only. Sign-out warns about pending local metadata and preserves all Dexie business data.

The additive Supabase migration creates RLS-protected `stores`, `store_members`, and `devices` plus the owner-store RPC. No Dexie version or business record changed, and cloud business schema/synchronization remain Phase 6 work. See [the Phase 5 record](phase-5-authentication.md).

## Phase 4 implementation update

The application retains `HashRouter` for GitHub Pages-safe URLs, and all favicon, manifest, icon, worker, start URL, and scope paths now follow the resolved deployment base. Workbox precaches only the static shell, cleans outdated caches, and supplies the cached entry document for in-scope navigation; it has no Supabase or other API runtime cache.

The app now reports offline readiness and offers user-controlled **Update** and **Later** actions when a changed service worker waits. Pages-subpath routing, refresh, history, protected-route redirect, offline reload and start URL, and changed-worker activation were browser-verified. Supabase Auth callbacks and password-reset routes remain unimplemented. See [the Phase 4 record](phase-4-routing-pwa.md).
## Phase 3 implementation update

The deployment workflow now separates build and deploy jobs, uses Node.js 22 and lockfile installation, runs tests, validates and injects the two public Supabase repository secrets, configures Pages, uploads `dist`, and deploys with job-scoped permissions. Lint remains non-blocking because the existing ESLint 9 flat configuration is still absent.

Vite uses `/` locally, `/tindahan-manager/` during GitHub Actions repository builds, and an optional `VITE_DEPLOY_BASE` override for a future custom domain. Phase 4 retained HashRouter and completed the base-aware PWA configuration. External Pages settings and repository secrets must still be configured by the repository owner before the workflow can publish. See [deployment.md](deployment.md), [the Phase 3 record](phase-3-github-pages.md), and [the Phase 4 record](phase-4-routing-pwa.md).

## Phase 2 implementation update

The application now has typed public environment declarations and an optional Supabase browser client. Configuration prefers `VITE_SUPABASE_PUBLISHABLE_KEY`, temporarily accepts `VITE_SUPABASE_ANON_KEY`, and reports a safe setup message when public values are absent without blocking local operation. Local environment files are ignored, `.env.example` contains empty public placeholders only, and no local `.env` was tracked during implementation.

No application feature calls Supabase yet. Authentication, memberships, cloud schema, Row Level Security, workflow secret injection, and synchronization remain unimplemented. See [deployment.md](deployment.md) and [the Phase 2 record](phase-2-supabase-configuration.md).

## Phase 1 implementation update

The application now uses `TindahanDB` schema version 4. The additive upgrade backfills a nested sync envelope across all existing entity tables while preserving primary keys and business fields. New repository-managed records use UUIDs, UTC sync timestamps, a persistent browser/device identifier, local versions, pending status, and soft-deletion fields.

Active business writes for products, customers, utang, bills, employees, payroll, GCash, vault, local accounts, checkout, restocking, store settings, and audit events now create or update metadata through repositories or transaction-owned helpers. Product removal in Inventory is an archive operation, and active repositories/services hide archived rows by default.

This phase does not implement Supabase, remote synchronization, an outbox, authentication replacement, memberships, cloud device management, or conflict resolution. See [Phase 1: local data and repository foundation](phase-1-data-foundation.md) for the implemented contract and migration behavior.

## Phase 0 baseline record (historical)

The sections below retain the pre-refactor audit as a historical v3 snapshot. Statements using “current” in that retained baseline describe the state at Phase 0, not the Phase 1 implementation.

## Executive summary

Tindahan Manager is currently a single-browser, local-first React PWA. React components and feature services read and write a Dexie database named `TindahanDB`. The production build is configured for GitHub Pages at `/tindahan-manager/`, uses hash routing, and generates a service worker with Workbox.

The application is usable without a cloud account after its static assets have been cached. It does **not** currently provide Supabase authentication, store ownership, cloud backup, multi-device synchronization, device registration, conflict resolution, or Row Level Security. The installed Supabase package and `.env.example` do not constitute an integration; no Supabase client exists in `src/`.

The immediate safety concerns for future phases are:

- local authentication uses hard-coded demo passwords and a forgeable `localStorage` session;
- `userProfiles` contain roles but no real credential records or server-side authorization;
- several pages still call Dexie directly;
- completed checkout updates batches but does not create sale stock movements;
- the GCash checkout path always fails its non-utang payment validation, and cart discounts are not persisted;
- checkout does not enforce customer credit limits despite the earlier README claim;
- product deletion is a hard delete and can orphan history;
- backup import is unversioned, unvalidated, additive, and may restore dates as strings;
- the database has no store/user/device ownership fields or sync metadata;
- [Resolved in Phase 4] PWA icon, manifest, worker, start URL, and scope paths now follow the deployment base;
- the production JavaScript bundle is about 1.05 MB minified and triggers Vite's chunk warning;
- ESLint 9 is installed but no `eslint.config.*` exists, so the lint script fails before analyzing source.
- application TypeScript is not configured with `strict: true`, and several production modules use `any`.
- a fresh npm install reports 20 dependency vulnerabilities (2 moderate, 17 high, 1 critical).

## Current architecture

```text
React pages and components
    |  useLiveQuery, handlers, Zustand cart
    v
Feature services and partial repositories
    |  direct Dexie calls still exist in UI code
    v
Dexie 4 / IndexedDB: TindahanDB (schema version 3)
    |
    +-- JSON export/import in Settings
    +-- no cloud adapter
    +-- no durable sync queue
```

### Entry point and providers

- `src/main.tsx` renders the application and invokes development demo seeding in the background.
- `src/App.tsx` provides `ToastProvider`, `HashRouter`, authentication guards, and permission guards.
- `src/components/layout/AppLayout.tsx` renders desktop/mobile navigation from the permission-aware route list and applies branding.
- `src/features/settings/BrandingProvider.tsx` reads store settings reactively and writes theme CSS variables/document title.

### Routes and pages

| Route | Page | Current state |
|---|---|---|
| `/login` | Login | Local development credentials and quick-login buttons |
| `/` | Dashboard | Local sales, debt, stock, expiration, and recent-sale summaries |
| `/sales` | Sales | Product search, barcode scanning, cart, cash/GCash/utang checkout |
| `/inventory` | Inventory | Product CRUD, stock indicators, filters, sorting, and restock flow |
| `/services` | Inline placeholder | "Services & Repairs coming soon"; no service management UI |
| `/utang` | Utang | Customer creation, balances, ledger view, and payments |
| `/gcash` | GCash | Float/fee summaries and cash-in/cash-out entries |
| `/bills` | Bills | Add, list, and mark bills paid |
| `/employees` | Employees | Employee creation, payroll, and local profile administration |
| `/vault` | Vault | Deposit/withdrawal ledger and balance |
| `/reports` | Reports | Seven-day sales/profit chart and inventory/debt summaries |
| `/settings` | Settings | Branding, store details, JSON export/import, and database reset |

### State management

- Zustand stores authentication/session state and the current cart.
- Dexie `useLiveQuery` drives reactive local data views.
- Local component state manages forms, filters, modals, and selection.
- The cart is in memory only and is not durable across refresh/restart.
- The auth session is serialized to `localStorage` under `tindahan_auth_session`.

### Data-access boundaries

The codebase has started moving logic into feature services, but the boundary is incomplete:

- `checkout.service.ts` owns the main multi-table checkout transaction.
- inventory, stock, dashboard, bills, GCash, reports, employees, utang, vault, and settings have focused services/repositories.
- `BaseRepository` and `ProductRepository` remain generic/partial; `getLowStockProducts()` is placeholder logic.
- direct Dexie calls remain in Dashboard, Sales, Inventory, Utang, Employees, layout/branding, Login, and `RestockModal`.
- repositories do not yet provide soft deletion, sync metadata, store scoping, or bulk cloud upserts.

### Non-runtime repository content

The repository also tracks duplicated editor/agent skill catalogs under several hidden directories, a `.pnpm-store/v11/index.db` file, generated `dev-dist/` PWA output, and the design-system reference. These are not imported by the application runtime. Phase 0 leaves them untouched, but later repository-hygiene work should decide deliberately which generated/cache/tooling files belong in source control.

## Current local data model

Database name: `TindahanDB`  
Current Dexie version: 5  
Primary key convention: every table uses the string `id` as its primary key.

### Schema history

- Version 1 introduced the original 18 local tables.
- Version 2 added indexes and compound indexes; it does not transform record shapes.
- Version 3 added `userProfiles` and fills missing branding defaults on existing store settings.

The V2 migration function accepts a transaction but performs no record transformation. The V3 migration updates existing store-setting rows in the upgrade transaction.

### Tables, indexes, and relationships

| Table | Important indexes | Relationships/purpose |
|---|---|---|
| `storeSettings` | `id` | Store profile, behavior, application name, and theme |
| `categories` | `name` | Referenced by products/services through `categoryId` |
| `products` | `categoryId`, `supplierId`, `sku`, `barcode`, `name` | Product master data |
| `inventoryBatches` | `productId`, `expirationDate`, `restockDate`, `remainingQuantity`, `[productId+expirationDate]` | Physical stock batches; references products and optionally suppliers |
| `stockMovements` | `productId`, `batchId`, `date`, `type`, `[productId+date]`, `[type+date]` | Restock/adjustment/damage/expiry/return/sale audit entries |
| `services` | `categoryId`, `name` | Service catalog; no implemented page |
| `customers` | `fullName`, `phoneNumber` | Referenced by utang, sales, and GCash records |
| `utangEntries` | `customerId`, `date`, `type`, `[customerId+date]` | Charge/payment/adjustment ledger |
| `sales` | `date`, `status`, `customerId`, `paymentMethod`, `[status+date]`, `[customerId+date]` | Completed/voided sale header |
| `saleItems` | `saleId`, `itemId`, `itemType`, `[saleId+itemId]` | Historical line-item snapshots |
| `gcashTransactions` | `date`, `type`, `customerId`, `[type+date]` | GCash float and fee ledger |
| `bills` | `dueDate`, `status`, `category`, `[status+dueDate]` | Payable records |
| `employees` | `name`, `role` | Employment/pay configuration |
| `payrollEntries` | `employeeId`, `payPeriodStart`, `[employeeId+payPeriodStart]` | Payroll history |
| `vaultTransactions` | `date`, `type`, `[type+date]` | Cash-vault ledger |
| `suppliers` | `name` | Supplier master data; no implemented page |
| `notes` | `isPinned`, `createdAt` | Notes; no implemented page |
| `auditLogs` | `date`, `entityType`, `entityId`, `[entityType+entityId]`, `[entityType+date]` | Selected authentication/account/restock audit events |
| `userProfiles` | unique `authUserId`, `employeeId`, `role`, `active` | Local display identity and RBAC role |

IndexedDB does not enforce foreign keys. Referential integrity currently depends on application code.

## Entity lifecycle map

| Entity | Create | Query | Update | Delete/import/export notes |
|---|---|---|---|---|
| Store settings | Development seed | Layout, Login, Branding, Settings, checkout | Settings and Appearance | Included in generic JSON backup; reset deletes database |
| Categories | Development seed | No active management UI | None | Backup/import only |
| Products | Seed and Inventory via `ProductRepository` | Inventory, Sales, Dashboard, Reports | Inventory via repository | Hard-deleted from Inventory; no history protection |
| Inventory batches | Restock modal | Inventory, Sales, Dashboard, Reports, checkout | Checkout deducts `remainingQuantity` | No normal delete; backup/import only |
| Stock movements | Restock modal only | No current user-facing reconciliation | None | Checkout currently does not write sale movements |
| Services | No current UI | Services route is a placeholder | None | Backup/import only |
| Customers | Seed and Utang page | Sales and Utang | No implemented customer edit | Backup/import only |
| Utang entries | Checkout charge and Utang payment | Dashboard, Utang, Reports | Immutable in current UI | Backup/import only |
| Sales | Checkout service | Dashboard and Reports | No void/refund implementation | Backup/import only |
| Sale items | Checkout service | Reports | None | Historical snapshots retained |
| GCash transactions | GCash service; checkout intends to add sale entries | GCash | None | Ledger summed in memory; current GCash checkout fails before insertion |
| Bills | Bills service | Bills | Mark paid | No delete UI |
| Employees | Employees service | Employees | No employee edit/deactivate flow | Backup/import only |
| Payroll entries | Employees service | No payroll-history view found | None | Backup/import only |
| Vault transactions | Vault service | Vault | None | Ledger summed in memory |
| Suppliers | No current UI | No active query flow | None | Backup/import only |
| Notes | No current UI | No active query flow | None | Backup/import only |
| Audit logs | Auth/account/restock flows | No audit-log UI | None | Generic backup/import |
| User profiles | Auth default setup and Employees accounts | Auth/Employees | Role and active state | No real credential/password linkage |

## Transaction-sensitive flows

### Checkout

`CheckoutService.processCheckout()` runs a Dexie transaction across sales, sale items, batches, products, customers, utang entries, GCash transactions, and store settings. It validates basic input, applies FEFO/FIFO batch deduction, inserts sale items and a sale header, and optionally inserts an utang charge or GCash entry.

Observed limitations:

- no stock movement is inserted for a sale;
- no operation/idempotency key exists;
- sale items do not record allocated batch IDs;
- the customer credit limit/current balance are not enforced;
- cart discounts are shown in the UI but are not included in the checkout request or persisted totals; discounted cash checkout therefore fails payment validation;
- GCash checkout passes `amountPaid: 0`, so the checkout service rejects every GCash sale as insufficient payment;
- service items are treated as products and require product batches;
- negative inventory with no batches can report success without a negative batch/movement;
- no completed-sale void/refund/reversal flow exists.

### Restock and financial modules

The restock modal atomically inserts a batch, positive movement, and audit log, but the transaction lives inside a React component. Utang payments are direct negative ledger entries. GCash/vault entries are append-only through services. Payroll creates only a payroll row, and marking a bill paid mutates the bill without a separate payment ledger entry. There is no standalone expense entity/UI and no supplier-payment flow. None of these records has a store/device context or operation ID.

## Authentication and authorization baseline

Authentication is a development simulation, not Supabase Auth:

- default profiles and hard-coded passwords ship in frontend code;
- quick-login buttons expose the credentials;
- dynamic profiles can be matched by display-name substring without password verification;
- a session object is trusted from `localStorage` without a signature/server check;
- route/navigation checks improve UX but are not a security boundary;
- account creation creates only a local profile;
- password change/reset is not implemented.

The centralized permission matrix is a useful foundation, but future authorization must be enforced with authenticated store membership and Supabase RLS/RPC policies.

## Backup and restore baseline

Settings exports every Dexie table into one JSON object. Import `bulkPut`s rows from recognized table names in one transaction. There is no version/checksum/validation/staging/pre-import backup; imports merge with current data; `Date` values become strings and are not rehydrated; the full database is loaded into memory; reset deletes the database without requiring a backup.

## Supabase and environment baseline

- `@supabase/supabase-js` is installed but unused.
- No Supabase client, adapter, SQL migration, Edge Function, RLS policy, or Supabase test exists.
- `.env.example` contains empty URL and legacy anon-key placeholders.
- No real `.env` is present or tracked.
- `.gitignore` ignores `*.local` files but does not ignore plain `.env`; Phase 0 records the risk without changing environment handling ahead of the dedicated configuration phase.

Credential-pattern scan of tracked files (values were not printed): no matches for privileged Supabase keys, PostgreSQL URLs, service-role markers, or Supabase project URLs. The broad `eyJ` pattern matched one npm integrity value in `package-lock.json`; inspection of the redacted property context confirmed it was package metadata, not a JWT credential.

## PWA, routing, and deployment status

- Vite uses `/` locally, `/tindahan-manager/` for repository Pages builds, and an explicit base override for a custom domain; React uses `HashRouter`.
- `vite-plugin-pwa` generates and registers a scoped Workbox service worker with static-shell precaching, outdated-cache cleanup, and navigation fallback.
- Manifest `id`, start URL, scope, favicon, Apple icon, and install icons follow the resolved deployment base.
- Offline-ready and waiting-update notifications exist. Network-connectivity and synchronization status do not.
- GitHub Actions installs with `npm install --legacy-peer-deps`, builds, and deploys `dist`; it does not run lint/tests or provide Supabase variables.

## Available scripts and validation baseline

| Script | Command | Phase 0 result |
|---|---|---|
| `dev` | `vite` | Started at `https://127.0.0.1:5173/tindahan-manager/`; HTTP 200 |
| `build` | `tsc -b && vite build` | Passed; PWA generated; bundle-size warning |
| `lint` | `eslint .` | Failed because ESLint 9 requires `eslint.config.*` |
| `test` | `vitest run` | Passed: 8 files, 25 tests |
| `test:watch` | `vitest` | Not run; interactive |
| `preview` | `vite preview` | Not run |

No separate `typecheck` script exists; direct `tsc -b` passed. The npm lockfile is version 3 and `package.json` does not pin a `packageManager` version.

The initial `npm ci --legacy-peer-deps` attempt failed before changing dependencies because npm was absent from `PATH`. The bundled pnpm 11.9.0 executable was then used only to bootstrap npm 11 and run the requested npm lockfile install. `npm ci --legacy-peer-deps` succeeded with bundled Node v24.14.0, adding 606 packages and auditing 607. npm reported 20 vulnerabilities (2 moderate, 17 high, 1 critical), deprecation warnings for `@types/uuid` and `glob`, and install-script policy warnings for esbuild and sharp. No automatic audit fix was applied.

Because npm was not exposed as a persistent shell command, validation used the installed CLIs through the bundled Node executable. Initial sandboxed Vitest/Vite attempts were blocked while esbuild read configuration outside the workspace boundary; identical read-only commands passed with the required sandbox elevation. These are execution-environment failures, not source failures.

Production output: 2,783 modules; main JS about 1,046 kB minified/309 kB gzip; CSS about 64 kB/12 kB gzip. Vite warned about chunks over 500 kB.

Tests now cover money/color/date/UUID helpers, stock calculation/allocation, local RBAC/final-admin protection, cash checkout, the v3-to-v4 migration, repository metadata behavior, Supabase configuration parsing, device identity, and the PWA notification component. Phase 4 browser checks cover Pages hash routing, refresh/history, protected-route redirect, offline relaunch, and worker activation. Backup/restore, GCash/utang checkout, credit limits, discounts, stock sale movements, void/refund, most ledgers, Auth callbacks, and future sync/RLS remain uncovered.

## README accuracy review

The previous README overstated Supabase readiness, credit-limit enforcement, service availability, and unconditional offline capability, and referenced an MIT `LICENSE` file that does not exist. Phase 0 corrects those claims and links to this audit.

## Target architecture and proposed cloud model

```text
React UI -> application services -> repositories -> Dexie/IndexedDB
    -> durable sync queue -> Supabase Auth/PostgreSQL/RPC/RLS -> other devices
```

UI code must continue using local repositories. No cloud schema is created in Phase 0. Later cloud design should include users/profiles, stores/memberships, devices, store-scoped UUID domain rows, immutable financial/inventory records, idempotency receipts, record versions/deletions, cursors, diagnostics, and membership-derived RLS.

## Refactoring and migration strategy

1. Establish domain/repository boundaries and safe Dexie migrations.
2. Configure public Supabase variables and Pages/PWA paths safely.
3. Create RLS-protected cloud schema and idempotent server operations.
4. Introduce Supabase Auth, membership, device identity, and an offline-session policy.
5. Add durable outbox/inbox, reachability checks, push/pull, cursors, and status.
6. Sync master data first, then sales, stock movements, and financial ledgers.
7. Add conflict UI, recovery, performance controls, security hardening, and release tests.

For Dexie: never rename/reset the database silently; add documented versions; preserve IDs/timestamps; migrate in upgrade transactions; test V1/V2/V3 fixtures; keep cloud availability optional; provide reconciliation/repair.

For Supabase: source-control SQL; enable RLS before real data; scope every row by store membership; use secure RPC/Edge Functions for privileged multi-row work; never expose privileged keys; make account linking staged, resumable, idempotent, and reversible until reconciled.

## Authentication strategy

Replace the demo adapter with Supabase Auth; separate auth identity, membership, employee, and profile; define offline re-entry only for previously trusted devices; never store plaintext passwords/PINs; disable quick login in production; treat local permissions as UX and validate sensitive actions server-side.

## Synchronization protocol

1. Establish local user/store/device context.
2. Verify session and actual Supabase reachability.
3. Recover abandoned operations.
4. Push pending operations using unique IDs.
5. Retain them until server confirmation.
6. Pull after the committed cursor.
7. Apply to Dexie transactionally and record conflicts.
8. Advance the cursor only after successful local application.
9. Update status and clean confirmed operations after retention.

Use exponential backoff with jitter; never rely only on `navigator.onLine`.

## Inventory and conflict strategy

Synchronize immutable signed stock movements, preserve batches for costing/FEFO, generate movements for every stock event, reject duplicate operation IDs, and reconcile movements/batches/sales/caches. Never overwrite final quantity between devices. Completed sales/financial entries use void/refund/reversal/adjustment rather than overwrite. Mutable master data uses version/base-version checks; unsafe merges become explicit conflicts.

## Deployment and PWA strategy

Retain tested Pages routing; make base-dependent asset/manifest/auth paths correct; use `npm ci`; run typecheck/lint/test/build in CI; expose only public Supabase frontend values. Test first install, offline relaunch, update activation, and subpath scope. Do not cache authenticated API responses without review. Show offline/sync state and warn before reset/sign-out with pending work.

## Backup, rollback, security, and testing

Backups need a versioned envelope, metadata, counts/checksum, typed validation, staging, automatic pre-migration copies, batching, and integrity reconciliation. Phase 0 rollback is simply reverting the documentation changes; no source, schema, configuration, workflow, or user data changed. Later Dexie rollback must be forward repair, not version decrement. Sync can be stopped without deleting operations/cursors.

The eventual security boundary is Supabase Auth plus RLS, membership checks, and secure RPC/Edge Functions. GitHub Pages/browser code is public. IndexedDB/local sessions are not protected from someone with device/browser access.

Testing should add migration fixtures, repository/transaction rollback, SQL RLS/idempotency, browser/PWA/auth callback, interrupted sync/cursor, reconciliation, backup, and multi-device conflict coverage.

## Known risks

| Risk | Current impact | Direction |
|---|---|---|
| Hard-coded auth/unsigned session | Local roles are forgeable | Supabase Auth + RLS; dev-only adapter |
| No store/sync metadata | Unsafe multi-tenant merge | Tested UUID/store/device/version migration |
| Missing sale movements | Stock cannot be fully reconstructed | Movement-authoritative inventory |
| Broken GCash/discounted checkout | GCash sales and discounted cash sales cannot complete correctly | Add regression tests before changing checkout semantics |
| Hard product deletion | Orphaned history | Archive/soft delete |
| Unsafe JSON restore | Corruption/mixed data/date errors | Version, validate, stage, back up, reconcile |
| Whole-table aggregation | Degrades with history | Indexed bounded queries/summaries |
| Root-relative PWA icons | Resolved in Phase 4 | Base-aware manifest and install assets implemented |
| Large bundle | Slower first load/update | Route splitting/dependency review |
| Dependency audit findings | Fresh install reports 20 vulnerabilities | Review direct/transitive paths; upgrade without blind force-fixes |
| Non-strict TypeScript/`any` usage | Weaker migration and sync guarantees | Incrementally enable strict typing at tested boundaries |
| Placeholder Services | User expectation mismatch | Keep documented as planned |
| No license file | Distribution terms unclear | Owner must add an explicit license |

## Phase 0 manual checks

1. With Node/npm on `PATH`, run `npm ci --legacy-peer-deps` from the committed lockfile.
2. Run `npm run dev`, accept the local certificate warning, and open `/tindahan-manager/`.
3. Verify development-only admin/employee navigation.
4. Use a disposable browser profile to test local product/restock/cash-sale persistence.
5. Verify that GCash checkout and discounted cash checkout reproduce the documented failures before fixing them in a later phase.
6. Re-run the Phase 4 PWA install, offline reload, and update smoke tests after each hosted deployment.
7. Do not import/reset a browser profile containing valuable data during baseline testing.


## Phase 11 completion update � 2026-08-01

New checkouts now commit the complete local sale and durable sale_transaction queue entry atomically. The server contract is idempotent by operation UUID and rejects incomplete or unreconciled sales. Dexie v7 adds immutable local sale adjustments; void/refund/reversal/adjustment services use compensating records instead of overwriting completed sales. Cloud stock-ledger ingestion was delivered in Phase 12; completed sale and sale-item pull is delivered in Phase 21.

## Phase 12 completion update � 2026-08-01

Inventory synchronization now uses immutable signed stock movements. Restock and movement operations are queued atomically, cloud retries are idempotent, pulled movement UUIDs merge without overwriting final quantities, and cached batch stock is updated by delta. Local and server reconciliation reports surface incomplete history and concurrent negative stock without deleting sales or movements.

## Phase 13 completion update � 2026-08-01

Existing Utang, GCash, bills, employee/payroll, and vault modules now create durable sync operations and participate in incremental pull. Immutable financial entries merge by UUID; bills and employees use versions. Expenses and supplier payments remain unsupported because no corresponding local modules exist.


## Phase 21 completion update - 2026-08-03

Account linking now queues existing batch inventory and completed product sales after master data, including labeled ledger reconciliation entries when legacy cached stock lacks complete movement history. Incremental pull now includes immutable sale headers followed by sale items. Device revocation remains enforced, while a separate authenticated owner-only RPC can restore the preserved registration.
