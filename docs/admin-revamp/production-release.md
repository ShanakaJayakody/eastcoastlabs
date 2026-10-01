# Admin revamp production release

## Authorization and release procedure

The owner explicitly requested “live to production” after the protected preview deployment. This supersedes the earlier preview-only deployment restriction, not the existing authentication or customer-data protections.

1. Reconcile the reviewed admin redesign with the currently deployed production source in the existing isolated worktree; preserve newer production functionality.
2. Resolve overlapping changes without dropping carrier selection, customer-route privacy headers, Navy storefront branding, customer accounts, director SMS or email copy.
3. Extend the preview-only gates to the newly merged SMS entry points. Production behavior remains unchanged. Verify the new gates red-to-green and run the complete merged test suite, typecheck, lint and production build.
4. Obtain an independent production-regression review of the merged result. No database migrations, test messages, real order changes, auth bypasses or project-wide environment edits.
5. Publish through the project's existing GitHub main → Vercel Production release flow after review. This builds with the existing Production environment and switches domains only after a successful build. Never promote the old read-only preview with its reduced environment. Record a rollback deployment and recheck the current production/main source before merge.
6. Publish the approved release and verify public-store access and anonymous admin/customer protection using harmless GET requests. Preserve normal owner sign-in for authenticated visual checks.

## Baseline

- Previous production commit: `fcfe275268b91d70af9bc4cef3041d31653b4fd9` (GitHub main / PR #43).
- Rollback deployment: `dpl_B23hVNhyEs7jo44uTmLcYmfb7u7r`.
- Rollback URL: `https://eastcoastlabs-gjo3rgowj-shanakas-projects-458d9470.vercel.app`.
- Reviewed admin source: `523a3a26d88cd416f492d22b0e3b03a72b9e5769`; preview release documentation head `0bb9a6b`.
- Release branch: `codex/admin-revamp-production`.
- Worktree remains `.worktrees/admin-revamp-preview`; the shared main checkout and its unrelated untracked files are untouched.
- Existing Vercel project: `eastcoastlabs`, root directory `storefront`, Node 22.
- Production environment has the existing Supabase/email/SMS/customer-feature settings and no `ADMIN_PREVIEW_READ_ONLY` setting. No credentials are recorded here.

## Verification and release status

Release preparation is in progress. The previous preview's authenticated real-store UI was not inspected: the owner chose production deployment before completing admin sign-in. Do not claim authenticated end-to-end verification or send/mutate real records to substitute for it.

The three merge conflicts retain both sides' intended behavior: carrier-aware tracking updates plus the preview guard, carrier selection plus the read-only button, and combined admin/customer privacy header routes.

- Combined suite: **212 files / 1,292 tests passed**, 49.01s.
- Focused integration checks: 7 files / 33 tests passed (SMS gates/production controls, shipping-method visibility and private headers).
- The seven added preview-blocking cases were observed failing before implementation; the normal-production SMS UI case remains enabled. Tests use fakes, not real database/provider operations.
- Typecheck and lint passed.
- Isolated production-mode build passed (`NEXT_DIST_DIR=.next-admin-production-verify VERCEL_ENV=production ADMIN_PREVIEW_READ_ONLY=0`), with no live credentials. Build-generated tsconfig include changes were reverted before commit.
- Release-flow decision: use the existing GitHub/Vercel integration so the redesign also becomes the source of future production builds; do not leave a manually deployed branch divergent from main. The shared local main checkout remains untouched.
