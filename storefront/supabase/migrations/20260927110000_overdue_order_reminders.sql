-- Age operational queues independently of order creation and ordinary edits.
create function public.order_action_queue(p_status text) returns text
language sql immutable set search_path=public as $$
  select case when p_status='pending' then 'awaiting_payment'
    when p_status in ('paid','processing') then 'to_fulfil' end
$$;

alter table public.orders add column action_queue_entered_at timestamptz;
update public.orders o set action_queue_entered_at=coalesce(
  (select e.created_at from order_events e where e.order_id=o.id
    and order_action_queue(e.to_status)=order_action_queue(o.status)
    and order_action_queue(e.from_status) is distinct from order_action_queue(e.to_status)
    order by e.created_at desc,e.id desc limit 1),
  case when o.status in ('paid','processing') then o.paid_at end, o.created_at)
where o.status in ('pending','paid','processing');

create function public.track_order_action_queue() returns trigger
language plpgsql set search_path=public as $$
begin
  if order_action_queue(new.status) is null then
    new.action_queue_entered_at:=null;
  elsif tg_op='INSERT' then
    new.action_queue_entered_at:=coalesce(
      case when new.status in ('paid','processing') then new.paid_at end,new.created_at,now());
  elsif order_action_queue(new.status) is distinct from order_action_queue(old.status) then
    new.action_queue_entered_at:=now();
  else
    new.action_queue_entered_at:=old.action_queue_entered_at;
  end if;
  return new;
end $$;
create trigger track_order_action_queue before insert or update of status on public.orders
for each row execute function public.track_order_action_queue();
create index orders_action_queue_age_idx on public.orders(action_queue_entered_at,id)
where status in ('pending','paid','processing');
create index email_overdue_order_recipient_idx on public.email_outbox
  ((payload->>'order_id'),to_email,created_at desc) where template='admin_order_overdue';

-- The outbox remains the durable receipt for each reminder. Serialize sweeps,
-- dedupe per queue entry / UTC day, and enforce at least 24h between enqueues.
-- Limit recipient rows (not orders); subsequent batches cannot starve admins.
create function public.queue_overdue_order_reminders(p_limit integer default 100)
returns table(outbox_id uuid) language plpgsql set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('overdue-order-reminders',0));
  return query
  insert into email_outbox(to_email,template,payload,related_type,related_id)
  select a.email,'admin_order_overdue',jsonb_build_object(
    'order_id',o.id,'order_number',o.order_number,'customer_name',o.customer_name,
    'amount_cents',o.total_cents,'queue',order_action_queue(o.status),
    'queue_entered_at',o.action_queue_entered_at,
    'hours_waiting',floor(extract(epoch from (now()-o.action_queue_entered_at))/3600)),
    'order',o.id::text||':'||order_action_queue(o.status)||':'||
      extract(epoch from o.action_queue_entered_at)::text||':'||floor(extract(epoch from now())/86400)::text
  from orders o cross join (select distinct lower(trim(email)) email from admin_users where active) a
  where o.status in ('pending','paid','processing') and o.action_queue_entered_at<now()-interval '24 hours'
    and not exists(select 1 from email_outbox e where e.template='admin_order_overdue'
      and e.to_email=a.email and e.payload->>'order_id'=o.id::text
      and e.payload->>'queue'=order_action_queue(o.status)
      and (e.payload->>'queue_entered_at')::timestamptz=o.action_queue_entered_at
      and (e.created_at>now()-interval '24 hours' or e.sent_at>now()-interval '24 hours'
        or e.status in ('queued','failed','sending')))
  order by o.action_queue_entered_at,o.id,a.email limit greatest(1,least(p_limit,100))
  on conflict(to_email,template,related_id) do nothing returning id;
end $$;

-- Retain all existing recovery/commerce rules and add a narrow admin-only case.
alter function public.email_delivery_ineligible(public.email_outbox) rename to email_delivery_ineligible_before_overdue;
revoke all on function public.email_delivery_ineligible_before_overdue(public.email_outbox) from public,anon,authenticated,service_role;
create function public.email_delivery_ineligible(r public.email_outbox) returns text
language plpgsql stable security definer set search_path=public as $$
begin
  if r.template<>'admin_order_overdue' then return email_delivery_ineligible_before_overdue(r); end if;
  if not exists(select 1 from admin_users where lower(trim(email))=r.to_email and active) then
    return 'Admin recipient no longer active';
  end if;
  if not exists(select 1 from orders o where o.id::text=r.payload->>'order_id'
    and order_action_queue(o.status)=r.payload->>'queue'
    and o.action_queue_entered_at=(r.payload->>'queue_entered_at')::timestamptz
    and o.action_queue_entered_at<now()-interval '24 hours') then
    return 'Order is no longer overdue in this queue';
  end if;
  return null;
end $$;

-- An admin may also be a customer. Correcting their customer email must never
-- reroute an internal priority notification to the corrected customer address.
do $patch$
declare definition text; updated text;
begin
  definition:=pg_get_functiondef('public.admin_save_customer(text,jsonb,bigint,text)'::regprocedure);
  updated:=replace(definition,
    $$template not in ('admin_daily_brief','creator_application_confirmation')$$,
    $$template not in ('admin_daily_brief','admin_order_overdue','creator_application_confirmation')$$);
  if definition=updated then raise exception 'Customer email exclusion changed; review admin notification protection'; end if;
  execute updated;
  -- Internal notifications survive a recipient's customer marketing opt-out.
  definition:=pg_get_functiondef('public.suppress_marketing_before_recovery(text,text)'::regprocedure);
  updated:=replace(definition,
    $$'subscription_confirmation','admin_daily_brief'$$,
    $$'subscription_confirmation','admin_daily_brief','admin_order_overdue'$$);
  if definition=updated then raise exception 'Marketing suppression exclusions changed; review admin notification protection'; end if;
  execute updated;
end $patch$;

revoke all on function public.order_action_queue(text),public.track_order_action_queue(),
  public.queue_overdue_order_reminders(integer),public.email_delivery_ineligible(public.email_outbox)
  from public,anon,authenticated;
grant execute on function public.order_action_queue(text),public.track_order_action_queue(),
  public.queue_overdue_order_reminders(integer),public.email_delivery_ineligible(public.email_outbox) to service_role;
