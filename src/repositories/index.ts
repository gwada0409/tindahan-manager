import type { SyncableEntity } from '@/domain/sync/sync.types';

export interface RepositoryListOptions {
  includeDeleted?: boolean;
}

export interface RepositoryWriteOptions {
  storeId?: string;
  deviceId?: string;
  updatedBy?: string | null;
  origin?: 'local' | 'cloud';
}

export type CreateEntityInput<T extends SyncableEntity> = Omit<T, 'id' | 'sync'>;
export type UpdateEntityInput<T extends SyncableEntity> = Partial<Omit<T, 'id' | 'sync'>>;

export interface Repository<T extends SyncableEntity> {
  list(options?: RepositoryListOptions): Promise<T[]>;
  getAll(options?: RepositoryListOptions): Promise<T[]>;
  getById(id: string, options?: RepositoryListOptions): Promise<T | undefined>;
  count(options?: RepositoryListOptions): Promise<number>;
  create(item: CreateEntityInput<T>, options?: RepositoryWriteOptions): Promise<T>;
  add(item: CreateEntityInput<T>, options?: RepositoryWriteOptions): Promise<string>;
  update(id: string, item: UpdateEntityInput<T>, options?: RepositoryWriteOptions): Promise<void>;
  softDelete(id: string, options?: RepositoryWriteOptions): Promise<void>;
  delete(id: string, options?: RepositoryWriteOptions): Promise<void>;
  bulkUpsert(items: T[], options?: RepositoryWriteOptions): Promise<void>;
}

export { BaseRepository } from './BaseRepository';
export { ProductRepository, productRepo } from './ProductRepository';
export { CategoryRepository, categoryRepo } from './CategoryRepository';
export { CustomerRepository, customerRepo } from './CustomerRepository';
export { SupplierRepository, supplierRepo } from './SupplierRepository';
export { saleRepo, saleItemRepo } from './SaleRepository';
export {
  billRepo,
  gcashTransactionRepo,
  payrollEntryRepo,
  utangEntryRepo,
  vaultTransactionRepo,
} from './FinancialRepository';
export * from './EntityRepositories';
