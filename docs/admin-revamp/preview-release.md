# Admin revamp preview handoff

## Status

**The hosted preview is READY:** [Open the admin preview](https://eastcoastlabs-beytlxg50-shanakas-projects-458d9470.vercel.app/admin). Normal owner admin sign-in is still required to verify the authenticated screens and live records. Production has not been promoted, main has not been pushed or merged, and shared project/environment settings have not been changed.

- Branch: `codex/admin-revamp-preview`
- Reviewed application commit: `523a3a26d88cd416f492d22b0e3b03a72b9e5769`
- Deployed commit: `1b6243619ba8c6bc6f8a6912a9f2b211772dc474` (documentation-only difference from the reviewed application commit)
- Ready deployment: `dpl_FPZ3DQEctuKX2v1ybt2KP68Jzkqn`, target Preview
- [Ready deployment details](https://vercel.com/shanakas-projects-458d9470/eastcoastlabs/FPZ3DQEctuKX2v1ybt2KP68Jzkqn)
- Worktree: `.worktrees/admin-revamp-preview`
- Existing Vercel project: `eastcoastlabs`, scope `shanakas-projects-458d9470`
- Earlier blocked deployment attempt: `dpl_HRiPXv3jq8nbSBxRLWmnNWXCbco7`
- [Blocked deployment details](https://vercel.com/shanakas-projects-458d9470/eastcoastlabs/HRiPXv3jq8nbSBxRLWmnNWXCbco7)

The earlier deployment API returned `BLOCKED`, `TEAM_ACCESS_REQUIRED`, and `alwaysRefuseToBuild: true`. Its stated reason was: “The deployment was blocked because the commit author doesn’t have permission to create deployments for this project.” The inherited Git author was `omthentic <admin@omthentic.ai>`. The deploying CLI account is `shanaka-8039`.

The owner subsequently confirmed `shanaka@medwithpurpose.com` as the correct owner-linked Git email. Vercel accepted the retry with that email on a new documentation-only commit and reported `READY`. Existing commits and global/repository Git settings are unchanged; no deployment metadata is forged or omitted. The earlier `sshanaka@medwithpurpose.com` spelling was corrected before any commit or deployment used it. See [Vercel's collaboration troubleshooting](https://vercel.com/docs/deployments/troubleshoot-project-collaboration#team-configuration).

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
- Deployment retry: fresh full suite passed again (184 files / 1,132 tests, 43.91s); fresh typecheck and lint passed. Application/configuration diff against the reviewed commit is empty.
- Hosted Vercel build completed successfully and the deployment API confirmed `READY`, the expected commit/author and a non-production target.
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

## Hosted checks and remaining owner sign-in

The read-only smoke verifier ran against the ready URL. All six paths (`/admin`, `/admin/login`, `/api/cron/email`, `/api/cron/paid-analytics`, `/checkout`, `/api/unsubscribe`) returned a 302 to Vercel authentication with `Cache-Control: no-store, max-age=0` and `X-Robots-Tag: noindex`. This confirms deployment protection, **not the application's own headers/route guards**. No bypass token or protection-setting change was used.

The in-app browser reaches Vercel sign-in. Chrome's existing Vercel session reaches the application's normal `/admin/login?next=%2Fadmin` page, with the East Coast Labs sign-in form visible. That Chrome tab is preserved for the owner's normal sign-in. An attempted Chrome checkout-route check was blocked by the browser client, so it is not counted as an application guard pass.

After owner sign-in, verify Today, Orders, order detail, Catalogue and secondary navigation using real reads only. Check the exact callback allow-list compatibility if needed; do not add a wildcard, extract a session or mint an auth code.

Hosted application headers and non-admin denials behind Vercel protection, real-store schema compatibility, authenticated screens and OTP/callback delivery **remain unverified**. Local tests and synthetic visuals do not establish those claims. No customer/order mutation or outbound message was triggered during hosted checks.

## Deferred minor review findings

- A malformed custom-range URL shows the generic unavailable/Retry state. Clicking Today resets it to a valid range.
- Command search's “This month's revenue” shortcut opens the default seven-day view. Select Month to date in the revenue period control instead.

These do not weaken authorization or the preview write boundary. They remain documented rather than being silently represented as fixed.
