-- Phase 12: append-only inventory ledger and derived cached quantities.
alter table public.inventory_batches add column server_changed_at timestamptz not null default clock_timestamp();
alter table public.stock_movements add column server_changed_at timestamptz not null default clock_timestamp();
alter table public.stock_movements drop constraint if exists stock_movements_movement_type_check;
alter table public.stock_movements add check(movement_type in ('restock','adjustment','damaged','expired','return','sale','transfer-out','transfer-in'));
create trigger inventory_batches_server_changed before insert or update on public.inventory_batches for each row execute function private.set_server_changed_at();
create trigger stock_movements_server_changed before insert or update on public.stock_movements for each row execute function private.set_server_changed_at();
create index inventory_batches_pull_idx on public.inventory_batches(store_id,server_changed_at,id);
create index stock_movements_pull_idx on public.stock_movements(store_id,server_changed_at,id);

create table public.inventory_reconciliation_issues(
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),batch_id uuid not null,product_id uuid not null,
 detected_quantity bigint not null,reason text not null,resolved_at timestamptz,created_at timestamptz not null default now(),
 unique(store_id,batch_id,reason,resolved_at)
);
alter table public.inventory_reconciliation_issues enable row level security;
create policy inventory_issues_select_member on public.inventory_reconciliation_issues for select to authenticated using(private.is_active_store_member(store_id));
revoke all on public.inventory_reconciliation_issues from anon;
grant select on public.inventory_reconciliation_issues to authenticated;

create or replace function public.process_inventory_operation(p_operation jsonb)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
 op_id uuid := (p_operation->>'operationId')::uuid;target_store uuid := (p_operation->>'storeId')::uuid;
 entity_kind text := p_operation->>'entityType';payload jsonb := p_operation->'payload';movement jsonb := payload->'movement';batch jsonb := payload->'batch';
 actor_id uuid := auth.uid();device_key text := movement#>>'{sync,deviceId}';batch_id uuid;new_quantity bigint;
begin
 if actor_id is null then raise exception 'Authentication is required' using errcode='42501';end if;
 if entity_kind not in ('inventory_restock','inventory_movement') or p_operation->>'operation'<>'transaction' or movement is null then raise exception 'Invalid inventory operation' using errcode='22023';end if;
 if exists(select 1 from public.sync_operations where operation_id=op_id) then return jsonb_build_object('operationId',op_id,'status','processed','duplicate',true);end if;
 if not private.can_write_business(target_store,device_key,actor_id,array['owner','administrator','cashier','staff']::public.store_member_role[]) then raise exception 'Store membership, role, actor, or device validation failed' using errcode='42501';end if;
 batch_id := nullif(movement->>'batchId','')::uuid;
 if batch_id is null then raise exception 'A synchronized movement requires a batch' using errcode='22023';end if;
 if entity_kind='inventory_restock' then
  if batch is null or batch->>'id'<>batch_id::text then raise exception 'Restock batch identity mismatch' using errcode='22023';end if;
  insert into public.inventory_batches(id,store_id,product_id,supplier_id,quantity_received,remaining_quantity,unit_cost,restock_date,expiration_date,reference_number,notes,created_at,updated_at,version,updated_by,device_id)
  values(batch_id,target_store,(batch->>'productId')::uuid,nullif(batch->>'supplierId','')::uuid,(batch->>'quantityReceived')::integer,0,(batch->>'unitCost')::bigint,(batch->>'restockDate')::timestamptz,nullif(batch->>'expirationDate','')::timestamptz,coalesce(batch->>'referenceNumber',''),coalesce(batch->>'notes',''),(batch#>>'{sync,createdAt}')::timestamptz,(batch#>>'{sync,updatedAt}')::timestamptz,1,actor_id,device_key)
  on conflict(id) do nothing;
 end if;
 if not exists(select 1 from public.inventory_batches where store_id=target_store and id=batch_id) then raise exception 'Inventory batch must synchronize before its movements' using errcode='23503';end if;
 insert into public.stock_movements(id,store_id,product_id,batch_id,movement_type,signed_quantity,occurred_at,reference_id,notes,operation_id,created_at,updated_at,version,updated_by,device_id)
 values((movement->>'id')::uuid,target_store,(movement->>'productId')::uuid,batch_id,movement->>'type',(movement->>'quantity')::integer,(movement->>'date')::timestamptz,nullif(movement->>'referenceId','')::uuid,coalesce(movement->>'notes',''),op_id,(movement#>>'{sync,createdAt}')::timestamptz,(movement#>>'{sync,updatedAt}')::timestamptz,1,actor_id,device_key);
 update public.inventory_batches set remaining_quantity=remaining_quantity+(movement->>'quantity')::integer where store_id=target_store and id=batch_id returning remaining_quantity into new_quantity;
 if new_quantity<0 then insert into public.inventory_reconciliation_issues(store_id,batch_id,product_id,detected_quantity,reason) values(target_store,batch_id,(movement->>'productId')::uuid,new_quantity,'Concurrent offline movements produced negative stock') on conflict do nothing;end if;
 insert into public.sync_operations(id,operation_id,store_id,entity_type,entity_id,operation,payload,processed_at,updated_by,device_id)
 values(gen_random_uuid(),op_id,target_store,entity_kind,(movement->>'id')::uuid,'transaction',payload,now(),actor_id,device_key);
 return jsonb_build_object('operationId',op_id,'status','processed','duplicate',false);
exception when unique_violation then
 if exists(select 1 from public.sync_operations where operation_id=op_id) then return jsonb_build_object('operationId',op_id,'status','processed','duplicate',true);end if;raise;
end;$$;
revoke all on function public.process_inventory_operation(jsonb) from public;
grant execute on function public.process_inventory_operation(jsonb) to authenticated;

create or replace function public.pull_sync_changes(p_store_id uuid,p_after_changed_at timestamptz default '1970-01-01',p_after_id uuid default '00000000-0000-0000-0000-000000000000',p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare changes jsonb;row_count integer;last_changed_at timestamptz;last_id uuid;
begin
 if not private.is_active_store_member(p_store_id) then raise exception 'Active store membership is required' using errcode='42501';end if;
 if p_limit not between 1 and 500 then raise exception 'Pull limit must be between 1 and 500' using errcode='22023';end if;
 with combined as(
 select 'product_categories'::text entity_type,server_changed_at,id,to_jsonb(t)-'server_changed_at' record from public.product_categories t where store_id=p_store_id and(server_changed_at,id)>(p_after_changed_at,p_after_id)
 union all select 'suppliers',server_changed_at,id,to_jsonb(t)-'server_changed_at' from public.suppliers t where store_id=p_store_id and(server_changed_at,id)>(p_after_changed_at,p_after_id)
 union all select 'products',server_changed_at,id,to_jsonb(t)-'server_changed_at' from public.products t where store_id=p_store_id and(server_changed_at,id)>(p_after_changed_at,p_after_id)
 union all select 'customers',server_changed_at,id,to_jsonb(t)-'server_changed_at' from public.customers t where store_id=p_store_id and(server_changed_at,id)>(p_after_changed_at,p_after_id)
 union all select 'inventory_batches',server_changed_at,id,to_jsonb(t)-'server_changed_at' from public.inventory_batches t where store_id=p_store_id and(server_changed_at,id)>(p_after_changed_at,p_after_id)
 union all select 'stock_movements',server_changed_at,id,to_jsonb(t)-'server_changed_at' from public.stock_movements t where store_id=p_store_id and(server_changed_at,id)>(p_after_changed_at,p_after_id)
 ),page as(select*from combined order by server_changed_at,id limit p_limit)
 select coalesce(jsonb_agg(jsonb_build_object('entityType',entity_type,'changedAt',server_changed_at,'record',record)order by server_changed_at,id),'[]'),count(*),max(server_changed_at) into changes,row_count,last_changed_at from page;
 if row_count>0 then select id into last_id from(select(entry->>'changedAt')::timestamptz changed_at,(entry->'record'->>'id')::uuid id from jsonb_array_elements(changes)entry order by changed_at desc,id desc limit 1)q;end if;
 return jsonb_build_object('changes',changes,'nextCursor',case when row_count=0 then jsonb_build_object('changedAt',p_after_changed_at,'id',p_after_id)else jsonb_build_object('changedAt',last_changed_at,'id',last_id)end,'hasMore',row_count=p_limit);
end;$$;
comment on function public.process_inventory_operation(jsonb) is 'Phase 12 idempotent append-only movement ingestion with transactional cached quantity updates.';