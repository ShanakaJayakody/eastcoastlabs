-- Lot registration aggregates retained paid-order capacity by physical pool.
create index deleted_order_stock_capacity_pool_idx
  on public.deleted_order_stock_capacity(pool_variant_id);
