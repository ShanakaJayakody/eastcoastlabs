-- East Coast Labs — commerce backbone (Phase B).
-- products / product_variants (1·3·6 vial tiers) / inventory / stock_movements
-- (append-only ledger) / orders / order_items / order_events / discounts.
--
-- Design (from FirstPrinciples + SystemsThinking):
--   * on_hand is NEVER authored — it is the running sum of stock_movements,
--     maintained by an AFTER INSERT trigger. Correcting stock = append a movement.
--   * reserved is a separate claim on availability; available = on_hand - reserved.
--   * Stock is decremented on PAYMENT, not on order-create (Bankful is slow/manual);
--     the reservation is authoritative until paid. Every transition is idempotent
--     via orders.stock_reserved / stock_settled / stock_restored guard flags.
--   * The concurrent last-unit race is closed by reserve_stock(): an atomic
--     conditional UPDATE that only succeeds when available >= qty.
--
-- All tables RLS default-deny (no anon/authenticated policies); the Next.js server
-- reads/writes via service_role, which bypasses RLS after requireAdmin().

-- ===========================================================================
-- products
-- ===========================================================================
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  sku               text unique,
  compound          text,
  short_description text,
  description       text,
  images            jsonb not null default '[]'::jsonb,
  categories        jsonb not null default '[]'::jsonb,
  status            text not null default 'active' check (status in ('active','draft','archived')),
  seo_title         text,
  seo_description   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.products enable row level security;
grant all on public.products to service_role;

-- ===========================================================================
-- product_variants — the purchasable pack tiers (1 vial / 3-pack / 6-pack)
-- ===========================================================================
create table if not exists public.product_variants (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products(id) on delete cascade,
  sku              text not null unique,
  pack_size        int  not null check (pack_size > 0),
  label            text not null,
  price_cents      int  not null check (price_cents >= 0),
  compare_at_cents int  check (compare_at_cents is null or compare_at_cents >= 0),
  subscribe_pct    int  not null default 0 check (subscribe_pct between 0 and 100),
  position         int  not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (product_id, pack_size)
);
create index if not exists product_variants_product_idx on public.product_variants (product_id);
alter table public.product_variants enable row level security;
grant all on public.product_variants to service_role;

-- ===========================================================================
-- inventory — one row per variant. on_hand is derived (see trigger below).
-- ===========================================================================
create table if not exists public.inventory (
  variant_id           uuid primary key references public.product_variants(id) on delete cascade,
  on_hand              int not null default 0,
  reserved             int not null default 0 check (reserved >= 0),
  low_stock_threshold  int not null default 5,
  updated_at           timestamptz not null default now()
);
alter table public.inventory enable row level security;
grant all on public.inventory to service_role;

-- ===========================================================================
-- stock_movements — APPEND-ONLY ledger. on_hand = sum(qty) per variant.
-- ===========================================================================
create table if not exists public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references public.product_variants(id) on delete cascade,
  qty         int  not null,  -- signed: +received/+return, -sale, ± adjustment
  reason      text not null check (reason in ('received','sale','return','adjustment','recount')),
  actor_email text,
  order_id    uuid,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists stock_movements_variant_idx on public.stock_movements (variant_id, created_at);
alter table public.stock_movements enable row level security;
grant all on public.stock_movements to service_role;

-- Trigger: every inserted movement adjusts inventory.on_hand by its (signed) qty,
-- so on_hand is always exactly the sum of the ledger. This is the invariant.
create or replace function public.apply_stock_movement()
returns trigger language plpgsql as $$
begin
  insert into public.inventory (variant_id, on_hand)
  values (NEW.variant_id, NEW.qty)
  on conflict (variant_id)
  do update set on_hand = public.inventory.on_hand + NEW.qty, updated_at = now();
  return NEW;
end $$;

drop trigger if exists trg_apply_stock_movement on public.stock_movements;
create trigger trg_apply_stock_movement
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- Atomic reservation: succeeds (returns true) only if available >= p_qty.
-- The conditional UPDATE takes a row lock, closing the last-unit race.
create or replace function public.reserve_stock(p_variant uuid, p_qty int)
returns boolean language plpgsql as $$
begin
  update public.inventory
     set reserved = reserved + p_qty, updated_at = now()
   where variant_id = p_variant
     and (on_hand - reserved) >= p_qty;
  return found;
end $$;

-- Release a reservation (cancel, or conversion to a sale). Never goes below 0.
create or replace function public.release_stock(p_variant uuid, p_qty int)
returns void language plpgsql as $$
begin
  update public.inventory
     set reserved = greatest(0, reserved - p_qty), updated_at = now()
   where variant_id = p_variant;
end $$;

grant execute on function public.reserve_stock(uuid, int) to service_role;
grant execute on function public.release_stock(uuid, int) to service_role;

-- ===========================================================================
-- orders
-- ===========================================================================
create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique default ('ECL-' || nextval('public.order_number_seq')),
  status           text not null default 'pending'
                     check (status in ('pending','paid','processing','shipped','completed','cancelled','refunded')),
  customer_email   text not null,
  customer_name    text,
  shipping_address jsonb,
  subtotal_cents   int not null default 0,
  discount_cents   int not null default 0,
  shipping_cents   int not null default 0,
  total_cents      int not null default 0,
  discount_code    text,
  payment_method   text,
  payment_ref      text,
  currency         text not null default 'AUD',
  -- idempotency guards for the reserve → settle → restore handshake
  stock_reserved   boolean not null default false,
  stock_settled    boolean not null default false,
  stock_restored   boolean not null default false,
  tracking_number  text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  paid_at          timestamptz,
  shipped_at       timestamptz
);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_email_idx on public.orders (customer_email);
alter table public.orders enable row level security;
grant all on public.orders to service_role;
grant usage on sequence public.order_number_seq to service_role;

create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  variant_id       uuid references public.product_variants(id),
  product_slug     text,
  product_name     text,
  variant_label    text,
  sku              text,
  unit_price_cents int not null check (unit_price_cents >= 0),
  qty              int not null check (qty > 0),
  line_total_cents int not null check (line_total_cents >= 0)
);
create index if not exists order_items_order_idx on public.order_items (order_id);
alter table public.order_items enable row level security;
grant all on public.order_items to service_role;

create table if not exists public.order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  type        text not null check (type in ('created','status','note','email','payment','stock')),
  from_status text,
  to_status   text,
  message     text,
  actor_email text,
  created_at  timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);
alter table public.order_events enable row level security;
grant all on public.order_events to service_role;

-- ===========================================================================
-- discounts
-- ===========================================================================
create table if not exists public.discounts (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  kind            text not null check (kind in ('percent','fixed')),
  percent         int  check (percent is null or percent between 1 and 100),
  value_cents     int  check (value_cents is null or value_cents >= 0),
  min_spend_cents int  not null default 0,
  usage_limit     int,
  used_count      int  not null default 0,
  starts_at       timestamptz,
  expires_at      timestamptz,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  check ((kind = 'percent' and percent is not null) or (kind = 'fixed' and value_cents is not null))
);
alter table public.discounts enable row level security;
grant all on public.discounts to service_role;

-- WELCOME10 — the code the storefront exit-intent modal already promises.
insert into public.discounts (code, kind, percent, min_spend_cents)
values ('WELCOME10', 'percent', 10, 0)
on conflict (code) do nothing;

-- ===========================================================================
-- customers — derived view: history + lifetime value per email.
-- ===========================================================================
create or replace view public.customers as
select
  customer_email                                                          as email,
  max(customer_name)                                                      as name,
  count(*) filter (where status <> 'cancelled')                          as orders_count,
  coalesce(sum(total_cents) filter (
    where status in ('paid','processing','shipped','completed')), 0)      as ltv_cents,
  min(created_at)                                                         as first_order_at,
  max(created_at)                                                         as last_order_at
from public.orders
group by customer_email;

grant select on public.customers to service_role;
