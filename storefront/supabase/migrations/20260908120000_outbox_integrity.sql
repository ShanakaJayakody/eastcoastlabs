-- Durable, leased delivery. Apply after commerce_integrity.
alter table public.email_outbox drop constraint if exists email_outbox_status_check;
alter table public.email_outbox add constraint email_outbox_status_check
  check (status in ('queued','sending','sent','failed','cancelled','dead'));
alter table public.email_outbox
  add column attempt_count integer not null default 0,
  add column first_attempt_at timestamptz,
  add column next_attempt_at timestamptz not null default now(),
  add column provider_attempted_at timestamptz,
  add column lease_token uuid,
  add column lease_expires_at timestamptz;
-- Pre-migration delivery history cannot prove that a provider was never called.
-- Only newly created intents can qualify for automatic unsent-stock rearming.
update public.email_outbox set provider_attempted_at=created_at;
create index email_outbox_due_idx on public.email_outbox(next_attempt_at,created_at)
  where status in ('queued','failed','sending');

-- Unknown and retired templates fail closed. Transactional messages have a
-- narrow exemption from marketing consent, but still require the right order state.
create function public.email_delivery_ineligible(r public.email_outbox) returns text
language plpgsql stable set search_path=public as $$
declare sequence_name text; o orders%rowtype; is_transactional boolean;
begin
 if r.template not in ('order_confirmation','order_shipped','order_refunded','back_in_stock',
   'abandoned_cart','abandoned_cart_2','abandoned_cart_3','payment_instructions','payment_reminder','payment_expiring','payment_expired',
   'welcome_1','welcome_3','arrival_checkin','post_purchase_review','post_purchase_review_reminder','review_thank_you',
   'replenishment','winback_60','winback_90','second_purchase_nudge','subscription_confirmation','admin_daily_brief') then return 'Unknown or retired template'; end if;
 if r.template='admin_daily_brief' then
  if not exists(select 1 from admin_users where email=r.to_email and active) then return 'Admin recipient no longer active'; end if;
  return null;
 end if;
 if r.template='subscription_confirmation' then
  if not subscription_confirmation_eligible(r.related_id,r.to_email) then return 'Confirmation expired or no longer required'; end if;
  return null;
 end if;
 is_transactional:=r.template in ('order_confirmation','order_shipped','order_refunded','payment_instructions','payment_reminder','payment_expiring','payment_expired');
 if not is_transactional and exists(select 1 from subscribers where email=r.to_email and unsubscribed_at is not null) then return 'Marketing suppressed'; end if;
 if r.template='back_in_stock' then
  if not back_in_stock_eligible(r) then return 'Stock request changed or product unavailable'; end if;
 end if;
 sequence_name:=case
  when r.template like 'abandoned_cart%' then 'cart_recovery'
  when r.template in ('payment_reminder','payment_expiring') then 'payment_reminders'
  when r.template like 'welcome_%' then 'welcome'
  when r.template in ('arrival_checkin','post_purchase_review','post_purchase_review_reminder') then 'post_purchase_review'
  when r.template='review_thank_you' then 'review_thank_you'
  when r.template='replenishment' then 'replenishment'
  when r.template like 'winback_%' then 'winback'
  when r.template='second_purchase_nudge' then 'second_purchase' end;
 if exists(select 1 from sequence_overrides where email=r.to_email and sequence=sequence_name and action='pause') then return 'Sequence paused'; end if;
 if not is_transactional and r.template<>'back_in_stock' and not exists(
  select 1 from subscribers where email=r.to_email and source not in ('unsubscribe','bounce','complaint') and source not like 'back_in_stock:%' and unsubscribed_at is null
 ) then return 'No active marketing consent'; end if;
 if r.template like 'abandoned_cart%' then
  if not exists(select 1 from cart_sessions where email=r.to_email and current_episode_id::text=r.payload->>'recovery_episode_id') then return 'Recovery capture changed'; end if;
  if not exists(select 1 from cart_sessions where email=r.to_email and status='active' and updated_at<=r.created_at
    and updated_at>now()-interval '7 days') then return 'Cart is no longer eligible'; end if;
  if exists(select 1 from orders where customer_email=r.to_email and created_at>=r.created_at and status<>'cancelled') then return 'Order already placed'; end if;
 end if;
 if r.template like 'welcome_%' then
  if not exists(select 1 from subscribers where email=r.to_email and source not like 'back_in_stock:%' and source<>'unsubscribe' and unsubscribed_at is null) then return 'No newsletter consent'; end if;
  if exists(select 1 from orders where customer_email=r.to_email and status not in ('pending','cancelled')) then return 'Welcome series completed'; end if;
 end if;
 if r.template like 'winback_%' or r.template in ('replenishment','second_purchase_nudge') then
  if exists(select 1 from orders where customer_email=r.to_email and created_at>=r.created_at and status<>'cancelled') then return 'Customer placed a newer order'; end if;
 end if;
 if is_transactional or r.template in ('arrival_checkin','post_purchase_review','post_purchase_review_reminder') then
  select * into o from orders where customer_email=r.to_email and
   (id::text=r.payload->>'order_id' or (r.payload->>'order_id' is null and order_number=r.payload->>'order_number'));
  if not found then return 'Order unavailable'; end if;
  if r.template in ('payment_instructions','payment_reminder','payment_expiring') and
    (o.status<>'pending' or (o.payment_expires_at is not null and o.payment_expires_at<=now())) then return 'Payment is no longer due'; end if;
  if r.template in ('payment_instructions','payment_reminder','payment_expiring') and
    ((r.payload ? 'amount_cents' and (r.payload->>'amount_cents')::integer is distinct from o.total_cents)
    or (r.payload ? 'payment_expires_at' and (r.payload->>'payment_expires_at')::timestamptz is distinct from o.payment_expires_at)) then return 'Payment details changed'; end if;
  if r.template='order_shipped' and (r.payload->>'tracking_number') is distinct from o.tracking_number then return 'Tracking details changed'; end if;
  if r.template='payment_expired' and o.status<>'cancelled' then return 'Order no longer cancelled'; end if;
  if r.template='order_confirmation' and o.status not in ('paid','processing','shipped','completed') then return 'Payment not confirmed'; end if;
  if r.template in ('order_shipped','arrival_checkin','post_purchase_review','post_purchase_review_reminder') and o.status not in ('shipped','completed') then return 'Order not fulfilled'; end if;
  if r.template in ('post_purchase_review','post_purchase_review_reminder') and exists(select 1 from reviews where order_id=o.id) then return 'Review already received'; end if;
 end if;
 return null;
end $$;

create function public.claim_email_outbox(p_limit integer default 50,p_id uuid default null)
returns setof public.email_outbox language plpgsql set search_path=public as $$
begin
 -- Provider idempotency expires after 24h. Stop ambiguous retries before that
 -- boundary; an operator must reconcile the provider before starting a new send.
 update email_outbox set status='dead',error='Retry budget exhausted; reconcile provider before retry',lease_token=null,lease_expires_at=null
 where (p_id is null or id=p_id) and status in ('queued','failed','sending')
 and (status<>'sending' or lease_expires_at<=now())
 and (attempt_count>=6 or first_attempt_at<now()-interval '23 hours');
 return query with candidates as (
  select id from email_outbox
  where (p_id is null or id=p_id) and next_attempt_at<=now()
    and (status in ('queued','failed') or (status='sending' and lease_expires_at<=now()))
  order by next_attempt_at,created_at,id for update skip locked limit greatest(1,least(p_limit,100))
 ) update email_outbox e set status='sending',lease_token=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes',
   attempt_count=attempt_count+1,first_attempt_at=coalesce(first_attempt_at,now())
 from candidates c where e.id=c.id returning e.*;
end $$;

create function public.authorize_email_delivery(p_id uuid,p_lease uuid) returns boolean
language plpgsql set search_path=public as $$
declare r email_outbox%rowtype; reason text;
begin
 select * into r from email_outbox where id=p_id and status='sending' and lease_token=p_lease and lease_expires_at>now() for update;
 if not found then return false; end if;
 reason:=email_delivery_ineligible(r);
 if reason is not null then
  if reason='Stock request changed or product unavailable' and r.attempt_count=1
    and r.provider_attempted_at is null and r.provider_message_id is null and r.sent_at is null then
   perform rearm_unsent_stock_notification(r);
  end if;
  update email_outbox set status='cancelled',error=reason,lease_token=null,lease_expires_at=null where id=p_id;
  return false;
 end if;
 -- Record potential provider contact before releasing the authorization call.
 -- A crash here is conservatively ambiguous, never grounds for a fresh send ID.
 update email_outbox set provider_attempted_at=coalesce(provider_attempted_at,now()) where id=p_id;
 return true;
end $$;

create function public.finish_email_outbox(p_id uuid,p_lease uuid,p_status text,p_error text default null,p_provider_id text default null)
returns void language plpgsql set search_path=public as $$
declare recipient text;
begin
 if p_status not in ('sent','failed','cancelled') then raise exception 'Invalid delivery result'; end if;
 select to_email into recipient from email_outbox where id=p_id;
 if p_provider_id is not null then
  -- Same lock as the webhook insert: delivery/event arrival order is irrelevant.
  perform pg_advisory_xact_lock(hashtextextended('email-provider:'||p_provider_id||':'||recipient,0));
 end if;
 update email_outbox set status=case when p_status='failed' and attempt_count>=6 then 'dead' else p_status end,
  error=left(p_error,1000),provider_message_id=coalesce(p_provider_id,provider_message_id),
  sent_at=case when p_status='sent' then now() else sent_at end,
  next_attempt_at=now()+make_interval(secs=>least(3600,60*power(3,attempt_count-1)::integer)),
  lease_token=null,lease_expires_at=null
 where id=p_id and status='sending' and lease_token=p_lease;
 if not found then raise exception 'Delivery lease lost; reconcile provider outcome'; end if;
 if p_provider_id is not null then
  update email_events set outbox_id=p_id where outbox_id is null and to_email=recipient and detail->>'message_id'=p_provider_id;
 end if;
end $$;

-- A failed intent insert rolls the order operation back. No network request is
-- made from a transaction. Each event has its own stable provider identity.
create function public.enqueue_commerce_email() returns trigger language plpgsql set search_path=public as $$
declare o orders%rowtype; template_name text; body jsonb;
begin
 template_name:=case new.kind when 'created' then 'payment_instructions' when 'reinstated' then 'payment_instructions' when 'edit_item' then 'payment_instructions' when 'expired' then 'payment_expired' when 'paid' then 'order_confirmation'
  when 'shipped' then 'order_shipped' when 'refunded' then 'order_refunded' when 'refund_items' then 'order_refunded' end;
 if template_name is null then return new; end if;
 select * into strict o from orders where id=new.order_id;
 body:=jsonb_build_object('order_id',o.id,'order_number',o.order_number,'payment_method',o.payment_method,
  'reference',o.payment_reference,'payment_expires_at',o.payment_expires_at,'amount_cents',case when template_name='order_refunded' then coalesce((new.payload->>'refundedCents')::integer,0) else o.total_cents end,
  'tracking_number',o.tracking_number);
 insert into email_outbox(to_email,template,payload,related_type,related_id)
 values(o.customer_email,template_name,body,'order','event:'||new.id::text)
 on conflict(to_email,template,related_id) do nothing;
 return new;
end $$;
create trigger commerce_email_intent after insert on public.commerce_events for each row execute function public.enqueue_commerce_email();

revoke all on function public.email_delivery_ineligible(public.email_outbox),public.claim_email_outbox(integer,uuid),
 public.authorize_email_delivery(uuid,uuid),public.finish_email_outbox(uuid,uuid,text,text,text),public.enqueue_commerce_email() from public,anon,authenticated;
grant execute on function public.claim_email_outbox(integer,uuid),public.authorize_email_delivery(uuid,uuid),
 public.finish_email_outbox(uuid,uuid,text,text,text),public.email_delivery_ineligible(public.email_outbox),public.enqueue_commerce_email() to service_role;

-- Preserve the exact provider request across retries, including generated links
-- and settings-derived copy. A reused provider key must never get a changed body.
alter table public.email_outbox add column rendered_subject text, add column rendered_html text;
create function public.prepare_email_delivery(p_id uuid,p_lease uuid,p_subject text,p_html text)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;
begin
 update email_outbox set rendered_subject=coalesce(rendered_subject,p_subject),rendered_html=coalesce(rendered_html,p_html)
 where id=p_id and status='sending' and lease_token=p_lease and lease_expires_at>now()
 returning jsonb_build_object('subject',rendered_subject,'html',rendered_html) into result;
 if not found then raise exception 'Delivery lease lost'; end if;
 return result;
end $$;
revoke all on function public.prepare_email_delivery(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.prepare_email_delivery(uuid,uuid,text,text) to service_role;

-- Resolve webhooks that arrive after provider persistence or concurrently with
-- completion. Exact provider ID + recipient only; no latest-email guesses.
create function public.match_email_event() returns trigger language plpgsql set search_path=public as $$
declare message_id text; matched uuid;
begin
 message_id:=new.detail->>'message_id';
 if message_id is not null then
  perform pg_advisory_xact_lock(hashtextextended('email-provider:'||message_id||':'||new.to_email,0));
  select id into matched from email_outbox where provider_message_id=message_id and to_email=new.to_email order by created_at limit 1;
  new.outbox_id:=matched;
 end if;
 return new;
end $$;
create trigger match_email_event before insert on public.email_events for each row execute function public.match_email_event();
update public.email_events e set outbox_id=o.id from public.email_outbox o
 where e.outbox_id is null and e.to_email=o.to_email and e.detail->>'message_id'=o.provider_message_id;
revoke all on function public.match_email_event() from public,anon,authenticated;
grant execute on function public.match_email_event() to service_role;

-- Upgrade old queued order/review payloads to a verified internal identity.
-- Templates generate new scoped links; old email/order-number links are ignored.
update public.email_outbox e set payload=(e.payload-'review_url')||jsonb_build_object('order_id',o.id)
 from public.orders o where e.status in ('queued','failed') and e.to_email=o.customer_email
 and e.payload->>'order_number'=o.order_number and e.payload->>'order_id' is null;
