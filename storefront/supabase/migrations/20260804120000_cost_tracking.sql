-- East Coast Labs — cost & margin tracking.
--
-- Design (mirrors the stock model: costs are per VIAL, one pool per product):
--   * products.unit_cost_cents  — current weighted-average cost of ONE vial.
--   * stock_movements.unit_cost_cents — what was actually paid per vial on a
--     'received' movement. The ledger is already append-only and trusted, so it
--     doubles as the purchase-price history. Never back-dated.
--   * order_items.unit_cost_cents — COGS SNAPSHOT taken at payment. Frozen so
--     historical profit never silently changes when a supplier price moves.
--
-- Costing method: weighted average, recomputed on receipt. FIFO lot tracking is
-- overkill at this catalogue size, and weighted average is what an accountant
-- expects for small retail.

alter table public.products
  add column if not exists unit_cost_cents int
    check (unit_cost_cents is null or unit_cost_cents >= 0);

comment on column public.products.unit_cost_cents is
  'Current weighted-average cost of one vial, in cents. Admin-only; never exposed to shoppers.';

alter table public.stock_movements
  add column if not exists unit_cost_cents int
    check (unit_cost_cents is null or unit_cost_cents >= 0);

comment on column public.stock_movements.unit_cost_cents is
  'Purchase price per vial for a ''received'' movement. The buying history.';

alter table public.order_items
  add column if not exists unit_cost_cents int
    check (unit_cost_cents is null or unit_cost_cents >= 0);

comment on column public.order_items.unit_cost_cents is
  'COGS snapshot per unit sold (cost per vial x pack_size), frozen at payment.';

-- Weighted-average recompute, run after a costed receipt is appended.
-- new_avg = (vials_before * old_avg + received_vials * paid_cost) / total_vials
-- Falls back to the paid cost when there is no prior stock or no prior average.
create or replace function public.recompute_unit_cost(
  p_product uuid,
  p_received_vials int,
  p_paid_cost_cents int
) returns int language plpgsql as $$
declare
  v_pool_variant uuid;
  v_vials_before int;
  v_old_cost int;
  v_new_cost int;
begin
  select pv.id into v_pool_variant
    from public.product_variants pv
   where pv.product_id = p_product and pv.pack_size = 1
   limit 1;

  -- Stock level BEFORE this receipt (the movement has already been applied).
  select greatest(0, coalesce(i.on_hand, 0) - p_received_vials) into v_vials_before
    from public.inventory i
   where i.variant_id = v_pool_variant;

  select unit_cost_cents into v_old_cost from public.products where id = p_product;

  if v_old_cost is null or coalesce(v_vials_before, 0) <= 0 then
    v_new_cost := p_paid_cost_cents;
  else
    v_new_cost := round(
      ((v_vials_before::numeric * v_old_cost) + (p_received_vials::numeric * p_paid_cost_cents))
      / nullif(v_vials_before + p_received_vials, 0)
    );
  end if;

  update public.products
     set unit_cost_cents = v_new_cost, updated_at = now()
   where id = p_product;

  return v_new_cost;
end $$;

grant execute on function public.recompute_unit_cost(uuid, int, int) to service_role;
