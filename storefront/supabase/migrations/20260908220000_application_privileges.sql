-- Scope existing-object cleanup to the migration role's public application
-- objects, excluding extension members. Supabase auth/storage/extension objects
-- and other managed owners are untouched. Never grant EXECUTE wholesale: some
-- service helpers intentionally require their security-definer wrapper.
do $$
declare obj record;col record;
begin
 for obj in select c.oid,c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relowner=(select oid from pg_roles where rolname=current_user)
  and c.relkind in ('r','p','v','m','S','f') and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e') loop
  if obj.relkind='S' then
   execute format('revoke all on sequence public.%I from public,anon,authenticated',obj.relname);
   execute format('revoke update on sequence public.%I from service_role',obj.relname);
  else
   execute format('revoke all on table public.%I from public,anon,authenticated',obj.relname);
   execute format('revoke truncate,references,trigger on table public.%I from service_role',obj.relname);
   if current_setting('server_version_num')::int>=170000 then execute format('revoke maintain on table public.%I from service_role',obj.relname);end if;
   for col in select attname from pg_attribute where attrelid=obj.oid and attnum>0 and not attisdropped loop
    execute format('revoke select(%I),insert(%I),update(%I),references(%I) on table public.%I from public,anon,authenticated',col.attname,col.attname,col.attname,col.attname,obj.relname);
   end loop;
  end if;
 end loop;
 for obj in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proowner=(select oid from pg_roles where rolname=current_user) and p.prokind='f'
  and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') loop
  execute format('revoke all on function %s from public,anon,authenticated',obj.signature);
 end loop;
end $$;
-- Restore only the intentional public read interface; existing RLS still applies.
grant select(id,product_slug,author,location,rating,title,body,verified,status,is_sample,created_at) on public.reviews to anon,authenticated;
grant select on public.coa_batches to anon,authenticated;
alter policy "coa public read" on public.coa_batches using(document_verified_at is not null and coa_url ~ '^https?://');
-- Historical broad defaults also leaked UPDATE/DELETE onto append-only evidence.
revoke update,delete on public.refund_quotes,public.refund_commits,public.refund_settlements from service_role;

-- PostgreSQL merges schema defaults with global defaults. A schema REVOKE alone
-- cannot remove a global grant (including built-in PUBLIC function EXECUTE).
-- Change defaults only for CURRENT_USER, the actual migration role (postgres in
-- production), globally then in public. Other role defaults are left untouched.
alter default privileges revoke all on tables from public,anon,authenticated,service_role;
alter default privileges in schema public revoke all on tables from public,anon,authenticated,service_role;
alter default privileges in schema public grant select,insert,update,delete on tables to service_role;
alter default privileges revoke all on sequences from public,anon,authenticated,service_role;
alter default privileges in schema public revoke all on sequences from public,anon,authenticated,service_role;
alter default privileges in schema public grant usage,select on sequences to service_role;
alter default privileges revoke all on functions from public,anon,authenticated,service_role;
alter default privileges in schema public revoke all on functions from public,anon,authenticated,service_role;
