-- Capture must run before any catalogue price increase. Prior migrations are immutable.
alter table public.discounts drop constraint discounts_kind_check;
alter table public.discounts drop constraint discounts_check;
alter table public.discounts add constraint discounts_kind_check
  check (kind in ('percent','fixed','legacy_price'));
alter table public.discounts add constraint discounts_value_check check (
  (kind='percent' and percent is not null)
  or (kind='fixed' and value_cents is not null)
  or (kind='legacy_price' and percent is null and value_cents is null)
);

create table public.legacy_discount_prices (
  discount_id uuid not null references public.discounts(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  price_cents integer not null check (price_cents >= 0),
  captured_at timestamptz not null default now(),
  primary key (discount_id,variant_id)
);
create index legacy_discount_prices_variant_idx on public.legacy_discount_prices(variant_id);

create table public.legacy_discount_customers (
  discount_id uuid not null references public.discounts(id) on delete restrict,
  email text not null check (email=lower(trim(email)) and length(email) between 3 and 254),
  source_order_id uuid not null references public.orders(id) on delete restrict,
  captured_at timestamptz not null default now(),
  primary key (discount_id,email)
);
create index legacy_discount_customers_email_idx on public.legacy_discount_customers(email);

-- Completion evidence survives even an empty capture. Applications cannot alter it.
create table public.legacy_discount_captures (
  code text primary key check (code='ECLLEGACY'),
  discount_id uuid not null unique references public.discounts(id) on delete restrict,
  captured_at timestamptz not null,
  variant_count integer not null check (variant_count >= 0),
  customer_count integer not null check (customer_count >= 0)
);

alter table public.order_items add column legacy_discount_eligible boolean not null default false;

alter table public.legacy_discount_prices enable row level security;
alter table public.legacy_discount_customers enable row level security;
alter table public.legacy_discount_captures enable row level security;
revoke all on public.legacy_discount_prices, public.legacy_discount_customers,
  public.legacy_discount_captures from public, anon, authenticated, service_role;
grant select, insert on public.legacy_discount_prices, public.legacy_discount_customers to service_role;
grant select on public.legacy_discount_captures to service_role;

create function public.legacy_snapshot_reject_mutation() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
  raise exception 'Legacy pricing snapshot is immutable';
end;
$$;
revoke all on function public.legacy_snapshot_reject_mutation() from public, anon, authenticated, service_role;
create trigger legacy_prices_immutable before update or delete on public.legacy_discount_prices
  for each row execute function public.legacy_snapshot_reject_mutation();
create trigger legacy_customers_immutable before update or delete on public.legacy_discount_customers
  for each row execute function public.legacy_snapshot_reject_mutation();
create trigger legacy_capture_immutable before update or delete on public.legacy_discount_captures
  for each row execute function public.legacy_snapshot_reject_mutation();

-- BEGIN ONE-SHOT CAPTURE
do $$
declare
  program_id uuid;
  capture_time timestamptz;
  price_count integer;
  email_count integer;
begin
  -- Serialize capture replays, then freeze source writes for a consistent cutoff.
  lock table public.legacy_discount_captures in exclusive mode;
  if exists(select 1 from public.legacy_discount_captures where code='ECLLEGACY') then
    return;
  end if;
  lock table public.discounts, public.products, public.product_variants, public.orders in share mode;
  if exists(select 1 from public.discounts where upper(trim(code))='ECLLEGACY') then
    raise exception 'Unexpected existing ECLLEGACY discount; snapshot aborted';
  end if;
  capture_time := clock_timestamp();
  insert into public.discounts(code,kind,min_spend_cents,usage_limit,starts_at,expires_at,active)
    values('ECLLEGACY','legacy_price',0,null,null,null,true) returning id into program_id;

  insert into public.legacy_discount_prices(discount_id,variant_id,price_cents,captured_at)
    select program_id,v.id,v.price_cents,capture_time
    from public.product_variants v join public.products p on p.id=v.product_id
    where v.active and p.status='active'
      and not exists(select 1 from public.legacy_discount_captures where code='ECLLEGACY')
    on conflict(discount_id,variant_id) do nothing;
  get diagnostics price_count = row_count;

  insert into public.legacy_discount_customers(discount_id,email,source_order_id,captured_at)
    select program_id,e.email,e.order_id,capture_time from (
      select distinct on (lower(trim(o.customer_email)))
        lower(trim(o.customer_email)) as email,o.id as order_id
      from public.orders o where o.status in ('paid','processing','shipped','completed')
      order by lower(trim(o.customer_email)),o.created_at,o.id
    ) e
    where not exists(select 1 from public.legacy_discount_captures where code='ECLLEGACY')
    on conflict(discount_id,email) do nothing;
  get diagnostics email_count = row_count;

  insert into public.legacy_discount_captures(code,discount_id,captured_at,variant_count,customer_count)
    values('ECLLEGACY',program_id,capture_time,price_count,email_count);
end;
$$;
-- END ONE-SHOT CAPTURE
