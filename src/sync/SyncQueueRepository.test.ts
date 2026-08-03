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
});
