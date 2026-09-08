-- Exact reviewed refunds wrap the canonical commerce operation under its order lock.
-- These are accounting records: settlement records an already-completed transfer.
create table public.refund_quotes (
 token uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id),
 selection jsonb not null,
 restock boolean not null,
 state jsonb not null,
 quote jsonb not null,
 created_at timestamptz not null default now()
);
create table public.refund_commits (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id),
 operation_key text not null,
 request jsonb not null,
 quote_token uuid not null unique references public.refund_quotes(token),
 result jsonb not null,
 actor_email text not null,
 created_at timestamptz not null default now(),
 unique(order_id,operation_key)
);
create table public.refund_settlements (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id),
 amount_cents int not null check(amount_cents>0),
 transfer_reference text not null check(length(btrim(transfer_reference)) between 1 and 200),
 transfer_date date not null,
 operation_key text not null,
 actor_email text not null,
 created_at timestamptz not null default now(),
 unique(order_id,operation_key), unique(order_id,transfer_reference)
);
create function public.refund_evidence_immutable() returns trigger language plpgsql as $$
begin raise exception 'Refund evidence is immutable'; end $$;
create trigger refund_quotes_immutable before update or delete on public.refund_quotes for each row execute function public.refund_evidence_immutable();
create trigger refund_commits_immutable before update or delete on public.refund_commits for each row execute function public.refund_evidence_immutable();
create trigger refund_settlements_immutable before update or delete on public.refund_settlements for each row execute function public.refund_evidence_immutable();

-- Whole snapshots intentionally invalidate review on any order/line change.
create function public.commerce_refund_state(p_order uuid) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('order',to_jsonb(o),'items',(select jsonb_agg(to_jsonb(i) order by i.id) from order_items i where i.order_id=o.id)) from orders o where o.id=p_order
$$;
create function public.commerce_refund_quote(p_order uuid,p_selection jsonb,p_restock boolean)
returns jsonb language plpgsql set search_path=public as $$
declare o orders%rowtype; it order_items%rowtype; line jsonb; selection jsonb:=coalesce(p_selection,'null'::jsonb);
 lines jsonb:='[]'; q int; amount int; gross int; gross_total int:=0; net_total int:=0;
 shipping int:=0; fully boolean; result jsonb; token uuid:=gen_random_uuid();
begin
 select * into o from orders where id=p_order for update;
 if not found then raise exception 'Order not found'; end if;
 if p_restock is null then raise exception 'Restock choice required'; end if;
 if o.status not in ('paid','processing','shipped','completed') then raise exception 'Order is not refundable'; end if;
 if selection='null'::jsonb then
  select jsonb_agg(jsonb_build_object('itemId',id,'qty',qty-refunded_qty) order by id) into selection from order_items where order_id=p_order and refunded_qty<qty;
 end if;
 if selection is null or jsonb_typeof(selection)<>'array' or jsonb_array_length(selection)=0 then raise exception 'No refund lines'; end if;
 if (select count(*)<>count(distinct value->>'itemId') from jsonb_array_elements(selection)) then raise exception 'Duplicate refund item'; end if;
 for line in select value from jsonb_array_elements(selection) loop
  select * into it from order_items where id=(line->>'itemId')::uuid and order_id=p_order;
  q:=(line->>'qty')::int;
  if not found or q is null or q<1 or q>it.qty-it.refunded_qty or (line->>'qty')::numeric<>q then raise exception 'Invalid refund quantity'; end if;
  amount:=round((it.line_total_cents-it.discount_allocated_cents)::numeric*(it.refunded_qty+q)/it.qty)::int-it.refunded_cents;
  gross:=round(it.line_total_cents::numeric*(it.refunded_qty+q)/it.qty)::int-round(it.line_total_cents::numeric*it.refunded_qty/it.qty)::int;
  if amount<0 or amount>gross then raise exception 'Historical refund allocation requires reconciliation'; end if;
  gross_total:=gross_total+gross; net_total:=net_total+amount;
  lines:=lines||jsonb_build_array(jsonb_build_object('itemId',it.id,'name',it.product_name,'label',it.variant_label,'qty',q,'itemCents',gross,'discountCents',gross-amount,'totalCents',amount));
 end loop;
 select not exists(select 1 from order_items i where i.order_id=p_order and i.qty-i.refunded_qty>coalesce((select (value->>'qty')::int from jsonb_array_elements(selection) where (value->>'itemId')::uuid=i.id),0)) into fully;
 if fully then shipping:=o.total_cents-o.refunded_cents-net_total; end if;
 -- Historical inconsistent allocations must be reconciled, never labelled as shipping.
 if shipping<0 or shipping>o.shipping_cents or net_total+shipping>o.total_cents-o.refunded_cents then raise exception 'Historical refund allocation requires reconciliation'; end if;
 result:=jsonb_build_object('token',token,'lines',lines,'itemCents',gross_total,'discountCents',gross_total-net_total,'shippingCents',shipping,'totalCents',net_total+shipping,'remainingCents',o.total_cents-o.refunded_cents-net_total-shipping,'fullyRefunded',fully);
 insert into refund_quotes(token,order_id,selection,restock,state,quote) values(token,p_order,coalesce(p_selection,'null'::jsonb),p_restock,commerce_refund_state(p_order),result);
 return result;
end $$;

create function public.commerce_refund_commit(p_order uuid,p_selection jsonb,p_restock boolean,p_token uuid,p_key text,p_actor text)
returns jsonb language plpgsql set search_path=public as $$
declare reviewed refund_quotes%rowtype; cached refund_commits%rowtype; result jsonb;
 request jsonb:=jsonb_build_object('selection',p_selection,'restock',p_restock,'token',p_token,'actor',p_actor);
begin
 perform 1 from orders where id=p_order for update;
 if not found then raise exception 'Order not found'; end if;
 if coalesce(length(btrim(p_key)),0) not between 1 and 200 or coalesce(length(btrim(p_actor)),0) not between 1 and 320 then raise exception 'Idempotency key and actor required'; end if;
 select * into cached from refund_commits where order_id=p_order and operation_key=p_key;
 if found then
  if cached.request<>request then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
  return cached.result;
 end if;
 select * into reviewed from refund_quotes where token=p_token and order_id=p_order;
 if not found then raise exception 'REFUND_PREVIEW_REQUIRED'; end if;
 if reviewed.selection is distinct from coalesce(p_selection,'null'::jsonb) or reviewed.restock is distinct from p_restock then raise exception 'REFUND_PREVIEW_SELECTION_CHANGED'; end if;
 if reviewed.state is distinct from commerce_refund_state(p_order) then raise exception 'REFUND_PREVIEW_STALE: Review the updated refund before recording it'; end if;
 result:=commerce_order_operation(p_order,case when coalesce(p_selection,'null'::jsonb)='null'::jsonb then 'refunded' else 'refund_items' end,jsonb_build_object('refunds',p_selection,'restock',p_restock,'actor',p_actor,'idempotencyKey','reviewed-refund:'||p_key));
 if (result->>'refundedCents')::int<>(reviewed.quote->>'totalCents')::int then raise exception 'Refund preview amount differs from canonical operation'; end if;
 insert into refund_commits(order_id,operation_key,request,quote_token,result,actor_email) values(p_order,p_key,request,p_token,result,p_actor);
 return result;
end $$;

create function public.commerce_refund_settle(p_order uuid,p_cents int,p_reference text,p_transfer_date date,p_key text,p_actor text)
returns jsonb language plpgsql set search_path=public as $$
declare o orders%rowtype; cached refund_settlements%rowtype; recorded refund_settlements%rowtype; settled bigint;
begin
 select * into o from orders where id=p_order for update;
 if not found then raise exception 'Order not found'; end if;
 if p_cents is null or p_cents<1 or coalesce(length(btrim(p_reference)),0) not between 1 and 200 or p_transfer_date is null or p_transfer_date>current_date or coalesce(length(btrim(p_key)),0) not between 1 and 200 or coalesce(length(btrim(p_actor)),0) not between 1 and 320 then raise exception 'Valid amount, transfer reference, past transfer date, key and actor required'; end if;
 select * into cached from refund_settlements where order_id=p_order and operation_key=p_key;
 if found then
  if cached.amount_cents<>p_cents or cached.transfer_reference<>btrim(p_reference) or cached.transfer_date<>p_transfer_date or cached.actor_email<>p_actor then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
  return to_jsonb(cached);
 end if;
 if exists(select 1 from refund_settlements where order_id=p_order and transfer_reference=btrim(p_reference)) then raise exception 'Transfer reference already recorded'; end if;
 select coalesce(sum(amount_cents),0) into settled from refund_settlements where order_id=p_order;
 if settled+p_cents>o.refunded_cents then raise exception 'Settlement exceeds recorded refunds'; end if;
 insert into refund_settlements(order_id,amount_cents,transfer_reference,transfer_date,operation_key,actor_email) values(p_order,p_cents,btrim(p_reference),p_transfer_date,p_key,p_actor) returning * into recorded;
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(p_actor,'order.refund_settlement','order',p_order::text,to_jsonb(recorded));
 return to_jsonb(recorded);
end $$;

alter table public.refund_quotes enable row level security;
alter table public.refund_commits enable row level security;
alter table public.refund_settlements enable row level security;
revoke all on public.refund_quotes,public.refund_commits,public.refund_settlements from public,anon,authenticated;
grant select,insert on public.refund_quotes,public.refund_commits,public.refund_settlements to service_role;
-- Invoker RPCs match the existing privileged commerce role; RLS permits that role.
create policy refund_quotes_service on public.refund_quotes for all to service_role using(true) with check(true);
create policy refund_commits_service on public.refund_commits for all to service_role using(true) with check(true);
create policy refund_settlements_service on public.refund_settlements for all to service_role using(true) with check(true);
revoke all on function public.refund_evidence_immutable(),public.commerce_refund_state(uuid),public.commerce_refund_quote(uuid,jsonb,boolean),public.commerce_refund_commit(uuid,jsonb,boolean,uuid,text,text),public.commerce_refund_settle(uuid,int,text,date,text,text) from public,anon,authenticated;
grant execute on function public.refund_evidence_immutable(),public.commerce_refund_state(uuid),public.commerce_refund_quote(uuid,jsonb,boolean),public.commerce_refund_commit(uuid,jsonb,boolean,uuid,text,text),public.commerce_refund_settle(uuid,int,text,date,text,text) to service_role;
