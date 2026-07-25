-- Fix: the previous dedupe index used an expression (coalesce(related_id, ''))
-- as its third key, which Postgres cannot match against a plain-column
-- ON CONFLICT (to_email, template, related_id) clause — every queueEmail() call
-- errored with "no unique or exclusion constraint matching the ON CONFLICT
-- specification". Replace with a real unique index on the exact columns.
--
-- Every current caller always supplies related_id (verified across all queueEmail
-- call sites), so the NULL-never-conflicts edge case doesn't arise in practice.
drop index if exists public.email_outbox_dedupe_idx;
create unique index if not exists email_outbox_dedupe_idx
  on public.email_outbox (to_email, template, related_id);
