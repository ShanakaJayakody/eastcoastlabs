-- East Coast Labs — initial schema.
-- Project created with "Automatically expose new tables" OFF, so we GRANT the
-- Data API roles (anon/authenticated) explicitly per table, and RLS gates rows.
-- The service_role (used by the Next.js server for writes) bypasses RLS.

-- ---------------------------------------------------------------------------
-- reviews — customer product reviews (public read of published rows only)
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  product_slug text not null,
  author       text not null,
  location     text,
  rating       int  not null check (rating between 1 and 5),
  title        text not null,
  body         text not null,
  verified     boolean not null default false,
  status       text not null default 'published' check (status in ('pending','published','rejected')),
  is_sample    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists reviews_product_slug_idx on public.reviews (product_slug);
create index if not exists reviews_status_idx on public.reviews (status);

alter table public.reviews enable row level security;
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews
  for select using (status = 'published');

grant select on public.reviews to anon, authenticated;
grant all on public.reviews to service_role;

-- ---------------------------------------------------------------------------
-- subscribers — newsletter / exit-intent captures (server-write only)
-- ---------------------------------------------------------------------------
create table if not exists public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text,
  created_at timestamptz not null default now(),
  unique (email, source)
);
alter table public.subscribers enable row level security;
-- No anon/authenticated policies: writes go through the server (service_role).
grant all on public.subscribers to service_role;

-- ---------------------------------------------------------------------------
-- stock_notifications — back-in-stock requests (server-write only)
-- ---------------------------------------------------------------------------
create table if not exists public.stock_notifications (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  product_slug text not null,
  notified     boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (email, product_slug)
);
alter table public.stock_notifications enable row level security;
grant all on public.stock_notifications to service_role;

-- ---------------------------------------------------------------------------
-- coa_batches — published Certificates of Analysis (public read)
-- ---------------------------------------------------------------------------
create table if not exists public.coa_batches (
  id             uuid primary key default gen_random_uuid(),
  batch_id       text not null unique,
  compound       text not null,
  purity_pct     numeric(5,2) not null,
  lab            text not null default 'JanoShik',
  test_date      date not null,
  coa_url        text,
  lab_verify_url text,
  created_at     timestamptz not null default now()
);
create index if not exists coa_batches_test_date_idx on public.coa_batches (test_date desc);

alter table public.coa_batches enable row level security;
drop policy if exists "coa public read" on public.coa_batches;
create policy "coa public read" on public.coa_batches
  for select using (true);

grant select on public.coa_batches to anon, authenticated;
grant all on public.coa_batches to service_role;

-- ---------------------------------------------------------------------------
-- Storage: public bucket for COA PDFs
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('coa', 'coa', true)
on conflict (id) do nothing;
