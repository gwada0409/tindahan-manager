import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';
const sql=readFileSync(resolve(process.cwd(),'supabase/migrations/202608010001_phase11_sales_sync.sql'),'utf8');
describe('Phase 11 sale RPC contract',()=>{
  it('uses immutable atomic operations and duplicate receipts',()=>{
    expect(sql).toContain('process_sale_transaction');
    expect(sql).toContain('from public.sync_operations where operation_id=op_id');
    expect(sql).toContain("status','processed','duplicate',true");
    expect(sql).toContain('insert into public.sales');
    expect(sql).toContain('insert into public.sale_items');
  });
  it('reconciles sale, payment, stock, and compensation totals',()=>{
    expect(sql).toContain('Sale totals or stock movement reconciliation failed');
    expect(sql).toContain('Cash payment reconciliation failed');
    expect(sql).toContain('Credit payment reconciliation failed');
    expect(sql).toContain('Compensation exceeds sale total');
  });
  it('keeps completed sales immutable and exposes RPCs only to authenticated users',()=>{
    expect(sql).toContain("sale->>'status' <> 'completed'");
    expect(sql).toContain('Immutable void, refund, reversal, and adjustment records');
    expect(sql).toContain('grant execute on function public.process_sale_transaction(jsonb) to authenticated');
    expect(sql).toContain('grant execute on function public.process_sale_compensation(jsonb) to authenticated');
  });
});