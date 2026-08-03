-- Phase 21: complete inventory/sales pull coverage and owner-controlled device restoration.
-- Additive only: existing business rows and revoked-device records are preserved.

alter table public.sales
  add column if not exists server_changed_at timestamptz not null default clock_timestamp();
alter table public.sale_items
  add column if not exists server_changed_at timestamptz not null default clock_timestamp();

drop trigger if exists sales_server_changed on public.sales;
create trigger sales_server_changed
before insert or update on public.sales
for each row execute function private.set_server_changed_at();

drop trigger if exists sale_items_server_changed on public.sale_items;
create trigger sale_items_server_changed
before insert or update on public.sale_items
for each row execute function private.set_server_changed_at();

create index if not exists sales_pull_idx on public.sales(store_id, server_changed_at, id);
create index if not exists sale_items_pull_idx on public.sale_items(store_id, server_changed_at, id);

create or replace function public.prevent_device_unrevocation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.revoked_at is not null
     and new.revoked_at is distinct from old.revoked_at
     and current_setting('app.device_restore_authorized', true) is distinct from 'on' then
    raise exception 'A revoked device can only be restored through the owner restore function';
  end if;
  return new;
end;
$$;

create or replace function public.restore_store_device(p_store_id uuid, p_device_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  restored_time timestamptz := now();
begin
  if not private.has_store_role(p_store_id, array['owner']::public.store_member_role[]) then
    raise exception 'Only the store owner can restore devices' using errcode = '42501';
  end if;

  perform set_config('app.device_restore_authorized', 'on', true);
  update public.devices
  set revoked_at = null
  where id = p_device_id
    and store_id = p_store_id
    and revoked_at is not null;

  if not found then
    raise exception 'Revoked device not found' using errcode = 'P0002';
  end if;
  return restored_time;
end;
$$;

revoke all on function public.restore_store_device(uuid, uuid) from public;
revoke all on function public.restore_store_device(uuid, uuid) from anon;
grant execute on function public.restore_store_device(uuid, uuid) to authenticated;

create or replace function public.pull_sync_changes(
  p_store_id uuid,
  p_after_changed_at timestamptz default '1970-01-01',
  p_after_id uuid default '00000000-0000-0000-0000-000000000000',
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  changes jsonb;
  row_count integer;
  last_changed_at timestamptz;
  last_id uuid;
begin
  if not private.is_active_store_member(p_store_id) then
    raise exception 'Active store membership is required' using errcode = '42501';
  end if;
  if p_limit not between 1 and 500 then
    raise exception 'Pull limit must be between 1 and 500' using errcode = '22023';
  end if;

  with combined as (
    select 'product_categories'::text entity_type, server_changed_at, id, to_jsonb(t) - 'server_changed_at' record
      from public.product_categories t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'suppliers', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.suppliers t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'products', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.products t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'customers', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.customers t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'inventory_batches', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.inventory_batches t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'stock_movements', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.stock_movements t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'sales', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.sales t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'sale_items', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.sale_items t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'utang_entries', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.utang_entries t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'gcash_transactions', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.gcash_transactions t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'bills', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.bills t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'employees', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.employees t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'payroll_entries', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.payroll_entries t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
    union all select 'vault_transactions', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.vault_transactions t where store_id = p_store_id and (server_changed_at, id) > (p_after_changed_at, p_after_id)
  ),
  page as (
    select * from combined order by server_changed_at, id limit p_limit
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object('entityType', entity_type, 'changedAt', server_changed_at, 'record', record)
        order by server_changed_at, id
      ),
      '[]'
    ),
    count(*),
    max(server_changed_at)
  into changes, row_count, last_changed_at
  from page;

  if row_count > 0 then
    select id into last_id
    from (
      select
        (entry ->> 'changedAt')::timestamptz changed_at,
        (entry -> 'record' ->> 'id')::uuid id
      from jsonb_array_elements(changes) entry
      order by changed_at desc, id desc
      limit 1
    ) q;
  end if;

  return jsonb_build_object(
    'changes', changes,
    'nextCursor',
      case when row_count = 0
        then jsonb_build_object('changedAt', p_after_changed_at, 'id', p_after_id)
        else jsonb_build_object('changedAt', last_changed_at, 'id', last_id)
      end,
    'hasMore', row_count = p_limit
  );
end;
$$;

comment on function public.restore_store_device(uuid, uuid) is
  'Owner-only restoration of a revoked device while preserving its registration and audit timestamps.';
comment on column public.sales.server_changed_at is
  'Server-owned cursor timestamp used for incremental completed-sale pull.';
comment on column public.sale_items.server_changed_at is
  'Server-owned cursor timestamp used for dependency-ordered sale-item pull.';

notify pgrst, 'reload schema';
