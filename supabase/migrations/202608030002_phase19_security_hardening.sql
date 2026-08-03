-- Phase 19: additive security hardening. No business rows are rewritten.
do $$
declare table_name text;
begin
 foreach table_name in array array['stores','store_members','devices','product_categories','suppliers','products','inventory_batches','stock_movements','customers','sales','sale_items','utang_entries','gcash_transactions','bills','employees','payroll_entries','vault_transactions','audit_logs','sync_operations','sale_adjustments','inventory_reconciliation_issues'] loop
  if to_regclass('public.' || table_name) is not null then
   execute format('alter table public.%I enable row level security',table_name);
   execute format('alter table public.%I force row level security',table_name);
   execute format('revoke all on table public.%I from anon',table_name);
  end if;
 end loop;
end $$;
-- NOT VALID avoids scanning existing data while still protecting new/changed rows.
alter table public.stores add constraint stores_name_length check(char_length(name)between 1 and 200)not valid;
alter table public.product_categories add constraint categories_name_length check(char_length(name)between 1 and 200)not valid;
alter table public.suppliers add constraint suppliers_name_length check(char_length(name)between 1 and 200)not valid;
alter table public.products add constraint products_name_length check(char_length(name)between 1 and 300)not valid;
alter table public.customers add constraint customers_name_length check(char_length(full_name)between 1 and 200)not valid;
alter table public.employees add constraint employees_name_length check(char_length(name)between 1 and 200)not valid;
alter table public.audit_logs add constraint audit_action_length check(char_length(action)between 1 and 120)not valid;
alter table public.audit_logs add constraint audit_details_size check(octet_length(details::text)<=65536)not valid;
do $$
declare rpc record;
begin
 for rpc in
  select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) arguments
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname=any(array[
   'create_store_with_owner','process_sync_operations','pull_sync_changes',
   'process_sale_transaction','process_sale_compensation','process_inventory_operation',
   'process_financial_operation','revoke_store_device','cleanup_sync_receipts'
  ])
 loop
  execute format('revoke all on function public.%I(%s) from public,anon',rpc.proname,rpc.arguments);
 end loop;
end $$;
comment on constraint audit_details_size on public.audit_logs is 'Caps new audit payloads at 64 KiB; audit details must not contain credentials or complete backup contents.';