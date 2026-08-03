# Phase 14 — Conflict detection and administrator review

Status: completed locally on 2026-08-01

## Delivered

- Extended durable `syncConflicts` records with base/local/server versions, complete local/cloud payloads, editor, device, timestamp, and resolution audit metadata.
- Added a pre-pull conflict check. A pending mutable local edit with a different cloud version is preserved, marked `conflict`, recorded durably, and blocks cursor advancement.
- Added an administrator-only **Conflicts** route showing base, this-device, and cloud information.
- Added explicit **Keep this device** and **Keep cloud** resolution transactions for categories, suppliers, products, customers, bills, and employees.
- Local selection rebases the record and returns its queued operation to pending; cloud selection removes obsolete queued edits.
- Every completed choice creates a local audit-log record atomically with the resolution.
- The generic resolver rejects overwriting completed sales, inventory movements, and financial ledgers.

## Deliberate limits

The browser does not currently retain a full common-base snapshot for ordinary records, so automatic field merge is shown but disabled instead of inferring a potentially unsafe merge. Notes and services are not cloud-synchronized, so preserve-both is not exposed. Financial correction creation remains in each source module; the conflict page explains this and cannot manufacture a generic ledger adjustment.

Push version errors remain queued and are surfaced by synchronization status. The following incremental pull obtains the cloud record and creates the complete review item.

## Data safety

No Dexie version or cloud schema migration was needed: `syncConflicts` already exists and accepts additive non-indexed fields. Existing rows, queues, ledgers, backups, and pull cursors are preserved. Conflict capture occurs before the page transaction so the conflict survives the intentional page rollback.

## Verification

- TypeScript project build: passed.
- Vitest: 31 files and 103 tests passed, including durable pull conflict capture, explicit cloud resolution, queue cleanup, audit logging, and protected-ledger rejection.
- Production/PWA build: passed (2,864 modules; 10 precache entries).
- ESLint: unavailable because the repository has no ESLint 9 flat configuration.
- Diff whitespace and credential-pattern checks: passed.