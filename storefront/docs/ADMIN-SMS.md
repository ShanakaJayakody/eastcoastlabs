# Daily ECL director SMS

The hourly scheduled sweep calls `/api/cron/admin-sms`. The worker sends one fresh daily business update to each unique Australian mobile in Mobile Message's **ECL Directors** list (`28556`), including weekends. The default start is **08:00 Australia/Melbourne**. Delivery normally targets the following hour; delayed runs can recover until noon. Melbourne daylight saving is applied automatically. Scheduling is best effort. The daily Vercel 22:00 UTC call is an additional backstop for the morning configuration; other hours rely on the hourly sweep.

The message keeps the five agreed lines:

```text
Daily ECL Director Update:
Yesterday's Revenue: $1,240.01
Overdue Orders to fulfil: 3
Monthly Revenue: $15,234.56
Low Stock: Alc Swabs, Sema
```

Revenue uses the same gross paid-order totals as the admin dashboard, by payment time. Yesterday is the previous Melbourne calendar day. Monthly revenue is the current calendar month through the run. Overdue orders are paid/processing orders that entered their fulfilment queue more than 24 hours ago. The stock line checks Bac Water, Alc Swabs, Semaglutide, Tesamorelin, SS-31 and IGF against existing admin thresholds, deduplicates their pack variants, and says `None` if none is low. It does not label Semax as Sema. Missing source data prevents sending.

## Setup

1. Apply `20260930100000_admin_daily_sms.sql` using the tracked migration procedure in `MIGRATIONS.md`. It creates paused settings, durable delivery records and restricted service-role functions; it does not send SMS.
2. Configure server-only `MOBILE_MESSAGE_API_USERNAME`, `MOBILE_MESSAGE_API_PASSWORD`, `MOBILE_MESSAGE_SENDER`, `MOBILE_MESSAGE_ADMIN_LIST_ID=28556`, `MOBILE_MESSAGE_WEBHOOK_SECRET`, and `ADMIN_SMS_ENABLED=false`. Use the supplied dedicated sender. Keep secrets outside source control and logs.
3. Deploy the application and scheduler changes. The existing GitHub Actions `CRON_SECRET` and `CRON_BASE_URL` must target the matching production deployment. Cron and dry-run requests require the bearer secret.
4. In Mobile Message's API settings, enable a webhook signing secret and configure **Message Status Updates** to `https://www.eastcoastlabs.com.au/api/webhooks/mobile-message`. Use the same secret in the server configuration. Leave inbound-message routing alone.
5. Open **Admin → Settings → Daily director SMS** and refresh the live preview. Confirm recipients, live figures and the estimated segment count. One segment uses one credit per recipient; two segments use two. Bodies above two segments are rejected instead of silently truncated.
6. Enable `ADMIN_SMS_ENABLED=true` while keeping the Settings switch paused. The server now permits explicitly selected manual tests, but the scheduler remains paused. Select a current director and use **Send one test SMS** when a test is requested. A test is labelled and does not consume the scheduled daily slot.
7. Save the daily hour and enable daily sending in Settings. Check the first scheduled run and delivery reports separately. No customer SMS workflow is included.

## Verification without sending

An authenticated GET to `/api/cron/admin-sms?dry=1` reads current data, recipients and credits and returns the exact text and segment count. It does not create an SMS intent, send a message, queue an alert or record a cron run. Do not paste authorization headers into logs or documents. A normal cron response exposes counts, not phone numbers or message contents.

Settings shows recent delivery outcomes. **Accepted** means Mobile Message accepted the API request. **Delivered** requires successful reports for every part. A failed part appears as failed. Signed receipts are verified against the exact raw request body and a five-minute timestamp window. Duplicate and reordered reports are safe.

## Pause and recovery

- Turn off **Daily sending enabled** to stop new scheduled requests and retries. The server environment gate stops both scheduled and manual sends. A provider request already in flight cannot be recalled.
- Change recipients in Mobile Message. The worker fully reads and validates the current list again before each send. Removing a member cancels an unsent intent; membership does not grant dashboard access. Provider opt-outs remain enforced.
- The daily `(date,phone)` unique record prevents duplicate texts from overlapping schedulers. A retry uses the frozen body, sender, idempotency key and API credential fingerprint. Never delete a record to force a resend.
- Requests that time out may already have been accepted. Retry only the existing intent. Once the daily window expires, the retry cap is reached, or API credentials change, reconcile through Mobile Message history using the intent ID as `custom_ref` before any new manual send. Accepted messages are never automatically resent.
- Low credits, job failures and unresolved delivery create a deduplicated internal admin email. Refill credits in Mobile Message; the integration cannot purchase them. Callback failures and pending provider outcomes can be checked in Mobile Message's webhook/history screens.
- If the source list exceeds 100 contacts or contains invalid phones, sending stops for operator review. This is an internal director workflow, not a customer bulk campaign.

## Test evidence

Automated tests use synthetic contacts, orders, clocks and fake provider responses. Database tests include two independent PostgreSQL sessions racing the same daily recipient and delivery lease. No automated test uses production credentials or sends real SMS. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` and `npm run test:postgres` before release.
