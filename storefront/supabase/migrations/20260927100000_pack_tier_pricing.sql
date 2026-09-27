-- One global pack policy: 3-packs are 10% off and 6-packs are 15% off.
-- Pack totals are rounded down to whole AUD dollars, matching the published
-- catalogue convention. Each pack still consumes the equivalent single-vial
-- stock pool; only the sell price is changed here.

with single_variants as (
  select product_id, price_cents as single_price_cents
  from public.product_variants
  where pack_size = 1
)
update public.product_variants as pack
set
  price_cents = floor(
    (single_variants.single_price_cents::numeric / 100)
    * pack.pack_size
    * case pack.pack_size when 3 then 0.90 else 0.85 end
  )::int * 100,
  compare_at_cents = single_variants.single_price_cents * pack.pack_size,
  label = case pack.pack_size when 3 then '3-pack' else '6-pack' end,
  position = case pack.pack_size when 3 then 1 else 2 end
from single_variants
where pack.product_id = single_variants.product_id
  and pack.pack_size in (3, 6);

-- Bacteriostatic water was the one remaining single-vial catalog product.
-- Upsert so the migration is safe on databases where an operator added a tier
-- before this rollout.
insert into public.product_variants (
  product_id, sku, pack_size, label, price_cents, compare_at_cents, position
)
select
  water.id,
  coalesce(nullif(water.sku, ''), 'ECL-BACWATER') || '-3',
  3,
  '3-pack',
  floor((single.price_cents::numeric / 100) * 3 * 0.90)::int * 100,
  single.price_cents * 3,
  1
from public.products as water
join public.product_variants as single
  on single.product_id = water.id and single.pack_size = 1
where water.slug = 'bacteriostatic-water'
on conflict (product_id, pack_size) do update
set
  price_cents = excluded.price_cents,
  compare_at_cents = excluded.compare_at_cents,
  label = excluded.label,
  position = excluded.position,
  active = true;

insert into public.product_variants (
  product_id, sku, pack_size, label, price_cents, compare_at_cents, position
)
select
  water.id,
  coalesce(nullif(water.sku, ''), 'ECL-BACWATER') || '-6',
  6,
  '6-pack',
  floor((single.price_cents::numeric / 100) * 6 * 0.85)::int * 100,
  single.price_cents * 6,
  2
from public.products as water
join public.product_variants as single
  on single.product_id = water.id and single.pack_size = 1
where water.slug = 'bacteriostatic-water'
on conflict (product_id, pack_size) do update
set
  price_cents = excluded.price_cents,
  compare_at_cents = excluded.compare_at_cents,
  label = excluded.label,
  position = excluded.position,
  active = true;
