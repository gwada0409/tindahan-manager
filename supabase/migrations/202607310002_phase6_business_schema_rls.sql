-- Phase 6: store-scoped cloud business schema and Row Level Security.
-- Dexie remains the application working database; this migration does not upload local data.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_active_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.store_members
    where store_id = p_store_id
      and user_id = (select auth.uid())
      and active
  );
$$;

create function private.has_store_role(
  p_store_id uuid,
  p_roles public.store_member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.store_members
    where store_id = p_store_id
      and user_id = (select auth.uid())
      and active
      and role = any(p_roles)
  );
$$;

revoke all on function private.is_active_store_member(uuid) from public;
revoke all on function private.has_store_role(uuid, public.store_member_role[]) from public;
grant execute on function private.is_active_store_member(uuid) to authenticated;
grant execute on function private.has_store_role(uuid, public.store_member_role[]) to authenticated;

alter table public.stores
  add column owner_name text not null default '',
  add column address text not null default '',
  add column contact text not null default '',
  add column currency text not null default 'PHP',
  add column timezone text not null default 'Asia/Manila',
  add column expiration_warning_days integer not null default 30
    check (expiration_warning_days between 0 and 3650),
  add column allow_negative_inventory boolean not null default false,
  add column theme_preference text not null default 'light'
    check (theme_preference in ('light', 'dark')),
  add column application_name text,
  add column theme_primary_color text,
  add column theme_accent_color text;

create function public.prevent_store_owner_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Store ownership cannot be changed through a direct update';
  end if;
  return new;
end;
$$;

create trigger stores_prevent_owner_change
before update on public.stores
for each row execute function public.prevent_store_owner_change();

drop policy stores_update_owner on public.stores;
create policy stores_update_manager on public.stores
for update to authenticated
using (
  private.has_store_role(
    id,
    array['owner', 'administrator']::public.store_member_role[]
  )
)
with check (
  private.has_store_role(
    id,
    array['owner', 'administrator']::public.store_member_role[]
  )
);

-- Administrators may manage cashier/staff memberships. Only owners may manage
-- administrator memberships. Owner memberships remain immutable.
drop policy store_members_insert_manager on public.store_members;
drop policy store_members_update_manager on public.store_members;
drop policy store_members_delete_manager on public.store_members;

create policy store_members_insert_manager on public.store_members
for insert to authenticated
with check (
  role <> 'owner'::public.store_member_role
  and (
    private.has_store_role(
      store_id,
      array['owner']::public.store_member_role[]
    )
    or (
      role in (
        'cashier'::public.store_member_role,
        'staff'::public.store_member_role
      )
      and private.has_store_role(
        store_id,
        array['administrator']::public.store_member_role[]
      )
    )
  )
);

create policy store_members_update_manager on public.store_members
for update to authenticated
using (
  role <> 'owner'::public.store_member_role
  and (
    private.has_store_role(
      store_id,
      array['owner']::public.store_member_role[]
    )
    or (
      role in (
        'cashier'::public.store_member_role,
        'staff'::public.store_member_role
      )
      and private.has_store_role(
        store_id,
        array['administrator']::public.store_member_role[]
      )
    )
  )
)
with check (
  role <> 'owner'::public.store_member_role
  and (
    private.has_store_role(
      store_id,
      array['owner']::public.store_member_role[]
    )
    or (
      role in (
        'cashier'::public.store_member_role,
        'staff'::public.store_member_role
      )
      and private.has_store_role(
        store_id,
        array['administrator']::public.store_member_role[]
      )
    )
  )
);

create policy store_members_delete_manager on public.store_members
for delete to authenticated
using (
  role <> 'owner'::public.store_member_role
  and (
    private.has_store_role(
      store_id,
      array['owner']::public.store_member_role[]
    )
    or (
      role in (
        'cashier'::public.store_member_role,
        'staff'::public.store_member_role
      )
      and private.has_store_role(
        store_id,
        array['administrator']::public.store_member_role[]
      )
    )
  )
);

drop policy if exists stores_select_member on public.stores;
create policy stores_select_member on public.stores
for select to authenticated
using (private.is_active_store_member(id));

drop policy if exists store_members_select_member on public.store_members;
create policy store_members_select_member on public.store_members
for select to authenticated
using (private.is_active_store_member(store_id));

drop policy if exists devices_select_own on public.devices;
create policy devices_select_own on public.devices
for select to authenticated
using (
  user_id = (select auth.uid())
  and private.is_active_store_member(store_id)
);

drop policy if exists devices_insert_own on public.devices;
create policy devices_insert_own on public.devices
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_active_store_member(store_id)
);

drop policy if exists devices_update_own on public.devices;
create policy devices_update_own on public.devices
for update to authenticated
using (
  user_id = (select auth.uid())
  and private.is_active_store_member(store_id)
)
with check (
  user_id = (select auth.uid())
  and private.is_active_store_member(store_id)
);

drop function public.is_active_store_member(uuid);
drop function public.has_store_role(uuid, public.store_member_role[]);

create function private.is_registered_device(
  p_store_id uuid,
  p_device_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.devices
    where store_id = p_store_id
      and user_id = (select auth.uid())
      and device_key = p_device_id
      and revoked_at is null
  );
$$;

create function private.can_write_business(
  p_store_id uuid,
  p_device_id text,
  p_updated_by uuid,
  p_roles public.store_member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_updated_by = (select auth.uid())
    and private.has_store_role(p_store_id, p_roles)
    and private.is_registered_device(p_store_id, p_device_id);
$$;

revoke all on function private.is_registered_device(uuid, text) from public;
revoke all on function private.can_write_business(
  uuid,
  text,
  uuid,
  public.store_member_role[]
) from public;
grant execute on function private.is_registered_device(uuid, text) to authenticated;
grant execute on function private.can_write_business(
  uuid,
  text,
  uuid,
  public.store_member_role[]
) to authenticated;

create table public.product_categories (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict
);

create unique index product_categories_active_name_uidx
  on public.product_categories (store_id, lower(name))
  where deleted_at is null;

create table public.suppliers (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 160),
  contact_person text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict
);

create table public.products (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  category_id uuid not null,
  supplier_id uuid,
  name text not null check (length(btrim(name)) between 1 and 200),
  sku text not null default '',
  barcode text not null default '',
  unit text not null default 'piece',
  cost_price bigint not null default 0 check (cost_price >= 0),
  selling_price bigint not null default 0 check (selling_price >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  foreign key (store_id, category_id)
    references public.product_categories(store_id, id) on delete restrict,
  foreign key (store_id, supplier_id)
    references public.suppliers(store_id, id) on delete restrict,
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict
);

create unique index products_active_sku_uidx
  on public.products (store_id, sku)
  where deleted_at is null and sku <> '';
create unique index products_active_barcode_uidx
  on public.products (store_id, barcode)
  where deleted_at is null and barcode <> '';

create table public.inventory_batches (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  product_id uuid not null,
  supplier_id uuid,
  quantity_received integer not null check (quantity_received > 0),
  remaining_quantity integer not null,
  unit_cost bigint not null check (unit_cost >= 0),
  restock_date timestamptz not null,
  expiration_date timestamptz,
  reference_number text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  foreign key (store_id, product_id)
    references public.products(store_id, id) on delete restrict,
  foreign key (store_id, supplier_id)
    references public.suppliers(store_id, id) on delete restrict,
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict
);

create table public.stock_movements (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  product_id uuid not null,
  batch_id uuid,
  movement_type text not null check (
    movement_type in ('restock', 'adjustment', 'damaged', 'expired', 'return', 'sale')
  ),
  signed_quantity integer not null check (signed_quantity <> 0),
  occurred_at timestamptz not null,
  reference_id uuid,
  notes text not null default '',
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  unique (store_id, operation_id),
  foreign key (store_id, product_id)
    references public.products(store_id, id) on delete restrict,
  foreign key (store_id, batch_id)
    references public.inventory_batches(store_id, id) on delete restrict,
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict,
  check (deleted_at is null)
);

create table public.customers (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  phone_number text not null default '',
  address text not null default '',
  credit_limit bigint not null default 0 check (credit_limit >= 0),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict
);

create table public.sales (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  occurred_at timestamptz not null,
  subtotal bigint not null check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0),
  total bigint not null check (total >= 0),
  payment_method text not null check (payment_method in ('cash', 'gcash', 'utang')),
  amount_received bigint,
  change_amount bigint,
  reference_number text,
  customer_id uuid,
  status text not null check (status in ('completed', 'voided')),
  void_reason text,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  unique (store_id, operation_id),
  foreign key (store_id, customer_id)
    references public.customers(store_id, id) on delete restrict,
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict,
  check (deleted_at is null)
);

create table public.sale_items (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  sale_id uuid not null,
  item_id uuid not null,
  item_type text not null check (item_type = 'product'),
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  discount bigint not null default 0 check (discount >= 0),
  total bigint not null check (total >= 0),
  batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  foreign key (store_id, sale_id)
    references public.sales(store_id, id) on delete restrict,
  foreign key (store_id, item_id)
    references public.products(store_id, id) on delete restrict,
  foreign key (store_id, batch_id)
    references public.inventory_batches(store_id, id) on delete restrict,
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict,
  check (deleted_at is null)
);

create table public.utang_entries (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  customer_id uuid not null,
  occurred_at timestamptz not null,
  entry_type text not null check (entry_type in ('charge', 'payment', 'adjustment')),
  amount bigint not null check (amount <> 0),
  reference_id uuid,
  notes text not null default '',
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  unique (store_id, operation_id),
  foreign key (store_id, customer_id)
    references public.customers(store_id, id) on delete restrict,
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict,
  check (deleted_at is null)
);

create table public.gcash_transactions (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  occurred_at timestamptz not null,
  transaction_type text not null check (
    transaction_type in ('cash-in', 'cash-out', 'sale', 'increase', 'decrease', 'adjustment')
  ),
  amount bigint not null,
  service_fee bigint not null default 0,
  customer_id uuid,
  reference_number text not null default '',
  notes text not null default '',
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  unique (store_id, operation_id),
  foreign key (store_id, customer_id)
    references public.customers(store_id, id) on delete restrict,
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict,
  check (deleted_at is null)
);

create table public.bills (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 200),
  category text not null default '',
  provider text not null default '',
  amount bigint not null check (amount >= 0),
  due_date timestamptz not null,
  recurrence text not null check (recurrence in ('none', 'weekly', 'monthly', 'yearly')),
  status text not null check (
    status in ('upcoming', 'due-soon', 'due-today', 'overdue', 'paid')
  ),
  paid_date timestamptz,
  payment_method text,
  reference_number text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict
);

create table public.employees (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 200),
  role text not null default '',
  contact text not null default '',
  start_date timestamptz not null,
  pay_type text not null check (
    pay_type in ('daily', 'weekly', 'semi-monthly', 'monthly', 'per-job', 'custom')
  ),
  default_rate bigint not null default 0 check (default_rate >= 0),
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict
);

create table public.payroll_entries (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  employee_id uuid not null,
  pay_period_start timestamptz not null,
  pay_period_end timestamptz not null,
  base_amount bigint not null,
  additional_pay bigint not null default 0,
  deductions bigint not null default 0,
  net_pay bigint not null,
  paid_date timestamptz not null,
  payment_method text not null,
  notes text not null default '',
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  unique (store_id, operation_id),
  foreign key (store_id, employee_id)
    references public.employees(store_id, id) on delete restrict,
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict,
  check (deleted_at is null)
);

create table public.vault_transactions (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  occurred_at timestamptz not null,
  transaction_type text not null check (
    transaction_type in (
      'opening',
      'deposit',
      'withdrawal',
      'sale-deposit',
      'expense',
      'payroll',
      'adjustment'
    )
  ),
  amount bigint not null,
  reference_id uuid,
  notes text not null default '',
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  unique (store_id, operation_id),
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict,
  check (deleted_at is null)
);

create table public.audit_logs (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  occurred_at timestamptz not null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  unique (store_id, operation_id),
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict,
  check (deleted_at is null)
);

-- Global idempotency registry for later push/RPC processing. Phase 6 creates
-- the protected table only; Phase 8 implements the processing protocol.
create table public.sync_operations (
  id uuid primary key,
  operation_id uuid not null unique,
  store_id uuid not null references public.stores(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  operation text not null check (operation in ('upsert', 'delete', 'transaction')),
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  device_id text not null,
  unique (store_id, id),
  foreign key (store_id, updated_by, device_id)
    references public.devices(store_id, user_id, device_key) on delete restrict,
  check (deleted_at is null)
);

-- Common store/cursor indexes plus relationship and transaction indexes.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'product_categories',
    'suppliers',
    'products',
    'inventory_batches',
    'stock_movements',
    'customers',
    'sales',
    'sale_items',
    'utang_entries',
    'gcash_transactions',
    'bills',
    'employees',
    'payroll_entries',
    'vault_transactions',
    'audit_logs',
    'sync_operations'
  ]
  loop
    execute format(
      'create index %I on public.%I (store_id)',
      table_name || '_store_idx',
      table_name
    );
    execute format(
      'create index %I on public.%I (store_id, updated_at, id)',
      table_name || '_updated_cursor_idx',
      table_name
    );
    execute format(
      'create index %I on public.%I (store_id, deleted_at)',
      table_name || '_deleted_idx',
      table_name
    );
  end loop;
end;
$$;

create index products_category_idx on public.products (store_id, category_id);
create index products_supplier_idx on public.products (store_id, supplier_id);
create index inventory_batches_product_idx
  on public.inventory_batches (store_id, product_id);
create index inventory_batches_supplier_idx
  on public.inventory_batches (store_id, supplier_id);
create index inventory_batches_expiration_idx
  on public.inventory_batches (store_id, expiration_date);
create index stock_movements_product_idx
  on public.stock_movements (store_id, product_id, occurred_at);
create index stock_movements_batch_idx
  on public.stock_movements (store_id, batch_id);
create index stock_movements_reference_idx
  on public.stock_movements (store_id, reference_id);
create index sales_customer_idx on public.sales (store_id, customer_id);
create index sales_occurred_idx on public.sales (store_id, occurred_at);
create index sale_items_sale_idx on public.sale_items (store_id, sale_id);
create index sale_items_item_idx on public.sale_items (store_id, item_id);
create index utang_entries_customer_idx
  on public.utang_entries (store_id, customer_id, occurred_at);
create index utang_entries_reference_idx
  on public.utang_entries (store_id, reference_id);
create index gcash_transactions_customer_idx
  on public.gcash_transactions (store_id, customer_id);
create index gcash_transactions_occurred_idx
  on public.gcash_transactions (store_id, occurred_at);
create index bills_status_due_idx on public.bills (store_id, status, due_date);
create index payroll_entries_employee_idx
  on public.payroll_entries (store_id, employee_id, pay_period_start);
create index vault_transactions_reference_idx
  on public.vault_transactions (store_id, reference_id);
create index audit_logs_entity_idx
  on public.audit_logs (store_id, entity_type, entity_id);
create index sync_operations_entity_idx
  on public.sync_operations (store_id, entity_type, entity_id);
create index sync_operations_processed_idx
  on public.sync_operations (store_id, processed_at);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'product_categories',
    'suppliers',
    'products',
    'inventory_batches',
    'stock_movements',
    'customers',
    'sales',
    'sale_items',
    'utang_entries',
    'gcash_transactions',
    'bills',
    'employees',
    'payroll_entries',
    'vault_transactions',
    'audit_logs',
    'sync_operations'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I '
      || 'for each row execute function public.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
  end loop;
end;
$$;

create function private.enforce_manager_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.deleted_at is distinct from old.deleted_at
    and not private.has_store_role(
      old.store_id,
      array['owner', 'administrator']::public.store_member_role[]
    )
  then
    raise exception 'Only an owner or administrator may change deletion state';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_manager_soft_delete() from public;

create trigger product_categories_manager_soft_delete
before update on public.product_categories
for each row execute function private.enforce_manager_soft_delete();
create trigger suppliers_manager_soft_delete
before update on public.suppliers
for each row execute function private.enforce_manager_soft_delete();
create trigger products_manager_soft_delete
before update on public.products
for each row execute function private.enforce_manager_soft_delete();
create trigger inventory_batches_manager_soft_delete
before update on public.inventory_batches
for each row execute function private.enforce_manager_soft_delete();
create trigger customers_manager_soft_delete
before update on public.customers
for each row execute function private.enforce_manager_soft_delete();
create trigger bills_manager_soft_delete
before update on public.bills
for each row execute function private.enforce_manager_soft_delete();
create trigger employees_manager_soft_delete
before update on public.employees
for each row execute function private.enforce_manager_soft_delete();

alter table public.product_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.utang_entries enable row level security;
alter table public.gcash_transactions enable row level security;
alter table public.bills enable row level security;
alter table public.employees enable row level security;
alter table public.payroll_entries enable row level security;
alter table public.vault_transactions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.sync_operations enable row level security;

-- Every active member may read store business data.
create policy product_categories_select_member on public.product_categories
for select to authenticated using (private.is_active_store_member(store_id));
create policy suppliers_select_member on public.suppliers
for select to authenticated using (private.is_active_store_member(store_id));
create policy products_select_member on public.products
for select to authenticated using (private.is_active_store_member(store_id));
create policy inventory_batches_select_member on public.inventory_batches
for select to authenticated using (private.is_active_store_member(store_id));
create policy stock_movements_select_member on public.stock_movements
for select to authenticated using (private.is_active_store_member(store_id));
create policy customers_select_member on public.customers
for select to authenticated using (private.is_active_store_member(store_id));
create policy sales_select_member on public.sales
for select to authenticated using (private.is_active_store_member(store_id));
create policy sale_items_select_member on public.sale_items
for select to authenticated using (private.is_active_store_member(store_id));
create policy utang_entries_select_member on public.utang_entries
for select to authenticated using (private.is_active_store_member(store_id));
create policy gcash_transactions_select_member on public.gcash_transactions
for select to authenticated using (private.is_active_store_member(store_id));
create policy bills_select_member on public.bills
for select to authenticated using (private.is_active_store_member(store_id));
create policy employees_select_member on public.employees
for select to authenticated using (private.is_active_store_member(store_id));
create policy payroll_entries_select_member on public.payroll_entries
for select to authenticated using (private.is_active_store_member(store_id));
create policy vault_transactions_select_member on public.vault_transactions
for select to authenticated using (private.is_active_store_member(store_id));
create policy audit_logs_select_member on public.audit_logs
for select to authenticated using (private.is_active_store_member(store_id));
create policy sync_operations_select_member on public.sync_operations
for select to authenticated using (private.is_active_store_member(store_id));

-- Catalog/inventory/customer writes preserve the current employee permission
-- matrix. The soft-delete triggers reserve archival for managers.
create policy product_categories_insert_worker on public.product_categories
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy product_categories_update_worker on public.product_categories
for update to authenticated
using (private.is_active_store_member(store_id))
with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy suppliers_insert_worker on public.suppliers
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy suppliers_update_worker on public.suppliers
for update to authenticated
using (private.is_active_store_member(store_id))
with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy products_insert_worker on public.products
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy products_update_worker on public.products
for update to authenticated
using (private.is_active_store_member(store_id))
with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy inventory_batches_insert_worker on public.inventory_batches
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy inventory_batches_update_worker on public.inventory_batches
for update to authenticated
using (private.is_active_store_member(store_id))
with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy customers_insert_worker on public.customers
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy customers_update_worker on public.customers
for update to authenticated
using (private.is_active_store_member(store_id))
with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy bills_insert_worker on public.bills
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy bills_update_worker on public.bills
for update to authenticated
using (private.is_active_store_member(store_id))
with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);

-- Immutable operational/financial rows expose insert but no update/delete policy.
create policy stock_movements_insert_worker on public.stock_movements
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy sales_insert_worker on public.sales
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy sale_items_insert_worker on public.sale_items
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy utang_entries_insert_worker on public.utang_entries
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy gcash_transactions_insert_worker on public.gcash_transactions
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy audit_logs_insert_worker on public.audit_logs
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);
create policy sync_operations_insert_worker on public.sync_operations
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
  )
);

-- Employee/payroll/vault records retain the current admin-only UI boundary.
create policy employees_insert_manager on public.employees
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator']::public.store_member_role[]
  )
);
create policy employees_update_manager on public.employees
for update to authenticated
using (
  private.has_store_role(
    store_id,
    array['owner', 'administrator']::public.store_member_role[]
  )
)
with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator']::public.store_member_role[]
  )
);
create policy payroll_entries_insert_manager on public.payroll_entries
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator']::public.store_member_role[]
  )
);
create policy vault_transactions_insert_manager on public.vault_transactions
for insert to authenticated with check (
  private.can_write_business(
    store_id, device_id, updated_by,
    array['owner', 'administrator']::public.store_member_role[]
  )
);

revoke all on table
  public.product_categories,
  public.suppliers,
  public.products,
  public.inventory_batches,
  public.stock_movements,
  public.customers,
  public.sales,
  public.sale_items,
  public.utang_entries,
  public.gcash_transactions,
  public.bills,
  public.employees,
  public.payroll_entries,
  public.vault_transactions,
  public.audit_logs,
  public.sync_operations
from anon;

grant select, insert, update on table
  public.product_categories,
  public.suppliers,
  public.products,
  public.inventory_batches,
  public.customers,
  public.bills,
  public.employees
to authenticated;

grant select, insert on table
  public.stock_movements,
  public.sales,
  public.sale_items,
  public.utang_entries,
  public.gcash_transactions,
  public.payroll_entries,
  public.vault_transactions,
  public.audit_logs,
  public.sync_operations
to authenticated;

comment on table public.product_categories is
  'Store-scoped product categories. Soft deletion is manager-controlled.';
comment on table public.stock_movements is
  'Immutable signed inventory events. Current stock synchronization is implemented in a later phase.';
comment on table public.sales is
  'Immutable sale headers. Future void/refund behavior must use server-side compensating operations.';
comment on table public.sync_operations is
  'Global operation-ID registry reserved for the later durable push protocol.';
