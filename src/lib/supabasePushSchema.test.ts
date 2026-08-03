import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/202607310003_phase8_push_sync_rpc.sql'),'utf8');
describe('Phase 8 push RPC contract',()=>{
  it('validates identity, membership, entity type, format, and versions',()=>{
    expect(migration).toContain('private.can_write_business');
    expect(migration).toContain("entity_kind not in ('product_categories', 'suppliers', 'products', 'customers')");
    expect(migration).toContain('Payload identity does not match operation identity');
    expect(migration).toContain('Record version conflict');
    expect(migration).toContain('Entity belongs to another store');
    expect(migration).toContain('Only managers can synchronize deletions');
    expect(migration).toContain('Operation and deletion metadata do not match');
  });
  it('records unique operation receipts and reports duplicate retries',()=>{
    expect(migration).toContain('from public.sync_operations where operation_id = op_id');
    expect(migration).toContain("'duplicate', true");
    expect(migration).toContain('insert into public.sync_operations');
  });
  it('limits batches and exposes the RPC only to authenticated users',()=>{
    expect(migration).toContain('not between 1 and 50');
    expect(migration).toContain('revoke all on function public.process_sync_operations(jsonb) from public');
    expect(migration).toContain('grant execute on function public.process_sync_operations(jsonb) to authenticated');
  });
});