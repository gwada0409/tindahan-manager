import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Product } from '@/types';
import { ProductRepository } from './ProductRepository';

const context = async () => ({
  storeId: 'store-test',
  deviceId: 'device-test',
  updatedBy: 'user-test',
});

function productInput(name = 'Rice') {
  return {
    name,
    categoryId: 'category-test',
    barcode: '10001',
    sku: 'RICE-1',
    unit: 'bag',
    costPrice: 4000,
    sellingPrice: 5000,
    reorderLevel: 2,
    active: true,
    description: '',
  };
}

describe('BaseRepository', () => {
  let database: Dexie;
  let repository: ProductRepository;

  beforeEach(async () => {
    database = new Dexie(`repository-test-${crypto.randomUUID()}`);
    database.version(1).stores({ products: 'id, sync.deletedAt' });
    await database.open();
    repository = new ProductRepository(
      database.table('products') as Table<Product, string>,
      context,
    );
  });

  afterEach(async () => {
    database.close();
    await database.delete();
  });

  it('creates UUID records with pending sync metadata', async () => {
    const created = await repository.create(productInput());

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(created.sync).toMatchObject({
      storeId: 'store-test',
      deviceId: 'device-test',
      updatedBy: 'user-test',
      version: 1,
      baseVersion: null,
      deletedAt: null,
      syncStatus: 'pending',
    });
    expect(await repository.count()).toBe(1);
  });

  it('increments versions on update and hides soft-deleted records by default', async () => {
    const created = await repository.create(productInput());
    await repository.update(created.id, { name: 'Premium Rice' });

    const updated = await repository.getById(created.id);
    expect(updated?.name).toBe('Premium Rice');
    expect(updated?.sync?.version).toBe(2);
    expect(updated?.sync?.baseVersion).toBe(1);

    await repository.softDelete(created.id);

    expect(await repository.getById(created.id)).toBeUndefined();
    expect(await repository.list()).toEqual([]);
    expect(await repository.count()).toBe(0);

    const archived = await repository.getById(created.id, { includeDeleted: true });
    expect(archived?.sync?.deletedAt).not.toBeNull();
    expect(archived?.sync?.version).toBe(3);
  });

  it('bulk-upserts legacy-shaped rows without changing their identifiers', async () => {
    const legacy: Product = {
      id: 'legacy-product-id',
      ...productInput('Legacy Rice'),
    };

    await repository.bulkUpsert([legacy]);

    const stored = await repository.getById('legacy-product-id');
    expect(stored?.id).toBe('legacy-product-id');
    expect(stored?.sync?.storeId).toBe('store-test');
  });
});
