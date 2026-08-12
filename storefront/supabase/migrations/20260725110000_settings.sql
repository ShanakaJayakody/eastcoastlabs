-- East Coast Labs — store settings (Phase E).
-- Key/value so marketing levers (announcement bar, reward thresholds, store
-- details) are editable in /admin/settings without a developer or a deploy.

create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

alter table public.settings enable row level security;
grant all on public.settings to service_role;

-- Seed the current hardcoded values so the admin form opens populated and the
-- storefront renders identically before anyone edits anything.
insert into public.settings (key, value) values
  ('announcement_items', '[
     "🛡️ 98%+ purity guaranteed — or refund/replace",
     "🚚 Free shipping over $150",
     "⚡ 1-business-day dispatch from AU",
     "🤐 Discreet packaging & billing"
   ]'::jsonb),
  ('free_shipping_threshold', '150'::jsonb),
  ('gift_threshold', '250'::jsonb),
  ('support_email', '"eclpeptides@gmail.com"'::jsonb)
on conflict (key) do nothing;
