import type { Table } from 'dexie';
import type { Supplier } from '@/types';
import { db } from '@/db/database';
import { BaseRepository, type RepositoryQueueConfig } from './BaseRepository';
import {
  getDefaultRepositoryContext,
  type RepositoryContextProvider,
} from './repositoryContext';

export class SupplierRepository extends BaseRepository<Supplier> {
  constructor(
    table: Table<Supplier, string> = db.suppliers,
    contextProvider: RepositoryContextProvider = getDefaultRepositoryContext,
    queue: RepositoryQueueConfig | undefined = table === db.suppliers
      ? { database: db, table: db.syncQueue, entityType: 'suppliers' }
      : undefined
  ) {
    super(table, contextProvider, queue);
  }
}

export const supplierRepo = new SupplierRepository();
