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
    await db.transaction('rw', [db.sales, db.saleItems, db.inventoryBatches, db.products, db.customers, db.utangEntries, db.gcashTransactions, db.storeSettings], async () => {
      await db.sales.clear();
      await db.saleItems.clear();
      await db.inventoryBatches.clear();
      await db.products.clear();
      await db.customers.clear();
      await db.utangEntries.clear();
      await db.gcashTransactions.clear();
      
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
  });
});
