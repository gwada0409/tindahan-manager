import type { Table } from 'dexie';
import type { Category } from '@/types';
import { db } from '@/db/database';
import { BaseRepository, type RepositoryQueueConfig } from './BaseRepository';
import {
  getDefaultRepositoryContext,
  type RepositoryContextProvider,
} from './repositoryContext';

export class CategoryRepository extends BaseRepository<Category> {
  constructor(
    table: Table<Category, string> = db.categories,
    contextProvider: RepositoryContextProvider = getDefaultRepositoryContext,
    queue: RepositoryQueueConfig | undefined = table === db.categories
      ? { database: db, table: db.syncQueue, entityType: 'product_categories' }
      : undefined
  ) {
    super(table, contextProvider, queue);
  }
}

export const categoryRepo = new CategoryRepository();
