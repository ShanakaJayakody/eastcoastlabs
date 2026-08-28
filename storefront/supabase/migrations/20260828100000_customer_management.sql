-- East Coast Labs — customer management (Phases A + B of CUSTOMER_MANAGEMENT_PLAN.md).
--
-- The journey timeline and sequence steppers need NO new tracking tables: every
-- touch already lives in email_outbox and every sweep is a deterministic function
-- of its source row's age. What this migration adds is only what cannot be
-- derived — operator intent (notes, tags, pauses) and the ability to cancel a
-- queued send before the drain picks it up.

-- ---------------------------------------------------------------------------
-- customer_notes — append-only operator notes against an email identity.
-- Keyed on email, not customer id, because the people we care about include
-- subscribers and cart abandoners who have no row in the customers view.
-- ---------------------------------------------------------------------------
create table if not exists public.customer_notes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  note        text not null,
  actor_email text not null,
  created_at  timestamptz not null default now()
);
create index if not exists customer_notes_email_idx
  on public.customer_notes (email, created_at desc);

alter table public.customer_notes enable row level security;
grant all on public.customer_notes to service_role;

-- ---------------------------------------------------------------------------
-- customer_profiles — operator-owned attributes for an email identity.
-- public.customers is a VIEW over orders, so it cannot carry columns; profile
-- data needs its own table.
-- ---------------------------------------------------------------------------
create table if not exists public.customer_profiles (
  email      text primary key,
  tags       text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;
grant all on public.customer_profiles to service_role;

-- ---------------------------------------------------------------------------
-- sequence_overrides — operator intent that the idempotent sweeps consult.
--
-- Deliberately NOT a state machine. A sweep still decides what is due purely
-- from source-row age; this table only answers "is this (email, sequence)
-- paused?". One row per pause, deleted on resume. Because windows keep aging
-- while paused, a touch whose window closes during a pause is missed rather
-- than replayed — the UI states this explicitly.
-- ---------------------------------------------------------------------------
create table if not exists public.sequence_overrides (
  email       text not null,
  sequence    text not null,   -- 'cart_recovery' | 'payment_reminders' | 'welcome' | 'replenishment' | 'winback' | 'second_purchase' | 'post_purchase_review'
  action      text not null default 'pause' check (action in ('pause')),
  actor_email text not null,
  reason      text,
  created_at  timestamptz not null default now(),
  primary key (email, sequence)
);
create index if not exists sequence_overrides_sequence_idx
  on public.sequence_overrides (sequence, created_at desc);

alter table public.sequence_overrides enable row level security;
grant all on public.sequence_overrides to service_role;

-- ---------------------------------------------------------------------------
-- email_outbox — 'cancelled' status.
--
-- Two uses: killing a queued row before the drain sends it, and recording a
-- deliberately skipped stage. The second is why cancellation matters beyond
-- convenience — a cancelled row still occupies the (to_email, template,
-- related_id) dedupe slot, so writing one is how "skip this touch" becomes
-- durable without inventing a parallel skip table.
-- ---------------------------------------------------------------------------
alter table public.email_outbox drop constraint if exists email_outbox_status_check;
alter table public.email_outbox add constraint email_outbox_status_check
  check (status in ('queued', 'sent', 'failed', 'cancelled'));

-- Correlates an outbox row with the provider's message id, so Phase C webhooks
-- (delivered/opened/clicked/bounced) can attach engagement back to the send.
alter table public.email_outbox
  add column if not exists provider_message_id text;
create index if not exists email_outbox_provider_msg_idx
  on public.email_outbox (provider_message_id);

-- Journey queries always read one person's entire history, newest first.
create index if not exists email_outbox_to_email_idx
  on public.email_outbox (to_email, created_at desc);
