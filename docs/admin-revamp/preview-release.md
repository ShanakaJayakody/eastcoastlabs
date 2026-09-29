# Admin revamp preview handoff

## Status

Implementation and local verification are complete. **Hosted preview publishing is blocked by Vercel's commit-author permission check. No ready preview is available yet.** Production has not been promoted, main has not been pushed or merged, and shared project/environment settings have not been changed.

- Branch: `codex/admin-revamp-preview`
- Reviewed application commit: `523a3a26d88cd416f492d22b0e3b03a72b9e5769`
- Worktree: `.worktrees/admin-revamp-preview`
- Existing Vercel project: `eastcoastlabs`, scope `shanakas-projects-458d9470`
- Configured deployment attempt: `dpl_HRiPXv3jq8nbSBxRLWmnNWXCbco7`
- [Blocked deployment details](https://vercel.com/shanakas-projects-458d9470/eastcoastlabs/HRiPXv3jq8nbSBxRLWmnNWXCbco7)

The deployment API returned `BLOCKED`, `TEAM_ACCESS_REQUIRED`, and `alwaysRefuseToBuild: true`. Its stated reason is: “The deployment was blocked because the commit author doesn’t have permission to create deployments for this project.” The inherited Git author is `omthentic <admin@omthentic.ai>`. The deploying CLI account is `shanaka-8039`.

The owner subsequently confirmed `shanaka@medwithpurpose.com` as the correct owner-linked Git email. The deployment retry uses that email on a new documentation-only commit. Existing commits and global/repository Git settings are unchanged; no deployment metadata is forged or omitted. The earlier `sshanaka@medwithpurpose.com` spelling was corrected before any commit or deployment used it. See [Vercel's collaboration troubleshooting](https://vercel.com/docs/deployments/troubleshoot-project-collaboration#team-configuration).

An earlier credential-free attempt, `dpl_9m8tCh3vjJnUEz2hHPAYUmuxjLG9`, was also blocked and is superseded. Neither attempt is a usable review URL.

## Delivered implementation

- Approved revenue-first Today screen; seven workspaces retain all 17 original destinations.
- Fully scoped light/dark themes, mobile navigation, command search, and read-only order quick view.
- Promotional introduction replaced by one original, unattributed quote rotating each Melbourne calendar day.
- Live paid-order revenue projection, matched comparisons and period selector; operational queues remain independent of chart dates.
- Query failures show unavailable states instead of fabricated zeros or misleading no-sales alerts.
- No sample sales targets, invented achievements, production schema changes or new dependencies.

## Verification at the application commit

- Full suite: **184 test files / 1,132 tests passed**.
- TypeScript: passed.
- ESLint: passed with no warnings.
- Isolated production build: passed with `VERCEL_ENV=preview ADMIN_PREVIEW_READ_ONLY=1` and no live store/provider credentials.
- Independent security/regression review: no Critical authorization/write bypass found. The Important operational query-error handling finding was fixed and eight new regression tests passed.
- Synthetic browser checks: integrated Today and Orders/quick-view components, desktop light/dark, mobile navigation, command palette, period/comparison controls and figures table. No horizontal overflow at 320, 390, 768 and 1440 pixels; viewport override reset afterwards.
- Quote date rollover/DST, request races, focus handling, read-only policy and production-mode regressions are covered by tests.
- Local integrated QA: [localhost preview](http://127.0.0.1:4187/admin-integrated.html). This harness is explicitly **synthetic data only**, not a substitute for hosted real-store verification.

## Real-data preview boundary

Only the following four settings were supplied to the exact configured deployment, for build/runtime as needed:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PREVIEW_READ_ONLY=1`

Values were read from authorized existing local configuration in memory, passed through the child process environment with CLI variable-name flags, and not printed, committed, placed in shell arguments or written to a copied environment file. Branch-scoped configuration was rejected because this branch has not been published; no shared Preview variables were added.

Read-only protection is application-enforced around the existing credential, **not a database-issued read-only credential**. Server actions reject business changes; the Supabase transport restricts methods, origin and audited read RPCs; public/cron routes and outbound workers are blocked. No payment, email, carrier, analytics, webhook or cron credentials were included. Normal owner sign-in/session activity remains allowed; authentication and deployment protection are not bypassed.

## Still required after permission is resolved

1. Redeploy the reviewed application to Preview with the same exact-deployment settings; do not promote production.
2. Wait for an actual `READY` state and record its URL/deployment ID here.
3. Run `node storefront/scripts/verify-admin-preview.mjs <ready-preview-url>` to check harmless anonymous routes/headers. If Vercel protection intercepts requests, record app-level checks as unverified until normal sign-in.
4. Owner signs in normally. Verify real-data Today, Orders, order detail, Catalogue and secondary navigation without clicking business-write controls. Check exact callback allow-list compatibility if needed; do not add a wildcard or mint an auth code.

Hosted application headers, real-store schema compatibility, authenticated screens and OTP/callback delivery **have not been verified** because Vercel did not build the deployment. Local tests and synthetic visuals do not establish those claims.

## Deferred minor review findings

- A malformed custom-range URL shows the generic unavailable/Retry state. Clicking Today resets it to a valid range.
- Command search's “This month's revenue” shortcut opens the default seven-day view. Select Month to date in the revenue period control instead.

These do not weaken authorization or the preview write boundary. They remain documented rather than being silently represented as fixed.
