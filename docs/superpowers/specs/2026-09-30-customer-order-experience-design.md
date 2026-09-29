# Customer order experience — proposed design

Date: 30 September 2026. Status: research and design draft for review; no production implementation or configuration changes.

## Recommendation

Give every order a private, branded order page. Link to it from professional transaction emails containing recognisable product photos. Add optional passwordless customer sign-in for a complete order history. Keep guest checkout as the default.

The customer should experience: **place order → receive email → view order → see payment/shipping progress and purchased items**. “My orders” asks for an email and a one-time code; it never asks the customer to invent a password. A customer identity is established when the customer deliberately signs in, rather than sending an unsolicited account invitation after every checkout.

This is a custom Next.js/Supabase implementation within the existing store. The reference screenshots demonstrate a useful experience; they do not require a Shopify migration, Shop app, or Shopify account integration.

## Brief and assumptions

The requested outcome is more professional confirmation and shipping emails, with clear pictures of purchased products and a familiar place to review orders. Success means customers can answer “Did my order go through?”, “Has payment been confirmed?”, “What did I purchase?”, and “Where is my order?” without contacting support.

“Review their order” is interpreted as inspecting its details. Existing product-rating requests remain a separate flow. The screenshots supply layout inspiration only; their customer information and private order links are not reused.

Proposed first release: order pages, transaction email upgrades, optional email-code sign-in, and read-only order history. Saved addresses, self-service changes, and one-click repurchasing are later enhancements. This scope is a recommendation pending review, not an approved implementation brief.

## What exists today

Findings are from the local checkout at commit `e04e039`; deployed behaviour and provider configuration were not audited.

| Area | Current implementation | Consequence |
| --- | --- | --- |
| Platform | Next.js 15, React 19, Supabase, Resend | Reuse the stack and existing transaction boundaries. |
| Payments | PayID/bank transfer; an administrator confirms payment | “Order received” and “payment confirmed” must remain different milestones. |
| Confirmation/shipping emails | `storefront/lib/email/templates.ts` renders short text; shipped includes a tracking number | These templates currently lack product rows and a “View your order” CTA. |
| Email branding | `storefront/lib/email/layout.ts` already supplies the navy identity, logo, 600px shell, mobile rules, and support footer | Improve the content and hierarchy rather than replacing the email system. |
| Secure links | `storefront/lib/order-access.ts` signs separate payment/review scopes, with a maximum/default lifetime of 90 days | Add a distinct read-only order scope; preserve existing payment/review behaviour. |
| Payment page | `storefront/app/(store)/pay/[id]/page.tsx` displays status, payment instructions, text items, total | Reuse payment instructions and status facts within the new experience. |
| Order data | Orders have email, shipping address, totals, status, timestamps and one tracking number. Items snapshot name, variant, SKU and price | There is no persisted product-image snapshot or customer-auth ownership column in the inspected schema. |
| Identity | Admin already uses Supabase email OTP plus an explicit admin allowlist | Customer authentication can reuse the provider, but needs its own routes, cookies and ownership checks. |
| Delivery reliability | Durable event-driven outbox, leases, eligibility checks and frozen provider requests | Preserve these controls when enriching messages. |
| Tracking | Admin/manual carrier CSV workflows populate tracking numbers | Carrier scan events and a reliable arrival estimate were not found. Do not invent an ETA or delivered status. |

## Options considered

| Option | Benefit | Trade-off | Decision |
| --- | --- | --- | --- |
| Private order pages + optional passwordless history | Immediate email-to-order access and useful return visits, without checkout registration | Requires ownership, recovery and authentication work | Recommended first-release scope, built in two stages. |
| Private order pages only | Smaller and quicker release; most immediate improvement | Customers must find an old email to revisit an order | Good staging milestone if account work takes longer. |
| Full account platform immediately | Addresses, profile management and repeat purchasing in one place | More verification, mutation, historical-data and support cases before the core benefit ships | Defer until use of the simpler experience justifies it. |

## Research translated into decisions

1. Shopify uses passwordless email codes for customer accounts. Adopt that familiar interaction, while creating our own customer routes. [Shopify customer accounts](https://help.shopify.com/en/manual/customers/customer-accounts)
2. Shopify distinguishes access to a single order from account-wide access. Adopt that separation: a transaction link must never unlock another order or a profile. Our proposal is more restrictive for personal details and gives no order data to an unauthenticated bare URL. [Shopify order status authentication](https://shopify.dev/docs/apps/build/customer-accounts/order-status-page)
3. Baymard identifies open-order tracking as a primary self-service need. Put the latest known state above the product list, keep customers on the branded page, and link to the carrier for information we cannot yet display. [Baymard accounts research](https://baymard.com/research-articles/current-state-accounts-selfservice)
4. Baymard recommends moving optional account creation after purchase to simplify checkout. Offer “View all your orders” after checkout and on order pages. [Baymard confirmation-page research](https://baymard.com/research-articles/order-confirmation-page)
5. Supabase supports email OTP, with template and delivery configuration. Its built-in SMTP service is unsuitable for general production customer delivery. Validate custom SMTP and the shared admin template before enabling customer sign-in. [Supabase OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
6. Use established token safeguards: expiry, resistance to guessing, non-enumerating recovery and rate limits. OWASP's recovery guidance is relevant to those controls; an order-reading token is deliberately reusable during its validity, unlike a password-reset token. [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)

The visual proportions, release boundaries and proposed time limits below are design choices for this store, not requirements asserted by those sources.

## Customer-facing design

### Transaction emails

Retain the current East Coast Labs logo, navy text, white background and restrained cobalt accent. Use a clear order number, one main status heading, one prominent action, product thumbnails, an aligned total and a small support block. Avoid promotional blocks between the status and purchased products.

| Event | Heading | Primary action | Supporting content |
| --- | --- | --- | --- |
| Order created, unpaid | We’ve received your order | View payment details | Exact amount, payment reference, PayID/bank instructions, absolute expiry date/time, product rows. |
| Payment confirmed | Your order is confirmed | View your order | Payment received; next step is packing/dispatch; products and receipt totals. |
| Shipped | Your order has shipped | View your order | Tracking number and a secondary carrier link when its carrier is known; products and totals. |
| Refund recorded | Refund recorded for your order | View your order | Recorded amount and current order summary; do not imply the application transferred money. |
| Expired/cancelled | Order reservation released / Order cancelled | View your order | Explain the actual reason and how to contact support if a transfer has already been sent. |

Each product row: 72–88px image, product name, size/pack label, quantity, paid line amount, and an explicit free-gift label where applicable. Do not hide variants in the photo or show an unlabelled $0 line. Display subtotal, discounts, shipping and total from stored financial fields, all in AUD. Show tax only if the underlying transaction has a genuine recorded tax breakdown; do not calculate a new one for presentation.

Use table-based layout and inline styling for email. Host small JPEG/PNG thumbnails on a stable public HTTPS asset origin. The UI can use WebP; email must not depend on it. Include dimensions, alt text, text product names, a plain-text alternative and a useful preheader. Images being blocked must not remove order meaning. Check Gmail, Apple Mail and desktop Outlook, narrow screens and forced dark mode. Keep HTML below a conservative 90KB budget; unusually long orders show a labelled subset and link to the full order.

Keep Resend, the existing outbox and reply-to support address. Verify SPF/DKIM/DMARC configuration and actual message authentication headers; code inspection cannot prove delivery configuration. Google documents sender authentication expectations. [Gmail sender guidelines](https://support.google.com/mail/answer/81126?hl=en)

### Order detail

Proposed route: `/orders/[id]`. The main page contains, in this order:

1. Order number, date and current status.
2. Latest milestone and next step; payment panel when action is needed, tracking when dispatched.
3. Purchased products with 88–104px images, explicit variant/pack/quantity and actual amounts.
4. Subtotal, discounts, shipping, original total and separately recorded refunds.
5. Delivery and payment summary; personal contact/address details require verified sign-in.
6. Contact support and “View all your orders”.

Use a narrow centred reading width with optional desktop secondary column; mobile becomes one column. Follow the screenshots’ clean hierarchy and cards, not their sidebars, rating banners or Shop download promotion. An order link opens its order directly; no “create an account” gate interrupts that core visit.

| Stored condition | Customer presentation |
| --- | --- |
| Pending and before deadline | Awaiting payment; show payment instructions and exact deadline. |
| Pending past deadline, even before cleanup runs | Reservation expired; suppress payment instructions and offer support. |
| Paid | Payment confirmed; preparing for dispatch. |
| Processing | Preparing your order. |
| Shipped | Dispatched; show recorded dispatch date and tracking. |
| Completed without independent delivery evidence | Order completed; do not relabel as “Delivered”. |
| Cancelled | Cancelled/released, with the actual available reason. |
| Partially refunded | Keep fulfilment status; add a separate refund summary and refunded quantities. |
| Fully refunded | Refunded, while preserving historical items, totals and shipment facts. |

Milestone history is a safe projection of commerce events and timestamps, not a dump of internal event messages or admin notes. Current operational state and historical payment/shipping facts remain distinct, including reinstated orders. No estimated arrival date appears until a carrier or accountable operator supplies its source. Label creation alone must not imply carrier acceptance.

Initial scope follows today's one-tracking-number model. Do not add fictitious split-shipment progress. If partial shipments are needed, add shipment/item allocations as a separate data change before labelling “items in this shipment”.

Add an explicit nullable carrier code and carrier selection to the existing fulfilment workflow so the portal can construct a trustworthy tracking link. Historical numbers with an unknown carrier remain readable references until positively mapped; never guess a carrier from an arbitrary tracking string.

### My orders and sign-in

Add “My orders” to the site navigation and footer. `/account/sign-in` asks for the checkout email, then one paste-friendly numeric code input with resend, change-email and error states. Use `autocomplete="one-time-code"`, a labelled input and visible keyboard focus. No password, compulsory signup, social login or marketing opt-in.

After verification, `/account/orders` shows recent-first order cards with product previews, status, order number/date, total and “View order”. Paginate after 20 orders. Provide useful empty, loading and temporary-unavailability states. Sign-out is visible. “Buy again” is phase two; if added, it creates a fresh cart and rechecks current price, stock and active variants before checkout.

Historic orders are claimable only after verifying the matching mailbox. Whitespace trimming and lowercase follow existing email conventions; do not collapse Gmail dots or strip plus-address tags. Different email addresses require separate verification or an audited support process.

## Data and service design

### Stable product imagery

Add nullable image URL and alt-text snapshots to `order_items`, captured server-side from the exact purchased product/size inside the canonical order transaction. Retain existing immutable name, SKU, variant and price fields. Introduce stable, versioned, email-compatible product assets; retain referenced versions through the order-retention period. Shared public product images contain no customer or order identifiers.

Fallback order: captured image → valid current image for the exact product/size → neutral branded placeholder with readable product text. Old orders can receive a documented best-effort catalogue mapping, but cannot be described as having a historical photograph when none was stored. Do not silently use a 50mg photograph for a 100mg line.

Do not trust client-submitted image URLs, fetch arbitrary remote sources, or make checkout depend on image conversion. Prepare thumbnails at product-media publication time; an unavailable asset produces a safe placeholder. Asset cleanup must preserve versions referenced by orders.

### Read model and email snapshot

Create a small `lib/customer-orders/` module for access checks, safe queries, status mapping and presentation data. Pages and email rows share formatting contracts; HTML email rendering and React rendering stay separate. Order data reads use explicit column lists and server-side authorisation. No authenticated table-wide grants or browser service-role keys.

Extend the existing event enqueue path to include a versioned, sanitised order summary in the outbox: items, thumbnail references, totals and milestone facts as they were at the event. Never regenerate prices from today's catalogue. Preserve frozen provider bodies and dedupe identities through retries. Existing queued messages retain their compatibility path; never rewrite a possibly-sent provider request.

The portal reads current authorised state. Email records the event at send time; its button leads to current state. Update manual admin email payload creation and preview fixtures alongside automated payloads.

### Access boundaries

| Access method | Allowed | Not allowed |
| --- | --- | --- |
| Bare order ID/number | Generic sign-in/recovery screen | Any order existence or order data. |
| Valid scoped order link | That order's products, totals, status and tracking | Other orders, account history, internal notes, full address, phone or email. |
| Verified customer session owning the order | Full customer-facing receipt, delivery/contact summary, owned order history | Admin actions, other customers' orders or internal financial/margin data. |

Proposed order link: dedicated `order_view` scope, 30-day expiry and per-order revocation version. On arrival, exchange it for an HttpOnly, Secure, SameSite=Lax, order-scoped cookie and redirect to a clean URL. Cookie lifetime is at most 24 hours and never beyond token expiry; opening another valid order link may establish that order's context, never account-wide access. Repeated visits are safe and read-only; email scanners cannot consume a single-use login token because the order link is not a login token. Validate signature before lookup, then existence and current revocation version on every read.

After expiry, offer email-code sign-in and return to the original order only after ownership verification. Old payment/review tokens retain their existing scope and validity. Do not silently upgrade an old payment token to reveal more personal data.

Add nullable `orders.customer_user_id` with an index and foreign key to `auth.users`. First verified sign-in claims only unclaimed orders matching the server-verified email, inside an atomic service-only function. Never accept a user ID or verified email from a browser as authority. Already-owned orders cannot be reassigned by email matching. Preserve the original receipt email. Signed-in checkout attaches ownership only when the verified session email matches the checkout email. Otherwise treat it as a guest order. No profile editing or email-change feature in this release.

Keep customer cookies separate from the existing admin cookie namespace. Extend middleware narrowly to refresh customer sessions; middleware is not the authorisation boundary. Server reads verify the session and constrain every order query by ownership. Admin allowlist checks remain mandatory even when a customer can authenticate to the same Supabase project. Test admin/customer login and logout coexistence, including local sign-out behaviour.

OTP proposal: 10-minute validity, minimum 60-second resend interval, persistent per-IP and per-email request throttles, five failed verification attempts per challenge, then restart. A challenge identifies a flow but is never evidence of ownership. Protect the direct Supabase Auth surface with provider rate limits/bot protection too; an app-only limiter is insufficient. Shared template/expiry changes affect admin sign-in and must be verified before release. Customer access sessions expire after 24 hours of inactivity or seven days absolutely; implement server-side access-session checks if the provider plan lacks those controls. Re-authentication returns customers to their requested order.

All order/account/recovery routes: `noindex`, `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, no third-party analytics/pixels, no sensitive values in error logs, no service-worker caching. Extend the current privacy headers; retain the public-only analytics allowlist. Disable click tracking on token-bearing mail links. Personal address changes are support-mediated and do not rewrite shipped receipt details.

## Delivery sequence and release criteria

**Stage A — order pages and emails.** Add image snapshots, safe DTOs, scoped access, order pages, complete transaction templates, old-link compatibility and recovery. Customers can follow every new transaction email to a useful page. Stage A can be previewed independently; public release needs its chosen recovery path available.

**Stage B — passwordless history.** Add customer auth, verified order claiming and the order list. Ship this with Stage A for the recommended first release. Keep address/profile mutations, refunds, cancellations and repurchasing outside the first-release UI.

**Stage C — optional enhancements.** Fresh-cart “Buy again”, source-backed carrier events/ETA, receipts, saved future-delivery addresses and carefully authorised self-service changes. Prioritise based on customer support data.

Planning estimate: approximately 8–12 focused engineering days for A+B and staging verification, plus external delivery/provider setup delays. This is an estimate, not a commitment; auth configuration, historical image quality and email-client rendering can change it. A standalone carrier integration is excluded.

Acceptance requires:

- Every new order transaction email has a working scoped action and correct, recognisable item rows.
- Links, history and personal details obey the access matrix, including tampering, expiry, revocation, forwarded links and cross-customer ID substitution.
- Existing payment deadlines, signatures, stock, manual payment confirmation and email deduplication continue working.
- Free gifts, packs, discounts, archived products, missing photos, refunds, cancellations, reinstatements and old orders display honestly.
- No duplicate messages on event replay/retry; old possibly-sent payloads remain immutable; migration sends no historic mail.
- Responsive/keyboard/screen-reader checks pass; actual Gmail/Apple Mail/Outlook test sends are visually checked before customer rollout.
- Production auth delivery, shared admin sign-in, DNS authentication and callback configuration are verified in staging and controlled release checks.

Use additive migrations and feature flags; enable routes before adding their CTAs to emails. Keep emitted link routes and verification keys functioning even if new email templates are rolled back. Measure aggregate order-page access, sign-in success, email failures and order-status support volume without exporting private URLs or purchased items to third-party analytics. Establish a baseline first; no improvement percentage is promised.

## Review points

Confirm the proposed first-release scope and visual direction before implementation. The defaults are optional email-code history, masked personal details on order links, no estimated delivery date without evidence, and no self-service order edits. Provider configuration and support retention rules are implementation readiness checks, not assumptions that they are already configured.

See the accompanying [implementation plan](../plans/2026-09-30-customer-order-experience.md).
