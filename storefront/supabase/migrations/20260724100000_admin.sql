-- East Coast Labs — admin foundation (Phase A).
-- admin_users: allow-list gating who may access /admin (checked server-side after
--   a valid Supabase Auth session). admin_audit_log: append-only trail of every
--   admin mutation. Both are RLS default-deny: NO anon/authenticated policies, so
--   the public/anon key sees zero rows. All admin access goes through the server
--   (service_role), which bypasses RLS after the app has verified session + allow-list.

-- ---------------------------------------------------------------------------
-- admin_users — the allow-list. Presence here + a valid auth session = admin.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  name       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
-- No anon/authenticated policies => default deny. Server uses service_role.
grant all on public.admin_users to service_role;

-- Seed the operator so the login flow is testable end-to-end. Idempotent.
insert into public.admin_users (email, name)
values ('admin@omthentic.ai', 'ECL Operator')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- admin_audit_log — append-only. Every admin mutation writes one row.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action      text not null,               -- e.g. 'login', 'order.status', 'stock.adjust'
  entity_type text,                        -- e.g. 'order', 'product_variant'
  entity_id   text,
  diff        jsonb,                        -- { before, after } where relevant
  created_at  timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_entity_idx on public.admin_audit_log (entity_type, entity_id);

alter table public.admin_audit_log enable row level security;
-- Default deny for anon/authenticated; server-only writes/reads via service_role.
grant all on public.admin_audit_log to service_role;
