-- Public review content is readable; the linked private order identity is not.
-- Column grants also ensure future columns remain private by default.
revoke select on public.reviews from anon, authenticated;
grant select (id, product_slug, author, location, rating, title, body, verified, status, is_sample, created_at)
  on public.reviews to anon, authenticated;
