# Customer orders and email receipts

Implemented behind three independent flags. Guest checkout remains unchanged. Public rollout has **not** been performed by this implementation task.

## Customer experience

- Transaction emails show stored product names, exact sizes/pack labels, quantities, discounts, shipping, totals, refunds and compatible JPEG/PNG images. Image-blocked clients still have complete text. Long receipts show the first 20 lines and link to all items.
- A signed `/orders/access` link lasts 30 days. It exchanges into an HttpOnly, Secure (production), SameSite=Lax cookie scoped to that order for at most 24 hours and redirects to a URL with no token.
- The guest receipt excludes contact/address/history. Email-code sign-in grants the verified owner their full receipt and 20-at-a-time history. The service query derives permissions from the request; client parameters cannot assert an owner.
- The app allows five code requests per mailbox/hour, 30 per trusted IP/hour, a 60-second resend gap and five verification attempts/challenge. A challenge expires in 10 minutes and reserves verification for 30 seconds. Unknown IPs share one conservative bucket.
- Customer sessions use random opaque cookies with only SHA-256 hashes stored server-side; 24-hour idle / seven-day absolute expiry. Each read checks that the Auth user still exists, is verified, is not banned and still has the same email. Customer sign-out does not modify admin cookies.
- Exact normalized mailbox ownership is claimed atomically at sign-in, after a matching authenticated checkout and when opening history. Deleted Auth users leave an order-claim tombstone to prevent accidental reassignment. Admin correction of the order mailbox clears ownership and increments its access version.
- Payment confirmation, dispatch and operational completion stay distinct. There is no invented delivery date or carrier-delivered state. Carrier URLs require an explicit supported carrier; imports without one retain a plain tracking number.

## Release sequence

1. Apply additive migrations `20260930090000_customer_order_snapshots.sql`, `20260930092000_customer_order_ownership.sql`, `20260930094000_customer_order_delivery.sql` using the repository's normal migration procedure. No seed replay. Verify service-only RPC grants and RLS on the two new customer tables.
2. Deploy the compatible application/worker with all three flags `0`. Keep `ORDER_ACCESS_SECRET` (32+ characters) stable; it falls back to the service-role key only when omitted, not when blank. Changing it also affects existing payment/review links; prefer per-order version revocation for order-view links.
3. Prepare existing product assets: `node scripts/prepare-customer-order-images.mjs` is a read-only dry-run with explicitly supplied Supabase environment. Review unsupported sources, then run with `--apply` in the intended environment. It converts first images to immutable content-addressed full/thumbnail JPEG pairs and compare-and-sets catalogue references. It does not delete originals, overwrite historical order snapshots or enqueue email. Missing historic imagery falls back only to the exact product slug, with size agreement when recorded, or a labelled placeholder.
4. Check Supabase Auth email signup is enabled, production SMTP is configured and its send quota is suitable. Both customer and admin sign-in use the same project: the shared magic-link/OTP email template must display `{{ .Token }}` with neutral East Coast Labs sign-in wording. Retain the existing admin callback URL/link functionality. Test new users, existing users and an allow-listed admin. Test both flows on the same browser. App expiry remains ten minutes even if the provider is configured longer. Supabase's public Auth endpoint also needs appropriate provider rate limits/bot controls; application throttles cannot protect direct calls to that endpoint.
5. Turn **off open/click tracking on the Resend sending domain** (and on the Auth SMTP sender if it tracks URLs). Capability links must not be rewritten. Verify sender DNS SPF/DKIM/DMARC and the configured support Reply-To using controlled test messages. This application does not turn off domain-level provider tracking through the send API.
6. Enable `CUSTOMER_ORDERS_ENABLED=1`, then `CUSTOMER_ACCOUNTS_ENABLED=1` in staging. The account flag is also mapped into the public navigation at build time, so rebuild on flag changes. Test a paid, pending, expired, reinstated, shipped, completed, gift, partially refunded and deleted order. Verify revoked/expired/forwarded links, another user's UUID, changed mailbox and browser sign-out. Check redirects/error responses have no-store/no-referrer/noindex headers. Do not log raw capability URLs or codes at the proxy, analytics or support tooling.
7. Enable `CUSTOMER_ORDER_EMAILS_ENABLED=1` last. Send to controlled Gmail, Apple Mail and Outlook mailboxes; inspect desktop/mobile, blocked images, dark mode, Reply-To and actual authentication headers. The browser-rendered preview is not evidence of inbox/client rendering. Verify provider timeout/retry behaviour and dispatch correction with a carrier.
8. Review the staging evidence, then enable on production in the same order. Historical customers receive no automatic account invitation or new email. Already queued legacy rows without a receipt snapshot retain legacy rendering. An already-attempted/frozen provider body is never upgraded.

Local previews: `npm run preview:emails` renders the real 25 templates into `../tmp/email-preview/` with synthetic order data and a preview-only signing key. `PREVIEW_PORT=4190 npm run preview:audit` serves `/customer-order.html` (add `?owner=1`, `?no-images=1` or `?signin=1`) using actual UI components and fake Auth actions. No preview sends a message or reads real customer records.

## Operations and recovery

| Situation | Recovery |
| --- | --- |
| Expired order link | Sign in with checkout email. For a support resend, use the existing reviewed order-email action with the correct current recipient and milestone; the insert trigger captures the current version. Do not send a paid/dispatch assertion for a pending order. |
| Forwarded/lost link | Increment `orders.order_access_version` for that order through a reviewed service/admin operation. Existing link cookies stop working on their next read. Verified owners can still use history. |
| Incorrect checkout email | Use the existing audited customer correction workflow. Resolve in-flight/ambiguous outbox deliveries first. It revokes order-view capabilities, clears old owner claims, and refreshes unattempted recipient snapshots. Do not override verification using an order number. Old payment/review links keep their existing, separate authority; see their existing expiry/revocation controls. |
| Missing historical image | Verify exact product/size; publish compatible catalogue assets for future orders. Preserve the text receipt. Never substitute a different size or revise historical totals. |
| SMTP/provider outage | Keep guest checkout available. Show generic sign-in recovery errors. Check outbox leases, retry window, provider identity and existing reconciliation tooling; do not create a fresh queue identity for an ambiguous send. |
| Optional email fields after timeout | Worker v3 freezes subject, HTML, sender, tag, text and Reply-To before attempt. The same body and `ecl-outbox/<id>` key are used on retry. Reconciliation checks optional text/Reply-To when present. |
| Account deletion | Revoke/delete customer sessions and process the existing retention/export policy. Do not automatically reassign tombstoned orders merely because a new Auth user has the same mailbox. Escalate verified recovery for review. |

Schedule daily service-role cleanup after launch (not a public RPC):

```sql
delete from customer_sessions where expires_at < now() or last_seen_at < now() - interval '24 hours';
delete from customer_login_challenges where created_at < now() - interval '7 days';
```

Keep image files referenced by historical receipts/sent email. Catalogue removal only removes the catalogue reference. An audited retention cleanup can be designed later.

## Rollback and monitoring

Turn `CUSTOMER_ORDER_EMAILS_ENABLED=0` off first to stop enriching new messages. Keep order/account routes, signing material, additive schema and v3 delivery worker available for already-issued links and frozen requests. **Do not restore a pre-v3 worker with outstanding v3 messages**: it cannot send their frozen text/Reply-To. Drain or reconcile those messages first. Do not drop snapshot or ownership columns.

Monitor outbox failed/dead counts, provider delivery/bounce events, aggregate OTP request/verification outcomes and order-status support enquiries. Never include tokens, codes, customer email or purchased product data in analytics. The new route group has no marketing/analytics components. Establish a pre-release support baseline and compare after rollout; there is no baseline or production measurement in this implementation task.

## Verification record

Initial integration: 1,071 unit/database tests passed, production build and lint passed; six customer browser/accessibility checks passed across 320px, 390px and desktop. Thirteen private-response header checks passed. Disposable native PostgreSQL checks include ownership, OTP throttling/leases, existing two-worker email claims, commerce concurrency and backup restoration. See the final task response/commit for final counts after review.

Outstanding external release evidence: configured staging project, Auth SMTP/shared template, Resend tracking/DNS settings, actual Gmail/Apple Mail/Outlook receipt rendering and production rollout/monitoring. These are release gates, not claims of completed verification.
