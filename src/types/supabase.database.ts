export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StoreMemberRole = 'owner' | 'administrator' | 'cashier' | 'staff';

interface CloudMetadata {
  id: string;
  store_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
  updated_by: string;
  device_id: string;
}

type ServerManagedMetadata =
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'version'
  | 'updated_by';

type CloudInsert<Row extends CloudMetadata> =
  Omit<Row, ServerManagedMetadata>
  & Partial<Pick<Row, ServerManagedMetadata>>;

type CloudUpdate<Row extends CloudMetadata> =
  Partial<Omit<Row, 'id' | 'store_id' | 'created_at'>>;

interface TableDefinition<Row, Insert, Update> {
  Row: Row & Record<string, unknown>;
  Insert: Insert & Record<string, unknown>;
  Update: Update & Record<string, unknown>;
  Relationships: [];
}

export interface StoreRow {
  id: string;
  name: string;
  owner_user_id: string;
  owner_name: string;
  address: string;
  contact: string;
  currency: string;
  timezone: string;
  expiration_warning_days: number;
  allow_negative_inventory: boolean;
  theme_preference: 'light' | 'dark';
  application_name: string | null;
  theme_primary_color: string | null;
  theme_accent_color: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreMemberRow {
  id: string;
  store_id: string;
  user_id: string;
  role: StoreMemberRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeviceRow {
  id: string;
  device_key: string;
  store_id: string;
  user_id: string;
  name: string;
  last_seen_at: string;
  last_sync_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCategoryRow extends CloudMetadata {
  server_changed_at: string;
  name: string;
}

export interface SupplierRow extends CloudMetadata {
  server_changed_at: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export interface ProductRow extends CloudMetadata {
  server_changed_at: string;
  category_id: string;
  supplier_id: string | null;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  description: string;
  active: boolean;
}

export interface InventoryBatchRow extends CloudMetadata {
  product_id: string;
  supplier_id: string | null;
  quantity_received: number;
  remaining_quantity: number;
  unit_cost: number;
  restock_date: string;
  expiration_date: string | null;
  reference_number: string;
  notes: string;
}

export interface StockMovementRow extends CloudMetadata {
  product_id: string;
  batch_id: string | null;
  movement_type: 'restock' | 'adjustment' | 'damaged' | 'expired' | 'return' | 'sale' | 'transfer-out' | 'transfer-in';
  signed_quantity: number;
  occurred_at: string;
  reference_id: string | null;
  notes: string;
  operation_id: string;
}

export interface CustomerRow extends CloudMetadata {
  server_changed_at: string;
  full_name: string;
  phone_number: string;
  address: string;
  credit_limit: number;
  notes: string;
  active: boolean;
}

export interface SaleRow extends CloudMetadata {
  occurred_at: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: 'cash' | 'gcash' | 'utang';
  amount_received: number | null;
  change_amount: number | null;
  reference_number: string | null;
  customer_id: string | null;
  status: 'completed' | 'voided';
  void_reason: string | null;
  operation_id: string;
}

export interface SaleItemRow extends CloudMetadata {
  sale_id: string;
  item_id: string;
  item_type: 'product';
  name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  batch_id: string | null;
}

export interface UtangEntryRow extends CloudMetadata {
  customer_id: string;
  occurred_at: string;
  entry_type: 'charge' | 'payment' | 'adjustment';
  amount: number;
  reference_id: string | null;
  notes: string;
  operation_id: string;
}

export interface GCashTransactionRow extends CloudMetadata {
  occurred_at: string;
  transaction_type: 'cash-in' | 'cash-out' | 'sale' | 'increase' | 'decrease' | 'adjustment';
  amount: number;
  service_fee: number;
  customer_id: string | null;
  reference_number: string;
  notes: string;
  operation_id: string;
}

export interface BillRow extends CloudMetadata {
  name: string;
  category: string;
  provider: string;
  amount: number;
  due_date: string;
  recurrence: 'none' | 'weekly' | 'monthly' | 'yearly';
  status: 'upcoming' | 'due-soon' | 'due-today' | 'overdue' | 'paid';
  paid_date: string | null;
  payment_method: string | null;
  reference_number: string | null;
  notes: string;
}

export interface EmployeeRow extends CloudMetadata {
  name: string;
  role: string;
  contact: string;
  start_date: string;
  pay_type: 'daily' | 'weekly' | 'semi-monthly' | 'monthly' | 'per-job' | 'custom';
  default_rate: number;
  active: boolean;
  notes: string;
}

export interface PayrollEntryRow extends CloudMetadata {
  employee_id: string;
  pay_period_start: string;
  pay_period_end: string;
  base_amount: number;
  additional_pay: number;
  deductions: number;
  net_pay: number;
  paid_date: string;
  payment_method: string;
  notes: string;
  operation_id: string;
}

export interface VaultTransactionRow extends CloudMetadata {
  occurred_at: string;
  transaction_type: 'opening' | 'deposit' | 'withdrawal' | 'sale-deposit' | 'expense' | 'payroll' | 'adjustment';
  amount: number;
  reference_id: string | null;
  notes: string;
  operation_id: string;
}

export interface AuditLogRow extends CloudMetadata {
  occurred_at: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Json;
  operation_id: string;
}

export interface SyncOperationRow extends CloudMetadata {
  operation_id: string;
  entity_type: string;
  entity_id: string;
  operation: 'upsert' | 'delete' | 'transaction';
  payload: Json;
  processed_at: string | null;
}

type MutableCloudTable<Row extends CloudMetadata> = TableDefinition<
  Row,
  CloudInsert<Row>,
  CloudUpdate<Row>
>;

type ImmutableCloudTable<Row extends CloudMetadata> = TableDefinition<
  Row,
  CloudInsert<Row>,
  Record<string, never>
>;

export interface Database {
  public: {
    Tables: {
      stores: TableDefinition<
        StoreRow,
        Omit<StoreRow, 'id' | 'created_at' | 'updated_at'>
          & Partial<Pick<StoreRow, 'id' | 'created_at' | 'updated_at'>>,
        Partial<Omit<StoreRow, 'id' | 'owner_user_id' | 'created_at'>>
      >;
      store_members: TableDefinition<
        StoreMemberRow,
        Omit<StoreMemberRow, 'id' | 'active' | 'created_at' | 'updated_at'>
          & Partial<Pick<StoreMemberRow, 'id' | 'active' | 'created_at' | 'updated_at'>>,
        Partial<Omit<StoreMemberRow, 'id' | 'store_id' | 'user_id' | 'created_at'>>
      >;
      devices: TableDefinition<
        DeviceRow,
        Omit<DeviceRow, 'id' | 'name' | 'last_seen_at' | 'last_sync_at' | 'revoked_at' | 'created_at' | 'updated_at'>
          & Partial<Pick<DeviceRow, 'id' | 'name' | 'last_seen_at' | 'last_sync_at' | 'revoked_at' | 'created_at' | 'updated_at'>>,
        Partial<Omit<DeviceRow, 'id' | 'store_id' | 'user_id' | 'device_key' | 'created_at'>>
      >;
      product_categories: MutableCloudTable<ProductCategoryRow>;
      suppliers: MutableCloudTable<SupplierRow>;
      products: MutableCloudTable<ProductRow>;
      inventory_batches: MutableCloudTable<InventoryBatchRow>;
      stock_movements: ImmutableCloudTable<StockMovementRow>;
      customers: MutableCloudTable<CustomerRow>;
      sales: ImmutableCloudTable<SaleRow>;
      sale_items: ImmutableCloudTable<SaleItemRow>;
      utang_entries: ImmutableCloudTable<UtangEntryRow>;
      gcash_transactions: ImmutableCloudTable<GCashTransactionRow>;
      bills: MutableCloudTable<BillRow>;
      employees: MutableCloudTable<EmployeeRow>;
      payroll_entries: ImmutableCloudTable<PayrollEntryRow>;
      vault_transactions: ImmutableCloudTable<VaultTransactionRow>;
      audit_logs: ImmutableCloudTable<AuditLogRow>;
      sync_operations: ImmutableCloudTable<SyncOperationRow>;
    };
    Views: Record<string, never>;
    Functions: {
      create_store_with_owner: {
        Args: { p_store_name: string } & Record<string, unknown>;
        Returns: string;
      };
      cleanup_sync_receipts: {
        Args: { p_store_id: string; p_retention_days: number; p_limit: number } & Record<string, unknown>;
        Returns: number;
      };
      revoke_store_device: {
        Args: { p_store_id: string; p_device_id: string } & Record<string, unknown>;
        Returns: string;
      };
      process_sync_operations: {
        Args: { p_operations: Json } & Record<string, unknown>;
        Returns: Json;
      };
      pull_sync_changes: {
        Args: { p_store_id: string; p_after_changed_at?: string; p_after_id?: string; p_limit?: number } & Record<string, unknown>;
        Returns: Json;
      };
      process_financial_operation: {
        Args: { p_operation: Json } & Record<string, unknown>;
        Returns: Json;
      };      process_inventory_operation: {
        Args: { p_operation: Json } & Record<string, unknown>;
        Returns: Json;
      };      process_sale_transaction: {
        Args: { p_operation: Json } & Record<string, unknown>;
        Returns: Json;
      };      process_sale_compensation: {
        Args: { p_operation: Json } & Record<string, unknown>;
        Returns: Json;
      };

    };
    Enums: {
      store_member_role: StoreMemberRole;
    };
    CompositeTypes: Record<string, never>;
  };
}