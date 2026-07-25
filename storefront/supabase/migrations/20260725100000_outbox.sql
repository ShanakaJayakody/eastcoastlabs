-- East Coast Labs — transactional email outbox (Phase C/D).
-- The deterministic seam between "something happened" and "a customer was emailed".
-- Admin actions and the back-in-stock automation write rows here; a sender
-- (Resend, wired in a later phase) drains status='queued'. Making this a table
-- rather than a direct API call means every notification is auditable, retryable,
-- and verifiable in tests without sending real mail.

create table if not exists public.email_outbox (
  id          uuid primary key default gen_random_uuid(),
  to_email    text not null,
  template    text not null,             -- 'order_confirmation' | 'order_shipped' | 'back_in_stock' | ...
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'queued' check (status in ('queued','sent','failed')),
  error       text,
  related_type text,                     -- 'order' | 'product_variant'
  related_id  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists email_outbox_status_idx on public.email_outbox (status, created_at);
create index if not exists email_outbox_related_idx on public.email_outbox (related_type, related_id);

alter table public.email_outbox enable row level security;
grant all on public.email_outbox to service_role;
