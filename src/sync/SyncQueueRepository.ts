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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  async repairLegacyProductReferences(storeId: string, userId: string, deviceId: string): Promise<number> {
    const targetQueue = await this.database.syncQueue.where('storeId').equals(storeId).toArray();
    const localProducts = await this.database.products.toArray();
    const productIds = new Set<string>();
    for (const product of localProducts) if (product.categoryId === 'default') productIds.add(product.id);
    for (const item of targetQueue) {
      const payload = isRecord(item.payload) ? item.payload : undefined;
      if (item.entityType === 'products' && payload?.categoryId === 'default') productIds.add(item.entityId);
    }
    if (!productIds.size) return 0;

    const now = nowUtcIso();
    await this.database.transaction('rw', [this.database.categories, this.database.products, this.database.syncQueue], async () => {
      const queueCategory = async (categoryId: string): Promise<string> => {
        let category = await this.database.categories.get(categoryId);
        if (category?.sync && ![storeId, UNASSIGNED_LOCAL_STORE_ID].includes(category.sync.storeId)) category = undefined;
        if (!category) {
          const candidates = await this.database.categories.toArray();
          category = candidates.find((candidate) => uuidPattern.test(candidate.id) && candidate.name.trim().toLowerCase() === GENERAL_CATEGORY_NAME.toLowerCase() && (!candidate.sync || [storeId, UNASSIGNED_LOCAL_STORE_ID].includes(candidate.sync.storeId)));
        }
        if (!category) {
          category = {
            id: generateId(),
            name: GENERAL_CATEGORY_NAME,
            sync: createSyncMetadata({ storeId, deviceId, updatedBy: userId, createdAt: now, updatedAt: now }),
          };
          await this.database.categories.put(category);
        }
        const metadata = category.sync;
        const needsUpload = metadata?.storeId !== storeId || metadata.syncStatus !== 'synced';
        const normalizedCategory = needsUpload
          ? {
              ...category,
              sync: metadata?.storeId === storeId
                ? { ...metadata, deviceId, updatedBy: userId, syncStatus: 'pending' as const }
                : createSyncMetadata({ storeId, deviceId, updatedBy: userId, createdAt: metadata?.createdAt ?? now, updatedAt: metadata?.updatedAt ?? now }),
            }
          : category;
        if (needsUpload) await this.database.categories.put(normalizedCategory);
        const queuedCategory = (await this.database.syncQueue.where('storeId').equals(storeId).toArray())
          .find((item) => item.entityType === 'product_categories' && item.entityId === normalizedCategory.id);
        if (needsUpload && queuedCategory?.queueId !== undefined) {
          await this.database.syncQueue.update(queuedCategory.queueId, { payload: normalizedCategory, status: 'pending', attempts: 0, nextAttemptAt: undefined, lastAttemptAt: undefined, lastError: undefined });
        } else if (needsUpload) {
          await this.database.syncQueue.add({ operationId: generateId(), storeId, entityType: 'product_categories', entityId: normalizedCategory.id, operation: 'upsert', payload: normalizedCategory, createdAt: now, attempts: 0, status: 'pending' });
        }
        return normalizedCategory.id;
      };

      for (const productId of productIds) {
        const local = await this.database.products.get(productId);
        const queuedProducts = (await this.database.syncQueue.where('storeId').equals(storeId).toArray())
          .filter((item) => item.entityType === 'products' && item.entityId === productId);
        const queuedPayload = queuedProducts.map((item) => item.payload).find(isRecord);
        const localCategoryId = local?.categoryId;
        let categoryId = typeof localCategoryId === 'string' && uuidPattern.test(localCategoryId) && await this.database.categories.get(localCategoryId)
          ? localCategoryId
          : undefined;
        if (!categoryId) categoryId = await queueCategory(typeof queuedPayload?.categoryId === 'string' ? queuedPayload.categoryId : GENERAL_CATEGORY_ID);
        else await queueCategory(categoryId);

        const source = local ?? queuedPayload;
        if (!source) continue;
        const metadata = isRecord(source.sync) ? source.sync : undefined;
        const sync = metadata?.storeId === storeId
          ? { ...metadata, deviceId, updatedBy: userId, syncStatus: 'pending' as const }
          : createSyncMetadata({ storeId, deviceId, updatedBy: userId, createdAt: typeof metadata?.createdAt === 'string' ? metadata.createdAt : now, updatedAt: typeof metadata?.updatedAt === 'string' ? metadata.updatedAt : now });
        const repaired = { ...source, id: productId, categoryId, sync };
        if (local) await this.database.products.put(repaired as typeof local);
        if (queuedProducts.length) {
          for (const item of queuedProducts) if (item.queueId !== undefined) await this.database.syncQueue.update(item.queueId, { payload: repaired, status: 'pending', attempts: 0, nextAttemptAt: undefined, lastAttemptAt: undefined, lastError: undefined });
        } else {
          await this.database.syncQueue.add({ operationId: generateId(), storeId, entityType: 'products', entityId: productId, operation: 'upsert', payload: repaired, createdAt: now, attempts: 0, status: 'pending' });
        }
      }

      const dependents = (await this.database.syncQueue.where('storeId').equals(storeId).toArray())
        .filter((item) => item.queueId !== undefined && item.status === 'failed' && ['inventory_restock', 'inventory_movement', 'sale_transaction'].includes(item.entityType));
      for (const item of dependents) await this.database.syncQueue.update(item.queueId!, { status: 'pending', attempts: 0, nextAttemptAt: undefined, lastAttemptAt: undefined, lastError: undefined });
    });
    return productIds.size;
  }
  async retryFailed(storeId: string): Promise<number> { return this.queueService.retryFailed(storeId); }
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