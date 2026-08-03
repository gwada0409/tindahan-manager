import{readFileSync}from'node:fs';import{resolve}from'node:path';import{describe,expect,it}from'vitest';
const sql=readFileSync(resolve(process.cwd(),'supabase/migrations/202608010002_phase12_inventory_sync.sql'),'utf8');
describe('Phase 12 inventory SQL',()=>{
 it('uses an immutable idempotent movement ledger',()=>{expect(sql).toContain('process_inventory_operation');expect(sql).toContain('insert into public.stock_movements');expect(sql).toContain('from public.sync_operations where operation_id=op_id');expect(sql).toContain("'duplicate',true");});
 it('updates cache transactionally and reports concurrent negative stock',()=>{expect(sql).toContain('remaining_quantity=remaining_quantity+');expect(sql).toContain('inventory_reconciliation_issues');expect(sql).toContain('Concurrent offline movements produced negative stock');});
 it('pulls batches before locally applying UUID-deduplicated movements',()=>{expect(sql).toContain("select 'inventory_batches'");expect(sql).toContain("select 'stock_movements'");});
});