import { db } from '@/db/database';
import { createSyncMetadata, isSoftDeleted, touchSyncMetadata, UNASSIGNED_LOCAL_STORE_ID } from '@/domain/sync/syncMetadata';
import type { InventoryBatch, Product, StockMovement, AuditLog } from '@/types';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import { generateId } from '@/shared/utils/id';
import { getDefaultRepositoryContext } from '@/repositories/repositoryContext';
import { notifyLocalSyncMutation } from '@/sync/syncEvents';

interface RestockInput { product:Product; quantityReceived:number; unitCost:number; expirationDate?:Date; referenceNumber?:string; notes?:string; }

export class InventoryRepository {
  async listProducts():Promise<Product[]>{return(await db.products.toArray()).filter((row)=>!isSoftDeleted(row));}
  async listBatches():Promise<InventoryBatch[]>{return(await db.inventoryBatches.toArray()).filter((row)=>!isSoftDeleted(row));}
  async getAvailableStock(productId:string):Promise<number>{return(await this.getActiveBatches(productId)).reduce((sum,batch)=>sum+batch.remainingQuantity,0);}
  async getActiveBatches(productId:string):Promise<InventoryBatch[]>{
    return(await db.inventoryBatches.where('productId').equals(productId).toArray()).filter((batch)=>!isSoftDeleted(batch)&&batch.remainingQuantity>0).sort((a,b)=>{
      if(a.expirationDate&&b.expirationDate)return new Date(a.expirationDate).getTime()-new Date(b.expirationDate).getTime();
      if(a.expirationDate)return-1;if(b.expirationDate)return 1;return new Date(a.restockDate).getTime()-new Date(b.restockDate).getTime();
    });
  }
  async updateBatches(batches:InventoryBatch[]):Promise<void>{const context=await getDefaultRepositoryContext();await db.inventoryBatches.bulkPut(batches.map((batch)=>({...batch,sync:batch.sync?touchSyncMetadata(batch.sync,context):createSyncMetadata(context)})));}
  async searchProducts(term:string,limit=50):Promise<Product[]>{const lower=term.trim().toLowerCase();const products=await this.listProducts();if(!lower)return products.slice(0,limit);return products.filter((p)=>p.name.toLowerCase().includes(lower)||p.sku.toLowerCase().includes(lower)||p.barcode.includes(term)).slice(0,limit);}
  async restockProduct(input:RestockInput):Promise<string>{
    const context=await getDefaultRepositoryContext();const now=new Date();const batchId=generateId();const reference=input.referenceNumber||'RESTOCK-'+Date.now().toString().slice(-6);
    await db.transaction('rw',[db.inventoryBatches,db.stockMovements,db.auditLogs,db.syncQueue],async()=>{
      const batch:InventoryBatch={id:batchId,productId:input.product.id,quantityReceived:input.quantityReceived,remainingQuantity:input.quantityReceived,unitCost:input.unitCost,restockDate:now,expirationDate:input.expirationDate,supplierId:input.product.supplierId,referenceNumber:reference,notes:input.notes??'',sync:createSyncMetadata(context)};
      const movement:StockMovement={id:generateId(),productId:input.product.id,batchId,type:'restock',quantity:input.quantityReceived,date:now,referenceId:batchId,notes:'Restocked '+input.quantityReceived+' '+(input.product.unit||'units')+'. Ref: '+(input.referenceNumber||'N/A'),sync:createSyncMetadata(context)};
      const audit:AuditLog={id:generateId(),date:now,action:'inventory:restock',entityType:'product',entityId:input.product.id,details:JSON.stringify({productName:input.product.name,qty:input.quantityReceived,unitCost:input.unitCost}),sync:createSyncMetadata(context)};
      await db.inventoryBatches.add(batch);await db.stockMovements.add(movement);await db.auditLogs.add(audit);
      if(context.storeId!==UNASSIGNED_LOCAL_STORE_ID){const operation:SyncQueueItem={operationId:generateId(),storeId:context.storeId,entityType:'inventory_restock',entityId:batchId,operation:'transaction',payload:{batch,movement,audit},createdAt:now.toISOString(),attempts:0,status:'pending'};await db.syncQueue.add(operation);}
    });
    notifyLocalSyncMutation();return batchId;
  }
}
export const inventoryRepo=new InventoryRepository();