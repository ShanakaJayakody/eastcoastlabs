# Navy Sitewide Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline, followed by one independent whole-branch review.

**Goal:** Promote the approved Navy homepage and apply its visual system to all customer-facing pages, excluding admin.

**Architecture:** A single server-composed storefront shell wraps existing interactive commerce and content components. Scoped Navy tokens and styles preserve existing behavior while shared navigation and default imagery make the theme consistent across routes.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 4, Vitest, Playwright and axe.

**Spec:** `docs/rebrand/2026-09-30-navy-sitewide.md`

## Global Constraints

- No admin source or global dark-theme token changes.
- Preserve real product identity, sizes, prices, inventory, cart persistence, checkout and payment behavior.
- Keep private-route marketing and analytics suppression, headers and noindex rules.
- Use the approved assets and brand copy; do not add unsupported product claims.
- Use the established GitHub verification gate and Vercel production pipeline; no database migration or dependency addition.

## Review Focus

- Navigation from interior pages: home, search, report and mobile links must resolve and active state must follow the route.
- Private checkout, payment, review, recovery and subscription links must not gain marketing capture or tracking.
- Existing and sold-out product strengths must keep correct imagery, availability and cart identities.
- Long labels, empty/error states and modal controls must remain readable at 320 px and with keyboard/reduced motion.
- Admin routes must retain their separate CSS tokens, fonts, chrome and authentication behavior.

### Task 1: Shared shell and canonical homepage

**Files:** `(store)/layout.tsx`, `(store)/page.tsx`, `(variant)/{1,2,3}/page.tsx`, `components/rebrand/{NavyHeader,NavyBrand,NavyFooter,RebrandExperience,RebrandPage}.tsx`, new `components/rebrand/NavyStoreShell.tsx`, storefront navigation/redirect tests and Navy browser fixtures.

**Interfaces:** `NavyStoreShell` accepts `children`, footer collections and support/business fields; providers remain owned by the route layout. `RebrandExperience` supplies homepage sections only. Header reads the pathname to choose local or global destinations.

- [x] Add failing behavior checks: the home link resolves to `/`, interior search resolves to `/shop#catalog-search`, active Shop navigation is announced, and `/2` redirects to `/`.
- [x] Render shared header/footer and the same main landmark in a real provider harness; check checkout suppresses the newsletter and ordinary shop pages offer it.
- [x] Implement the server shell, homepage composition, route-aware navigation and redirects. Keep FAQ structured data at `/`.
- [x] Update existing Navy fixtures to use the same shell. Run relevant unit and browser checks; expected result is passing navigation, finder and newsletter behavior.

### Task 2: Commerce and content theme

**Files:** `components/rebrand/rebrand.css`, new `components/rebrand/storefront-theme.css`, `(store)/editorial.css`, public shop/product/collection/stack routes, creator stylesheet and public standalone recovery/unsubscribe/not-found surfaces.

**Interfaces:** `.navy-store` scopes the storefront and private-message tokens. Existing commerce classes and Tailwind variables consume that scope; admin never receives it. `withRebrandImages(product, 'v2')` remains the exact-size-safe imagery adapter.

- [x] Extend behavior coverage for default product imagery and the shared public shell, retaining legacy image parsing tests.
- [x] Apply the Navy palette, shared type, card/action/form treatments and responsive page widths while preserving commerce layout rules.
- [x] Set public catalogue imagery to Navy without changing admin catalogue data or legacy analytics attribution.
- [x] Restyle creator pages and private customer messages; keep current submission, token and privacy contracts.
- [x] Exercise real components for purchase, checkout, error and private states; confirm the admin fixture still has dark tokens.

### Task 3: Responsive verification and release

**Files:** public Navy fixtures/browser tests and the rollout record.

- [ ] Run full unit tests, responsive browser/axe checks, lint, typecheck, production build, private headers and all existing budgets. Fix concrete regressions before proceeding.
- [ ] Inspect the actual Next.js pages with catalogue data at desktop and mobile widths; do not submit real orders or subscription/application forms.
- [ ] Request one read-only review of the whole branch, including the five Review Focus cases. Resolve actionable findings with focused verification.
- [ ] Commit, synchronize with current `main`, pass GitHub verification, merge and deploy through Vercel. Verify `/`, interior pages, redirects and admin isolation live.
