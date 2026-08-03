-- Run against a disposable local Supabase database after all three migrations.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(4);
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','81000000-0000-0000-0000-000000000001','authenticated','authenticated','phase8-owner@example.test','',now(),'{}','{}',now(),now());
insert into public.stores(id,name,owner_user_id) values('82000000-0000-0000-0000-000000000001','Phase 8 Store','81000000-0000-0000-0000-000000000001');
insert into public.store_members(store_id,user_id,role) values('82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','owner');
insert into public.devices(device_key,store_id,user_id) values('phase8-device','82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
create temporary table phase8_results(first_result jsonb, duplicate_result jsonb);
insert into phase8_results
select public.process_sync_operations(jsonb_build_array(jsonb_build_object(
 'operationId','83000000-0000-0000-0000-000000000001','storeId','82000000-0000-0000-0000-000000000001','entityType','product_categories','entityId','84000000-0000-0000-0000-000000000001','operation','upsert','payload',jsonb_build_object('id','84000000-0000-0000-0000-000000000001','name','Drinks','sync',jsonb_build_object('storeId','82000000-0000-0000-0000-000000000001','deviceId','phase8-device','version',1,'baseVersion',null,'createdAt','2026-01-01T00:00:00Z','updatedAt','2026-01-01T00:00:00Z','deletedAt',null))
))), null;
update phase8_results set duplicate_result=public.process_sync_operations(jsonb_build_array(jsonb_build_object(
 'operationId','83000000-0000-0000-0000-000000000001','storeId','82000000-0000-0000-0000-000000000001','entityType','product_categories','entityId','84000000-0000-0000-0000-000000000001','operation','upsert','payload',jsonb_build_object('id','84000000-0000-0000-0000-000000000001','name','Drinks','sync',jsonb_build_object('storeId','82000000-0000-0000-0000-000000000001','deviceId','phase8-device','version',1,'baseVersion',null,'createdAt','2026-01-01T00:00:00Z','updatedAt','2026-01-01T00:00:00Z','deletedAt',null))
)));
select extensions.is((select first_result->0->>'status' from phase8_results),'processed','first request is processed');
select extensions.is((select duplicate_result->0->>'duplicate' from phase8_results),'true','duplicate retry is acknowledged');
select extensions.is((select count(*)::text from public.product_categories where id='84000000-0000-0000-0000-000000000001'),'1','duplicate request creates one row');
select extensions.is((select count(*)::text from public.sync_operations where operation_id='83000000-0000-0000-0000-000000000001'),'1','duplicate request creates one receipt');
select * from extensions.finish();
rollback;