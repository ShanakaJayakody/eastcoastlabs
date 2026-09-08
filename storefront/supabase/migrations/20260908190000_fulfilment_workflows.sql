-- Physical lot evidence annotates existing stock. It never creates inventory.
create table public.stock_lots (
 id uuid primary key default gen_random_uuid(),
 pool_variant_id uuid not null references public.product_variants(id),
 lot_code text not null check(length(btrim(lot_code)) between 1 and 100),
 units integer not null check(units between 1 and 1000000),
 receipt_id uuid references public.stock_movements(id),
 coa_id uuid references public.coa_batches(id),
 coa_snapshot jsonb,
 evidence text not null check(length(btrim(evidence)) between 3 and 2000),
 actor_email text not null, created_at timestamptz not null default now(),
 unique(pool_variant_id,lot_code)
);
create table public.order_lot_allocations (
 item_id uuid not null references public.order_items(id),
 lot_id uuid not null references public.stock_lots(id),
 units integer not null check(units>0),
 primary key(item_id,lot_id)
);
create index order_lot_allocations_lot_idx on public.order_lot_allocations(lot_id);
create table public.carrier_previews (
 token uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 order_number text not null, tracking_number text not null, state jsonb not null,
 created_at timestamptz not null default now(), committed_at timestamptz, notify boolean
);
alter table public.stock_lots enable row level security;
alter table public.order_lot_allocations enable row level security;
alter table public.carrier_previews enable row level security;
-- Default ACLs may grant mutation, TRUNCATE or trigger privileges at creation.
-- RLS does not restrict the BYPASSRLS service role; explicitly remove them.
revoke all on public.stock_lots,public.order_lot_allocations,public.carrier_previews from public,anon,authenticated,service_role;
grant select on public.stock_lots,public.order_lot_allocations,public.carrier_previews to service_role;

create function public.admin_register_stock_lot(p_pool uuid,p_code text,p_units integer,p_receipt uuid,p_coa uuid,p_evidence text,p_actor text)
returns uuid language plpgsql security definer set search_path=public as $$
declare stock inventory; receipt stock_movements; product_name text; registered bigint; dispatched bigint; paid_units bigint; result uuid; certificate jsonb;
begin
 if p_units is null or p_units not between 1 and 1000000 or coalesce(length(btrim(p_code)),0) not between 1 and 100
  or coalesce(length(btrim(p_evidence)),0) not between 3 and 2000 or coalesce(length(btrim(p_actor)),0) not between 1 and 320 then raise exception 'Valid lot, physical units, evidence and actor required';end if;
 select p.name into product_name from product_variants v join products p on p.id=v.product_id
 where v.id=p_pool and (v.pack_size=1 or not exists(select 1 from product_variants s where s.product_id=v.product_id and s.pack_size=1));
 if not found then raise exception 'Choose a physical stock pool';end if;
 -- Order operations also acquire pool inventory before touching lot rows. Do not
 -- lock orders here: the inventory lock supplies a consistent capacity boundary.
 select * into stock from inventory where variant_id=p_pool for update;
 if not found then raise exception 'Stock pool not found';end if;
 if p_coa is not null then
  select jsonb_build_object('batchId',batch_id,'compound',compound,'url',coa_url,'verifiedAt',document_verified_at) into certificate from coa_batches
  where id=p_coa and document_verified_at is not null and coa_url ~ '^https?://' and lower(btrim(compound))=lower(btrim(product_name)) for share;
  if not found then raise exception 'COA must be verified and match the pool compound';end if;
 end if;
 perform id from stock_lots where pool_variant_id=p_pool order by id for update;
 if p_receipt is not null then
  select * into receipt from stock_movements where id=p_receipt;
  if not found or receipt.variant_id<>p_pool or receipt.reason<>'received' or receipt.qty<=0 or exists(select 1 from stock_movements where reverses_receipt_id=p_receipt) then raise exception 'Receipt is not usable for this pool';end if;
  if p_units+coalesce((select sum(units) from stock_lots where receipt_id=p_receipt),0)>receipt.qty then raise exception 'Lot units exceed receipt evidence';end if;
 end if;
 select coalesce(sum(units),0) into registered from stock_lots where pool_variant_id=p_pool;
 select coalesce(sum(a.units),0) into dispatched from order_lot_allocations a join stock_lots l on l.id=a.lot_id join order_items i on i.id=a.item_id join orders o on o.id=i.order_id where l.pool_variant_id=p_pool and o.shipped_at is not null;
 -- Paid, unshipped units have already left on_hand in the canonical ledger.
 select coalesce(sum((i.qty-i.returned_qty)*c.units_per_item),0) into paid_units from order_stock_claims c join order_items i on i.id=c.item_id join orders o on o.id=i.order_id
 where c.pool_variant_id=p_pool and o.stock_settled and o.shipped_at is null;
 if registered-dispatched+p_units>greatest(0,stock.on_hand)+paid_units then raise exception 'Lot units exceed current physical stock evidence';end if;
 insert into stock_lots(pool_variant_id,lot_code,units,receipt_id,coa_id,coa_snapshot,evidence,actor_email) values(p_pool,btrim(p_code),p_units,p_receipt,p_coa,certificate,btrim(p_evidence),p_actor) returning id into result;
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(p_actor,'stock.lot.register','stock_lot',result::text,jsonb_build_object('pool',p_pool,'units',p_units,'receipt',p_receipt,'coa',p_coa,'evidence',p_evidence));
 return result;
end $$;

-- A reversal would remove physical stock already evidenced by a lot. Require a
-- reviewed stock correction instead; do not silently invalidate its provenance.
create function public.guard_lot_receipt_reversal() returns trigger language plpgsql set search_path=public as $$
begin
 if new.reverses_receipt_id is not null then
  perform variant_id from inventory where variant_id=new.variant_id for update;
  if exists(select 1 from stock_lots where receipt_id=new.reverses_receipt_id) then raise exception 'Receipt has registered lots; use a reviewed physical correction';end if;
 end if;
 return new;
end $$;
create trigger guard_lot_receipt_reversal before insert on public.stock_movements for each row execute function public.guard_lot_receipt_reversal();

create function public.admin_allocate_order_lots(p_order uuid,p_item uuid,p_pool uuid,p_assignments jsonb,p_evidence text,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o orders; it order_items; required bigint; target bigint; entry jsonb; l stock_lots; used bigint; before_rows jsonb; after_rows jsonb;
begin
 if coalesce(length(btrim(p_evidence)),0) not between 3 and 2000 or coalesce(length(btrim(p_actor)),0) not between 1 and 320 then raise exception 'Physical pick/return evidence and actor required';end if;
 if p_assignments is null or jsonb_typeof(p_assignments)<>'array' or jsonb_array_length(p_assignments)>100 then raise exception 'Invalid assignments';end if;
 select * into o from orders where id=p_order for update;
 if not found then raise exception 'Order not found';end if;
 if o.shipped_at is not null or o.status in ('shipped','completed') then raise exception 'Dispatched lot assignments are immutable';end if;
 select * into it from order_items where id=p_item and order_id=p_order;
 if not found then raise exception 'Order item not found';end if;
 select (it.qty-it.refunded_qty)::bigint*units_per_item into required from order_stock_claims where item_id=p_item and pool_variant_id=p_pool;
 if not found then raise exception 'Item does not claim this physical pool';end if;
 if o.status not in ('paid','processing') then required:=0;end if;
 perform variant_id from inventory where variant_id=p_pool for update;
 -- Lock all lots in this pool in the same UUID order, including released lots.
 perform id from stock_lots where pool_variant_id=p_pool order by id for update;
 target:=0;
 for entry in select value from jsonb_array_elements(p_assignments) loop
  if coalesce(entry->>'units','') !~ '^[1-9][0-9]*$' or (entry->>'units')::numeric>1000000 then raise exception 'Invalid physical units';end if;
  target:=target+(entry->>'units')::bigint;
 end loop;
 if target>required then raise exception 'Assignments exceed remaining packable physical units';end if;
 if exists(select 1 from jsonb_array_elements(p_assignments) group by value->>'lotId' having count(*)>1) then raise exception 'Duplicate lot assignment';end if;
 select coalesce(jsonb_agg(jsonb_build_object('lotId',a.lot_id,'units',a.units) order by a.lot_id),'[]'::jsonb) into before_rows from order_lot_allocations a join stock_lots sl on sl.id=a.lot_id where a.item_id=p_item and sl.pool_variant_id=p_pool;
 for entry in select value from jsonb_array_elements(p_assignments) loop
  select * into l from stock_lots where id=(entry->>'lotId')::uuid and pool_variant_id=p_pool;
  if not found then raise exception 'Lot does not belong to this physical pool';end if;
  select coalesce(sum(units),0) into used from order_lot_allocations where lot_id=l.id and item_id<>p_item;
  if used+(entry->>'units')::integer>l.units then raise exception 'Lot has insufficient remaining units';end if;
 end loop;
 delete from order_lot_allocations a using stock_lots sl where a.lot_id=sl.id and a.item_id=p_item and sl.pool_variant_id=p_pool;
 insert into order_lot_allocations(item_id,lot_id,units) select p_item,(value->>'lotId')::uuid,(value->>'units')::integer from jsonb_array_elements(p_assignments);
 select coalesce(jsonb_agg(jsonb_build_object('lotId',a.lot_id,'units',a.units) order by a.lot_id),'[]'::jsonb) into after_rows from order_lot_allocations a join stock_lots sl on sl.id=a.lot_id where a.item_id=p_item and sl.pool_variant_id=p_pool;
 if before_rows is distinct from after_rows then
  insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(p_actor,'order.lots.allocate','order',p_order::text,jsonb_build_object('item',p_item,'pool',p_pool,'before',before_rows,'after',after_rows,'physicalEvidence',p_evidence));
  update orders set updated_at=clock_timestamp() where id=p_order;
 end if;
 return jsonb_build_object('allocatedUnits',target,'unallocatedUnits',required-target);
end $$;

create function public.guard_lot_dispatch() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status='shipped' and old.status<>'shipped' and exists(
  select 1 from order_lot_allocations a join stock_lots l on l.id=a.lot_id join order_items i on i.id=a.item_id
  left join order_stock_claims c on c.item_id=i.id and c.pool_variant_id=l.pool_variant_id where i.order_id=new.id
  group by i.id,l.pool_variant_id,c.units_per_item having c.units_per_item is null or sum(a.units)>(i.qty-i.refunded_qty)::bigint*c.units_per_item
 ) then raise exception 'Lot allocation exceeds current packing quantity; verify physical release before dispatch';end if;
 return new;
end $$;
create trigger guard_lot_dispatch before update on public.orders for each row execute function public.guard_lot_dispatch();

create function public.admin_carrier_state(p_order uuid) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('status',o.status,'tracking',o.tracking_number,'updated',o.updated_at,'refunded',o.refunded_cents,
 'items',(select jsonb_agg(jsonb_build_object('id',i.id,'qty',i.qty,'refunded',i.refunded_qty) order by i.id) from order_items i where i.order_id=o.id)) from orders o where o.id=p_order;
$$;
create function public.admin_preview_carrier(p_rows jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare entry jsonb; o orders; issue text; tok uuid; result jsonb:='[]'::jsonb; n text; tracking text;
begin
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Upload between 1 and 500 rows';end if;
 -- Match commit/order-operation lock ordering. The displayed row, validation and
 -- token snapshot must describe one locked state, even during manual tracking.
 perform id from orders where order_number in(select btrim(value->>'orderNumber') from jsonb_array_elements(p_rows)) order by id for update;
 for entry in select value from jsonb_array_elements(p_rows) loop
  issue:=null;tok:=null;n:=btrim(entry->>'orderNumber');tracking:=btrim(entry->>'trackingNumber');
  select * into o from orders where order_number=n for update;
  if coalesce(length(n),0) not between 1 and 100 or coalesce(length(tracking),0) not between 1 and 200 or n ~ '[[:cntrl:]]' or tracking ~ '[[:cntrl:]]' then issue:='Invalid order or tracking number';
  elsif (select count(*) from jsonb_array_elements(p_rows) where btrim(value->>'orderNumber')=n)>1 or (select count(*) from jsonb_array_elements(p_rows) where btrim(value->>'trackingNumber')=tracking)>1 then issue:='Duplicate order or tracking number';
  elsif o.id is null then issue:='Order not found';
  elsif o.status not in ('paid','processing','shipped') then issue:='Order is not shippable';
  elsif nullif(btrim(o.tracking_number),'') is not null and o.tracking_number<>tracking then issue:='Existing tracking conflicts; review on the order';
  elsif exists(select 1 from orders where id<>o.id and tracking_number=tracking) then issue:='Tracking belongs to another order';
  end if;
  if issue is null then
   insert into carrier_previews(order_id,order_number,tracking_number,state) values(o.id,n,tracking,admin_carrier_state(o.id)) returning token into tok;
  end if;
  result:=result||jsonb_build_array(jsonb_build_object('token',tok,'orderNumber',n,'trackingNumber',tracking,'status',o.status,'currentTracking',o.tracking_number,'error',issue));
 end loop;
 return result;
end $$;
create function public.admin_commit_carrier(p_tokens jsonb,p_notify boolean,p_actor text) returns jsonb language plpgsql security definer set search_path=public as $$
declare entry jsonb; reviewed carrier_previews; o orders; outcome jsonb; result jsonb:='[]'::jsonb;
begin
 if p_tokens is null or jsonb_typeof(p_tokens)<>'array' or jsonb_array_length(p_tokens) not between 1 and 500 or p_notify is null or coalesce(length(btrim(p_actor)),0) not between 1 and 320 then raise exception 'Valid selected rows, notification choice and actor required';end if;
 -- Batch locks have deterministic global ordering before any per-row savepoint.
 -- Tracking advisory lock prevents competing imports assigning one parcel ID to
 -- different orders. Existing canonical manual tracking is checked again below.
 perform pg_advisory_xact_lock(hashtextextended('carrier-reconciliation',0));
 perform id from orders where id in(select order_id from carrier_previews where token::text in(select value#>>'{}' from jsonb_array_elements(p_tokens))) order by id for update;
 perform variant_id from inventory where variant_id in(select c.pool_variant_id from order_stock_claims c join order_items i on i.id=c.item_id where i.order_id in(select order_id from carrier_previews where token::text in(select value#>>'{}' from jsonb_array_elements(p_tokens)))) order by variant_id for update;
 for entry in select value from jsonb_array_elements(p_tokens) loop
  reviewed:=null;
  begin
   select * into reviewed from carrier_previews where token=(entry#>>'{}')::uuid for update;
   if not found then raise exception 'CARRIER_PREVIEW_REQUIRED';end if;
   if reviewed.committed_at is not null then
    if reviewed.notify is distinct from p_notify then raise exception 'Notification choice differs from committed import';end if;
    outcome:=jsonb_build_object('ok',true,'replayed',true);
   else
    select * into o from orders where id=reviewed.order_id;
    if reviewed.created_at<now()-interval '1 hour' or reviewed.state is distinct from admin_carrier_state(o.id) then raise exception 'CARRIER_PREVIEW_STALE: preview this row again';end if;
    if o.status not in ('paid','processing','shipped') then raise exception 'Order is not shippable';end if;
    if nullif(btrim(o.tracking_number),'') is not null and o.tracking_number<>reviewed.tracking_number then raise exception 'Existing tracking conflicts; review on the order';end if;
    if exists(select 1 from orders where id<>o.id and tracking_number=reviewed.tracking_number) then raise exception 'Tracking belongs to another order';end if;
    if o.status<>'shipped' then
     perform commerce_order_operation(o.id,'shipped',jsonb_build_object('trackingNumber',reviewed.tracking_number,'notify',p_notify,'actor',p_actor,'idempotencyKey','carrier:'||reviewed.token));
    elsif o.tracking_number is distinct from reviewed.tracking_number then
     perform commerce_order_operation(o.id,'tracking',jsonb_build_object('trackingNumber',reviewed.tracking_number,'notify',p_notify,'actor',p_actor,'idempotencyKey','carrier:'||reviewed.token));
    end if;
    update carrier_previews set committed_at=now(),notify=p_notify where token=reviewed.token;
    outcome:=jsonb_build_object('ok',true,'replayed',false);
   end if;
  exception when others then outcome:=jsonb_build_object('ok',false,'error',sqlerrm);
  end;
  result:=result||jsonb_build_array(outcome||jsonb_build_object('token',entry#>>'{}','orderNumber',reviewed.order_number));
 end loop;
 return result;
end $$;
revoke all on function public.admin_register_stock_lot(uuid,text,integer,uuid,uuid,text,text),public.admin_allocate_order_lots(uuid,uuid,uuid,jsonb,text,text),public.admin_carrier_state(uuid),public.admin_preview_carrier(jsonb),public.admin_commit_carrier(jsonb,boolean,text),public.guard_lot_dispatch(),public.guard_lot_receipt_reversal() from public,anon,authenticated;
grant execute on function public.admin_register_stock_lot(uuid,text,integer,uuid,uuid,text,text),public.admin_allocate_order_lots(uuid,uuid,uuid,jsonb,text,text),public.admin_carrier_state(uuid),public.admin_preview_carrier(jsonb),public.admin_commit_carrier(jsonb,boolean,text),public.guard_lot_dispatch(),public.guard_lot_receipt_reversal() to service_role;

-- Carry optional notification intent through the canonical operation; retain
-- status/events/audit even when the operator opts out of a shipping email.
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
  insert into commerce_events(order_id,kind,payload) values(p_order,case when p_action='expire' then 'expired' when action='tracking' then 'shipped' else action end,result||jsonb_build_object('email',o.customer_email,'trackingNumber',o.tracking_number,'notify',coalesce((p_options->>'notify')::boolean,true)));
 end if;
 if key is not null then insert into commerce_operations values(p_order,key,request,result,now()); end if;
 return result;
end $$;

create or replace function public.enqueue_commerce_email() returns trigger language plpgsql set search_path=public as $$
declare o orders%rowtype; template_name text; body jsonb;
begin
 template_name:=case new.kind when 'created' then 'payment_instructions' when 'reinstated' then 'payment_instructions' when 'edit_item' then 'payment_instructions' when 'expired' then 'payment_expired' when 'paid' then 'order_confirmation'
  when 'shipped' then 'order_shipped' when 'refunded' then 'order_refunded' when 'refund_items' then 'order_refunded' end;
 if new.kind='shipped' and new.payload->>'notify'='false' then return new;end if;
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

revoke all on function public.enqueue_commerce_email() from public,anon,authenticated;
grant execute on function public.enqueue_commerce_email() to service_role;

-- Shared by manual tracking and imports: parcel identifiers cannot be attached
-- to two orders even if a manual correction races an import.
create function public.guard_tracking_identity() returns trigger language plpgsql set search_path=public as $$
begin
 if new.tracking_number is distinct from old.tracking_number and nullif(btrim(new.tracking_number),'') is not null then
  if length(new.tracking_number)>200 or new.tracking_number ~ '[[:cntrl:]]' then raise exception 'Invalid tracking number';end if;
  perform pg_advisory_xact_lock(hashtextextended('tracking:'||new.tracking_number,0));
  if exists(select 1 from orders where id<>new.id and tracking_number=new.tracking_number) then raise exception 'Tracking belongs to another order';end if;
 end if;
 return new;
end $$;
create trigger guard_tracking_identity before update on public.orders for each row execute function public.guard_tracking_identity();

create function public.admin_order_fulfilment(p_order uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('orderId',o.id,'editable',o.shipped_at is null and o.status not in ('shipped','completed'),'status',o.status,
 'lines',coalesce((select jsonb_agg(jsonb_build_object('itemId',i.id,'productName',i.product_name,'variantLabel',i.variant_label,'poolId',c.pool_variant_id,'poolName',p.name,
  'requiredUnits',case when o.status in ('cancelled','refunded','pending') then 0 else (i.qty-i.refunded_qty)*c.units_per_item end,
  'allocatedUnits',coalesce(a.total,0),
  'unallocatedUnits',greatest(0,case when o.status in ('cancelled','refunded','pending') then 0 else (i.qty-i.refunded_qty)*c.units_per_item end-coalesce(a.total,0)),
  'allocations',coalesce(a.rows,'[]'::jsonb)) order by i.id,c.pool_variant_id)
 from order_items i join order_stock_claims c on c.item_id=i.id join product_variants v on v.id=c.pool_variant_id join products p on p.id=v.product_id
 left join lateral (select sum(al.units) total,jsonb_agg(jsonb_build_object('lotId',l.id,'lotCode',l.lot_code,'units',al.units,'coa',case when cb.document_verified_at is not null and l.coa_snapshot=jsonb_build_object('batchId',cb.batch_id,'compound',cb.compound,'url',cb.coa_url,'verifiedAt',cb.document_verified_at) then jsonb_build_object('batchId',cb.batch_id,'url',cb.coa_url) else null end) order by l.lot_code) rows
  from order_lot_allocations al join stock_lots l on l.id=al.lot_id left join coa_batches cb on cb.id=l.coa_id where al.item_id=i.id and l.pool_variant_id=c.pool_variant_id) a on true where i.order_id=o.id),'[]'::jsonb))
 from orders o where o.id=p_order;
$$;
create function public.admin_lot_catalog() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('pools',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',p.name,'onHand',inv.on_hand) order by p.name,v.id) from product_variants v join products p on p.id=v.product_id join inventory inv on inv.variant_id=v.id where v.pack_size=1 or not exists(select 1 from product_variants s where s.product_id=v.product_id and s.pack_size=1)),'[]'::jsonb),
 'lots',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'poolId',l.pool_variant_id,'code',l.lot_code,'units',l.units,'availableUnits',l.units-coalesce((select sum(units) from order_lot_allocations where lot_id=l.id),0),'receiptId',l.receipt_id,'coaId',l.coa_id) order by l.lot_code) from stock_lots l),'[]'::jsonb),
 'receipts',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'poolId',s.variant_id,'units',s.qty,'createdAt',s.created_at) order by s.created_at desc) from stock_movements s where s.reason='received' and s.qty>0 and not exists(select 1 from stock_movements r where r.reverses_receipt_id=s.id)),'[]'::jsonb),
 'certificates',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'batchId',c.batch_id,'compound',c.compound) order by c.batch_id) from coa_batches c where c.document_verified_at is not null and nullif(btrim(c.coa_url),'') is not null),'[]'::jsonb));
$$;
revoke all on function public.guard_tracking_identity(),public.admin_order_fulfilment(uuid),public.admin_lot_catalog() from public,anon,authenticated;
grant execute on function public.guard_tracking_identity(),public.admin_order_fulfilment(uuid),public.admin_lot_catalog() to service_role;
