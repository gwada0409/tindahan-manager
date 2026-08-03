-- Run against a disposable local Supabase database after all four migrations.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(4);
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','91000000-0000-0000-0000-000000000001','authenticated','authenticated','phase9-owner@example.test','',now(),'{}','{}',now(),now());
insert into public.stores(id,name,owner_user_id) values('92000000-0000-0000-0000-000000000001','Phase 9 Store','91000000-0000-0000-0000-000000000001');
insert into public.store_members(store_id,user_id,role) values('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','owner');
insert into public.devices(device_key,store_id,user_id) values('phase9-device','92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001');
insert into public.product_categories(id,store_id,name,updated_by,device_id) values
('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','First','91000000-0000-0000-0000-000000000001','phase9-device'),
('93000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000001','Deleted','91000000-0000-0000-0000-000000000001','phase9-device');
update public.product_categories set deleted_at=now() where id='93000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
create temporary table pull_page as select public.pull_sync_changes('92000000-0000-0000-0000-000000000001','1970-01-01','00000000-0000-0000-0000-000000000000',1) result;
select extensions.is((select jsonb_array_length(result->'changes')::text from pull_page),'1','pull respects page size');
select extensions.is((select result->>'hasMore' from pull_page),'true','pull reports another page');
select extensions.ok((select (result#>>'{nextCursor,changedAt}')::timestamptz > '1970-01-01'::timestamptz from pull_page),'cursor uses server timestamp');
select extensions.ok((select jsonb_path_exists(public.pull_sync_changes('92000000-0000-0000-0000-000000000001','1970-01-01','00000000-0000-0000-0000-000000000000',10)->'changes', '$[*] ? (@.record.id == "93000000-0000-0000-0000-000000000002" && @.record.deleted_at != null)')),'pull includes soft-deleted records');
select * from extensions.finish();
rollback;
