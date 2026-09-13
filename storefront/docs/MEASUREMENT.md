# Measurement configuration and readout

Measurement is off when `NEXT_PUBLIC_GA4_ID` is absent. When it is present, public pages ask for an analytics choice before loading Google Analytics or retaining acquisition. `AnalyticsConsentControls` is also available on the privacy page so a visitor can change or withdraw that choice. Private payment, recovery, review, subscription, unsubscribe and admin routes remain outside the analytics allowlist. Browser events always replace the page location with an allowlisted origin plus pathname and set an empty referrer.

First-party acquisition accepts only known source and medium values. Campaign IDs must appear in the comma-separated `NEXT_PUBLIC_MEASUREMENT_CAMPAIGNS` value and in an active service-only `measurement_campaigns` row. The default empty list retains no campaign. The checkout server validates the consent and cookie again; the database validates the persisted shape and scrubs optional campaign or experiment dimensions that have since been retired instead of blocking an order. A committed order keeps its original validated snapshot if configuration is retired before an idempotent retry or delayed payment. The first valid acquisition touch wins. Missing, numeric, name-bearing, malformed or unconfigured values remain unattributed. Email, phone, search terms, arbitrary UTM content, query strings and raw referrers are never stored.

Experiments require two matching declarations before any assignment is retained:

- `NEXT_PUBLIC_MEASUREMENT_EXPERIMENTS` uses `experiment-id:control|holdout` declarations separated by commas.
- `measurement_experiments` contains the same ID and allowed arms with `active=true`.

The pure `stableExperimentVariant(config, anonymousSubject)` helper provides deterministic weighted allocation for a predeclared anonymous eligible subject. `recordExperimentAssignment(config, variant)` stores a validated first assignment after allocation. The `/` and `/1` routes do not allocate traffic and `NEXT_PUBLIC_HOMEPAGE_EXPERIMENT_ACTIVE` is empty by default, so those designs are not reported as a randomized test. Activating a test also requires a real eligible-traffic allocator, exclusions, one primary metric, minimum worthwhile effect, power/sample method, duration and payment/refund maturation rule.

Configure database rows through a reviewed service-role migration or authorised operational session. Do not activate placeholders:

```sql
insert into public.measurement_campaigns(id,active) values ($1,true);
insert into public.measurement_experiments(id,variants,active) values ($1,$2::text[],true);
```

The browser helper contracts are:

- `commerceItem({slug,name,size?,pack?,price?,quantity?}): GaItem`, where `GaItem.item_id` is the canonical parent catalogue slug and `item_variant` is size plus pack.
- `trackViewItem`, `trackViewItemList`, `trackSelectItem`, `trackSelectSize`, `trackSelectPack`, `trackAddToCart`, `trackRemoveFromCart`, and `trackBeginCheckout`.
- `trackQuoteRequested(requestId)`, `trackQuoteReady(requestId,durationMs)`, and `trackQuoteError(requestId,durationMs,code)` for UUID request IDs and bounded durations. Error codes are `timeout`, `network`, `server`, `invalid_response`, and `stale`.
- `trackPaymentStep(step,method?)`. Steps are `method_selected`, `order_submitted`, `order_created`, and `instructions_viewed`; methods are `bank_transfer` and `payid`. The private-route guard still suppresses events on private payment URLs.

After staging deployment, verify actual ingestion rather than relying on HTTP 2xx:

1. With a synthetic consent choice and a configured non-production campaign, inspect the browser request and GA DebugView. Confirm the URL has no query/hash/referrer or contact data and that catalogue item IDs match their paid snapshot.
2. Create and pay a synthetic staging order through the normal idempotent flow. Confirm there is no paid intent at order creation, one intent at the first paid transition, the real paid timestamp, AUD currency, exact discounted goods value, separate shipping, canonical slug, size/pack, and configured acquisition/assignment.
3. Retry the same payment transition and worker delivery. Confirm the local purchase identity/payload do not change and provider reporting does not show an extra transaction. A transport retry is still at least once; reconcile uncertain provider outcomes.
4. Record controlled partial/final refunds and confirm each immutable delta uses its actual event time and original transaction ID. Reconcile provider reporting manually because refund deduplication is not assumed.
5. Compare `orders.attribution`, `paid_analytics_outbox`, and provider reports. Report consent/client-ID coverage separately from ledger revenue. Test applicable delayed bank-transfer session association; never move the paid timestamp or fabricate a session ID to force attribution.

For an experiment readout, freeze eligibility and exclusions, check sample-ratio mismatch, and wait for the declared paid/refund window. Join assignments from `orders.attribution` to paid orders and contribution using the originating cohort. Preserve unattributed orders in coverage counts. Report inconclusive results as inconclusive; route traffic, vendor attribution and transport acceptance are not evidence of incrementality.
