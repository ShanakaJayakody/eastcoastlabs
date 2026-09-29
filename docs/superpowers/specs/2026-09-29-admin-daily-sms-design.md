# Daily admin SMS with Mobile Message

Status: implementation in progress after the user accepted the five-line preview and asked for daily automation. Production sending remains paused during validation.

## Intent

Send the contacts in the user's Mobile Message **ECL Directors** list a concise daily business and fulfilment update. Use Mobile Message and the existing business-summary calculations. Customer SMS automation is a separate future project and is excluded from this release.

The preceding in-chat A-to-Z outline supplies the product requirements. The user has identified ECL Directors as the authoritative recipient source. Read-only API verification found list ID `28556` with four contacts/four unique Australian mobile numbers: Ahmed Omer, Aized Omer, Shanaka Jayakody and Usayd Omer. The proposed 08:00–09:00 Australia/Melbourne delivery window is awaiting confirmation. Duplicate phone numbers receive only one daily message.

## Configuration and access

- Store the API username, API password, approved sender and webhook signing secret in server-only environment variables. Never put them in source control, browser payloads, logs or this document.
- `ADMIN_SMS_ENABLED=false` is the deployment gate. Missing configuration fails closed.
- Configure `MOBILE_MESSAGE_ADMIN_LIST_ID=28556`. Fully paginate `GET /v1/list-contacts`, validate Australian mobiles and normalize to `614xxxxxxxx`. Manage membership in Mobile Message; no email-to-phone mapping is required.
- Membership authorizes these internal SMS updates. Dashboard access continues to use the existing admin allowlist; adding an SMS contact does not grant platform access.
- Add an admin SMS settings singleton with a default-paused switch, the proposed Melbourne delivery window, and an audit trail for changes.
- Active admin session checks protect settings, previews and manual tests. Display provider-list membership read-only with a link to manage it in Mobile Message.
- Recheck list membership immediately before each provider attempt. Fail closed on missing lists or failed/incomplete membership reads, cancel unsent intents for removed members, and respect provider opt-outs.
- Store recipient snapshots only in protected delivery records; the provider receives only selected recipients and aggregate business figures.

## Daily message

The user's 30 September clarification replaces the earlier compact summary. Preserve these five lines, their labels and their order exactly:

```text
Daily ECL Director Update:
Yesterday's Revenue: $2,086.03
Overdue Orders to fulfil: 0
Monthly Revenue: $21,325.68
Low Stock: Alc Swabs, Sema, Tesa, SS31, IGF
```

The example is a read-only production snapshot at 00:06 Melbourne time on 30 September 2026, not a sent SMS. Generate fresh values for every daily run; never store these amounts as defaults.

- Yesterday's Revenue: use the dashboard's `revenueWindow({scale:'day',anchor:yesterday})` revenue total for the previous Melbourne calendar day. Revenue is the sum of recorded paid-order totals by `paid_at`, in AUD, consistent with the dashboard. Refunds are reported separately by the dashboard and are not silently subtracted here.
- Overdue Orders to fulfil: count every current paid/processing order whose `action_queue_entered_at` is more than 24 hours before the run. Use an exact database count, not the capped attention queue display. Never include unpaid orders in this figure.
- Monthly Revenue: use the dashboard's revenue total for the current Melbourne calendar month through the run. At the month boundary this starts a new month, while Yesterday's Revenue still refers to the preceding day.
- Low Stock: query current admin stock thresholds on every run and deduplicate product names across pack variants. Preserve the requested short names and order: Bac Water (`bacteriostatic-water`), Alc Swabs (`alcohol-swabs`), Sema (`semaglutide`), Tesa (`tesamorelin`), SS31 (`ss-31`), IGF (`igf`). Include only products currently at or below an admin threshold. Sema never matches Semax. Use `None` when no watched product is low. Bac Water was not flagged in the snapshot above and is therefore absent from that example.

The six named products are the current working scope, following the user's supplied template. An optional clarification is pending on whether to expand this line to every low-stock product. Do not treat the provided names as permanently low stock. Missing data or a missing watched product must stop generation with a visible error, never silently become zero or `None`.

Render amounts with an AUD dollar sign, thousands separators and two decimals. Keep ASCII apostrophes and GSM-safe plain text. Do not add a date, paid-order count, total-to-pack count, payment follow-ups or dashboard link to the SMS; those were superseded by the exact requested format. Record reporting dates in delivery metadata and the admin preview instead.

Allow up to two SMS segments so the exact format stays intact. The snapshot above is 157 GSM septets and fits one segment; adding `Bac Water, ` makes it 168 septets and requires two. Calculate GSM septets, use 160 for a single segment and 153 per concatenated segment, and show the actual count in the preview. Set `max_parts=2`, disable Unicode and URL shortening explicitly. Never truncate required lines, round away cents or silently omit low-stock products to fit one segment. Reject an over-limit body with an operational alert; revisit the cap if the user expands the product scope.

## Schedule and delivery

- Add a separate `admin-sms` worker to the existing hourly GitHub sweep and a daily Vercel backstop. Keep the daily email job independent.
- Determine the reporting date and eligibility using `Australia/Melbourne`, including daylight-saving changes. Normal sending targets 08:00–09:00; an hourly recovery can catch up before noon. This is best-effort delivery, not an exact-minute guarantee.
- The database owns one daily intent per normalized phone and local send date. A phone appearing twice in the provider list still receives one text.
- Persist the rendered body, sender, UUID idempotency key and API-username fingerprint before contacting Mobile Message. All retries reuse the exact request and key.
- Claim one row at a time with an expiring lease. Check pause status, current list membership and expiry again immediately before the request.
- Provider acceptance and handset delivery are separate states. Store the provider message ID per recipient; never automatically resend a message already accepted or delivered.
- Cap uncertain retries within 23 hours of the first attempt and the same morning's expiry. An API credential change invalidates automatic retry of an uncertain request because provider idempotency is scoped to the API key. Preserve unresolved results for reconciliation.
- Validate provider JSON and each recipient result even when HTTP status is 200. Scrub secrets from all persisted errors.

## Delivery reports and operational alerts

Add a signed HTTPS webhook at `/api/webhooks/mobile-message`. Verify the raw-body HMAC and timestamp before processing. Match reports against stored message ID or intent reference plus phone number. Track provider reports per `part_number` and `total_parts`: the complete SMS is delivered only when every expected part is delivered. Duplicate, reordered and early-arriving delivery reports must not regress a delivered part to accepted/failed. A failure of any part must be visible rather than presenting partial delivery as complete.

Admin settings show enabled state, configured sender, credit balance, provider list name/membership and recent message outcomes. A pause control stops new sends and retries. A separately protected, explicitly selected test action sends only to the chosen current list member and is labelled as a test.

Use the existing email outbox and internal `admin_daily_brief` subject/HTML template, distinguished by `related_type=admin_sms_alert` and a unique `admin-sms:<date>:<issue>` related ID. Alert active admins once per local day and issue type when credits are below 50, a scheduled run fails, or delivery remains unresolved. This reuses the existing internal-notification protections against customer marketing opt-outs and customer-email edits. Do not include customer or secret data in alerts.

## Implementation boundaries

Use Next.js 15, React 19, TypeScript, Supabase PostgreSQL and native `fetch`; no new paid automation platform or runtime dependency is needed. Add one reviewed additive migration following the existing ledger procedure. All new tables enable RLS with no public/authenticated access; only necessary service-role operations are granted.

The user's unrelated working changes must remain intact. Use an isolated worktree at execution time. Unit/database tests use synthetic data and explicit provider fakes, never operational credentials.

## Acceptance and rollout

1. Verify phone normalization, the exact five-line format, GSM segment counts, AUD cents, exact overdue counts, calendar-month/midnight/DST boundaries, product aliases and missing-data behavior.
2. Verify SQL deduplication, concurrent leases, pause/list-member removal, uncertain sends and expiry in disposable PostgreSQL.
3. Verify provider errors, redaction, stable retry identity, signed callbacks and callback races.
4. Verify admin-only controls and cron authorization; run the existing suite, typecheck, lint and build.
5. Prepare a matching database/application release with production sending paused and unrelated work excluded.
6. Configure the signed delivery webhook after the endpoint exists.
7. Send an explicitly requested test to the confirmed recipients and reconcile delivery and credits.
8. Activate only after the delivery window and test results are confirmed, using the already-verified recipient list. Verify the first automatic run separately from the manual test.

## Work completed before implementation

Read-only provider authentication, balance, sender and complete ECL Directors membership checks succeeded. The supplied credentials, provider's default dedicated sender and verified list ID were saved only in the git-ignored local environment file with mode 0600. No provider send, credit purchase, webhook change, production configuration change or database migration was performed.
