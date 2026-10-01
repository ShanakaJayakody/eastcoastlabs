-- Orders workspace: additive reads only. Existing commerce operations remain authoritative.
create function public.admin_order_workspace_matches_view(p_status text,p_issues text[],p_view text)
returns boolean language sql immutable security definer set search_path=public as $$
 select case p_view when 'all' then true when 'to_fulfil' then p_status in ('paid','processing')
 when 'needs_attention' then cardinality(p_issues)>0 else p_status=p_view end;
$$;

create function public.admin_order_workspace_scope(p_filters jsonb,p_as_of timestamptz,p_order_ids uuid[] default null)
returns table(order_id uuid,status text,facts jsonb)
language plpgsql stable security definer set search_path=public as $$
declare
 v_status text:=coalesce(p_filters->>'status','all');
 v_shipping text:=coalesce(p_filters->>'shipping','any');
 v_sort text:=coalesce(p_filters->>'sort','created_at');
 v_dir text:=coalesce(p_filters->>'dir','desc');
 v_page numeric:=coalesce((p_filters->>'page')::numeric,1);
 v_q text:=lower(btrim(coalesce(p_filters->>'q','')));
 v_discount text:=lower(btrim(coalesce(p_filters->>'discount','')));
 v_from timestamptz:=(p_filters->>'from_at')::timestamptz;
 v_to timestamptz:=(p_filters->>'to_at')::timestamptz;
begin
 if jsonb_typeof(p_filters)<>'object' or p_filters is null or p_as_of is null or not isfinite(p_as_of)
 or v_status not in ('all','to_fulfil','needs_attention','pending','paid','processing','shipped','completed','refunded','cancelled')
 or v_shipping not in ('any','standard','express')
 or v_sort not in ('created_at','paid_at','waiting_seconds','order_number','total_cents','status')
 or v_dir not in ('asc','desc') or v_page<1 or v_page>1000000 or trunc(v_page)<>v_page
 or length(v_q)>200 or length(v_discount)>100 or v_from>=v_to
 or (v_from is not null and not isfinite(v_from)) or (v_to is not null and not isfinite(v_to))
 or cardinality(p_order_ids)>25 then raise exception 'Invalid orders workspace filters'; end if;
 return query
 with candidates as (
  select o.*,case when o.shipping_address->>'shipping_method'='express' then 'express' else 'standard' end shipping
  from orders o
  where (p_order_ids is null or o.id=any(p_order_ids))
  and ((v_from is null and v_to is null) or isfinite(o.created_at))
  and (v_from is null or o.created_at>=v_from) and (v_to is null or o.created_at<v_to)
  and (v_discount='' or lower(coalesce(o.discount_code,''))=v_discount)
  and (v_shipping='any' or case when o.shipping_address->>'shipping_method'='express' then 'express' else 'standard' end=v_shipping)
  and (v_q='' or strpos(lower(concat_ws(' ',o.order_number,o.customer_name,o.customer_email,o.payment_ref,o.tracking_number)),v_q)>0
    or exists(select 1 from order_items i where i.order_id=o.id and strpos(lower(concat_ws(' ',i.product_name,i.variant_label,i.sku)),v_q)>0))
 ), enriched as (
  select o.*,i.line_count,i.ordered_units,i.remaining_units,i.summaries,
   coalesce(s.settled,0) settled,
   (o.paid_at is not null and isfinite(o.paid_at) and isfinite(o.created_at) and o.paid_at>=o.created_at and o.paid_at<=p_as_of) paid_valid,
   (o.shipped_at is not null and isfinite(o.shipped_at) and o.paid_at is not null and isfinite(o.paid_at) and isfinite(o.created_at) and o.paid_at>=o.created_at and o.shipped_at>=o.paid_at and o.shipped_at<=p_as_of) shipped_valid
  from candidates o
  left join lateral (
   select count(*)::int line_count,
    case when count(*)=0 or bool_or(c.units is null) then null else sum(i.qty::bigint*c.units) end ordered_units,
    case when count(*)=0 or bool_or(c.units is null) then null else sum((i.qty-i.refunded_qty)::bigint*c.units) end remaining_units,
    coalesce(jsonb_agg(jsonb_build_object('id',i.id,'product_name',i.product_name,'variant_label',i.variant_label,'size_label',p.size_label,'sku',i.sku,'qty',i.qty,'refunded_qty',i.refunded_qty) order by i.id) filter(where i.position<=3),'[]'::jsonb) summaries
   from (select oi.*,row_number() over(order by oi.id) position from order_items oi where oi.order_id=o.id) i
   left join product_variants pv on pv.id=i.variant_id left join products p on p.id=pv.product_id
   left join lateral (select sum(sc.units_per_item)::bigint units from order_stock_claims sc where sc.item_id=i.id) c on true
  ) i on true
  left join lateral (select sum(rs.amount_cents)::bigint settled from refund_settlements rs where rs.order_id=o.id) s on true
 ), flagged as (
  select e.*,array_remove(array[
   case when e.status in ('paid','processing') and (
    nullif(btrim(e.shipping_address->>'line1'),'') is null
    or coalesce(nullif(btrim(e.shipping_address->>'suburb'),''),nullif(btrim(e.shipping_address->>'city'),'')) is null
    or nullif(btrim(e.shipping_address->>'state'),'') is null or nullif(btrim(e.shipping_address->>'postcode'),'') is null) then 'address_incomplete' end,
   case when not isfinite(e.created_at) or e.created_at>p_as_of
    or (e.status in ('paid','processing','shipped','completed') and not e.paid_valid)
    or (e.status in ('shipped','completed') and not e.shipped_valid)
    or (e.paid_at is not null and not e.paid_valid) or (e.shipped_at is not null and not e.shipped_valid)
    then 'timing_incomplete' end,
   case when (e.status in ('shipped','completed') or e.shipped_valid) and nullif(btrim(e.tracking_number),'') is null then 'tracking_missing' end,
   case when e.status in ('paid','processing') and e.ordered_units is null then 'quantity_unknown' end,
   case when e.refunded_cents>e.settled then 'refund_transfer_pending' end
  ],null)::text[] issues
  from enriched e
 )
 select e.id,e.status,jsonb_build_object(
  'id',e.id,'order_number',e.order_number,'status',e.status,'customer_name',e.customer_name,'customer_email',e.customer_email,
  'total_cents',e.total_cents,'refunded_cents',e.refunded_cents,'refund_settled_cents',e.settled,
  'created_at',case when isfinite(e.created_at) then e.created_at end,
  'paid_at',case when isfinite(e.paid_at) then e.paid_at end,
  'shipped_at',case when isfinite(e.shipped_at) then e.shipped_at end,
  'payment_method',e.payment_method,'payment_ref',e.payment_ref,'tracking_number',e.tracking_number,
  'shipping_method',e.shipping,'destination',nullif(concat_ws(' ',coalesce(nullif(btrim(e.shipping_address->>'suburb'),''),e.shipping_address->>'city'),e.shipping_address->>'state'),''),
  'line_count',e.line_count,'items',e.summaries,'ordered_physical_units',e.ordered_units,'remaining_physical_units',e.remaining_units,
  'waiting_seconds',case when e.status='pending' and e.created_at<=p_as_of and isfinite(e.created_at) then extract(epoch from p_as_of-e.created_at)
    when e.status in ('paid','processing') and e.paid_valid and e.shipped_at is null then extract(epoch from p_as_of-e.paid_at) else null end,
  'issue_keys',to_jsonb(e.issues),'has_notes',nullif(btrim(e.notes),'') is not null)
 from flagged e;
end $$;

-- Internal shared presentation of the same scoped facts. Sorting is allowlisted;
-- no user-controlled SQL identifiers or dynamic SQL is involved.
create function public.admin_order_workspace_result(p_filters jsonb,p_as_of timestamptz,p_export boolean)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;v_sort text:=coalesce(p_filters->>'sort','created_at');v_dir text:=coalesce(p_filters->>'dir','desc');
begin
 with scoped as materialized(select * from admin_order_workspace_scope(p_filters,p_as_of)),
 filtered as (
  select s.* from scoped s where admin_order_workspace_matches_view(s.status,
   array(select jsonb_array_elements_text(s.facts->'issue_keys')),coalesce(p_filters->>'status','all'))
 ), bounds as (
  select count(*)::int total,least(coalesce((p_filters->>'page')::int,1),greatest(1,ceil(count(*)/25.0)::int)) page from filtered
 ), ranked as (
  select f.*,row_number() over(order by
   case when v_dir='asc' and v_sort in ('created_at','paid_at') then (f.facts->>v_sort)::timestamptz end asc nulls last,
   case when v_dir='desc' and v_sort in ('created_at','paid_at') then (f.facts->>v_sort)::timestamptz end desc nulls last,
   case when v_dir='asc' and v_sort in ('waiting_seconds','total_cents') then (f.facts->>v_sort)::numeric end asc nulls last,
   case when v_dir='desc' and v_sort in ('waiting_seconds','total_cents') then (f.facts->>v_sort)::numeric end desc nulls last,
   case when v_dir='asc' and v_sort in ('order_number','status') then f.facts->>v_sort end asc nulls last,
   case when v_dir='desc' and v_sort in ('order_number','status') then f.facts->>v_sort end desc nulls last,
   f.order_id asc) position from filtered f
 ), selected as (
  select r.* from ranked r cross join bounds b where
   (p_export and r.position<=20000) or (not p_export and r.position>(b.page-1)*25 and r.position<=b.page*25)
 ), counts as (
  select jsonb_object_agg(v.view, (select count(*) from scoped s where admin_order_workspace_matches_view(s.status,
    array(select jsonb_array_elements_text(s.facts->'issue_keys')),v.view))) data
  from unnest(array['all','to_fulfil','needs_attention','pending','paid','processing','shipped','completed','refunded','cancelled']) v(view)
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(case when p_export then jsonb_set(s.facts,'{items}','[]'::jsonb) else s.facts end order by s.position) from selected s),'[]'::jsonb),
  'total',b.total,'page',b.page,'page_size',25,'counts',c.data,'as_of',p_as_of) into result from bounds b cross join counts c;
 if p_export and (result->>'total')::int>20000 then raise exception 'ORDER_EXPORT_TOO_LARGE';end if;
 return result;
end $$;

create function public.admin_order_workspace(p_filters jsonb,p_as_of timestamptz default now())
returns jsonb language sql stable security definer set search_path=public as $$
 select admin_order_workspace_result(p_filters,p_as_of,false);
$$;
create function public.admin_order_workspace_export(p_filters jsonb,p_as_of timestamptz default now())
returns jsonb language sql stable security definer set search_path=public as $$
 select admin_order_workspace_result(p_filters,p_as_of,true);
$$;
revoke all on function public.admin_order_workspace_matches_view(text,text[],text),public.admin_order_workspace_scope(jsonb,timestamptz,uuid[]),public.admin_order_workspace_result(jsonb,timestamptz,boolean),public.admin_order_workspace(jsonb,timestamptz),public.admin_order_workspace_export(jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_order_workspace_matches_view(text,text[],text),public.admin_order_workspace_scope(jsonb,timestamptz,uuid[]),public.admin_order_workspace_result(jsonb,timestamptz,boolean),public.admin_order_workspace(jsonb,timestamptz),public.admin_order_workspace_export(jsonb,timestamptz) to service_role;
