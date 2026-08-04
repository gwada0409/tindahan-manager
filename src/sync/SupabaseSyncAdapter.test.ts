import { describe, expect, it, vi } from 'vitest';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import { SupabaseSyncAdapter } from './SupabaseSyncAdapter';

function operation(operationId: string, entityType: string): SyncQueueItem {
  return { operationId, storeId: 'store-1', entityType, entityId: crypto.randomUUID(), operation: entityType === 'products' ? 'upsert' : 'transaction', payload: {}, createdAt: '2026-01-01T00:00:00.000Z', attempts: 0, status: 'pending' };
}

describe('Supabase push dependency order', () => {
  it('commits products and inventory before a dependent completed sale', async () => {
    const calls: string[] = [];
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === 'process_sync_operations') {
        const items = args.p_operations as SyncQueueItem[];
        return { data: items.map((item) => ({ operationId: item.operationId, status: 'processed' })), error: null };
      }
      const item = args.p_operation as SyncQueueItem;
      return { data: { operationId: item.operationId, status: 'processed' }, error: null };
    });
    const adapter = new SupabaseSyncAdapter({ rpc } as never);
    const results = await adapter.push([
      operation('product-op', 'products'),
      operation('sale-op', 'sale_transaction'),
      operation('restock-op', 'inventory_restock'),
      operation('movement-op', 'inventory_movement'),
    ]);

    expect(calls).toEqual(['process_sync_operations', 'process_inventory_operation', 'process_inventory_operation', 'process_sale_transaction']);
    expect(results.map((result) => result.operationId)).toEqual(['product-op', 'restock-op', 'movement-op', 'sale-op']);
  });
});