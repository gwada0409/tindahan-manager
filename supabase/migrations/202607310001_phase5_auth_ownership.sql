-- Phase 5: authenticated store ownership. Business data tables are introduced in Phase 6.
create extension if not exists pgcrypto;

create type public.store_member_role as enum ('owner', 'administrator', 'cashier', 'staff');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.store_member_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  device_key text not null check (length(btrim(device_key)) between 1 and 200),
  store_id uuid not null references public.stores(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Browser device' check (length(btrim(name)) between 1 and 120),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id, device_key)
);

create index store_members_user_active_idx on public.store_members (user_id, active);
create index store_members_store_active_idx on public.store_members (store_id, active);
create index devices_user_store_idx on public.devices (user_id, store_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stores_set_updated_at before update on public.stores
for each row execute function public.set_updated_at();
create trigger store_members_set_updated_at before update on public.store_members
for each row execute function public.set_updated_at();
create trigger devices_set_updated_at before update on public.devices
for each row execute function public.set_updated_at();

create function public.prevent_device_unrevocation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'A revoked device cannot be reactivated';
  end if;
  return new;
end;
$$;

create trigger devices_prevent_unrevocation before update on public.devices
for each row execute function public.prevent_device_unrevocation();

create function public.is_active_store_member(p_store_id uuid)
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

create function public.has_store_role(
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

revoke all on function public.is_active_store_member(uuid) from public;
revoke all on function public.has_store_role(uuid, public.store_member_role[]) from public;
grant execute on function public.is_active_store_member(uuid) to authenticated;
grant execute on function public.has_store_role(uuid, public.store_member_role[]) to authenticated;

alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.devices enable row level security;

create policy stores_select_member on public.stores
for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or public.is_active_store_member(id)
);

create policy stores_insert_owner on public.stores
for insert to authenticated
with check (owner_user_id = (select auth.uid()));

create policy stores_update_owner on public.stores
for update to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

create policy store_members_select_member on public.store_members
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_active_store_member(store_id)
);

create policy store_members_insert_manager on public.store_members
for insert to authenticated
with check (
  role <> 'owner'::public.store_member_role
  and public.has_store_role(
    store_id,
    array['owner', 'administrator']::public.store_member_role[]
  )
);

create policy store_members_update_manager on public.store_members
for update to authenticated
using (
  role <> 'owner'::public.store_member_role
  and public.has_store_role(
    store_id,
    array['owner', 'administrator']::public.store_member_role[]
  )
)
with check (
  role <> 'owner'::public.store_member_role
  and public.has_store_role(
    store_id,
    array['owner', 'administrator']::public.store_member_role[]
  )
);

create policy store_members_delete_manager on public.store_members
for delete to authenticated
using (
  role <> 'owner'::public.store_member_role
  and public.has_store_role(
    store_id,
    array['owner', 'administrator']::public.store_member_role[]
  )
);

create policy devices_select_own on public.devices
for select to authenticated
using (
  user_id = (select auth.uid())
  and public.is_active_store_member(store_id)
);

create policy devices_insert_own on public.devices
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_active_store_member(store_id)
);

create policy devices_update_own on public.devices
for update to authenticated
using (
  user_id = (select auth.uid())
  and public.is_active_store_member(store_id)
)
with check (
  user_id = (select auth.uid())
  and public.is_active_store_member(store_id)
);

create function public.create_store_with_owner(p_store_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := btrim(p_store_name);
  existing_store_id uuid;
  new_store_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if length(normalized_name) not between 1 and 120 then
    raise exception 'Store name must contain between 1 and 120 characters';
  end if;

  select s.id into existing_store_id
  from public.stores s
  join public.store_members sm on sm.store_id = s.id
  where sm.user_id = current_user_id
    and sm.role = 'owner'::public.store_member_role
    and sm.active
    and lower(s.name) = lower(normalized_name)
  order by s.created_at
  limit 1;

  if existing_store_id is not null then
    return existing_store_id;
  end if;

  insert into public.stores (name, owner_user_id)
  values (normalized_name, current_user_id)
  returning id into new_store_id;

  insert into public.store_members (store_id, user_id, role, active)
  values (new_store_id, current_user_id, 'owner', true);

  return new_store_id;
end;
$$;

revoke all on function public.create_store_with_owner(text) from public;
grant execute on function public.create_store_with_owner(text) to authenticated;

revoke all on table public.stores, public.store_members, public.devices from anon;
grant select, insert, update on table public.stores to authenticated;
grant select, insert, update, delete on table public.store_members to authenticated;
grant select, insert, update on table public.devices to authenticated;

comment on table public.stores is 'Phase 5 store ownership boundary; business records arrive in Phase 6.';
comment on table public.devices is 'Per-account browser device registrations. Revoked devices cannot refresh verified offline access.';