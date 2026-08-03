-- Phase 18: bounded receipt retention and operational indexes.
create index if not exists sync_operations_retention_idx on public.sync_operations(store_id,processed_at,id) where processed_at is not null;
create index if not exists devices_store_activity_idx on public.devices(store_id,revoked_at,last_seen_at desc);
create index if not exists inventory_reconciliation_open_idx on public.inventory_reconciliation_issues(store_id,resolved_at,created_at desc);

create or replace function public.cleanup_sync_receipts(p_store_id uuid,p_retention_days integer default 30,p_limit integer default 1000)
returns integer
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare removed integer;
begin
 if auth.uid() is null or not private.is_active_store_member(p_store_id) then raise exception 'Active store membership is required' using errcode='42501';end if;
 if p_retention_days not between 7 and 365 or p_limit not between 1 and 5000 then raise exception 'Invalid cleanup bounds' using errcode='22023';end if;
 with candidates as(select id from public.sync_operations where store_id=p_store_id and processed_at<now()-make_interval(days=>p_retention_days) order by processed_at,id limit p_limit),deleted as(delete from public.sync_operations s using candidates c where s.id=c.id returning s.id) select count(*) into removed from deleted;
 return removed;
end$$;
revoke all on function public.cleanup_sync_receipts(uuid,integer,integer) from public;
grant execute on function public.cleanup_sync_receipts(uuid,integer,integer) to authenticated;
comment on function public.cleanup_sync_receipts(uuid,integer,integer) is 'Bounded deletion of confirmed operation receipts after a 7-365 day retention period.';