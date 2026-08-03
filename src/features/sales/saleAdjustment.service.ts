import { db } from '@/db/database';
import type { AuditLog, GCashTransaction, SaleAdjustment, SaleAdjustmentType, StockMovement, UtangEntry } from '@/types';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import { createSyncMetadata, touchSyncMetadata, UNASSIGNED_LOCAL_STORE_ID } from '@/domain/sync/syncMetadata';
import { generateId } from '@/shared/utils/id';
import { AppError } from '@/shared/errors/AppError';
import { getOrCreateDeviceId } from '@/services/device/deviceIdentityService';
import { useAuthStore } from '@/features/auth/auth.store';
import { notifyLocalSyncMutation } from '@/sync/syncEvents';

export interface SaleAdjustmentRequest { saleId:string; type:SaleAdjustmentType; amount:number; reason:string; itemQuantities?:Record<string,number>; }

export class SaleAdjustmentService {
  async create(request:SaleAdjustmentRequest):Promise<string>{
    if(!request.reason.trim())throw new AppError('A reason is required','MISSING_REASON');
    if(request.amount<=0)throw new AppError('Adjustment amount must be positive','INVALID_AMOUNT');
    const id=await db.transaction('rw',[db.sales,db.saleItems,db.saleAdjustments,db.stockMovements,db.inventoryBatches,db.utangEntries,db.gcashTransactions,db.auditLogs,db.syncQueue,db.storeSettings],async()=>{
      const sale=await db.sales.get(request.saleId);
      if(!sale||sale.status!=='completed')throw new AppError('Completed sale not found','SALE_NOT_FOUND');
      const prior=await db.saleAdjustments.where('saleId').equals(sale.id).toArray();
      if(request.type==='void'&&prior.some((entry)=>entry.type==='void'))throw new AppError('Sale is already voided','ALREADY_VOIDED');
      if(prior.reduce((sum,entry)=>sum+entry.amount,0)+request.amount>sale.total)throw new AppError('Adjustment exceeds the remaining sale amount','EXCESS_ADJUSTMENT');
      const store=await db.storeSettings.toCollection().first();
      const user=useAuthStore.getState().user;
      const context={storeId:store?.id??sale.sync?.storeId??UNASSIGNED_LOCAL_STORE_ID,deviceId:getOrCreateDeviceId(),updatedBy:user?.id??null};
      const now=new Date();const operationId=generateId();
      const saleItems=await db.saleItems.where('saleId').equals(sale.id).toArray();
      const requested=request.itemQuantities??(request.type==='void'?Object.fromEntries(saleItems.map((item)=>[item.itemId,item.quantity])):{});
      const returns:StockMovement[]=[];
      for(const [productId,quantity] of Object.entries(requested)){
        if(!Number.isInteger(quantity)||quantity<=0)throw new AppError('Return quantities must be positive whole numbers','INVALID_QUANTITY');
        const sold=saleItems.filter((item)=>item.itemId===productId).reduce((sum,item)=>sum+item.quantity,0);
        const alreadyReturned=(await db.stockMovements.filter((movement)=>movement.referenceId===sale.id).filter((movement)=>movement.type==='return'&&movement.productId===productId).toArray()).reduce((sum,movement)=>sum+movement.quantity,0);
        if(quantity+alreadyReturned>sold)throw new AppError('Return quantity exceeds sold quantity','EXCESS_RETURN');
        let remaining=quantity;
        const original=await db.stockMovements.filter((movement)=>movement.referenceId===sale.id).filter((movement)=>movement.type==='sale'&&movement.productId===productId).toArray();
        for(const movement of original){
          if(!remaining)break;
          const returned=Math.min(remaining,Math.abs(movement.quantity));
          if(movement.batchId){const batch=await db.inventoryBatches.get(movement.batchId);if(batch)await db.inventoryBatches.put({...batch,remainingQuantity:batch.remainingQuantity+returned,sync:batch.sync?touchSyncMetadata(batch.sync,context):createSyncMetadata(context)});}
          const returnMovement:StockMovement={id:generateId(),productId,batchId:movement.batchId,type:'return',quantity:returned,date:now,referenceId:sale.id,notes:request.type+': '+request.reason,sync:createSyncMetadata(context)};
          returns.push(returnMovement);await db.stockMovements.add(returnMovement);remaining-=returned;
        }
        if(remaining)throw new AppError('Original stock allocation is incomplete','INCOMPLETE_ALLOCATION');
      }
      const adjustment:SaleAdjustment={id:generateId(),saleId:sale.id,type:request.type,amount:request.amount,reason:request.reason.trim(),date:now,itemQuantities:requested,sync:createSyncMetadata(context)};
      await db.saleAdjustments.add(adjustment);
      let debtEntry:UtangEntry|undefined;let gcashTransaction:GCashTransaction|undefined;
      if(sale.paymentMethod==='utang'&&sale.customerId){debtEntry={id:generateId(),customerId:sale.customerId,date:now,type:'adjustment',amount:-request.amount,referenceId:sale.id,notes:request.type+': '+request.reason,sync:createSyncMetadata(context)};await db.utangEntries.add(debtEntry);}
      else if(sale.paymentMethod==='gcash'){gcashTransaction={id:generateId(),date:now,type:'adjustment',amount:-request.amount,serviceFee:0,customerId:sale.customerId,referenceNumber:sale.referenceNumber??'',notes:request.type+': '+request.reason,sync:createSyncMetadata(context)};await db.gcashTransactions.add(gcashTransaction);}
      const audit:AuditLog={id:generateId(),date:now,action:'sale:'+request.type,entityType:'sale',entityId:sale.id,details:JSON.stringify({adjustmentId:adjustment.id,amount:request.amount,reason:request.reason}),sync:createSyncMetadata(context)};
      await db.auditLogs.add(audit);
      if(context.storeId!==UNASSIGNED_LOCAL_STORE_ID){const queued:SyncQueueItem={operationId,storeId:context.storeId,entityType:'sale_compensation',entityId:adjustment.id,operation:'transaction',payload:{adjustment,originalSaleId:sale.id,stockMovements:returns,debtEntry,gcashTransaction,audit},createdAt:now.toISOString(),attempts:0,status:'pending'};await db.syncQueue.add(queued);for(const movement of returns){const stockOperation:SyncQueueItem={operationId:movement.id,storeId:context.storeId,entityType:'inventory_movement',entityId:movement.id,operation:'transaction',payload:{movement},createdAt:now.toISOString(),attempts:0,status:'pending'};await db.syncQueue.add(stockOperation);}}
      return adjustment.id;
    });
    notifyLocalSyncMutation();return id;
  }
}
export const saleAdjustmentService=new SaleAdjustmentService();