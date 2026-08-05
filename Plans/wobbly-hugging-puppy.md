# Resend-Based Lifecycle Email Build (Klaviyo Replacement)

## Context

The profit audit (`PROFIT_AUDIT_PLAN.md`) originally scoped Phase 4 ("Switch On the LTV Engine") as a Klaviyo integration: wire `/api/subscribe` to Klaviyo, activate the Welcome/Abandoned-Cart/Post-Purchase/Replenishment/Winback flows whose copy already exists in `content/KLAVIYO_COPY_DECK.md`, and add the Tier-1 gaps (day-30 second-purchase nudge, back-in-stock trigger, code-expiry reminder).

You flagged that Resend is a better cost fit than Klaviyo. Investigation confirmed this is a smaller decision than it first looked: **Resend is already the store's email vendor** — `lib/email/sender.ts` sends through it today, driven by a Supabase `email_outbox` table (`lib/admin/email.ts`), with 8 transactional templates already live (order confirmation/shipped/refunded, payment instructions/reminder/expired, back-in-stock, abandoned-cart). Klaviyo was only ever going to add the *marketing lifecycle* layer on top: delayed multi-step sequences, subscriber consent/unsubscribe, and segmentation — none of which the current outbox does yet.

This plan re-scopes that layer to be built natively on the existing outbox/cron architecture instead of introducing Klaviyo, reusing the exact idempotent-sweep pattern already proven in `lib/admin/payment-ops.ts` (`REMINDER_STAGES`, atomic claim-and-update, dedupe-safe re-runs). The goal: every flow in the copy deck goes live, on Resend, at effectively zero incremental per-contact cost, without adding a second email vendor.

**Explicitly out of scope for this build** (deferred, not needed for Klaviyo parity):
- Engagement analytics (open/click tracking) — would need a Resend webhook → `email_events` table later.
- Full segmentation UI / VIP tiers / loyalty (audit already flags loyalty as premature).
- "New batch published for a product you bought" (audit's Phase C differentiator) — same sweep pattern, added later once the core lifecycle is live.
- Welcome code-expiry reminder (lifecycle map item 1.6) — no copy exists yet; cheap to add later, not required for parity.

## Architecture decision: no new scheduling engine

The obvious-looking approach (add a `send_at` column to `email_outbox` for delayed sends) is unnecessary. `payment-ops.ts` already solves "send stage N once an order crosses an age threshold" without any delay/scheduling column — it runs a cron sweep that queries for rows past the threshold and not yet at that stage, then queues + sends immediately. Every new sequence (Welcome, Post-Purchase, Replenishment, Winback, second-purchase nudge) follows the same shape:

```
sweepX(): for each eligible row past its age threshold and not yet sent that stage
  → queueEmail({ ..., relatedId: `${id}:sequenceName:stage` })
```

`queueEmail`'s existing `upsert(..., { onConflict: "to_email,template,related_id", ignoreDuplicates: true })` (`lib/admin/email.ts:34-43`) is the dedupe guarantee — a sweep can run daily forever and never double-send a stage. No new outbox schema needed.

## Work items

### 1. Consent & unsubscribe (prerequisite for every marketing send)

Transactional templates (order/payment emails) are exempt from the Australian Spam Act's unsubscribe requirement; marketing templates (everything below) are not.

- Migration: `alter table subscribers add column unsubscribed_at timestamptz`.
- `lib/email/unsubscribe.ts` (new): HMAC-signed token helpers (`signToken(email)`, `verifyToken(token) → email | null`) using a new `UNSUBSCRIBE_SECRET` env var — no new dependency, `crypto.createHmac`.
- `app/api/unsubscribe/route.ts` (new): `GET ?t=<token>` → sets `subscribers.unsubscribed_at`, upserting a row if the email has no subscriber record yet (a customer who only ever ordered can still opt out). Same `CRON_SECRET`-style pattern isn't needed here since it's a public link, but the HMAC token prevents arbitrary emails being unsubscribed by a third party.
- `lib/email/templates.ts`: add a `MARKETING_TEMPLATES: Set<EmailTemplate>` classification; `shell()` takes an optional unsubscribe URL and renders the footer link only when the template is in that set. Every sweep function passes `unsubscribeUrl` in `payload` for marketing templates.
- Every sweep query filters `unsubscribed_at is null` before queuing.

### 2. Welcome series (3 emails: immediate / +2d / +4d)

- **Discount code decision (confirmed with owner): WELCOME10 everywhere.** The copy deck's WELCOME15 references are replaced with the existing WELCOME10 (10%) in all welcome templates; no new discount row is seeded for the welcome flow; the exit-intent popup already matches. Update `content/KLAVIYO_COPY_DECK.md` sections 1 and 6 to say WELCOME10/10% so the copy source of truth stays consistent (also resolves audit item 1.6's code mismatch).
- New templates in `templates.ts`: `welcome_1`, `welcome_2`, `welcome_3` (copy: `content/KLAVIYO_COPY_DECK.md:11-113`, with the code substitution above).
- `app/api/subscribe/route.ts`: after the `subscribers` upsert succeeds (source not `back_in_stock:*`), call `queueEmail({ to: email, template: "welcome_1", relatedType: "subscriber", relatedId: email })`.
- `lib/admin/lifecycle.ts` (new file, mirrors `payment-ops.ts` style): `sweepWelcomeSeries()` — query `subscribers` where `created_at` age ≥ 2d/4d, `unsubscribed_at is null`, and no `orders` row exists for that email created after `subscribers.created_at` (the deck's "exclude if already purchased" rule). Queue `welcome_2`/`welcome_3` with `relatedId: ${email}:welcome:2|3`.

### 3. Abandoned cart — expand 1 touch → 3 touches (+1h / +24h / +72h)

Current `lib/admin/cart-recovery.ts` deliberately caps recovery at one send (explicit comment: "cap recovery to exactly ONE send per capture") — but that constraint exists to guard against the cross-email-identity edge case, not against multiple touches on the *same* email. Expanding to 3 stages doesn't reintroduce that risk.

- Migration: `alter table cart_sessions add column reminder_stage int not null default 0`; backfill `update cart_sessions set reminder_stage = 3 where reminder_sent_at is not null` (previously-reminded carts don't get re-sent stages 2/3 retroactively).
- Rewrite `queueAbandonedCartEmails` → `sweepAbandonedCartEmails()` using `STAGES = [1, 24, 72]` (hours), same atomic `UPDATE ... WHERE reminder_stage = stage RETURNING` claim pattern as `remindUnpaidOrders`. Templates: `abandoned_cart_1` (no discount — deck Principle #6: never discount by default), `abandoned_cart_2` (objection handling / COA), `abandoned_cart_3` (final call). Copy: `content/KLAVIYO_COPY_DECK.md:117-192`.
- Operational tweak: `vercel.json`'s `/api/cron/abandoned-carts` currently runs once daily (`0 4 * * *`); the +1h stage loses most of its value on a 24h cron cycle (deck Principle #4: "the first 60 minutes are worth more than the next 60 days"). Recommend changing this cron to hourly (`0 * * * *`).

### 4. Post-purchase (+2d COA walkthrough, +14d review request)

Order confirmation and shipped emails are already live — no work there.

- New templates: `post_purchase_coa_walkthrough`, `post_purchase_review_request` (copy: `content/KLAVIYO_COPY_DECK.md:258-310`).
- `sweepPostPurchase()` in `lifecycle.ts`: query `orders` where `status in ('shipped','completed')`, `shipped_at` age ≥ 2d/14d (this store has no separate `delivered_at` — `shipped_at` is the fulfillment anchor, matching the copy deck's own "Fulfilled Order" trigger). `relatedId: ${order.id}:post-purchase:coa|review` — outbox dedupe makes this one-time-per-order with no extra column needed.
- **Dependency**: the review-request email's CTA needs somewhere to send the customer. Confirmed there is no buyer-facing review submission path anywhere in the app today (only admin moderation exists) — this is also audit item 1.2. Building it here (rather than leaving the email pointing at a dead end) means:
  - Migration: `alter table reviews add column order_id uuid references orders(id)`, partial unique index `(order_id) where order_id is not null` (one review per order).
  - `app/(store)/leave-a-review/page.tsx` + server action: customer enters order number + email (must match an existing `shipped`/`completed` order), rating, title, body → inserts into `reviews` with `status='pending'`. Goes into the existing admin moderation queue — no admin-side changes needed.

### 5. Replenishment (3 tiers: 1-vial +3wk / 3-pack +10wk / 6-pack +22wk)

- One parameterized template `replenishment` in `templates.ts` (payload carries `pack_size`, `items`) rather than 3 near-duplicate templates — matches the existing `back_in_stock` pattern.
- `sweepReplenishment()`: query fulfilled orders joined `order_items → product_variants.pack_size` (fallback: parse `order_items.variant_label` via the same `packSizeFromLabel()` regex already in `lib/checkout.ts:38-44`, for variants since deleted). Threshold by pack size (3/10/22 weeks since `shipped_at`); exclude if a newer order exists for that email (deck's "exclude if reordered since"). `relatedId: ${order.id}:replenishment`.
- Migration: seed a `RESTOCK10` row in `discounts` (10% off, no min spend/expiry — mirrors the existing `WELCOME10` seed at `commerce.sql:222-225`). Confirmed neither `RESTOCK10` nor `WELCOME15` exist anywhere in the repo today.

### 6. Winback (60d / 90d inactive)

- New templates: `winback_60d`, `winback_90d` (copy: `content/KLAVIYO_COPY_DECK.md:399-442`).
- `sweepWinback()`: the `public.customers` view (`commerce.sql:230-240`) already exposes `last_order_at` per email — no new schema needed. Query where age since `last_order_at` ≥ 60d/90d, not unsubscribed. `relatedId: ${email}:winback:60|90`.

### 7. Day-30 second-purchase nudge (Tier-1 gap — no copy exists yet)

- Audit explicitly names this "the LTV hinge" (1st→2nd order conversion). No copy deck entry exists; needs a short new template in the same tone (logistics/proof framing, no discount-by-default per Principle #6 — lead with the reorder convenience + COA angle, same as the replenishment copy's style).
- `sweepSecondPurchaseNudge()`: `customers` view where `orders_count = 1` and age since `last_order_at` ≥ 30d, not unsubscribed.

### 8. Back-in-stock trigger (template exists, nothing calls it)

`stock_notifications` (waitlist) and the `back_in_stock` template both already exist; nothing currently queues it on restock. Needs a hook wherever admin flips a product/variant back to in-stock, following the same atomic-claim pattern as the other sweeps (`UPDATE stock_notifications SET notified_at = now() WHERE product_slug = X AND notified_at IS NULL RETURNING email`). Exact hook file (admin inventory action) to be confirmed at implementation time — small, isolated piece.

### 9. Cron + settings wiring

- `app/api/cron/lifecycle/route.ts` (new): `CRON_SECRET`-protected like the existing 3 cron routes; calls `sweepWelcomeSeries`, `sweepPostPurchase`, `sweepReplenishment`, `sweepWinback`, `sweepSecondPurchaseNudge` in sequence. Daily cadence is sufficient — all thresholds are day/week-scale.
- `vercel.json`: add the new cron entry; bump `abandoned-carts` to hourly (item 3).
- Optional (nice-to-have, not blocking): `lifecycleEmailsEnabled` boolean in `lib/settings.ts`'s `StoreSettings`/`KEYS` (existing pattern at `lib/settings.ts:9-78`) so the store owner has a kill switch without a deploy.

### 10. Remove Klaviyo remnants

- Drop `NEXT_PUBLIC_KLAVIYO_ID` from `.env.example`/`.env.local` and the Klaviyo script loader in `components/Analytics.tsx` — no longer a gate, no longer needed. One less third-party script on a store whose whole pitch is "proof, not promises."
- `content/KLAVIYO_COPY_DECK.md` stays as-is — it's the copy source of truth, just consumed as native templates instead of Klaviyo flow imports.

## Files touched (summary)

**New:** `lib/admin/lifecycle.ts`, `lib/email/unsubscribe.ts`, `app/api/unsubscribe/route.ts`, `app/api/cron/lifecycle/route.ts`, `app/(store)/leave-a-review/page.tsx` + action, one migration (`supabase/migrations/<ts>_lifecycle_marketing.sql`) covering: `subscribers.unsubscribed_at`, `cart_sessions.reminder_stage` (+backfill), `reviews.order_id` (+unique index), `discounts` seed row for `RESTOCK10`.

**Modified:** `lib/email/templates.ts` (new templates + marketing/unsubscribe classification), `lib/admin/email.ts` (extend `EmailTemplate` union), `app/api/subscribe/route.ts` (trigger welcome_1), `lib/admin/cart-recovery.ts` (stage-based rewrite), `vercel.json` (new cron + hourly abandoned-carts), `components/Analytics.tsx` + `.env.example` (drop Klaviyo).

## Rough effort

| Item | Effort |
|---|---|
| 1. Consent/unsubscribe foundation | 4h |
| 2. Welcome series | 4h |
| 3. Abandoned cart 3-touch | 4h |
| 4. Post-purchase + review submission page | 1 day |
| 5. Replenishment | 4h |
| 6. Winback | 2h |
| 7. Day-30 nudge (incl. new copy) | 2h |
| 8. Back-in-stock trigger | 2h |
| 9. Cron/settings wiring | 1h |
| 10. Klaviyo cleanup | 30m |

**Total: ~4-5 days** — comparable to the audit's original Klaviyo estimate (1 day integration + 2 days Tier-1 gaps), with the difference being genuine compliance/architecture work (unsubscribe, cart-stage migration, review submission) the Klaviyo estimate implicitly got for free from the vendor, plus zero ongoing per-contact SaaS cost afterward.

## Verification

- `bun run build` after each migration + code batch to catch type errors against the extended `EmailTemplate` union.
- Manual sweep test: run each `sweepX()` against seeded Supabase rows with `created_at`/`shipped_at` backdated past threshold, confirm exactly one `email_outbox` row is queued per stage and a second run doesn't duplicate it.
- Hit `/api/unsubscribe?t=<valid-token>` and confirm `subscribers.unsubscribed_at` is set, then confirm a subsequent sweep run skips that email.
- Submit the new `/leave-a-review` form with a real shipped order's number+email, confirm it lands in `/admin/reviews` as `pending` and a second submission for the same order is rejected (unique index).
- Trigger `/api/cron/lifecycle` locally with `CRON_SECRET` and inspect the JSON response counts, then check Resend's dashboard (or outbox `status`) for actual sends.
