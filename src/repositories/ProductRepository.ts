import type { Table } from 'dexie';
import { BaseRepository, type RepositoryQueueConfig } from './BaseRepository';
import type { Product } from '../types';
import { db } from '../db/database';
import type { RepositoryContextProvider } from './repositoryContext';
import { getDefaultRepositoryContext } from './repositoryContext';

export class ProductRepository extends BaseRepository<Product> {
  constructor(
    table: Table<Product, string> = db.products,
    contextProvider: RepositoryContextProvider = getDefaultRepositoryContext,
    queue: RepositoryQueueConfig | undefined = table === db.products
      ? { database: db, table: db.syncQueue, entityType: 'products' }
      : undefined
  ) {
    super(table, contextProvider, queue);
  }

  async getLowStockProducts(): Promise<Product[]> {
    // Stock quantities remain batch-derived; callers should combine this list
    // with StockService summaries until the inventory repository owns the query.
    return this.list();
  }
}

export const productRepo = new ProductRepository();
