# Phase 13 — Other financial modules

Status: completed in source control
Date: 2026-08-01

Phase 13 adds durable push and incremental pull for the financial modules that exist locally: Utang entries, GCash transactions, bills, employees and payroll, and vault transactions. Expenses and supplier payments are not implemented and are not advertised.

Utang, GCash, payroll, and vault rows are immutable ledger entries with UUID operation receipts. Duplicate retries return the existing receipt. Bills and employees remain versioned mutable records because their existing workflows update status or profile fields. Local writes and queue operations commit together through the repository layer.

Balances continue to be derived from ledger sums rather than synchronized as standalone values. Cloud writes validate authenticated membership, actor, and registered device. Payroll depends on the employee record synchronizing first.

No Dexie migration is required and existing local rows are unchanged. Historical records created before Phase 13 remain local unless explicitly migrated; the phase does not silently invent operation receipts.
## Verification

- TypeScript: passed.
- Full Vitest suite: 30 files, 101 tests passed.
- Production/PWA build: passed with 10 precache entries.
- ESLint cannot run without an ESLint 9 flat configuration.
- Live PostgreSQL/RLS verification was unavailable.
- The existing main-bundle size warning remains.