import { readFileSync } from 'node:fs';import { resolve } from 'node:path';import { describe,expect,it } from 'vitest';
const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/202607310004_phase9_pull_sync_rpc.sql'),'utf8');
describe('Phase 9 pull RPC contract',()=>{
 it('uses server-owned timestamps and a UUID tie-breaker',()=>{expect(migration).toContain('server_changed_at = clock_timestamp()');expect(migration).toContain('(server_changed_at,id)>(p_after_changed_at,p_after_id)');expect(migration).toContain('order by server_changed_at,id');});
 it('includes all supported entities without filtering soft deletions',()=>{for(const table of ['product_categories','suppliers','products','customers'])expect(migration).toContain(`from public.${table}`);expect(migration).not.toMatch(/deleted_at\s+is\s+null/i);});
 it('validates membership, limits pages, and restricts execution',()=>{expect(migration).toContain('private.is_active_store_member');expect(migration).toContain('p_limit not between 1 and 500');expect(migration).toContain('grant execute on function public.pull_sync_changes');});
});