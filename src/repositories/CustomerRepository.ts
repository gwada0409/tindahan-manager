import type { Table } from 'dexie';
import type { Customer } from '@/types';
import { db } from '@/db/database';
import { BaseRepository, type RepositoryQueueConfig } from './BaseRepository';
import {
  getDefaultRepositoryContext,
  type RepositoryContextProvider,
} from './repositoryContext';

export class CustomerRepository extends BaseRepository<Customer> {
  constructor(
    table: Table<Customer, string> = db.customers,
    contextProvider: RepositoryContextProvider = getDefaultRepositoryContext,
    queue: RepositoryQueueConfig | undefined = table === db.customers
      ? { database: db, table: db.syncQueue, entityType: 'customers' }
      : undefined
  ) {
    super(table, contextProvider, queue);
  }
}

export const customerRepo = new CustomerRepository();
