-- Permanent order deletion is an explicit, service-only administrative action.
-- Stock already sold or returned remains in the append-only movement ledger;
-- only an active unpaid reservation is released here.
alter table public.order_lot_allocations
  add column order_id uuid,
  add column order_number text,
  add column item_snapshot jsonb;
alter table public.order_lot_allocations
  drop constraint order_lot_allocations_item_id_fkey;
alter table public.order_lot_allocations add constraint order_lot_allocation_evidence_shape check(
  (item_snapshot is null and order_id is null and order_number is null)
  or (item_snapshot is not null and order_id is not null and order_number is not null)
);

-- A paid, unshipped order contributes claim units to physical lot capacity even
-- though its sale has already left on_hand. Preserve that contribution when the
-- active order and claims are removed.
create table public.deleted_order_stock_capacity (
  order_id uuid not null,
  order_number text not null,
  pool_variant_id uuid not null references public.product_variants(id),
  paid_unshipped_units integer not null check(paid_unshipped_units>0),
  primary key(order_id,pool_variant_id)
);
alter table public.deleted_order_stock_capacity enable row level security;
revoke all on public.deleted_order_stock_capacity from public,anon,authenticated,service_role;
grant select on public.deleted_order_stock_capacity to service_role;

create function public.deleted_order_stock_capacity_immutable() returns trigger
language plpgsql set search_path=public as $$
begin
  raise exception 'Deleted-order stock capacity evidence is immutable';
end $$;
create trigger deleted_order_stock_capacity_immutable
before update or delete on public.deleted_order_stock_capacity
for each row execute function public.deleted_order_stock_capacity_immutable();

create function public.guard_order_lot_allocation_evidence() returns trigger
language plpgsql set search_path=public as $$
begin
  if tg_op='DELETE' then
    if old.item_snapshot is not null then raise exception 'Deleted-order lot evidence is immutable';end if;
    return old;
  end if;
  if tg_op='UPDATE' and old.item_snapshot is not null then
    raise exception 'Deleted-order lot evidence is immutable';
  end if;
  if new.item_snapshot is not null then
    if tg_op<>'UPDATE' or not exists(select 1 from order_items where id=new.item_id) then
      raise exception 'Lot evidence requires its current order item';
    end if;
  elsif not exists(select 1 from order_items where id=new.item_id) then
    raise exception 'Lot allocation requires an existing order item';
  end if;
  return new;
end $$;
create trigger guard_order_lot_allocation_evidence
before insert or update or delete on public.order_lot_allocations
for each row execute function public.guard_order_lot_allocation_evidence();

create function public.guard_allocated_order_item_delete() returns trigger
language plpgsql set search_path=public as $$
begin
  if exists(
    select 1 from order_lot_allocations
    where item_id=old.id and item_snapshot is null
  ) then raise exception 'Order item has an active lot allocation';end if;
  return old;
end $$;
create trigger guard_allocated_order_item_delete
before delete on public.order_items
for each row execute function public.guard_allocated_order_item_delete();

-- These rows are durable evidence. Keep their UUID association as a tombstone
-- after the active order row is removed instead of cascading or mutating them.
alter table public.refund_quotes drop constraint refund_quotes_order_id_fkey;
alter table public.refund_commits drop constraint refund_commits_order_id_fkey;
alter table public.refund_settlements drop constraint refund_settlements_order_id_fkey;
alter table public.recovery_episodes drop constraint recovery_episodes_order_id_fkey;
alter table public.legacy_discount_customers drop constraint legacy_discount_customers_source_order_id_fkey;
alter table public.commerce_events drop constraint commerce_events_order_id_fkey;
alter table public.paid_analytics_outbox drop constraint paid_analytics_outbox_order_id_fkey;

-- Keep the lot-registration capacity boundary identical after an order is
-- deleted. Shipped allocation snapshots remain dispatched, while paid but
-- unshipped claim units are retained in deleted_order_stock_capacity.
create or replace function public.admin_register_stock_lot(p_pool uuid,p_code text,p_units integer,p_receipt uuid,p_coa uuid,p_evidence text,p_actor text)
returns uuid language plpgsql security definer set search_path=public as $$
declare stock inventory; receipt stock_movements; product_name text; registered bigint; dispatched bigint; paid_units bigint; result uuid; certificate jsonb;
begin
 if p_units is null or p_units not between 1 and 1000000 or coalesce(length(btrim(p_code)),0) not between 1 and 100
  or coalesce(length(btrim(p_evidence)),0) not between 3 and 2000 or coalesce(length(btrim(p_actor)),0) not between 1 and 320 then raise exception 'Valid lot, physical units, evidence and actor required';end if;
 select p.name into product_name from product_variants v join products p on p.id=v.product_id
 where v.id=p_pool and (v.pack_size=1 or not exists(select 1 from product_variants s where s.product_id=v.product_id and s.pack_size=1));
 if not found then raise exception 'Choose a physical stock pool';end if;
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
 select coalesce(sum(a.units),0) into dispatched
 from order_lot_allocations a
 join stock_lots l on l.id=a.lot_id
 left join order_items i on i.id=a.item_id
 left join orders o on o.id=i.order_id
 where l.pool_variant_id=p_pool
   and ((a.item_snapshot is null and o.shipped_at is not null)
     or (a.item_snapshot is not null and a.item_snapshot->>'shippedAt' is not null));
 select
  coalesce((select sum((i.qty-i.returned_qty)*c.units_per_item) from order_stock_claims c join order_items i on i.id=c.item_id join orders o on o.id=i.order_id
   where c.pool_variant_id=p_pool and o.stock_settled and o.shipped_at is null),0)
  + coalesce((select sum(e.paid_unshipped_units) from deleted_order_stock_capacity e where e.pool_variant_id=p_pool),0)
 into paid_units;
 if registered-dispatched+p_units>greatest(0,stock.on_hand)+paid_units then raise exception 'Lot units exceed current physical stock evidence';end if;
 insert into stock_lots(pool_variant_id,lot_code,units,receipt_id,coa_id,coa_snapshot,evidence,actor_email) values(p_pool,btrim(p_code),p_units,p_receipt,p_coa,certificate,btrim(p_evidence),p_actor) returning id into result;
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(p_actor,'stock.lot.register','stock_lot',result::text,jsonb_build_object('pool',p_pool,'units',p_units,'receipt',p_receipt,'coa',p_coa,'evidence',p_evidence));
 return result;
end $$;

create function public.admin_delete_order(p_order uuid,p_confirmation text,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  target orders%rowtype;
  claim record;
  result jsonb;
begin
  if coalesce(length(btrim(p_actor)),0) not between 1 and 320 then
    raise exception 'Authenticated actor required';
  end if;
  select * into target from orders where id=p_order for update;
  if not found then raise exception 'Order not found';end if;
  if p_confirmation is distinct from target.order_number then
    raise exception 'Type the exact order number to confirm deletion';
  end if;
  perform inv.variant_id
  from inventory inv
  where inv.variant_id in (
    select c.pool_variant_id
    from order_stock_claims c
    join order_items i on i.id=c.item_id
    where i.order_id=p_order
  )
  order by inv.variant_id
  for update;

  if target.stock_reserved and not target.stock_settled then
    for claim in
      select c.pool_variant_id,sum(i.qty*c.units_per_item)::int units
      from order_stock_claims c
      join order_items i on i.id=c.item_id
      where i.order_id=p_order
      group by c.pool_variant_id
      order by c.pool_variant_id
    loop
      update inventory
      set reserved=reserved-claim.units,updated_at=now()
      where variant_id=claim.pool_variant_id and reserved>=claim.units;
      if not found then raise exception 'Reservation invariant failed';end if;
    end loop;
  end if;

  result:=jsonb_build_object('id',target.id,'orderNumber',target.order_number,'status',target.status);
  if target.stock_settled and target.shipped_at is null then
    insert into deleted_order_stock_capacity(order_id,order_number,pool_variant_id,paid_unshipped_units)
    select target.id,target.order_number,c.pool_variant_id,sum((item.qty-item.returned_qty)*c.units_per_item)::int
    from order_stock_claims c
    join order_items item on item.id=c.item_id
    where item.order_id=p_order
    group by c.pool_variant_id
    having sum((item.qty-item.returned_qty)*c.units_per_item)>0;
  end if;
  update order_lot_allocations allocation
  set order_id=target.id,
      order_number=target.order_number,
      item_snapshot=jsonb_build_object(
        'productName',item.product_name,
        'variantLabel',item.variant_label,
        'sku',item.sku,
        'qty',item.qty,
        'orderStatus',target.status,
        'stockSettled',target.stock_settled,
        'shippedAt',target.shipped_at
      )
  from order_items item
  where allocation.item_id=item.id and item.order_id=p_order;
  update reviews set order_id=null where order_id=p_order;
  update cart_sessions set recovered_order_id=null where recovered_order_id=p_order;
  update email_outbox
  set status='cancelled',error='Order deleted',lease_token=null,lease_expires_at=null
  where (
    payload->>'order_id'=p_order::text
    or (payload->>'order_id' is null and payload->>'order_number'=target.order_number)
  ) and status in ('queued','failed');
  delete from carrier_previews where order_id=p_order;
  delete from order_variable_costs where order_id=p_order;
  delete from orders where id=p_order;
  insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff)
  values(p_actor,'order.delete','order',p_order::text,result);
  return result;
end $$;

revoke all on function public.deleted_order_stock_capacity_immutable(),public.guard_order_lot_allocation_evidence(),public.guard_allocated_order_item_delete(),
  public.admin_delete_order(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_delete_order(uuid,text,text) to service_role;
