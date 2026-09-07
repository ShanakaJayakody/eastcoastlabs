-- Mailbox-confirmed opt-in; public requests cannot clear suppression.
create table public.subscription_requests (
 id uuid primary key default gen_random_uuid(), email text not null, source text not null,
 token_hash text not null unique, created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours', confirmed_at timestamptz
);
create index subscription_requests_email_idx on public.subscription_requests(email,created_at desc);
alter table public.subscription_requests enable row level security;
grant all on public.subscription_requests to service_role;
create function public.request_subscription(p_email text,p_source text,p_hash text,p_url text) returns uuid
language plpgsql set search_path=public as $$
declare request_id uuid; outbox_id uuid;
begin
 if p_email<>lower(trim(p_email)) or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or p_source not in ('footer','exit_intent','newsletter') or p_hash !~ '^[a-f0-9]{64}$'
 or p_url not like 'https://www.eastcoastlabs.com.au/subscribe/confirm?token=%' or length(p_url)>200 then raise exception 'Invalid subscription request';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription:'||p_email,0));
 if exists(select 1 from subscription_requests where email=p_email and created_at>now()-interval '1 hour') then return null;end if;
 insert into subscription_requests(email,source,token_hash) values(p_email,p_source,p_hash) returning id into request_id;
 insert into email_outbox(to_email,template,payload,related_type,related_id)
 values(p_email,'subscription_confirmation',jsonb_build_object('confirmation_url',p_url),'subscription',request_id::text) returning id into outbox_id;
 return outbox_id;
end $$;
create function public.confirm_subscription(p_hash text) returns boolean language plpgsql set search_path=public as $$
declare r subscription_requests%rowtype; recipient text;
begin
 select email into recipient from subscription_requests where token_hash=p_hash;
 if not found then return false;end if;
 -- All consent mutations take the email lock before request-row locks.
 perform pg_advisory_xact_lock(hashtextextended('subscription:'||recipient,0));
 select * into r from subscription_requests where token_hash=p_hash and confirmed_at is null and expires_at>now() for update;
 if not found then return false;end if;
 update subscription_requests set confirmed_at=now() where id=r.id;
 update subscribers set unsubscribed_at=null where email=r.email;
 insert into subscribers(email,source,unsubscribed_at) values(r.email,r.source,null)
 on conflict(email,source) do update set unsubscribed_at=null;
 insert into email_outbox(to_email,template,payload,related_type,related_id)
 values(r.email,'welcome_1','{}','subscriber',r.email||':welcome:1') on conflict(to_email,template,related_id) do nothing;
 return true;
end $$;
create function public.suppress_marketing(p_email text,p_source text default 'unsubscribe') returns void language plpgsql set search_path=public as $$
begin
 if p_source not in ('unsubscribe','admin','bounce','complaint') then raise exception 'Invalid suppression source';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription:'||lower(trim(p_email)),0));
 -- An older unconfirmed request cannot undo a newer unsubscribe.
 update subscription_requests set expires_at=least(expires_at,now()) where email=lower(trim(p_email)) and confirmed_at is null;
 insert into subscribers(email,source,unsubscribed_at) values(lower(trim(p_email)),p_source,now())
 on conflict(email,source) do update set unsubscribed_at=excluded.unsubscribed_at;
 update subscribers set unsubscribed_at=now() where email=lower(trim(p_email));
 -- Claimed rows recheck current suppression immediately before provider delivery.
 update email_outbox set status='cancelled' where to_email=lower(trim(p_email)) and status in ('queued','failed')
 and template not in ('order_confirmation','order_shipped','order_refunded','payment_instructions','payment_reminder','payment_expiring','payment_expired','subscription_confirmation','admin_daily_brief');
end $$;
revoke all on function public.request_subscription(text,text,text,text),public.confirm_subscription(text),public.suppress_marketing(text,text) from public,anon,authenticated;
grant execute on function public.request_subscription(text,text,text,text),public.confirm_subscription(text),public.suppress_marketing(text,text) to service_role;

-- The outbox's last-moment eligibility check also applies to confirmation links.
create function public.subscription_confirmation_eligible(p_id text,p_email text) returns boolean
language sql stable set search_path=public as $$
 select exists(select 1 from subscription_requests where id::text=p_id and email=p_email and confirmed_at is null and expires_at>now());
$$;
revoke all on function public.subscription_confirmation_eligible(text,text) from public,anon,authenticated;
grant execute on function public.subscription_confirmation_eligible(text,text) to service_role;
