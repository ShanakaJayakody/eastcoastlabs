-- Internal director updates. Membership comes from Mobile Message, never grants admin access.
create table public.admin_sms_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  start_hour integer not null default 8 check (start_hour between 0 and 19),
  updated_at timestamptz not null default now()
);
insert into public.admin_sms_settings(singleton) values(true);

create table public.admin_sms_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('daily','test')),
  local_send_date date not null,
  to_phone text not null check (to_phone ~ '^614[0-9]{8}$'),
  recipient jsonb not null,
  body text not null check (length(body) between 1 and 306),
  expected_parts integer not null check (expected_parts in (1,2)),
  sender text not null,
  idempotency_key uuid not null default gen_random_uuid(),
  credential_fingerprint text not null check (credential_fingerprint ~ '^[a-f0-9]{64}$'),
  summary jsonb not null,
  status text not null default 'queued' check (status in ('queued','sending','accepted','delivered','failed','uncertain','cancelled','expired')),
  attempts integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  expires_at timestamptz not null,
  message_id text unique,
  credits numeric,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index admin_sms_daily_recipient on public.admin_sms_outbox(local_send_date,to_phone) where kind='daily';
create index admin_sms_work on public.admin_sms_outbox(local_send_date,status,next_attempt_at);
create table public.admin_sms_parts (
  outbox_id uuid not null references public.admin_sms_outbox(id) on delete cascade,
  part_number integer not null check (part_number between 1 and 2),
  status text not null check (status in ('sent','delivered','failed')),
  updated_at timestamptz not null default now(),
  primary key (outbox_id,part_number)
);

alter table public.admin_sms_settings enable row level security;
alter table public.admin_sms_outbox enable row level security;
alter table public.admin_sms_parts enable row level security;
revoke all on public.admin_sms_settings,public.admin_sms_outbox,public.admin_sms_parts from public,anon,authenticated;
grant select on public.admin_sms_settings,public.admin_sms_outbox,public.admin_sms_parts to service_role;

create function public.save_admin_sms_settings(p_enabled boolean,p_start_hour integer,p_actor text)
returns void language plpgsql security definer set search_path=public as $$
declare previous public.admin_sms_settings;
begin
  if not exists(select 1 from admin_users where email=lower(trim(p_actor)) and active) then
    raise exception 'Active admin required';
  end if;
  select * into previous from admin_sms_settings where singleton for update;
  update admin_sms_settings set enabled=p_enabled,start_hour=p_start_hour,updated_at=now() where singleton;
  insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff)
    values(p_actor,'admin_sms.settings','admin_sms','settings',jsonb_build_object(
      'before',to_jsonb(previous),'after',jsonb_build_object('enabled',p_enabled,'start_hour',p_start_hour)));
end $$;

-- Same gross paid-revenue semantics as the dashboard, with one as-of time.
create function public.admin_sms_order_totals(p_now timestamptz default now())
returns jsonb language sql stable security definer set search_path=public as $$
  with bounds as (select
    ((p_now at time zone 'Australia/Melbourne')::date-1)::timestamp at time zone 'Australia/Melbourne' yesterday_start,
    ((p_now at time zone 'Australia/Melbourne')::date)::timestamp at time zone 'Australia/Melbourne' today_start,
    date_trunc('month',p_now at time zone 'Australia/Melbourne') at time zone 'Australia/Melbourne' month_start)
  select jsonb_build_object(
    'yesterdayRevenueCents',(select coalesce(sum(total_cents),0) from orders,bounds where paid_at>=yesterday_start and paid_at<today_start),
    'monthRevenueCents',(select coalesce(sum(total_cents),0) from orders,bounds where paid_at>=month_start and paid_at<=p_now),
    'overdueFulfilment',(select count(*) from orders where status in ('paid','processing') and action_queue_entered_at<p_now-interval '24 hours'))
$$;

create function public.enqueue_admin_sms(p_day date,p_body text,p_parts integer,p_sender text,
  p_fingerprint text,p_recipients jsonb,p_expires timestamptz,p_summary jsonb,p_test_id uuid default null)
returns integer language plpgsql security definer set search_path=public as $$
declare rec jsonb; n integer; total integer:=0;
begin
  if p_expires<=now() or p_expires>now()+interval '23 hours' then raise exception 'Invalid SMS expiry'; end if;
  if p_day<>(now() at time zone 'Australia/Melbourne')::date then raise exception 'Invalid SMS date'; end if;
  if jsonb_typeof(p_recipients)<>'array' or jsonb_array_length(p_recipients) not between 1 and 100 then
    raise exception 'Invalid director recipient count';
  end if;
  if p_test_id is not null and jsonb_array_length(p_recipients)<>1 then raise exception 'Select one test recipient'; end if;
  perform 1 from admin_sms_settings where singleton for share;
  if p_test_id is null and not (select enabled from admin_sms_settings where singleton) then return 0; end if;
  for rec in select * from jsonb_array_elements(p_recipients) loop
    insert into admin_sms_outbox(id,kind,local_send_date,to_phone,recipient,body,expected_parts,sender,
      credential_fingerprint,expires_at,summary)
    values(coalesce(p_test_id,gen_random_uuid()),case when p_test_id is null then 'daily' else 'test' end,
      p_day,rec->>'phone',rec,p_body,p_parts,p_sender,p_fingerprint,p_expires,p_summary)
    on conflict do nothing;
    get diagnostics n=row_count; total:=total+n;
  end loop;
  return total;
end $$;

create function public.claim_admin_sms(p_day date,p_id uuid default null)
returns setof public.admin_sms_outbox language plpgsql security definer set search_path=public as $$
declare chosen uuid;
begin
  -- An expired uncertain attempt needs reconciliation; never manufacture a new intent.
  update admin_sms_outbox set status=case when first_attempt_at is null then 'expired' else 'uncertain' end,
    last_error='Delivery window expired or retry limit reached',updated_at=now()
    where status in ('queued','sending') and (lease_until is null or lease_until<=now())
      and (expires_at<=now() or first_attempt_at<now()-interval '23 hours' or attempts>=6);
  perform 1 from admin_sms_settings where singleton for share;
  select id into chosen from admin_sms_outbox
    where local_send_date=p_day and status in ('queued','sending') and next_attempt_at<=now()
      and expires_at>now() and attempts<6 and (lease_until is null or lease_until<=now())
      and ((p_id is null and kind='daily' and (select enabled from admin_sms_settings where singleton))
        or (p_id=id and kind='test'))
    order by created_at,id for update skip locked limit 1;
  if chosen is null then return; end if;
  return query update admin_sms_outbox set status='sending',lease_token=gen_random_uuid(),
    lease_until=now()+interval '2 minutes',updated_at=now() where id=chosen returning *;
end $$;

create function public.authorize_admin_sms(p_id uuid,p_token uuid,p_current_phones text[],p_fingerprint text)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.admin_sms_outbox;
begin
  perform 1 from admin_sms_settings where singleton for share;
  select * into r from admin_sms_outbox where id=p_id for update;
  if not found or r.status<>'sending' or r.lease_token is distinct from p_token or r.lease_until<=now()
    or r.expires_at<=now() or r.attempts>=6 or r.first_attempt_at<now()-interval '23 hours' then return false; end if;
  if r.kind='daily' and not (select enabled from admin_sms_settings where singleton) then return false; end if;
  if not coalesce(r.to_phone=any(p_current_phones),false) then
    update admin_sms_outbox set status='cancelled',last_error='Removed from director list',updated_at=now() where id=p_id;
    return false;
  end if;
  if r.credential_fingerprint is distinct from p_fingerprint then
    update admin_sms_outbox set status=case when first_attempt_at is null then 'cancelled' else 'uncertain' end,
      last_error='API identity changed; reconcile before retrying',updated_at=now() where id=p_id;
    return false;
  end if;
  update admin_sms_outbox set attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),updated_at=now() where id=p_id;
  return true;
end $$;

create function public.finish_admin_sms(p_id uuid,p_token uuid,p_outcome text,p_message_id text,p_credits numeric,p_error text)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.admin_sms_outbox;
begin
  if p_outcome not in ('accepted','retry','failed','uncertain') then raise exception 'Invalid SMS outcome'; end if;
  select * into r from admin_sms_outbox where id=p_id for update;
  if not found or r.lease_token is distinct from p_token then return false; end if;
  if r.message_id is not null and p_message_id is not null and r.message_id<>p_message_id then raise exception 'SMS message identity mismatch'; end if;
  -- A signed receipt may have beaten the HTTP response. It is stronger evidence.
  update admin_sms_outbox set
    status=case when exists(select 1 from admin_sms_parts where outbox_id=p_id) then r.status
      when r.status in ('delivered','accepted') then r.status
      when p_outcome='retry' then 'queued' else p_outcome end,
    message_id=coalesce(r.message_id,p_message_id),credits=coalesce(p_credits,r.credits),
    last_error=left(p_error,300),lease_token=null,lease_until=null,
    next_attempt_at=now()+interval '5 minutes',updated_at=now() where id=p_id;
  return true;
end $$;

create function public.report_admin_sms(p_id uuid,p_message_id text,p_phone text,p_part integer,p_total integer,p_status text)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.admin_sms_outbox; delivered_count integer; has_failed boolean;
begin
  if p_status not in ('sent','delivered','failed') or p_message_id is null or length(p_message_id)>100 then return false; end if;
  select * into r from admin_sms_outbox where id=p_id for update;
  if not found or r.first_attempt_at is null or r.to_phone<>p_phone or r.expected_parts<>p_total
    or p_part not between 1 and p_total or (r.message_id is not null and r.message_id<>p_message_id) then return false; end if;
  insert into admin_sms_parts(outbox_id,part_number,status) values(p_id,p_part,p_status)
    on conflict(outbox_id,part_number) do update set status=case
      when admin_sms_parts.status='delivered' then 'delivered'
      when excluded.status='delivered' then 'delivered'
      when admin_sms_parts.status='failed' then 'failed' else excluded.status end,updated_at=now();
  select count(*) filter(where status='delivered'),bool_or(status='failed') into delivered_count,has_failed
    from admin_sms_parts where outbox_id=p_id;
  update admin_sms_outbox set message_id=p_message_id,status=case
    when delivered_count=r.expected_parts then 'delivered' when has_failed then 'failed' else 'accepted' end,
    last_error=case when has_failed then 'Carrier reported a failed SMS part' else null end,updated_at=now() where id=p_id;
  return true;
end $$;

-- No anonymous RPC access or direct service-role writes outside the reviewed RPCs.
do $$ declare f record;
begin
  for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace
    and proname in ('save_admin_sms_settings','admin_sms_order_totals','enqueue_admin_sms','claim_admin_sms',
      'authorize_admin_sms','finish_admin_sms','report_admin_sms') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
