import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/db/database';
import { checkoutService } from './checkout.service';
import { saleAdjustmentService } from './saleAdjustment.service';

describe('sale compensation',()=>{
  beforeAll(async()=>{await db.open();});
  beforeEach(async()=>{
    await db.transaction('rw',[db.sales,db.saleItems,db.saleAdjustments,db.products,db.inventoryBatches,db.stockMovements,db.utangEntries,db.gcashTransactions,db.auditLogs,db.syncQueue,db.storeSettings],async()=>{
      await Promise.all([db.sales.clear(),db.saleItems.clear(),db.saleAdjustments.clear(),db.products.clear(),db.inventoryBatches.clear(),db.stockMovements.clear(),db.utangEntries.clear(),db.gcashTransactions.clear(),db.auditLogs.clear(),db.syncQueue.clear(),db.storeSettings.clear()]);
      await db.storeSettings.put({id:'store-1',name:'Store',ownerName:'Owner',address:'',contact:'',currency:'PHP',timezone:'Asia/Manila',expirationWarningDays:30,allowNegativeInventory:false,themePreference:'light'});
      await db.products.put({id:'p1',name:'Coke',categoryId:'c1',barcode:'1',sku:'1',unit:'pc',costPrice:100,sellingPrice:200,reorderLevel:1,active:true,description:''});
      await db.inventoryBatches.put({id:'b1',productId:'p1',quantityReceived:10,remainingQuantity:10,unitCost:100,restockDate:new Date(),referenceNumber:'',notes:''});
    });
  });
  it('voids by compensation without overwriting the completed sale or double-returning stock',async()=>{
    const saleId=await checkoutService.processCheckout({items:[{id:'p1',name:'Coke',price:200,quantity:2,type:'product'}],paymentMethod:'cash',amountPaid:400});
    const adjustmentId=await saleAdjustmentService.create({saleId,type:'void',amount:400,reason:'Operator error'});
    expect(await db.sales.get(saleId)).toMatchObject({status:'completed',total:400});
    expect(await db.saleAdjustments.get(adjustmentId)).toMatchObject({type:'void',saleId,amount:400});
    expect((await db.inventoryBatches.get('b1'))?.remainingQuantity).toBe(10);
    expect(await db.syncQueue.where('entityType').equals('sale_compensation').count()).toBe(1);
    await expect(saleAdjustmentService.create({saleId,type:'void',amount:400,reason:'Again'})).rejects.toThrow();
    expect((await db.inventoryBatches.get('b1'))?.remainingQuantity).toBe(10);
  });

  it('records a partial refund as compensation and prevents over-refund or over-return',async()=>{
    const saleId=await checkoutService.processCheckout({items:[{id:'p1',name:'Coke',price:200,quantity:2,type:'product'}],paymentMethod:'cash',amountPaid:400});
    await saleAdjustmentService.create({saleId,type:'refund',amount:200,reason:'Returned item',itemQuantities:{p1:1}});
    expect((await db.inventoryBatches.get('b1'))?.remainingQuantity).toBe(9);
    await expect(saleAdjustmentService.create({saleId,type:'refund',amount:300,reason:'Too much',itemQuantities:{p1:1}})).rejects.toThrow('exceeds');
    expect((await db.inventoryBatches.get('b1'))?.remainingQuantity).toBe(9);
  });});