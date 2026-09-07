-- Local-review migration only. All write RPCs are restricted to service_role;
-- server actions retain the active admin allowlist check.
alter table public.products add column if not exists edit_version bigint not null default 0;
alter table public.coa_batches add column if not exists document_verified_at timestamptz;
create or replace function public.admin_product_edit_version() returns trigger language plpgsql set search_path=public as $$
begin
 if (to_jsonb(new) - array['updated_at','images','unit_cost_cents','edit_version']) is distinct from (to_jsonb(old) - array['updated_at','images','unit_cost_cents','edit_version']) then
  new.edit_version := old.edit_version + 1;
 end if;
 return new;
end $$;
create trigger admin_product_edit_version before update on public.products for each row execute function public.admin_product_edit_version();
create or replace function public.admin_variant_edit_version() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_table_name = 'product_variants' then
  if new.price_cents is distinct from old.price_cents then update products set edit_version=edit_version+1 where id=new.product_id; end if;
 else
  if new.low_stock_threshold is distinct from old.low_stock_threshold then
   update products set edit_version=edit_version+1 where id=(select product_id from product_variants where id=new.variant_id);
  end if;
 end if;
 return new;
end $$;
create trigger admin_variant_edit_version after update on public.product_variants for each row execute function public.admin_variant_edit_version();
create trigger admin_threshold_edit_version after update on public.inventory for each row execute function public.admin_variant_edit_version();

create or replace function public.admin_save_product(p_slug text,p_patch jsonb,p_variants jsonb,p_version bigint,p_actor text) returns bigint
language plpgsql security definer set search_path=public as $$
declare p products; v jsonb; result bigint;
begin
 select * into p from products where slug=p_slug for update;
 if not found then raise exception 'Product not found'; end if;
 if p_version is null or p.edit_version <> p_version then raise exception 'Product changed in another editor. Your draft is preserved; reload and reconcile before saving.'; end if;
 if jsonb_typeof(p_patch)<>'object' or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('name','short_description','description','seo_title','seo_description','status')) then raise exception 'Invalid product fields'; end if;
 if p_patch ? 'name' and (length(trim(p_patch->>'name')) not between 1 and 300) then raise exception 'Product name is required (maximum 300 characters)'; end if;
 if p_patch ? 'status' and p_patch->>'status' not in ('active','draft','archived','coming_soon') then raise exception 'Invalid status'; end if;
 if jsonb_typeof(p_variants)<>'array' or jsonb_array_length(p_variants)>100 then raise exception 'Invalid variants'; end if;
 if (select count(*) from jsonb_array_elements(p_variants)) <> (select count(distinct value->>'id') from jsonb_array_elements(p_variants)) then raise exception 'Duplicate variant'; end if;
 update products set name=coalesce(p_patch->>'name',name), short_description=case when p_patch?'short_description' then p_patch->>'short_description' else short_description end,
 description=case when p_patch?'description' then p_patch->>'description' else description end,
 seo_title=case when p_patch?'seo_title' then p_patch->>'seo_title' else seo_title end,
 seo_description=case when p_patch?'seo_description' then p_patch->>'seo_description' else seo_description end,
 status=coalesce(p_patch->>'status',status),updated_at=now() where id=p.id;
 for v in select value from jsonb_array_elements(p_variants) loop
  if coalesce(v->>'price_cents','') !~ '^[0-9]+$' or (v->>'price_cents')::numeric > 100000000 or coalesce(v->>'threshold','') !~ '^[0-9]+$' or (v->>'threshold')::numeric > 1000000 then raise exception 'Invalid variant price or threshold'; end if;
  update product_variants set price_cents=(v->>'price_cents')::integer where id=(v->>'id')::uuid and product_id=p.id;
  if not found then raise exception 'Variant does not belong to this product'; end if;
  update inventory set low_stock_threshold=(v->>'threshold')::integer,updated_at=now() where variant_id=(v->>'id')::uuid;
  if not found then raise exception 'Variant inventory missing'; end if;
 end loop;
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(p_actor,'product.save','product',p.id::text,jsonb_build_object('fields',p_patch,'variants',p_variants));
 select edit_version into result from products where id=p.id;
 return result;
end $$;

create table public.settings_revision(singleton boolean primary key default true check(singleton), version bigint not null default 0);
insert into public.settings_revision values(true,0);
alter table public.settings_revision enable row level security;
grant all on public.settings_revision to service_role;
create or replace function public.admin_settings_snapshot() returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object('version',(select version from settings_revision where singleton),'values',coalesce((select jsonb_object_agg(key,value) from settings),'{}'::jsonb));
$$;
create or replace function public.admin_save_settings(p_values jsonb,p_version bigint,p_actor text) returns bigint language plpgsql security definer set search_path=public as $$
declare current_version bigint; k text; v jsonb;
begin
 select version into current_version from settings_revision where singleton for update;
 if p_version is null or p_version <> current_version then raise exception 'Settings changed in another editor. Reload and reconcile your draft before saving.'; end if;
 if jsonb_typeof(p_values)<>'object' then raise exception 'Invalid settings'; end if;
 for k,v in select key,value from jsonb_each(p_values) loop
  if k not in ('announcement_items','free_shipping_threshold','gift_threshold','support_email','payid_enabled','payid_identifier','payid_name','bank_transfer_enabled','bank_bsb','bank_account_number','bank_account_name','payment_window_hours','payment_expiry_hours','standard_shipping_cents','express_shipping_enabled','express_shipping_cents','express_free_threshold') then raise exception 'Unknown setting %',k; end if;
  if k in ('free_shipping_threshold','gift_threshold','express_free_threshold','standard_shipping_cents','express_shipping_cents','payment_window_hours','payment_expiry_hours') then
   if jsonb_typeof(v)<>'number' or (v::text)::numeric < 0 or (v::text)::numeric > 100000000 or (k in ('standard_shipping_cents','express_shipping_cents') and (v::text)::numeric <> trunc((v::text)::numeric)) then raise exception 'Invalid shipping/payment numeric setting %',k; end if;
   if k in ('payment_window_hours','payment_expiry_hours') and ((v::text)::numeric < 1 or (v::text)::numeric > 720 or (v::text)::numeric <> trunc((v::text)::numeric)) then raise exception 'Invalid payment hours'; end if;
  end if;
 end loop;
 if p_values ? 'payment_window_hours' and p_values ? 'payment_expiry_hours' and (p_values->>'payment_window_hours')::numeric > (p_values->>'payment_expiry_hours')::numeric then raise exception 'Hold exceeds expiry'; end if;
 insert into settings(key,value,updated_at,updated_by) select key,value,now(),p_actor from jsonb_each(p_values) on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 update settings_revision set version=version+1 where singleton returning version into current_version;
 insert into admin_audit_log(actor_email,action,entity_type,diff) values(p_actor,'settings.update','settings',jsonb_build_object('keys',(select jsonb_agg(key) from jsonb_each(p_values))));
 return current_version;
end $$;
revoke all on function public.admin_save_product(text,jsonb,jsonb,bigint,text),public.admin_save_settings(jsonb,bigint,text),public.admin_settings_snapshot() from public,anon,authenticated;
grant execute on function public.admin_save_product(text,jsonb,jsonb,bigint,text),public.admin_save_settings(jsonb,bigint,text),public.admin_settings_snapshot() to service_role;

-- A receipt and its valuation are one business operation. Reversal is allowed
-- only while its exact stock/cost snapshot is still current; sales COGS is frozen.
alter table stock_movements add column ledger_sequence bigint generated always as identity;
alter table stock_movements add column previous_unit_cost_cents integer;
alter table stock_movements add column receipt_average_cents integer;
alter table stock_movements add column receipt_on_hand integer;
alter table stock_movements add column reverses_receipt_id uuid unique references stock_movements(id);
create or replace function public.admin_receive_stock(p_variant uuid,p_qty integer,p_cost integer,p_actor text,p_note text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare product products; stock inventory; receipt uuid; average integer;
begin
 if p_qty is null or p_qty<1 or p_qty>1000000 or p_cost<0 or p_cost>100000000 then raise exception 'Invalid receipt quantity or unit cost';end if;
 select p.* into product from products p join product_variants v on v.product_id=p.id where v.id=p_variant and v.pack_size=1 for update of p;
 if not found then raise exception 'Receive stock against the single-vial inventory pool';end if;
 select * into stock from inventory where variant_id=p_variant for update;
 if not found then raise exception 'Inventory pool missing';end if;
 average:=product.unit_cost_cents;
 if p_cost is not null then
  average:=case when product.unit_cost_cents is null or stock.on_hand<=0 then p_cost else round((stock.on_hand::numeric*product.unit_cost_cents+p_qty::numeric*p_cost)/(stock.on_hand+p_qty))::integer end;
 end if;
 insert into stock_movements(variant_id,qty,reason,actor_email,note,unit_cost_cents,previous_unit_cost_cents,receipt_average_cents,receipt_on_hand)
 values(p_variant,p_qty,'received',p_actor,p_note,p_cost,product.unit_cost_cents,average,stock.on_hand+p_qty) returning id into receipt;
 update products set unit_cost_cents=average,updated_at=now() where id=product.id;
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(p_actor,'stock.receipt','stock_movement',receipt::text,jsonb_build_object('qty',p_qty,'cost',p_cost,'average',average));
 return jsonb_build_object('receipt_id',receipt,'average_cents',average,'became_available',stock.on_hand-stock.reserved<=0 and stock.on_hand+p_qty-stock.reserved>0);
end $$;
create or replace function public.admin_reverse_receipt(p_receipt uuid,p_actor text) returns void
language plpgsql security definer set search_path=public as $$
declare receipt stock_movements; product products; stock inventory;
begin
 select * into receipt from stock_movements where id=p_receipt;
 if not found or receipt.reason<>'received' or receipt.receipt_on_hand is null then raise exception 'Receipt cannot be reversed automatically';end if;
 select p.* into product from products p join product_variants v on v.product_id=p.id where v.id=receipt.variant_id for update of p;
 select * into stock from inventory where variant_id=receipt.variant_id for update;
 if exists(select 1 from stock_movements where reverses_receipt_id=p_receipt) then return;end if;
 if exists(select 1 from stock_movements where variant_id=receipt.variant_id and ledger_sequence>receipt.ledger_sequence) or stock.on_hand<>receipt.receipt_on_hand then raise exception 'Later stock movements exist. Use a reviewed quantity and cost correction.';end if;
 if product.unit_cost_cents is distinct from receipt.receipt_average_cents then raise exception 'Cost has changed since this receipt. Use a reviewed correction.';end if;
 if stock.on_hand-receipt.qty<stock.reserved then raise exception 'Receipt stock is now reserved; resolve reservations before reversing';end if;
 insert into stock_movements(variant_id,qty,reason,actor_email,note,reverses_receipt_id) values(receipt.variant_id,-receipt.qty,'recount',p_actor,'Receipt reversal',p_receipt);
 update products set unit_cost_cents=receipt.previous_unit_cost_cents,updated_at=now() where id=product.id;
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(p_actor,'stock.receipt.reverse','stock_movement',p_receipt::text,jsonb_build_object('qty',-receipt.qty,'restored_cost',receipt.previous_unit_cost_cents));
end $$;
revoke all on function public.admin_receive_stock(uuid,integer,integer,text,text),public.admin_reverse_receipt(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_receive_stock(uuid,integer,integer,text,text),public.admin_reverse_receipt(uuid,text) to service_role;

-- Purchase cohorts count confirmed payment, never an unpaid checkout. Legacy
-- rows use settled stock / paid fulfilment status as payment evidence; their
-- creation timestamp is retained only when no paid_at was recorded.
create or replace view public.customers as
with classified as (
 select *,status<>'pending' and (paid_at is not null or stock_settled or status in ('paid','processing','shipped','completed')) as was_paid from public.orders
)
select customer_email as email,max(customer_name) as name,
 count(*) filter(where was_paid) as orders_count,
 coalesce(sum(greatest(0,total_cents-coalesce(refunded_cents,0))) filter(where was_paid),0) as ltv_cents,
 min(coalesce(paid_at,created_at)) filter(where was_paid) as first_order_at,
 max(coalesce(paid_at,created_at)) filter(where was_paid) as last_order_at
from classified group by customer_email;
revoke all on public.customers from public,anon,authenticated;
grant select on public.customers to service_role;

-- Complete People projection: segment derivation precedes search and pagination.
-- Service-only grant prevents exposing customer identities through public APIs.
create or replace view public.admin_people as
with purchasers as (
 select lower(trim(email)) email,max(name) name,sum(orders_count) orders_count,sum(ltv_cents) ltv_cents,max(last_order_at) last_order_at from customers group by 1
), carts as (
 select distinct on(lower(trim(email))) lower(trim(email)) email,subtotal_cents,reminder_stage,updated_at from cart_sessions where status='active' order by lower(trim(email)),updated_at desc
), subs as (
 select lower(trim(email)) email,bool_or(unsubscribed_at is not null) unsubscribed from subscribers group by 1
), identities as (
 select email from purchasers union select email from carts union select email from subs
), people as (
 select i.email,p.name,coalesce(p.orders_count,0) orders_count,coalesce(p.ltv_cents,0) ltv_cents,p.last_order_at,c.subtotal_cents,c.reminder_stage,
 extract(epoch from now()-c.updated_at)/3600 cart_idle_hours,s.email is not null and not s.unsubscribed subscribed,coalesce(s.unsubscribed,false) unsubscribed
 from identities i left join purchasers p using(email) left join carts c using(email) left join subs s using(email)
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
create or replace function public.admin_people_counts() returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_object_agg(segment,n),'{}'::jsonb) from (
  select 'all' segment,count(*) n from admin_people union all select segment,count(*) from admin_people cross join unnest(segments) segment group by segment
 ) counts;
$$;
revoke all on function public.admin_people_counts() from public,anon,authenticated;
grant execute on function public.admin_people_counts() to service_role;
