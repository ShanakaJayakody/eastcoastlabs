# Creator Collective operations guide

This guide is for the first ECL Creator Collective release. The owner has authorised committing the live-ready implementation after verification, while production activation remains a separate operator step. Latest main restores Vercel automatic deployment; do not reintroduce a deployment hold.

## Required configuration

The intake API only accepts same-origin JSON requests from configured origins and only writes when all private service configuration exists.

Required server-only variables:

- `CREATOR_APPLICATION_SECRET`: HMAC secret for payload, dedupe and throttle hashes. Use a generated secret of at least 16 characters; do not prefix it with `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: required by the service-role Supabase client used only on the server.
- `CREATOR_ALLOWED_ORIGINS`: comma-separated exact origins for the deployed storefront, for example `https://www.eastcoastlabs.com.au,https://eastcoastlabs.com.au`.
- `CREATOR_TRUSTED_CLIENT_IP_HEADER`: optional override for a platform-controlled client address header. Leave unset on Vercel unless a reviewed upstream proxy requires a different supported header.

On Vercel, the route defaults to `x-vercel-forwarded-for` only when `VERCEL=1`. Vercel documents that this header is platform-provided for client IP forwarding: <https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for>. Missing or malformed trusted address input must return the applicant-facing unavailable state rather than disabling throttling.

Local previews may set `CREATOR_ALLOWED_ORIGINS=http://127.0.0.1:3007,http://localhost:3007` without database credentials. That keeps the form honest: submissions return temporarily unavailable instead of a fake saved result.

## Database release order

Read `storefront/docs/MIGRATIONS.md` before any database operation. The runner owns transactions, so the creator migration has no top-level `BEGIN` or `COMMIT`.

1. In a disposable restored staging database, run `node supabase/apply.mjs --dry-run` from `storefront/` and confirm only the reviewed pending migration is listed.
2. Apply the pending migration through the runner in staging.
3. Verify actual grants:
   - `anon` and `authenticated` cannot select from `creator_applications`, `creator_application_requests` or `creator_application_limits`.
   - `anon` and `authenticated` cannot execute `creator_submit_application`, `creator_review_application` or `creator_retention_sweep`.
   - `service_role` can execute each creator RPC.
4. Exercise one durable application through the deployed route in staging, then replay the same idempotency key and verify it returns success without creating a second application.
5. Exercise two concurrent submissions with the same idempotency key and verify only one application/request wins.
6. Exercise the admin queue as an allow-listed admin: list, open, add notes, shortlist, handle a stale expected revision, then decline or accept through the legal transition path.
7. Confirm no outbound email, contract, payout, order, product supply or commission action is triggered by acceptance. Acceptance only changes the private application record.
8. Build and deploy the application code only after the migration has been verified for the same source revision. Confirm `storefront/vercel.json` still reflects the restored main auto-deploy configuration.
9. Verify `/creators` metadata, final image assets and the creator privacy notice on the deployed staging route. Keep `/creators/privacy`, API routes and admin routes out of analytics.

## Weekly retention procedure

The ECL storefront administrator owns this before public intake is enabled. No scheduled automation is installed by this implementation.

Run weekly from a service-only operational context after confirming backups and reviewing recent accepted records:

```sql
select public.creator_retention_sweep();
```

The RPC deletes:

- applications older than 180 days with status `new`, `shortlisted` or `declined`;
- related idempotency request rows through cascade;
- throttle buckets older than 48 hours.

Accepted creator records are retained under a separately established contractor relationship and are not deleted by this sweep. The sweep returns counts only and must not log deleted applicant content.

## Rollback

If public intake must be paused, remove public navigation/sitemap/indexing links and keep the API returning the truthful unavailable state by removing required private creator configuration. Do not delete legitimate applications as a rollback shortcut. Retain the schema and submitted records for review and retention unless a separately authorised data deletion procedure applies.

If application code must roll back after the migration is live, verify the old code path does not expose creator data and keep the retention procedure scheduled manually until the schema is retired through a reviewed forward migration.
