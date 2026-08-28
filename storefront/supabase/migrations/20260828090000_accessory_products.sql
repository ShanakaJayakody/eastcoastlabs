-- Accessories (syringes, swabs, reconstitution kit) become real, stocked
-- products. Until now they lived only in data/accessories.json and were written
-- to orders as variant_id NULL lines — invisible to the inventory ledger, so
-- admin had no stock view and they could sell forever.
--
-- Promoting them to products/product_variants means the ENTIRE existing stock
-- machinery applies unchanged: the movements ledger, reserve/release atomics,
-- the admin Products page, low-stock alerts. No parallel accessory subsystem.
--
-- The storefront still renders accessory copy/icons from accessories.json
-- (matched by slug); the DB is authoritative for price-at-checkout and stock.
-- Idempotent: slug/sku conflicts no-op, and opening stock only seeds when the
-- variant has no ledger history at all.

insert into public.products (slug, name, sku, status, categories, short_description)
values
  ('insulin-syringes',   'Insulin Syringes — 0.5ml',   'ACC-SYR-05', 'active', '["accessory"]'::jsonb, '29G ultra-fine · box of 10'),
  ('alcohol-swabs',      'Alcohol Prep Swabs',         'ACC-SWAB',   'active', '["accessory"]'::jsonb, 'Sterile 70% IPA · 100 pack'),
  ('reconstitution-kit', 'Reconstitution Starter Kit', 'ACC-KIT',    'active', '["accessory"]'::jsonb, 'Bac water + syringes + swabs')
on conflict (slug) do nothing;

-- One pack_size=1 variant each: an accessory unit (a box, a pack, a kit) is the
-- stock unit itself. Prices mirror accessories.json in cents.
insert into public.product_variants (product_id, sku, pack_size, label, price_cents)
select p.id, v.sku, 1, v.label, v.price_cents
from (values
  ('insulin-syringes',   'ACC-SYR-05-1', 'box of 10', 899),
  ('alcohol-swabs',      'ACC-SWAB-1',   '100 pack',  999),
  ('reconstitution-kit', 'ACC-KIT-1',    'kit',       3999)
) as v(slug, sku, label, price_cents)
join public.products p on p.slug = v.slug
on conflict (sku) do nothing;

-- Opening stock: 100 units per accessory, only for variants with NO ledger
-- history (so re-running apply.mjs never double-counts). 100 preserves the
-- pre-migration "always sellable" behaviour on deploy; recount to the real
-- shelf count from /admin/products.
insert into public.stock_movements (variant_id, qty, reason, note)
select pv.id, 100, 'received', 'Opening stock (accessory promoted from JSON) — recount to actual'
from public.product_variants pv
join public.products p on p.id = pv.product_id
where p.slug in ('insulin-syringes', 'alcohol-swabs', 'reconstitution-kit')
  and not exists (select 1 from public.stock_movements sm where sm.variant_id = pv.id);
