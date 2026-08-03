import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Product } from '@/types';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import { ProductRepository } from '@/repositories/ProductRepository';
import { SyncQueueService, retryDelayMs } from './syncQueue.service';

const context = async () => ({ storeId: 'store-queue', deviceId: 'device-queue', updatedBy: 'user-queue' });
const input = (name = 'Rice') => ({ name, categoryId: 'category-1', barcode: '1', sku: 'RICE', unit: 'bag', costPrice: 100, sellingPrice: 150, reorderLevel: 1, active: true, description: '' });

describe('durable sync queue', () => {
  let database: Dexie;
  let products: Table<Product, string>;
  let queue: Table<SyncQueueItem, number>;

  beforeEach(async () => {
    database = new Dexie(`sync-queue-${crypto.randomUUID()}`);
    database.version(1).stores({ products: 'id', syncQueue: '++queueId, &operationId, status, nextAttemptAt' });
    await database.open();
    products = database.table('products');
    queue = database.table('syncQueue');
  });

  afterEach(async () => { database.close(); await database.delete(); });

  function repository(operationIdFactory: () => string = () => crypto.randomUUID()) {
    return new ProductRepository(products, context, { database, table: queue, entityType: 'products', operationIdFactory });
  }

  it('commits local entity and queue writes atomically', async () => {
    const created = await repository().create(input());
    expect(await products.get(created.id)).toEqual(created);
    expect(await queue.toArray()).toEqual([expect.objectContaining({ entityId: created.id, operation: 'upsert', status: 'pending', attempts: 0 })]);
  });

  it('skips unchanged updates without growing the queue or version', async () => {
    const repo = repository();
    const created = await repo.create(input());
    await repo.update(created.id, { name: 'Rice', sellingPrice: 150 });
    expect(await queue.count()).toBe(1);
    expect((await products.get(created.id))?.sync?.version).toBe(1);
  });
  it('rolls back an entity update when duplicate operation insertion fails', async () => {
    const repo = repository(() => 'same-operation');
    const created = await repo.create(input());
    await expect(repo.update(created.id, { name: 'Must roll back' })).rejects.toBeTruthy();
    expect((await products.get(created.id))?.name).toBe('Rice');
    expect(await queue.count()).toBe(1);
  });

  it('does not enqueue cloud-applied records', async () => {
    const repo = repository();
    const cloudRecord = { ...input('Cloud Rice'), id: 'cloud-product' } as Product;
    await repo.bulkUpsert([cloudRecord], { origin: 'cloud' });
    expect(await products.get('cloud-product')).toBeDefined();
    expect(await queue.count()).toBe(0);
  });

  it('persists queued operations after closing and reopening IndexedDB', async () => {
    await repository().create(input());
    const name = database.name;
    database.close();
    const reopened = new Dexie(name);
    reopened.version(1).stores({ products: 'id', syncQueue: '++queueId, &operationId, status, nextAttemptAt' });
    await reopened.open();
    expect(await reopened.table('syncQueue').count()).toBe(1);
    reopened.close();
  });

  it('tracks exponential retry state and only returns due work', async () => {
    const key = await queue.add({ operationId: 'retry-op', storeId: 'store-queue', entityType: 'products', entityId: 'p1', operation: 'upsert', payload: {}, createdAt: '2026-01-01T00:00:00.000Z', attempts: 0, status: 'pending' });
    const service = new SyncQueueService(queue);
    const now = new Date('2026-01-01T00:00:10.000Z');
    await service.markProcessing(key, now);
    await service.markFailed(key, new Error('offline'), now);
    const failed = await queue.get(key);
    expect(failed).toMatchObject({ attempts: 1, status: 'failed', lastError: 'offline' });
    expect(failed?.nextAttemptAt).toBe(new Date(now.getTime() + retryDelayMs(1)).toISOString());
    expect(await service.listReady(now)).toEqual([]);
    expect(await service.listReady(new Date(now.getTime() + retryDelayMs(1)))).toHaveLength(1);
  });

  it('recovers processing items left behind by an interrupted run', async () => {
    const key = await queue.add({ operationId: 'stuck-op', storeId: 'store-queue', entityType: 'products', entityId: 'p1', operation: 'upsert', payload: {}, createdAt: '2026-01-01T00:00:00.000Z', attempts: 1, status: 'processing', lastAttemptAt: '2026-01-01T00:00:00.000Z' });
    const service = new SyncQueueService(queue);
    expect(await service.recoverStuckProcessing(new Date('2026-01-01T00:10:00.000Z'), 60_000)).toBe(1);
    expect(await queue.get(key)).toMatchObject({ status: 'pending', lastError: 'Recovered after interrupted synchronization.' });
  });
});