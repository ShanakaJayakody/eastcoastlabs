# ECLLEGACY operations runbook

## Release status and boundaries

The legacy-pricing release is complete and locally verified, but it has **not** been deployed. `20260928100000_legacy_pricing.sql` must capture production before any catalogue price increase, and the matching application deployment must be verified before a later, separately reviewed price-increase release begins. This release does not increase any price.

`ECLLEGACY` is a frozen price book, not a percentage discount:

- Eligibility is the normalized (`lower(trim(email))`) email from an order that was `paid`, `processing`, `shipped`, or `completed` when the migration captured production. Later orders do not add eligibility.
- The snapshot includes every active variant of an active product at capture time, including accessories and all pack sizes. Later variants are not added automatically.
- For an eligible direct-purchase line in the snapshot, the effective goods price is the lower of the current unit price and the captured unit price. Shipping, extras, gifts, and stack or bundle price overrides are excluded. The code does not stack with another code.
- The program has no expiry, minimum spend, or usage limit. Its `discounts.active` value is the protected operational switch; the admin application allows enable/disable but prevents deletion of the legacy program.
- Captured prices and customers are immutable. `legacy_discount_captures` contains the durable `ECLLEGACY` completion marker, capture timestamp, discount identity, and captured counts, including when either count is zero. A repeated capture sees this marker and makes no additions. Do not update or delete the marker or snapshot rows.
- New customer eligibility or variant coverage requires an explicit reviewed migration. Never insert additions as part of checkout, an order-status change, or routine administration.

Paid legacy orders retain their recorded financial evidence. If an order has ever been paid, cancelling and reinstating it does not permit quantity changes; create a replacement order when quantities must change.

## Activation sequence

1. Use the exact reviewed release source and recheck the target project, repository migration ledger, predecessor metadata, catalogue state, and absence of `ECLLEGACY`. Do not use a dirty checkout.
2. Apply `20260928100000_legacy_pricing.sql` exactly once while current prices are still the intended legacy prices. Record its exact SHA-256 in `ecl_migrations.schema_migrations` atomically with the migration.
3. Run only the aggregate verification below. Never print, select for display, copy, or export `legacy_discount_customers.email` during verification.
4. Deploy the matching application revision and verify its production checkout surface without placing a real order. Use synthetic staging data for the eligible purchase path.
5. Only after the snapshot and matching application are verified may a separate reviewed catalogue-price release begin.

### One-time predecessor metadata reconciliation

The audited production environment has two already-applied predecessor migrations whose schema, function bodies, configuration, privileges, and indexes were verified, but whose ECL migration-ledger rows are missing:

- `20260927120000_order_status_counts.sql`
- `20260927130000_fulfilment_analytics.sql`

For this production state only, the reviewed MCP release envelope may atomically insert the two allowlisted filename/SHA-256 metadata rows before applying the legacy migration. It must not replay either predecessor's DDL; in particular, replaying the existing plain `CREATE FUNCTION` statements would fail. This is a one-time reconciliation exception, not permission to baseline unknown history or repair checksum mismatches. The audit and envelope evidence are in `.superpowers/sdd/2026-09-28-legacy-pricing/production-preflight.md` and `.superpowers/sdd/2026-09-28-legacy-pricing/release-envelope-review.md`. Recheck the remote metadata and privileges immediately before activation, and regenerate/review the envelope if the legacy migration changes.

## Aggregate verification

Run these queries exactly. They return counts only and do not expose customer addresses.

```sql
select
  (select count(*) from public.legacy_discount_prices lp
   join public.discounts d on d.id=lp.discount_id where d.code='ECLLEGACY') as captured_variants,
  (select count(*) from public.product_variants v
   join public.products p on p.id=v.product_id where v.active and p.status='active') as current_active_variants;

select count(*) as eligible_customers from public.legacy_discount_customers c
join public.discounts d on d.id=c.discount_id where d.code='ECLLEGACY';

select count(*) as pre_increase_price_mismatches
from public.legacy_discount_prices lp
join public.product_variants v on v.id=lp.variant_id
where lp.price_cents<>v.price_cents;
```

At activation, `captured_variants` must equal `current_active_variants`. Before the later catalogue price increase, `pre_increase_price_mismatches` must be zero. After that separate release, the mismatch count is expected to include variants whose live prices changed; it is therefore not an ongoing snapshot-corruption check.

Also confirm that the `ECLLEGACY` discount is `kind='legacy_price'`, active, has zero minimum spend, and has null start, expiry, and usage-limit values. Confirm its `legacy_discount_captures` counts agree with the aggregate results. Do not query individual eligibility rows or customer emails.

## Emergency disable and recovery

Disable new use of the program without deleting evidence:

```sql
update public.discounts set active=false where code='ECLLEGACY' and kind='legacy_price';
```

Reactivation is the exact inverse after the incident is understood:

```sql
update public.discounts set active=true where code='ECLLEGACY' and kind='legacy_price';
```

Do not delete or rewrite the discount, completion marker, captured prices, or captured customers. Disabling the program preserves historical paid orders and their exact line allocations. An unpaid materially edited or reinstated order must revalidate successfully or lose the code with audit evidence.

## Local release evidence

At commit `7a57adc`, local verification passed 903 unit/integration tests, 27 native PostgreSQL checks, 77 browser checks with 7 intentional viewport-inapplicable skips, typecheck, lint, production build, 9 header checks, 6 JavaScript budget checks, and a dependency audit reporting zero vulnerabilities. The observed non-failures were a pre-existing React unoptimized boolean-attribute warning in `tests/storefront/editorial-discovery.test.tsx` and webpack cache string-serialization performance warnings during the build.
