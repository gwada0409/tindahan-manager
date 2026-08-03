-- Phase 11: exactly-once, atomic sale transaction ingestion.
create or replace function public.process_sale_transaction(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  op_id uuid := (p_operation->>'operationId')::uuid;
  target_store uuid := (p_operation->>'storeId')::uuid;
  sale_id uuid := (p_operation->>'entityId')::uuid;
  payload jsonb := p_operation->'payload';
  sale jsonb := payload->'sale';
  sale_item jsonb;
  debt jsonb := payload->'debtEntry';
  gcash jsonb := payload->'gcashTransaction';
  audit jsonb := payload->'audit';
  actor_id uuid := auth.uid();
  device_key text := sale#>>'{sync,deviceId}';
  item_total bigint;
  item_count integer;
  movement_total integer;
  quantity_total integer;
begin
  if actor_id is null then raise exception 'Authentication is required' using errcode='42501'; end if;
  if p_operation->>'entityType' <> 'sale_transaction' or p_operation->>'operation' <> 'transaction'
     or jsonb_typeof(payload) <> 'object' or jsonb_typeof(payload->'items') <> 'array'
     or jsonb_array_length(payload->'items') = 0 then
    raise exception 'Invalid sale transaction envelope' using errcode='22023';
  end if;
  if sale->>'id' <> sale_id::text or sale#>>'{sync,storeId}' <> target_store::text
     or sale->>'status' <> 'completed' then
    raise exception 'Sale identity or immutable status is invalid' using errcode='22023';
  end if;
  if not private.can_write_business(target_store,device_key,actor_id,array['owner','administrator','cashier','staff']::public.store_member_role[]) then
    raise exception 'Store membership, role, actor, or device validation failed' using errcode='42501';
  end if;
  if exists(select 1 from public.sync_operations where operation_id=op_id) then
    return jsonb_build_object('operationId',op_id,'status','processed','duplicate',true);
  end if;

  select count(*),coalesce(sum((value->>'total')::bigint),0),coalesce(sum((value->>'quantity')::integer),0)
    into item_count,item_total,quantity_total from jsonb_array_elements(payload->'items');
  select coalesce(sum(abs((value->>'quantity')::integer)),0) into movement_total
    from jsonb_array_elements(coalesce(payload->'stockMovements','[]'::jsonb));
  if item_count=0 or item_total<>(sale->>'subtotal')::bigint
     or (sale->>'total')::bigint<>(sale->>'subtotal')::bigint-(sale->>'discount')::bigint
     or movement_total<>quantity_total then
    raise exception 'Sale totals or stock movement reconciliation failed' using errcode='23514';
  end if;
  if sale->>'paymentMethod'='cash' and (
      (sale->>'amountReceived')::bigint < (sale->>'total')::bigint
      or coalesce((sale->>'changeAmount')::bigint,0) <> (sale->>'amountReceived')::bigint-(sale->>'total')::bigint
    ) then raise exception 'Cash payment reconciliation failed' using errcode='23514';
  elsif sale->>'paymentMethod'='gcash' and (gcash is null or (gcash->>'amount')::bigint<>(sale->>'total')::bigint) then
    raise exception 'GCash payment reconciliation failed' using errcode='23514';
  elsif sale->>'paymentMethod'='utang' and (debt is null or (debt->>'amount')::bigint<>(sale->>'total')::bigint or debt->>'customerId'<>sale->>'customerId') then
    raise exception 'Credit payment reconciliation failed' using errcode='23514';
  end if;

  insert into public.sales(id,store_id,occurred_at,subtotal,discount,total,payment_method,amount_received,change_amount,reference_number,customer_id,status,void_reason,operation_id,created_at,updated_at,version,updated_by,device_id)
  values(sale_id,target_store,(sale->>'date')::timestamptz,(sale->>'subtotal')::bigint,(sale->>'discount')::bigint,(sale->>'total')::bigint,sale->>'paymentMethod',nullif(sale->>'amountReceived','')::bigint,nullif(sale->>'changeAmount','')::bigint,nullif(sale->>'referenceNumber',''),nullif(sale->>'customerId','')::uuid,'completed',null,op_id,(sale#>>'{sync,createdAt}')::timestamptz,(sale#>>'{sync,updatedAt}')::timestamptz,1,actor_id,device_key);

  for sale_item in select value from jsonb_array_elements(payload->'items') loop
    if sale_item->>'saleId'<>sale_id::text or sale_item#>>'{sync,storeId}'<>target_store::text then raise exception 'Sale item identity mismatch' using errcode='22023'; end if;
    insert into public.sale_items(id,store_id,sale_id,item_id,item_type,name,quantity,unit_price,discount,total,batch_id,created_at,updated_at,version,updated_by,device_id)
    values((sale_item->>'id')::uuid,target_store,sale_id,(sale_item->>'itemId')::uuid,'product',sale_item->>'name',(sale_item->>'quantity')::integer,(sale_item->>'unitPrice')::bigint,(sale_item->>'discount')::bigint,(sale_item->>'total')::bigint,null,(sale_item#>>'{sync,createdAt}')::timestamptz,(sale_item#>>'{sync,updatedAt}')::timestamptz,1,actor_id,device_key);
  end loop;

  if debt is not null then
    insert into public.utang_entries(id,store_id,customer_id,occurred_at,entry_type,amount,reference_id,notes,operation_id,created_at,updated_at,version,updated_by,device_id)
    values((debt->>'id')::uuid,target_store,(debt->>'customerId')::uuid,(debt->>'date')::timestamptz,debt->>'type',(debt->>'amount')::bigint,sale_id,coalesce(debt->>'notes',''),(debt->>'id')::uuid,(debt#>>'{sync,createdAt}')::timestamptz,(debt#>>'{sync,updatedAt}')::timestamptz,1,actor_id,device_key);
  end if;
  if gcash is not null then
    insert into public.gcash_transactions(id,store_id,occurred_at,transaction_type,amount,service_fee,customer_id,reference_number,notes,operation_id,created_at,updated_at,version,updated_by,device_id)
    values((gcash->>'id')::uuid,target_store,(gcash->>'date')::timestamptz,gcash->>'type',(gcash->>'amount')::bigint,(gcash->>'serviceFee')::bigint,nullif(gcash->>'customerId','')::uuid,coalesce(gcash->>'referenceNumber',''),coalesce(gcash->>'notes',''),(gcash->>'id')::uuid,(gcash#>>'{sync,createdAt}')::timestamptz,(gcash#>>'{sync,updatedAt}')::timestamptz,1,actor_id,device_key);
  end if;
  if audit is not null then
    insert into public.audit_logs(id,store_id,occurred_at,action,entity_type,entity_id,details,operation_id,created_at,updated_at,version,updated_by,device_id)
    values((audit->>'id')::uuid,target_store,(audit->>'date')::timestamptz,audit->>'action','sale',sale_id,to_jsonb(coalesce(audit->>'details','')),(audit->>'id')::uuid,(audit#>>'{sync,createdAt}')::timestamptz,(audit#>>'{sync,updatedAt}')::timestamptz,1,actor_id,device_key);
  end if;

  insert into public.sync_operations(id,operation_id,store_id,entity_type,entity_id,operation,payload,processed_at,updated_by,device_id)
  values(gen_random_uuid(),op_id,target_store,'sale_transaction',sale_id,'transaction',payload,now(),actor_id,device_key);
  return jsonb_build_object('operationId',op_id,'status','processed','duplicate',false);
exception when unique_violation then
  if exists(select 1 from public.sync_operations where operation_id=op_id) then
    return jsonb_build_object('operationId',op_id,'status','processed','duplicate',true);
  end if;
  raise;
end;
$$;
revoke all on function public.process_sale_transaction(jsonb) from public;
grant execute on function public.process_sale_transaction(jsonb) to authenticated;
comment on function public.process_sale_transaction(jsonb) is 'Phase 11 atomic and idempotent immutable sale ingestion. Stock movement envelopes are reconciled and retained for Phase 12 ledger ingestion.';
create table public.sale_adjustments (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  sale_id uuid not null,
  adjustment_type text not null check (adjustment_type in ('void','refund','reversal','adjustment')),
  amount bigint not null check (amount > 0),
  reason text not null check (length(btrim(reason)) > 0),
  item_quantities jsonb not null default '{}'::jsonb,
  operation_id uuid not null unique,
  occurred_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 1,
  updated_by uuid not null references auth.users(id) on delete restrict,
  device_id text not null,
  unique(store_id,id),
  foreign key(store_id,sale_id) references public.sales(store_id,id) on delete restrict,
  foreign key(store_id,updated_by,device_id) references public.devices(store_id,user_id,device_key) on delete restrict
);
create index sale_adjustments_sale_idx on public.sale_adjustments(store_id,sale_id,occurred_at);
alter table public.sale_adjustments enable row level security;
create policy sale_adjustments_select_member on public.sale_adjustments for select to authenticated using(private.is_active_store_member(store_id));
create policy sale_adjustments_insert_worker on public.sale_adjustments for insert to authenticated with check(private.can_write_business(store_id,device_id,updated_by,array['owner','administrator','cashier','staff']::public.store_member_role[]));
revoke all on table public.sale_adjustments from anon;
grant select,insert on table public.sale_adjustments to authenticated;

create or replace function public.process_sale_compensation(p_operation jsonb)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
 op_id uuid := (p_operation->>'operationId')::uuid;
 target_store uuid := (p_operation->>'storeId')::uuid;
 payload jsonb := p_operation->'payload';
 adjustment jsonb := payload->'adjustment';
 original_sale uuid := (payload->>'originalSaleId')::uuid;
 actor_id uuid := auth.uid();
 device_key text := adjustment#>>'{sync,deviceId}';
 prior_total bigint;
 sale_total bigint;
begin
 if actor_id is null then raise exception 'Authentication is required' using errcode='42501'; end if;
 if p_operation->>'entityType'<>'sale_compensation' or p_operation->>'operation'<>'transaction' or adjustment is null then raise exception 'Invalid sale compensation envelope' using errcode='22023'; end if;
 if exists(select 1 from public.sync_operations where operation_id=op_id) then return jsonb_build_object('operationId',op_id,'status','processed','duplicate',true); end if;
 if not private.can_write_business(target_store,device_key,actor_id,array['owner','administrator','cashier','staff']::public.store_member_role[]) then raise exception 'Store membership, role, actor, or device validation failed' using errcode='42501'; end if;
 select total into sale_total from public.sales where store_id=target_store and id=original_sale and status='completed';
 if sale_total is null then raise exception 'Completed original sale not found' using errcode='23503'; end if;
 select coalesce(sum(amount),0) into prior_total from public.sale_adjustments where store_id=target_store and sale_id=original_sale;
 if prior_total+(adjustment->>'amount')::bigint>sale_total then raise exception 'Compensation exceeds sale total' using errcode='23514'; end if;
 if adjustment->>'type'='void' and exists(select 1 from public.sale_adjustments where store_id=target_store and sale_id=original_sale and adjustment_type='void') then raise exception 'Sale is already voided' using errcode='23505'; end if;
 insert into public.sale_adjustments(id,store_id,sale_id,adjustment_type,amount,reason,item_quantities,operation_id,occurred_at,created_at,updated_at,version,updated_by,device_id)
 values((adjustment->>'id')::uuid,target_store,original_sale,adjustment->>'type',(adjustment->>'amount')::bigint,adjustment->>'reason',coalesce(adjustment->'itemQuantities','{}'::jsonb),op_id,(adjustment->>'date')::timestamptz,(adjustment#>>'{sync,createdAt}')::timestamptz,(adjustment#>>'{sync,updatedAt}')::timestamptz,1,actor_id,device_key);
 if payload->'debtEntry' is not null then
   insert into public.utang_entries(id,store_id,customer_id,occurred_at,entry_type,amount,reference_id,notes,operation_id,created_at,updated_at,version,updated_by,device_id)
   values((payload#>>'{debtEntry,id}')::uuid,target_store,(payload#>>'{debtEntry,customerId}')::uuid,(payload#>>'{debtEntry,date}')::timestamptz,'adjustment',(payload#>>'{debtEntry,amount}')::bigint,original_sale,coalesce(payload#>>'{debtEntry,notes}',''),(payload#>>'{debtEntry,id}')::uuid,(payload#>>'{debtEntry,sync,createdAt}')::timestamptz,(payload#>>'{debtEntry,sync,updatedAt}')::timestamptz,1,actor_id,device_key);
 end if;
 if payload->'gcashTransaction' is not null then
   insert into public.gcash_transactions(id,store_id,occurred_at,transaction_type,amount,service_fee,customer_id,reference_number,notes,operation_id,created_at,updated_at,version,updated_by,device_id)
   values((payload#>>'{gcashTransaction,id}')::uuid,target_store,(payload#>>'{gcashTransaction,date}')::timestamptz,'adjustment',(payload#>>'{gcashTransaction,amount}')::bigint,0,nullif(payload#>>'{gcashTransaction,customerId}','')::uuid,coalesce(payload#>>'{gcashTransaction,referenceNumber}',''),coalesce(payload#>>'{gcashTransaction,notes}',''),(payload#>>'{gcashTransaction,id}')::uuid,(payload#>>'{gcashTransaction,sync,createdAt}')::timestamptz,(payload#>>'{gcashTransaction,sync,updatedAt}')::timestamptz,1,actor_id,device_key);
 end if;
 if payload->'audit' is not null then
   insert into public.audit_logs(id,store_id,occurred_at,action,entity_type,entity_id,details,operation_id,created_at,updated_at,version,updated_by,device_id)
   values((payload#>>'{audit,id}')::uuid,target_store,(payload#>>'{audit,date}')::timestamptz,payload#>>'{audit,action}','sale',original_sale,to_jsonb(coalesce(payload#>>'{audit,details}','')),(payload#>>'{audit,id}')::uuid,(payload#>>'{audit,sync,createdAt}')::timestamptz,(payload#>>'{audit,sync,updatedAt}')::timestamptz,1,actor_id,device_key);
 end if;
 insert into public.sync_operations(id,operation_id,store_id,entity_type,entity_id,operation,payload,processed_at,updated_by,device_id)
 values(gen_random_uuid(),op_id,target_store,'sale_compensation',(adjustment->>'id')::uuid,'transaction',payload,now(),actor_id,device_key);
 return jsonb_build_object('operationId',op_id,'status','processed','duplicate',false);
exception when unique_violation then
 if exists(select 1 from public.sync_operations where operation_id=op_id) then return jsonb_build_object('operationId',op_id,'status','processed','duplicate',true); end if;
 raise;
end;
$$;
revoke all on function public.process_sale_compensation(jsonb) from public;
grant execute on function public.process_sale_compensation(jsonb) to authenticated;
comment on table public.sale_adjustments is 'Immutable void, refund, reversal, and adjustment records; completed sales are never overwritten.';