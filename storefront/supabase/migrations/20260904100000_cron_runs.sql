-- Cron run history.
--
-- Vercel cron is fire-and-forget: if a sweep stops running, nothing anywhere
-- says so, and the first sign is a customer asking why they never got an email.
-- One row per invocation makes "did it run, and did it work" answerable.
--
-- Purely additive: creates one new table and touches nothing that exists.

create table if not exists public.cron_runs (
  id          uuid primary key default gen_random_uuid(),
  job         text not null,                    -- 'email-outbox' | 'lifecycle' | ...
  status      text not null check (status in ('ok','failed')),
  -- Whatever the job counts as work done, e.g. { sent: 12, failed: 0 }.
  detail      jsonb not null default '{}'::jsonb,
  error       text,
  duration_ms integer,
  created_at  timestamptz not null default now()
);

create index if not exists cron_runs_job_idx on public.cron_runs (job, created_at desc);

alter table public.cron_runs enable row level security;
-- No anon/authenticated policies: only the service role reads or writes this.
grant all on public.cron_runs to service_role;
