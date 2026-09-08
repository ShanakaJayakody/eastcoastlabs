# Audit implementation release runbook — 8 September 2026

This branch has not changed production, submitted real orders, sent email/analytics or deployed the application. Read-only deployment metadata, aggregate anomaly counts and a schema-only copy of production were inspected. See [the completion report](../../docs/audits/2026-09-08-COMPLETION.md) for evidence and limits. Local verification is not production approval or a backup of production customer data.

## Prepare a disposable staging environment

1. Recheck the deployed application commit, database history and grants immediately before release. On 8 September production was `72e1bb72f4e54ac7c400bd6f1dcf16819efc8164`, PostgreSQL 17.6, without a migration ledger or the audit schema. The checked schema-only copy and dry run establish compatibility with that observed shape; they do not authorise baselining a changed installation.
2. Take a backup and prove restoration into an isolated database. Replace customer data with synthetic fixtures before browser/operator testing. Configure fake/test provider boundaries and a separate Auth allowlist.
3. Follow [MIGRATIONS.md](MIGRATIONS.md). Establish a baseline only after verifying the installed schema/data. `20260904100000_cron_runs.sql` is the expected historical boundary, not an assertion about the live installation. Dry-run and inspect the pending filenames/checksums. Apply the new files once in order; retry skips only successfully committed files.
4. Inspect historical commerce anomalies before enabling writes. New transactions do not automatically repair earlier duplicate stock returns, wrong refunded cents, missing expiry, incorrect recorded costs, or mismatched bank payments. Use the read-only counts below, then reconcile selected records against their actual bank/stock evidence with the owner.
5. Deploy the matching application to staging. New settings, checkout, admin and dispatch code requires its new RPCs. Run `npm run test:postgres` in `storefront` to repeat the disposable native PostgreSQL contention/restore checks. They use separate sessions for same-key creates, final stock, payment versus expiry, refund/settlement replay, shared pools, receipt reversal, revision conflicts, provider completion and fulfilment. These checks already run in CI; staging acceptance must additionally verify the real application/Auth/provider configuration with synthetic records.
6. Run the operator/customer scenarios below with a representative dataset. Record results and timings. Do not use a real customer's pending order as a test fixture.

Read-only preflight examples; run only in an authorised operational database session and keep record-level output private:

```sql
-- Legacy order anomalies requiring review, not automatic rewriting.
select count(*) as pending_without_expiry from orders
 where status='pending' and payment_expires_at is null;
select count(*) as refunds_exceed_order_total from orders
 where refunded_cents>total_cents or refunded_cents<0;
select count(*) as invalid_refunded_quantities from order_items
 where refunded_qty<0 or refunded_qty>qty;
select count(*) as invalid_inventory_pools from inventory
 where on_hand<0 or reserved<0 or reserved>on_hand;
select count(*) as orders_without_lines from orders o
 where not exists(select 1 from order_items i where i.order_id=o.id);
```

Do not infer a historical physical return from a refund alone. Migration 100000 preserves the legacy flags/quantities as the starting snapshot; reconciliation remains necessary where those old flags are inaccurate. Existing pending orders without expiry need an owner-reviewed payment deadline or cancellation, not an invented retroactive promise.

## Coupled release

- After the first successful branch CI run, configure the matching `verify` status check as required before merging into `main`, and review direct/force-push permissions. The read-only 8 September check found `main` unprotected and no repository rulesets. The workflow file alone does not enforce a release gate; these account settings have not been changed.
- Verify `NEXT_PUBLIC_SUPABASE_URL`, anon key and server-only service role; active admin allowlist; stable link-signing configuration; CRON_SECRET; verified Resend sender/webhook configuration; trusted database TLS. Dedicated order-access/unsubscribe secrets are optional: the established service-role/cron fallbacks are supported. Keep the effective signing secrets stable. Use the documented Supabase CA file for verified database TLS. Payment details, expiry, shipping and support email are edited in admin settings.
- Pause scheduled sweeps and use a short maintenance/write window for the schema/application switch. Revoke unsafe review columns and switch to scoped links together. Old raw-ID/display-number links must remain closed; safely reissue new links after confirming the customer/order through an authorised support workflow.
- Apply reviewed migrations, then the matching build. Verify private pages return no-store, no-referrer and noindex headers, and private routes do not load analytics/capture popups. Verify tokens never enter logs, error reports or referrers. Disable provider click tracking for private transactional links if account defaults would rewrite them.
- Verify synthetic checkout, admin login, anonymous denial and each cron's missing/wrong/correct credential behaviour. Enable workers only after queue eligibility, recipient identity, old payload backfill and expected legacy cancellations have been reviewed.
- The existing hourly GitHub workflow and daily Vercel backstops must target the intended canonical deployment and have matching secrets. Confirm actual scheduled execution; configured YAML alone is not evidence. Watch per-job health, failed/dead queues and overdue ages.
- Keep the receipt-token secret stable. Rotating it invalidates existing customer links; plan reissue and support communication. Do not restore the insecure access path for compatibility.

## Required customer/operator scenarios

| Scenario | Expected result |
|---|---|
| 320/390px checkout; keyboard navigation; quote outage then retry | No horizontal overflow; labelled errors; trapped/restored modal focus; visible recovery |
| Old quote response arrives after a newer one | Newer total remains authoritative |
| Price/stock changes between quote and transaction | No unreviewed order; customer gets updated summary |
| Order commits but response is lost; reload; original stock is now zero | Saved attempt recovery retrieves the same receipt without another reservation |
| Repeated checkout key / reordered confirmations | One order and one settlement; exact prior purchased lines recovered |
| Discounted three-unit order; refund one, then all | Exact net paid balance refunded; only chosen physical units returned; no double return |
| Full refund recorded in admin | Copy says recorded/manual transfer; no claim money was sent |
| Refunded units printed, then tracking corrected | Only remaining quantities packed; optional corrected notification contains current tracking |
| Dirty product copy → media/stock action → save; second editor conflicts | Draft retained, all fields atomic; conflicts retain draft for reconciliation |
| Costed receipt → reverse, versus receipt → sale → reverse | Safe snapshot reversal restores valuation; later-use case refuses rewind |
| More than 1,000 People and review records | Search/export/counts and rating aggregates include complete dataset |
| Suppress/pause after queue; expired subscription link; old link after unsubscribe | No ineligible marketing send; durable failure never presents success |
| Provider accepts, completion write fails; webhook arrives before completion | Stable retry identity; exact provider+recipient reconciliation |
| Recovery cohort, organic order, partial refund | Distinct capture/exposure/order/paid metrics; only explicit episode gets attributed net revenue |
| Worker stops / all analytics intents age out | Hourly jobs overdue at 3h; dead outcomes remain visible; no false healthy success |

Admin browser workflows remain to be validated with an operator in staging. The user chose a code-based admin audit; local component tests do not substitute for timed operator or VoiceOver testing.

## Evidence/configuration owned outside source code

- Upload and verify genuine product-matched COA PDFs. Every existing row starts unverified; the implementation does not attest to the 14 missing source PDFs. A verified general compound document is not parcel-lot traceability.
- Confirm legal business identity/ABN, contact details, policy wording, dispatch commitments and scientific evidence. This patch removes unsupported claims; it cannot supply missing facts or approve policies.
- Recheck actual public images after release. The earlier image-service 402 did not reproduce on 8 September: the home page and three distinct optimized images returned 200. There is no current evidence requiring an image-optimisation bypass or account change.
- Configure WAF/IP/session abuse controls using verified trusted-proxy rules. Application email limits reduce same-mailbox reservation abuse; rotating addresses remain an external defence requirement. See CHECKOUT-ABUSE.md.
- Enable GA4/Measurement Protocol only with the intended property and privacy choices. Validate requests in Google's debug tooling, then reconcile accepted paid events to DB payment records. No API secret means no delivery. Revenue refunds/attribution timing are explicit limitations in PAID-ANALYTICS.md.
- Enable external alarms for failed/overdue sweeps, outbox age/dead rows and route failures. `instrumentation.ts` emits a redacted route-template/digest diagnostic; it does not configure a monitoring vendor or pager.

## Performance acceptance

Collect a representative field baseline after rollout: p75 LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 by device/page. Verify checkout funnel from view → cart → order-created → paid. The implementation adds vitals hooks and query/bundle improvements; no conversion lift or field-speed improvement has been measured yet. Public route first-load JS may rise modestly with accessibility/recovery safeguards; record actual build sizes and investigate material regressions. Rich text editing is loaded on intent rather than initial admin navigation.

Use the same staged operator scenarios to establish a baseline before evaluating the audit's suggested 30% efficiency improvement. This is a target, not a delivered result.

## Failure recovery

Stop workers and customer writes if financial or access invariants fail. Keep the database backup and matching app artefact available. Do not blindly roll the app back to old non-transactional services after new commerce writes, or expose raw-ID receipt access. Prefer a reviewed forward repair with writes disabled; restore a backup only with reconciliation of any intervening real activity. Applied migration files are immutable; write another migration for a repair.

For ambiguous sends, inspect provider outcome before any manual retry. Stable Resend identity is bounded by the retry window; dead email cannot safely be assigned a fresh identity without reconciliation. Paid analytics 2xx means transport accepted, not reporting ingestion; expired purchases must not be timestamped as today. Keep unresolved terminal rows visible rather than deleting evidence to turn health green.

Parcel lot allocation, carrier CSV reconciliation, reviewed refunds and manual-transfer settlement records are now included in this release. Separate programmes remain a recurring-delivery platform, a new visual theme and measured acquisition experiments. Recurring checkout stays disabled until an actual provider and cadence are supplied.
