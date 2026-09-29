# Customer Order Experience Implementation Plan

> **For agentic workers:** Once this proposal is approved for implementation, use superpowers:executing-plans to implement it task by task. A different execution method can be selected by the user. Steps use checkbox syntax for tracking. This document does not authorise a deployment or sending customer messages.

**Goal:** Professional transaction emails with product imagery, private order pages and optional passwordless order history, without adding registration to checkout.

**Architecture:** Extend the existing Next.js/Supabase order and outbox systems. Use a dedicated single-order capability for email links, Supabase OTP for account-wide access, and server-only ownership checks. Preserve immutable order-line and email-event snapshots.

**Tech stack:** Existing Next.js 15 / React 19 / TypeScript, Supabase PostgreSQL/Auth/Storage, Resend, Vitest/PGlite/Playwright. Node 22.12+ in the 22.x line, npm 10.9.8 and the existing package lock.

**Spec:** [Proposed design](../specs/2026-09-30-customer-order-experience-design.md).

**Status:** Draft prepared at the user's request for brainstorming/research/planning. Product work has not started. Suggested interfaces below become implementation contracts only after design review.

## Global constraints

- Guest checkout remains the default; customer sign-in is optional.
- PayID/bank-transfer receipt, payment confirmation and dispatch remain separate milestones.
- Keep existing admin allowlist checks, stock operations, outbox leases and idempotency controls.
- No public order reads by display number or UUID; no customer table-wide grants.
- No marketing enrolment, order mutations, saved-address UI, fabricated carrier events or automatic bank refunds.
- Every financial amount comes from stored order data, in integer cents. No recalculation from current product prices.
- New migrations are additive; do not edit old applied migration files or replay the seed.
- Existing payment/review links and possibly-sent email bodies remain compatible.
- All fixtures use synthetic identities and order data. Production data is not a test environment.

## Review focus

1. A forwarded order link or modified URL must not expose history, full contact details or a second order — Tasks 2–4.
2. Existing customer/admin sessions and the shared Supabase OTP template must continue to work together — Task 3.
3. Deleted catalogue entries, wrong-size imagery, gifts and partial refunds must still produce a truthful historical receipt — Tasks 1, 4 and 5.
4. An email accepted by the provider before a timeout must retry with exactly the same frozen body and provider key — Task 5.
5. A pending order past its expiry and an operationally completed order without delivery proof must have honest status copy — Tasks 2 and 4.

## File and interface map

Proposed new modules are small and server-only where they handle private data:

| Module | Responsibility |
| --- | --- |
| `storefront/lib/customer-orders/types.ts` | Safe DTO definitions; no database clients. |
| `storefront/lib/customer-orders/presentation.ts` | Pure state, amount and fallback-image mapping. |
| `storefront/lib/customer-orders/access.ts` | Read-link validation, clean-URL exchange, revocation and order-scoped cookie. |
| `storefront/lib/customer-orders/queries.ts` | Explicit-column queries constrained by a verified access context. |
| `storefront/lib/customer-auth/server.ts` | Request-local customer Supabase client and verified customer identity. |
| `storefront/lib/customer-auth/actions.ts` | Rate-limited OTP request, verification, claiming and local sign-out. |
| `storefront/lib/email/order-summary.ts` | Escaped HTML/plain-text product rows and receipt summary. |
| `storefront/components/customer-orders/` | Order state, product rows, totals, history card and sign-in form. |

Proposed domain contracts:

```ts
export type CustomerAccess =
  | { kind: 'order-link'; orderId: string; accessVersion: number; expiresAt: number }
  | { kind: 'customer'; userId: string };

export type OrderLineView = {
  id: string; name: string; variantLabel: string; quantity: number;
  refundedQuantity: number; lineTotalCents: number;
  imageUrl: string | null; imageAlt: string; isGift: boolean;
};

export type StatusInput = {
  status: 'pending'|'paid'|'processing'|'shipped'|'completed'|'cancelled'|'refunded';
  paymentExpiresAt: string | null;
};
export type StatusView = { label: string; showPayment: boolean };
export function customerStatus(input: StatusInput, nowMs: number): StatusView;

// Runtime callers receive these contexts only from server access/auth modules.
// A structural TypeScript type alone is never an authorisation check.
export type CustomerOrderView = {
  id: string; number: string; createdAt: string; status: StatusView;
  items: OrderLineView[];
  totals: { subtotalCents:number; discountCents:number; shippingCents:number;
    totalCents:number; refundedCents:number; currency:'AUD' };
  tracking: { number:string; carrierLabel:string|null; url:string|null } | null;
  milestones: { label:string; at:string }[];
  payment: { method:'payid'|'bank_transfer'; paidAt:string|null; expiresAt:string|null };
  privateDetails: { email:string; name:string|null;
    address:Record<string,unknown>|null } | null;
};
export async function getCustomerOrder(
  id: string, access: CustomerAccess
): Promise<CustomerOrderView | null>;
export async function listCustomerOrders(
  userId: string, cursor?: string
): Promise<{ orders: CustomerOrderView[]; nextCursor: string | null }>;
```

The functions must be called behind verified server entry points; each revalidates ownership or the scoped grant. The history response omits `privateDetails` and uses small summaries in the final implementation to avoid loading unnecessary addresses/items. Pagination is stable on `(created_at, id)` with 20 orders per page and no cross-customer cursor access.

## Task 1 — Preserve product imagery and event summaries

**Files:** Create `storefront/supabase/migrations/20260930090000_customer_order_snapshots.sql`; modify `storefront/lib/admin/products.ts` for media retention/version handling; create `storefront/lib/customer-orders/types.ts`; create `storefront/tests/customer-order-snapshots-sql.test.ts`.

**Consumes:** Existing `orders`, `order_items`, exact product/size image data and canonical `commerce_create_order` / order-operation paths.

**Produces:** Stable `image_url_snapshot`, `image_alt_snapshot`, versioned transaction email summaries and retained public product asset references.

- [ ] Add PGlite integration cases using the existing migration runner pattern in `tests/order-email-lifecycle-sql.test.ts`: create an exact-size product with photo A, place order, change it to photo B, assert the order and its queued event still reference A. Cover checkout, manual admin order, gift/extras, item edits and missing images.
- [ ] Run `npm test -- tests/customer-order-snapshots-sql.test.ts`; confirm the new assertions fail before the migration.
- [ ] Add nullable image columns and an insertion snapshot function/trigger that resolves the purchased product on the server. Capture edited pending-order lines deliberately through canonical operations; never refresh snapshots during unrelated status changes. Reject unsafe origins/schemes and keep null as the supported missing-image state.
- [ ] Publish email thumbnails as immutable JPEG/PNG assets before use; retain referenced versions on media removal. Do not perform remote image conversion in the checkout transaction. If a required historical asset cannot be recovered, use the documented fallback rather than inventing a historical snapshot.
- [ ] Extend `enqueue_commerce_email` via the new migration with an `order_summary_v1` JSON payload assembled from stored items/totals at the event. Preserve all current dedupe and milestone rules, including completed-review behaviour. No backfill sends mail.
- [ ] Rerun the focused test plus `tests/order-email-lifecycle-sql.test.ts`, `tests/checkout-gifts.test.ts` and `tests/admin/manual-email-payloads.test.ts`. Commit the passing snapshot change.

## Task 2 — Build scoped access and truthful order presentation

**Files:** Create `lib/customer-orders/access.ts`, `queries.ts`, `presentation.ts`, `tests/customer-order-access.test.ts`, `tests/customer-order-presentation.test.ts`; extend `lib/order-access.ts` with a separate scope; add `20260930091000_customer_order_access.sql` for the order revocation version. Paths in this and later tasks are under `storefront/` unless stated otherwise.

**Consumes:** Stored order facts and Task 1 snapshots. **Produces:** `CustomerAccess`, `CustomerOrderView`, `customerStatus`, order-link helpers and explicitly selected queries.

- [ ] Pin status behaviour with pure tests, including these exact assertions:

```ts
import { expect, it } from 'vitest';
import { customerStatus } from '@/lib/customer-orders/presentation';
it('stops offering payment when the reservation expires', () => {
  expect(customerStatus({status:'pending', paymentExpiresAt:'2026-09-30T00:00:00Z'},
    Date.parse('2026-09-30T00:00:01Z')))
    .toEqual({label:'Reservation expired', showPayment:false});
});
it('does not equate operational completion with carrier delivery', () => {
  expect(customerStatus({status:'completed', paymentExpiresAt:null}, 0).label)
    .toBe('Order completed');
});
```

- [ ] Write access tests for invalid/missing signatures, expiry boundary, future/oversized tokens, scope substitution, different order IDs, revoked versions and deleted orders. Assert denied access performs no sensitive DTO serialization.
- [ ] Run those two test files and establish failing cases.
- [ ] Implement the `order_view` scope with a 30-day default lifetime; keep payment/review token functions unchanged. Exchange valid links for a secure order-scoped cookie with at most 24-hour lifetime, redirect to the clean URL and recheck revocation on reads. Repeated GETs do not mutate commerce or log the customer in.
- [ ] Build the safe read model: strip notes, actor emails, costs/margins and internal event text. Guest-link `privateDetails` is always null. Map fallback photos by exact product/size. Keep financial refunds separate from shipment progress. Carrier links use a known carrier identifier and allowlisted URL builder, not an arbitrary URL inferred from a number. Add nullable `orders.carrier_code` and an explicit carrier choice to the existing admin fulfilment action/form; retain unknown for old orders until positively mapped. Unknown carrier means readable tracking reference without a fabricated tracking URL.
- [ ] Run access/presentation tests and existing `tests/order-access.test.ts` and `tests/order-access-routes.test.ts`; commit the passing access layer.

## Task 3 — Add optional customer OTP and order ownership

**Files:** Create `lib/customer-auth/server.ts`, `actions.ts`, `app/(store)/account/sign-in/page.tsx`, `components/customer-orders/SignInForm.tsx`, `tests/customer-auth.test.ts`, `tests/customer-order-ownership-sql.test.ts`, `supabase/migrations/20260930092000_customer_order_ownership.sql`; modify `middleware.ts` and `lib/checkout.ts` only at their relevant integration boundaries.

**Consumes:** Supabase verified identities and guest orders. **Produces:** verified customer sessions and durable `orders.customer_user_id` ownership.

- [ ] Add tests for unseen email, mixed-case/whitespace normalization, plus-address separation, wrong/expired/replayed code, resend throttling, persistent failed attempts, tampered `next`, unverified identity, already-claimed orders, concurrent claiming and local logout. Include a customer attempting every admin entry path.
- [ ] Run `npm test -- tests/customer-auth.test.ts tests/customer-order-ownership-sql.test.ts` and confirm the new cases fail.
- [ ] Add nullable ownership and an indexed, atomic service-only claim function. Its caller obtains `user.id` and confirmed email from Supabase `getUser`, not the submitted email field. Claim only currently unowned exact-normalized-email matches; retain original order email and prevent ownership stealing. Extend the existing PGlite migration harnesses with an `auth.users` fixture before applying the new foreign key; their current role/storage bootstrap alone does not provide Supabase Auth tables.
- [ ] Implement a request-local Supabase client with a distinct customer cookie namespace. Use `signInWithOtp` and `verifyOtp` behind throttled actions. Account creation is a consequence of a deliberate sign-in request; failed requests reveal no order/account existence. Validate and allowlist local return routes.
- [ ] Default to a 10-minute code and 60-second resend interval, five failed attempts per challenge, persistent per-email/IP request throttles, plus provider-side limits/bot protection. Implement customer access-session limits independently where provider plan controls are insufficient: 24-hour inactivity and seven-day absolute lifetime, with expiry returning to sign-in.
- [ ] Verify custom SMTP, the code-containing email template, allowed return URLs and admin OTP compatibility in staging. A shared Supabase auth-setting change needs explicit regression evidence; no production auth changes are part of this planning turn.
- [ ] Attach signed-in checkout ownership only when the verified email matches the checkout email. Preserve guest behaviour otherwise. Rerun auth/ownership tests and existing admin auth/checkout suites; commit.

## Task 4 — Deliver the order page and history

**Files:** Create `app/(store)/orders/[id]/page.tsx`, `app/(store)/orders/access/route.ts`, `app/(store)/account/orders/page.tsx`, customer-order components, `tests/customer-order-pages.test.tsx` and `tests/customer-order-flow.spec.ts`; modify the existing thank-you/payment page integration, storefront navigation, `next.config.ts` and privacy tests.

**Consumes:** Tasks 1–3. **Produces:** navigable branded receipt, sign-in recovery and order history.

- [ ] Write route/component cases for expired links, deleted order, temporary database failure, guest redaction, authenticated address display, cross-account substitutions, empty history and pagination. Test anonymous full data is absent from HTML/RSC/network responses, rather than merely hidden with CSS.
- [ ] Run the new component/route tests; confirm failures.
- [ ] Build the order page in the hierarchy specified by the design and interactive concept. Reuse `PaymentInstructions` and existing safe payment polling; do not grant payment mutation authority to an order-view token. Payment actions retain their original scope, or use a separately checked owned-order authorisation branch.
- [ ] Add `/orders/access` as the link exchange route; use a 303 clean-URL redirect. The destination page accepts either a valid order cookie or verified ownership. Expired/bare links lead to generic email verification with a safe return destination; no enumeration.
- [ ] Keep existing `/pay/[id]` and review links working. Any bridge from an old payment link remains within its existing disclosure level. Add My orders navigation and read-only history. A newer signed-in identity never inherits another user's order cookie as an account identity.
- [ ] Extend private/no-store/no-referrer/noindex coverage to `/orders/*` and `/account/*`. Confirm the existing public-measurement allowlist excludes these routes; test both HTML and data requests. Do not add receipt contents to analytics.
- [ ] Verify at 360px and desktop, with keyboard-only navigation and automated accessibility checks. Cover a six-item order, long variants, gifts, partial/full refunds, archived products, a broken photo and a pending order crossing its deadline. Commit passing UI work.

## Task 5 — Upgrade all relevant emails and preserve delivery guarantees

**Files:** Create `lib/email/order-summary.ts`, `tests/order-email-summary.test.ts`; modify `lib/email/templates.ts`, `layout.ts`, `samples.ts`, `sender.ts`, the manual payload builders in `lib/admin/email-operations.ts`, preview samples and privacy/dispatch tests. Add a migration for frozen plain-text/reply-to fields if the existing freeze RPC requires them.

**Consumes:** Versioned event snapshots and Task 2 link generation. **Produces:** consistent product rows, truthful milestone messages, scoped CTAs and text alternatives.

- [ ] Write tests checking every targeted template contains exact variant/quantity/amount, safe photo alt text, an absolute valid order URL and the expected state heading. Exercise untrusted product names/URLs, absent new payload fields and unusual long orders.
- [ ] Run `npm test -- tests/order-email-summary.test.ts` and confirm failures.
- [ ] Implement the shared summary renderer with table rows, inline styles, dimensions and text fallback. Start with order confirmation and shipped, then update payment, refund and expired/cancelled messages wherever a corresponding event/template exists. Do not invent a cancellation notification event without adding and testing that lifecycle separately.
- [ ] Return `{subject, html, text}` for upgraded messages. Freeze text and any configured reply-to alongside HTML before the provider attempt; apply them consistently on retry. Keep a backward-compatible path for old outbox rows that lacks new fields and never change a possibly-sent request.
- [ ] Include a primary “View your order” for confirmed/shipped and “View payment details” while unpaid. Add a secondary carrier link only with a validated carrier mapping. Disable provider click tracking for capability URLs. Use support settings for reply-to; do not hardcode a personal inbox.
- [ ] Run existing brand, privacy, sender, lifecycle, manual-payload and dispatch suites. Specifically simulate provider acceptance followed by a client timeout and assert identical retry body/key; assert no image/payload changes break stale-message eligibility checks.
- [ ] Produce local previews via `npm run preview:emails`. Before rollout, send only to controlled test mailboxes and visually inspect actual Gmail, Apple Mail and Outlook rendering, blocked images and dark mode. Verify authentication headers. Commit validated email changes.

## Task 6 — Staging, rollout and observation

**Files:** Create `storefront/docs/CUSTOMER-ORDERS.md`; update migration/release notes and the feature's acceptance tests.

- [ ] Run the repository checks once after integration: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, relevant browser tests, and `npm run test:headers`. These are planned implementation checks; they have not been run for a feature that does not yet exist.
- [ ] Exercise staging PostgreSQL races for two concurrent ownership claims and email workers, using synthetic accounts. Validate expired/revoked tokens, provider outage/retry, payment reinstatement and deleted orders against the real server configuration.
- [ ] Add feature gates separating order access, customer history and new templates. Deploy additive schema first, compatible readers/routes second, and emails with new CTAs last. Historical orders get no unsolicited message or account invitation.
- [ ] Record the operational recovery steps: resend current scoped link, incorrect checkout email, revoked token, missing historical image, SMTP outage and stale queued message. Support never bypasses mailbox verification using only an order number.
- [ ] Enable a controlled release, inspect email failures and aggregate sign-in success, then widen. Rollback stops generating new templates but continues serving all links already emitted and retains their verification material. Avoid rolling back additive schema underneath those routes.
- [ ] Compare order-status support enquiries and successful self-service visits with a pre-release baseline. Use first-party aggregate events without token URLs, email addresses or purchased-product detail. Record unresolved operational limitations, then commit the release runbook.

## Sequencing and estimate

Tasks 1 and 2 establish reliable data/access, Task 3 adds verified history/recovery, Task 4 builds the customer surfaces, Task 5 connects the emails, and Task 6 validates release readiness. Stage A can be reviewed before history is finished, but the recommended public launch contains both order access and email-code recovery/history.

Allow roughly 8–12 focused engineering days for implementation and verification, subject to provider readiness and historical image quality. Live carrier events, self-service mutations and saved-address functionality are separate follow-up work.

## Planning-turn verification

The design was checked against the local schema, payment/review links, admin auth, lifecycle migration and outbox freezing behaviour. Research links point to primary Shopify/Supabase/OWASP/Google documentation and Baymard's own research. The interactive concept contains sample order data and existing local product imagery; it does not contact production or send email.
