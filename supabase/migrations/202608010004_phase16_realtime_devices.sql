-- Phase 16: Realtime notifications and owner-managed device revocation.
alter table public.devices add column if not exists last_sync_at timestamptz;

create policy devices_select_store_owner on public.devices
for select to authenticated
using (public.has_store_role(store_id, array['owner']::public.store_member_role[]));

create or replace function public.revoke_store_device(p_store_id uuid, p_device_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  revoked_time timestamptz := now();
begin
  if not public.has_store_role(p_store_id, array['owner']::public.store_member_role[]) then
    raise exception 'Only the store owner can revoke devices' using errcode = '42501';
  end if;
  update public.devices set revoked_at = revoked_time
  where id = p_device_id and store_id = p_store_id and revoked_at is null;
  if not found then raise exception 'Active device not found' using errcode = 'P0002'; end if;
  return revoked_time;
end;
$$;
revoke all on function public.revoke_store_device(uuid, uuid) from public;
grant execute on function public.revoke_store_device(uuid, uuid) to authenticated;

-- Realtime carries only invalidation notices. Clients still fetch authoritative
-- rows through the incremental pull RPC and recover missed notices periodically.
do $$
declare table_name text;
begin
  foreach table_name in array array['product_categories','suppliers','products','customers','inventory_batches','stock_movements','sales','sale_items','utang_entries','gcash_transactions','bills','employees','payroll_entries','vault_transactions']
  loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end $$;

comment on function public.revoke_store_device(uuid, uuid) is 'Owner-only device revocation; revoked devices lose future cloud write access.';
comment on column public.devices.last_sync_at is 'Last successful push/pull completion reported by this device.';