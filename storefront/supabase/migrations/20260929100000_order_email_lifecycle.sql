-- Event-driven order notifications. Existing completed orders are deliberately
-- not backfilled: applying a migration must not email historical customers.
alter table public.orders add column completed_at timestamptz;

create function public.guard_order_email_milestones() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.status='shipped' and old.status<>'shipped' then
  new.tracking_number:=nullif(btrim(coalesce(new.tracking_number,old.tracking_number)),'');
  if new.tracking_number is null then raise exception 'Tracking number is required before marking an order shipped';end if;
 elsif new.status in ('shipped','completed') and new.tracking_number is distinct from old.tracking_number then
  new.tracking_number:=nullif(btrim(new.tracking_number),'');
  if new.tracking_number is null then raise exception 'Tracking number cannot be cleared after shipping';end if;
 end if;
 if new.status='completed' and old.status='shipped' then new.completed_at:=now();end if;
 return new;
end $$;
-- Normalize before the existing uniqueness/format tracking guard.
create trigger guard_order_email_milestones before update on public.orders
 for each row execute function public.guard_order_email_milestones();

create or replace function public.enqueue_commerce_email() returns trigger
language plpgsql set search_path=public as $$
declare o orders%rowtype; template_name text; body jsonb; identity text; products jsonb;
begin
 template_name:=case new.kind
  when 'created' then 'payment_instructions' when 'reinstated' then 'payment_instructions'
  when 'edit_item' then 'payment_instructions' when 'expired' then 'payment_expired'
  when 'paid' then 'order_confirmation' when 'shipped' then 'order_shipped'
  when 'completed' then 'post_purchase_review'
  when 'refunded' then 'order_refunded' when 'refund_items' then 'order_refunded' end;
 if template_name is null then return new;end if;
 select * into strict o from orders where id=new.order_id;
 identity:='event:'||new.id::text;
 if new.kind='completed' then
  if o.status<>'completed' or o.completed_at is null or o.refunded_cents>0 then return new;end if;
  identity:=o.id::text||':pp:review';
  select jsonb_agg(distinct i.product_name) into products from order_items i
   left join products p on p.slug=i.product_slug
   where i.order_id=o.id and i.qty>i.refunded_qty and not coalesce(p.categories @> '["accessory"]'::jsonb,false);
  -- Still check arrival when there is nothing left to review or a review exists.
  if products is null or exists(select 1 from reviews where order_id=o.id) then template_name:='arrival_checkin';end if;
 end if;
 -- Every shipment event sends a notification, including carrier imports.
 -- The canonical operation only emits a tracking-correction event when the
 -- operator explicitly requests notification, so silent corrections stay silent.
 body:=jsonb_build_object('order_id',o.id,'order_number',o.order_number,'payment_method',o.payment_method,
  'reference',o.payment_reference,'payment_expires_at',o.payment_expires_at,
  'amount_cents',case when template_name='order_refunded' then coalesce((new.payload->>'refundedCents')::integer,0) else o.total_cents end,
  'tracking_number',o.tracking_number);
 if new.kind='completed' then body:=body||jsonb_build_object('completed_at',o.completed_at,'products',coalesce(products,'[]'::jsonb));end if;
 insert into email_outbox(to_email,template,payload,related_type,related_id)
 values(o.customer_email,template_name,body,'order',identity)
 on conflict(to_email,template,related_id) do update
 set payload=excluded.payload,status='queued',error=null,next_attempt_at=now(),
  attempt_count=0,first_attempt_at=null,rendered_subject=null,rendered_html=null,
  rendered_from=null,rendered_tag=null,lease_token=null,lease_expires_at=null
 -- Upgrade a legacy, provably never-sent review instead of losing the new
 -- completion notification to its once-per-order identity. Never change a
 -- provider request after it might have been sent, or interfere with a lease.
 where new.kind='completed' and email_outbox.payload->>'completed_at' is null
  and email_outbox.provider_attempted_at is null and email_outbox.provider_message_id is null and email_outbox.sent_at is null
  and (email_outbox.status in ('queued','failed')
   or (email_outbox.status='cancelled' and email_outbox.error in ('Order is not completed','Completion notification is stale')));
 return new;
end $$;

-- Retire shipment-age check-ins/reminders and prevent premature or stale review
-- delivery, including previously queued messages and manual send-now actions.
alter function public.email_delivery_ineligible(public.email_outbox) rename to email_delivery_ineligible_before_completion;
revoke all on function public.email_delivery_ineligible_before_completion(public.email_outbox) from public,anon,authenticated,service_role;
create function public.email_delivery_ineligible(r public.email_outbox) returns text
language plpgsql stable security definer set search_path=public as $$
declare o orders%rowtype; reason text;
begin
 if r.template='post_purchase_review_reminder' then return 'Shipment-age review reminder retired';end if;
 if r.template in ('arrival_checkin','post_purchase_review') then
  select * into o from orders where id::text=r.payload->>'order_id' and customer_email=r.to_email;
  if not found or o.status<>'completed' or o.completed_at is null then return 'Order is not completed';end if;
  reason:=email_delivery_ineligible_before_completion(r);
  if reason is not null then return reason;end if;
  if o.refunded_cents>0 then return 'Order was refunded';end if;
  if r.payload->>'completed_at' is null or (r.payload->>'completed_at')::timestamptz is distinct from o.completed_at then return 'Completion notification is stale';end if;
  return null;
 end if;
 return email_delivery_ineligible_before_completion(r);
end $$;
revoke all on function public.guard_order_email_milestones(),public.enqueue_commerce_email(),public.email_delivery_ineligible(public.email_outbox) from public,anon,authenticated;
grant execute on function public.guard_order_email_milestones(),public.enqueue_commerce_email(),public.email_delivery_ineligible(public.email_outbox) to service_role;
