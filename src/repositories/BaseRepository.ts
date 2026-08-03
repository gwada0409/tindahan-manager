import type Dexie from 'dexie';
import type { Table } from 'dexie';
import type { SyncableEntity, SyncQueueItem, SyncOperation } from '@/domain/sync/sync.types';
import { createSyncMetadata, isSoftDeleted, touchSyncMetadata } from '@/domain/sync/syncMetadata';
import { nowUtcIso } from '@/shared/utils/date';
import { generateId } from '@/shared/utils/id';
import { notifyLocalSyncMutation } from '@/sync/syncEvents';
import type { CreateEntityInput, Repository, RepositoryListOptions, RepositoryWriteOptions, UpdateEntityInput } from './index';
import { getDefaultRepositoryContext, type RepositoryContextProvider } from './repositoryContext';

export interface RepositoryQueueConfig {
  database: Dexie;
  table: Table<SyncQueueItem, number>;
  entityType: string;
  operationIdFactory?: () => string;
}

export class BaseRepository<T extends SyncableEntity> implements Repository<T> {
  protected readonly table: Table<T, string>;
  private readonly contextProvider: RepositoryContextProvider;
  private readonly queue?: RepositoryQueueConfig;

  constructor(
    table: Table<T, string>,
    contextProvider: RepositoryContextProvider = getDefaultRepositoryContext,
    queue?: RepositoryQueueConfig,
  ) {
    this.table = table;
    this.contextProvider = contextProvider;
    this.queue = queue;
  }

  async list(options: RepositoryListOptions = {}): Promise<T[]> {
    const records = await this.table.toArray();
    return options.includeDeleted ? records : records.filter((record) => !isSoftDeleted(record));
  }

  async getAll(options: RepositoryListOptions = {}): Promise<T[]> { return this.list(options); }

  async getById(id: string, options: RepositoryListOptions = {}): Promise<T | undefined> {
    const record = await this.table.get(id);
    if (!record || (!options.includeDeleted && isSoftDeleted(record))) return undefined;
    return record;
  }

  async count(options: RepositoryListOptions = {}): Promise<number> {
    if (options.includeDeleted) return this.table.count();
    return (await this.list()).length;
  }

  private async writeRecord(record: T, operation: SyncOperation, origin: 'local' | 'cloud'): Promise<void> {
    if (!this.queue || origin === 'cloud') {
      await this.table.put(record);
      return;
    }

    const queueItem: SyncQueueItem = {
      operationId: this.queue.operationIdFactory?.() ?? generateId(),
      storeId: record.sync?.storeId ?? '',
      entityType: this.queue.entityType,
      entityId: record.id,
      operation,
      payload: record,
      createdAt: nowUtcIso(),
      attempts: 0,
      status: 'pending',
    };

    await this.queue.database.transaction('rw', [this.table, this.queue.table], async () => {
      await this.table.put(record);
      await this.queue?.table.add(queueItem);
    });
    notifyLocalSyncMutation();
  }

  async create(item: CreateEntityInput<T>, options: RepositoryWriteOptions = {}): Promise<T> {
    const context = await this.contextProvider();
    const record = {
      ...item,
      id: generateId(),
      sync: createSyncMetadata({
        storeId: options.storeId ?? context.storeId,
        deviceId: options.deviceId ?? context.deviceId,
        updatedBy: options.updatedBy ?? context.updatedBy,
      }),
    } as T;
    await this.writeRecord(record, 'upsert', options.origin ?? 'local');
    return record;
  }

  async add(item: CreateEntityInput<T>, options: RepositoryWriteOptions = {}): Promise<string> {
    return (await this.create(item, options)).id;
  }

  async update(id: string, item: UpdateEntityInput<T>, options: RepositoryWriteOptions = {}): Promise<void> {
    const current = await this.table.get(id);
    if (!current) throw new Error(`Cannot update missing record: ${id}`);
    const unchanged = Object.entries(item).every(([key, value]) => JSON.stringify((current as unknown as Record<string, unknown>)[key]) === JSON.stringify(value));
    if (unchanged) return;
    const context = await this.contextProvider();
    const sync = current.sync
      ? touchSyncMetadata(current.sync, { deviceId: options.deviceId ?? context.deviceId, updatedBy: options.updatedBy ?? context.updatedBy })
      : createSyncMetadata({ storeId: options.storeId ?? context.storeId, deviceId: options.deviceId ?? context.deviceId, updatedBy: options.updatedBy ?? context.updatedBy });
    await this.writeRecord({ ...current, ...item, id, sync } as T, 'upsert', options.origin ?? 'local');
  }

  async softDelete(id: string, options: RepositoryWriteOptions = {}): Promise<void> {
    const current = await this.table.get(id);
    if (!current || current.sync?.deletedAt) return;
    const context = await this.contextProvider();
    const deletedAt = nowUtcIso();
    const sync = current.sync
      ? touchSyncMetadata(current.sync, { deviceId: options.deviceId ?? context.deviceId, updatedBy: options.updatedBy ?? context.updatedBy, deletedAt })
      : { ...createSyncMetadata({ storeId: options.storeId ?? context.storeId, deviceId: options.deviceId ?? context.deviceId, updatedBy: options.updatedBy ?? context.updatedBy }), deletedAt };
    await this.writeRecord({ ...current, sync } as T, 'delete', options.origin ?? 'local');
  }

  async delete(id: string, options: RepositoryWriteOptions = {}): Promise<void> { await this.softDelete(id, options); }

  async bulkUpsert(items: T[], options: RepositoryWriteOptions = {}): Promise<void> {
    if (items.length === 0) return;
    const context = await this.contextProvider();
    const records = items.map((item) => ({
      ...item,
      sync: item.sync ?? createSyncMetadata({ storeId: options.storeId ?? context.storeId, deviceId: options.deviceId ?? context.deviceId, updatedBy: options.updatedBy ?? context.updatedBy }),
    })) as T[];

    if (!this.queue || options.origin === 'cloud') {
      await this.table.bulkPut(records);
      return;
    }

    await this.queue.database.transaction('rw', [this.table, this.queue.table], async () => {
      for (const record of records) {
        await this.table.put(record);
        await this.queue?.table.add({
          operationId: this.queue.operationIdFactory?.() ?? generateId(),
          storeId: record.sync?.storeId ?? '',
          entityType: this.queue.entityType,
          entityId: record.id,
          operation: record.sync?.deletedAt ? 'delete' : 'upsert',
          payload: record,
          createdAt: nowUtcIso(),
          attempts: 0,
          status: 'pending',
        });
      }
    });
    notifyLocalSyncMutation();
  }
}