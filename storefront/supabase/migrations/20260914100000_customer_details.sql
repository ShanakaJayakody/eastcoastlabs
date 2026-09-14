-- Customer contact details are operator-owned; orders retain their name and
-- delivery-address snapshots. Email is the existing cross-table identity.
alter table public.customer_profiles
  add column name text,
  add column phone text,
  add column address jsonb not null default '{}',
  add column edit_version bigint not null default 0,
  add column previous_emails text[] not null default '{}';

-- Preserve the actual recipient of historical deliveries while moving the
-- logical identity and dedupe key. Never change a provider-attempted retry.
alter table public.email_outbox add column delivery_email text;
-- The capture email remains immutable evidence. This is its current customer
-- association, used only by admin reporting after an email correction.
alter table public.recovery_episodes add column customer_email text;

create or replace function public.match_email_event() returns trigger
language plpgsql set search_path=public as $$
declare message_id text; matched uuid;
begin
  message_id:=new.detail->>'message_id';
  if message_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('email-provider:'||message_id||':'||new.to_email,0));
    select id into matched from email_outbox
      where provider_message_id=message_id and coalesce(delivery_email,to_email)=new.to_email
      order by created_at limit 1;
    new.outbox_id:=matched;
  end if;
  return new;
end $$;

create function public.admin_save_customer(p_email text,p_details jsonb,p_version bigint,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  recipient text;
  profile customer_profiles;
  before_details jsonb;
  after_details jsonb;
  field text;
  value jsonb;
begin
  if not exists(select 1 from admin_users where email=p_actor and active) then
    raise exception 'Active administrator required';
  end if;
  p_email:=lower(trim(p_email));
  if p_email is null or p_details is null or jsonb_typeof(p_details)<>'object' then
    raise exception 'Invalid customer details';
  end if;
  if not (p_details ?& array['email','name','phone','address']) or exists(
    select 1 from jsonb_object_keys(p_details) k where k not in ('email','name','phone','address')
  ) then raise exception 'Invalid customer fields'; end if;
  if jsonb_typeof(p_details->'email')<>'string' or jsonb_typeof(p_details->'name')<>'string'
    or jsonb_typeof(p_details->'phone')<>'string' or jsonb_typeof(p_details->'address')<>'object' then
    raise exception 'Invalid customer field types';
  end if;
  recipient:=lower(trim(p_details->>'email'));
  if length(recipient)>254 or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(trim(p_details->>'name'))>300 or length(trim(p_details->>'phone'))>50 then
    raise exception 'Invalid email, name or phone';
  end if;
  for field,value in select e.key,e.value from jsonb_each(p_details->'address') e loop
    if field not in ('line1','line2','suburb','state','postcode','country')
      or jsonb_typeof(value)<>'string' or length(value #>> '{}')>300 then
      raise exception 'Invalid address field';
    end if;
  end loop;

  -- Serialize editors before acquiring table locks. NOWAIT makes a concurrent
  -- checkout/worker a retryable save failure, never a partial identity move.
  perform pg_advisory_xact_lock(hashtextextended('admin-customer-edit',0));
  if recipient<>p_email then
    lock table orders,customer_profiles,subscribers,cart_sessions,customer_notes,
      sequence_overrides,stock_notifications,recovery_episodes,
      subscription_requests,recovery_requests,email_outbox in share row exclusive mode nowait;
  end if;
  if not exists(select 1 from customer_profiles where email=p_email)
    and not exists(select 1 from orders where lower(trim(customer_email))=p_email)
    and not exists(select 1 from subscribers where lower(trim(email))=p_email)
    and not exists(select 1 from cart_sessions where lower(trim(email))=p_email)
    and not exists(select 1 from stock_notifications where lower(trim(email))=p_email) then
    raise exception 'Customer not found. It may have changed in another editor.';
  end if;
  insert into customer_profiles(email) values(p_email) on conflict(email) do nothing;
  select * into profile from customer_profiles where email=p_email for update;
  if p_version is null or profile.edit_version<>p_version then
    raise exception 'Customer changed in another editor. Reload the page and reconcile your draft.';
  end if;

  before_details:=jsonb_build_object('email',p_email,'name',profile.name,'phone',profile.phone,'address',profile.address);
  if profile.edit_version=0 then
    select jsonb_build_object('email',p_email,'name',customer_name,'phone',shipping_address->>'phone',
      'address',coalesce(shipping_address,'{}'::jsonb)-'phone') into before_details
      from orders where lower(trim(customer_email))=p_email order by created_at desc,id desc limit 1;
    before_details:=coalesce(before_details,jsonb_build_object('email',p_email,'name',null,'phone',null,'address','{}'::jsonb));
  end if;

  if recipient<>p_email then
    if exists(select 1 from orders where lower(trim(customer_email))=recipient)
      or exists(select 1 from customer_profiles where email<>p_email and (lower(trim(email))=recipient or recipient=any(previous_emails)))
      or exists(select 1 from subscribers where lower(trim(email))=recipient)
      or exists(select 1 from cart_sessions where lower(trim(email))=recipient)
      or exists(select 1 from stock_notifications where lower(trim(email))=recipient)
      or exists(select 1 from customer_notes where lower(trim(email))=recipient)
      or exists(select 1 from sequence_overrides where lower(trim(email))=recipient)
      or exists(select 1 from recovery_episodes where lower(trim(coalesce(customer_email,email)))=recipient)
      or (not (recipient=any(profile.previous_emails)) and exists(select 1 from subscription_requests where lower(trim(email))=recipient))
      or (not (recipient=any(profile.previous_emails)) and exists(select 1 from recovery_requests where lower(trim(email))=recipient))
      or exists(select 1 from email_outbox where lower(trim(to_email))=recipient) then
      raise exception 'This email is already in use by another customer record. Customers cannot be merged here.';
    end if;
    if exists(select 1 from email_outbox where lower(trim(to_email))=p_email and (
      status='sending' or (status<>'sent' and
        (provider_attempted_at is not null or provider_message_id is not null or sent_at is not null))
    )) then
      raise exception 'Email delivery is in progress or needs reconciliation. Resolve it in Automation, then retry the email change.';
    end if;

    update orders set customer_email=recipient,updated_at=now() where lower(trim(customer_email))=p_email;
    update subscribers set email=recipient where lower(trim(email))=p_email;
    update cart_sessions set email=recipient,status=case when status='active' then 'abandoned' else status end where lower(trim(email))=p_email;
    update customer_notes set email=recipient where lower(trim(email))=p_email;
    update sequence_overrides set email=recipient where lower(trim(email))=p_email;
    update stock_notifications set email=recipient where lower(trim(email))=p_email;
    update recovery_episodes set customer_email=recipient where lower(trim(coalesce(customer_email,email)))=p_email;
    -- Mailbox-bound credentials cannot authorize the corrected email address.
    update subscription_requests set expires_at=least(expires_at,now()) where lower(trim(email))=p_email and confirmed_at is null;
    update recovery_requests set revoked_at=coalesce(revoked_at,now()) where lower(trim(email))=p_email;

    update email_outbox set
      delivery_email=case when provider_attempted_at is not null or provider_message_id is not null or sent_at is not null
        then coalesce(delivery_email,to_email) else delivery_email end,
      to_email=recipient,
      related_id=case when left(related_id,length(p_email)+1)=p_email||':' then recipient||substr(related_id,length(p_email)+1) else related_id end,
      rendered_subject=case when status in ('queued','failed') then null else rendered_subject end,
      rendered_html=case when status in ('queued','failed') then null else rendered_html end,
      rendered_from=case when status in ('queued','failed') then null else rendered_from end,
      rendered_tag=case when status in ('queued','failed') then null else rendered_tag end
      where lower(trim(to_email))=p_email and template not in ('admin_daily_brief','creator_application_confirmation');
  end if;

  update customer_profiles set email=recipient,name=nullif(trim(p_details->>'name'),''),
    phone=nullif(trim(p_details->>'phone'),''),address=p_details->'address',edit_version=edit_version+1,updated_at=now(),
    previous_emails=case when recipient<>p_email then array_remove(array_append(previous_emails,p_email),recipient) else previous_emails end
    where email=p_email returning * into profile;
  after_details:=jsonb_build_object('email',recipient,'name',profile.name,'phone',profile.phone,'address',profile.address);
  insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff)
    values(p_actor,'customer.update','customer',recipient,jsonb_build_object('before',before_details,'after',after_details));
  return jsonb_build_object('email',recipient,'version',profile.edit_version);
exception when lock_not_available then
  raise exception 'Customer activity is in progress. Please retry saving in a moment.';
end $$;
revoke all on function public.admin_save_customer(text,jsonb,bigint,text) from public,anon,authenticated;
grant execute on function public.admin_save_customer(text,jsonb,bigint,text) to service_role;

-- Unsubscribe links in delivered email remain useful after a contact edit.
-- Bounces still describe their actual mailbox, so never transfer those to a
-- corrected address. Preserve the existing suppression/cart lock order.
create or replace function public.suppress_marketing(p_email text,p_source text default 'unsubscribe')
returns void language plpgsql security definer set search_path=public as $$
declare recipients text[];
begin
  p_email:=lower(trim(p_email));
  perform pg_advisory_xact_lock(hashtextextended('admin-customer-edit',0));
  recipients:=array[p_email];
  if p_source='unsubscribe' then
    recipients:=recipients||array(select email from customer_profiles where p_email=any(previous_emails));
  end if;
  for p_email in select distinct e from unnest(recipients) e order by e loop
    perform pg_advisory_xact_lock(hashtextextended('subscription:'||p_email,0));
    perform pg_advisory_xact_lock(hashtextextended('recovery:'||p_email,0));
    perform 1 from cart_sessions where email=p_email for update;
    perform suppress_marketing_before_recovery(p_email,p_source);
    update recovery_requests set revoked_at=clock_timestamp() where email=p_email and revoked_at is null;
    update cart_sessions set status='abandoned' where email=p_email and status='active';
  end loop;
end $$;
revoke all on function public.suppress_marketing(text,text) from public,anon,authenticated;
grant execute on function public.suppress_marketing(text,text) to service_role;

-- Include operator details for purchasers and leads before filtering/paging.
create or replace view public.admin_people as
with purchasers as (
 select lower(trim(email)) email,max(name) name,sum(orders_count) orders_count,sum(ltv_cents) ltv_cents,max(last_order_at) last_order_at from customers group by 1
), carts as (
 select distinct on(lower(trim(email))) lower(trim(email)) email,subtotal_cents,reminder_stage,updated_at from cart_sessions where status='active' order by lower(trim(email)),updated_at desc
), subs as (
 select lower(trim(email)) email,bool_or(unsubscribed_at is not null) unsubscribed from subscribers group by 1
), identities as (
 select email from purchasers union select email from carts union select email from subs union select email from customer_profiles
), people as (
 select i.email,case when cp.edit_version>0 then cp.name else p.name end name,coalesce(p.orders_count,0) orders_count,coalesce(p.ltv_cents,0) ltv_cents,p.last_order_at,c.subtotal_cents,c.reminder_stage,
 extract(epoch from now()-c.updated_at)/3600 cart_idle_hours,s.email is not null and not s.unsubscribed subscribed,coalesce(s.unsubscribed,false) unsubscribed
 from identities i left join purchasers p using(email) left join carts c using(email) left join subs s using(email) left join customer_profiles cp using(email)
), vip as (
 select case when count(*)>=10 then (array_agg(ltv_cents order by ltv_cents desc))[greatest(1,floor(count(*)*.1)::integer)] else null end threshold from people where ltv_cents>0
)
select email,name,orders_count as "ordersCount",ltv_cents as "ltvCents",last_order_at as "lastOrderAt",subtotal_cents as "cartValueCents",coalesce(reminder_stage,0) as "cartStage",cart_idle_hours as "cartIdleHours",subscribed,unsubscribed,
array_remove(array[
 case when orders_count=0 then 'leads' end,
 case when orders_count=1 then 'one_time' end,
 case when orders_count>=2 then 'repeat' end,
 case when ltv_cents>0 and ltv_cents>=(select threshold from vip) then 'vip' end,
 case when subtotal_cents is not null and cart_idle_hours>=1 then 'in_recovery' end,
 case when last_order_at<=now()-interval '45 days' and last_order_at>now()-interval '90 days' then 'at_risk' end,
 case when last_order_at<=now()-interval '90 days' then 'lapsed' end,
 case when unsubscribed then 'unsubscribed' end
],null) as segments from people;
revoke all on public.admin_people from public,anon,authenticated;
grant select on public.admin_people to service_role;

-- Keep immutable recovery captures linked to their current customer.
create or replace view admin_recovery_episodes as
select e.id episode_id,coalesce(e.customer_email,e.email) email,e.cart,e.subtotal_cents,
 case when e.legacy_unknown then e.legacy_status when e.order_id is not null then 'recovered' when e.state in ('active','superseded','legacy_unknown') then 'active' else 'abandoned' end status,
 case when e.id=c.current_episode_id then coalesce(c.reminder_stage,0) else 0 end reminder_stage,
 case when e.id=c.current_episode_id then c.reminder_sent_at else null end reminder_sent_at,
 coalesce(e.order_id,e.legacy_order_id) recovered_order_id,e.captured_at created_at,e.captured_at updated_at,e.state,e.legacy_unknown,
 exposure.first_sent_at,
 o.created_at order_created_at,o.paid_at,case when o.paid_at is not null and o.status in ('paid','processing','shipped','completed','refunded') then greatest(0,o.total_cents-coalesce(o.refunded_cents,0)) else 0 end net_paid_cents,
 exposure.first_sent_at is not null and exposure.first_sent_at<=o.created_at and exposure.first_sent_at>=e.captured_at and not e.legacy_unknown attributable
from recovery_episodes e left join cart_sessions c on c.email=coalesce(e.customer_email,e.email) left join orders o on o.id=coalesce(e.order_id,e.legacy_order_id)
left join lateral(select min(sent_at) first_sent_at from email_outbox where payload->>'recovery_episode_id'=e.id::text and template in ('abandoned_cart','abandoned_cart_2','abandoned_cart_3') and status='sent' and sent_at is not null) exposure on true;
revoke all on admin_recovery_episodes from public,anon,authenticated;
grant select on admin_recovery_episodes to service_role;
