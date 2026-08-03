import { db, type TindahanDB } from '@/db/database';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import { SyncQueueService } from '@/services/sync/syncQueue.service';

export class SyncQueueRepository {
  private readonly database: TindahanDB;
  private readonly queueService: SyncQueueService;
  constructor(database: TindahanDB = db) { this.database=database; this.queueService = new SyncQueueService(database.syncQueue); }
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
    if(!tableName){await this.queueService.acknowledge(queueId);return;}
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