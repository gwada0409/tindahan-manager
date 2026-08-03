import type { SyncQueueItem } from '@/domain/sync/sync.types';
import { SyncQueueRepository } from './SyncQueueRepository';
import type { PushSummary, SyncAdapter } from './syncTypes';

const ENTITY_PRIORITY: Record<string, number> = { product_categories: 0, suppliers: 1, products: 2, customers: 3, inventory_restock: 4, inventory_movement: 5, sale_transaction: 6, sale_compensation: 7 };
export class PushSyncService {
  private readonly queue:SyncQueueRepository; private readonly adapter:SyncAdapter; private readonly batchSize:number;
  constructor(queue: SyncQueueRepository, adapter: SyncAdapter, batchSize = 25) {this.queue=queue;this.adapter=adapter;this.batchSize=batchSize;}
  async pushReady(storeId: string): Promise<PushSummary> {
    const ready = await this.queue.ready(storeId, this.batchSize);
    ready.sort((a,b) => (ENTITY_PRIORITY[a.entityType] ?? 99) - (ENTITY_PRIORITY[b.entityType] ?? 99) || a.createdAt.localeCompare(b.createdAt));
    if (!ready.length) return { attempted: 0, processed: 0, failed: 0 };
    for (const item of ready) await this.queue.markProcessing(item);
    let results;
    try { results = await this.adapter.push(ready); }
    catch (error) { for (const item of ready) await this.queue.markFailed(item,error); return { attempted: ready.length, processed: 0, failed: ready.length }; }
    const byId = new Map(results.map((result) => [result.operationId, result]));
    let processed=0, failed=0;
    for (const item of ready) {
      const result=byId.get(item.operationId);
      if(result?.status==='processed'){ await this.queue.acknowledge(item); processed++; }
      else { await this.queue.markFailed(item, result?.error ?? 'Server did not confirm this operation.'); failed++; }
    }
    return { attempted: ready.length, processed, failed };
  }
}