-- Preserve reviewed refund/fulfilment contracts; record deltas where money is allocated.
create or replace function public.commerce_order_operation(p_order uuid,p_action text,p_options jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare
 o orders%rowtype; previous text; action text:=p_action; r record; it order_items%rowtype; line jsonb;
 key text:=p_options->>'idempotencyKey'; request jsonb:=jsonb_build_object('action',p_action,'options',p_options-'idempotencyKey'); cached commerce_operations%rowtype;
 restock boolean:=coalesce((p_options->>'restock')::boolean,true); result jsonb; refunds jsonb;
 q int; amount int; refund_delta int:=0; goods_delta int:=0; shipping_delta int:=0; fully boolean; actor text:=coalesce(p_options->>'actor','system'); expiry int; subtotal int; discount_amount int; shipping int; d discounts%rowtype; delta int;
begin
 select * into o from orders where id=p_order for update;
 if not found then raise exception 'Order not found'; end if;
 if key is not null then
  select * into cached from commerce_operations where order_id=p_order and operation_key=key;
  if found then
   if cached.request<>request then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
   return cached.result;
  end if;
 end if;
 previous:=o.status;
 if action='expire' then
  if o.status<>'pending' or o.payment_expires_at is null or o.payment_expires_at>now() then return jsonb_build_object('changed',false,'status',o.status); end if;
  action:='cancelled';
 end if;
 if action in ('paid','processing','shipped','completed','cancelled','refunded') and action=o.status then
  result:=jsonb_build_object('changed',false,'status',o.status,'refundedCents',0,'fullyRefunded',o.status='refunded');
  if key is not null then insert into commerce_operations values(p_order,key,request,result,now()); end if;
  return result;
 end if;
 perform inv.variant_id from inventory inv where inv.variant_id in(select c.pool_variant_id from order_stock_claims c join order_items i on i.id=c.item_id where i.order_id=p_order) order by inv.variant_id for update;
 if action='reinstate' then
  if o.status<>'cancelled' then raise exception 'Only cancelled orders can be reinstated'; end if;
  if o.refunded_cents>0 or exists(select 1 from order_items where order_id=p_order and refunded_qty>0) then raise exception 'Cannot reinstate refunded items'; end if;
  if o.stock_settled and exists(select 1 from order_items where order_id=p_order and variant_id is not null and returned_qty<qty) then raise exception 'Cannot reinstate stock that was not returned'; end if;
  expiry:=coalesce((p_options->>'paymentExpiryHours')::int,48);
  if expiry<1 or expiry>720 then raise exception 'Invalid expiry'; end if;
  for r in select c.pool_variant_id,sum(i.qty*c.units_per_item)::int units from order_stock_claims c join order_items i on i.id=c.item_id where i.order_id=p_order group by c.pool_variant_id order by c.pool_variant_id loop
   if not reserve_stock(r.pool_variant_id,r.units) then raise exception 'OUT_OF_STOCK:%',r.pool_variant_id; end if;
  end loop;
  if o.discount_code is not null and not o.discount_counted then
   select * into d from discounts where code=o.discount_code for update;
   if not found or not d.active or (d.expires_at is not null and d.expires_at<=now()) or (d.usage_limit is not null and d.used_count+(select count(*) from orders where discount_code=d.code and status='pending' and not discount_counted)>=d.usage_limit) then raise exception 'Discount unavailable for reinstatement'; end if;
  end if;
  update order_items set returned_qty=0 where order_id=p_order;
  update orders set status='pending',stock_reserved=true,stock_settled=false,stock_restored=false,paid_at=null,payment_expires_at=now()+make_interval(hours=>expiry),updated_at=now() where id=p_order returning * into o;
  insert into order_events(order_id,type,from_status,to_status,message,actor_email) values(p_order,'status','cancelled','pending','Reinstated; stock reserved.',actor);
  if coalesce((p_options->>'toPaid')::boolean,false) then action:='paid'; else action:='reinstated'; end if;
 end if;
 if action='paid' then
  if o.status<>'pending' then raise exception 'Illegal transition % to paid',o.status; end if;
  for r in select c.pool_variant_id,sum(i.qty*c.units_per_item)::int units from order_stock_claims c join order_items i on i.id=c.item_id where i.order_id=p_order group by c.pool_variant_id order by c.pool_variant_id loop
   update inventory set reserved=reserved-r.units,updated_at=now() where variant_id=r.pool_variant_id and reserved>=r.units and on_hand>=r.units;
   if not found then raise exception 'Reservation invariant failed'; end if;
   insert into stock_movements(variant_id,qty,reason,actor_email,order_id) values(r.pool_variant_id,-r.units,'sale',actor,p_order);
  end loop;
  if not o.discount_counted then
  update order_items i set unit_cost_cents=p.unit_cost_cents*v.pack_size from product_variants v join products p on p.id=v.product_id where i.order_id=p_order and i.variant_id=v.id and i.unit_cost_cents is null;
  end if;
  if o.discount_code is not null and not o.discount_counted then
   update discounts set used_count=used_count+1 where code=o.discount_code;
   if not found then raise exception 'Discount record missing'; end if;
  end if;
  update orders set status='paid',stock_reserved=false,stock_settled=true,paid_at=now(),discount_counted=true,payment_ref=p_options->>'paymentRef',payment_method=coalesce(p_options->>'paymentMethod',payment_method),updated_at=now() where id=p_order returning * into o;
 elsif action='cancelled' then
  if o.status not in ('pending','paid') then raise exception 'Illegal transition % to cancelled',o.status; end if;
  for r in select c.pool_variant_id,sum((i.qty-i.refunded_qty)*c.units_per_item)::int units from order_stock_claims c join order_items i on i.id=c.item_id where i.order_id=p_order group by c.pool_variant_id order by c.pool_variant_id loop
   if not o.stock_settled and o.stock_reserved then
    update inventory set reserved=reserved-r.units,updated_at=now() where variant_id=r.pool_variant_id and reserved>=r.units;
    if not found then raise exception 'Reservation invariant failed'; end if;
   elsif o.stock_settled and restock and r.units>0 then
    insert into stock_movements(variant_id,qty,reason,actor_email,order_id) values(r.pool_variant_id,r.units,'return',actor,p_order);
   end if;
  end loop;
  if o.stock_settled and restock then update order_items set returned_qty=returned_qty+(qty-refunded_qty) where order_id=p_order; end if;
  update orders set status='cancelled',stock_reserved=false,stock_restored=stock_settled and not exists(select 1 from order_items where order_id=p_order and returned_qty<qty),updated_at=now() where id=p_order returning * into o;
 elsif action in ('refunded','refund_items') then
  if o.status not in ('paid','processing','shipped','completed') then raise exception 'Illegal transition % to refund',o.status; end if;
  if action='refunded' then select jsonb_agg(jsonb_build_object('itemId',id,'qty',qty-refunded_qty)) into refunds from order_items where order_id=p_order and refunded_qty<qty;
  else refunds:=p_options->'refunds'; end if;
  if refunds is null or jsonb_typeof(refunds)<>'array' or jsonb_array_length(refunds)=0 then raise exception 'No refund lines'; end if;
  if (select count(*)<>count(distinct value->>'itemId') from jsonb_array_elements(refunds)) then raise exception 'Duplicate refund item'; end if;
  for line in select value from jsonb_array_elements(refunds) loop
   select * into it from order_items where order_id=p_order and id=(line->>'itemId')::uuid for update;
   q:=(line->>'qty')::int;
   if not found or q is null or q<1 or q>it.qty-it.refunded_qty or (line->>'qty')::numeric<>q then raise exception 'Invalid refund quantity'; end if;
   amount:=round((it.line_total_cents-it.discount_allocated_cents)::numeric*(it.refunded_qty+q)/it.qty)::int-it.refunded_cents;
   if amount<0 then raise exception 'Historical refund allocation requires reconciliation'; end if;
   update order_items set refunded_qty=refunded_qty+q,refunded_cents=refunded_cents+amount,returned_qty=returned_qty+case when restock then q else 0 end where id=it.id;
   refund_delta:=refund_delta+amount;
   if restock then
    for r in select * from order_stock_claims where item_id=it.id order by pool_variant_id loop
     insert into stock_movements(variant_id,qty,reason,actor_email,order_id,note) values(r.pool_variant_id,q*r.units_per_item,'return',actor,p_order,'Refund recorded; physical return');
    end loop;
   end if;
  end loop;
  select not exists(select 1 from order_items where order_id=p_order and refunded_qty<qty) into fully;
  goods_delta:=refund_delta;
  if fully then refund_delta:=o.total_cents-o.refunded_cents; end if;
  shipping_delta:=refund_delta-goods_delta;
  if shipping_delta<0 or shipping_delta>o.shipping_cents then raise exception 'Historical refund allocation requires reconciliation'; end if;
  if refund_delta<0 or o.refunded_cents+refund_delta>o.total_cents then raise exception 'Refund exceeds order total'; end if;
  update orders set refunded_cents=refunded_cents+refund_delta,status=case when fully then 'refunded' else status end,stock_restored=not exists(select 1 from order_items where order_id=p_order and returned_qty<qty),updated_at=now() where id=p_order returning * into o;
  result:=jsonb_build_object('changed',true,'status',o.status,'refundedCents',refund_delta,'goodsRefundedCents',goods_delta,'shippingRefundedCents',shipping_delta,'fullyRefunded',fully);
 elsif action in ('processing','shipped','completed') then
  if not ((o.status='paid' and action in ('processing','shipped')) or (o.status='processing' and action='shipped') or (o.status='shipped' and action='completed')) then raise exception 'Illegal transition % to %',o.status,action; end if;
  update orders set status=action,tracking_number=case when action='shipped' then p_options->>'trackingNumber' else tracking_number end,shipped_at=case when action='shipped' then now() else shipped_at end,updated_at=now() where id=p_order returning * into o;
 elsif action='edit_item' then
  if o.status<>'pending' or o.refunded_cents>0 then raise exception 'Only unrefunded pending orders can be edited'; end if;
  select * into it from order_items where id=(p_options->>'itemId')::uuid and order_id=p_order for update;
  q:=(p_options->>'qty')::int;
  if not found or q is null or q<0 or q>99 or (p_options->>'qty')::numeric<>q then raise exception 'Invalid item quantity'; end if;
  if q=0 and (select count(*) from order_items where order_id=p_order)=1 then raise exception 'Cannot remove final line; cancel the order'; end if;
  delta:=q-it.qty;
  for r in select * from order_stock_claims where item_id=it.id order by pool_variant_id loop
   if delta>0 then
    if not reserve_stock(r.pool_variant_id,delta*r.units_per_item) then raise exception 'OUT_OF_STOCK:%',r.pool_variant_id; end if;
   elsif delta<0 then
    update inventory set reserved=reserved+delta*r.units_per_item,updated_at=now() where variant_id=r.pool_variant_id and reserved>=-delta*r.units_per_item;
    if not found then raise exception 'Reservation invariant failed'; end if;
   end if;
  end loop;
  if q=0 then delete from order_items where id=it.id; else update order_items set qty=q,line_total_cents=q*unit_price_cents where id=it.id; end if;
  select sum(line_total_cents)::int into subtotal from order_items where order_id=p_order;
  discount_amount:=0;
  if o.discount_code is not null then
   select * into d from discounts where code=o.discount_code for update;
   if found and d.active and subtotal>=d.min_spend_cents and (d.starts_at is null or d.starts_at<=now()) and (d.expires_at is null or d.expires_at>now()) and (d.usage_limit is null or d.used_count<d.usage_limit) then
    discount_amount:=least(subtotal,case when d.kind='percent' then round(subtotal*d.percent/100.0)::int else d.value_cents end);
   else d.code:=null;
   end if;
  end if;
  shipping:=case when subtotal-discount_amount<=0 or subtotal-discount_amount>=(p_options->'shippingPolicy'->>'freeThresholdCents')::int then 0 else (p_options->'shippingPolicy'->>'baseCents')::int end;
  if shipping is null or shipping<0 then raise exception 'Invalid shipping policy'; end if;
  update orders set subtotal_cents=subtotal,discount_cents=discount_amount,discount_code=d.code,shipping_cents=shipping,total_cents=subtotal-discount_amount+shipping,updated_at=now() where id=p_order returning * into o;
  perform commerce_allocate_discount(p_order);
 elsif action='tracking' then
  if o.status not in ('shipped','completed') then raise exception 'Tracking requires shipped order'; end if;
  update orders set tracking_number=nullif(trim(p_options->>'trackingNumber'),''),updated_at=now() where id=p_order returning * into o;
 elsif action<>'reinstated' then raise exception 'Unknown commerce action %',action;
 end if;
 result:=coalesce(result,jsonb_build_object('changed',true,'status',o.status,'reinstatedTo',o.status));
 insert into order_events(order_id,type,from_status,to_status,message,actor_email) values(p_order,case when action in ('refunded','refund_items') then 'refund' when action in ('tracking','edit_item') then 'edit' else 'status' end,previous,o.status,action||case when action in ('refunded','refund_items') then ': '||refund_delta::text||' cents recorded' else '' end,actor);
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(actor,'order.'||p_action,'order',p_order::text,jsonb_build_object('from',previous,'result',result,'options',p_options));
 if action<>'tracking' or coalesce((p_options->>'notify')::boolean,false) then
  insert into commerce_events(order_id,kind,payload) values(p_order,case when p_action='expire' then 'expired' when action='tracking' then 'shipped' else action end,result||jsonb_build_object('email',o.customer_email,'trackingNumber',o.tracking_number,'notify',coalesce((p_options->>'notify')::boolean,true)));
 end if;
 if key is not null then insert into commerce_operations values(p_order,key,request,result,now()); end if;
 return result;
end $$;

-- One purchase per order remains; each refund is keyed to its canonical event.
alter table public.paid_analytics_outbox drop constraint paid_analytics_outbox_order_id_key;
alter table public.paid_analytics_outbox add column event_kind text not null default 'purchase' check(event_kind in ('purchase','refund')),
 add column commerce_event_id uuid unique references public.commerce_events(id);
create unique index paid_analytics_purchase_order on public.paid_analytics_outbox(order_id) where event_kind='purchase';
create or replace function public.enqueue_paid_analytics() returns trigger
language plpgsql security invoker set search_path=public as $$
declare o public.orders%rowtype;client text;items jsonb;
begin
  if new.kind <> 'paid' then return new;end if;
  select * into o from public.orders where id=new.order_id;
  client:=o.checkout_request->>'analyticsClientId';
  -- A server-read GA cookie is required; absence is not replaced with an ID.
  if client is null or client !~ '^[0-9]{1,20}\.[0-9]{1,20}$' or o.paid_at is null then return new;end if;
  select jsonb_agg(jsonb_build_object(
    'item_id',left(coalesce(nullif(i.sku,''),nullif(i.product_slug,''),i.id::text),100),
    'item_name',left(coalesce(i.product_name,'Product'),100),
    'quantity',i.qty,
    'price',(i.line_total_cents-i.discount_allocated_cents)::numeric/i.qty/100,
    'discount',i.discount_allocated_cents::numeric/i.qty/100
  ) order by i.id) into items from public.order_items i where i.order_id=o.id and i.qty>0;
  insert into public.paid_analytics_outbox(order_id,occurred_at,payload)
  values(o.id,o.paid_at,jsonb_build_object(
    'client_id',client,'timestamp_micros',floor(extract(epoch from o.paid_at)*1000000),
    'validation_behavior','ENFORCE_RECOMMENDATIONS',
    'events',jsonb_build_array(jsonb_build_object('name','purchase','params',jsonb_build_object(
      'transaction_id',o.order_number,'currency',o.currency,
      'value',(o.subtotal_cents-o.discount_cents)::numeric/100,
      'shipping',o.shipping_cents::numeric/100,'items',coalesce(items,'[]'::jsonb)
    )))
  )) on conflict(order_id) where event_kind='purchase' do nothing;
  return new;
end $$;
create function public.enqueue_refund_analytics() returns trigger language plpgsql security definer set search_path=public as $$
declare original paid_analytics_outbox%rowtype; goods int; shipping int;
begin
 if new.kind not in ('refunded','refund_items') then return new;end if;
 goods:=(new.payload->>'goodsRefundedCents')::int;shipping:=(new.payload->>'shippingRefundedCents')::int;
 if goods is null or shipping is null then return new;end if;
 if goods<0 or shipping<0 or goods+shipping<>(new.payload->>'refundedCents')::int then raise exception 'Invalid refund analytics delta';end if;
 select * into original from paid_analytics_outbox where order_id=new.order_id and event_kind='purchase';
 if not found then return new;end if;
 insert into paid_analytics_outbox(order_id,commerce_event_id,event_kind,occurred_at,payload)
 values(new.order_id,new.id,'refund',new.created_at,jsonb_build_object(
  'client_id',original.payload->>'client_id','timestamp_micros',floor(extract(epoch from new.created_at)*1000000),
  'events',jsonb_build_array(jsonb_build_object('name','refund','params',jsonb_build_object(
   'transaction_id',original.payload#>>'{events,0,params,transaction_id}','currency',original.payload#>>'{events,0,params,currency}',
   'value',goods::numeric/100,'shipping',shipping::numeric/100))))) on conflict(commerce_event_id) do nothing;
 return new;
end $$;
create trigger enqueue_refund_analytics after insert on public.commerce_events for each row execute function public.enqueue_refund_analytics();
create function public.analytics_snapshot_immutable() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then raise exception 'Analytics evidence is immutable';end if;
 if (new.id,new.order_id,new.payload,new.occurred_at,new.event_kind,new.commerce_event_id,new.created_at) is distinct from
    (old.id,old.order_id,old.payload,old.occurred_at,old.event_kind,old.commerce_event_id,old.created_at) then raise exception 'Analytics snapshot is immutable';end if;
 return new;
end $$;
create trigger analytics_snapshot_immutable before update or delete on public.paid_analytics_outbox for each row execute function public.analytics_snapshot_immutable();
create function public.refund_analytics_reconciliation() returns table(order_id uuid,recorded_refund_cents bigint,event_refund_cents bigint,queued_refund_cents bigint,accepted_refund_cents bigint,unexplained_cents bigint)
language sql stable security definer set search_path=public as $$
 select o.id,o.refunded_cents::bigint,coalesce(e.cents,0),coalesce(a.cents,0),coalesce(a.accepted,0),o.refunded_cents-coalesce(e.cents,0)
 from orders o left join lateral (select sum((payload->>'refundedCents')::bigint) cents from commerce_events where order_id=o.id and kind in ('refunded','refund_items') and payload ? 'goodsRefundedCents') e on true
 left join lateral (select sum(round(((payload#>>'{events,0,params,value}')::numeric+(payload#>>'{events,0,params,shipping}')::numeric)*100))::bigint cents,
 sum(round(((payload#>>'{events,0,params,value}')::numeric+(payload#>>'{events,0,params,shipping}')::numeric)*100)) filter(where status='accepted')::bigint accepted from paid_analytics_outbox where order_id=o.id and event_kind='refund') a on true
 where o.refunded_cents>0;
$$;

-- Sender is part of the frozen provider request. Unknown historical senders are
-- never invented for ambiguous already-attempted messages.
alter table public.email_outbox add column rendered_from text, add column rendered_tag text;
create function public.prepare_email_delivery_v2(p_id uuid,p_lease uuid,p_subject text,p_html text,p_from text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r email_outbox%rowtype;
begin
 select * into r from email_outbox where id=p_id and status='sending' and lease_token=p_lease and lease_expires_at>now() for update;
 if not found then raise exception 'Delivery lease lost';end if;
 if r.provider_attempted_at is not null and (r.rendered_from is null or r.rendered_tag is null) then raise exception 'Historical sender or identity tag unknown; provider reconciliation required';end if;
 if coalesce(length(p_from),0)=0 then raise exception 'Sender required';end if;
 update email_outbox set rendered_subject=coalesce(rendered_subject,p_subject),rendered_html=coalesce(rendered_html,p_html),rendered_from=coalesce(rendered_from,p_from),rendered_tag=coalesce(rendered_tag,p_id::text) where id=p_id returning * into r;
 return jsonb_build_object('subject',r.rendered_subject,'html',r.rendered_html,'from',r.rendered_from,'tag',r.rendered_tag);
end $$;
create function public.admin_email_operation(p_id uuid,p_action text,p_actor text,p_reason text,p_provider_id text default null) returns text
language plpgsql security definer set search_path=public as $$
declare r email_outbox%rowtype;recipient text;reason text;
begin
 if coalesce(length(btrim(p_actor)),0) not between 1 and 320 or coalesce(length(btrim(p_reason)),0) not between 1 and 1000 then raise exception 'Actor and reason required';end if;
 select to_email into recipient from email_outbox where id=p_id;
 if p_provider_id is not null then perform pg_advisory_xact_lock(hashtextextended('email-provider:'||p_provider_id||':'||recipient,0));end if;
 select * into r from email_outbox where id=p_id for update;
 if not found then raise exception 'Message not found';end if;
 if r.status='sending' and (r.lease_expires_at is null or r.lease_expires_at>now()) then raise exception 'Active delivery lease';end if;
 if p_action='cancel' then
  if r.status='cancelled' then return r.status;end if;
  if r.provider_attempted_at is not null or r.provider_message_id is not null or r.sent_at is not null or r.status='sent' then raise exception 'Provider reconciliation required; cancellation cannot recall a send';end if;
  update email_outbox set status='cancelled',error='Operator cancelled: '||p_reason,lease_token=null,lease_expires_at=null where id=p_id;
 elsif p_action='retry' then
  if r.status not in ('failed','dead','sending') then raise exception 'Only failed or expired delivery can retry';end if;
  if r.sent_at is not null or r.provider_message_id is not null then raise exception 'Provider reconciliation required';end if;
  if r.attempt_count>=6 then raise exception 'Retry budget exhausted; provider reconciliation required';end if;
  if r.first_attempt_at<=now()-interval '23 hours' or (r.provider_attempted_at is not null and (r.first_attempt_at is null or r.rendered_subject is null or r.rendered_html is null or r.rendered_from is null or r.rendered_tag is null)) then raise exception 'Provider reconciliation required; safe retry identity/window unavailable';end if;
  if r.next_attempt_at>now() then raise exception 'Retry backoff has not elapsed';end if;
  reason:=email_delivery_ineligible(r);if reason is not null then raise exception 'Message ineligible: %',reason;end if;
  update email_outbox set status='queued',error=null,lease_token=null,lease_expires_at=null where id=p_id;
 elsif p_action='reconcile' then
  if p_provider_id is null or r.provider_message_id is distinct from p_provider_id or not exists(select 1 from email_events where outbox_id=r.id and to_email=r.to_email and detail->>'message_id'=p_provider_id) then raise exception 'Exact recorded provider identity and linked event evidence required';end if;
  if exists(select 1 from email_outbox where id<>p_id and provider_message_id=p_provider_id) then raise exception 'Provider identity already attached to another message';end if;
  if r.status='sent' then return 'sent';end if;
  update email_outbox set status='sent',sent_at=coalesce(sent_at,(select min(occurred_at) from email_events where outbox_id=p_id and detail->>'message_id'=p_provider_id)),error=null,lease_token=null,lease_expires_at=null where id=p_id;
 else raise exception 'Unknown operator action';end if;
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(p_actor,'email.'||p_action,'email_outbox',p_id::text,jsonb_build_object('previous',r.status,'reason',p_reason,'provider_id',p_provider_id));
 return (select status from email_outbox where id=p_id);
end $$;
-- Only the server adapter may supply this proof, after read-only provider GET
-- checks. Compare every frozen field again under the row lock, without resending.
create function public.admin_reconcile_email(p_id uuid,p_provider_id text,p_snapshot jsonb,p_actor text,p_reason text) returns text
language plpgsql security definer set search_path=public as $$
declare r email_outbox%rowtype;recipient text;
begin
 if coalesce(length(btrim(p_actor)),0) not between 1 and 320 or coalesce(length(btrim(p_reason)),0) not between 1 and 1000 or coalesce(length(p_provider_id),0) not between 1 and 200 then raise exception 'Actor, reason and provider identity required';end if;
 select to_email into recipient from email_outbox where id=p_id;
 perform pg_advisory_xact_lock(hashtextextended('email-provider:'||p_provider_id||':'||recipient,0));
 select * into r from email_outbox where id=p_id for update;
 if not found then raise exception 'Message not found';end if;
 if r.status='sending' and (r.lease_expires_at is null or r.lease_expires_at>now()) then raise exception 'Active delivery lease';end if;
 if r.provider_attempted_at is null or r.rendered_from is null or r.rendered_tag is distinct from r.id::text or r.rendered_html is null or r.rendered_subject is null or
 p_snapshot is distinct from jsonb_build_object('to',r.to_email,'from',r.rendered_from,'subject',r.rendered_subject,'html',r.rendered_html,'tag',r.rendered_tag,'provider_attempted_at',r.provider_attempted_at,'status',r.status,'lease_token',r.lease_token) then raise exception 'Frozen provider identity changed or unavailable; refresh reconciliation';end if;
 if (r.provider_message_id is not null and r.provider_message_id<>p_provider_id) or exists(select 1 from email_outbox where id<>p_id and provider_message_id=p_provider_id) then raise exception 'Provider identity already assigned';end if;
 update email_outbox set provider_message_id=p_provider_id,status='sent',sent_at=coalesce(sent_at,provider_attempted_at),error=null,lease_token=null,lease_expires_at=null where id=p_id;
 update email_events set outbox_id=p_id where outbox_id is null and to_email=r.to_email and detail->>'message_id'=p_provider_id;
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(p_actor,'email.provider_reconciled','email_outbox',p_id::text,jsonb_build_object('previous',r.status,'reason',p_reason,'provider_id',p_provider_id,'evidence','Provider GET matched frozen outbox tag/recipient/sender/subject/html'));
 return 'sent';
end $$;

-- A private bundle helper is reachable only through the guarded product RPCs.
create function public.admin_product_tiers(p_product uuid,p_sku text,p_tiers jsonb,p_stock integer,p_actor text) returns void
language plpgsql security definer set search_path=public as $$
declare tier jsonb;v uuid;position int:=0;
begin
 if jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers) not between 1 and 20 or p_stock is null or p_stock not between 0 and 1000000 then raise exception 'Invalid tiers or opening stock';end if;
 if (select count(*)<>count(distinct value->>'pack_size') from jsonb_array_elements(p_tiers)) or (select count(*) from jsonb_array_elements(p_tiers) where (value->>'pack_size')::numeric=1)<>1 then raise exception 'Distinct tiers and one stock pool required';end if;
 for tier in select value from jsonb_array_elements(p_tiers) loop
  if (tier->>'pack_size')::numeric is null or (tier->>'pack_size')::numeric<>trunc((tier->>'pack_size')::numeric) or (tier->>'pack_size')::numeric not between 1 and 1000 or
   (tier->>'price_cents')::numeric is null or (tier->>'price_cents')::numeric<>trunc((tier->>'price_cents')::numeric) or (tier->>'price_cents')::numeric not between 0 and 100000000 or coalesce(length(btrim(tier->>'label')),0) not between 1 and 100 then raise exception 'Invalid tier';end if;
  insert into product_variants(product_id,sku,pack_size,label,price_cents,position) values(p_product,p_sku||'-'||(tier->>'pack_size'),(tier->>'pack_size')::int,tier->>'label',(tier->>'price_cents')::int,position) returning id into v;
  insert into inventory(variant_id) values(v) on conflict(variant_id) do nothing;
  if (tier->>'pack_size')::int=1 and p_stock>0 then perform admin_receive_stock(v,p_stock,null,p_actor,'opening stock');end if;
  position:=position+1;
 end loop;
end $$;
create function public.admin_create_product(p_input jsonb,p_actor text) returns jsonb
language plpgsql security definer set search_path=public as $$
<<bundle>>
declare slug text:=p_input->>'slug';sku text:=p_input->>'sku';v uuid;n int:=1;base_slug text:=slug;base_sku text:=sku;stock numeric:=coalesce((p_input->>'initialStock')::numeric,0);
begin
 if coalesce(length(btrim(p_actor)),0) not between 1 and 320 or coalesce(length(btrim(p_input->>'name')),0) not between 1 and 300 or slug is null or slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(slug)>200 or coalesce(length(sku),0) not between 1 and 100 or stock<>trunc(stock) then raise exception 'Invalid product';end if;
 perform pg_advisory_xact_lock(hashtextextended('admin-product-create',0));
 while exists(select 1 from products p where p.slug=bundle.slug or p.sku=bundle.sku) loop n:=n+1;slug:=base_slug||'-'||n;sku:=base_sku||'-'||n;end loop;
 insert into products(slug,sku,name,compound,short_description,description,status,images,categories) values(slug,sku,btrim(p_input->>'name'),nullif(btrim(p_input->>'compound'),''),p_input->>'short_description',p_input->>'description',coalesce(p_input->>'status','draft'),'[]','{}') returning id into v;
 perform admin_product_tiers(v,sku,p_input->'variants',stock::int,p_actor);
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(p_actor,'product.create','product',slug,jsonb_build_object('name',p_input->>'name','opening_stock',stock));
 return jsonb_build_object('slug',slug);
end $$;
create function public.admin_launch_product(p_slug text,p_tiers jsonb,p_stock integer,p_activate boolean,p_actor text) returns void
language plpgsql security definer set search_path=public as $$
declare p products%rowtype;
begin
 if coalesce(length(btrim(p_actor)),0) not between 1 and 320 then raise exception 'Actor required';end if;
 select * into p from products where slug=p_slug for update;
 if not found then raise exception 'Product not found';end if;
 if exists(select 1 from product_variants where product_id=p.id) then raise exception 'Product already has tiers';end if;
 perform admin_product_tiers(p.id,coalesce(p.sku,'ECL-'||upper(replace(p.slug,'-',''))),p_tiers,p_stock,p_actor);
 if p_activate then update products set status='active',coming_soon_rank=null,updated_at=now() where id=p.id;end if;
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(p_actor,'product.tiers.add','product',p_slug,jsonb_build_object('opening_stock',p_stock,'activated',p_activate));
end $$;
revoke all on function public.enqueue_refund_analytics(),public.analytics_snapshot_immutable(),public.admin_product_tiers(uuid,text,jsonb,integer,text) from public,anon,authenticated,service_role;
revoke all on function public.refund_analytics_reconciliation(),public.prepare_email_delivery_v2(uuid,uuid,text,text,text),public.admin_email_operation(uuid,text,text,text,text),public.admin_reconcile_email(uuid,text,jsonb,text,text),public.admin_create_product(jsonb,text),public.admin_launch_product(text,jsonb,integer,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.refund_analytics_reconciliation(),public.prepare_email_delivery_v2(uuid,uuid,text,text,text),public.admin_email_operation(uuid,text,text,text,text),public.admin_reconcile_email(uuid,text,jsonb,text,text),public.admin_create_product(jsonb,text),public.admin_launch_product(text,jsonb,integer,boolean,text) to service_role;
-- Commerce event facts are financial evidence even when analytics is disabled
-- or the original client identity is absent. Processing metadata may advance.
create function public.commerce_event_snapshot_immutable() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then raise exception 'Commerce event evidence is immutable';end if;
 if (new.id,new.order_id,new.kind,new.payload,new.created_at) is distinct from (old.id,old.order_id,old.kind,old.payload,old.created_at) then raise exception 'Commerce event snapshot is immutable';end if;
 return new;
end $$;
create trigger commerce_event_snapshot_immutable before update or delete on public.commerce_events for each row execute function public.commerce_event_snapshot_immutable();
revoke all on function public.commerce_event_snapshot_immutable() from public,anon,authenticated,service_role;

-- GA offers no documented refund deduplication: an abandoned refund claim
-- or any send failure is terminal, even when the request may not have arrived.
create or replace function public.claim_paid_analytics() returns setof public.paid_analytics_outbox
language plpgsql security invoker set search_path=public as $$
begin
  -- Leave a minute of transport margin: never rewrite an old payment timestamp.
  update public.paid_analytics_outbox set status='dead',last_error=case when event_kind='refund' and attempts>0 then 'Refund outcome unknown; reconcile analytics before any correction' else 'Analytics delivery window or attempt limit exceeded' end,lease_token=null,lease_expires_at=null
  where status in ('queued','failed','sending')
    and (status<>'sending' or lease_expires_at<=now())
    and (occurred_at<=now()-interval '71 hours 59 minutes' or attempts>=8 or (event_kind='refund' and attempts>0));
  return query with candidate as (
    select id from public.paid_analytics_outbox
    where ((status in ('queued','failed') and next_attempt_at<=now()) or (status='sending' and lease_expires_at<=now()))
      and occurred_at>now()-interval '71 hours 59 minutes' and attempts<8 and (event_kind='purchase' or attempts=0)
    order by next_attempt_at,created_at,id for update skip locked limit 1
  ) update public.paid_analytics_outbox a set status='sending',attempts=a.attempts+1,
    lease_token=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes'
    from candidate c where a.id=c.id returning a.*;
end $$;

create or replace function public.finish_paid_analytics(p_id uuid,p_lease uuid,p_accepted boolean,p_permanent boolean,p_error text)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
  update public.paid_analytics_outbox set
    status=case when p_accepted then 'accepted' when event_kind='refund' or p_permanent or attempts>=8 or occurred_at<=now()-interval '71 hours 59 minutes' then 'dead' else 'failed' end,
    accepted_at=case when p_accepted then now() else null end,
    last_error=case when p_accepted then null else left(p_error,200) end,
    next_attempt_at=now()+make_interval(secs=>least(21600,60*power(2,attempts-1))::int),
    lease_token=null,lease_expires_at=null
  where id=p_id and status='sending' and lease_token=p_lease and lease_expires_at>now();
  return found;
end $$;
