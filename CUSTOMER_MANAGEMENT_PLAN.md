# Customer Management — Deep Admin Experience Plan

> Status: **awaiting approval** · Author: Sage · 2026-08-28
> Scope: admin-only. Storefront untouched. Resend-native architecture preserved — no external CRM/ESP.

## The core insight

The system already runs **seven automated follow-up sequences** and already records **every touch ever sent** in `email_outbox` (`to_email, template, payload, related_type, related_id, status, created_at, sent_at` — never pruned). Sweeps are **deterministic functions of source-row age** (a stage is "due" when the source row's age enters its window and no outbox row exists for that stage). That means:

1. **Full journey visibility requires zero new tracking infrastructure.** The journey log already exists; the admin just never renders it.
2. **The *future* of every sequence is predictable** — next touches and their due-times can be computed from the same window constants the sweeps use.
3. **Sequence control doesn't need a flow engine.** Pause/skip/suppress become small *override checks* inside existing idempotent sweeps; send-now becomes calling `queueEmail` with the sweep's own `related_id` (the dedupe index then makes admin and cron mutually idempotent — whoever fires first wins, the other becomes a no-op).

Everything below builds on those three facts.

## Current sequence inventory (verified against code)

| Sequence | Source of truth | Stages & timing | Code |
|---|---|---|---|
| Abandoned cart | `cart_sessions` (email PK, `reminder_stage` 0–3, `updated_at`) | +1h / +24h / +72h idle, disjoint windows, dead after 168h | `lib/admin/cart-recovery.ts` |
| Payment reminders | `orders` (`payment_reminders_sent`, `payment_expires_at`) | staged reminders → expiry | `lib/admin/payment-ops.ts` |
| Welcome series | `subscribers.created_at` | w1 at subscribe, w3 at +4d (exit on any order) | `lib/admin/lifecycle.ts` |
| Post-purchase review | `orders.shipped_at` | +14d (window closes +35d, skips reviewed) | lifecycle |
| Replenishment | latest fulfilled order, pack-size scaled | 21/70/154d (+42d window) | lifecycle |
| Winback | `customers.last_order_at` | 60d and 90d touches | lifecycle |
| Second-purchase nudge | `customers` (orders_count=1) | +30d (suppressed if replenishment sent <30d) | lifecycle |

Invariants that every new feature must preserve:
- **Dedupe**: unique index `(to_email, template, related_id)` is the send-exactly-once guarantee.
- **Suppression**: `subscribers.unsubscribed_at` blocks all marketing, checked batch-wise pre-queue.
- **Spam Act**: no marketing send without an unsubscribe URL — including admin-initiated sends.
- **Windows**: every stage has an upper bound; stale audiences can never be blasted.

---

## 1 · The People index (upgrade `/admin/customers`)

Today: 100 rows of purchasers by LTV, email-only search. Three gaps: non-purchasers are invisible (cart abandoners and subscribers have no row in `customers`), search misses names, and there's no sense of *state* (who's in a sequence, who's lapsing).

**Plan:**

- **Identity union.** The index lists *people*, not just purchasers: `customers` ∪ `cart_sessions` ∪ `subscribers`, deduped by email. Non-purchasers show "—" for LTV and a "Lead" chip. (SQL: a `people` view — see migrations.)
- **Segments** as filter chips across the top, each an SQL-level derivation, with live counts:
  - **VIP** — top decile by `ltv_cents` (or ≥3 orders)
  - **Repeat** — `orders_count ≥ 2`
  - **One-time** — `orders_count = 1`
  - **In cart recovery** — `cart_sessions.status='active' AND reminder_stage > 0`
  - **At-risk** — `last_order_at` 45–90d ago
  - **Lapsed** — `last_order_at > 90d`
  - **Leads** — subscribers/abandoners with no orders
  - **Unsubscribed** — `unsubscribed_at IS NOT NULL` (visible, never mailable)
- **Search** across `name` and `email` (`or(ilike…)`) with the existing form.
- **Row enrichment**: segment chip, active-sequence badges (tiny colored dots + tooltip: "Cart recovery · touch 2/3"), last-touch relative time.
- **Sort** by LTV (default), last order, last touch.
- **⌘K palette**: "Find customer…" (feeds existing `searchAdmin`), "Cart recovery centre", "Paused sequences".

## 2 · Customer 360 (rebuild `/admin/customers/[email]`)

Works for **any email identity** — a purchaser, a subscriber, or an abandoner with no `customers` row (page keys on email; `notFound()` only when the email appears in no table).

Layout (Midnight Console, `admin-stagger` sections):

1. **Header** — name/email, segment chip, tags, marketing-status pill (`Subscribed / Unsubscribed / Suppressed by admin`), quick actions: Add note · Suppress marketing · Email history filter.
2. **Stat row** — LTV, orders, first/last order, "Touches sent" (outbox count), "Last touch" relative.
3. **Active sequences panel** — the heart of the feature. One card per live sequence, each with a **stage stepper**:
   - `Cart recovery ── ● Touch 1 sent 2h ago ── ◐ Touch 2 due in ~22h ── ○ Touch 3 (+72h) ── ✕ expires 168h`
   - Sent stages show timestamp + template link (to the existing previewer) + outbox status; the **next touch shows a live countdown** computed from the same window constants the sweep uses (single shared module — see architecture); expired/never-eligible states are explicit.
   - Per-sequence controls (all styled modals, never native `confirm()`): **Pause** · **Skip next touch** · **Send next now** · **Stop this sequence**.
   - Payment reminders appear here too when the customer has a pending order (stepper fed by `payment_reminders_sent` + `payment_expires_at`).
4. **Cart snapshot** — for active carts: line items, quantities, subtotal, captured-at, link into the recovery centre.
5. **Journey timeline** — reverse-chronological merged feed of:
   - every `email_outbox` row (template name humanized, sequence grouping color, status badge — `queued / sent / failed / cancelled` — failed rows get a **Retry** action, queued rows get **Cancel**),
   - order events (placed, paid, shipped, refunded) from `orders`/`order_events`,
   - subscription events (subscribed, unsubscribed, admin-suppressed),
   - admin actions from `admin_audit_log` (notes, pauses, manual sends).
   Because outbox rows persist, the timeline survives cart re-captures (`reminder_stage` resets but history doesn't) — the operator sees *every* sequence run ever applied, including previous cart-recovery rounds.
6. **Notes & tags** — free-text notes (author + timestamp, append-only) and lightweight tags (`text[]`); both surfaced in the header and searchable later.
7. **Existing sections retained** — order history table, back-in-stock requests.

## 3 · Cart-recovery command centre (`/admin/recovery`)

The dashboard's abandoned-carts card links here (as does ⌘K).

- **Metrics strip** (definitions locked now so numbers are trustworthy):
  - *Active carts* — `status='active'`, idle ≥1h
  - *In sequence* — active with `reminder_stage>0`
  - *Recovery rate (30d)* — `status='recovered'` ÷ (`recovered` + `active` past 168h + expired), on carts captured in window
  - *Revenue recovered (30d)* — Σ `orders.total_cents` joined via `recovered_order_id`
- **Cart table** — one row per active cart: email (→ Customer 360), contents preview, value, idle time, **stage stepper inline** (compact ● ◐ ○ form), next-touch countdown, per-row controls (Pause / Skip / Send now / Stop).
- **Recovered tab** — recent wins with the order they converted into (visible proof the sequence pays for itself).
- **Expired tab** — carts that aged out untouched (the "money left on the table" list); bulk action deliberately absent in v1 (blasting old carts violates the windows invariant).

## 4 · Control model — exact semantics

All controls are server actions that write `admin_audit_log` and use in-app confirmation modals. All checks are enforced **in the sweeps and send paths, not just the UI**.

| Control | Semantics | Mechanism |
|---|---|---|
| **Pause sequence** | Sweep skips this email for this sequence while paused. **Windows keep aging** — a touch whose window closes while paused is missed forever, not replayed on resume. The UI says exactly that in the modal. | `sequence_overrides` row (`email, sequence, action='pause'`); sweeps add one `NOT EXISTS` check |
| **Resume** | Deletes the pause row. Future touches whose windows are still open resume naturally. | delete override row |
| **Skip next touch** | Marks exactly one upcoming stage as done without sending. | For cart recovery: bump `reminder_stage`; for outbox-derived sequences: insert an outbox row with `status='cancelled'` and the stage's canonical `related_id` — dedupe then blocks the real send |
| **Send next now** | Queues the due/upcoming stage immediately **with the sweep's own `related_id` scheme** — cron and admin are mutually idempotent by construction. Refuses (with reason) if unsubscribed/suppressed or no unsubscribe URL. | server action → `queueEmail` |
| **Stop sequence** | Terminal for this run (e.g. sets cart `status='dismissed'`). | status update |
| **Cancel queued email** | A row still `queued` in the outbox is flipped to `cancelled` before the drain sends it. | outbox status update (enum migration) |
| **Retry failed email** | Re-attempts `sendImmediately` on a `failed` row. | existing sender |
| **Suppress marketing (admin)** | Sets `unsubscribed_at` with `source='admin'` — **marketing only; transactional templates (order/shipping/refund/payment) always deliver.** Reversible, with both directions audited. | subscribers upsert |

## 5 · Engagement outcomes (Phase C)

Resend webhooks (`delivered`, `opened`, `clicked`, `bounced`, `complained`) → `/api/webhooks/resend` (signing-secret verified) → `email_events` table keyed to outbox rows by Resend message id (captured at send time). Then:
- Journey items gain outcome chips (delivered ✓ / opened 👁 / clicked ↗ / bounced ⚠).
- Bounce/complaint auto-suppresses future marketing (audited, surfaced on the 360).
- Recovery centre gains an honest funnel: sent → opened → clicked → recovered.

## 6 · Schema changes (migration sketches)

```sql
-- 2026xxxx_customer_management.sql
create table customer_notes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  note text not null,
  actor_email text not null,
  created_at timestamptz not null default now()
);
create index on customer_notes (email, created_at desc);

create table sequence_overrides (
  email text not null,
  sequence text not null,          -- 'cart_recovery' | 'welcome' | 'replenishment' | ...
  action text not null check (action in ('pause')),
  actor_email text not null,
  created_at timestamptz not null default now(),
  primary key (email, sequence)
);

alter table customers add column if not exists tags text[] not null default '{}';

-- outbox: cancellation + provider correlation
alter table email_outbox drop constraint email_outbox_status_check;
alter table email_outbox add constraint email_outbox_status_check
  check (status in ('queued','sent','failed','cancelled'));
alter table email_outbox add column if not exists provider_message_id text;

create table cart_dismissals? -- NO: reuse cart_sessions.status, extend check to ('active','recovered','dismissed')

-- Phase C
create table email_events (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid references email_outbox(id),
  event text not null check (event in ('delivered','opened','clicked','bounced','complained')),
  created_at timestamptz not null default now(),
  raw jsonb
);
```

A `people` view unions the three identity tables for the index (or is composed in the query layer — decide at build time by benchmarking; view preferred).

## 7 · Architecture notes

- **Single source of timing truth**: extract stage windows (`CART_STAGES`, payment stages, lifecycle thresholds) into `lib/admin/sequences.ts` — a pure module consumed by BOTH the sweeps and the UI's prediction/stepper rendering. Timings can't drift between what runs and what's displayed. (This also creates the seam for editable timings later — out of scope now.)
- **`deriveSequenceState(email)`**: one server function returning every sequence's state for an email (stage positions, sent touches from outbox, next-touch ETA, pause state). Powers the 360 panel, the recovery centre rows, and the index badges — one implementation, three surfaces.
- Sweeps gain exactly two new checks each: pause override, and (already present) suppression. No state machines.
- All new pages force-dynamic server components in the existing pattern; mutations are server actions with `requireAdmin()` + audit logging.

## 8 · Known limitations (stated, not hidden)

- **Email-only identity** stays: a shopper browsing under one email and buying under another is two people to this system (pre-existing, documented in `cart-recovery.ts`).
- **Pause is not rewind**: windows age during pause; missed touches don't replay. This is the honest consequence of stateless sweeps, and the UI says so.
- **Open/click tracking** depends on Resend webhook delivery; treat as directional, not exact (Apple MPP inflates opens).

## 9 · Phases

| Phase | Scope | Effort | Value |
|---|---|---|---|
| **A — See** | `sequences.ts` extraction, `deriveSequenceState`, Customer 360 rebuild (journey timeline + steppers, read-only), 360 works for non-purchaser emails, People index segments/search/badges | ~1 day | Immediately answers "what's been applied & what's next" — zero schema risk (only the outbox-status migration if Cancel ships in A) |
| **B — Steer** | Migrations (notes, tags, overrides, outbox enum), all controls + modals + audit, recovery command centre + dashboard link, ⌘K entries | ~1–1.5 days | "Manage it more carefully" — full control |
| **C — Outcomes** | Resend webhooks, `email_events`, outcome chips, bounce auto-suppression, recovery funnel | ~0.5–1 day | Sequences become measurable |
| **D — Polish** | Saved segment views, CSV export, per-sequence global on/off switches in Settings | opportunistic | Quality of life |

**Verification per phase** (per feedback memory: server-side proof for mutations): Phase A — build + live browse of a real abandoner's 360 checking stepper math against DB rows. Phase B — each control exercised via its server action with SQL read-back (not just UI clicks), plus sweep-idempotency test: run `queueAbandonedCartEmails()` twice after a send-now and assert zero double-queues. Phase C — replay sample webhook payloads against the endpoint, verify signature rejection and event rows.

## File impact map

**New**: `lib/admin/sequences.ts`, `lib/admin/customer-360.ts` (deriveSequenceState + journey merge), `app/admin/(dashboard)/recovery/page.tsx` (+loading), `components/admin/SequenceStepper.tsx`, `components/admin/JourneyTimeline.tsx`, `components/admin/ConfirmModal.tsx`, `components/admin/CustomerNotes.tsx`, `app/admin/(dashboard)/customers/actions.ts`, `app/api/webhooks/resend/route.ts` (C), migrations.
**Modified**: `customers/page.tsx` (index rebuild), `customers/[email]/page.tsx` (360 rebuild), `cart-recovery.ts` + `lifecycle.ts` + `payment-ops.ts` (pause check, timing constants import), `email.ts`/`sender.ts` (cancelled status, provider_message_id), `AdminShell.tsx` (palette items), `lib/admin/nav.ts` (Recovery nav item), dashboard page (link-through).
