# Customer orders and email receipts

Implemented behind three independent flags. Guest checkout remains unchanged. Production rollout was authorized on 30 September 2026 and is being performed separately from the local implementation verification below.

## Customer experience

- Transaction emails show stored product names, exact sizes/pack labels, quantities, discounts, shipping, totals, refunds and compatible JPEG/PNG images. Image-blocked clients still have complete text. Long receipts show the first 20 lines and link to all items.
- A signed `/orders/access` link lasts 30 days. It exchanges into an HttpOnly, Secure (production), SameSite=Lax cookie scoped to that order for at most 24 hours and redirects to a URL with no token.
- The guest receipt excludes contact/address/history. Email-code sign-in grants the verified owner their full receipt and 20-at-a-time history. The service query derives permissions from the request; client parameters cannot assert an owner.
- The app allows five code requests per mailbox/hour, 30 per trusted IP/hour, a 60-second resend gap and five verification attempts/challenge. A challenge expires in 10 minutes and reserves verification for 30 seconds. Unknown IPs share one conservative bucket.
- Customer sessions use random opaque cookies with only SHA-256 hashes stored server-side; 24-hour idle / seven-day absolute expiry. Each read checks that the Auth user still exists, is verified, is not banned and still has the same email. Customer sign-out does not modify admin cookies.
- Exact normalized mailbox ownership is claimed atomically at sign-in, after a matching authenticated checkout and when opening history. Deleted Auth users leave an order-claim tombstone to prevent accidental reassignment. Admin correction of the order mailbox clears ownership and increments its access version.
- Payment confirmation, dispatch and operational completion stay distinct. There is no invented delivery date or carrier-delivered state. Carrier URLs require an explicit supported carrier; imports without one retain a plain tracking number.

## Release sequence

1. Apply additive migrations `20260930110000_customer_order_snapshots.sql`, `20260930112000_customer_order_ownership.sql`, `20260930114000_customer_order_delivery.sql`, `20260930115000_customer_order_size_media.sql` using the repository's normal migration procedure. No seed replay. Verify service-only RPC grants and RLS on the two new customer tables.
2. Deploy the compatible application/worker with all three flags `0`. Keep `ORDER_ACCESS_SECRET` (32+ characters) stable; it falls back to the service-role key only when omitted, not when blank. Changing it also affects existing payment/review links; prefer per-order version revocation for order-view links.
3. Prepare existing product assets: `node scripts/prepare-customer-order-images.mjs` is a read-only dry-run with explicitly supplied Supabase environment. Review unsupported sources, then run with `--apply` in the intended environment. It converts first images to immutable content-addressed full/thumbnail JPEG pairs and compare-and-sets catalogue references. It does not delete originals, overwrite historical order snapshots or enqueue email. Images for child sizes require an explicit `size_label` on the gallery image matching the purchased size (whitespace/case normalized). Untagged inherited parent images are never used for child receipts. The conversion script skips child product rows; publish a reviewed size-tagged image in the parent gallery to support that size. Historical fallback requires recorded size agreement, including an explicit size in an older variant label, or uses a labelled placeholder.
4. Check Supabase Auth email signup is enabled, production SMTP is configured and its send quota is suitable. Both customer and admin sign-in use the same project: the shared magic-link/OTP email template must display `{{ .Token }}` with neutral East Coast Labs sign-in wording. Retain the existing admin callback URL/link functionality. Test new users, existing users and an allow-listed admin. Test both flows on the same browser. App expiry remains ten minutes even if the provider is configured longer. Supabase's public Auth endpoint also needs appropriate provider rate limits/bot controls; application throttles cannot protect direct calls to that endpoint.
5. Preserve **enabled open/click tracking on the Resend sending domain** and the verified `links.eastcoastlabs.com.au` tracking subdomain. These are domain-wide settings shared by order emails and Auth SMTP; disabling them removes reporting for every newly sent email. Customer sign-in uses an emailed code. Verify order-link redirects preserve the complete destination and test the existing admin sign-in link before changing authentication templates or tracking configuration. If Auth needs tracking isolation, configure it separately rather than disabling order-email reporting. Verify sender DNS SPF/DKIM/DMARC and the configured support Reply-To using controlled test messages. The application send API does not override domain-level tracking.
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
| Delivery continues but opens/clicks stop | Read the Resend sending domain's `open_tracking`, `click_tracking`, and Tracking CNAME verification status first. Both settings should be `true`. Restore only those settings if disabled; preserve the tracking subdomain and existing DNS records. Confirm the settings with a fresh GET, then verify a controlled inbox open/click. Delivery alone does not prove engagement tracking. Already-sent untracked messages cannot be instrumented retroactively; do not resend customer emails to fill the reporting gap. |
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

Final local verification after independent review and integration with main: **1,087 tests in 178 files**, **31 native PostgreSQL checks**, **15 browser/accessibility checks** (including six customer checks across 320px, 390px and desktop), and **13 private-response header checks** passed. Typecheck, lint, production build and route JavaScript budgets passed. PostgreSQL covered concurrent ownership claims, OTP request/verification leases, email workers, commerce concurrency and backup restoration.

The fresh reviewer found two important issues, both reproduced with failing tests and fixed: child sizes now require size-tagged artwork instead of inheriting a parent's photo; initial payment email now shows the stored absolute Melbourne deadline in HTML and plain text. One cosmetic item remains: dispatch emails repeat tracking above and below the CTA. Existing eligibility rejects stale shipment notifications. Preview runners use separate caches after a mixed-preview run exposed stale Vite dependencies.

Outstanding external release evidence: configured staging project, Auth SMTP/shared template, Resend tracking/DNS settings, actual Gmail/Apple Mail/Outlook receipt rendering and production rollout/monitoring. These are release gates, not claims of completed verification.

## Implementation decisions and tradeoffs

Recorded in execution order for future maintainers:

1. Work in an isolated feature worktree from committed main. Concurrent workspace work was preserved; later main commits were merged into this branch and their navigation retained. Cost: the branch must stay current before integration.
2. Treat SMTP/provider configuration, real inbox rendering and staging/public activation as external release gates. Cost: local passing checks cannot establish production readiness on their own.
3. Introduce access-version and carrier columns with snapshot storage so event DTOs capture both atomically. Cost: schema-first rollout is required even while the UI flags are disabled.
4. Retain removed product assets instead of deleting files that historical receipts may reference. Cost: additional storage until an audited retention cleanup exists.
5. Use opaque hashed customer sessions after Supabase OTP, separate from admin cookies. Cost: an indexed session lookup and regular expired-record cleanup; current verified email/ban state is checked on every read.
6. Put private pages in a dedicated minimal layout with no marketing/analytics components. Cost: a small extra branded shell to maintain.
7. Always use worker v3 to freeze optional text/Reply-To, even after rolling back the enrichment flag. Cost: keep compatible workers running until outstanding messages are drained/reconciled.
8. Load purchased item rows for at most 20 history orders, displaying four thumbnails per card. Cost: unusually large orders cause higher server query payload; optimize to a dedicated compact history query if measured usage warrants it.
9. Keep external configuration and activation unclaimed until the staging destination and controlled mailbox are supplied. Cost: provider adjustments may still be necessary.
10. The reviewer excluded uncommitted `.gitignore` and migration-doc edits; the author checked the narrow generated-preview ignore and four-migration release pointer. Cost: operational documentation should be followed and reviewed during rollout.
11. Merge the committed main changes that landed during implementation into the feature branch; resolve the sole header conflict by keeping current navigation plus the gated My orders entry. Cost: a fresh combined verification, recorded above. Main's working files remain untouched.

## Production preparation — 30 September 2026

The four previously unapplied customer migrations were renamed to `20260930110000` through `20260930115000` to follow the already-live director SMS migration. All 49 existing ledger hashes matched; a private local backup was taken before the four migrations were applied. Service-only function grants and customer-table RLS were verified afterward.

Published 41 immutable catalogue image pairs and reviewed size-tagged GHK-CU 50 mg and Retatrutide 20 mg artwork. The only remaining empty image belongs to a coming-soon product without purchasable variants. Historical order snapshots and queued messages were not rewritten.

Resend sending SPF/DKIM were verified at release. Domain open/click tracking was disabled during the 30 September rollout; this caused the reporting regression and was reversed on 1 October (see below). Its pre-existing failed receiving-MX check concerns inbound mail; inbound routing was retained. No DMARC TXT record was found during release inspection. Supabase custom SMTP now uses a domain-restricted, send-only Resend key, `smtp.resend.com:465`, a 60-second resend interval and East Coast Labs sender identity. The shared confirmation and magic-link templates use [the checked-in sign-in template](email/supabase-sign-in.html); both contain the OTP, while the existing production admin callback retains its link. Provider-controlled test addresses verified new-user and returning-user delivery without messaging customers. Real inbox/client rendering remains a separate check.

Supabase Cron job `ecl-customer-auth-cleanup` runs daily at 16:00 UTC, removing expired/idle customer sessions and challenges older than seven days. No public cleanup RPC was added.

The release retains later director SMS and sitewide Navy deployments. The only storefront merge conflict retained current clean shop/stacks URLs and the gated My orders navigation entry.

## Tracking recovery — 1 October 2026

The user reported that Resend stopped showing opens/clicks after the rollout. A live domain GET confirmed `open_tracking=false` and `click_tracking=false`, with sending SPF/DKIM and the existing Tracking CNAME verified. The root cause was the release instruction to disable tracking across the shared domain, not an email delivery failure.

At 08:43:48 UTC (18:43:48 Melbourne), both settings were restored to `true` using Resend's domain PATCH API. A fresh GET confirmed both enabled and `tracking_subdomain=links` still verified. No application deployment, DNS changes, customer resends, or changes to frozen outbox payloads were needed. A synthetic message to Resend's documented `delivered+...@resend.dev` test address was delivered. This confirms delivery, not an actual inbox open/click; controlled real-inbox verification is separate.

The missing engagement events for emails sent with tracking disabled cannot be recovered. Preserve the enabled settings in future releases. See Resend's [tracking documentation](https://resend.com/docs/dashboard/domains/tracking) and [domain update API](https://resend.com/docs/api-reference/domains/update-domain).
