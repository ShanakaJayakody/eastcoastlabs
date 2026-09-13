-- Reporting deliberately excludes the inferred historical returned_qty backfill.
-- Only committed, reviewed physical restocks recover COGS; each quote commits once.
create view public.admin_order_item_economics with (security_invoker=true) as
select i.*,o.status order_status,least(i.qty,i.returned_qty,coalesce(r.units,0))::int confirmed_returned_qty
from public.order_items i join public.orders o on o.id=i.order_id
left join (
 select c.order_id,(line->>'itemId')::uuid item_id,sum((line->>'qty')::int) units
 from public.refund_commits c join public.refund_quotes q on q.token=c.quote_token
 cross join lateral jsonb_array_elements(q.quote->'lines') line
 where q.restock group by c.order_id,(line->>'itemId')::uuid
) r on r.order_id=i.order_id and r.item_id=i.id;
revoke all on public.admin_order_item_economics from public,anon,authenticated;
grant select on public.admin_order_item_economics to service_role;

-- Amounts are actual, mutually exclusive variable costs plus a separate reconciled tax correction in AUD cents.
-- NULL means unknown; zero must be entered explicitly. No GST is inferred.
create table public.order_variable_costs (
 order_id uuid primary key references public.orders(id),
 carrier_cents int check(carrier_cents>=0),
 packaging_fulfilment_cents int check(packaging_fulfilment_cents>=0),
 payment_cents int check(payment_cents>=0),
 replacement_cents int check(replacement_cents>=0),
 service_cents int check(service_cents>=0),
 acquisition_cents int check(acquisition_cents>=0),
 -- Signed reconciled tax correction, separate from expenses; positive reduces contribution.
 tax_adjustment_cents int,
 tax_basis_confirmed boolean not null default false,
 note text not null default '' check(length(note)<=2000),
 revision int not null default 1,
 updated_at timestamptz not null default now(),
 updated_by text not null
);
alter table public.order_variable_costs enable row level security;
revoke all on public.order_variable_costs from public,anon,authenticated;
grant select,insert,update on public.order_variable_costs to service_role;
create policy order_variable_costs_service on public.order_variable_costs for all to service_role using(true) with check(true);
create function public.admin_save_order_costs(p_order uuid,p_costs jsonb,p_revision int,p_actor text)
returns jsonb language plpgsql set search_path=public as $$
declare prior order_variable_costs%rowtype; saved order_variable_costs%rowtype; k text; v jsonb;
begin
 perform 1 from orders where id=p_order and paid_at is not null for update;
 if not found then raise exception 'Paid order not found';end if;
 if coalesce(length(btrim(p_actor)),0) not between 1 and 320 or jsonb_typeof(p_costs)<>'object' or p_costs is null then raise exception 'Valid costs and authenticated actor required';end if;
 for k,v in select * from jsonb_each(p_costs) loop
  if k in ('carrier_cents','packaging_fulfilment_cents','payment_cents','replacement_cents','service_cents','acquisition_cents') then
   if v<>'null'::jsonb and (jsonb_typeof(v)<>'number' or v::text !~ '^[0-9]+$' or v::numeric>2147483647) then raise exception 'Costs must be nonnegative integer cents or null';end if;
  elsif k='tax_adjustment_cents' then
   if v<>'null'::jsonb and (jsonb_typeof(v)<>'number' or v::text !~ '^-?[0-9]+$' or v::numeric < -2147483648 or v::numeric > 2147483647) then raise exception 'Tax adjustment must be signed integer cents in int32 range or null';end if;
  elsif k='tax_basis_confirmed' then
   if jsonb_typeof(v)<>'boolean' then raise exception 'Tax basis confirmation must be boolean';end if;
  elsif k='note' then
   if jsonb_typeof(v)<>'string' or length(p_costs->>k)>2000 then raise exception 'Invalid cost note';end if;
  else raise exception 'Unknown cost field';end if;
 end loop;
 select * into prior from order_variable_costs where order_id=p_order;
 if p_revision is distinct from coalesce(prior.revision,0) then raise exception 'Costs changed; reload before saving';end if;
 insert into order_variable_costs(order_id,carrier_cents,packaging_fulfilment_cents,payment_cents,replacement_cents,service_cents,acquisition_cents,tax_adjustment_cents,tax_basis_confirmed,note,updated_by)
 values(p_order,(p_costs->>'carrier_cents')::int,(p_costs->>'packaging_fulfilment_cents')::int,(p_costs->>'payment_cents')::int,(p_costs->>'replacement_cents')::int,(p_costs->>'service_cents')::int,(p_costs->>'acquisition_cents')::int,(p_costs->>'tax_adjustment_cents')::int,coalesce((p_costs->>'tax_basis_confirmed')::boolean,false),coalesce(p_costs->>'note',''),p_actor)
 on conflict(order_id) do update set carrier_cents=excluded.carrier_cents,packaging_fulfilment_cents=excluded.packaging_fulfilment_cents,payment_cents=excluded.payment_cents,replacement_cents=excluded.replacement_cents,service_cents=excluded.service_cents,acquisition_cents=excluded.acquisition_cents,tax_adjustment_cents=excluded.tax_adjustment_cents,tax_basis_confirmed=excluded.tax_basis_confirmed,note=excluded.note,revision=order_variable_costs.revision+1,updated_at=now(),updated_by=p_actor
 returning * into saved;
 insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff) values(p_actor,'order.variable_costs','order',p_order::text,jsonb_build_object('before',to_jsonb(prior),'after',to_jsonb(saved)));
 return to_jsonb(saved);
end $$;
revoke all on function public.admin_save_order_costs(uuid,jsonb,int,text) from public,anon,authenticated;
grant execute on function public.admin_save_order_costs(uuid,jsonb,int,text) to service_role;
