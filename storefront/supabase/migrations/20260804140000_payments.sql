-- East Coast Labs — PayID + bank transfer payment layer.
--
-- Bankful is scrapped. Payment is now customer-initiated: the order is created
-- in `pending`, the customer transfers via PayID or bank transfer quoting a
-- reference, and an admin confirms receipt (markPaid) which settles stock.
--
-- Three things this migration adds:
--   1. payment_reference — the string the customer quotes in their transfer.
--      Distinct from payment_ref (which records the bank's own receipt id after
--      the fact). This is what we ASK for; payment_ref is what we GOT.
--   2. payment_expires_at + reminder bookkeeping — the unpaid-order lifecycle.
--      Without an expiry, unpaid orders hold reserved stock forever.
--   3. Payment settings rows — PayID identifier, BSB, account number, and the
--      hold window, all admin-editable so go-live doesn't need a deploy.

alter table public.orders
  add column if not exists payment_reference   text,
  add column if not exists payment_expires_at  timestamptz,
  add column if not exists payment_reminders_sent int not null default 0,
  add column if not exists last_reminder_at    timestamptz;

-- The reference is what an incoming transfer is matched on, so it must be
-- unique. Partial index: only enforced where a reference actually exists.
create unique index if not exists orders_payment_reference_idx
  on public.orders (payment_reference)
  where payment_reference is not null;

-- Sweep index for the reminder/expiry cron: find pending orders past a cutoff.
create index if not exists orders_pending_expiry_idx
  on public.orders (status, payment_expires_at)
  where status = 'pending';

-- Backfill: existing pending orders get their order_number as the reference so
-- nothing already in flight becomes unmatched.
update public.orders
   set payment_reference = order_number
 where payment_reference is null
   and status = 'pending';

-- ---------------------------------------------------------------------------
-- Payment settings. Seeded with placeholders that the storefront treats as
-- "not configured yet" — the checkout hides a method whose details are blank
-- rather than showing an empty BSB to a customer.
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('payid_enabled',          'true'::jsonb),
  ('payid_identifier',       '""'::jsonb),
  ('payid_name',             '""'::jsonb),
  ('bank_transfer_enabled',  'true'::jsonb),
  ('bank_bsb',               '""'::jsonb),
  ('bank_account_number',    '""'::jsonb),
  ('bank_account_name',      '""'::jsonb),
  ('payment_window_hours',   '24'::jsonb),
  ('payment_expiry_hours',   '48'::jsonb),
  ('express_shipping_enabled',   'true'::jsonb),
  ('express_shipping_cents',     '1899'::jsonb),
  ('express_free_threshold',     '400'::jsonb),
  ('standard_shipping_cents',    '1200'::jsonb)
on conflict (key) do nothing;
