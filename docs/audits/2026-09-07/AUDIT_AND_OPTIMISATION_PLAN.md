# East Coast Labs — site audit and optimisation plan

7 September 2026 · Storefront and admin given equal priority · Source reviewed at commit `72e1bb7`

The site has a recognisable visual identity and a considerable amount of useful commerce functionality. The strongest opportunity is to make its promises, data and operations agree. Improving those foundations will make the storefront more credible and the admin easier to trust. A broad visual redesign should follow the urgent privacy, checkout and fulfilment repairs.

The recommended order is: protect order access; make checkout, refunds and inventory consistent; repair mobile and product-content friction; make daily admin actions dependable; then optimise speed and experiment with merchandising using accurate paid-order data.

## How to read this audit

This document is the decision and delivery plan. The supporting reports contain the detailed code findings, precise locations, reproduction conditions, proposed fixes and validation criteria:

- [Storefront code findings](/Users/shanakajayakody/eastcoastlabs/docs/audits/2026-09-07/storefront-code-findings.md): 18 findings plus mobile checkout analysis.
- [Admin code findings](/Users/shanakajayakody/eastcoastlabs/docs/audits/2026-09-07/admin-code-findings.md): 18 findings covering editing, orders, refunds, packing, people and automation workflows.
- [Platform code findings](/Users/shanakajayakody/eastcoastlabs/docs/audits/2026-09-07/platform-code-findings.md): 13 findings covering shared reliability and access boundaries. Some overlap the other reports because one underlying defect affects both experiences; these are not 49 independent defects.

**Evidence labels:** “Live” means observed in the public browser or HTTP response. “Code” means the failure path exists in the checked-out implementation. “Conditional” means it depends on deployed configuration or a particular data state. “Proposal” means a product/design improvement whose benefit needs measurement. Code findings are not claims that customers have already experienced the failure or that an attacker has exploited it.

P0 means urgent privacy containment. P1 means substantial commerce, fulfilment or trust risk. P2 means important usability, reliability or measurement work. P3 means a discretionary enhancement. Severity is a prioritisation judgement, not a revenue forecast.

## Scope and measured baseline

Reviewed the live homepage, mobile shop, BPC-157 product page, cart and checkout; inspected page structure, accessible controls and responsive behaviour; checked the live sitemap and its public routes; inspected the current frontend, admin, data model, jobs and existing plans; ran a production build, TypeScript and dependency checks. A temporary browser cart was created and emptied. No order was submitted, no customer details were entered, and no operational email or admin mutation was triggered.

The admin review is code based, as requested after the login requirement was identified. Authenticated admin visuals, task timings, live database grants, production incident rates, backup recovery, analytics reports and deployed commit identity were not verified. The old WordPress plugin/theme are migration context; the active Next.js/Supabase application is the audit target. This is a broad application audit, not a penetration test or a legal/scientific certification of catalogue claims.

| Check | Result | Interpretation |
|---|---|---|
| Production build | Passed; Next.js 15.5.21, 37 generated static pages | Current source compiles and can render its build routes. This does not validate transactional behaviour. |
| TypeScript | `tsc --noEmit --incremental false` passed | Strict typing is a useful existing foundation. |
| Lint | Failed with setup prompt; no configured linter | `npm run lint` is not a working unattended quality gate. |
| Dependency audit | Four high-severity package entries; zero critical | Entries are `nanoid`, `postcss`, `sharp` and affected parent `next`. They are not four proven remotely exploitable site defects. |
| Live sitemap routes | 29/29 returned HTTP 200; each contained one H1 | Basic public routing works. |
| Research guide routes | All 14 links from the live research hub returned HTTP 200 | 43 public content/utility routes checked in total; guide metadata was not included in the 29-page canonical count. |
| Canonicals | None of those 29 HTML responses supplied a canonical link | Set intentional canonical URLs per indexable route. |
| Research guide sitemap coverage | Live sitemap includes zero guide URLs; local build includes all 14 | Confirm deployment/artifact/cache parity. Source already intends to include guides. |
| Product placeholders | `PLACEHOLDER` appears in 14 live product HTML responses; visible on BPC-157 | Editorial completion and publication validation are needed. |
| Certificate PDF links | All 14 distinct COA PDF links found on the checked pages returned HTTP 404 on GET | This affects the central proof proposition, not just one isolated product. |
| Mobile checkout | At 390 × 844 CSS pixels, document width was 510 pixels | Live horizontal overflow and clipped fields; reproducible design defect. |
| Anonymous admin request | Redirected to the login page | The first access gate is working; authorisation review also found explicit server-side allowlist checks. |
| Unknown product | HTTP 404 | Correct missing-product response in the checked case. |
| Homepage response | One cached sample: ~0.38 s TTFB, ~0.44 s total, 138,273 uncompressed HTML bytes, Vercel HIT | A single local-network sample, not a mobile speed score, field percentile or SLO. |
| First-load JavaScript, local build | Home 116 kB; shop 119 kB; PDP 118 kB; checkout 112 kB; admin orders 123 kB; product editor 257 kB | Build-reported route estimates. The product editor is the clearest bundle investigation target. |
| Browser console | No warnings/errors captured during the sampled public journey | Does not establish absence of errors elsewhere. |
| PageSpeed | API returned HTTP 429 quota unavailable | No Lighthouse score, field LCP, INP or CLS is claimed. |

The [build log](/Users/shanakajayakody/eastcoastlabs/docs/audits/2026-09-07/evidence/ecl-build-audit.log), [route crawl](/Users/shanakajayakody/eastcoastlabs/docs/audits/2026-09-07/evidence/ecl-public-route-audit.json), [guide checks](/Users/shanakajayakody/eastcoastlabs/docs/audits/2026-09-07/evidence/ecl-guides-audit.json), [certificate checks](/Users/shanakajayakody/eastcoastlabs/docs/audits/2026-09-07/evidence/ecl-coa-link-audit.json) and [dependency output](/Users/shanakajayakody/eastcoastlabs/docs/audits/2026-09-07/evidence/ecl-npm-audit.json) are retained with the audit.

## The first decisions to make

| Priority | Finding | Recommended decision |
|---|---|---|
| P0 · Code | Sequential order numbers authorise the public confirmation-page lookup | Replace display-number lookup with independent, scoped receipt/payment access tokens. Verify every HTML, RSC and status endpoint. |
| P1 · Conditional schema | Public review rows can expose the order UUID also used as payment-page authority | Remove internal order references from public review access and stop using the order primary key as the access secret. Verify deployed grants. |
| P1 · Live | Mobile checkout overflows its viewport | Fix intrinsic grid sizing and verify narrow widths before adding checkout features. |
| P1 · Code | Order creation and stock/status transitions span independent writes; errors can be ignored | Commit each business operation transactionally with idempotency and durable events. |
| P1 · Code | Full refund/cancel after partial refund can return original stock again; refund amounts ignore order discounts | Introduce one authoritative refund calculation and stock-return ledger. |
| P1 · Live + Code | Subscribe-and-save promises recurring delivery without a persisted recurring lifecycle | Withdraw or truthfully rename the offer until recurrence is explicitly implemented. |
| P1 · Live + Code | Certificate links and product/batch association cannot reliably support the proof claims | Repair certificate delivery, remove fixture substitution from production proof, and use explicit product/lot identities. |
| P1 · Code | Pausing/suppressing a customer does not reliably stop queued or failed marketing messages | Enforce eligibility immediately before send; use claim leases and cancellation states. |
| P1/P2 · Code | Product media/stock refreshes can discard unsaved details/pricing | Preserve drafts across refresh; add internal-navigation and concurrency protection. |
| P1/P2 · Code | Purchase tracking is uncalled; recovered revenue includes unpaid orders | Measure payment-confirmed, net revenue separately from order creation before assessing conversion experiments. |

### Urgent order access repair

The public thank-you page reads an order using only its supplied display order number through a privileged database client. It renders customer email, items and total, and can disclose the payment URL. The schema constructs those order numbers from an incrementing sequence. See [confirmation lookup](/Users/shanakajayakody/eastcoastlabs/storefront/app/(store)/checkout/thank-you/page.tsx:32) and [number generation](/Users/shanakajayakody/eastcoastlabs/storefront/supabase/migrations/20260724110000_commerce.sql:136).

Contain this first. Issue a cryptographically strong, separately stored or signed, scope-limited receipt token; validate it before fetching or returning any order data. Bind payment status and review flows to appropriately scoped tokens. Apply private/no-store handling and minimise identity shown on bearer-link pages. Tokens must be revocable, and expiry/recovery should suit the customer workflow. Do not “fix” this by merely changing the thank-you URL to the raw order UUID: the checked-in review grants create another path to that UUID.

Acceptance: two isolated synthetic orders cannot read each other through numbers, IDs, missing/tampered tokens or public reviews; permitted customer links still work. Verify HTML and streamed/RSC output, not only the visible component. Review deployed grants and relevant access logs through an authorised operational process. No live customer record was probed for this audit.

## Frontend optimisation plan

### 1. Repair the mobile purchase path before changing its styling

The mobile catalogue fits a 390-pixel viewport, while checkout extends to 510 pixels. The main form column is about 495 pixels wide. The likely mechanism is intrinsic minimum widths propagating through implicit CSS Grid tracks; the exact dominant descendant still needs isolation. The layout and field definitions are in [CheckoutForm](/Users/shanakajayakody/eastcoastlabs/storefront/components/CheckoutForm.tsx:119).

Use an explicit one-column mobile grid, `minmax(0,1fr)` for the flexible desktop column, and `min-width:0` on relevant grid children and controls. Ensure postcode/state and discount/apply groups can shrink. Fix the layout constraint rather than hiding horizontal overflow. Move validation errors into visible, specific messages near fields and a focused summary.

Acceptance: no horizontal scrolling at 320, 360, 375, 390 and 414 pixels, with long names, a discount, quote errors and 200% zoom. Validate the mobile keyboard does not cover the current field or final action. Estimated effort: 0.5–1 day, plus device QA.

### 2. Make the quote a reliable contract

Checkout currently retains an old quote while recalculating and silently catches quote failures. Some unavailable lines can be dropped by the server while the UI keeps displaying the original cart. These problems make the amount and contents under the “Place order” button less dependable than they should be.

Return resolved line items, availability, unit/line totals, shipping, discounts and warnings together with a quote version tied to the current input. Display explicit calculating, ready, stale and failed states. Only enable placement for a successful matching quote. If paid items, quantities or prices materially change at final validation, return the updated quote for review. Preserve unresolved cart lines. Give recoverable failures a retry action, and retain customer input.

Use one structured cart-line model for single items, packs, bundles, accessories and gifts. Stop treating display text such as “Subscribe” as business authority. Validate storage versions and quantities, reconcile old prices, and synchronise cart changes across tabs. Link each line to a valid destination: universal `/product/{slug}` links currently send stack/accessory buyers to nonexistent product pages.

Acceptance: delayed quotes, failed quotes, rapid method changes, a repriced item, an archived item, a removed accessory, two tabs and repeated submit all produce one clear, accurate outcome. This spans frontend and transaction work; allow 2–4 days for the UI/data contract, excluding the database transaction foundation.

### 3. Present payment as one continuous journey

Bank transfer is an intentional business constraint in this category. Optimise it directly. Tell shoppers before checkout which payment methods are actually enabled, when stock is held, when staff verify the transfer and when dispatch begins. The live sampled checkout offered bank transfer; code also supports configurable PayID.

Keep amount/reference copy controls and clear instructions. Unite the thank-you and payment experiences into one status-aware destination, reusing the existing payment poller. The current thank-you page always says the order is reserved and always describes transferring money, even after status changes. Pending, customer-reported transfer, verified payment, shipped, cancelled and refunded states need distinct language and next steps. Customer-reported transfer must never settle inventory or imply verified receipt.

Remove card-statement wording that is left over from the previous architecture. Exclude email capture and exit-intent prompts from checkout, receipt and payment pages. The current popup is globally mounted and can trigger from ordinary 45% scrolling after a short delay, including transaction routes.

Acceptance: a synthetic order moves pending → paid → shipped without contradictory requests to pay again; refresh/back works; cancelled orders show an appropriate recovery route; transactional pages never open a promotional overlay. UI effort: 1–2 days after receipt access repair.

### 4. Make the product page useful earlier on mobile

At 390 × 844, the BPC-157 image occupies a large part of the first screen; the title appears around 600 pixels down, followed by a dense scientific introduction. Pack prices and purchase choices are further below. The existing sticky CTA appears only after the main CTA has scrolled above the viewport, so it does not help initial discovery.

Recommended mobile order: breadcrumb → name and verified availability → concise specifications and relevant batch link → compact image → pack selection with total price → purchase action → delivery/payment details → full research description. A compact summary action may scroll to the pack choices; do not introduce a hidden default purchase.

The catalogue advertises the six-pack per-vial minimum while the product page defaults to a three-pack. Make the relationship explicit: show the single-vial price and a secondary bulk unit price with its required pack quantity/total. Test one-vial versus three-pack default only after tracking paid outcomes reliably. Ensure strength/volume is available as actual text, rather than requiring shoppers to read a vial image or infer it from SKU.

Keep the dark/teal brand and strong price/action contrast. Standardise image crops, label scale and card heights. Reduce decorative glow/particle emphasis where it competes with practical specifications. Any conversion improvement here is a hypothesis, not a measured result. Effort: 2–3 days for a focused PDP/card iteration.

### 5. Repair evidence and publication quality

The homepage displays a BPC-157 vial with floating batch `89845`/99.91% proof, while the results strip attributes that batch to KLOW. This follows directly from choosing the hero product and globally latest certificate independently. See [hero selection](/Users/shanakajayakody/eastcoastlabs/storefront/app/(store)/page.tsx:41). All 14 distinct linked COA PDFs returned HTTP 404 on GET, including BPC-157. The Janoshik verification endpoint returned 403 to the automated request; that result is inconclusive about whether a normal visitor can verify the certificate.

Tie displayed proof to the actual product and, eventually, the stock lot being sold. Publish real certificates to stable storage, validate document content type and successful access, and expose a searchable batch register with explicit product, lab, test date, certificate and verification links. An old test date alone is not proof that a batch is invalid; the relevant question is whether it is the batch actually available or shipped.

The COA loader currently falls back from Supabase to WooCommerce to a seed CSV and can present fixtures as ordinary proof. Production should show a truthful unavailable state if verified evidence is unavailable. Add a publication checklist for missing proof, placeholder copy and missing specifications. Enforce explicit IDs rather than fuzzy name matching.

Also finish the visible editorial gaps: `ABN: [PENDING]`, research-link placeholders, conflicting 98%/99% promises and same-day/one-business-day dispatch wording. Source support contact and policy text centrally. Provide approved privacy, shipping/payment, returns/guarantee and terms pages with useful links from checkout and footer. Policy accuracy belongs to the business and its qualified advisers; this audit does not determine legal compliance.

Acceptance: every proof CTA opens the intended document; no production fixtures or placeholder strings appear; hero, PDP and dispatched batch evidence agree; support/settings changes propagate. Allow 1–3 engineering days for immediate repairs and publishing checks; lot allocation is a separate admin work package.

### 6. Make product editing control the actual storefront

The admin stores descriptions in the database, but the PDP body still prefers a separate markdown copy source and does not fall back to the database description for its details section. A new product can therefore have an admin description without that description appearing publicly. Bundle prices also still derive from a static JSON price table, while individual pack prices now come from the database.

The SEO fields have a related disconnect: the admin edits `seo_title` and `seo_description`, but the catalogue query omits them and [product metadata](/Users/shanakajayakody/eastcoastlabs/storefront/app/(store)/product/[slug]/page.tsx:28) uses the product name and general description. Connect the saved overrides to metadata and preview, with explicit fallbacks. A preview of text that never reaches the page is misleading to the operator.

Define one content and pricing precedence: database product copy and active prices drive production; editorial fallback is explicit and temporary. Product preview must render the same component/data contract as the public page. Bundle prices and savings must use current component variants, with a deliberate admin override only where intended. Keep authoritative calculations in integer cents and allocate discounts consistently.

Availability must be shared too. Disable packs requiring more vials than are available, select an available default, and make bundle availability depend on components. Checkout must check parent product status as well as variant active status. A successful empty catalogue should remain empty; it must not resurrect the legacy JSON catalogue.

Acceptance: change description, price, status or stock once in admin and see the expected result across listing, PDP, bundle, quote and order. Test stocked-but-archived products and an intentionally empty catalogue. Effort: 2–4 days, shared with admin publication work.

### 7. Improve discovery without expanding the page indefinitely

Search and research-goal filtering already exist. Retain them. Add result counts, clear selected states, a reset action and an intentional no-results state. Persist useful filters in the URL so back navigation and shared links preserve context. Introduce simple price/name/availability sorting if real browsing needs justify it.

The live shop includes 17 catalogue products followed by accessories and 22 coming-soon entries. The upcoming list can overwhelm a mobile visitor who is trying to buy current stock. Show a small preview and a dedicated expandable/list destination for the remainder; retain per-product demand capture. Separate “available now” discovery from “tell us what to source”.

Use the homepage to answer five questions quickly: what is sold, what evidence supports it, what is in stock, how payment/dispatch works and where to browse. The existing long homepage repeats testing and guarantee content several times. Keep one strong summary and link to the detailed evidence. Reorder featured products from real paid-order data or explicitly call them “featured” rather than assuming a fixed list remains bestselling.

Acceptance: finding a known product, understanding its total price and reaching its certificate takes no unnecessary navigation; back/search state persists. Effort: 1–3 days. Prioritise using actual search and purchase behaviour once instrumented.

### 8. Establish shared accessible interaction patterns

The checkout's text fields rely on placeholders and its state dropdown is unnamed. The cart declares modal semantics but opening it leaves focus on the underlying trigger; closed content and the collapsed menu remain focusable in source. Admin confirmation dialogs have similar containment gaps.

Use persistent visible labels, associated ids, appropriate autocomplete/input types, fieldsets, helpful inline errors and a focused error summary. Make selected radio cards visibly keyboard focusable. Build one accessible dialog/drawer primitive with focus entry, containment, Escape, return-to-trigger, background inertness and coordinated scroll locking. Remove closed controls from the tab sequence. Add a skip link, readable small text and live announcements for cart/quote changes. Preserve the existing reduced-motion support.

The source colour pair `text-muted-2` (#667085) against `surface` (#121821) calculates to approximately 3.58:1; against `ink` (#080b10) it is 3.96:1. Where this pair is used for ordinary small text, increase contrast. This is a calculation from declared theme tokens, not a complete rendered contrast scan; opacity and local theme overrides must be checked in context.

Verify keyboard and screen-reader paths against [W3C label guidance](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html) and [reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). These identified issues are not a complete WCAG conformance assessment. Acceptance includes narrow/zoomed layouts, visible focus and no hidden focus targets. Allow 2–4 days across shared frontend/admin primitives and forms.

### 9. Fix crawl and content consistency before adding more SEO pages

Every live sitemap URL currently redirects from the apex to `www`; no canonical was present in the 29 checked pages. Pick the existing `www` production identity unless there is a deliberate domain decision, and use direct canonical/sitemap/social URLs consistently. Remove `/cart` from the sitemap; it is currently also disallowed in robots. Keep checkout, payment, confirmation and admin utility pages appropriately non-indexable. Audit the `/1` experiment explicitly so it does not become an unintended competing landing page.

Investigate why the live sitemap has 29 entries while the same local build generates 43 including research guides. Confirm the deployed source/build artifact and regenerate or invalidate the correct resource; simply adding guide code again would duplicate existing work. Verify each public metadata description, accurate Product offer/availability markup, social image and product/article internal link. Complete citations and editorial ownership before creating more research content.

Acceptance: indexable route inventory matches sitemap, canonical targets return direct 200s, no utility pages are advertised, all guide URLs are included, structured data matches visible price/stock. Use Search Console/Rich Results testing when account access is available. Effort: 1–2 days plus editorial review.

### 10. Optimise speed with measurements and budgets

The storefront already benefits from server rendering, system fonts on the primary design, `next/image`, explicit image sizing, route separation and five-minute regeneration on key listings. Its build-reported client JavaScript is moderate. Establish a baseline before undertaking a framework rewrite or blanket caching changes.

A direct asset sweep encountered HTTP 402 `OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED` on three declared 3840-width image variants. Smaller images did render in the browser. This is a confirmed image-variant availability problem, not proof that all product images are broken; check Vercel image usage/billing and newly requested transformations. Review actual rendered `currentSrc` sizes, upstream dimensions, responsive `sizes`, derivative count and cache headers. The asset sweep fetched declared HTML fallback URLs and must not be interpreted as a normal mobile waterfall.

Then profile cold and warm loads for home/shop/PDP/checkout. Measure database calls before request-memoising catalog, settings and proof reads. Split catalogue summaries from detail queries; query a product by slug independently of the current 100-row listing cap. Move review aggregates into bounded SQL calculations instead of fetching all bodies. Keep final price/stock validation authoritative and fresh. Lazy-load the rich editor behind its content section if profiling confirms it drives the admin product page's 257 kB first load; retain form/stock responsiveness during loading.

Target field p75 LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1 separately on mobile/desktop, matching the [Core Web Vitals definitions](https://web.dev/articles/defining-core-web-vitals-thresholds). Start with a no-regression route-JS budget against the measured build and a provisional goal to bring initial product-editor JS below 200 kB through editor splitting. That is an engineering target, not an observed result. Effort: 2–4 days after profiling; image service configuration may resolve faster.

## Admin optimisation plan

The admin already contains a dashboard/action queue, grouped navigation, command search, server-paginated orders, product rows, stock drawer, packing mode, customer profiles, recovery controls, reports, audit trails and cron health. The plan is to improve these existing workflows and their reliability. The most valuable admin design principle is that a displayed success must correspond to a durable, accurate business outcome.

### 1. Make payment, inventory and order state one operation

Current operations read an order, write stock movements, release reservations, update status and write events through separate calls. A retry, simultaneous admin tab or mid-operation failure can produce duplicate stock deductions or a status/email that does not match the database. Checkout creation similarly reserves lines and creates order/items/payment instructions separately.

Create one transaction/RPC for each allowed transition with row locking or conditional version checks, a caller operation key and unique stock movement identities. Commit order state, reservations, movements, payment/refund ledger entries, audit event and outbox intent together. Deliver email asynchronously after commit. Return an authoritative result/version to the UI; failed persistence must never show a success toast.

The existing single-pool stock reservation primitive is atomic and useful. Extend the transaction boundary around the business operation. Acceptance: duplicate payment confirmation, payment versus expiry, two refunds, process failure and submission retry preserve both money and vial invariants. Allow 6–10 days for the shared checkout/order foundation including focused concurrency tests.

### 2. Redesign refunds around money and physical returns

There are two distinct confirmed problems: full-order refund/cancellation can restore quantities already returned by a partial refund, and partial amounts use undiscounted item prices. Printed slips also show original quantities while the packing UI subtracts refunds.

Example: sell three units, partially refund/return one, then use full refund. Current paths can return one plus the original three to stock. Another example: sell a discounted line, then calculate refund from its undiscounted unit price; bookkeeping can exceed the amount actually paid.

Introduce a server-generated refund preview with remaining refundable amount, allocated discount, optional shipping amount, quantities, physical restock decision and notification consequence. Persist the refund and return separately with operation identities. In this bank-transfer system, “Record refund” and “Money returned” are different facts; record the external refund reference/completion where useful. Require a clear confirmation for whole-order refunds/cancellation, and hide transitions that cannot succeed for the current status.

Acceptance: partial → full, partial → cancel, odd-cent discounts, shipping, free gifts and repeated calls never exceed paid/returnable balances. Packing and print both use the same remaining-shippable projection. Allow 3–5 days beyond the shared transaction work.

### 3. Make fulfilment fast, recoverable and traceable

Use the existing packing mode as the operational centre. Present paid/unpacked work, oldest age, payment exceptions and missing tracking in saved queues. Show a clear next action on each order, with a compact payment/packing/tracking timeline and exception reason.

Batch actions need per-order outcomes. The server already returns failed IDs, but the UI discards them, clears selection and tells staff to open orders individually. Retain failed selections with reasons and links, and offer “retry failed” only after safe idempotency exists. Bulk shipping currently allows missing tracking; once shipped, there is no normal independent add/correct tracking action. Add audited tracking correction without replaying shipment or inventory settlement. Make optional correction emails explicit.

Lot traceability needs special treatment. Current slips infer the latest certificate from fuzzy compound names, so an old order's printed batch can change after a new result appears. Model received inventory lots and the lot actually picked; snapshot that allocation on fulfilment. Until then, label generic latest certificates truthfully rather than asserting they identify the parcel. Treat ten-day automatic completion as age-based administration, not verified carrier delivery.

Acceptance: printed and onscreen quantities agree; a partially failed batch is recoverable without reconstructing work; tracking can be corrected; historical batch references remain stable. Allow 2–4 days for queue/print/tracking UX and 3–6 days separately for lot allocation, depending on receipt workflow complexity.

### 4. Protect product drafts and make publishing predictable

The product form resets to new props after image/stock actions refresh the route. That can wipe unsaved description and price edits. The current unload guard also does not cover ordinary client-side navigation. A “save all” operation writes product details and variants separately, so a failed save can still publish part of the change.

Keep a draft buffer and saved baseline/version per product. Merge media/inventory refreshes without replacing dirty editorial fields. Make internal navigation honour save/discard. Detect concurrent edits and offer a clear conflict resolution. Save product details, variants and thresholds transactionally after server validation, and invalidate relevant public data once after success.

Organise the existing editor around Details, Pricing, Media, Inventory & lots, and SEO, with a persistent save/status strip. Add a publish-readiness summary for missing copy, real images, valid tiers, evidence and fulfilment information. Show a real storefront preview that uses the production content source. Split heavy editor code only after draft reliability is corrected.

Acceptance: edit text → upload image → receive stock → save preserves the draft; internal next/back prompts appropriately; middle-variant failure publishes nothing; preview and live PDP agree. Allow 2–4 days, sharing the content/pricing work with frontend.

### 5. Treat stock receipts and cost corrections as a ledger

Current “Undo” reverses received units but not the weighted cost basis; a receipt may already have queued a restock email. This makes “Reverted” misleading. Cost tagging also finds the latest receipt rather than using the exact returned movement ID.

Return the receipt/movement identity from the transaction. Model an auditable reversal linked to that receipt, with both unit and valuation effects, and state the notification consequence. Prefer a correction/reversal record to rewriting history. Show on-hand, reserved and available distinctly, with a plain-language reason and source order/receipt for every movement. Preserve frozen sales COGS; do not rewrite historical margin when receiving a new cost.

Acceptance: receiving and reversing units at a different cost restores intended units and valuation; competing receipts tag correctly; historical order COGS stays fixed. Allow 1–3 days after transaction foundations.

### 6. Make People complete and searchable

The People source explicitly takes only the first 1,000 customers and then filters/pages in memory. Other subscriber/cart reads are unpaged. This can hide older or lower-value people from search, segments and exports; it is a confirmed implementation limit, not a claim that the current database exceeds it. Some order badge counts have similar unbounded-read assumptions.

Move person identity, segmentation, search, sort and count into stable database queries/views. Use server pagination and explicit full export paging, with unique tie breakers. Display exact “showing N of M” counts. Keep the useful customer timeline, notes, tags and sequence controls already present. Surface the next relevant action and reason, especially pending payment, fulfilment issue or opted-out marketing state.

Acceptance: in fixtures exceeding 1,000 customers and subscribers, search finds the last record, segment/list/export counts agree and failures do not masquerade as empty data. Allow 2–4 days. Index changes should follow actual query plans, not guesswork.

### 7. Make recovery reporting financially meaningful

Recovery date controls change metrics but not the cart list, and tab links discard the period. The list is capped at 50 without a route to older work. “Recovered revenue” sums orders created before payment and can include refunded amounts. The funnel divides carts by emails, mixing different units and cohorts.

Separate today's work queue from historical results. Preserve date/tab/filter context. Model immutable cart/recovery episodes with capture, exposure, order-created and paid timestamps rather than continually overwriting one cart per email. Show “checkout resumed”, “payment received”, “net recovered revenue” and “email delivered” as separate concepts. Calculate conversion using distinct eligible/exposed carts and document the attribution rule.

Acceptance: unpaid checkout contributes no paid revenue; refunds reduce net revenue; organic recoveries are not automatically attributed to an email; old month selections show matching results; >50 carts remain accessible. Allow 2–4 days.

### 8. Give operators dependable automation controls

Pausing a sequence, suppressing a person or stopping cart recovery must affect pending marketing sends. Today the sender retries queued/failed rows without rechecking those decisions. A public subscribe call can also clear suppression without proof that the mailbox owner renewed consent.

Enforce current marketing eligibility at dispatch, with transactional messages deliberately distinguished. Cancel pending messages when the corresponding workflow stops; model already-claimed/in-flight outcomes honestly. Use worker claims/leases, provider idempotency, retry backoff, dead-letter states and selected-message retries. Unsubscribe and preference updates must not report success when persistence fails.

Build an Automation work area from existing outbox and cron data: overdue jobs, oldest queued message, partial failures, cancelled/paused work, readable errors and safe retry. The repository schedules hourly GitHub sweeps plus daily Vercel backstops. Current health treats all jobs as daily with a 30-hour overdue threshold; configure freshness per job and alert independently if the scheduler itself stops. Only add run-now/global pause after the operations are safe under overlap.

Acceptance: queue → fail → suppress/pause → retry sends no marketing; two workers deliver once; bad old jobs do not starve new work; hourly failures become visible within the chosen hourly SLO. Allow 4–7 days for worker/control/health improvements, with shared backend work counted once.

### 9. Make settings changes safe and legible

Settings are currently saved through many independent writes. Shipping rates/thresholds and hold-window values need stronger finite/bounded server validation; malformed currency can become invalid numeric data. Support contact settings also do not propagate to all public hardcoded locations.

Group settings by Checkout & payments, Shipping, Store content/contact and Automation. Explain what each value affects and show a human-readable before/after summary for consequential payment/hold settings. Validate the complete configuration, then save it in one transaction with audit diff/version. Show field errors and prevent partial publication. Reuse the same settings contract in checkout, emails, footer and product pages.

Acceptance: malformed amounts or incompatible hold/expiry values write nothing; a valid free-shipping configuration works; all affected surfaces use the saved values; concurrent saves do not silently overwrite. Allow 1–2 days.

### 10. Refine admin structure after the correctness repairs

Recommended navigation groups are Operations (Overview, Orders, Packing), Catalogue (Products, Inventory & lots, Lab results), Customers (People, Recovery), Automation (Queues, Sequences, Templates), and Business (Reports, Audit, Settings). Reuse current navigation definitions and command search. These are organisational proposals, not a requirement to build every group immediately.

Keep operational screens dense enough for work: sticky table headings, consistent status language, preserved filters, visible selected count, empty/error/loading states and durable bulk results. Prioritise keyboard shortcuts that already fit the table model. An optional light theme may improve prolonged admin use for some operators; validate preference before investing. Expand role/access management only when staffing creates a real need, while retaining the current active allowlist.

Acceptance: an operator can find and complete the five key scenarios in the release checklist without knowing table names or developer tools. Measure completion time and correction rate, then refine navigation. Allow 1–3 days for a focused polish pass; a full visual redesign is discretionary.

## Shared engineering and observability work

Four cron endpoints currently check their bearer secret only when the environment variable is truthy. Missing configuration therefore fails open. Reuse the daily-brief endpoint's fail-closed pattern: absent config refuses execution; wrong/missing credentials refuse execution. Validate this in an isolated environment rather than calling live mutation jobs.

The migration runner reapplies every historical SQL file without a ledger. Some historical seed upserts reset products to `coming_soon` and overwrite content, so a routine re-run can undo launches. Two migration files share a timestamp version. Adopt tracked immutable migrations with unique identities and separate seed/bootstrap data from schema deployment. Verify that applying no new migrations leaves an admin-edited catalogue unchanged.

Configure an actual lint command and commit its configuration. Add CI for build, typecheck, lint, isolated migration/access tests and the few critical commerce/browser scenarios below. Existing live mutation verification scripts should not become the default test suite. The build also inferred the workspace root from a parent-home lockfile; explicitly set the tracing root and confirm required content files are present in deployed artifacts. Update the README/runbook, which still contain obsolete WooCommerce/cart/gateway assumptions.

Triage the dependency audit with reachability and supported compatibility in mind. The [sharp advisory](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) concerns vulnerable upstream image processing, while the [nanoid advisory](https://github.com/advisories/GHSA-2v37-7h3g-55p8) describes a particular custom-generator condition. Do not run an unreviewed major `audit fix --force`: the reported fix path includes a Next major upgrade. Patch/relock compatible dependencies, inspect remaining transitive exposure and test any framework upgrade deliberately.

Add application error reporting and real-user vital measurements with sensitive fields removed. Instrument quote failure reason, payment verification lag, stock mismatch, job delay and admin mutation failure. Review public write abuse controls for checkout reservations and subscriptions; runtime schemas should bound strings/quantities/source values, and rate limits should be proportionate. Existing hosting WAF/rate-limit configuration was not inspected, so its absence is not alleged.

## Delivery sequence and effort

These are planning ranges in experienced engineering days, including focused implementation tests. Shared work is counted once in the programme estimate; individual package estimates above overlap. Content approval, supplier certificates, hosting-account decisions, formal access review and carrier integration can affect elapsed time. Do not delay critical containment to assemble a large release.

| Phase | Scope | Owner profile | Exit condition | Rough effort |
|---|---|---|---|---|
| 0 — Contain and unblock | Receipt tokens/review projection; fail-closed crons; mobile overflow; unsupported recurrence offer; broken proof/image-service triage | Full-stack + owner | No display-number access; small-screen checkout fits; public promises are actionable | 3–5 days |
| 1 — Commerce invariants | Transactional checkout/transitions; idempotency; refunds/stock; authoritative quote and sale eligibility; focused regression suite | Backend/full-stack | Race/failure tests preserve money, order and stock invariants | 8–12 days |
| 2 — Frontend confidence | Product/mobile hierarchy; truthful payment flow; content/price source; accessibility; initial analytics; SEO repairs | Frontend + owner/editor | Complete public journey is accessible, consistent and measured | 5–8 days |
| 3 — Admin daily work | Draft protection; transactional saves; refund/print consistency; bulk results; tracking; settings/receipts; People paging | Full-stack + operator QA | Five core operator scenarios pass without lost work or manual DB intervention | 8–12 days |
| 4 — Automation and data | Safe worker/retries/suppression; job health; recovery attribution; query/aggregation improvements | Backend + frontend | Controls stop intended sends; truthful counts/revenue; timely failure visibility | 6–10 days |
| 5 — Hardening and measured optimisation | Migration/deployment guardrails; dependency remediation; editor split; vitals/error budgets; focused UX polish | Full-stack | Repeatable CI/deployment and measured performance baseline | 5–8 days |

Core programme estimate: **35–55 engineering days**, roughly **7–11 working weeks for one experienced engineer**, or potentially **5–8 elapsed weeks with two complementary engineers**, depending on shared prerequisites and review capacity. Dedicated lot allocation adds approximately 3–6 days if not folded into phase 3. A true recurring-delivery platform, carrier integration and a new visual theme are separate optional scopes.

Phases 2 and 3 can proceed in parallel once the shared contracts are stable. Deliver small reversible releases with staging fixtures and production smoke checks. Use an expand/migrate/contract approach for access tokens and schema changes so customer links and order handling do not break mid-rollout. Maintain the legacy access path only if it is made secure; convenience must not preserve the identified exposure.

## Measurement and acceptance

Capture at least a representative baseline period after event repair; traffic volume and payment delay determine how long is enough. The existing `trackPurchase` function has no caller. Queue early browser events until analytics is ready. Distinguish `order_created` from confirmed paid `purchase`, deduplicate by transaction identity and avoid personal data. Follow [Google's ecommerce event model](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce) and validate with debug tooling. Revenue reconciliation should use the database as the financial authority.

| Area | Metric/target | How to verify |
|---|---|---|
| Commerce integrity | Exactly one order per checkout attempt; no duplicate stock movement; refunds ≤ paid balance | Isolated database concurrency and fault-injection tests |
| Product publishing | One admin update produces consistent copy, price and availability | Fixture product through listing → PDP → bundle → quote → order |
| Checkout usability | No overflow; clear recoverable quote errors; no unreviewed material changes | Mobile/zoom/keyboard journey; throttled/failing quote responses |
| Accessibility | No unnamed critical controls or offscreen focus; dialogs contain/restore focus | Automated checks plus manual keyboard/VoiceOver pass |
| Conversion | PDP-to-cart, checkout-to-order and order-to-paid measured separately | Cohort by device/source/variant; reconcile paid events with DB |
| Margin | Net paid revenue and contribution margin, with refunds/costs | Test discounted/returned orders and cohort reports |
| Admin efficiency | Baseline and then target ≥30% less time on selected repeat tasks | Same operator, same staged scenario set; a goal to validate, not a promised outcome |
| Recovery | Distinct exposed-cart paid conversion and net recovered revenue | Cohort fixtures, delayed payments, organic recoveries and refunds |
| Automation | No ineligible marketing sends; durable retries; job freshness per cadence | Provider fakes, parallel workers, stopped scheduler and backlog tests |
| Performance | Field p75 LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1; route JS no regression | Real-user measurements segmented mobile/desktop, plus repeatable lab baseline |

**Release checklist:** guest browse/search → product/pack → cart → checkout → secure payment status; quote failure and stale-price reconciliation; duplicate submit; partial refund → full refund/cancel; payment versus expiry race; pack/print with refunded lines; bulk ship with partial failure → tracking correction; product details → media → stock → save; customer search/export beyond 1,000 → suppress a queued message; historical recovery period and cohort; failed-send retry and overlapping workers; migration reapplication after an admin product launch; anonymous receipt/review access isolation.

Run state-changing cases in an isolated staging database with fake email delivery and synthetic orders. Public read-only checks can run against production. Confirm live deployment parity, account-level image limits, analytics configuration, actual DB grants and backup recovery separately before claiming those areas verified.

## Suggestions worth testing after the repairs

The most useful experiments are a shorter mobile PDP intro, more explicit single-versus-bulk pricing, product-matched evidence next to the CTA, a shorter homepage and reduced coming-soon clutter. Test a limited number of hypotheses at once against paid conversion, margin, refund rate and support load. A result that increases carts but reduces payment completion is not a win.

Retain the scientific identity but make it practical: accurate specifications, accessible certificates, honest availability and clear fulfilment expectations carry more weight than additional visual effects. For the admin, focus on a reliable work queue, preserved drafts and recoverable exceptions. Those improvements support both conversion and operational capacity without requiring the existing application to be replaced.
