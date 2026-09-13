# East Coast Labs storefront and admin

Next.js 15 / React 19 / TypeScript application with Supabase PostgreSQL, Supabase Auth/Storage and optional Resend/GA4 integrations. The native checkout reserves an order and presents PayID or bank-transfer instructions. An administrator confirms payment before stock settles and a paid purchase is recorded. Bank refunds are recorded manually; this application does not move bank funds.

## Local development

Use Node.js 22.12 or newer in the 22.x line and npm 10.9.8. `package-lock.json` is the canonical lockfile; Bun is no longer used for installation.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Fill only the services needed in your isolated environment. Never point automated tests at a production database. Without Supabase, public pages render unavailable/empty states and checkout writes are unavailable. Certificates never fall back to historical CSV proof. Admin requires a valid Supabase Auth session and an active `admin_users` allowlist entry.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run preview:audit
```

The last command runs a loopback-only component fixture on port 4174 with synthetic data and fake checkout actions. It is outside application routes. See [preview instructions](tests/preview/README.md). Tests clear service credentials and reject unexpected network calls; PostgreSQL behaviour tests run in disposable PGlite databases. Separate-session PostgreSQL races still require staging validation.

## Data and business boundaries

- Catalogue, active variants, prices and inventory come from Supabase. Listings use summary columns and stable pages; PDP details use direct slug queries. Historical catalogue data supplies stable display IDs/order only.
- Cart storage is validated and synchronised between tabs. Prices and sale eligibility are re-resolved on the server. Checkout reviews a versioned quote, commits atomically and reuses a private attempt identity when results are uncertain.
- Order creation, transitions, refunds, stock claims, operation history and notification intent use service-only transactional RPCs. Refund amounts include allocated discounts and remaining shipping. Physical returns are explicit; financial refund recording never implies a bank transfer was sent.
- Payment and review links require scoped expiring signatures. Display order numbers or raw primary keys alone disclose no receipt. Public review columns exclude private order IDs.
- Admin product/settings saves use revisions and atomic writes. Product drafts survive related media/stock refresh. Packing quantities exclude refunded units. Physical lot allocations use supplied inventory evidence; a general product certificate alone does not prove shipment-lot linkage.
- Queued email is leased, rechecked for eligibility and retried with a stable provider key. Confirmation of subscription requires mailbox access. Later unsubscribe invalidates older pending opt-in links. Cron credentials fail closed.
- Browser analytics excludes private pages and removes query/referrer data. `order_created` is distinct from optional server-side paid `purchase`. The database remains the financial authority.

Content decks in `content/` support editorial pages; product copy and SEO fields saved in admin take precedence for live products. Recurring delivery is not offered. Legacy Woo modules remain solely for an explicitly configured emergency fallback; do not enable them without separately validating that integration.

## Database and release

Read [migration procedures](docs/MIGRATIONS.md) before any application/database release. `supabase/apply.mjs` records full migration filenames and SHA-256 checksums, uses a session advisory lock and never automatically runs `seed.sql`. Existing installations require an explicit verified baseline; rerunning historical SQL can overwrite admin content.

The audit changes are staged for review, not deployed. The [implementation report](../docs/audits/2026-09-08-IMPLEMENTATION.md) maps findings to code and remaining work. The [release runbook](docs/AUDIT-RELEASE.md) contains required staging checks, data reconciliation and operational configuration.

Additional guides: [checkout abuse limits](docs/CHECKOUT-ABUSE.md), [paid analytics](docs/PAID-ANALYTICS.md).

The September 13 conversion implementation adds synchronized product sizes, simpler mobile purchasing, consented attribution, contribution reporting and configurable retention. Its [release record](../docs/operations/2026-09-13-CONVERSION-RELEASE.md) maps the approved audit to code, verification and business inputs. See the revised [baseline contract](../BASELINE.md) before interpreting conversion or lifetime-value results.
