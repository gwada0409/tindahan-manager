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
