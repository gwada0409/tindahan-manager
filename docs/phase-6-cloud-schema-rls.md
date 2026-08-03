# Phase 6: Cloud database and Row Level Security

Status: Completed in source control; live Supabase execution remains a deployment verification item  
Date: 2026-07-31

## Completed scope

Phase 6 adds the store-scoped PostgreSQL schema for implemented business entities, RLS on every business table, role/device validation, restrictive relationships, operation-ID constraints, database indexes, generated-compatible TypeScript types, structural migration tests, and a disposable pgTAP RLS test.

The migration extends Phase 5 ownership and does not change Dexie. No existing local row is uploaded, relabeled, deleted, or overwritten.

## Intentional exclusions

- Services and Notes: tables exist locally, but their management pages are not implemented.
- Expenses: no local entity or workflow exists.
- Cloud synchronization: no outbox, push/pull engine, or cursor exists.
- Server transaction RPCs: exactly-once sale/inventory/financial processing is later work.
- Device-management UI: planned for a later phase.

`suppliers` is included because existing products and batches already carry supplier relationships.

## Migration

New migration:

```text
supabase/migrations/202607310002_phase6_business_schema_rls.sql
```

It must run after:

```text
supabase/migrations/202607310001_phase5_auth_ownership.sql
```

The migration adds 16 business/infrastructure tables and extends `stores` with implemented local settings. It also tightens store/member update policies established in Phase 5.

## Security decisions

- Every row has a required store.
- Every write binds `updated_by` to `auth.uid()`.
- Every write requires an active permitted role and unrevoked registered device.
- Composite foreign keys enforce same-store relationships.
- Business relationships use `ON DELETE RESTRICT`.
- Mutable master data uses soft deletion; deletion-state changes require manager role.
- Financial and event rows have select/insert only for authenticated clients.
- Operation IDs are unique within transaction tables and globally in `sync_operations`.

## Compatibility

Local role behavior is retained:

- owner/administrator → admin;
- cashier/staff → employee.

Cashier/staff can perform the business writes currently exposed to employees. Employee, payroll, vault, and store-setting writes remain manager-only.

## Tests

Added six Vitest schema-contract tests and a four-assertion transactional pgTAP script. The latter requires a disposable local Supabase instance and rolls back all fixtures.

The workspace had no Supabase CLI, PostgreSQL client, or Docker runtime, so the migration could not be executed against PostgreSQL during this phase. Documentation does not claim remote application or live RLS verification.

## Rollback

Before real data exists, reset a disposable Supabase database and reapply migrations through the desired version. After real data exists, do not drop these tables as a routine rollback. Stop deployment/synchronization clients and use a reviewed forward migration.

Frontend rollback must retain Dexie v4. Phase 6 does not require a local-data rollback.
## Verification results

- TypeScript: passed.
- Vitest: passed 17 files and 53 tests.
- Production PWA build: passed with 10 precache entries.
- ESLint: blocked by the pre-existing missing ESLint 9 flat configuration.
- PostgreSQL/pgTAP execution: not run because no local Supabase/PostgreSQL runtime is installed.
- Existing main-bundle size warning remains.