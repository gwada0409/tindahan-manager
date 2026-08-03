-- Phase 9: server-generated incremental cursor and authenticated pull RPC.
alter table public.product_categories add column server_changed_at timestamptz not null default clock_timestamp();
alter table public.suppliers add column server_changed_at timestamptz not null default clock_timestamp();
alter table public.products add column server_changed_at timestamptz not null default clock_timestamp();
alter table public.customers add column server_changed_at timestamptz not null default clock_timestamp();

create function private.set_server_changed_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.server_changed_at = clock_timestamp(); return new; end;
$$;
revoke all on function private.set_server_changed_at() from public;

create trigger product_categories_server_changed before insert or update on public.product_categories for each row execute function private.set_server_changed_at();
create trigger suppliers_server_changed before insert or update on public.suppliers for each row execute function private.set_server_changed_at();
create trigger products_server_changed before insert or update on public.products for each row execute function private.set_server_changed_at();
create trigger customers_server_changed before insert or update on public.customers for each row execute function private.set_server_changed_at();

create index product_categories_pull_idx on public.product_categories(store_id, server_changed_at, id);
create index suppliers_pull_idx on public.suppliers(store_id, server_changed_at, id);
create index products_pull_idx on public.products(store_id, server_changed_at, id);
create index customers_pull_idx on public.customers(store_id, server_changed_at, id);

create or replace function public.pull_sync_changes(
  p_store_id uuid,
  p_after_changed_at timestamptz default '1970-01-01T00:00:00Z',
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
      from public.product_categories t where store_id=p_store_id and (server_changed_at,id)>(p_after_changed_at,p_after_id)
    union all
    select 'suppliers', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.suppliers t where store_id=p_store_id and (server_changed_at,id)>(p_after_changed_at,p_after_id)
    union all
    select 'products', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.products t where store_id=p_store_id and (server_changed_at,id)>(p_after_changed_at,p_after_id)
    union all
    select 'customers', server_changed_at, id, to_jsonb(t) - 'server_changed_at'
      from public.customers t where store_id=p_store_id and (server_changed_at,id)>(p_after_changed_at,p_after_id)
  ), page as (
    select * from combined order by server_changed_at,id limit p_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object('entityType',entity_type,'changedAt',server_changed_at,'record',record) order by server_changed_at,id),'[]'::jsonb),
         count(*), max(server_changed_at)
  into changes,row_count,last_changed_at from page;

  if row_count > 0 then
    select id into last_id from (
      select (entry->>'changedAt')::timestamptz changed_at, (entry->'record'->>'id')::uuid id
      from jsonb_array_elements(changes) entry
      order by changed_at desc,id desc limit 1
    ) q;
  end if;

  return jsonb_build_object(
    'changes',changes,
    'nextCursor',case when row_count=0 then jsonb_build_object('changedAt',p_after_changed_at,'id',p_after_id) else jsonb_build_object('changedAt',last_changed_at,'id',last_id) end,
    'hasMore',row_count=p_limit
  );
end;
$$;
revoke all on function public.pull_sync_changes(uuid,timestamptz,uuid,integer) from public;
grant execute on function public.pull_sync_changes(uuid,timestamptz,uuid,integer) to authenticated;
comment on function public.pull_sync_changes(uuid,timestamptz,uuid,integer) is 'Phase 9 incremental pull using a server-owned timestamp and UUID tie-breaker.';