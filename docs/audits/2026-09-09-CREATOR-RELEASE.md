# Creator Collective release — 9 September 2026

The owner authorised committing and publishing the creator page after completion. The release incorporates the current product-size release on `main` and the owner's revised product-reward offer in [OFFER-AND-MESSAGING.md](../creator-program/OFFER-AND-MESSAGING.md). The earlier paid-brief proposal is superseded.

## Database and configuration

- Before release, the production migration runner verified all 34 existing migration checksums and identified only `20260909140000_creator_applications.sql` as pending.
- A fresh certificate-verified backup of `public` and `ecl_migrations` was taken from one consistent PostgreSQL snapshot. It restored into a separate, loopback-only PostgreSQL 17 container; all 37 table row digests and owners matched. Backup data and credentials remain private outside the repository.
- The creator migration was applied through the tracked runner to the restored database. Seven native creator checks passed: grants/RLS; two simultaneously locked submissions with one idempotency key; replay/conflict/deduplication; hourly throttling; review transitions/revisions/audit; retention; and absence of order, outbox, settlement or stock changes.
- The complete 35-migration chain also passed the existing 22 native PostgreSQL checks and a 40-table synthetic backup/restore comparison.
- Production applied only the creator migration at `2026-09-09T04:20:48Z`. All 35 recorded checksums verify and no migrations remain pending. Creator tables were initially empty. Anonymous access and execution are denied; service-role grants and RLS were verified. REST checks returned `401` for anonymous access and `200` with zero records for service-role access.
- Production has a new server-only, sensitive `CREATOR_APPLICATION_SECRET` and exact canonical origins in `CREATOR_ALLOWED_ORIGINS`. Vercel's platform-controlled client address header is used without a custom override. Existing provider and signing values were preserved.

## Operations

Applications enter the private admin creator queue. Status changes do not send email, create orders, supply products or activate commission. Product selection, the posting brief and any later partnership agreement are administered separately.

The ECL storefront administrator owns the weekly service-only retention review described in [CREATOR-PROGRAM-OPERATIONS.md](../../storefront/docs/CREATOR-PROGRAM-OPERATIONS.md). The function removes unselected applications older than 180 days and old throttle buckets; accepted records remain under the contractor relationship. No new scheduled automation was installed.

## Application release

Application integration, final copy verification and deployment are in progress. Deployment identifiers and live verification will be recorded after publication. The database migration is additive and the previous application remains compatible during the release.

The existing production operations-health endpoint returned `503` before the creator application deployment, with one failed and two overdue scheduled jobs; the delivery queue reported zero dead and zero overdue entries. This predates the creator app release and is recorded separately from creator acceptance. No customer-message sweep was triggered solely to change the monitoring status.
