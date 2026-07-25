# East Coast Labs — Admin Panel Plan (`/admin`)

> WooCommerce-parity store management for the standalone storefront — stock, orders, customers, discounts, COAs, reviews, settings — with a keyboard-first, dashboard-led UI. This is the plan; nothing here is built yet. Acceptance criteria (46 ISCs) live in the companion ISA (`PAI/MEMORY/WORK/eastcoastlabs-admin-plan/ISA.md`) and seed `storefront/ISA.md` on build approval.

## 0. The core insight

The storefront already shipped the *receptors* — a back-in-stock waitlist quietly collecting emails (`stock_notifications`), an exit-intent modal promising **WELCOME10** (which doesn't exist), a review UI running on sample JSON, and a COA verify tool reading `coa_batches`. The admin is the *hormone*: the moment it exists, restocking a peptide emails the waitlist, WELCOME10 becomes a real coupon, real reviews replace samples, and new COAs publish in one upload. Day-one admin actions directly move revenue — this is not a generic CRUD panel.

The second insight: **there are no orders to manage yet.** Checkout still hands off to the legacy WooCommerce page (where Bankful runs). The admin plan therefore includes the missing commerce backbone — native orders + checkout ingestion — because without it, WooCommerce can never be switched off.

## 1. Architecture

- **Same Next.js app**, route group `app/admin/` — shared `lib/` (pricing, supabase, format), one Vercel deploy, zero admin JS in storefront chunks (verified at build).
- **Supabase is the backend.** All mutations are **server actions** using the service-role client (server-only); RLS default-deny on every admin table; anon key sees nothing.
- **Auth:** Supabase Auth email OTP/magic-link, gated by an `admin_users` allow-list. Middleware guards `/admin/*`; server actions re-verify (defense in depth). v2: staff roles, 2FA.
- **Audit everything:** `admin_audit_log` (actor, action, entity, before/after diff) written by every mutation — WooCommerce never gave them this.

## 2. Data model (new migrations)

| Table | Purpose |
|---|---|
| `products`, `product_variants` | Catalog moves from `data/catalog.json` (becomes seed/fallback) — name, compound, description, images, SEO, tier (1/3/6-vial) pricing, subscribe-&-save % |
| `inventory` | Per-variant `on_hand`, `reserved`, `low_stock_threshold` |
| `stock_movements` | **Append-only ledger** — every change has type (received/sale/adjustment/return), qty, reason, actor. `on_hand` = sum of movements (auditable, refund-safe, race-safe) |
| `orders`, `order_items`, `order_events` | Status machine: `pending → paid → processing → shipped → completed`, branches `cancelled`/`refunded`; events = timeline (status changes, emails, notes) |
| `customers` | Derived per email: order history, LTV, notes; joins to `subscribers` |
| `discounts` | Code, %/fixed, min-spend, usage limits, expiry, per-product scope |
| `settings` | Announcement bar, free-shipping ($150) / gift ($250) thresholds, store details |
| *(existing)* `reviews`, `coa_batches`, `subscribers`, `stock_notifications` | Get management UIs — reviews already has `pending/published/rejected` status built for moderation |

## 3. The admin UI — what "amazing" means concretely

**Design language:** extends the storefront brand (accent, type) into a denser, calmer workspace — sidebar nav + topbar, generous whitespace, status chips with one consistent color semantic across the whole app. Light/dark follows system. Built from in-repo primitives on Radix + Tailwind 4 (shadcn-style), TanStack Table for grids, cmdk palette, Sonner toasts, Recharts for dashboard — ~5 small deps, no heavyweight admin framework.

- **Dashboard home** — today/7d/30d revenue with sparklines, orders-to-fulfil (click → pre-filtered list), low-stock alerts, recent activity feed from the audit log.
- **⌘K command palette** — jump to any order (#, email), product, or action ("adjust stock BPC-157", "new discount") in two keystrokes.
- **Tables that respect the operator** — server-side pagination/filtering, sticky headers, row hover actions, inline edit for price/stock, multi-select bulk bar, saved filter views ("Awaiting shipment").
- **Optimistic UI + Undo** — stock adjustments and status changes apply instantly with an Undo toast; no full-page spinners, skeletons only.
- **Mobile-first order triage** — fully usable at 390px so orders can be checked/marked shipped from a phone; print-ready packing slips.
- **Empty states that onboard** — each module's empty state teaches the workflow (e.g. "No discounts yet — create WELCOME10, your exit-intent modal is already promising it").

## 4. Modules (WooCommerce parity map)

| WooCommerce | ECL Admin | Notes |
|---|---|---|
| Orders | **Orders** — list/filters/search, detail w/ timeline, enforced status flow, mark-shipped + tracking + email, refund/cancel w/ automatic stock reversal, internal notes, packing slip (with COA batch IDs — regulatory trust on paper), manual order creation (bank transfer/phone) | Refund via Bankful API when creds land; manual mark-refunded until then |
| Products | **Products & Stock** — editor (desc, images, SEO, tier prices, subscribe-&-save), ledgered stock adjustments w/ reason codes, low-stock thresholds + alerts, bulk edit, CSV import/export | Storefront revalidates on save (ISR tag) |
| Stock mgmt | **+ Back-in-stock automation** — restock 0→n queues emails to the existing waitlist | Woo never had this wired |
| Coupons | **Discounts** — %/fixed, min-spend, limits, expiry; cart/checkout integration; WELCOME10 day-one | |
| Customers | **Customers** — list, detail (orders, LTV, notes), CSV export; subscribers view + Klaviyo sync status | |
| Reviews | **Review moderation** — pending queue, approve/reject, verified-buyer flag from orders; flips `lib/reviews.ts` to Supabase, retiring sample JSON | Already-pending task, unblocked here |
| — | **COA batches** — CRUD + PDF upload to `coa` bucket, batch↔product link; `/lab-results` + verify tool update instantly | ECL's trust moat |
| Settings | **Settings** — announcement bar, shipping/gift thresholds, store details, admin users | Marketing levers without a dev |
| Reports | **Dashboard** (v1) → revenue/product/customer reports (v2) | |

## 5. Checkout & payments (the backbone)

1. **Native checkout page** (replaces Woo hand-off): address + shipping → server action creates `pending` order and reserves stock → hand-off to **Bankful** hosted payment.
2. **Confirmation**: Bankful webhook/callback marks `paid`, converts reservation to sale movement, sends confirmation email. Until Bankful creds arrive: **manual mark-paid** flow (bank transfer) makes the whole system live-testable and even usable in production.
3. **Transactional email** (surfaced by scope analysis — currently Woo's silent job): **Resend** behind the existing email seam for order confirmation / shipping / back-in-stock; Klaviyo stays marketing-only via `/api/subscribe` forward.

## 6. Build phases

| Phase | Scope | Est. |
|---|---|---|
| **A. Foundation** | Auth + allow-list, `/admin` shell, middleware, audit log, UI primitives (table/palette/toasts/theme) | 1 session |
| **B. Commerce backbone** | Migrations + catalog seed, native checkout → pending orders, manual mark-paid, stock ledger | 1–2 sessions |
| **C. Orders module** | List/detail/statuses/fulfilment/refunds/slips/notes + emails (Resend) | 1 session |
| **D. Products & stock** | Editor, adjustments, low-stock, back-in-stock automation, bulk/CSV | 1 session |
| **E. Trust & growth** | Dashboard analytics, COA CRUD, review moderation, discounts, settings | 1–2 sessions |
| **F. Bankful integration** | Hosted payment + webhook + API refunds | Blocked on client creds |

C/D/E are parallelizable after B. Coding phases run at E3+ with Forge included per doctrine. Go-live sequencing: A–E ship **before** DNS cutover (ties into `GO_LIVE_RUNBOOK.md`); F can land after via manual-paid interim.

## 7. Security & compliance

Service-role never client-side (build-greps enforced) · RLS default-deny · rate-limited auth · audit log on every mutation · no PII in URLs · research-use framing preserved, no dosing content anywhere in admin-editable surfaces · GST-inclusive pricing display (AU).

## 8. Risks

- **Bankful unknowns** (hosted-page + webhook capabilities unverified) → isolated to Phase F; manual-paid interim de-risks launch.
- **Catalog migration drift** → JSON kept as seed + emergency fallback; seed script diffs counts.
- **Email deliverability** → Resend domain verification before cutover.

## 9. Acceptance

46 binary criteria in the ISA cover auth/RBAC, schema + ledger invariants, every module end-to-end, UX antecedents (⌘K, <500ms tables at 1k orders, Undo, 390px, theming), and anti-criteria (no Woo dependency, no admin JS in storefront chunks, clean typed build). The build is done when all 46 probe green.
