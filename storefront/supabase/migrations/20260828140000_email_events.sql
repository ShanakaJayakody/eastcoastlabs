-- East Coast Labs — email engagement events (Phase C of CUSTOMER_MANAGEMENT_PLAN.md).
--
-- The outbox records what we SENT. This records what happened next: delivered,
-- opened, clicked, bounced, complained — as reported by Resend's webhooks.
-- Kept as a separate append-only table rather than columns on email_outbox
-- because one send produces many events (and the same event can be redelivered
-- by the provider, so the shape has to tolerate repeats).

create table if not exists public.email_events (
  id          uuid primary key default gen_random_uuid(),
  outbox_id   uuid references public.email_outbox(id) on delete cascade,
  to_email    text not null,
  event       text not null check (event in ('delivered','opened','clicked','bounced','complained','delayed')),
  -- Provider's own event id. Webhooks are at-least-once: the same event WILL
  -- arrive twice eventually, and this is what makes the second one a no-op.
  provider_event_id text,
  detail      jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create unique index if not exists email_events_dedupe_idx
  on public.email_events (provider_event_id)
  where provider_event_id is not null;

create index if not exists email_events_outbox_idx on public.email_events (outbox_id);
create index if not exists email_events_email_idx on public.email_events (to_email, occurred_at desc);

alter table public.email_events enable row level security;
grant all on public.email_events to service_role;
