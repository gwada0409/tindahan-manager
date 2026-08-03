import type { Table, Transaction } from 'dexie';
import type { SyncMetadata } from '@/domain/sync/sync.types';
import {
  createSyncMetadata,
  UNASSIGNED_LOCAL_STORE_ID,
} from '@/domain/sync/syncMetadata';
import { getOrCreateDeviceId } from '@/services/device/deviceIdentityService';
import { nowUtcIso, toUtcIso } from '@/shared/utils/date';

const SYNCABLE_TABLES = [
  'storeSettings',
  'categories',
  'products',
  'inventoryBatches',
  'stockMovements',
  'services',
  'customers',
  'utangEntries',
  'sales',
  'saleItems',
  'gcashTransactions',
  'bills',
  'employees',
  'payrollEntries',
  'vaultTransactions',
  'suppliers',
  'notes',
  'auditLogs',
  'userProfiles',
] as const;

type MutableLegacyRecord = Record<string, unknown> & {
  id?: unknown;
  sync?: SyncMetadata;
};

function firstTimestamp(
  record: MutableLegacyRecord,
  fieldNames: string[],
  fallback: string
): string {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];
    if (value instanceof Date || typeof value === 'string' || typeof value === 'number') {
      const timestamp = toUtcIso(value, '');
      if (timestamp) return timestamp;
    }
  }
  return fallback;
}

/**
 * V1 -> V2 adds indexes only. Dexie builds them without changing record data.
 */
export async function migrateV1toV2(_tx: Transaction): Promise<void> {
  console.log('Migrating database from V1 to V2: Building new indexes...');
}

export async function migrateV2toV3(tx: Transaction): Promise<void> {
  console.log('Migrating database from V2 to V3: Adding UserProfiles and store branding defaults...');
  const storeTable = tx.table('storeSettings') as Table<MutableLegacyRecord, string>;
  const stores = await storeTable.toArray();

  for (const store of stores) {
    let updated = false;
    if (!store.applicationName) {
      store.applicationName = 'Tindahan Manager';
      updated = true;
    }
    if (!store.themePrimaryColor) {
      store.themePrimaryColor = '#15803D';
      updated = true;
    }
    if (!store.themeAccentColor) {
      store.themeAccentColor = '#0369A1';
      updated = true;
    }
    if (updated) {
      await storeTable.put(store);
    }
  }
}

/**
 * V3 -> V4 adds a nested synchronization envelope to every existing row.
 * Existing primary keys and business timestamps are not changed.
 */
export async function migrateV3toV4(tx: Transaction): Promise<void> {
  console.log('Migrating database from V3 to V4: Adding synchronization metadata...');

  const migrationTime = nowUtcIso();
  const deviceId = getOrCreateDeviceId();
  const storeTable = tx.table('storeSettings') as Table<MutableLegacyRecord, string>;
  const firstStore = await storeTable.toCollection().first();
  const primaryStoreId =
    typeof firstStore?.id === 'string'
      ? firstStore.id
      : UNASSIGNED_LOCAL_STORE_ID;

  for (const tableName of SYNCABLE_TABLES) {
    const table = tx.table(tableName) as Table<MutableLegacyRecord, string>;

    await table.toCollection().modify((record) => {
      if (record.sync) return;

      const recordStoreId =
        tableName === 'storeSettings' && typeof record.id === 'string'
          ? record.id
          : typeof record.storeId === 'string'
            ? record.storeId
            : primaryStoreId;

      const createdAt = firstTimestamp(
        record,
        [
          'createdAt',
          'date',
          'restockDate',
          'startDate',
          'payPeriodStart',
          'dueDate',
          'paidDate',
        ],
        migrationTime
      );
      const updatedAt = firstTimestamp(record, ['updatedAt'], createdAt);

      record.sync = createSyncMetadata({
        storeId: recordStoreId,
        deviceId,
        createdAt,
        updatedAt,
      });
    });
  }
}

/** V4 -> V5 adds durable synchronization bookkeeping tables only. */
export async function migrateV4toV5(_tx: Transaction): Promise<void> {
  console.log('Migrating database from V4 to V5: Adding durable sync queue tables...');
}
/** V5 -> V6 adds resumable account-linking state and local pre-migration backups. */
export async function migrateV5toV6(_tx: Transaction): Promise<void> {
  console.log('Migrating database from V5 to V6: Adding account-linking records...');
}
/** V6 -> V7 adds immutable sale compensation records only. */
export async function migrateV6toV7(_tx: Transaction): Promise<void> {
  console.log('Migrating database from V6 to V7: Adding sale adjustment records...');
}