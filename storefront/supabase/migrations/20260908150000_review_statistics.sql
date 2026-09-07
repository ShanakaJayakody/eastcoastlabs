-- Aggregate in PostgreSQL; public review metadata never exposes buyer/order IDs.
create index reviews_published_recent_idx on public.reviews(product_slug,created_at desc) where status='published';
create function public.review_statistics(p_slugs text[] default null)
returns table(product_slug text,rating numeric,count bigint)
language sql stable security definer set search_path=public as $$
 select product_slug,round(avg(rating),1),count(*) from reviews
 where status='published' and (p_slugs is null or product_slug=any(p_slugs))
 group by rollup(product_slug) having count(*)>0;
$$;
revoke all on function public.review_statistics(text[]) from public,anon,authenticated;
grant execute on function public.review_statistics(text[]) to service_role;
