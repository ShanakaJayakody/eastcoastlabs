-- Atomic commerce boundary. Service role only; no provider/network side effects.
-- Row locks serialize operations on an order; pool locks are acquired by UUID.
-- Pack sizes and kit dependencies are frozen in claims when the order is made.
alter table public.orders add column if not exists checkout_key uuid unique;
alter table public.orders add column if not exists checkout_request jsonb;
alter table public.orders add column if not exists checkout_fingerprint text;
alter table public.orders add column if not exists discount_counted boolean not null default false;
alter table public.order_items add column if not exists returned_qty int not null default 0;
alter table public.order_items add column if not exists discount_allocated_cents int not null default 0;
update public.orders set discount_counted=true where stock_settled;
update public.order_items i set returned_qty=case when o.stock_restored then i.qty when o.stock_settled then i.refunded_qty else 0 end from public.orders o where o.id=i.order_id;
alter table public.order_items add constraint order_items_returned_bounds check(returned_qty between 0 and qty) not valid;
alter table public.order_items add constraint order_items_refunded_bounds check(refunded_qty between 0 and qty) not valid;

create table public.order_stock_claims (
 item_id uuid not null references public.order_items(id) on delete cascade,
 pool_variant_id uuid not null references public.product_variants(id),
 units_per_item int not null check(units_per_item>0),
 primary key(item_id,pool_variant_id)
);
-- Historical orders retain their original stock model (kit water was not settled).
insert into public.order_stock_claims(item_id,pool_variant_id,units_per_item)
select i.id,coalesce(s.id,v.id),v.pack_size from public.order_items i
join public.product_variants v on v.id=i.variant_id
left join public.product_variants s on s.product_id=v.product_id and s.pack_size=1;
create table public.commerce_operations (
 order_id uuid not null references public.orders(id) on delete cascade,
 operation_key text not null, request jsonb not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(order_id,operation_key)
);
create table public.commerce_events (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 kind text not null, payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), processed_at timestamptz
);
alter table public.order_stock_claims enable row level security;
alter table public.commerce_operations enable row level security;
alter table public.commerce_events enable row level security;
grant all on public.order_stock_claims, public.commerce_operations, public.commerce_events to service_role;

create or replace function public.commerce_allocate_discount(p_order uuid)
returns void language sql set search_path=public as $$
 with shares as (
  select i.id, round(o.discount_cents::numeric * sum(i.line_total_cents) over(order by i.id) / nullif(o.subtotal_cents,0))::int cumulative,
   round(o.discount_cents::numeric * (sum(i.line_total_cents) over(order by i.id)-i.line_total_cents) / nullif(o.subtotal_cents,0))::int previous
  from order_items i join orders o on o.id=i.order_id where o.id=p_order
 ) update order_items i set discount_allocated_cents=coalesce(s.cumulative-s.previous,0) from shares s where i.id=s.id;
$$;
do $$ declare r record; begin for r in select id from public.orders loop perform public.commerce_allocate_discount(r.id); end loop; end $$;

create index if not exists orders_checkout_email_created_idx on public.orders(lower(trim(customer_email)),created_at);

-- Both creation and recovery expose the same committed display snapshot. Old
-- orders omit purchasedLines so callers cannot mistake a fresh quote for a receipt.
create or replace function public.commerce_order_result(o public.orders,p_replayed boolean)
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('orderId',o.id,'orderNumber',o.order_number,'totalCents',o.total_cents,
  'paymentReference',o.payment_reference,'paymentExpiresAt',o.payment_expires_at,'replayed',p_replayed)
  || case when jsonb_typeof(o.checkout_request->'purchasedLines')='array'
    then jsonb_build_object('purchasedLines',o.checkout_request->'purchasedLines') else '{}'::jsonb end;
$$;
revoke all on function public.commerce_order_result(public.orders,boolean) from public,anon,authenticated;
grant execute on function public.commerce_order_result(public.orders,boolean) to service_role;

create or replace function public.commerce_create_order(p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare
 o orders%rowtype; v record; line jsonb; i_id uuid; pool uuid; bac uuid;
 q int; unit int; subtotal int:=0; discount_amount int:=0; shipping int; expiry int; d discounts%rowtype;
 request_key uuid; request jsonb; result jsonb; r record; snapshot_total numeric:=0;
 -- Conservative public-checkout thresholds; tune only with staging abuse/traffic evidence.
 checkout_pending_limit constant int:=5; checkout_hourly_limit constant int:=10;
 checkout_window constant interval:=interval '60 minutes';
begin
 if p_input ? 'requestFingerprint' and (p_input->>'requestFingerprint') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request fingerprint'; end if;
 request_key:=coalesce((p_input->>'idempotencyKey')::uuid,gen_random_uuid());
 request:=p_input-'idempotencyKey';
 request:=jsonb_set(request,'{email}',to_jsonb(lower(trim(p_input->>'email'))));
 perform pg_advisory_xact_lock(hashtextextended(request_key::text,0));
 select * into o from orders where checkout_key=request_key;
 if found then
  if (o.checkout_fingerprint is not null and o.checkout_fingerprint is distinct from p_input->>'requestFingerprint') or (o.checkout_fingerprint is null and o.checkout_request<>request) then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
  return commerce_order_result(o,true);
 end if;
 if coalesce(length(request->>'email'),0)=0 then raise exception 'Email required'; end if;
 -- Public checkout always supplies a UUID; trusted admin creation omits it.
 -- Replay above remains allowed even after a limit is reached. This lock is
 -- acquired before new order/pool/discount locks; transitions never acquire it.
 if p_input->>'idempotencyKey' is not null then
  perform pg_advisory_xact_lock(hashtextextended('checkout-email:'||(request->>'email'),0));
  if (select count(*) from orders where lower(trim(customer_email))=request->>'email'
      and status='pending' and payment_expires_at>now())>=checkout_pending_limit
   or (select count(*) from orders where lower(trim(customer_email))=request->>'email'
      and created_at>now()-checkout_window)>=checkout_hourly_limit then
   raise exception 'CHECKOUT_RATE_LIMIT';
  end if;
 end if;
 if jsonb_typeof(p_input->'items')<>'array' or jsonb_array_length(p_input->'items')>200 then raise exception 'Invalid items'; end if;
 expiry:=coalesce((p_input->>'paymentExpiryHours')::int,48);
 shipping:=coalesce((p_input->>'shippingCents')::int,0);
 if expiry<1 or expiry>720 or shipping<0 then raise exception 'Invalid payment/shipping'; end if;
 insert into orders(customer_email,customer_name,shipping_address,payment_method,checkout_key,checkout_request,checkout_fingerprint,payment_expires_at)
 values(request->>'email',p_input->>'name',p_input->'shippingAddress',p_input->>'paymentMethod',request_key,request,p_input->>'requestFingerprint',now()+make_interval(hours=>expiry)) returning * into o;
 for line in select value from jsonb_array_elements(p_input->'items') loop
  q:=(line->>'qty')::int;
  if q is null or q<1 or q>99 or (line->>'qty')::numeric<>q then raise exception 'Invalid quantity'; end if;
  select pv.*,p.slug,p.name into v from product_variants pv join products p on p.id=pv.product_id
    where pv.id=(line->>'variantId')::uuid and pv.active and p.status='active' for share of pv,p;
  if not found then raise exception 'Variant unavailable'; end if;
  if line ? 'expectedPriceCents' and (line->>'expectedPriceCents')::int<>v.price_cents then raise exception 'QUOTE_CHANGED'; end if;
  unit:=coalesce((line->>'priceOverrideCents')::int,v.price_cents);
  if unit<0 then raise exception 'Invalid price'; end if;
  -- Overrides are server-derived bundle/gift amounts; labels never grant a discount.
  insert into order_items(order_id,variant_id,product_slug,product_name,variant_label,sku,unit_price_cents,qty,line_total_cents)
  values(o.id,v.id,v.slug,v.name,v.label||coalesce(line->>'labelSuffix',''),v.sku,unit,q,unit*q) returning id into i_id;
  select id into pool from product_variants where product_id=v.product_id and pack_size=1;
  if pool is null then raise exception 'Missing inventory pool'; end if;
  insert into order_stock_claims values(i_id,pool,v.pack_size);
  if v.slug='reconstitution-kit' then
   select pv.id into bac from product_variants pv join products p on p.id=pv.product_id
    where p.slug='bacteriostatic-water' and p.status='active' and pv.active and pv.pack_size=1 for share of pv,p;
   if bac is null then raise exception 'Kit bacteriostatic water unavailable'; end if;
   insert into order_stock_claims values(i_id,bac,1);
  end if;
  subtotal:=subtotal+unit*q;
 end loop;
 for line in select value from jsonb_array_elements(coalesce(p_input->'extraItems','[]'::jsonb)) loop
  q:=(line->>'qty')::int; unit:=(line->>'unitPriceCents')::int;
  if q is null or q<1 or q>99 or (line->>'qty')::numeric<>q or unit is null or unit<0 then raise exception 'Invalid extra item'; end if;
  insert into order_items(order_id,product_slug,product_name,variant_label,sku,unit_price_cents,qty,line_total_cents)
  values(o.id,line->>'slug',line->>'name',line->>'label',line->>'sku',unit,q,unit*q);
  subtotal:=subtotal+unit*q;
 end loop;
 if not exists(select 1 from order_items where order_id=o.id) then raise exception 'Order has no items'; end if;
 -- Only the server resolver supplies this optional display snapshot. Keep its
 -- arithmetic aligned with the transaction's authoritative item subtotal.
 if p_input ? 'purchasedLines' then
  if jsonb_typeof(p_input->'purchasedLines') is distinct from 'array' then raise exception 'Invalid purchased lines';end if;
  if jsonb_array_length(p_input->'purchasedLines') not between 1 and 200 then raise exception 'Invalid purchased lines';end if;
  for line in select value from jsonb_array_elements(p_input->'purchasedLines') loop
   if jsonb_typeof(line) is distinct from 'object'
    or jsonb_typeof(line->'key') is distinct from 'string' or jsonb_typeof(line->'slug') is distinct from 'string'
    or jsonb_typeof(line->'name') is distinct from 'string' or jsonb_typeof(line->'variantLabel') is distinct from 'string'
    or jsonb_typeof(line->'quantity') is distinct from 'number' or jsonb_typeof(line->'unitPriceCents') is distinct from 'number'
    or jsonb_typeof(line->'lineTotalCents') is distinct from 'number' or jsonb_typeof(line->'isGift') is distinct from 'boolean'
   then raise exception 'Invalid purchased lines';end if;
   if (line->>'quantity')::numeric not between 1 and 99 or trunc((line->>'quantity')::numeric)<>(line->>'quantity')::numeric
    or (line->>'unitPriceCents')::numeric<0 or trunc((line->>'unitPriceCents')::numeric)<>(line->>'unitPriceCents')::numeric
    or (line->>'lineTotalCents')::numeric<>(line->>'quantity')::numeric*(line->>'unitPriceCents')::numeric
   then raise exception 'Invalid purchased lines';end if;
   snapshot_total:=snapshot_total+(line->>'lineTotalCents')::numeric;
  end loop;
  if snapshot_total<>subtotal then raise exception 'Invalid purchased lines';end if;
 end if;
 -- Pool locks precede discount locks in both creation and payment to avoid lock-order inversion.
 perform inv.variant_id from inventory inv where inv.variant_id in(select c.pool_variant_id from order_stock_claims c join order_items i on i.id=c.item_id where i.order_id=o.id) order by inv.variant_id for update;
 if nullif(trim(p_input->>'discountCode'),'') is not null then
  select * into d from discounts where code=upper(trim(p_input->>'discountCode')) for update;
  if not found or not d.active or subtotal<d.min_spend_cents or (d.starts_at is not null and d.starts_at>now()) or (d.expires_at is not null and d.expires_at<=now()) or (d.usage_limit is not null and d.used_count+(select count(*) from orders where discount_code=d.code and status='pending' and not discount_counted)>=d.usage_limit) then raise exception 'Discount unavailable'; end if;
  discount_amount:=least(subtotal,case when d.kind='percent' then round(subtotal*d.percent/100.0)::int else d.value_cents end);
 end if;
 if not (p_input ? 'shippingCents') then
  shipping:=case when subtotal-discount_amount<=0 or subtotal-discount_amount >= (p_input->'shippingPolicy'->>'freeThresholdCents')::int then 0 else (p_input->'shippingPolicy'->>'baseCents')::int end;
  if shipping is null or shipping<0 then raise exception 'Invalid shipping policy'; end if;
 end if;
 if p_input ? 'expectedTotalCents' and (p_input->>'expectedTotalCents')::int<>subtotal-discount_amount+shipping then raise exception 'QUOTE_CHANGED'; end if;

 for r in select c.pool_variant_id,sum(i.qty*c.units_per_item)::int units from order_stock_claims c join order_items i on i.id=c.item_id where i.order_id=o.id group by c.pool_variant_id order by c.pool_variant_id loop
  if not reserve_stock(r.pool_variant_id,r.units) then raise exception 'OUT_OF_STOCK:%',r.pool_variant_id; end if;
 end loop;
 update orders set subtotal_cents=subtotal,discount_cents=discount_amount,discount_code=d.code,shipping_cents=shipping,total_cents=subtotal-discount_amount+shipping,stock_reserved=true,payment_reference=regexp_replace(upper(order_number),'[^A-Z0-9-]','','g') where id=o.id returning * into o;
 perform commerce_allocate_discount(o.id);
 insert into order_events(order_id,type,to_status,message,actor_email) values(o.id,'created','pending','Order created; stock reserved.',p_input->>'actor');
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(coalesce(p_input->>'actor',o.customer_email),'order.create','order',o.id::text,jsonb_build_object('total_cents',o.total_cents));
 insert into commerce_events(order_id,kind,payload) values(o.id,'created',jsonb_build_object('orderNumber',o.order_number,'totalCents',o.total_cents,'email',o.customer_email));
 return commerce_order_result(o,false);
end $$;

create or replace function public.commerce_order_operation(p_order uuid,p_action text,p_options jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare
 o orders%rowtype; previous text; action text:=p_action; r record; it order_items%rowtype; line jsonb;
 key text:=p_options->>'idempotencyKey'; request jsonb:=jsonb_build_object('action',p_action,'options',p_options-'idempotencyKey'); cached commerce_operations%rowtype;
 restock boolean:=coalesce((p_options->>'restock')::boolean,true); result jsonb; refunds jsonb;
 q int; amount int; refund_delta int:=0; fully boolean; actor text:=coalesce(p_options->>'actor','system'); expiry int; subtotal int; discount_amount int; shipping int; d discounts%rowtype; delta int;
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
  if fully then refund_delta:=o.total_cents-o.refunded_cents; end if;
  if refund_delta<0 or o.refunded_cents+refund_delta>o.total_cents then raise exception 'Refund exceeds order total'; end if;
  update orders set refunded_cents=refunded_cents+refund_delta,status=case when fully then 'refunded' else status end,stock_restored=not exists(select 1 from order_items where order_id=p_order and returned_qty<qty),updated_at=now() where id=p_order returning * into o;
  result:=jsonb_build_object('changed',true,'status',o.status,'refundedCents',refund_delta,'fullyRefunded',fully);
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
  insert into commerce_events(order_id,kind,payload) values(p_order,case when p_action='expire' then 'expired' when action='tracking' then 'shipped' else action end,result||jsonb_build_object('email',o.customer_email,'trackingNumber',o.tracking_number));
 end if;
 if key is not null then insert into commerce_operations values(p_order,key,request,result,now()); end if;
 return result;
end $$;
revoke all on function public.commerce_allocate_discount(uuid), public.commerce_create_order(jsonb), public.commerce_order_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.commerce_allocate_discount(uuid), public.commerce_create_order(jsonb), public.commerce_order_operation(uuid,text,jsonb) to service_role;

create or replace function public.commerce_set_payment_plan(p_order uuid,p_reference text,p_expiry_hours int)
returns void language plpgsql set search_path=public as $$
begin
 if p_expiry_hours<1 or p_expiry_hours>720 then raise exception 'Invalid expiry'; end if;
 perform id from orders where id=p_order for update;
 if not found then raise exception 'Order not found'; end if;
 update orders set payment_reference=coalesce(payment_reference,p_reference),payment_expires_at=coalesce(payment_expires_at,now()+make_interval(hours=>p_expiry_hours)) where id=p_order and status='pending';
end $$;
revoke all on function public.commerce_set_payment_plan(uuid,text,int) from public,anon,authenticated;
grant execute on function public.commerce_set_payment_plan(uuid,text,int) to service_role;

-- Fingerprint is SHA-256 of normalized ORIGINAL request, computed by the server.
-- This permits safe replay before re-pricing a cart whose stock/prices changed.
create or replace function public.commerce_checkout_replay(p_key uuid,p_fingerprint text)
returns jsonb language plpgsql set search_path=public as $$
declare o orders%rowtype;
begin
 select * into o from orders where checkout_key=p_key;
 if not found then return null; end if;
 if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or o.checkout_fingerprint is distinct from p_fingerprint then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
 return commerce_order_result(o,true);
end $$;
revoke all on function public.commerce_checkout_replay(uuid,text) from public,anon,authenticated;
grant execute on function public.commerce_checkout_replay(uuid,text) to service_role;

-- Preview uses the same frozen claims (including kit water) as reinstatement.
-- Every candidate is judged independently against current stock, never promised.
create or replace function public.commerce_reinstatement_preview(p_orders uuid[])
returns table(order_id uuid,recoverable boolean,lines jsonb) language sql stable set search_path=public as $$
 with claims as (
  select i.order_id,i.id,i.variant_id,i.product_name,i.variant_label,i.qty,
   coalesce(inv.on_hand-inv.reserved,0) available,i.qty*c.units_per_item needed,
   sum(i.qty*c.units_per_item) over(partition by i.order_id,c.pool_variant_id order by i.id rows unbounded preceding) cumulative
  from order_items i join order_stock_claims c on c.item_id=i.id
  left join inventory inv on inv.variant_id=c.pool_variant_id where i.order_id=any(p_orders)
 ), checks as (
  select order_id,id,variant_id,product_name,variant_label,qty,
   min(greatest(0,available-(cumulative-needed))) available,bool_and(available>=cumulative) sufficient
  from claims group by order_id,id,variant_id,product_name,variant_label,qty
 )
 select o.id,
  o.status='cancelled' and o.refunded_cents=0
  and exists(select 1 from order_items i where i.order_id=o.id)
  and not exists(select 1 from order_items i where i.order_id=o.id and (i.refunded_qty>0 or (o.stock_settled and i.variant_id is not null and i.returned_qty<i.qty)))
  and coalesce(bool_and(c.sufficient),true),
  coalesce(jsonb_agg(jsonb_build_object('variantId',c.variant_id,'productName',c.product_name,'variantLabel',c.variant_label,'qty',c.qty,'available',c.available,'sufficient',c.sufficient) order by c.id) filter(where c.id is not null),'[]'::jsonb)
 from orders o left join checks c on c.order_id=o.id where o.id=any(p_orders) group by o.id;
$$;
revoke all on function public.commerce_reinstatement_preview(uuid[]) from public,anon,authenticated;
grant execute on function public.commerce_reinstatement_preview(uuid[]) to service_role;
