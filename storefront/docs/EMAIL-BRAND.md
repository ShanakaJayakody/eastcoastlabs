# East Coast Labs email identity

All 25 application email types use the selected navy identity: white message panels, soft blue surroundings, navy text and actions, the revamped cobalt ECL symbol with black logo wording, and readable system fonts. The shared renderer is `lib/email/layout.ts`; customer templates are in `lib/email/templates.ts`. Keep layout, typography, button and footer changes in the shared renderer so the collection stays consistent.

Customer messages include the configured support address and support hours. Marketing messages retain their recipient-specific unsubscribe link. Copy should explain the message's purpose, the next action and relevant dates plainly. Use current settings or direct readers to current product information for prices and shipping benefits. Do not add unsupported testing, speed, outcome or scarcity claims.

## Customer voice and Telegram

Customer copy is warm, straightforward and attentive: a friendly greeting, a clear reason for the email, useful next steps, and a sign-off from the East Coast Labs team. Thank customers without forced familiarity or pressure to order again. Ask for honest feedback regardless of the experience; never make help conditional on a review or describe an admin-completed order as proven delivered.

Every customer email includes a fixed support link to [@eclpeptides](https://t.me/eclpeptides), alongside email support. Telegram copy offers 24/7 support with the qualification “Response times may vary.” Ask customers to message privately about orders and not post payment or personal details in the community.

Welcome and generally subscribed retention emails also invite customers into the community for promos, updates and shared experiences. Transactional emails, confirmation requests, saved-cart reminders and back-in-stock notifications keep Telegram support-only: narrow consent to cart or stock notifications is not a general marketing subscription. Admin emails do not receive the customer Telegram invitation. The retired review-reminder template remains retired.

Payment copy uses the order's stored reservation deadline, including when receipt enrichment is unavailable, with the payment page as the fallback. Existing receipt photos, exact sizes, totals, private order links, carrier tracking, enriched plain-text alternatives and Reply-To are preserved. This copy update does not change event triggers or delivery eligibility.

## Coverage

- Subscription and saved-cart confirmations.
- Payment instructions, reminders, approaching deadlines and released reservations.
- Paid-order confirmation, dispatch and refund notices.
- Three saved-cart reminders and two welcome messages.
- Arrival check-in, review request, review reminder and review thank-you.
- Reorder reminder, second-purchase reminder, two winback messages and back-in-stock notices.
- Overdue-order alerts and daily operations briefs, with an operations label.

`lib/admin/daily-brief.ts` wraps newly generated briefs with the same shell. The legacy manual delivery diagnostic also uses it. The existing admin template previewer continues to render the actual templates.

## Local visual review

From `storefront`:

```sh
npm run preview:emails
python3 -m http.server 3116 --bind 127.0.0.1 --directory ../tmp/email-preview
```

Open `http://127.0.0.1:3116/`. Select any template and switch between desktop, 390px and 320px previews. Generated standalone HTML files sit beside the gallery. A different output directory may be supplied with `npm run preview:emails -- /absolute/output/path`.

The generator substitutes sample settings, forces a preview-only signing key, does not load environment files, and never calls a settings getter backed by the database. It neither sends email nor writes outbox records. Addresses ending in `.test`, payment details, tokens and order numbers are samples. Gallery email links are inactive. Do not commit generated previews.

The emails use inline styles, presentation tables and an Outlook width wrapper. Every header loads the exact revamped symbol from `https://www.eastcoastlabs.com.au/brand/ecl-cobalt-symbol.png`, with explicit dimensions and alt text. The adjacent wordmark is live text, so identification and content remain available with remote images disabled. Enriched order receipts also include eligible product images; this copy update adds no image requests, external fonts or tracking. Browser previews verify layout; they do not simulate every Gmail, Apple Mail or Outlook version or forced dark mode. Actual inbox testing remains a release check with an explicitly authorised test recipient.

## Release behavior

Release through the normal storefront deployment. No database migration, Resend dashboard template change or delivery setting change is required: the sender supplies rendered HTML directly to Resend.

The production sender, scheduling, consent checks, suppression, signed access links, delivery leases and idempotency keys are unchanged. Newly rendered messages receive the updated identity. Already-frozen outbox content and daily-brief payloads keep their original HTML for safe retries and provider reconciliation; do not rewrite or resend historical messages to force the design change.

This covers email generated by this repository. Independently configured campaigns or authentication-provider templates are outside its renderer and require a separate inventory if used.
