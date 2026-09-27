# Stock management and overdue order alerts

Catalogue → Stock (`/admin/stock`) contains stock attribution by person, product search, and sales drill-down. Receipt and adjustment links open the existing product stock controls. The dashboard no longer queries or displays the attribution report.

## Reminder behaviour

- `/api/cron/overdue-orders` checks orders in **Awaiting payment** (`pending`) and **To fulfil** (`paid`, `processing`). Only orders that have spent **more than 24 hours** in the current queue qualify.
- The hourly GitHub `Scheduled sweeps` workflow calls this endpoint using `CRON_SECRET`. Vercel also calls it daily at 05:30 UTC as a backstop. Delivery occurs on the next successful sweep after the threshold; scheduler delays can affect timing.
- Every active `admin_users` email receives its own `[PRIORITY]` email with high-priority headers, an order link, time waiting, and the relevant payment follow-up or dispatch action. No customer reminder is added by this job.
- Repeat reminders are at least 24 hours apart, measured from the later of enqueue and successful send. Existing queued, sending, or retryable failed deliveries are retried instead of accumulating new reminders. Each sweep queues up to 100 recipient messages; later sweeps continue the backlog.
- Confirming payment starts a fresh fulfilment window. Moving between paid and processing preserves that window. Reinstating a cancelled order starts a fresh payment window. Other edits do not reset the clock.
- Order state and admin membership are checked again immediately before sending. Alerts for a previous queue entry are cancelled. Customer marketing opt-outs and customer email corrections do not suppress or redirect internal admin alerts.
- The Automation page and operations health endpoint include the `overdue-orders` job. Delivery failures remain visible in the existing outbox and cron health records.

## Release

Apply `20260927090000_overdue_order_reminders.sql` through the [tracked migration process](MIGRATIONS.md), then release the application and workflow together. The migration backfills current queue entry times from status history, falling back to payment or creation timestamps for historical records. Existing orders already overdue become eligible on the first sweep.

The new job uses the existing `CRON_SECRET`, workflow `CRON_BASE_URL`, Resend configuration, and active-admin list. No additional credentials are required. Changes in a local checkout do not activate production reminders.

## Verification

`npm test` covers timing boundaries, historical backfill, queue transitions, all active recipients, repeat timing, failed-delivery backlog, delivery-time cancellation, marketing opt-out isolation, customer-email correction, and service-only access. `npm run test:postgres` verifies overlapping schedulers enqueue one reminder per recipient using independent database sessions. `npm run test:browser -- tests/browser/stock-management.spec.ts` checks stock filtering, sales detail, accessibility, and narrow/mobile layouts using synthetic data.
