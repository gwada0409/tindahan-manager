import type { Table } from 'dexie';
import { BaseRepository, type RepositoryQueueConfig } from './BaseRepository';
import type { Product } from '../types';
import { db } from '../db/database';
import type { RepositoryContextProvider } from './repositoryContext';
import { getDefaultRepositoryContext } from './repositoryContext';
import type { CreateEntityInput, RepositoryWriteOptions } from './index';
import { categoryRepo } from './CategoryRepository';
import { GENERAL_CATEGORY_ID, GENERAL_CATEGORY_NAME } from '@/domain/inventory/defaultCategory';

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

  async create(item: CreateEntityInput<Product>, options: RepositoryWriteOptions = {}): Promise<Product> {
    let categoryId = item.categoryId;
    if (!categoryId || categoryId === 'default') {
      categoryId = GENERAL_CATEGORY_ID;
      if (!(await db.categories.get(categoryId))) {
        await categoryRepo.bulkUpsert([{ id: categoryId, name: GENERAL_CATEGORY_NAME }], options);
      }
    }
    return super.create({ ...item, categoryId }, options);
  }

  async getLowStockProducts(): Promise<Product[]> {
    // Stock quantities remain batch-derived; callers should combine this list
    // with StockService summaries until the inventory repository owns the query.
    return this.list();
  }
}

export const productRepo = new ProductRepository();
