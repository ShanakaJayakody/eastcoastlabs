# ECLLEGACY Legacy Pricing Program

## Status

Approved conversational design, recorded on 28 September 2026. This document defines the implementation scope. The legacy snapshot must be deployed before any catalogue price increase.

## Purpose

East Coast Labs intends to increase catalogue prices while allowing its original customer base to keep the prices available immediately before that increase. Eligible customers enter `ECLLEGACY` at checkout with the email address used for a qualifying historical order. The code is valid indefinitely.

The program is a price lock, not a percentage promotion. Each included variant returns to its own captured price, regardless of the later percentage increase.

## Agreed Policy

- Code: `ECLLEGACY`, matched case-insensitively.
- Eligibility is frozen when the production migration runs.
- A normalized email is eligible when it belongs to an existing order whose status is `paid`, `processing`, `shipped`, or `completed` at snapshot time.
- Eligibility does not grow automatically after launch.
- Every active product variant present at snapshot time is included, including accessories and every pack size.
- Future variants, shipping, non-variant extra items, and stack or bundle price overrides are excluded.
- For an included direct-purchase variant, the charged goods price is the lower of its current price and its captured legacy price.
- The code has no expiry, minimum spend, or usage limit.
- The checkout accepts one discount code, so `ECLLEGACY` cannot stack with another code.
- Existing bundle pricing remains intact and does not receive a second legacy reduction.
- An emergency active flag can disable the program without deleting its evidence.

## Existing Boundaries

The storefront already derives catalogue and checkout prices on the server. The browser submits item identities and quantities, while `resolveCart` resolves active variants and current prices. Checkout quoting validates a discount, and `commerce_create_order(jsonb)` independently checks prices, the discount, the expected total, and inventory inside the database transaction. Orders store subtotal, discount, shipping, total, code, and per-line discount allocations used by refunds and analytics.

The implementation must extend these boundaries rather than moving pricing authority into the browser.

## Data Model

### Discount record

Extend the `discounts.kind` constraint with a `legacy_price` kind and allow that kind to have null `percent` and `value_cents`. Insert one `ECLLEGACY` row with:

- `kind = 'legacy_price'`
- `active = true`
- `min_spend_cents = 0`
- `usage_limit = null`
- `starts_at = null`
- `expires_at = null`

The existing discount record provides the code identity, active switch, usage audit count, and order association.

### Immutable price book

Create `legacy_discount_prices` with:

- `discount_id`, referencing `discounts.id`
- `variant_id`, referencing `product_variants.id`
- `price_cents`, constrained to a non-negative integer
- `captured_at`
- primary key `(discount_id, variant_id)`

The migration inserts one row for every active variant belonging to an active product. Application and admin price edits never update these rows.

### Frozen customer eligibility

Create `legacy_discount_customers` with:

- `discount_id`, referencing `discounts.id`
- normalized lowercase `email`
- `source_order_id`, referencing a qualifying historical order
- `captured_at`
- primary key `(discount_id, email)`

The migration inserts one row per normalized email from qualifying orders. A deterministic qualifying order is retained as audit evidence when an email has several orders. No checkout or order-status transition adds eligibility later.

### Order-line auditability

Add `legacy_discount_eligible boolean not null default false` to `order_items`. Direct variant items created without a server-derived price override are eligible for price-book comparison. Gifts, stack components, bundle allocations, and non-variant extras are not.

All new tables use row-level security and remain inaccessible to `anon` and `authenticated`. Only the service role and tightly scoped commerce functions may read them. Customer emails and membership must never be returned to the browser as a list.

## Server Pricing API

Introduce one shared server-side pricing operation for legacy codes. It receives the normalized code, normalized checkout email, and the already server-resolved item identities, quantities, effective prices, and legacy-eligibility flags. It returns a structured result containing:

- whether the code is valid and active;
- whether the email is eligible;
- the total discount in cents;
- the discount attributable to each eligible variant line;
- a stable customer-facing error category when it cannot apply.

For each eligible direct line, the discount is:

`max(0, effective current unit price - captured legacy unit price) * quantity`

Lines without a price-book row receive no legacy discount. A mixed cart is valid when at least one line receives a legacy reduction. If every applicable current price is already equal to or below its legacy price, the code remains valid and the lower current prices win; the checkout may show a zero legacy discount without increasing any line.

Generic percent and fixed discounts continue through their existing path unchanged.

## Checkout Data Flow

1. The customer enters cart items, email, and optional code.
2. When `ECLLEGACY` is entered before an email, checkout asks for the previous-order email and does not claim the code is valid yet.
3. `resolveCart` resolves authoritative variants, quantities, current effective prices, stock, bundle overrides, and gifts.
4. Discount validation normalizes the email and calls the shared legacy pricing operation.
5. The quote displays the normal goods subtotal, the `ECLLEGACY` discount, shipping based on the post-discount goods total, and the final total.
6. The quote version includes normalized email, code, resolved items, line eligibility, discount allocation, and totals so a changed email, price, item, or program state invalidates confirmation.
7. `commerce_create_order` repeats code status, frozen email eligibility, price-book lookup, line calculation, expected-total validation, and stock reservation within the order transaction.
8. The order stores the normal subtotal, exact legacy discount, `ECLLEGACY`, shipping, final total, and exact per-line discount allocations.

The browser never supplies a trusted legacy price, eligibility decision, or discount amount.

## Allocation, Refunds, and Order Editing

Generic discounts retain proportional allocation. `ECLLEGACY` uses exact per-line allocation from the price-book difference, leaving future variants and excluded lines at zero allocation. This preserves the intended net price for partial refunds and analytics.

Admin quantity edits and reinstatement recalculate `ECLLEGACY` with the order's normalized customer email, stored line unit prices, current quantities, immutable legacy prices, and line eligibility. If the program is disabled, existing paid orders retain their recorded financial history; an unpaid order being materially edited must either revalidate successfully or lose the code with an explicit audit event.

Manual admin-created orders use the same database rules. An administrator cannot grant `ECLLEGACY` to an ineligible email merely by typing the code.

## Customer Experience and Errors

Customer-facing outcomes are deliberately specific without disclosing customer membership beyond the supplied email:

- Missing email: ask for the email used on the previous order.
- Ineligible email: explain that the code must be used with the previous-order email.
- Inactive or unknown code: use the existing invalid-code message.
- Mixed cart: apply legacy pricing only to included lines; retain standard pricing elsewhere.
- No snapshotted lines: explain that the code does not apply to the current cart.
- Price or eligibility changed before submission: return a refreshed quote and require confirmation again.
- Temporary validation failure: fail closed and leave the code unapplied; never guess a discount.

The checkout must not reveal whether any other email is eligible or expose the size of the customer list.

## Observability and Operations

- Keep `discounts.used_count` behavior: increment only when an order using the code becomes paid.
- Preserve `orders.discount_code`, `orders.discount_cents`, order-item allocation, commerce events, and audit-log evidence.
- Production verification reports only aggregate eligible-customer and captured-variant counts plus non-sensitive price-book integrity checks.
- The emergency response is to set the `ECLLEGACY` discount record inactive. Snapshot rows remain immutable for diagnosis and recovery.
- Any later inclusion of another customer or variant requires an explicit reviewed migration or administrative operation outside this initial scope.

## Migration and Release Sequencing

1. Re-run the full migration chain and legacy-pricing tests locally.
2. Apply the snapshot migration to production while current prices are still the intended legacy prices.
3. Verify the repository migration checksum, aggregate customer count, active variant count, and one non-sensitive price calculation without returning customer emails.
4. Deploy the matching checkout application and database-function changes.
5. Exercise staging acceptance for eligible, ineligible, mixed, and changed-price cases using synthetic records.
6. Verify the production checkout surface without placing a real order.
7. Only after the snapshot and checkout release are verified may catalogue prices be increased in a separate reviewed change.

If application deployment cannot immediately follow the migration, existing checkout behavior remains unchanged because no price increase has occurred and the new discount kind is not submitted by the old UI. The price increase must not proceed until the matching application is live.

## Verification Strategy

### Migration and database tests

- Snapshots every active current variant exactly once and excludes inactive variants.
- Freezes normalized unique emails only from qualifying historical statuses.
- Excludes pending, cancelled, expired, and fully refunded orders.
- Proves the snapshot is idempotent without overwriting captured prices or expanding eligibility.
- Rejects anonymous and authenticated access to legacy tables and functions.
- Confirms direct database calls cannot forge email eligibility, a legacy price, a discount amount, or a future-variant discount.
- Confirms concurrent price changes cause quote mismatch rather than an incorrect order.

### Application tests

- Eligible email receives exact captured prices across 1-, 3-, and 6-pack variants and accessories.
- Email matching is trimmed and case-insensitive.
- Ineligible and missing emails receive the approved messages.
- Mixed carts discount only snapshot direct-variant lines.
- Future variants, extras, gifts, and stack overrides remain standard-priced.
- A current sale below the legacy price wins.
- Free-shipping and gift thresholds use the post-discount goods total.
- Quote version changes when email, eligibility, program state, items, or prices change.

### Financial workflow tests

- Exact line allocation sums to the order discount.
- Partial and full refunds return the correct net amount.
- Admin quantity edits and reinstatement preserve or explicitly remove legacy pricing according to program state.
- Paid transition increments code usage exactly once.
- Analytics and receipts report current subtotal, legacy discount, and net revenue consistently.

### Browser acceptance

- Applying the code before entering email prompts for the order email.
- Eligible checkout clearly shows `ECLLEGACY` and the exact discount.
- Ineligible checkout explains the eligibility requirement without leaking other data.
- Updating email, cart, or shipping refreshes the quote and prevents stale submission.

## Non-Goals

- Choosing or applying the planned 20–40% catalogue increases.
- Giving legacy eligibility to customers who purchase after the snapshot.
- Customer accounts, login requirements, personalized codes, or self-service eligibility management.
- Legacy pricing for shipping, future variants, non-variant extras, or stack/bundle overrides.
- Combining `ECLLEGACY` with another discount code.
- Deleting or rewriting historical orders.

## Success Criteria

The feature is complete when an eligible frozen customer can enter `ECLLEGACY` with their historical order email and pay no more than the captured price for every directly purchased current variant, while ineligible customers, future variants, browser tampering, concurrent changes, bundles, shipping, refunds, and reporting all behave according to this specification.
