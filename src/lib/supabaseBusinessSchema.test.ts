import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/202607310002_phase6_business_schema_rls.sql',
);
const migration = readFileSync(migrationPath, 'utf8');

const businessTables = [
  'product_categories',
  'suppliers',
  'products',
  'inventory_batches',
  'stock_movements',
  'customers',
  'sales',
  'sale_items',
  'utang_entries',
  'gcash_transactions',
  'bills',
  'employees',
  'payroll_entries',
  'vault_transactions',
  'audit_logs',
  'sync_operations',
] as const;

const immutableTables = [
  'stock_movements',
  'sales',
  'sale_items',
  'utang_entries',
  'gcash_transactions',
  'payroll_entries',
  'vault_transactions',
  'audit_logs',
  'sync_operations',
] as const;

function tableDefinition(table: string): string {
  const match = migration.match(
    new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`),
  );
  if (!match) throw new Error(`Missing table definition for ${table}`);
  return match[1];
}

describe('Phase 6 cloud schema migration contract', () => {
  it('creates only the implemented business model and enables RLS on every table', () => {
    for (const table of businessTables) {
      expect(migration).toContain(`create table public.${table} (`);
      expect(migration).toContain(`alter table public.${table} enable row level security;`);
      expect(migration).toContain(`create policy ${table}_select_member`);
    }

    expect(migration).not.toContain('create table public.expenses');
    expect(migration).not.toContain('create table public.notes');
    expect(migration).not.toContain('create table public.services');
  });

  it('requires the common store, version, actor, device, and timestamp metadata', () => {
    for (const table of businessTables) {
      const definition = tableDefinition(table);
      for (const column of [
        'id uuid primary key',
        'store_id uuid not null',
        'created_at timestamptz not null',
        'updated_at timestamptz not null',
        'deleted_at timestamptz',
        'version bigint not null',
        'updated_by uuid not null',
        'device_id text not null',
      ]) {
        expect(definition, `${table} should include ${column}`).toContain(column);
      }
    }
  });

  it('uses store-scoped relationships, registered-device checks, and restrictive deletion', () => {
    expect(migration).toContain(
      'references public.devices(store_id, user_id, device_key) on delete restrict',
    );
    expect(migration).toContain('private.is_registered_device(p_store_id, p_device_id)');
    expect(migration).toContain('private.can_write_business(');
    expect(migration).not.toContain('on delete cascade');
  });

  it('keeps transaction and event tables immutable to authenticated clients', () => {
    for (const table of immutableTables) {
      expect(migration).not.toContain(`create policy ${table}_update`);
      expect(migration).not.toContain(`create policy ${table}_delete`);
    }
    expect(migration).toMatch(/grant select, insert on table[\s\S]*public\.sales/);
  });

  it('reserves soft deletion for managers and blocks duplicate operation IDs', () => {
    expect(migration).toContain('create function private.enforce_manager_soft_delete()');
    expect(migration).toContain(
      'Only an owner or administrator may change deletion state',
    );
    expect(tableDefinition('sync_operations')).toContain(
      'operation_id uuid not null unique',
    );

    for (const table of [
      'stock_movements',
      'sales',
      'utang_entries',
      'gcash_transactions',
      'payroll_entries',
      'vault_transactions',
      'audit_logs',
    ]) {
      expect(tableDefinition(table)).toContain('unique (store_id, operation_id)');
    }
  });

  it('keeps employee, payroll, vault, and store-setting writes manager-only', () => {
    const managerRoles =
      "array['owner', 'administrator']::public.store_member_role[]";
    expect(migration).toContain('create policy employees_insert_manager');
    expect(migration).toContain('create policy payroll_entries_insert_manager');
    expect(migration).toContain('create policy vault_transactions_insert_manager');
    expect(migration.split(managerRoles).length).toBeGreaterThan(5);
  });
});
