-- Fix the email_events dedupe index.
--
-- The original index was partial (`where provider_event_id is not null`), which
-- Postgres will not accept as the arbiter for `ON CONFLICT (provider_event_id)`
-- — the inference requires an index whose predicate matches. The upsert failed
-- on every webhook delivery while the route still answered 200, so events were
-- being dropped silently.
--
-- A plain unique index is the right shape anyway: Postgres treats NULLs as
-- distinct, so rows with no provider event id are still allowed to coexist.

drop index if exists public.email_events_dedupe_idx;
create unique index if not exists email_events_dedupe_idx
  on public.email_events (provider_event_id);
