-- Phase 8: authenticated, idempotent push processing for queued master-data changes.
create or replace function public.process_sync_operations(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  item jsonb;
  payload jsonb;
  results jsonb := '[]'::jsonb;
  op_id uuid;
  target_store uuid;
  target_entity uuid;
  actor_id uuid := (select auth.uid());
  entity_kind text;
  operation_kind text;
  device_key text;
  new_version bigint;
  base_version bigint;
  current_version bigint;
  current_store uuid;
  already_processed boolean;
begin
  if actor_id is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  if jsonb_typeof(p_operations) <> 'array' or jsonb_array_length(p_operations) not between 1 and 50 then
    raise exception 'Operations must be an array containing 1 to 50 items' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_operations)
  loop
    begin
      op_id := (item->>'operationId')::uuid;
      target_store := (item->>'storeId')::uuid;
      target_entity := (item->>'entityId')::uuid;
      entity_kind := item->>'entityType';
      operation_kind := item->>'operation';
      payload := item->'payload';
      device_key := payload#>>'{sync,deviceId}';
      new_version := (payload#>>'{sync,version}')::bigint;
      base_version := nullif(payload#>>'{sync,baseVersion}', '')::bigint;

      if entity_kind not in ('product_categories', 'suppliers', 'products', 'customers') then
        raise exception 'Unsupported entity type' using errcode = '22023';
      end if;
      if operation_kind not in ('upsert', 'delete') or payload is null or jsonb_typeof(payload) <> 'object' then
        raise exception 'Invalid operation format' using errcode = '22023';
      end if;
      if (operation_kind = 'delete') <> ((payload#>>'{sync,deletedAt}') is not null) then
        raise exception 'Operation and deletion metadata do not match' using errcode = '22023';
      end if;
      if operation_kind = 'delete' and not private.has_store_role(
        target_store, array['owner', 'administrator']::public.store_member_role[]
      ) then
        raise exception 'Only managers can synchronize deletions' using errcode = '42501';
      end if;

      if payload->>'id' <> target_entity::text or payload#>>'{sync,storeId}' <> target_store::text then
        raise exception 'Payload identity does not match operation identity' using errcode = '22023';
      end if;
      if not private.can_write_business(
        target_store, device_key, actor_id,
        array['owner', 'administrator', 'cashier', 'staff']::public.store_member_role[]
      ) then
        raise exception 'Store membership, role, actor, or device validation failed' using errcode = '42501';
      end if;

      select exists(select 1 from public.sync_operations where operation_id = op_id)
      into already_processed;
      if already_processed then
        results := results || jsonb_build_array(jsonb_build_object('operationId', op_id, 'status', 'processed', 'duplicate', true));
        continue;
      end if;

      if entity_kind = 'product_categories' then
        select store_id, version into current_store, current_version from public.product_categories where id = target_entity;
      elsif entity_kind = 'suppliers' then
        select store_id, version into current_store, current_version from public.suppliers where id = target_entity;
      elsif entity_kind = 'products' then
        select store_id, version into current_store, current_version from public.products where id = target_entity;
      else
        select store_id, version into current_store, current_version from public.customers where id = target_entity;
      end if;

      if current_store is not null and current_store <> target_store then
        raise exception 'Entity belongs to another store' using errcode = '42501';
      end if;

      if current_version is null then
        if new_version <> 1 or base_version is not null then
          raise exception 'New records require version 1 and no base version' using errcode = '40001';
        end if;
      elsif base_version is distinct from current_version or new_version <> current_version + 1 then
        raise exception 'Record version conflict' using errcode = '40001';
      end if;

      if entity_kind = 'product_categories' then
        insert into public.product_categories (id, store_id, name, created_at, updated_at, deleted_at, version, updated_by, device_id)
        values (target_entity, target_store, payload->>'name', (payload#>>'{sync,createdAt}')::timestamptz, (payload#>>'{sync,updatedAt}')::timestamptz, nullif(payload#>>'{sync,deletedAt}','')::timestamptz, new_version, actor_id, device_key)
        on conflict (id) do update set name=excluded.name, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, version=excluded.version, updated_by=excluded.updated_by, device_id=excluded.device_id
        where product_categories.store_id=excluded.store_id;
      elsif entity_kind = 'suppliers' then
        insert into public.suppliers (id, store_id, name, contact_person, phone, email, address, notes, created_at, updated_at, deleted_at, version, updated_by, device_id)
        values (target_entity, target_store, payload->>'name', coalesce(payload->>'contactPerson',''), coalesce(payload->>'phone',''), coalesce(payload->>'email',''), coalesce(payload->>'address',''), coalesce(payload->>'notes',''), (payload#>>'{sync,createdAt}')::timestamptz, (payload#>>'{sync,updatedAt}')::timestamptz, nullif(payload#>>'{sync,deletedAt}','')::timestamptz, new_version, actor_id, device_key)
        on conflict (id) do update set name=excluded.name, contact_person=excluded.contact_person, phone=excluded.phone, email=excluded.email, address=excluded.address, notes=excluded.notes, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, version=excluded.version, updated_by=excluded.updated_by, device_id=excluded.device_id
        where suppliers.store_id=excluded.store_id;
      elsif entity_kind = 'products' then
        insert into public.products (id, store_id, category_id, supplier_id, name, sku, barcode, unit, cost_price, selling_price, reorder_level, description, active, created_at, updated_at, deleted_at, version, updated_by, device_id)
        values (target_entity, target_store, (payload->>'categoryId')::uuid, nullif(payload->>'supplierId','')::uuid, payload->>'name', coalesce(payload->>'sku',''), coalesce(payload->>'barcode',''), coalesce(payload->>'unit','piece'), coalesce((payload->>'costPrice')::bigint,0), coalesce((payload->>'sellingPrice')::bigint,0), coalesce((payload->>'reorderLevel')::integer,0), coalesce(payload->>'description',''), coalesce((payload->>'active')::boolean,true), (payload#>>'{sync,createdAt}')::timestamptz, (payload#>>'{sync,updatedAt}')::timestamptz, nullif(payload#>>'{sync,deletedAt}','')::timestamptz, new_version, actor_id, device_key)
        on conflict (id) do update set category_id=excluded.category_id, supplier_id=excluded.supplier_id, name=excluded.name, sku=excluded.sku, barcode=excluded.barcode, unit=excluded.unit, cost_price=excluded.cost_price, selling_price=excluded.selling_price, reorder_level=excluded.reorder_level, description=excluded.description, active=excluded.active, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, version=excluded.version, updated_by=excluded.updated_by, device_id=excluded.device_id
        where products.store_id=excluded.store_id;
      else
        insert into public.customers (id, store_id, full_name, phone_number, address, credit_limit, notes, active, created_at, updated_at, deleted_at, version, updated_by, device_id)
        values (target_entity, target_store, payload->>'fullName', coalesce(payload->>'phoneNumber',''), coalesce(payload->>'address',''), coalesce((payload->>'creditLimit')::bigint,0), coalesce(payload->>'notes',''), coalesce((payload->>'active')::boolean,true), (payload#>>'{sync,createdAt}')::timestamptz, (payload#>>'{sync,updatedAt}')::timestamptz, nullif(payload#>>'{sync,deletedAt}','')::timestamptz, new_version, actor_id, device_key)
        on conflict (id) do update set full_name=excluded.full_name, phone_number=excluded.phone_number, address=excluded.address, credit_limit=excluded.credit_limit, notes=excluded.notes, active=excluded.active, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, version=excluded.version, updated_by=excluded.updated_by, device_id=excluded.device_id
        where customers.store_id=excluded.store_id;
      end if;

      insert into public.sync_operations (id, operation_id, store_id, entity_type, entity_id, operation, payload, processed_at, updated_by, device_id)
      values (gen_random_uuid(), op_id, target_store, entity_kind, target_entity, operation_kind, payload, now(), actor_id, device_key);
      results := results || jsonb_build_array(jsonb_build_object('operationId', op_id, 'status', 'processed', 'duplicate', false));
    exception when others then
      if exists(select 1 from public.sync_operations where operation_id = op_id) then
        results := results || jsonb_build_array(jsonb_build_object('operationId', op_id, 'status', 'processed', 'duplicate', true));
      else
        results := results || jsonb_build_array(jsonb_build_object('operationId', coalesce(op_id::text, item->>'operationId'), 'status', 'failed', 'errorCode', sqlstate, 'error', sqlerrm));
      end if;
    end;
    current_version := null;
    current_store := null;
    op_id := null;
  end loop;
  return results;
end;
$$;

revoke all on function public.process_sync_operations(jsonb) from public;
grant execute on function public.process_sync_operations(jsonb) to authenticated;
comment on function public.process_sync_operations(jsonb) is 'Phase 8 idempotent, validated push endpoint for queued master-data operations.';