# Production release — 9 September 2026

The owner authorised the coordinated production database/application release, with genuine COA uploads deferred. This record tracks execution; a successful preflight alone does not mean the new site is live.

## Verified preflight

- Release source: audit implementation merged at `9937afd`. Separate uncommitted product-size and creator-program work is excluded.
- A full PostgreSQL custom-format backup and a public/auth/storage backup were taken over certificate-verified TLS. Backup files and credentials are held privately outside the source tree and are not committed or uploaded to Vercel.
- The public/auth/storage backup restored into a separate PostgreSQL 17 database. All 53 table row digests, object ownership and grants matched production; ACL entry ordering was normalised for comparison.
- All 206 historical application columns/types were checked against production before selecting `20260904100000_cron_runs.sql` as the baseline. Historical migrations were executed only on a fresh synthetic database for this comparison.
- The restored production application data passed baselining of 19 historical files and application of all 14 new files. Existing order, line, product and email record counts were preserved. Anonymous review-order identity access was denied afterward.
- Fresh verification passed: 389 unit/regression tests, 22 native PostgreSQL checks and 22 browser scenarios. Typecheck and lint passed. The production application build against independent local Supabase completed.
- Vercel's project Node version was aligned to the tested Node 22 runtime. The existing production deployment remained unchanged.

## Release controls

Use Vercel's native project pause and pause the scheduled GitHub sweep workflow during the database/application switch. Confirm old production entry points are blocked and in-flight writers have drained. Take a fresh final backup before recording the baseline and applying pending migrations. Never replay historical seeds against the existing shop.

Build a production candidate with domain assignment disabled, then promote the matching candidate after database verification. Recheck service-role settings, valid payment configuration, private-page headers, anonymous denial, cron authentication, webhook rejection and read-only operations health before normal processing resumes.

Vercel rejected the initial CLI candidate because the existing Git merge commit was authored by a different configured Git identity. New release records are authored using the verified signed-in project owner's identity, without rewriting previous commits or weakening deployment protection.

The GitHub main auto-deployment hold remains until the coupled switch is complete. Final deployment identifiers, migration results and smoke-test evidence will be appended after execution.

## Scope notes

COA verification remains empty until genuine documents are supplied and checked. Optional third-party analytics and recurring purchasing remain disabled without their real provider configuration. No business/legal identity, certificate evidence or recurring provider is invented during release.

References: [release runbook](../../storefront/docs/AUDIT-RELEASE.md), [migration procedure](../../storefront/docs/MIGRATIONS.md), [Vercel project pause](https://vercel.com/docs/rest-api/projects/pause-a-project), [Vercel production candidate deployment](https://vercel.com/docs/cli/deploying-from-cli).

## Production database upgraded

The final backup was taken after production entry points were paused and in-flight database activity was empty. Its 53 public/auth/storage tables, ownership and permissions restored and matched. Production then recorded the verified 19-file historical baseline and applied all 14 forward migrations. A final read-only migration check reported zero pending files and valid recorded hashes. Core record counts were preserved; anonymous access to private review identity is now denied. Service-role REST access to the new settings snapshot succeeds and the existing bank-transfer configuration remains populated.

Only the stored announcement list was updated through the audited settings transaction: research use only, the existing free standard shipping, payment confirmation before preparation, and batch documents when available. No payment account, price, stock or order values were edited as part of that copy change.

Actual isolated staging acceptance passed admin login, seven admin areas, product draft preservation/save, checkout creation and exact request replay, payment confirmation, a reviewed partial refund with physical restock and remaining packing quantities. It revealed a packing-screen suburb omission and ambiguous original amount label; both received a targeted fix and regression tests. Test mail remained synthetic and no provider messages were sent.

The monitoring workflow now checks public availability and read-only operations health using the existing GitHub Actions account. Its schedule is best effort; separate email/pager notification delivery is not claimed. The account accepted an initial firewall rate-limit configuration but rejected the subsequent update as unavailable on its plan. That rule was removed; only a temporary basic cron-block rule is used during the switch. No plan upgrade was made and edge rate limiting is not claimed as operational.
