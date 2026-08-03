import { db } from '@/db/database';
import { inventoryService } from '@/features/inventory/inventory.service';
import { generateId } from '@/shared/utils/id';
import { AppError } from '@/shared/errors/AppError';
import type { CartItem } from '@/store/cartStore';
import { createSyncMetadata, isSoftDeleted, touchSyncMetadata, UNASSIGNED_LOCAL_STORE_ID } from '@/domain/sync/syncMetadata';
import { getOrCreateDeviceId } from '@/services/device/deviceIdentityService';
import { useAuthStore } from '@/features/auth/auth.store';
import type { AuditLog, GCashTransaction, Sale, SaleItem, StockMovement, UtangEntry } from '@/types';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import { notifyLocalSyncMutation } from '@/sync/syncEvents';

export interface CheckoutRequest {
  items: CartItem[];
  paymentMethod: 'cash' | 'gcash' | 'utang';
  amountPaid: number;
  customerId?: string;
  gcashReference?: string;
  discount?: number;
}

export class CheckoutService {
  async processCheckout(request: CheckoutRequest): Promise<string> {
    if (!request.items.length) throw new AppError('Cart is empty', 'EMPTY_CART');
    const subtotal=request.items.reduce((sum,item)=>sum+(item.price*item.quantity),0);
    const discount=Math.max(0,Math.min(request.discount??0,subtotal));
    const totalAmount=subtotal-discount;
    if(request.paymentMethod==='cash'&&request.amountPaid<totalAmount)throw new AppError('Insufficient payment amount','INSUFFICIENT_PAYMENT');
    if(request.paymentMethod==='utang'&&!request.customerId)throw new AppError('Customer is required for Utang','MISSING_CUSTOMER');

    const saleId=await db.transaction('rw',[db.sales,db.saleItems,db.inventoryBatches,db.products,db.customers,db.utangEntries,db.gcashTransactions,db.stockMovements,db.auditLogs,db.syncQueue,db.storeSettings],async()=>{
      const store=await db.storeSettings.toCollection().first();
      const user=useAuthStore.getState().user;
      const context={storeId:store?.id??UNASSIGNED_LOCAL_STORE_ID,deviceId:getOrCreateDeviceId(),updatedBy:user?.id??null};
      const now=new Date();
      const id=generateId();
      const operationId=generateId();
      const items:SaleItem[]=[];
      const movements:StockMovement[]=[];

      for(const cartItem of request.items){
        const product=await db.products.get(cartItem.id);
        if(!product)throw new AppError(`Product not found: ${cartItem.name}`,'PRODUCT_NOT_FOUND');
        const batches=(await db.inventoryBatches.where('productId').equals(cartItem.id).toArray()).filter((batch)=>!isSoftDeleted(batch)).sort((a,b)=>{
          if(a.expirationDate&&b.expirationDate)return new Date(a.expirationDate).getTime()-new Date(b.expirationDate).getTime();
          if(a.expirationDate)return -1;if(b.expirationDate)return 1;
          return new Date(a.restockDate).getTime()-new Date(b.restockDate).getTime();
        });
        const before=new Map(batches.map((batch)=>[batch.id,batch.remainingQuantity]));
        const {updatedBatches}=inventoryService.allocateStock(batches,cartItem.quantity,store?.allowNegativeInventory??false);
        await db.inventoryBatches.bulkPut(updatedBatches.map((batch)=>({...batch,sync:batch.sync?touchSyncMetadata(batch.sync,context):createSyncMetadata(context)})));
        const saleItem:SaleItem={id:generateId(),saleId:id,itemId:cartItem.id,itemType:'product',name:cartItem.name,quantity:cartItem.quantity,unitPrice:cartItem.price,discount:0,total:cartItem.price*cartItem.quantity,sync:createSyncMetadata(context)};
        items.push(saleItem);await db.saleItems.add(saleItem);
        for(const batch of updatedBatches){
          const quantity=(before.get(batch.id)??batch.remainingQuantity)-batch.remainingQuantity;
          if(quantity<=0)continue;
          const movement:StockMovement={id:generateId(),productId:cartItem.id,batchId:batch.id,type:'sale',quantity:-quantity,date:now,referenceId:id,notes:`Sale ${id.slice(0,8)}`,sync:createSyncMetadata(context)};
          movements.push(movement);await db.stockMovements.add(movement);
        }
      }

      const sale:Sale={id,date:now,subtotal,discount,total:totalAmount,paymentMethod:request.paymentMethod,amountReceived:request.paymentMethod==='utang'?0:request.amountPaid,changeAmount:request.paymentMethod==='cash'?Math.max(0,request.amountPaid-totalAmount):undefined,status:'completed',customerId:request.customerId,referenceNumber:request.gcashReference,sync:createSyncMetadata(context)};
      await db.sales.add(sale);
      let debtEntry:UtangEntry|undefined;
      let gcashTransaction:GCashTransaction|undefined;
      if(request.paymentMethod==='utang'&&request.customerId){
        if(!await db.customers.get(request.customerId))throw new AppError('Customer not found','CUSTOMER_NOT_FOUND');
        debtEntry={id:generateId(),customerId:request.customerId,amount:totalAmount,date:now,type:'charge',referenceId:id,notes:`Purchase #${id.slice(0,8)}`,sync:createSyncMetadata(context)};
        await db.utangEntries.add(debtEntry);
      }
      if(request.paymentMethod==='gcash'){
        gcashTransaction={id:generateId(),type:'sale',amount:totalAmount,serviceFee:0,date:now,referenceNumber:request.gcashReference??'',customerId:request.customerId,notes:'Sale transaction',sync:createSyncMetadata(context)};
        await db.gcashTransactions.add(gcashTransaction);
      }
      const audit:AuditLog={id:generateId(),date:now,action:'sale:completed',entityType:'sale',entityId:id,details:JSON.stringify({total:totalAmount,paymentMethod:request.paymentMethod,itemCount:items.length}),sync:createSyncMetadata(context)};
      await db.auditLogs.add(audit);
      if(context.storeId!==UNASSIGNED_LOCAL_STORE_ID){
        const queued:SyncQueueItem={operationId,storeId:context.storeId,entityType:'sale_transaction',entityId:id,operation:'transaction',payload:{sale,items,stockMovements:movements,debtEntry,gcashTransaction,audit},createdAt:now.toISOString(),attempts:0,status:'pending'};
        await db.syncQueue.add(queued);
        for(const movement of movements){
          const stockOperation:SyncQueueItem={operationId:movement.id,storeId:context.storeId,entityType:'inventory_movement',entityId:movement.id,operation:'transaction',payload:{movement},createdAt:now.toISOString(),attempts:0,status:'pending'};
          await db.syncQueue.add(stockOperation);
        }
      }
      return id;
    });
    notifyLocalSyncMutation();
    return saleId;
  }
}
export const checkoutService=new CheckoutService();