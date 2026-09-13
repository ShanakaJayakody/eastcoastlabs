# Payment and refund analytics

Purchase reporting uses the confirmed payment transition, not order creation or a visit to a receipt/payment page. Migration `20260908160000_paid_analytics.sql` inserts one immutable analytics intent per order inside the payment transaction. A later paid reinstatement preserves the first intent and timestamp. Orders without a server-read, valid `_ga` client ID create no purchase intent; the server never invents an analytics identity.

Delivery is optional. Both `GA4_API_SECRET` (server only) and `NEXT_PUBLIC_GA4_ID` must be configured. `drainPaidAnalytics(limit)` returns `disabled: true` without claiming or sending when configuration is absent. Configuration and a property-specific Measurement Protocol secret must be set separately by the operator; this implementation does not create them or send test/live events. Browser analytics remains disabled on private pages and before explicit analytics consent. Withdrawing consent clears the first-party measurement cookie.

For each purchase intent the worker sends a GA4 Measurement Protocol `purchase` request. Its strict field allowlist contains the original analytics client ID, first paid timestamp, stable order transaction ID, currency, discounted goods value, shipping, canonical parent catalogue slug, size/pack variant, and configured acquisition/experiment dimensions. It does not send email, customer name, shipping address, access tokens, full page URLs, referrers, user properties, IP address, or a fabricated session ID. Item `price` is the discounted unit amount and `discount` is the unit discount. Fractional-cent unit analytics amounts may be needed to represent an allocated order discount; event value remains the exact goods cents total. Shipping is a separate parameter and is excluded from `value`.

Migration `20260913120000_order_attribution.sql` adds the validated `orders.attribution` snapshot plus service-only `measurement_campaigns` and `measurement_experiments` configuration. Browser/server environment declarations and active database rows must agree. Empty configuration retains no campaign or experiment assignment. Retired optional dimensions are scrubbed from new stale-cookie orders without interrupting checkout; already-created orders keep their original validated snapshot through retries and delayed payment. Missing or invalid UTM fields remain unattributed; the code does not guess that they are direct traffic. See [MEASUREMENT.md](MEASUREMENT.md) for configuration and readout checks.

Service-role-only RPCs claim one row using `FOR UPDATE SKIP LOCKED`, a two-minute lease, and a fresh lease token. A request has a ten-second timeout. Retryable transport failures, HTTP 408/429 and server failures back off from one minute, doubling between attempts. Other HTTP client errors and invalid snapshots are terminal. Eight claims is the purchase maximum, including abandoned leases. Refunds have the stricter single-attempt boundary below. Provider acceptance followed by failed local bookkeeping is surfaced as an error and may later retry with the same transaction ID and timestamp.

Purchase delivery is at least once with bounded retries, not guaranteed exactly-once reporting. GA documents transaction IDs as helping avoid duplicate purchases, but the provider request and local transaction cannot commit together. A timeout can occur after receipt; a 2xx response only confirms HTTP acceptance, not valid ingestion or reporting. The database status is therefore `accepted`, never “conversion confirmed.” `accepted` and `failed` counts describe this worker's delivery attempts; `dead` reports all outstanding terminal rows, including those retired by SQL when no sendable claims remain. With analytics enabled, cron health therefore remains failed until operators reconcile outstanding dead rows; terminal failures cannot disappear behind an empty claim result.

GA accepts timestamps backdated up to 72 hours. Claims and preflight validation stop at 71 hours 59 minutes to leave transport margin, and use `ENFORCE_RECOMMENDATIONS` so an old timestamp is not silently moved. Old intents become `dead`; the worker never reports a historical purchase as if it happened today. Joining to web-tag attribution also depends on Google's timing rules; no session identity is fabricated to force realtime attribution. Enabling analytics after the delivery window does not backfill old purchases. The immutable purchase records payment even if the order is later refunded; new refunds have separate delta intents described below.

Inspect `paid_analytics_outbox.status`, `attempts`, `last_error`, `occurred_at`, and `accepted_at` through a trusted service-role operational session. Error text is deliberately generic and never includes provider URLs/API secrets or response bodies. Do not blindly reset accepted/dead rows: first reconcile uncertain acceptance, timestamp eligibility, and the reason for failure. No network/database operations were run as part of implementation; isolated PGlite fixtures and fake providers cover the delivery boundaries.

Primary references, checked 8 September 2026:

- [Sending GA4 Measurement Protocol events](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events): real web client identity, timestamp and backdating constraints.
- [GA4 purchase event reference](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference/events#purchase): value, shipping, discounted item prices and transaction ID semantics.
- [Measurement Protocol event validation](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events): transport versus event validity.


## Immutable refund deltas and reconciliation

Migration `20260908210000_operations_completion.sql` adds one local refund intent per canonical `commerce_events.id`. The financial operation records the actual incremental net-goods cents and final shipping remainder where it allocates the refund. Partial/final refund replay cannot create a second delta. A settlement ledger entry records a transfer already made and never emits another financial refund. The original purchase snapshot supplies the client ID, transaction ID and currency; the refund event keeps the canonical refund time. Missing original analytics identity creates no analytics intent and does not block the financial operation. Historical refunds are not reconstructed from today's order state or timestamp.

The outgoing `refund` event has `value` equal to net goods only and separate `shipping`; item details are optional and omitted. It contains no customer identity or contact/address fields. Commerce event facts and analytics payload/identity/time are immutable, while worker status and processing metadata may advance. The database uniquely identifies each delta; **GA does not document refund deduplication by transaction ID**. Several legitimate partial refunds share the original transaction ID.

Refund transport consequently has a stricter boundary than purchases: it gets one claim and one transport attempt. Any failed HTTP response, uncertain transport failure, lost completion after possible acceptance, or expired claimed lease becomes terminal for reconciliation. Even a crash before transport may be conservatively terminal because the next worker cannot prove it was unsent. The worker never automatically repeats a possibly accepted refund. Missing optional configuration leaves unclaimed intents untouched. An old refund keeps its original timestamp and expires at the same 71h59m boundary. A 2xx result means only received transport, not validated ingestion or a confirmed reporting adjustment. Any external reporting correction needs independent verification; this app offers no blind refund resend/reset control.

Run these read-only queries in a trusted operational database session. They contain order IDs and amounts, without customer contact details:

```sql
-- Totals across all orders with recorded refunds.
select sum(recorded_refund_cents) as financial_refunds_cents,
       sum(event_refund_cents) as immutable_delta_cents,
       sum(queued_refund_cents) as analytics_intent_cents,
       sum(accepted_refund_cents) as transport_accepted_cents,
       sum(unexplained_cents) as pre_delta_or_unexplained_cents,
       sum(event_refund_cents - queued_refund_cents) as no_analytics_intent_cents
from public.refund_analytics_reconciliation();

-- Per-order reconciliation, including historical refunds and missing client IDs.
select * from public.refund_analytics_reconciliation()
where unexplained_cents <> 0 or event_refund_cents <> queued_refund_cents
   or queued_refund_cents <> accepted_refund_cents;

-- Work that must be checked against external reports; accepted is not ingested.
select id, order_id, commerce_event_id, occurred_at, status, attempts, last_error,
       payload #>> '{events,0,params,transaction_id}' as transaction_id,
       payload #>> '{events,0,params,value}' as net_goods_aud,
       payload #>> '{events,0,params,shipping}' as shipping_aud
from public.paid_analytics_outbox
where event_kind = 'refund'
order by occurred_at, id;
```

`queued_refund_cents` counts all committed analytics intents regardless of delivery status. `unexplained_cents` includes refunds predating the new delta evidence; it is an investigation bucket, not a fabricated analytics backfill. The gap between immutable deltas and analytics intents normally includes orders lacking original analytics identity. Comparing DB transport acceptance with GA's actual reporting is an additional external reconciliation, never an equality guaranteed by a 2xx response.

Additional primary references, checked 8 September 2026:

- [GA4 refund event](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference/events#refund): original transaction ID, optional items, net goods value and separate shipping.
- [Measurement Protocol reference](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference): receipt of a request is not proof of validation or ingestion.
- [Sending events](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events): original timestamps and the 72-hour window.
