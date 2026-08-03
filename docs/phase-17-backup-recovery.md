# Phase 17 — Backup and disaster recovery

Status: completed locally on 2026-08-03

## Delivered

- Replaced loose table-map exports with a versioned backup envelope containing schema/application version, store ID, device ID, export timestamp, per-table record counts, and SHA-256 checksum.
- Exports every current Dexie table, including synchronization, conflicts, migration state, and recovery records.
- Validates file identity, exact schema version, metadata, known/complete tables, counts, primary keys, known date fields, and checksum before writes begin.
- Shows a restore preview and explicit replacement confirmation.
- Restores all tables inside one Dexie transaction and rehydrates domain date values.
- Captures the active database as an IndexedDB recovery point immediately before a valid restore.
- Downloads a fresh checksummed backup before local reset.
- Retains the existing automatic account-linking/full-cloud-download snapshot.
- Enables complete new-device restoration from an exported backup file; cloud-only reconstruction remains limited to entities supported by pull.

## Deliberate limits

Existing Dexie upgrades are additive and tested as non-destructive, but browsers cannot automatically download an off-device file from inside a version-upgrade transaction. Recovery points stored only in IndexedDB do not protect against browser storage clearing or device loss; users must keep exported files elsewhere. Backup files are integrity-checked but not encrypted, so they must be stored securely.

## Verification

Focused tests cover metadata/checksum export, damaged-file rejection without active-data changes, complete transactional replacement, date rehydration, pre-restore recovery retention, and incomplete-table rejection.

- TypeScript: passed.
- Vitest: 34 files and 120 tests passed.
- Production/PWA build: passed (2,867 modules; 10 precache entries).
- ESLint: unavailable because the repository has no ESLint 9 flat configuration.
- Diff whitespace and credential-value review: passed.