import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/db/database';
import { checkoutService } from './checkout.service';
import { CartItem } from '@/store/cartStore';

describe('CheckoutService', () => {
  beforeAll(async () => {
    // wait for db to be ready
    await db.open();
  });

  beforeEach(async () => {
    // Clear the tables before each test
    await db.transaction('rw', [db.sales, db.saleItems, db.inventoryBatches, db.products, db.customers, db.utangEntries, db.gcashTransactions, db.stockMovements, db.auditLogs, db.syncQueue, db.storeSettings], async () => {
      await db.sales.clear();
      await db.saleItems.clear();
      await db.inventoryBatches.clear();
      await db.products.clear();
      await db.customers.clear();
      await db.utangEntries.clear();
      await db.gcashTransactions.clear();
      await db.stockMovements.clear();
      await db.auditLogs.clear();
      await db.syncQueue.clear();
      
      await db.storeSettings.put({
        id: 'store-1',
        name: 'Test Store',
        ownerName: 'Test',
        address: 'Test',
        contact: '123',
        currency: 'PHP',
        timezone: 'Asia/Manila',
        expirationWarningDays: 30,
        allowNegativeInventory: false, // critical for testing constraints
        themePreference: 'light'
      });
    });
  });

  it('throws EMPTY_CART if items array is empty', async () => {
    await expect(checkoutService.processCheckout({
      items: [],
      paymentMethod: 'cash',
      amountPaid: 100
    })).rejects.toThrow('Cart is empty');
  });

  it('processes a valid cash transaction and deducts stock', async () => {
    // Setup product and batch
    await db.products.put({ id: 'p1', name: 'Coke', categoryId: 'c1', barcode: '1', sku: '1', unit: 'pc', costPrice: 1000, sellingPrice: 1500, reorderLevel: 5, active: true, description: '' });
    await db.inventoryBatches.put({ id: 'b1', productId: 'p1', quantityReceived: 10, remainingQuantity: 10, unitCost: 1000, restockDate: new Date(), referenceNumber: '', notes: '' });

    const items: CartItem[] = [{ id: 'p1', name: 'Coke', price: 1500, quantity: 2, type: 'product' }];
    
    const saleId = await checkoutService.processCheckout({
      items,
      paymentMethod: 'cash',
      amountPaid: 3000
    });

    expect(saleId).toBeDefined();

    // Verify stock was deducted
    const batches = await db.inventoryBatches.toArray();
    expect(batches[0].remainingQuantity).toBe(8);

    // Verify sale was recorded
    const sale = await db.sales.get(saleId);
    expect(sale?.total).toBe(3000);
    expect(sale?.status).toBe('completed');
    expect(await db.saleItems.where('saleId').equals(saleId).count()).toBe(1);
    expect(await db.stockMovements.filter((movement)=>movement.referenceId===saleId).toArray()).toEqual([
      expect.objectContaining({ type: 'sale', quantity: -2, batchId: 'b1' }),
    ]);
    const queued = await db.syncQueue.toCollection().first();
    expect(queued).toMatchObject({ entityType: 'sale_transaction', entityId: saleId, operation: 'transaction', status: 'pending' });
    expect(queued?.payload).toMatchObject({ sale: { id: saleId }, items: [expect.objectContaining({ saleId })] });
  });

  it('records a discounted sale using reconciled subtotal and total', async () => {
    await db.products.put({ id: 'p2', name: 'Rice', categoryId: 'c1', barcode: '2', sku: '2', unit: 'pc', costPrice: 500, sellingPrice: 1000, reorderLevel: 1, active: true, description: '' });
    await db.inventoryBatches.put({ id: 'b2', productId: 'p2', quantityReceived: 5, remainingQuantity: 5, unitCost: 500, restockDate: new Date(), referenceNumber: '', notes: '' });
    const saleId=await checkoutService.processCheckout({items:[{id:'p2',name:'Rice',price:1000,quantity:2,type:'product'}],paymentMethod:'cash',amountPaid:1800,discount:200});
    expect(await db.sales.get(saleId)).toMatchObject({subtotal:2000,discount:200,total:1800,amountReceived:1800,changeAmount:0});
  });

  it('rolls back the complete sale and queue when any item fails', async () => {
    await expect(checkoutService.processCheckout({items:[{id:'missing',name:'Missing',price:100,quantity:1,type:'product'}],paymentMethod:'cash',amountPaid:100})).rejects.toThrow('Product not found');
    expect(await db.sales.count()).toBe(0);
    expect(await db.saleItems.count()).toBe(0);
    expect(await db.syncQueue.count()).toBe(0);
  });
  it('stores complete GCash and credit sale side effects in their transaction envelopes', async () => {
    await db.products.put({ id: 'p3', name: 'Bread', categoryId: 'c1', barcode: '3', sku: '3', unit: 'pc', costPrice: 50, sellingPrice: 100, reorderLevel: 1, active: true, description: '' });
    await db.inventoryBatches.put({ id: 'b3', productId: 'p3', quantityReceived: 5, remainingQuantity: 5, unitCost: 50, restockDate: new Date(), referenceNumber: '', notes: '' });
    await db.customers.put({ id: 'c1', fullName: 'Customer', phoneNumber: '', address: '', creditLimit: 1000, notes: '', active: true, createdAt: new Date() });
    const gcashId=await checkoutService.processCheckout({items:[{id:'p3',name:'Bread',price:100,quantity:1,type:'product'}],paymentMethod:'gcash',amountPaid:0,gcashReference:'REF'});
    const creditId=await checkoutService.processCheckout({items:[{id:'p3',name:'Bread',price:100,quantity:1,type:'product'}],paymentMethod:'utang',amountPaid:0,customerId:'c1'});
    expect(await db.gcashTransactions.filter((row)=>row.referenceNumber==='REF').count()).toBe(1);
    expect(await db.utangEntries.filter((row)=>row.referenceId===creditId).count()).toBe(1);
    const envelopes=await db.syncQueue.where('entityType').equals('sale_transaction').toArray();
    expect(envelopes.find((item)=>item.entityId===gcashId)?.payload).toMatchObject({gcashTransaction:{amount:100}});
    expect(envelopes.find((item)=>item.entityId===creditId)?.payload).toMatchObject({debtEntry:{amount:100,customerId:'c1'}});
  });});
