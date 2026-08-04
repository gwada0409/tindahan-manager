import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { TindahanDB } from '@/db/database';
import { GENERAL_CATEGORY_ID } from '@/domain/inventory/defaultCategory';
import { UNASSIGNED_LOCAL_STORE_ID } from '@/domain/sync/syncMetadata';
import type { Product, Sale } from '@/types';
import { SyncQueueRepository } from './SyncQueueRepository';

const pendingSync = (deviceId: string) => ({
  storeId: UNASSIGNED_LOCAL_STORE_ID,
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
  deletedAt: null,
  version: 1,
  baseVersion: null,
  updatedBy: null,
  deviceId,
  syncStatus: 'pending' as const,
});

describe('unassigned queue recovery', () => {
  let database: TindahanDB | undefined;
  afterEach(async () => {
    if (!database) return;
    const name = database.name;
    database.close();
    await Dexie.delete(name);
    database = undefined;
  });

  it('adopts only this device after completed linking and repairs the legacy General category', async () => {
    database = new TindahanDB(`queue-adoption-${crypto.randomUUID()}`);
    await database.open();
    const deviceId = 'device-mobile';
    const product: Product = {
      id: crypto.randomUUID(),
      name: 'Mobile item',
      categoryId: 'default',
      barcode: '',
      sku: 'MOBILE-1',
      unit: 'piece',
      costPrice: 100,
      sellingPrice: 200,
      reorderLevel: 1,
      active: true,
      description: '',
      sync: pendingSync(deviceId),
    };
    const sale: Sale = {
      id: crypto.randomUUID(),
      date: new Date('2026-08-03T00:01:00.000Z'),
      subtotal: 200,
      discount: 0,
      total: 200,
      paymentMethod: 'cash',
      amountReceived: 200,
      changeAmount: 0,
      status: 'completed',
      sync: pendingSync(deviceId),
    };
    await database.products.put(product);
    await database.sales.put(sale);
    await database.migrationState.put({
      id: 'initial:store-cloud',
      mode: 'create-cloud-store',
      status: 'complete',
      targetStoreId: 'store-cloud',
      startedAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
      processedTables: ['__inventory_sales_baseline_v3__', '__inventory_sales_v2__'],
      countsBefore: {},
      totalsBefore: {},
      duplicateCount: 0,
    });
    await database.syncQueue.bulkAdd([
      {
        operationId: crypto.randomUUID(),
        storeId: UNASSIGNED_LOCAL_STORE_ID,
        entityType: 'products',
        entityId: product.id,
        operation: 'upsert',
        payload: product,
        createdAt: '2026-08-03T00:00:00.000Z',
        attempts: 0,
        status: 'pending',
      },
      {
        operationId: crypto.randomUUID(),
        storeId: UNASSIGNED_LOCAL_STORE_ID,
        entityType: 'sale_transaction',
        entityId: sale.id,
        operation: 'transaction',
        payload: { sale, items: [], stockMovements: [] },
        createdAt: '2026-08-03T00:01:00.000Z',
        attempts: 0,
        status: 'pending',
      },
      {
        operationId: crypto.randomUUID(),
        storeId: UNASSIGNED_LOCAL_STORE_ID,
        entityType: 'products',
        entityId: crypto.randomUUID(),
        operation: 'upsert',
        payload: { sync: pendingSync('other-device') },
        createdAt: '2026-08-03T00:02:00.000Z',
        attempts: 0,
        status: 'pending',
      },
    ]);

    const adopted = await new SyncQueueRepository(database).adoptUnassignedChanges('store-cloud', 'user-1', deviceId);
    const cloudQueue = await database.syncQueue.where('storeId').equals('store-cloud').toArray();
    const productQueue = cloudQueue.find((item) => item.entityType === 'products');

    expect(adopted).toBe(2);
    expect(cloudQueue.map((item) => item.entityType)).toEqual(expect.arrayContaining(['product_categories', 'products', 'sale_transaction']));
    expect((productQueue?.payload as Product).categoryId).toBe(GENERAL_CATEGORY_ID);
    expect(await database.categories.get(GENERAL_CATEGORY_ID)).toMatchObject({ name: 'General', sync: { storeId: 'store-cloud' } });
    expect(await database.products.get(product.id)).toMatchObject({ categoryId: GENERAL_CATEGORY_ID, sync: { storeId: 'store-cloud', updatedBy: 'user-1' } });
    expect(await database.sales.get(sale.id)).toMatchObject({ sync: { storeId: 'store-cloud', updatedBy: 'user-1' } });
    expect(await database.syncQueue.where('storeId').equals(UNASSIGNED_LOCAL_STORE_ID).count()).toBe(1);
  });
  it('repairs a failed default-category product before retrying dependent inventory operations', async () => {
    database = new TindahanDB(`queue-legacy-product-${crypto.randomUUID()}`);
    await database.open();
    const categoryId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    const sync = { ...pendingSync('device-mobile'), storeId: 'store-cloud', updatedBy: 'user-1', syncStatus: 'synced' as const };
    const product: Product = { id: productId, name: 'Mobile item', categoryId: 'default', barcode: '', sku: 'MOBILE-2', unit: 'piece', costPrice: 100, sellingPrice: 200, reorderLevel: 1, active: true, description: '', sync };
    await database.categories.put({ id: categoryId, name: 'General', sync });
    await database.products.put(product);
    await database.syncQueue.bulkAdd([
      { operationId: crypto.randomUUID(), storeId: 'store-cloud', entityType: 'products', entityId: productId, operation: 'upsert', payload: { ...product, categoryId: 'default' }, createdAt: sync.createdAt, attempts: 4, status: 'failed', lastError: 'invalid input syntax for type uuid: "default"' },
      { operationId: crypto.randomUUID(), storeId: 'store-cloud', entityType: 'inventory_restock', entityId: crypto.randomUUID(), operation: 'transaction', payload: { batch: { productId }, movement: { productId } }, createdAt: sync.createdAt, attempts: 4, status: 'failed', lastError: 'Inventory operation failed (23503).' },
      { operationId: crypto.randomUUID(), storeId: 'store-cloud', entityType: 'inventory_movement', entityId: crypto.randomUUID(), operation: 'transaction', payload: { movement: { productId } }, createdAt: sync.createdAt, attempts: 4, status: 'failed', lastError: 'Inventory operation failed (23503).' },
    ]);

    expect(await new SyncQueueRepository(database).repairLegacyProductReferences('store-cloud', 'user-1', 'device-mobile')).toBe(1);
    const repaired = await database.syncQueue.where('storeId').equals('store-cloud').toArray();
    expect((repaired.find((item) => item.entityType === 'products')?.payload as Product).categoryId).toBe(categoryId);
    expect(await database.products.get(productId)).toMatchObject({ categoryId });
    expect(repaired).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: 'products', status: 'pending', attempts: 0 }),
      expect.objectContaining({ entityType: 'inventory_restock', status: 'pending', attempts: 0 }),
      expect.objectContaining({ entityType: 'inventory_movement', status: 'pending', attempts: 0 }),
    ]));
    expect(repaired.every((item) => item.lastError === undefined)).toBe(true);
  });  it('acknowledges inventory operations and releases the local batch for pull', async () => {
    database = new TindahanDB('queue-inventory-ack-' + crypto.randomUUID());
    await database.open();
    const batchId = crypto.randomUUID();
    const queueId = await database.syncQueue.add({
      operationId: crypto.randomUUID(), storeId: 'store-cloud', entityType: 'inventory_restock', entityId: batchId,
      operation: 'transaction', payload: { batch: { id: batchId, sync: { version: 1 } }, movement: { batchId } },
      createdAt: new Date().toISOString(), attempts: 0, status: 'processing',
    });
    await database.inventoryBatches.put({
      id: batchId, productId: crypto.randomUUID(), quantityReceived: 5, remainingQuantity: 5, unitCost: 100,
      restockDate: new Date(), referenceNumber: '', notes: '',
      sync: { ...pendingSync('device-mobile'), storeId: 'store-cloud', updatedBy: 'user-1' },
    });
    const item = await database.syncQueue.get(queueId);
    await new SyncQueueRepository(database).acknowledge(item!);
    expect(await database.syncQueue.get(queueId)).toBeUndefined();
    expect(await database.inventoryBatches.get(batchId)).toMatchObject({sync:{syncStatus:'synced',baseVersion:null}});
  });
});
