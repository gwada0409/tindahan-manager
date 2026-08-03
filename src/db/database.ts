import Dexie, { type Table } from 'dexie';
import type {
  Store,
  Category,
  Product,
  InventoryBatch,
  StockMovement,
  Service,
  Customer,
  UtangEntry,
  Sale,
  SaleItem,
  GCashTransaction,
  Bill,
  Employee,
  PayrollEntry,
  VaultTransaction,
  Supplier,
  Note,
  AuditLog,
  UserProfile,
  SaleAdjustment
} from '../types';
import type { InitialMigrationState, MigrationBackup, SyncConflict, SyncQueueItem, SyncState } from '@/domain/sync/sync.types';
import { schemaV1, schemaV2, schemaV3, schemaV4, schemaV5, schemaV6, schemaV7 } from './schema';
import { migrateV1toV2, migrateV2toV3, migrateV3toV4, migrateV4toV5, migrateV5toV6, migrateV6toV7 } from './migrations';

export class TindahanDB extends Dexie {
  storeSettings!: Table<Store>;
  categories!: Table<Category>;
  products!: Table<Product>;
  inventoryBatches!: Table<InventoryBatch>;
  stockMovements!: Table<StockMovement>;
  services!: Table<Service>;
  customers!: Table<Customer>;
  utangEntries!: Table<UtangEntry>;
  sales!: Table<Sale>;
  saleItems!: Table<SaleItem>;
  saleAdjustments!: Table<SaleAdjustment>;
  gcashTransactions!: Table<GCashTransaction>;
  bills!: Table<Bill>;
  employees!: Table<Employee>;
  payrollEntries!: Table<PayrollEntry>;
  vaultTransactions!: Table<VaultTransaction>;
  suppliers!: Table<Supplier>;
  notes!: Table<Note>;
  auditLogs!: Table<AuditLog>;
  userProfiles!: Table<UserProfile>;
  syncQueue!: Table<SyncQueueItem, number>;
  syncState!: Table<SyncState, string>;
  syncConflicts!: Table<SyncConflict, number>;
  migrationBackups!: Table<MigrationBackup, string>;
  migrationState!: Table<InitialMigrationState, string>;

  constructor(databaseName = 'TindahanDB') {
    super(databaseName);

    this.version(1).stores(schemaV1);

    this.version(2).stores(schemaV2).upgrade(async (tx) => {
      await migrateV1toV2(tx);
    });

    this.version(3).stores(schemaV3).upgrade(async (tx) => {
      await migrateV2toV3(tx);
    });

    this.version(4).stores(schemaV4).upgrade(async (tx) => {
      await migrateV3toV4(tx);
    });

    this.version(5).stores(schemaV5).upgrade(async (tx) => {
      await migrateV4toV5(tx);
    });

    this.version(6).stores(schemaV6).upgrade(async (tx) => {
      await migrateV5toV6(tx);
    });
    this.version(7).stores(schemaV7).upgrade(async (tx) => {
      await migrateV6toV7(tx);
    });
  }
}

export const db = new TindahanDB();
