import { describe, expect, it } from 'vitest';
import sql from '../../supabase/migrations/202608030004_phase21_inventory_sales_restore.sql?raw';

describe('Phase 21 inventory, sales, and device restore SQL', () => {
  it('adds server-owned cursors and pulls immutable sales with their items', () => {
    expect(sql).toContain('alter table public.sales');
    expect(sql).toContain('alter table public.sale_items');
    expect(sql).toContain("union all select 'sales'");
    expect(sql).toContain("union all select 'sale_items'");
    expect(sql).toContain('sales_server_changed');
    expect(sql).toContain('sale_items_server_changed');
  });

  it('allows only an authenticated store owner to restore a revoked device', () => {
    expect(sql).toContain('restore_store_device');
    expect(sql).toContain("private.has_store_role(p_store_id, array['owner']");
    expect(sql).toContain("set_config('app.device_restore_authorized', 'on', true)");
    expect(sql).toContain('revoke all on function public.restore_store_device(uuid, uuid) from anon');
    expect(sql).toContain('grant execute on function public.restore_store_device(uuid, uuid) to authenticated');
  });

  it('keeps direct unrevocation blocked outside the restore function', () => {
    expect(sql).toContain("current_setting('app.device_restore_authorized', true)");
    expect(sql).toContain('A revoked device can only be restored through the owner restore function');
  });
});
