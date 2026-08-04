import { db, type TindahanDB } from '@/db/database';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import { createSyncMetadata, UNASSIGNED_LOCAL_STORE_ID } from '@/domain/sync/syncMetadata';
import { GENERAL_CATEGORY_ID, GENERAL_CATEGORY_NAME } from '@/domain/inventory/defaultCategory';
import { generateId } from '@/shared/utils/id';
import { nowUtcIso } from '@/shared/utils/date';
import { SyncQueueService } from '@/services/sync/syncQueue.service';

const bookkeepingTables = new Set(['syncQueue', 'syncState', 'syncConflicts', 'migrationBackups', 'migrationState']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function containsUnassignedDevice(value: unknown, deviceId: string): boolean {
  if (Array.isArray(value)) return value.some((entry) => containsUnassignedDevice(entry, deviceId));
  if (!isRecord(value)) return false;
  const metadata = value.sync;
  if (isRecord(metadata) && metadata.storeId === UNASSIGNED_LOCAL_STORE_ID && metadata.deviceId === deviceId) return true;
  return Object.values(value).some((entry) => containsUnassignedDevice(entry, deviceId));
}

function adoptPayload(value: unknown, storeId: string, userId: string, deviceId: string): unknown {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((entry) => adoptPayload(entry, storeId, userId, deviceId));
  if (!isRecord(value)) return value;
  const adopted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'categoryId' && entry === 'default') adopted[key] = GENERAL_CATEGORY_ID;
    else adopted[key] = adoptPayload(entry, storeId, userId, deviceId);
  }
  const metadata = adopted.sync;
  if (isRecord(metadata) && metadata.storeId === UNASSIGNED_LOCAL_STORE_ID && metadata.deviceId === deviceId) {
    adopted.sync = { ...metadata, storeId, updatedBy: userId, syncStatus: 'pending' };
  }
  return adopted;
}

export class SyncQueueRepository {
  private readonly database: TindahanDB;
  private readonly queueService: SyncQueueService;
  constructor(database: TindahanDB = db) { this.database=database; this.queueService = new SyncQueueService(database.syncQueue); }
  async adoptUnassignedChanges(storeId: string, userId: string, deviceId: string): Promise<number> {
    const migration = await this.database.migrationState.get('initial:' + storeId);
    if (migration?.status !== 'complete') return 0;
    const candidates = await this.database.syncQueue.where('storeId').equals(UNASSIGNED_LOCAL_STORE_ID).toArray();
    const adoptedQueue = candidates.filter((item) => item.queueId !== undefined && containsUnassignedDevice(item.payload, deviceId));
    if (!adoptedQueue.length) return 0;

    const dataTables = this.database.tables.filter((table) => !bookkeepingTables.has(table.name));
    let needsGeneralCategory = false;
    for (const product of await this.database.products.toArray()) {
      if (product.categoryId === 'default' && product.sync?.storeId === UNASSIGNED_LOCAL_STORE_ID && product.sync.deviceId === deviceId) {
        needsGeneralCategory = true;
        break;
      }
    }

    await this.database.transaction('rw', [...dataTables, this.database.syncQueue], async () => {
      if (needsGeneralCategory && !(await this.database.categories.get(GENERAL_CATEGORY_ID))) {
        const now = nowUtcIso();
        const category = {
          id: GENERAL_CATEGORY_ID,
          name: GENERAL_CATEGORY_NAME,
          sync: createSyncMetadata({ storeId, deviceId, updatedBy: userId, createdAt: now, updatedAt: now }),
        };
        await this.database.categories.put(category);
        await this.database.syncQueue.add({
          operationId: generateId(),
          storeId,
          entityType: 'product_categories',
          entityId: GENERAL_CATEGORY_ID,
          operation: 'upsert',
          payload: category,
          createdAt: now,
          attempts: 0,
          status: 'pending',
        });
      }

      for (const table of dataTables) {
        await table.toCollection().modify((row) => {
          const record = row as Record<string, unknown>;
          const metadata = record.sync;
          if (!isRecord(metadata) || metadata.storeId !== UNASSIGNED_LOCAL_STORE_ID || metadata.deviceId !== deviceId || metadata.syncStatus !== 'pending') return;
          record.sync = { ...metadata, storeId, updatedBy: userId };
          if (table.name === 'products' && record.categoryId === 'default') record.categoryId = GENERAL_CATEGORY_ID;
        });
      }

      for (const item of adoptedQueue) {
        await this.database.syncQueue.update(item.queueId!, {
          storeId,
          payload: adoptPayload(item.payload, storeId, userId, deviceId),
          status: 'pending',
          attempts: 0,
          nextAttemptAt: undefined,
          lastAttemptAt: undefined,
          lastError: undefined,
        });
      }
    });
    return adoptedQueue.length;
  }
  async recover(): Promise<number> { return this.queueService.recoverStuckProcessing(); }
  async ready(storeId: string, limit: number): Promise<SyncQueueItem[]> {
    return (await this.queueService.listReady()).filter((item) => item.storeId === storeId).sort((a,b) => a.createdAt.localeCompare(b.createdAt)).slice(0, limit);
  }
  async markProcessing(item: SyncQueueItem): Promise<void> { if(item.queueId===undefined) throw new Error('Queue item has no local key.'); await this.queueService.markProcessing(item.queueId); }
  async markFailed(item: SyncQueueItem, error: unknown): Promise<void> { if(item.queueId===undefined) return; await this.queueService.markFailed(item.queueId,error); }
  async acknowledge(item: SyncQueueItem): Promise<void> {
    if(item.queueId===undefined) return;
    const queueId=item.queueId;
    const localTableName:Record<string,string>={product_categories:'categories',suppliers:'suppliers',products:'products',customers:'customers'};
    const tableName=localTableName[item.entityType];
    if(!tableName){
      const payload=item.payload as {batch?:{id?:string;sync?:{version?:number}};movement?:{batchId?:string}};
      const batchId=item.entityType==='inventory_restock' ? payload.batch?.id : item.entityType==='inventory_movement' ? payload.movement?.batchId : undefined;
      if(!batchId){await this.queueService.acknowledge(queueId);return;}
      await this.database.transaction('rw',[this.database.syncQueue,this.database.inventoryBatches],async()=>{
        const current=await this.database.inventoryBatches.get(batchId);
        if(current?.sync){
          const pushedVersion=payload.batch?.sync?.version;
          if(pushedVersion===undefined||current.sync.version>=pushedVersion){
            await this.database.inventoryBatches.update(batchId,{sync:{...current.sync,syncStatus:'synced',baseVersion:null}});
          }
        }
        await this.database.syncQueue.delete(queueId);
      });
      return;
    }
    const entityTable=this.database.table(tableName);
    await this.database.transaction('rw',[this.database.syncQueue,entityTable],async()=>{
      const current=await entityTable.get(item.entityId) as {sync?:{version:number;syncStatus:string;baseVersion:number|null}}|undefined;
      const pushed=item.payload as {sync?:{version?:number}};
      if(current?.sync&&current.sync.version===pushed.sync?.version){
        await entityTable.update(item.entityId,{sync:{...current.sync,syncStatus:'synced',baseVersion:null}});
      }
      await this.database.syncQueue.delete(queueId);
    });
  }
  async count(storeId?: string): Promise<number> { return storeId ? this.database.syncQueue.where('storeId').equals(storeId).count() : this.database.syncQueue.count(); }
}