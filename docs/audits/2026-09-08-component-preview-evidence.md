# Storefront component browser evidence — 8 September 2026

Environment: isolated audit implementation worktree, local Vite server on `127.0.0.1:4174`, native Google Chrome operated through CUA. Browser extension surfaces were unavailable, so a visible iframe provided exact CSS widths without changing the user's browser window. The fixture imports actual public components and global CSS; Next navigation/image boundaries and checkout actions are local fixtures. Admin was not browser-tested.

No production data, backend credentials, remote catalog requests, orders, payments or emails were used. Only synthetic input (`fixture@example.test`, Fixture Researcher, 1 Example Street, Testville, 3000) was entered. Browser address-save prompts were dismissed without saving. Saved screenshots contain only the local fixture page; browser chrome/account UI is excluded.

| Check | Observed result |
| --- | --- |
| Checkout at 390 CSS pixels | Fixture measurement: viewport 390, document 390, overflow 0. |
| Checkout at 320 CSS pixels | Fixture measurement: viewport 320, document 320, overflow 0. Street/suburb labels and state/postcode pair remain visible and usable. |
| Cart at 390 and 320 | Drawer fits the frame. Focus begins at Close cart; Shift+Tab wraps to Checkout, Tab returns to Close cart; Escape closes and restores the opener. Closed cart controls disappear from the accessibility tree. |
| Mobile menu at 320 | Focus begins at Close menu; Shift+Tab wraps to About; Tab returns to Close menu. Escape restores Open menu. |
| Failed quote at 320 | Visible retry message alongside summary; Place order disabled. Switching fixture to Normal and pressing Retry total restores enabled submission. |
| Pending quote | Existing summary stays visible; Place order disabled immediately and Updating your order total status visible. |
| Overlapping quotes at 390 | Began a 20-second $55 total response. Before it resolved, requested Higher price ($65 total). New total displayed; after more than 20 seconds the older response did not overwrite it. |
| Synthetic submission failure | Error shown beneath Place order; entered email/name/address remain populated. No real submission occurs. |
| Purchase controls at 390 and 320 | Both report zero overflow. Four-vial stock with one reserved leaves three addable; six-pack is disabled, three-pack max quantity is one, single quantity caps at three. Add to Cart label/price wraps inside its button at 320. |

Screenshots were captured through Chrome's visible Capture screenshot command via CUA, then moved from Downloads into the repository. They were not produced by Playwright, CDP, injected browser state, or a shell browser driver.

- [320px checkout fields](evidence/2026-09-08-component-preview/checkout-fields-320.png)
- [320px cart keyboard focus](evidence/2026-09-08-component-preview/cart-keyboard-320.png)
- [390px newer authoritative quote after delayed older response](evidence/2026-09-08-component-preview/checkout-newer-quote-390.png)

The first fixture pass had a missing local logo and a synthetic cart key that differed from the actual BuyBox key. The fixture now serves local public assets and uses the same synthetic product key as the real BuyBox; neither required a production component change. Vite `process.env` is explicitly empty so actual providers cannot load production environment configuration.

This is component-level browser evidence, not end-to-end validation of a Next deployment, real payments, COA availability, backend idempotency, SEO output, or third-party analytics. Those require their separately documented unit/integration and rollout checks.

During review, checkout attempt identity was found to include quote version. Two tests reproduced new UUIDs after quote refresh/cosmetic input edits. The fix excludes quote version and normalizes customer fields consistently with the server request fingerprint; both tests then passed. Verification: 55 storefront tests across 15 files passed; TypeScript passed; scoped checkout/preview ESLint passed. The global diff whitespace check found an unrelated extra EOF line in `lib/admin/daily-brief.ts`, reported to the parent for integration.

Follow-up after review: recovery now persists only UUID/request hash in tab session storage. Browser synthetic submit → full reload left contact fields blank and kept Check previous order attempt available. Its read-only action was clicked; CUA then lost the native Chrome surface, so no post-click visual result is claimed. The checkout tests cover the action with zero quoted lines, missing original legacy lines, and storage privacy. Secondary text contrast and canonical origins were corrected after the screenshots above; the screenshots record the tested layout states, not a pixel baseline for those later token changes. Final storefront test count: 60 across 15 files.
