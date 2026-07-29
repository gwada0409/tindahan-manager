import Dexie, { Table } from 'dexie';
import {
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
  UserProfile
} from '../types';
import { schemaV1, schemaV2, schemaV3 } from './schema';
import { migrateV1toV2, migrateV2toV3 } from './migrations';

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
  gcashTransactions!: Table<GCashTransaction>;
  bills!: Table<Bill>;
  employees!: Table<Employee>;
  payrollEntries!: Table<PayrollEntry>;
  vaultTransactions!: Table<VaultTransaction>;
  suppliers!: Table<Supplier>;
  notes!: Table<Note>;
  auditLogs!: Table<AuditLog>;
  userProfiles!: Table<UserProfile>;

  constructor() {
    super('TindahanDB');
    
    // Version 1 (Initial schema)
    this.version(1).stores(schemaV1);

    // Version 2 (Optimized indexes for large datasets)
    this.version(2).stores(schemaV2).upgrade(async (tx) => {
      await migrateV1toV2(tx);
    });

    // Version 3 (User profiles & customizable store branding)
    this.version(3).stores(schemaV3).upgrade(async (tx) => {
      await migrateV2toV3(tx);
    });
  }
}

export const db = new TindahanDB();
