-- East Coast Labs — lifecycle marketing email foundation (Resend-native, no ESP).
--
-- Adds the minimum schema for multi-touch marketing sequences on top of the
-- existing email_outbox + cron-sweep architecture:
--   * subscribers.unsubscribed_at — suppression flag. An email is suppressed
--     when ANY subscribers row for it has unsubscribed_at set. A row with
--     source='unsubscribe' is upserted for customers who never subscribed but
--     opt out via an order-driven marketing email.
--   * cart_sessions.reminder_stage — the abandoned-cart flow grows from one
--     touch to three (+1h/+24h/+72h). Stage counts sends for the CURRENT
--     capture; a fresh capture resets it. Backfill marks previously-reminded
--     carts as fully staged so the new flow never re-sends stages 2/3
--     retroactively to old captures.
--   * reviews.order_id — ties a buyer-submitted review to the order that
--     earned it (one review per order, verified-buyer provenance).
--   * RESTOCK10 — the replenishment/winback discount code the copy deck
--     references. Mirrors the WELCOME10 seed.

alter table public.subscribers
  add column if not exists unsubscribed_at timestamptz;

alter table public.cart_sessions
  add column if not exists reminder_stage int not null default 0 check (reminder_stage >= 0);

update public.cart_sessions
  set reminder_stage = 3
  where reminder_sent_at is not null and reminder_stage = 0;

alter table public.reviews
  add column if not exists order_id uuid references public.orders(id);

create unique index if not exists reviews_order_id_key
  on public.reviews (order_id)
  where order_id is not null;

insert into public.discounts (code, kind, percent, min_spend_cents)
values ('RESTOCK10', 'percent', 10, 0)
on conflict (code) do nothing;
