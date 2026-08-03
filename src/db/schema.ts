// This file defines the Dexie database schemas for each version.

export const schemaV1 = {
  storeSettings: 'id',
  categories: 'id, name',
  products: 'id, categoryId, supplierId, sku, barcode, name',
  inventoryBatches: 'id, productId, supplierId, expirationDate, restockDate',
  stockMovements: 'id, productId, batchId, date, type',
  services: 'id, categoryId, name',
  customers: 'id, fullName, phoneNumber',
  utangEntries: 'id, customerId, date, type',
  sales: 'id, date, customerId, status',
  saleItems: 'id, saleId, itemId, itemType',
  gcashTransactions: 'id, date, type, customerId',
  bills: 'id, dueDate, status, category',
  employees: 'id, name, role',
  payrollEntries: 'id, employeeId, payPeriodStart',
  vaultTransactions: 'id, date, type',
  suppliers: 'id, name',
  notes: 'id, isPinned, createdAt',
  auditLogs: 'id, date, entityType, entityId'
};

export const schemaV2 = {
  ...schemaV1,
  sales: 'id, date, status, customerId, paymentMethod, [status+date], [customerId+date]',
  saleItems: 'id, saleId, itemId, itemType, [saleId+itemId]',
  inventoryBatches: 'id, productId, expirationDate, restockDate, remainingQuantity, [productId+expirationDate]',
  stockMovements: 'id, productId, batchId, date, type, [productId+date], [type+date]',
  utangEntries: 'id, customerId, date, type, [customerId+date]',
  gcashTransactions: 'id, date, type, customerId, [type+date]',
  bills: 'id, dueDate, status, category, [status+dueDate]',
  payrollEntries: 'id, employeeId, payPeriodStart, [employeeId+payPeriodStart]',
  vaultTransactions: 'id, date, type, [type+date]',
  auditLogs: 'id, date, entityType, entityId, [entityType+entityId], [entityType+date]'
};

export const schemaV3 = {
  ...schemaV2,
  userProfiles: 'id, &authUserId, employeeId, role, active'
};

const syncIndexes = 'sync.storeId, sync.syncStatus, sync.updatedAt, sync.deletedAt';

export const schemaV4 = Object.fromEntries(
  Object.entries(schemaV3).map(([tableName, indexes]) => [
    tableName,
    `${indexes}, ${syncIndexes}`,
  ])
) as Record<keyof typeof schemaV3, string>;

export const schemaV5 = {
  ...schemaV4,
  syncQueue: '++queueId, &operationId, storeId, entityType, entityId, operation, status, createdAt, nextAttemptAt, [storeId+status]',
  syncState: 'id, storeId, lastPulledAt, lastSuccessfulSyncAt',
  syncConflicts: '++id, storeId, entityType, entityId, detectedAt, resolved, [storeId+resolved]',
};
export const schemaV6 = {
  ...schemaV5,
  migrationBackups: 'id, createdAt, sourceStoreId',
  migrationState: 'id, targetStoreId, mode, status, updatedAt',
};
export const schemaV7 = {
  ...schemaV6,
  saleAdjustments: 'id, saleId, type, date, sync.storeId, sync.syncStatus, [saleId+date]',
};