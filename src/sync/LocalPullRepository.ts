import { db, type TindahanDB } from '@/db/database';
import type { PullCursor, SyncMetadata, SyncState } from '@/domain/sync/sync.types';
import { ConflictRepository } from './ConflictRepository';
import type { PullChange, PullEntityType } from './syncTypes';

const EPOCH: PullCursor = {
  changedAt: '1970-01-01T00:00:00.000Z',
  id: '00000000-0000-0000-0000-000000000000',
};
const names: Record<PullEntityType, string> = {
  product_categories: 'categories',
  suppliers: 'suppliers',
  products: 'products',
  customers: 'customers',
  inventory_batches: 'inventoryBatches',
  stock_movements: 'stockMovements',
  sales: 'sales',
  sale_items: 'saleItems',
  utang_entries: 'utangEntries',
  gcash_transactions: 'gcashTransactions',
  bills: 'bills',
  employees: 'employees',
  payroll_entries: 'payrollEntries',
  vault_transactions: 'vaultTransactions',
};
const priority: Record<PullEntityType, number> = {
  product_categories: 0,
  suppliers: 1,
  customers: 2,
  products: 3,
  inventory_batches: 4,
  stock_movements: 5,
  sales: 6,
  sale_items: 7,
  employees: 8,
  bills: 9,
  utang_entries: 10,
  gcash_transactions: 11,
  payroll_entries: 12,
  vault_transactions: 13,
};
const str = (row: Record<string, unknown>, key: string, empty = '') =>
  typeof row[key] === 'string' ? (row[key] as string) : empty;
const nullable = (row: Record<string, unknown>, key: string) =>
  typeof row[key] === 'string' ? (row[key] as string) : undefined;
const num = (row: Record<string, unknown>, key: string) =>
  typeof row[key] === 'number' ? (row[key] as number) : 0;
const nullableNum = (row: Record<string, unknown>, key: string) =>
  typeof row[key] === 'number' ? (row[key] as number) : undefined;
const sync = (row: Record<string, unknown>): SyncMetadata => ({
  storeId: str(row, 'store_id'),
  createdAt: str(row, 'created_at'),
  updatedAt: str(row, 'updated_at'),
  deletedAt: typeof row.deleted_at === 'string' ? row.deleted_at : null,
  version: num(row, 'version'),
  baseVersion: null,
  updatedBy: nullable(row, 'updated_by') ?? null,
  deviceId: str(row, 'device_id'),
  syncStatus: 'synced',
});

function record(change: PullChange): Record<string, unknown> {
  const row = change.record;
  const base = { id: str(row, 'id'), sync: sync(row) };
  switch (change.entityType) {
    case 'product_categories':
      return { ...base, name: str(row, 'name') };
    case 'suppliers':
      return {
        ...base,
        name: str(row, 'name'),
        contactPerson: str(row, 'contact_person'),
        phone: str(row, 'phone'),
        email: str(row, 'email'),
        address: str(row, 'address'),
        notes: str(row, 'notes'),
      };
    case 'products':
      return {
        ...base,
        name: str(row, 'name'),
        sku: str(row, 'sku'),
        barcode: str(row, 'barcode'),
        categoryId: str(row, 'category_id'),
        unit: str(row, 'unit', 'piece'),
        costPrice: num(row, 'cost_price'),
        sellingPrice: num(row, 'selling_price'),
        reorderLevel: num(row, 'reorder_level'),
        supplierId: nullable(row, 'supplier_id'),
        description: str(row, 'description'),
        active: row.active !== false,
      };
    case 'customers':
      return {
        ...base,
        fullName: str(row, 'full_name'),
        phoneNumber: str(row, 'phone_number'),
        address: str(row, 'address'),
        creditLimit: num(row, 'credit_limit'),
        notes: str(row, 'notes'),
        active: row.active !== false,
        createdAt: new Date(str(row, 'created_at')),
      };
    case 'inventory_batches':
      return {
        ...base,
        productId: str(row, 'product_id'),
        supplierId: nullable(row, 'supplier_id'),
        quantityReceived: num(row, 'quantity_received'),
        remainingQuantity: 0,
        unitCost: num(row, 'unit_cost'),
        restockDate: new Date(str(row, 'restock_date')),
        expirationDate: nullable(row, 'expiration_date') ? new Date(str(row, 'expiration_date')) : undefined,
        referenceNumber: str(row, 'reference_number'),
        notes: str(row, 'notes'),
      };
    case 'stock_movements':
      return {
        ...base,
        productId: str(row, 'product_id'),
        batchId: nullable(row, 'batch_id'),
        type: str(row, 'movement_type'),
        quantity: num(row, 'signed_quantity'),
        date: new Date(str(row, 'occurred_at')),
        referenceId: nullable(row, 'reference_id'),
        notes: str(row, 'notes'),
      };
    case 'sales':
      return {
        ...base,
        date: new Date(str(row, 'occurred_at')),
        subtotal: num(row, 'subtotal'),
        discount: num(row, 'discount'),
        total: num(row, 'total'),
        paymentMethod: str(row, 'payment_method'),
        amountReceived: nullableNum(row, 'amount_received'),
        changeAmount: nullableNum(row, 'change_amount'),
        referenceNumber: nullable(row, 'reference_number'),
        customerId: nullable(row, 'customer_id'),
        status: str(row, 'status'),
        voidReason: nullable(row, 'void_reason'),
      };
    case 'sale_items':
      return {
        ...base,
        saleId: str(row, 'sale_id'),
        itemId: str(row, 'item_id'),
        itemType: str(row, 'item_type'),
        name: str(row, 'name'),
        quantity: num(row, 'quantity'),
        unitPrice: num(row, 'unit_price'),
        discount: num(row, 'discount'),
        total: num(row, 'total'),
        batchId: nullable(row, 'batch_id'),
      };
    case 'utang_entries':
      return {
        ...base,
        customerId: str(row, 'customer_id'),
        date: new Date(str(row, 'occurred_at')),
        type: str(row, 'entry_type'),
        amount: num(row, 'amount'),
        referenceId: nullable(row, 'reference_id'),
        notes: str(row, 'notes'),
      };
    case 'gcash_transactions':
      return {
        ...base,
        date: new Date(str(row, 'occurred_at')),
        type: str(row, 'transaction_type'),
        amount: num(row, 'amount'),
        serviceFee: num(row, 'service_fee'),
        customerId: nullable(row, 'customer_id'),
        referenceNumber: str(row, 'reference_number'),
        notes: str(row, 'notes'),
      };
    case 'bills':
      return {
        ...base,
        name: str(row, 'name'),
        category: str(row, 'category'),
        provider: str(row, 'provider'),
        amount: num(row, 'amount'),
        dueDate: new Date(str(row, 'due_date')),
        recurrence: str(row, 'recurrence'),
        status: str(row, 'status'),
        paidDate: nullable(row, 'paid_date') ? new Date(str(row, 'paid_date')) : undefined,
        paymentMethod: nullable(row, 'payment_method'),
        referenceNumber: nullable(row, 'reference_number'),
        notes: str(row, 'notes'),
      };
    case 'employees':
      return {
        ...base,
        name: str(row, 'name'),
        role: str(row, 'role'),
        contact: str(row, 'contact'),
        startDate: new Date(str(row, 'start_date')),
        payType: str(row, 'pay_type'),
        defaultRate: num(row, 'default_rate'),
        active: row.active !== false,
        notes: str(row, 'notes'),
      };
    case 'payroll_entries':
      return {
        ...base,
        employeeId: str(row, 'employee_id'),
        payPeriodStart: new Date(str(row, 'pay_period_start')),
        payPeriodEnd: new Date(str(row, 'pay_period_end')),
        baseAmount: num(row, 'base_amount'),
        additionalPay: num(row, 'additional_pay'),
        deductions: num(row, 'deductions'),
        netPay: num(row, 'net_pay'),
        paidDate: new Date(str(row, 'paid_date')),
        paymentMethod: str(row, 'payment_method'),
        notes: str(row, 'notes'),
      };
    case 'vault_transactions':
      return {
        ...base,
        date: new Date(str(row, 'occurred_at')),
        type: str(row, 'transaction_type'),
        amount: num(row, 'amount'),
        referenceId: nullable(row, 'reference_id'),
        notes: str(row, 'notes'),
      };
  }
}

const immutableEntities: PullEntityType[] = [
  'stock_movements',
  'sales',
  'sale_items',
  'utang_entries',
  'gcash_transactions',
  'payroll_entries',
  'vault_transactions',
];

export class LocalPullRepository {
  private readonly database: TindahanDB;

  constructor(database: TindahanDB = db) {
    this.database = database;
  }

  private stateId(storeId: string) {
    return 'pull:' + storeId;
  }

  async cursor(storeId: string): Promise<PullCursor> {
    return (await this.database.syncState.get(this.stateId(storeId)))?.pullCursor ?? EPOCH;
  }

  async applyPage(storeId: string, changes: PullChange[], cursor: PullCursor): Promise<void> {
    const ordered = [...changes].sort((a, b) => priority[a.entityType] - priority[b.entityType]);
    for (const change of ordered) {
      if (immutableEntities.includes(change.entityType)) continue;
      const remoteRecord = record(change);
      const id = remoteRecord.id as string;
      const table = this.database.table(names[change.entityType]);
      const current = (await table.get(id)) as { sync?: SyncMetadata } | undefined;
      const remote = remoteRecord.sync as SyncMetadata;
      if (current?.sync?.syncStatus === 'conflict') throw new Error('Unresolved sync conflict blocks pull for ' + change.entityType + ':' + id);
      if (current?.sync?.syncStatus === 'pending' && current.sync.baseVersion !== remote.version) {
        await new ConflictRepository(this.database).record({
          storeId,
          entityType: change.entityType,
          entityId: id,
          detectedAt: new Date().toISOString(),
          localPayload: current,
          remotePayload: remoteRecord,
          baseVersion: current.sync.baseVersion,
          localVersion: current.sync.version,
          serverVersion: remote.version,
          localEditor: current.sync.updatedBy,
          remoteEditor: remote.updatedBy,
          localDevice: current.sync.deviceId,
          remoteDevice: remote.deviceId,
          localUpdatedAt: current.sync.updatedAt,
          remoteUpdatedAt: remote.updatedAt,
        });
        await table.update(id, { sync: { ...current.sync, syncStatus: 'conflict' } });
        throw new Error('Pending local change blocks pull for ' + change.entityType + ':' + id);
      }
      if (current?.sync?.syncStatus === 'pending') throw new Error('Pending local change awaits upload for ' + change.entityType + ':' + id);
    }

    await this.database.transaction(
      'rw',
      [
        this.database.categories,
        this.database.suppliers,
        this.database.customers,
        this.database.products,
        this.database.inventoryBatches,
        this.database.stockMovements,
        this.database.sales,
        this.database.saleItems,
        this.database.utangEntries,
        this.database.gcashTransactions,
        this.database.bills,
        this.database.employees,
        this.database.payrollEntries,
        this.database.vaultTransactions,
        this.database.syncState,
      ],
      async () => {
        for (const change of ordered) {
          const local = record(change);
          const id = local.id as string;
          const table = this.database.table(names[change.entityType]);
          const current = (await table.get(id)) as { sync?: SyncMetadata; remainingQuantity?: number } | undefined;

          if (change.entityType === 'stock_movements') {
            if (current) continue;
            const batchId = local.batchId as string | undefined;
            if (!batchId) throw new Error('Stock movement has no batch.');
            const batch = await this.database.inventoryBatches.get(batchId);
            if (!batch) throw new Error('Missing inventory batch: ' + batchId);
            await table.add(local);
            await this.database.inventoryBatches.update(batchId, {
              remainingQuantity: batch.remainingQuantity + (local.quantity as number),
            });
            continue;
          }

          if (change.entityType === 'sales') {
            if (!current) await table.add(local);
            continue;
          }

          if (change.entityType === 'sale_items') {
            if (current) continue;
            if (!(await this.database.sales.get(local.saleId as string))) throw new Error('Missing sale: ' + local.saleId);
            await table.add(local);
            continue;
          }

          if (['utang_entries', 'gcash_transactions', 'payroll_entries', 'vault_transactions'].includes(change.entityType)) {
            if (!current) await table.add(local);
            continue;
          }

          if (change.entityType === 'inventory_batches') {
            if (!(await this.database.products.get(local.productId as string))) throw new Error('Missing batch product.');
            if (current) local.remainingQuantity = current.remainingQuantity ?? 0;
            await table.put(local);
            continue;
          }

          const remote = local.sync as SyncMetadata;
          if (current?.sync?.syncStatus === 'pending' && current.sync.version !== remote.version) {
            throw new Error('Pending local change blocks pull for ' + change.entityType + ':' + id);
          }
          if (change.entityType === 'products') {
            if (!(await this.database.categories.get(local.categoryId as string))) throw new Error('Missing product category.');
            const supplier = local.supplierId as string | undefined;
            if (supplier && !(await this.database.suppliers.get(supplier))) throw new Error('Missing product supplier.');
          }
          await table.put(local);
        }

        const id = this.stateId(storeId);
        const previous = await this.database.syncState.get(id);
        const state: SyncState = { ...previous, id, storeId, pullCursor: cursor, lastPulledAt: cursor.changedAt };
        await this.database.syncState.put(state);
      },
    );
  }

  async markSuccessful(storeId: string, cursor: PullCursor): Promise<void> {
    const id = this.stateId(storeId);
    const current = await this.database.syncState.get(id);
    await this.database.syncState.put({
      ...current,
      id,
      storeId,
      pullCursor: cursor,
      lastPulledAt: cursor.changedAt,
      lastSuccessfulSyncAt: cursor.changedAt,
    });
  }
}
