import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import { GENERAL_CATEGORY_ID } from '@/domain/inventory/defaultCategory';
import { setAuthenticatedRepositoryContext } from './repositoryContext';
import { productRepo } from './ProductRepository';

describe('product synchronization defaults', () => {
  beforeEach(async () => {
    await db.open();
    await db.transaction('rw', [db.categories, db.products, db.syncQueue], async () => {
      await Promise.all([db.categories.clear(), db.products.clear(), db.syncQueue.clear()]);
    });
    setAuthenticatedRepositoryContext({ storeId: 'cloud-store', deviceId: 'device-1', updatedBy: 'user-1' });
  });

  afterEach(async () => {
    setAuthenticatedRepositoryContext(null);
    await db.transaction('rw', [db.categories, db.products, db.syncQueue], async () => {
      await Promise.all([db.categories.clear(), db.products.clear(), db.syncQueue.clear()]);
    });
    db.close();
  });

  it('queues a UUID General category before a category-less product', async () => {
    const productId = await productRepo.add({
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
    });
    const queued = await db.syncQueue.toArray();

    expect(await db.products.get(productId)).toMatchObject({ categoryId: GENERAL_CATEGORY_ID, sync: { storeId: 'cloud-store' } });
    expect(await db.categories.get(GENERAL_CATEGORY_ID)).toMatchObject({ name: 'General', sync: { storeId: 'cloud-store' } });
    expect(queued.map((item) => item.entityType)).toEqual(['product_categories', 'products']);
  });
});
