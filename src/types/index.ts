export interface Store {
  id: string;
  name: string;
  ownerName: string;
  address: string;
  contact: string;
  currency: string;
  timezone: string;
  expirationWarningDays: number;
  allowNegativeInventory: boolean;
  themePreference: 'light' | 'dark';
  applicationName?: string;
  themePrimaryColor?: string;
  themeAccentColor?: string;
}

export type StockStatus = 'out-of-stock' | 'critical' | 'low-stock' | 'in-stock';

export interface ProductStockSummary {
  productId: string;
  availableQuantity: number;
  reservedQuantity: number;
  sellableQuantity: number;
  reorderLevel: number;
  status: StockStatus;
  nextExpirationDate?: Date;
}

export type UserRole = 'admin' | 'employee';

export interface UserProfile {
  id: string;
  authUserId: string;
  employeeId?: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export type InventoryPermission =
  | 'inventory:view'
  | 'inventory:create-product'
  | 'inventory:edit-product'
  | 'inventory:restock'
  | 'inventory:adjust-stock'
  | 'inventory:delete-product';

export type Permission =
  | 'dashboard:view'
  | 'sales:use'
  | 'inventory:view'
  | 'inventory:manage'
  | InventoryPermission
  | 'services:manage'
  | 'utang:manage'
  | 'gcash:manage'
  | 'bills:manage'
  | 'employees:manage'
  | 'vault:manage'
  | 'reports:view'
  | 'settings:manage'
  | 'accounts:manage';

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  unit: string; // e.g. piece, pack, sachet, etc.
  costPrice: number; // Stored in cents
  sellingPrice: number; // Stored in cents
  reorderLevel: number;
  supplierId?: string;
  description: string;
  active: boolean;
}

export interface InventoryBatch {
  id: string;
  productId: string;
  quantityReceived: number;
  remainingQuantity: number;
  unitCost: number; // Stored in cents
  restockDate: Date;
  expirationDate?: Date;
  supplierId?: string;
  referenceNumber: string;
  notes: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  batchId?: string;
  type: 'restock' | 'adjustment' | 'damaged' | 'expired' | 'return' | 'sale';
  quantity: number; // Can be negative for sale/damaged/expired
  date: Date;
  referenceId?: string; // Link to sale or adjustment record
  notes: string;
}

export interface Service {
  id: string;
  name: string;
  categoryId: string;
  price: number; // Stored in cents
  durationMinutes?: number;
  description: string;
  active: boolean;
}

export interface Customer {
  id: string;
  fullName: string;
  phoneNumber: string;
  address: string;
  creditLimit: number; // Stored in cents
  notes: string;
  active: boolean;
  createdAt: Date;
}

export interface UtangEntry {
  id: string;
  customerId: string;
  date: Date;
  type: 'charge' | 'payment' | 'adjustment';
  amount: number; // Positive for charge, negative for payment
  referenceId?: string; // e.g., saleId
  notes: string;
}

export interface Sale {
  id: string;
  date: Date;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'gcash' | 'utang';
  amountReceived?: number;
  changeAmount?: number;
  referenceNumber?: string; // For GCash
  customerId?: string; // Required for utang
  status: 'completed' | 'voided';
  voidReason?: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  itemId: string; // productId or serviceId
  itemType: 'product' | 'service';
  name: string; // Snapshot at time of sale
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  batchId?: string; // Which batch was deducted (if product)
}

export interface GCashTransaction {
  id: string;
  date: Date;
  type: 'cash-in' | 'cash-out' | 'sale' | 'increase' | 'decrease' | 'adjustment';
  amount: number; // The principal amount affecting float
  serviceFee: number; // The fee collected
  customerId?: string;
  referenceNumber: string;
  notes: string;
}

export interface Bill {
  id: string;
  name: string;
  category: string;
  provider: string;
  amount: number;
  dueDate: Date;
  recurrence: 'none' | 'weekly' | 'monthly' | 'yearly';
  status: 'upcoming' | 'due-soon' | 'due-today' | 'overdue' | 'paid';
  paidDate?: Date;
  paymentMethod?: string;
  referenceNumber?: string;
  notes: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  contact: string;
  startDate: Date;
  payType: 'daily' | 'weekly' | 'semi-monthly' | 'monthly' | 'per-job' | 'custom';
  defaultRate: number; // Stored in cents
  active: boolean;
  notes: string;
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  baseAmount: number;
  additionalPay: number;
  deductions: number;
  netPay: number;
  paidDate: Date;
  paymentMethod: string;
  notes: string;
}

export interface VaultTransaction {
  id: string;
  date: Date;
  type: 'opening' | 'deposit' | 'withdrawal' | 'sale-deposit' | 'expense' | 'payroll' | 'adjustment';
  amount: number; // Stored in cents
  referenceId?: string;
  notes: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  reminderDate?: Date;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  date: Date;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}
