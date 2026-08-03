import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';
const migration=readFileSync(resolve(process.cwd(),'supabase/migrations/202608010004_phase16_realtime_devices.sql'),'utf8');
const lifecycle=readFileSync(resolve(process.cwd(),'src/sync/SyncLifecycle.tsx'),'utf8');
describe('Phase 16 realtime and device management contract',()=>{
 it('adds owner-only revocation without permitting unrevocation',()=>{expect(migration).toContain("has_store_role(p_store_id, array['owner']");expect(migration).toContain('revoked_at is null');expect(migration).toContain('revoke all on function public.revoke_store_device');expect(migration).toContain('grant execute on function public.revoke_store_device');expect(migration).not.toContain('revoked_at = null');});
 it('publishes synchronized tables as invalidation sources',()=>{expect(migration).toContain("pubname='supabase_realtime'");expect(migration).toContain('alter publication supabase_realtime add table');expect(migration).toContain("'stock_movements'");expect(migration).toContain("'vault_transactions'");});
 it('debounces notifications and retains periodic recovery',()=>{expect(lifecycle).toContain("engine.run('realtime')");expect(lifecycle).toContain('750');expect(lifecycle).toContain("engine.run('interval')");expect(lifecycle).toContain('60_000');expect(lifecycle).toContain("filter:`store_id=eq.${storeId}`");});
});