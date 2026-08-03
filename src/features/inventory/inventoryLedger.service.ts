import { db, type TindahanDB } from '@/db/database';
import type { AuditLog, InventoryBatch, StockMovement } from '@/types';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import { createSyncMetadata, touchSyncMetadata, UNASSIGNED_LOCAL_STORE_ID } from '@/domain/sync/syncMetadata';
import { generateId } from '@/shared/utils/id';
import { getDefaultRepositoryContext } from '@/repositories/repositoryContext';
import { notifyLocalSyncMutation } from '@/sync/syncEvents';
import { AppError } from '@/shared/errors/AppError';

export interface InventoryDiscrepancy {batchId:string;productId:string;cachedQuantity:number;movementQuantity:number;difference:number;negative:boolean;}
export interface MovementInput {productId:string;batchId:string;type:StockMovement['type'];quantity:number;referenceId?:string;notes:string;}

export class InventoryLedgerService {
  private readonly database:TindahanDB;
  constructor(database:TindahanDB=db){this.database=database;}
  async reconcile():Promise<InventoryDiscrepancy[]>{
    const batches=await this.database.inventoryBatches.toArray();const movements=await this.database.stockMovements.toArray();
    return batches.map((batch)=>{const movementQuantity=movements.filter((m)=>m.batchId===batch.id).reduce((sum,m)=>sum+m.quantity,0);return{batchId:batch.id,productId:batch.productId,cachedQuantity:batch.remainingQuantity,movementQuantity,difference:batch.remainingQuantity-movementQuantity,negative:movementQuantity<0};}).filter((row)=>row.difference!==0||row.negative);
  }
  async record(input:MovementInput):Promise<string>{
    if(!Number.isInteger(input.quantity)||input.quantity===0)throw new AppError('Movement quantity must be a non-zero whole number','INVALID_QUANTITY');
    const positive=new Set<StockMovement['type']>(['restock','return','transfer-in']);
    const negative=new Set<StockMovement['type']>(['sale','damaged','expired','transfer-out']);
    if(positive.has(input.type)&&input.quantity<0||negative.has(input.type)&&input.quantity>0)throw new AppError('Movement sign does not match its type','INVALID_SIGN');
    const context=await getDefaultRepositoryContext();const now=new Date();const id=generateId();
    await this.database.transaction('rw',[this.database.inventoryBatches,this.database.stockMovements,this.database.auditLogs,this.database.syncQueue,this.database.storeSettings],async()=>{
      const batch=await this.database.inventoryBatches.get(input.batchId);if(!batch||batch.productId!==input.productId)throw new AppError('Inventory batch not found','BATCH_NOT_FOUND');
      const store=await this.database.storeSettings.toCollection().first();const next=batch.remainingQuantity+input.quantity;
      if(next<0&&!store?.allowNegativeInventory)throw new AppError('Insufficient stock','INSUFFICIENT_STOCK');
      const movement:StockMovement={id,productId:input.productId,batchId:input.batchId,type:input.type,quantity:input.quantity,date:now,referenceId:input.referenceId,notes:input.notes,sync:createSyncMetadata(context)};
      const updated:InventoryBatch={...batch,remainingQuantity:next,sync:batch.sync?touchSyncMetadata(batch.sync,context):createSyncMetadata(context)};
      const audit:AuditLog={id:generateId(),date:now,action:'inventory:'+input.type,entityType:'product',entityId:input.productId,details:JSON.stringify({batchId:input.batchId,quantity:input.quantity,referenceId:input.referenceId}),sync:createSyncMetadata(context)};
      await this.database.inventoryBatches.put(updated);await this.database.stockMovements.add(movement);await this.database.auditLogs.add(audit);
      if(context.storeId!==UNASSIGNED_LOCAL_STORE_ID){const queued:SyncQueueItem={operationId:generateId(),storeId:context.storeId,entityType:'inventory_movement',entityId:id,operation:'transaction',payload:{movement,audit},createdAt:now.toISOString(),attempts:0,status:'pending'};await this.database.syncQueue.add(queued);}
    });
    notifyLocalSyncMutation();return id;
  }
}
export const inventoryLedgerService=new InventoryLedgerService();