-- Capture must run before any catalogue price increase. Prior migrations are immutable.
alter table public.discounts drop constraint discounts_kind_check;
alter table public.discounts drop constraint discounts_check;
alter table public.discounts add constraint discounts_kind_check
  check (kind in ('percent','fixed','legacy_price'));
alter table public.discounts add constraint discounts_value_check check (
  (kind='percent' and percent is not null)
  or (kind='fixed' and value_cents is not null)
  or (kind='legacy_price' and percent is null and value_cents is null)
);

create table public.legacy_discount_prices (
  discount_id uuid not null references public.discounts(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  price_cents integer not null check (price_cents >= 0),
  captured_at timestamptz not null default now(),
  primary key (discount_id,variant_id)
);
create index legacy_discount_prices_variant_idx on public.legacy_discount_prices(variant_id);

create table public.legacy_discount_customers (
  discount_id uuid not null references public.discounts(id) on delete restrict,
  email text not null check (email=lower(trim(email)) and length(email) between 3 and 254),
  source_order_id uuid not null references public.orders(id) on delete restrict,
  captured_at timestamptz not null default now(),
  primary key (discount_id,email)
);
create index legacy_discount_customers_email_idx on public.legacy_discount_customers(email);

-- Completion evidence survives even an empty capture. Applications cannot alter it.
create table public.legacy_discount_captures (
  code text primary key check (code='ECLLEGACY'),
  discount_id uuid not null unique references public.discounts(id) on delete restrict,
  captured_at timestamptz not null,
  variant_count integer not null check (variant_count >= 0),
  customer_count integer not null check (customer_count >= 0)
);

alter table public.order_items add column legacy_discount_eligible boolean not null default false;

alter table public.legacy_discount_prices enable row level security;
alter table public.legacy_discount_customers enable row level security;
alter table public.legacy_discount_captures enable row level security;
revoke all on public.legacy_discount_prices, public.legacy_discount_customers,
  public.legacy_discount_captures from public, anon, authenticated, service_role;
grant select, insert on public.legacy_discount_prices, public.legacy_discount_customers to service_role;
grant select on public.legacy_discount_captures to service_role;

create function public.legacy_snapshot_reject_mutation() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
  raise exception 'Legacy pricing snapshot is immutable';
end;
$$;
revoke all on function public.legacy_snapshot_reject_mutation() from public, anon, authenticated, service_role;
create trigger legacy_prices_immutable before update or delete on public.legacy_discount_prices
  for each row execute function public.legacy_snapshot_reject_mutation();
create trigger legacy_customers_immutable before update or delete on public.legacy_discount_customers
  for each row execute function public.legacy_snapshot_reject_mutation();
create trigger legacy_capture_immutable before update or delete on public.legacy_discount_captures
  for each row execute function public.legacy_snapshot_reject_mutation();

-- BEGIN ONE-SHOT CAPTURE
do $$
declare
  program_id uuid;
  capture_time timestamptz;
  price_count integer;
  email_count integer;
begin
  -- Serialize capture replays, then freeze source writes for a consistent cutoff.
  lock table public.legacy_discount_captures in exclusive mode;
  if exists(select 1 from public.legacy_discount_captures where code='ECLLEGACY') then
    return;
  end if;
  lock table public.discounts, public.products, public.product_variants, public.orders in share mode;
  if exists(select 1 from public.discounts where upper(trim(code))='ECLLEGACY') then
    raise exception 'Unexpected existing ECLLEGACY discount; snapshot aborted';
  end if;
  capture_time := clock_timestamp();
  insert into public.discounts(code,kind,min_spend_cents,usage_limit,starts_at,expires_at,active)
    values('ECLLEGACY','legacy_price',0,null,null,null,true) returning id into program_id;

  insert into public.legacy_discount_prices(discount_id,variant_id,price_cents,captured_at)
    select program_id,v.id,v.price_cents,capture_time
    from public.product_variants v join public.products p on p.id=v.product_id
    where v.active and p.status='active'
      and not exists(select 1 from public.legacy_discount_captures where code='ECLLEGACY')
    on conflict(discount_id,variant_id) do nothing;
  get diagnostics price_count = row_count;

  insert into public.legacy_discount_customers(discount_id,email,source_order_id,captured_at)
    select program_id,e.email,e.order_id,capture_time from (
      select distinct on (lower(trim(o.customer_email)))
        lower(trim(o.customer_email)) as email,o.id as order_id
      from public.orders o where o.status in ('paid','processing','shipped','completed')
      order by lower(trim(o.customer_email)),o.created_at,o.id
    ) e
    where not exists(select 1 from public.legacy_discount_captures where code='ECLLEGACY')
    on conflict(discount_id,email) do nothing;
  get diagnostics email_count = row_count;

  insert into public.legacy_discount_captures(code,discount_id,captured_at,variant_count,customer_count)
    values('ECLLEGACY',program_id,capture_time,price_count,email_count);
end;
$$;
-- END ONE-SHOT CAPTURE

-- Trusted resolver boundary. Indexes are positional, never variant identities:
-- the same variant may appear both directly and inside an overridden bundle.
create function public.commerce_legacy_discount_quote(p_code text,p_email text,p_lines jsonb)
returns jsonb language plpgsql stable set search_path=public as $$
declare
 d discounts%rowtype; entry record; line jsonb; allocations jsonb:='[]'::jsonb;
 amount bigint:=0; delta bigint; captured int; matched int:=0;
begin
 select * into d from discounts where code=upper(trim(p_code));
 if not found or not d.active or d.kind<>'legacy_price' then
  return jsonb_build_object('ok',false,'discountCents',0,'reason','invalid_code');
 end if;
 if coalesce(trim(p_email),'')='' then
  return jsonb_build_object('ok',false,'discountCents',0,'reason','email_required');
 end if;
 if not exists(select 1 from legacy_discount_customers where discount_id=d.id and email=lower(trim(p_email))) then
  return jsonb_build_object('ok',false,'discountCents',0,'reason','email_ineligible');
 end if;
 if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Invalid legacy lines'; end if;
 if jsonb_array_length(p_lines) not between 1 and 200 then raise exception 'Invalid legacy lines'; end if;
 for entry in select value,ordinality from jsonb_array_elements(p_lines) with ordinality loop
  line:=entry.value;
  if jsonb_typeof(line) is distinct from 'object'
   or jsonb_typeof(line->'lineIndex') is distinct from 'number'
   or jsonb_typeof(line->'qty') is distinct from 'number'
   or jsonb_typeof(line->'unitPriceCents') is distinct from 'number'
   or jsonb_typeof(line->'variantId') is distinct from 'string'
   or jsonb_typeof(line->'legacyEligible') is distinct from 'boolean'
   or jsonb_typeof(line->'hasPriceOverride') is distinct from 'boolean'
  then raise exception 'Invalid legacy lines'; end if;
  if (line->>'lineIndex')::numeric<>entry.ordinality-1
   or (line->>'qty')::numeric not between 1 and 99
   or trunc((line->>'qty')::numeric)<>(line->>'qty')::numeric
   or (line->>'unitPriceCents')::numeric not between 0 and 2147483647
   or trunc((line->>'unitPriceCents')::numeric)<>(line->>'unitPriceCents')::numeric
   or (line->>'variantId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then raise exception 'Invalid legacy lines'; end if;
  delta:=0;
  if (line->>'legacyEligible')::boolean and not (line->>'hasPriceOverride')::boolean then
   select price_cents into captured from legacy_discount_prices
    where discount_id=d.id and variant_id=(line->>'variantId')::uuid;
   if found then
    matched:=matched+1;
    delta:=greatest(0,(line->>'unitPriceCents')::bigint-captured)*(line->>'qty')::int;
   end if;
  end if;
  amount:=amount+delta;
  if amount>2147483647 then raise exception 'Invalid legacy lines: amount out of range'; end if;
  allocations:=allocations||jsonb_build_array(jsonb_build_object('lineIndex',entry.ordinality-1,'discountCents',delta));
 end loop;
 if matched=0 then return jsonb_build_object('ok',false,'discountCents',0,'reason','no_eligible_items'); end if;
 return jsonb_build_object('ok',true,'code',d.code,'discountCents',amount,'allocations',allocations);
end $$;

-- Stored order lines are already authoritative. Non-variant extras never enter
-- the calculator; eligibility records whether the original line was overridden.
create function public.commerce_legacy_order_quote(p_order uuid,p_code text)
returns jsonb language sql stable set search_path=public as $$
 select case when count(i.id)=0 then jsonb_build_object('ok',false,'discountCents',0,'reason','no_eligible_items')
 else commerce_legacy_discount_quote(p_code,o.customer_email,jsonb_agg(jsonb_build_object(
  'lineIndex',i.line_index,'variantId',i.variant_id,'qty',i.qty,'unitPriceCents',i.unit_price_cents,
  'legacyEligible',i.legacy_discount_eligible,'hasPriceOverride',not i.legacy_discount_eligible) order by i.line_index)) end
 from orders o left join (
  select *,row_number() over(order by id)-1 line_index from order_items where order_id=p_order and variant_id is not null
 ) i on true where o.id=p_order group by o.customer_email;
$$;
revoke all on function public.commerce_legacy_discount_quote(text,text,jsonb), public.commerce_legacy_order_quote(uuid,text) from public,anon,authenticated;
grant execute on function public.commerce_legacy_discount_quote(text,text,jsonb), public.commerce_legacy_order_quote(uuid,text) to service_role;

-- Revalidate only unpaid legacy mutations; retain recorded paid history.
create or replace function public.commerce_order_operation(p_order uuid,p_action text,p_options jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare
 o orders%rowtype; previous text; action text:=p_action; r record; it order_items%rowtype; line jsonb;
 key text:=p_options->>'idempotencyKey'; request jsonb:=jsonb_build_object('action',p_action,'options',p_options-'idempotencyKey'); cached commerce_operations%rowtype;
 restock boolean:=coalesce((p_options->>'restock')::boolean,true); result jsonb; refunds jsonb;
 q int; amount int; refund_delta int:=0; goods_delta int:=0; shipping_delta int:=0; fully boolean; actor text:=coalesce(p_options->>'actor','system'); expiry int; subtotal int; discount_amount int; shipping int; d discounts%rowtype; delta int; legacy_quote jsonb; legacy_removed boolean:=false; legacy_reason text;
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
   if found and d.kind='legacy_price' then
    legacy_quote:=commerce_legacy_order_quote(p_order,d.code);
    discount_amount:=0;
    if coalesce((legacy_quote->>'ok')::boolean,false) then
     discount_amount:=(legacy_quote->>'discountCents')::int;
    else
     legacy_removed:=true; legacy_reason:=legacy_quote->>'reason'; d.code:=null;
    end if;
    subtotal:=o.subtotal_cents;
    shipping:=case when subtotal-discount_amount<=0 or subtotal-discount_amount>=(p_options->'shippingPolicy'->>'freeThresholdCents')::int then 0 else (p_options->'shippingPolicy'->>'baseCents')::int end;
    if shipping is null or shipping<0 then raise exception 'Invalid shipping policy'; end if;
    update orders set discount_cents=discount_amount,discount_code=d.code,shipping_cents=shipping,total_cents=subtotal-discount_amount+shipping where id=p_order returning * into o;
    perform commerce_allocate_discount(p_order);
   elsif not found or not d.active or (d.expires_at is not null and d.expires_at<=now()) or (d.usage_limit is not null and d.used_count+(select count(*) from orders where discount_code=d.code and status='pending' and not discount_counted)>=d.usage_limit) then raise exception 'Discount unavailable for reinstatement'; end if;
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
  if o.discount_counted and exists(select 1 from discounts where code=o.discount_code and kind='legacy_price') then
   if q<>it.qty then raise exception 'Previously paid legacy order quantities cannot be edited'; end if;
   result:=jsonb_build_object('changed',false,'status',o.status);
   if key is not null then insert into commerce_operations values(p_order,key,request,result,now()); end if;
   return result;
  end if;
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
   if found and d.kind='legacy_price' then
    legacy_quote:=commerce_legacy_order_quote(p_order,d.code);
    if coalesce((legacy_quote->>'ok')::boolean,false) then
     discount_amount:=(legacy_quote->>'discountCents')::int;
    else
     legacy_removed:=true; legacy_reason:=legacy_quote->>'reason'; d.code:=null;
    end if;
   elsif found and d.active and subtotal>=d.min_spend_cents and (d.starts_at is null or d.starts_at<=now()) and (d.expires_at is null or d.expires_at>now()) and (d.usage_limit is null or d.used_count<d.usage_limit) then
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
 result:=coalesce(result,jsonb_build_object('changed',true,'status',o.status,'reinstatedTo',o.status))
  || case when legacy_removed then jsonb_build_object('legacyDiscountRemoved',true,'legacyDiscountRemovalReason',legacy_reason,'removedDiscountCode','ECLLEGACY') else '{}'::jsonb end;
 insert into order_events(order_id,type,from_status,to_status,message,actor_email) values(p_order,case when action in ('refunded','refund_items') then 'refund' when action in ('tracking','edit_item') then 'edit' else 'status' end,previous,o.status,action||case when action in ('refunded','refund_items') then ': '||refund_delta::text||' cents recorded' else '' end||case when legacy_removed then '; Legacy discount removed: '||legacy_reason else '' end,actor);
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(actor,'order.'||p_action,'order',p_order::text,jsonb_build_object('from',previous,'result',result,'options',p_options));
 if action<>'tracking' or coalesce((p_options->>'notify')::boolean,false) then
  insert into commerce_events(order_id,kind,payload) values(p_order,case when p_action='expire' then 'expired' when action='tracking' then 'shipped' else action end,result||jsonb_build_object('email',o.customer_email,'trackingNumber',o.tracking_number,'notify',coalesce((p_options->>'notify')::boolean,true)));
 end if;
 if key is not null then insert into commerce_operations values(p_order,key,request,result,now()); end if;
 return result;
end $$;



-- Preserve the attribution-scrubbing commerce_create_order wrapper.
create or replace function public.commerce_create_order_unfiltered(p_input jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare
 o orders%rowtype; v record; line jsonb; i_id uuid; pool uuid; bac uuid;
 q int; unit int; subtotal int:=0; discount_amount int:=0; shipping int; expiry int; d discounts%rowtype;
 request_key uuid; request jsonb; result jsonb; r record; snapshot_total numeric:=0; legacy_eligible boolean; legacy_quote jsonb;
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
  legacy_eligible:=coalesce((line->>'legacyDiscountEligible')::boolean,true) and not (line ? 'priceOverrideCents');
  insert into order_items(order_id,variant_id,product_slug,product_name,variant_label,sku,unit_price_cents,qty,line_total_cents,legacy_discount_eligible)
  values(o.id,v.id,v.slug,v.name,v.label||coalesce(line->>'labelSuffix',''),v.sku,unit,q,unit*q,legacy_eligible) returning id into i_id;
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
  if d.kind='legacy_price' then
   legacy_quote:=commerce_legacy_order_quote(o.id,d.code);
   if not coalesce((legacy_quote->>'ok')::boolean,false) then raise exception 'Discount unavailable'; end if;
   discount_amount:=(legacy_quote->>'discountCents')::int;
  else
   discount_amount:=least(subtotal,case when d.kind='percent' then round(subtotal*d.percent/100.0)::int else d.value_cents end);
  end if;
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



create or replace function public.commerce_allocate_discount(p_order uuid)
returns void language plpgsql set search_path=public as $$
begin
 if exists(select 1 from orders o join discounts d on d.code=o.discount_code where o.id=p_order and d.kind='legacy_price') then
  update order_items i set discount_allocated_cents=case when i.legacy_discount_eligible and p.price_cents is not null
   then greatest(0,i.unit_price_cents-p.price_cents)*i.qty else 0 end
  from order_items source join orders o on o.id=source.order_id join discounts d on d.code=o.discount_code
   left join legacy_discount_prices p on p.discount_id=d.id and p.variant_id=source.variant_id
  where o.id=p_order and i.id=source.id;
 else
  with shares as (
   select i.id, round(o.discount_cents::numeric * sum(i.line_total_cents) over(order by i.id) / nullif(o.subtotal_cents,0))::int cumulative,
    round(o.discount_cents::numeric * (sum(i.line_total_cents) over(order by i.id)-i.line_total_cents) / nullif(o.subtotal_cents,0))::int previous
   from order_items i join orders o on o.id=i.order_id where o.id=p_order
  ) update order_items i set discount_allocated_cents=coalesce(s.cumulative-s.previous,0) from shares s where i.id=s.id;
 end if;
end $$;
