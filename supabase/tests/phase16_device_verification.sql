begin;
select plan(4);
select has_column('public','devices','last_sync_at','devices track last successful sync');
select has_function('public','revoke_store_device',array['uuid','uuid'],'owner revocation RPC exists');
select function_privs_are('public','revoke_store_device',array['uuid','uuid'],'authenticated',array['EXECUTE'],'authenticated may call the validated RPC');
select isnt_empty($$select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='products'$$,'products publish change notifications');
select * from finish();
rollback;