-- East Coast Labs — partial refunds, abandoned-cart recovery, product images.
--
-- Design notes (from FirstPrinciples + SystemsThinking review):
--   * Partial refunds track refunded_qty/refunded_cents PER LINE — "how much is
--     left to refund" is always read from these columns, never trusted from a
--     caller. Full-refund status is a DERIVED fact (sum check), not a second flag.
--   * cart_sessions is keyed unique(email) — a fresh capture overwrites the prior
--     snapshot rather than accumulating duplicate rows. Recovery is capped to ONE
--     send ever (reminder_sent_at not null = permanently excluded); the SAME-email
--     completed-order case is suppressed via status='recovered'. A DIFFERENT email
--     at checkout cannot be matched — that's a structural limit of email-only
--     identity, documented rather than half-solved.
--   * email_outbox gets a dedupe unique index so the same notification can never
--     be queued twice, closing the race SystemsThinking found in queueBackInStock
--     (select-then-loop-then-update is not atomic; the code fix uses UPDATE...
--     RETURNING as an atomic claim instead).

-- ---------------------------------------------------------------------------
-- Partial refunds
-- ---------------------------------------------------------------------------
alter table public.order_items add column if not exists refunded_qty int not null default 0 check (refunded_qty >= 0);
alter table public.order_items add column if not exists refunded_cents int not null default 0 check (refunded_cents >= 0);
alter table public.orders add column if not exists refunded_cents int not null default 0 check (refunded_cents >= 0);

alter table public.order_events drop constraint if exists order_events_type_check;
alter table public.order_events add constraint order_events_type_check
  check (type in ('created','status','note','email','payment','stock','refund','edit'));

-- ---------------------------------------------------------------------------
-- Abandoned-cart recovery
-- ---------------------------------------------------------------------------
create table if not exists public.cart_sessions (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  cart              jsonb not null default '[]'::jsonb,
  subtotal_cents    int not null default 0,
  status            text not null default 'active' check (status in ('active','recovered','abandoned')),
  recovered_order_id uuid references public.orders(id),
  reminder_sent_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists cart_sessions_active_idx on public.cart_sessions (status, reminder_sent_at, updated_at);

alter table public.cart_sessions enable row level security;
grant all on public.cart_sessions to service_role;

-- ---------------------------------------------------------------------------
-- Product images bucket (public, same pattern as the `coa` bucket)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Outbox dedupe — never queue the identical notification twice
-- ---------------------------------------------------------------------------
create unique index if not exists email_outbox_dedupe_idx
  on public.email_outbox (to_email, template, coalesce(related_id, ''));
