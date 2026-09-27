-- The Orders tabs retain their search, date and discount scope. Count their
-- groups in one database statement so each badge represents that same scope.
create or replace function public.admin_order_status_counts(
  p_search text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_discount text default null
)
returns table(status text, count bigint)
language sql stable security invoker set search_path=public as $$
  select o.status, count(*)::bigint
  from public.orders o
  where (p_search is null
    or o.order_number ilike '%' || p_search || '%'
    or o.customer_email ilike '%' || p_search || '%'
    or o.customer_name ilike '%' || p_search || '%')
    and (p_from is null or o.created_at >= p_from)
    and (p_to is null or o.created_at < p_to)
    and (p_discount is null or lower(coalesce(o.discount_code, '')) = lower(p_discount))
  group by o.status
  order by o.status;
$$;

revoke all on function public.admin_order_status_counts(text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.admin_order_status_counts(text,timestamptz,timestamptz,text) to service_role;
