# Order email lifecycle audit — 29 September 2026

Implementation prepared on `codex/order-email-lifecycle`. Not yet deployed; no production orders changed or customer emails sent during this audit.

## Required flow

| Successful action | Customer email | Timing |
| --- | --- | --- |
| Checkout or admin creates an unpaid order | Payment instructions, exact amount and payment reference | Dispatch starts after the successful response |
| Admin marks payment received | Order confirmation | Dispatch starts after the successful response |
| Admin ships an order, including carrier CSV import | Shipment confirmation with tracking number | Dispatch starts after the successful response |
| Shipped order moves to Completed | “Did everything arrive OK?” plus support contact and secure, honest-review link | Dispatch starts after the successful response |

Email intent is saved in the same database transaction as the order event. A failed intent insert rolls the transition back. Next.js `after()` starts delivery without holding the admin/customer response open. The existing leased outbox and Resend idempotency key protect against concurrent workers and repeat clicks. A provider failure does not undo a committed order.

This is immediate dispatch, not a guarantee of immediate inbox arrival. Provider availability, recipient filtering and platform execution limits still apply. Hourly GitHub outbox runs and the daily Vercel backstop remain recovery paths, not the normal trigger. The configured schedules were inspected in code, not confirmed against production run history.

## Corrections

- Centralized delivery scheduling in the order write boundary, covering storefront checkout, admin-created orders, payment/status changes and successful carrier-import rows.
- Added a completion timestamp and atomic completion email intent. No historical completed orders are backfilled or re-emailed merely by applying the migration.
- Replaced shipment-age 5/14/24-day check-in/review scheduling with the completion event. The old sweep is a compatibility no-op; old reminders are ineligible at delivery.
- Preserved the existing once-per-order review identity. Never-attempted legacy queued messages can become the completion message. Already-sent or ambiguous provider attempts are never reset or given a fresh send identity; ambiguous history requires operator reconciliation.
- Required nonblank tracking in the order and packing screens and at the database boundary. The former tracking-free bulk action now opens the carrier import. First shipments always notify; the import checkbox applies only to optional later tracking corrections.
- Updated customer sequence prediction, template previews and manual-review payload validation to the completion timestamp.

## Existing safeguards and exceptions

- Payment and shipment emails are transactional. The optional arrival/review email still requires active marketing consent and respects unsubscribes and per-customer sequence pauses. This audit does not enroll customers or bypass consent.
- Refunded orders do not receive the completion review request. Accessory-only orders or orders already reviewed receive only the arrival check-in, subject to the same existing consent rules.
- Existing administrative auto-completion after 10 days from shipping remains. Its transition now triggers the same completion email. This is not carrier-confirmed delivery; email copy asks about arrival without claiming it occurred.
- Already-sent legacy review requests are not repeated at completion. Historical or uncertain delivery evidence remains available in the outbox for reconciliation.

## Verification and rollout

Local automated coverage includes every milestone, repeat clicks, rollback when email storage fails, required tracking, carrier import/replay, consent, pauses, refunds, legacy queued messages, provider ambiguity, template content and admin controls.

Verification: 942 tests across 157 files pass; production build and lint pass. Disposable native PostgreSQL applies all 46 migrations and passes 28 checks, including concurrent carrier import/completion, delivery leases, and backup/restore of all 46 tables. Independent code review found no remaining critical or important issue; the reported legacy-status display issue and duplicate React card keys were corrected.

Before production activation:

1. Apply `storefront/supabase/migrations/20260929100000_order_email_lifecycle.sql` using the normal reviewed migration workflow, then deploy the matching app changes. App reads require the new `completed_at` column.
2. Confirm existing Resend credentials, sender-domain verification, signing secrets and retry schedules are operational. No new environment variables are required.
3. Use an authorized test mailbox and synthetic order to exercise creation → Paid → Shipped (with tracking) → Completed. Verify four eligible messages and provider delivery events; do not use a real customer's order as a test.
4. Check `/admin/automation` for failed/cancelled/dead outbox entries. “Sent” means provider accepted, not guaranteed inbox delivery.

Platform reference: [Next.js after](https://nextjs.org/docs/app/api-reference/functions/after).
