import { db, type TindahanDB } from '@/db/database';
import type {
  InitialMigrationMode,
  InitialMigrationState,
  MigrationBackup,
  SyncMetadata,
  SyncQueueItem,
} from '@/domain/sync/sync.types';
import { nowUtcIso } from '@/shared/utils/date';
import { generateId } from '@/shared/utils/id';
import type {
  GCashTransaction,
  InventoryBatch,
  Sale,
  SaleItem,
  StockMovement,
  UtangEntry,
} from '@/types';
import type { PullChange, SyncAdapter, SyncSummary } from '@/sync/syncTypes';

const bookkeeping = new Set(['syncQueue', 'syncState', 'syncConflicts', 'migrationBackups', 'migrationState']);
const supported: Record<string, string> = {
  categories: 'product_categories',
  suppliers: 'suppliers',
  products: 'products',
  customers: 'customers',
};
const transactionTables = new Set(['inventoryBatches', 'stockMovements', 'sales', 'saleItems', 'utangEntries', 'gcashTransactions']);
const TRANSACTION_STEP = '__inventory_sales_v2__';
const BASELINE_STEP = '__inventory_sales_baseline_v3__';
const OPENING_NOTE = 'Initial cloud migration opening balance';
const RECONCILIATION_NOTE = 'Initial cloud migration ledger reconciliation';
const totalFields: Record<string, string[]> = {
  products: ['costPrice', 'sellingPrice'],
  inventoryBatches: ['quantityReceived', 'remainingQuantity', 'unitCost'],
  sales: ['total'],
  utangEntries: ['amount'],
  gcashTransactions: ['amount', 'serviceFee'],
  bills: ['amount'],
  payrollEntries: ['netPay'],
  vaultTransactions: ['amount'],
};

type Row = Record<string, unknown> & { id?: unknown; sync?: SyncMetadata };

function originalTime(row: Row, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return undefined;
}

function completed(state: InitialMigrationState | undefined): boolean {
  return state?.status === 'complete' && (
    state.mode === 'download-cloud' ||
    (state.processedTables.includes(BASELINE_STEP) && state.processedTables.includes(TRANSACTION_STEP))
  );
}

function movementTime(movement: StockMovement): number {
  return new Date(movement.date).getTime();
}

export interface MigrationInventory {
  counts: Record<string, number>;
  totals: Record<string, number>;
  totalRecords: number;
  linkedRecords: number;
  complete: boolean;
}
export interface DuplicateCandidate {
  entityType: string;
  localId: string;
  remoteId: string;
  reason: string;
}
export interface MigrationAnalysis extends MigrationInventory {
  remoteCounts: Record<string, number>;
  duplicates: DuplicateCandidate[];
}
export type SyncRunner = () => Promise<SyncSummary>;

export class InitialMigrationService {
  private readonly database: TindahanDB;
  private readonly adapter?: SyncAdapter;

  constructor(database: TindahanDB = db, adapter?: SyncAdapter) {
    this.database = database;
    this.adapter = adapter;
  }

  private stateId(storeId: string) {
    return `initial:${storeId}`;
  }

  private dataTables() {
    return this.database.tables.filter((table) => !bookkeeping.has(table.name));
  }

  async snapshot(): Promise<{
    data: Record<string, unknown[]>;
    counts: Record<string, number>;
    totals: Record<string, number>;
  }> {
    const data: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};
    const totals: Record<string, number> = {};
    for (const table of this.dataTables()) {
      const rows = (await table.toArray()) as Row[];
      data[table.name] = rows;
      counts[table.name] = rows.length;
      for (const field of totalFields[table.name] ?? []) {
        totals[`${table.name}.${field}`] = rows.reduce(
          (sum, row) => sum + (typeof row[field] === 'number' ? (row[field] as number) : 0),
          0,
        );
      }
    }
    return { data, counts, totals };
  }

  async inventory(storeId: string): Promise<MigrationInventory> {
    const snap = await this.snapshot();
    const rows = Object.values(snap.data).flat() as Row[];
    const state = await this.database.migrationState.get(this.stateId(storeId));
    return {
      counts: snap.counts,
      totals: snap.totals,
      totalRecords: rows.length,
      linkedRecords: rows.filter((row) => row.sync?.storeId === storeId).length,
      complete: completed(state),
    };
  }

  async needsMigration(storeId: string): Promise<boolean> {
    const inventory = await this.inventory(storeId);
    if (inventory.complete) return false;
    const supportedRows = (
      await Promise.all(
        Object.keys(supported).map((name) => this.database.table(name).toArray() as Promise<Row[]>),
      )
    ).flat();
    return supportedRows.length === 0 || supportedRows.some((row) => row.sync?.storeId !== storeId) || !inventory.complete;
  }

  private async remoteChanges(storeId: string): Promise<PullChange[]> {
    if (!this.adapter) return [];
    let cursor = {
      changedAt: '1970-01-01T00:00:00.000Z',
      id: '00000000-0000-0000-0000-000000000000',
    };
    const changes: PullChange[] = [];
    for (let page = 0; page < 100; page++) {
      const result = await this.adapter.pull(storeId, cursor, 500);
      changes.push(...result.changes);
      cursor = result.nextCursor;
      if (!result.hasMore) return changes;
    }
    throw new Error('Migration analysis exceeded the pull page limit.');
  }

  async analyze(storeId: string): Promise<MigrationAnalysis> {
    const local = await this.inventory(storeId);
    const remote = await this.remoteChanges(storeId);
    const remoteCounts: Record<string, number> = {};
    for (const change of remote) remoteCounts[change.entityType] = (remoteCounts[change.entityType] ?? 0) + 1;
    const duplicates: DuplicateCandidate[] = [];
    for (const [localTable, entityType] of Object.entries(supported)) {
      const locals = (await this.database.table(localTable).toArray()) as Row[];
      const remotes = remote.filter((change) => change.entityType === entityType);
      for (const row of locals) {
        for (const change of remotes) {
          const remoteRow = change.record;
          let reason = '';
          if (localTable === 'products' && typeof row.sku === 'string' && row.sku && row.sku === remoteRow.sku) reason = 'matching SKU';
          else if (localTable === 'products' && typeof row.barcode === 'string' && row.barcode && row.barcode === remoteRow.barcode) reason = 'matching barcode';
          else if (localTable === 'customers' && typeof row.phoneNumber === 'string' && row.phoneNumber && row.phoneNumber === remoteRow.phone_number) reason = 'matching phone';
          else if (typeof row.name === 'string' && row.name.trim().toLowerCase() === String(remoteRow.name ?? '').trim().toLowerCase()) reason = 'matching name';
          if (reason) duplicates.push({ entityType, localId: String(row.id), remoteId: String(remoteRow.id), reason });
        }
      }
    }
    return { ...local, remoteCounts, duplicates };
  }

  private async normalizeSupportedIds(state: InitialMigrationState): Promise<InitialMigrationState> {
    if (state.processedTables.includes('__ids__')) return state;
    const tables = [
      this.database.categories,
      this.database.suppliers,
      this.database.customers,
      this.database.products,
      this.database.services,
      this.database.inventoryBatches,
      this.database.stockMovements,
      this.database.saleItems,
      this.database.saleAdjustments,
      this.database.sales,
      this.database.utangEntries,
      this.database.gcashTransactions,
      this.database.auditLogs,
      this.database.migrationState,
    ];
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    await this.database.transaction('rw', tables, async () => {
      const categoryMap = new Map<string, string>();
      for (const row of await this.database.categories.toArray()) if (!uuid.test(String(row.id))) categoryMap.set(String(row.id), generateId());
      const supplierMap = new Map<string, string>();
      for (const row of await this.database.suppliers.toArray()) if (!uuid.test(String(row.id))) supplierMap.set(String(row.id), generateId());
      const customerMap = new Map<string, string>();
      for (const row of await this.database.customers.toArray()) if (!uuid.test(String(row.id))) customerMap.set(String(row.id), generateId());
      const productMap = new Map<string, string>();
      for (const row of await this.database.products.toArray()) if (!uuid.test(String(row.id))) productMap.set(String(row.id), generateId());

      for (const [oldId, newId] of categoryMap) {
        const row = await this.database.categories.get(oldId);
        if (row) {
          await this.database.categories.delete(oldId);
          await this.database.categories.put({ ...row, id: newId });
        }
      }
      for (const [oldId, newId] of supplierMap) {
        const row = await this.database.suppliers.get(oldId);
        if (row) {
          await this.database.suppliers.delete(oldId);
          await this.database.suppliers.put({ ...row, id: newId });
        }
      }
      for (const [oldId, newId] of customerMap) {
        const row = await this.database.customers.get(oldId);
        if (row) {
          await this.database.customers.delete(oldId);
          await this.database.customers.put({ ...row, id: newId });
        }
      }
      for (const [oldId, newId] of productMap) {
        const row = await this.database.products.get(oldId);
        if (row) {
          await this.database.products.delete(oldId);
          await this.database.products.put({ ...row, id: newId });
        }
      }

      await this.database.products.toCollection().modify((row) => {
        row.categoryId = categoryMap.get(String(row.categoryId)) ?? row.categoryId;
        if (row.supplierId) row.supplierId = supplierMap.get(String(row.supplierId)) ?? row.supplierId;
      });
      await this.database.services.toCollection().modify((row) => {
        row.categoryId = categoryMap.get(String(row.categoryId)) ?? row.categoryId;
      });
      await this.database.inventoryBatches.toCollection().modify((row) => {
        row.productId = productMap.get(String(row.productId)) ?? row.productId;
        if (row.supplierId) row.supplierId = supplierMap.get(String(row.supplierId)) ?? row.supplierId;
      });
      await this.database.stockMovements.toCollection().modify((row) => {
        row.productId = productMap.get(String(row.productId)) ?? row.productId;
      });
      await this.database.saleItems.toCollection().modify((row) => {
        if (row.itemType === 'product') row.itemId = productMap.get(String(row.itemId)) ?? row.itemId;
      });
      await this.database.sales.toCollection().modify((row) => {
        if (row.customerId) row.customerId = customerMap.get(String(row.customerId)) ?? row.customerId;
      });
      await this.database.utangEntries.toCollection().modify((row) => {
        row.customerId = customerMap.get(String(row.customerId)) ?? row.customerId;
      });
      await this.database.gcashTransactions.toCollection().modify((row) => {
        if (row.customerId) row.customerId = customerMap.get(String(row.customerId)) ?? row.customerId;
      });
      await this.database.auditLogs.toCollection().modify((row) => {
        const maps: Record<string, Map<string, string>> = {
          category: categoryMap,
          supplier: supplierMap,
          customer: customerMap,
          product: productMap,
        };
        const map = maps[row.entityType];
        if (map) row.entityId = map.get(String(row.entityId)) ?? row.entityId;
      });
      state = {
        ...state,
        processedTables: [...state.processedTables, '__ids__'],
        updatedAt: nowUtcIso(),
      };
      await this.database.migrationState.put(state);
    });
    return state;
  }

  private async acknowledgeAlreadyUploadedMasterOperations(targetStoreId: string, countsBefore: Record<string, number> = {}): Promise<number> {
    if (!this.adapter) return 0;
    const tableNames: Record<string, string> = {
      product_categories: 'categories',
      suppliers: 'suppliers',
      products: 'products',
      customers: 'customers',
    };
    const queued = (await this.database.syncQueue.where('storeId').equals(targetStoreId).toArray())
      .filter((item) => Boolean(tableNames[item.entityType]) && item.queueId !== undefined);
    if (!queued.length) return 0;

    const remote = await this.remoteChanges(targetStoreId);
    const matches = queued.flatMap((item) => {
      const change = remote.find((candidate) => candidate.entityType === item.entityType && candidate.record.id === item.entityId);
      const payload = item.payload as Row;
      const sync = payload.sync;
      if (!change || !sync) return [];
      const record = change.record;
      const sameVersion = record.version === sync.version;
      const sameDevice = record.device_id === sync.deviceId;
      const sameEditor = record.updated_by === sync.updatedBy;
      const sameUpdatedAt = typeof record.updated_at === 'string' && Date.parse(record.updated_at) === Date.parse(sync.updatedAt);
      const emptyBaseline = (countsBefore[tableNames[item.entityType]] ?? 0) === 0;
      return emptyBaseline || (sameVersion && sameDevice && sameEditor && sameUpdatedAt) ? [{ item, tableName: tableNames[item.entityType] }] : [];
    });
    if (!matches.length) return 0;

    const tables = [...new Set(matches.map(({ tableName }) => this.database.table(tableName)))];
    await this.database.transaction('rw', [...tables, this.database.syncQueue], async () => {
      for (const { item, tableName } of matches) {
        const table = this.database.table(tableName);
        const current = await table.get(item.entityId) as Row | undefined;
        if (current?.sync) await table.update(item.entityId, { sync: { ...current.sync, syncStatus: 'synced', baseVersion: null } });
        await this.database.syncQueue.delete(item.queueId!);
      }
    });
    return matches.length;
  }
  private async queueInventoryAndSales(
    state: InitialMigrationState,
    targetStoreId: string,
    userId: string,
    deviceId: string,
  ): Promise<InitialMigrationState> {
    if (state.processedTables.includes(TRANSACTION_STEP)) return state;
    const tables = [
      this.database.inventoryBatches,
      this.database.stockMovements,
      this.database.sales,
      this.database.saleItems,
      this.database.utangEntries,
      this.database.gcashTransactions,
      this.database.auditLogs,
      this.database.syncQueue,
      this.database.migrationState,
    ];
    await this.database.transaction('rw', tables, async () => {
      const batches = await this.database.inventoryBatches.toArray();
      const allMovements = await this.database.stockMovements.toArray();
      const batchIds = new Set(batches.map((batch) => batch.id));
      const orphan = allMovements.find((movement) => !movement.batchId || !batchIds.has(movement.batchId));
      if (orphan) throw new Error(`Inventory movement ${orphan.id} has no matching batch and cannot be synchronized safely.`);

      const enqueue = async (operation: SyncQueueItem) => {
        if (!(await this.database.syncQueue.where('operationId').equals(operation.operationId).first())) {
          await this.database.syncQueue.add(operation);
        }
      };
      const metadata = (createdAt: string): SyncMetadata => ({
        storeId: targetStoreId,
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
        version: 1,
        baseVersion: null,
        updatedBy: userId,
        deviceId,
        syncStatus: 'pending',
      });
      const queueMovement = async (movement: StockMovement) => {
        await enqueue({
          operationId: movement.id,
          storeId: targetStoreId,
          entityType: 'inventory_movement',
          entityId: movement.id,
          operation: 'transaction',
          payload: { movement },
          createdAt: movement.sync?.createdAt ?? new Date(movement.date).toISOString(),
          attempts: 0,
          status: 'pending',
        });
      };

      for (const batch of batches) {
        const movements = allMovements
          .filter((movement) => movement.batchId === batch.id)
          .sort((a, b) => movementTime(a) - movementTime(b));
        let opening = movements.find((movement) => movement.type === 'restock') ?? movements[0];

        if (!opening) {
          const quantity = batch.remainingQuantity > 0 ? batch.remainingQuantity : batch.quantityReceived;
          const createdAt = batch.sync?.createdAt ?? new Date(batch.restockDate).toISOString();
          opening = {
            id: generateId(),
            productId: batch.productId,
            batchId: batch.id,
            type: 'restock',
            quantity,
            date: new Date(batch.restockDate),
            referenceId: batch.id,
            notes: OPENING_NOTE,
            sync: metadata(createdAt),
          };
          await this.database.stockMovements.add(opening);
          movements.push(opening);
          allMovements.push(opening);
        }

        await enqueue({
          operationId: opening.id,
          storeId: targetStoreId,
          entityType: 'inventory_restock',
          entityId: batch.id,
          operation: 'transaction',
          payload: { batch, movement: opening },
          createdAt: opening.sync?.createdAt ?? new Date(opening.date).toISOString(),
          attempts: 0,
          status: 'pending',
        });

        for (const movement of movements) if (movement.id !== opening.id) await queueMovement(movement);

        const ledgerQuantity = movements.reduce((sum, movement) => sum + movement.quantity, 0);
        const difference = batch.remainingQuantity - ledgerQuantity;
        if (difference !== 0) {
          const createdAt = nowUtcIso();
          const adjustment: StockMovement = {
            id: generateId(),
            productId: batch.productId,
            batchId: batch.id,
            type: 'adjustment',
            quantity: difference,
            date: new Date(createdAt),
            referenceId: batch.id,
            notes: RECONCILIATION_NOTE,
            sync: metadata(createdAt),
          };
          await this.database.stockMovements.add(adjustment);
          allMovements.push(adjustment);
          await queueMovement(adjustment);
        }
      }

      const sales = await this.database.sales.toArray();
      const saleItems = await this.database.saleItems.toArray();
      const debtEntries = await this.database.utangEntries.toArray();
      const gcashTransactions = await this.database.gcashTransactions.toArray();
      const audits = await this.database.auditLogs.toArray();

      for (const sale of sales) {
        if (sale.status !== 'completed') throw new Error(`Sale ${sale.id} is not completed and requires a compensation record before cloud migration.`);
        const items = saleItems.filter((item) => item.saleId === sale.id);
        if (!items.length) throw new Error(`Sale ${sale.id} has no line items and cannot be synchronized safely.`);
        if (items.some((item) => item.itemType !== 'product')) throw new Error(`Sale ${sale.id} contains a service line that is not supported by cloud sales.`);

        let stockMovements = allMovements.filter((movement) => movement.referenceId === sale.id && movement.type === 'sale');
        const itemQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const movementQuantity = stockMovements.reduce((sum, movement) => sum + Math.abs(movement.quantity), 0);
        if (movementQuantity !== itemQuantity) {
          stockMovements = items.map((item) => ({
            id: generateId(),
            productId: item.itemId,
            batchId: item.batchId,
            type: 'sale' as const,
            quantity: -item.quantity,
            date: new Date(sale.date),
            referenceId: sale.id,
            notes: 'Historical sale reconciliation envelope',
            sync: sale.sync,
          }));
        }

        const debtEntry = debtEntries.find((entry) => entry.referenceId === sale.id);
        const gcashTransaction = gcashTransactions.find(
          (entry) =>
            entry.type === 'sale' &&
            entry.amount === sale.total &&
            ((!sale.referenceNumber && Math.abs(new Date(entry.date).getTime() - new Date(sale.date).getTime()) < 2000) ||
              Boolean(sale.referenceNumber && entry.referenceNumber === sale.referenceNumber)),
        );
        if (sale.paymentMethod === 'utang' && !debtEntry) throw new Error(`Sale ${sale.id} has no matching utang entry.`);
        if (sale.paymentMethod === 'gcash' && !gcashTransaction) throw new Error(`Sale ${sale.id} has no matching GCash entry.`);
        const audit = audits.find((entry) => entry.entityType === 'sale' && entry.entityId === sale.id);

        await enqueue({
          operationId: sale.id,
          storeId: targetStoreId,
          entityType: 'sale_transaction',
          entityId: sale.id,
          operation: 'transaction',
          payload: { sale, items, stockMovements, debtEntry, gcashTransaction, audit },
          createdAt: sale.sync?.createdAt ?? new Date(sale.date).toISOString(),
          attempts: 0,
          status: 'pending',
        });
      }

      state = {
        ...state,
        status: 'migrating',
        processedTables: [...state.processedTables, TRANSACTION_STEP],
        updatedAt: nowUtcIso(),
      };
      await this.database.migrationState.put(state);
    });
    return state;
  }

  private async backup(sourceStoreId?: string): Promise<MigrationBackup> {
    const snap = await this.snapshot();
    const backup: MigrationBackup = {
      id: generateId(),
      createdAt: nowUtcIso(),
      sourceStoreId,
      data: snap.data,
      counts: snap.counts,
      totals: snap.totals,
    };
    await this.database.migrationBackups.add(backup);
    return backup;
  }

  async migrate(
    mode: InitialMigrationMode,
    targetStoreId: string,
    userId: string,
    deviceId: string,
    runSync: SyncRunner,
  ): Promise<InitialMigrationState> {
    const id = this.stateId(targetStoreId);
    let state = await this.database.migrationState.get(id);
    if (completed(state)) return state!;
    if (state && state.mode !== mode) throw new Error('Resume the migration using its original mode.');
    const analysis = await this.analyze(targetStoreId);
    if (!state && mode === 'create-cloud-store' && Object.values(analysis.remoteCounts).some((count) => count > 0)) {
      throw new Error('The selected cloud store is not empty. Choose merge instead.');
    }
    const source = (await this.database.storeSettings.toCollection().first())?.id;
    if (!state) {
      const backup = await this.backup(source);
      state = {
        id,
        mode,
        status: 'backed-up',
        sourceStoreId: source,
        targetStoreId,
        backupId: backup.id,
        startedAt: nowUtcIso(),
        updatedAt: nowUtcIso(),
        processedTables: mode === 'download-cloud' ? [] : [BASELINE_STEP],
        countsBefore: analysis.counts,
        totalsBefore: analysis.totals,
        duplicateCount: analysis.duplicates.length,
      };
      await this.database.migrationState.add(state);
    }

    // Phase 21 extends a previously completed account-linking migration. Take a
    // fresh recovery point and validation baseline before processing historical
    // inventory and sales that may have been created after the original run.
    if (mode !== 'download-cloud' && !state.processedTables.includes(BASELINE_STEP)) {
      const backup = await this.backup(source);
      state = {
        ...state,
        status: 'backed-up',
        backupId: backup.id,
        countsBefore: analysis.counts,
        totalsBefore: analysis.totals,
        processedTables: [...state.processedTables, BASELINE_STEP],
        updatedAt: nowUtcIso(),
        lastError: undefined,
      };
      await this.database.migrationState.put(state);
    }

    try {
      state = await this.normalizeSupportedIds(state);
      if (mode === 'download-cloud' && !state.processedTables.includes('__cleared__')) {
        await this.database.transaction(
          'rw',
          [
            ...this.dataTables().filter((table) => table.name !== 'storeSettings' && table.name !== 'userProfiles'),
            this.database.syncQueue,
            this.database.syncState,
            this.database.migrationState,
          ],
          async () => {
            for (const table of this.dataTables()) {
              if (table.name !== 'storeSettings' && table.name !== 'userProfiles') await table.clear();
            }
            await this.database.syncQueue.clear();
            await this.database.syncState.clear();
            state = {
              ...state!,
              status: 'migrating',
              processedTables: [...state!.processedTables, '__cleared__'],
              updatedAt: nowUtcIso(),
            };
            await this.database.migrationState.put(state);
          },
        );
      }

      if (mode !== 'download-cloud') {
        for (const table of this.dataTables()) {
          if (state.processedTables.includes(table.name)) continue;
          const entityType = supported[table.name];
          const shouldUpload = Boolean(entityType) || transactionTables.has(table.name);
          const dexieTables = entityType
            ? [table, this.database.syncQueue, this.database.migrationState]
            : [table, this.database.migrationState];
          await this.database.transaction('rw', dexieTables, async () => {
            const rows = (await table.toArray()) as Row[];
            for (const row of rows) {
              if (typeof row.id !== 'string') continue;
              const fallback = nowUtcIso();
              const createdAt =
                row.sync?.createdAt ??
                originalTime(row, ['createdAt', 'date', 'restockDate', 'startDate', 'payPeriodStart', 'dueDate', 'paidDate']) ??
                fallback;
              const updatedAt = row.sync?.updatedAt ?? originalTime(row, ['updatedAt']) ?? createdAt;
              const migrated = {
                ...row,
                sync: {
                  ...(row.sync ?? { createdAt, updatedAt, deletedAt: null }),
                  storeId: targetStoreId,
                  deviceId,
                  updatedBy: userId,
                  version: shouldUpload ? 1 : (row.sync?.version ?? 1),
                  baseVersion: null,
                  syncStatus: shouldUpload ? 'pending' : (row.sync?.syncStatus ?? 'pending'),
                },
              } as Row;
              await table.put(migrated);
              if (entityType) {
                await this.database.syncQueue.add({
                  operationId: generateId(),
                  storeId: targetStoreId,
                  entityType,
                  entityId: row.id,
                  operation: migrated.sync?.deletedAt ? 'delete' : 'upsert',
                  payload: migrated,
                  createdAt: nowUtcIso(),
                  attempts: 0,
                  status: 'pending',
                });
              }
            }
            state = {
              ...state!,
              status: 'migrating',
              processedTables: [...state!.processedTables, table.name],
              updatedAt: nowUtcIso(),
            };
            await this.database.migrationState.put(state);
          });
        }
        state = await this.queueInventoryAndSales(state, targetStoreId, userId, deviceId);
      }

      state = { ...state, status: 'syncing', updatedAt: nowUtcIso() };
      await this.database.migrationState.put(state);
      await this.acknowledgeAlreadyUploadedMasterOperations(targetStoreId, state.countsBefore);
      let queueDrained = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await runSync();
        if (result.skippedReason) throw new Error(result.skippedReason);
        if (result.failed) {
          const failed = await this.database.syncQueue.where('storeId').equals(targetStoreId).filter((item) => item.status === 'failed').toArray();
          const details = failed.slice(0, 3).map((item) => `${item.entityType}: ${item.lastError ?? 'Cloud rejected the operation.'}`).join(' | ');
          throw new Error(`${result.failed} operations remain queued${details ? ` — ${details}` : '.'}`);
        }
        const remaining = await this.database.syncQueue.where('storeId').equals(targetStoreId).toArray();
        if (remaining.length === 0) {
          queueDrained = true;
          break;
        }
        if (result.attempted === 0) {
          const nextRetry = remaining.flatMap((item) => item.nextAttemptAt ? [Date.parse(item.nextAttemptAt)] : []).sort((a, b) => a - b)[0];
          const waitMs = Number.isFinite(nextRetry) ? Math.min(1_000, Math.max(50, nextRetry - Date.now())) : 50;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
      if (!queueDrained) throw new Error('Initial migration exceeded the synchronization batch limit.');

      state = { ...state, status: 'validating', updatedAt: nowUtcIso() };
      await this.database.migrationState.put(state);
      const after = await this.snapshot();
      if (mode !== 'download-cloud') {
        const generatedMovements = ((after.data.stockMovements ?? []) as StockMovement[]).filter(
          (movement) => movement.notes === OPENING_NOTE || movement.notes === RECONCILIATION_NOTE,
        ).length;
        for (const [name, count] of Object.entries(state.countsBefore)) {
          const expected = name === 'stockMovements' ? count + generatedMovements : count;
          const actual = after.counts[name] ?? 0;
          // Audit history is append-only and authentication/device events can be
          // recorded while migration is in progress. Never allow it to shrink.
          if (name === 'auditLogs' ? actual < expected : actual !== expected) {
            throw new Error(`Count validation failed for ${name}.`);
          }
        }
        for (const [name, total] of Object.entries(state.totalsBefore)) {
          if ((after.totals[name] ?? 0) !== total) throw new Error(`Total validation failed for ${name}.`);
        }
      }
      state = {
        ...state,
        status: 'complete',
        countsAfter: after.counts,
        totalsAfter: after.totals,
        updatedAt: nowUtcIso(),
        lastError: undefined,
      };
      await this.database.migrationState.put(state);
      return state;
    } catch (error) {
      state = {
        ...state,
        status: 'failed',
        updatedAt: nowUtcIso(),
        lastError: error instanceof Error ? error.message : String(error),
      };
      await this.database.migrationState.put(state);
      throw error;
    }
  }

  async latestBackup(): Promise<MigrationBackup | undefined> {
    return this.database.migrationBackups.orderBy('createdAt').last();
  }
}
