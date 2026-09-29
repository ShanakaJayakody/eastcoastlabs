# Navy storefront rollout

## Approved direction

The owner requested that the published Navy homepage become the main homepage and that the same theme apply to all other customer-facing pages, excluding admin. This continues the selected, reviewed Navy design and the authorized production rollout.

The storefront uses porcelain surfaces, navy text and actions, restrained blue accents, Commissioner typography, the ECL wordmark and the existing Navy vial artwork. Customer data, prices, sizes, stock, purchase flows and published content remain authoritative.

## Architecture

- The `(store)` layout owns one shared Navy header, main landmark, footer, cart and providers. The homepage supplies its sections inside that layout rather than nesting another full page.
- `/` becomes the Navy homepage with canonical metadata and shared FAQ structured data. `/1`, `/2` and `/3` redirect to `/`.
- The shared header uses valid destinations on every page, active navigation, route-aware product search and a mobile menu that closes after navigation.
- Storefront-only styles provide Navy tokens, typography and component styling. The existing commerce layout rules remain available for responsive purchase controls. No admin files or global dark-theme tokens change.
- Shop, collection and product pages use Navy imagery by default; exact strength matching and fallback photography are retained. Stack artwork matches its original SKU.
- Creator landing, application and privacy pages adopt the same palette and type while retaining their content and form behavior.
- Customer recovery and unsubscribe pages use the Navy visual identity without introducing analytics, marketing forms or cart providers into private flows. Newsletter capture remains suppressed on existing transaction/private routes.

## Verification and release

Test canonical navigation and redirects, shared-shell landmarks, marketing suppression, default imagery and admin theme isolation. Exercise shop, product, cart, checkout, content and creator pages at narrow and desktop widths, including forms, errors, dialogs, contrast and keyboard navigation. Verify the full test suite, typecheck, lint, build, private headers and unchanged route budgets. Review the complete diff independently, merge through the required GitHub check, deploy with the existing Vercel pipeline and inspect the live public routes.

## Progress

- Design mapped against the existing layouts and public route inventory.
- Shared shell, canonical homepage/redirects, public imagery, creator theme and private message theme implemented.
- Initial behavior regressions were observed failing (9) and passed after implementation (21 focused tests).
- Full unit suite: 1047 passed before the final server-section extraction; focused tests including original stack strength: 20 passed afterward.
- Lint, typecheck and production build passed. All six route budgets passed after server-rendering static homepage sections and loading cart contents on bag open: home 133.6 kB, shop 134.3 kB, product 137.7 kB, checkout 129.4 kB; limits unchanged.
- All nine private response checks passed against an owned credential-free production server.
- Actual Next.js routes inspected on mobile: home, shop, product, collections, stacks, learn, reports, about, contact, shipping, returns, privacy, terms, creators/privacy, checkout, review, subscription confirmation, cart recovery, unsubscribe and 404. No horizontal overflow found. Admin login retained its original dark body and no Navy shell.
- Browser acceptance is being rerun with CI server ownership enabled on an unused port. An initial run reused an old root-checkout Vite process; that run is not release evidence for the changed fixture.
- Independent whole-branch review found no actionable regressions. The noted gallery fallback cascade was made independent of CSS chunk ordering. Existing checkout analytics policy is unchanged; browser/performance verification remains the release gate. Release pending.

## Implementation decisions

- Existing legacy image query parsers remain available for bookmark compatibility, but public catalogue pages explicitly select Navy. Raw/admin catalogue data stays unchanged.
- Static homepage sections render on the server and the cart drawer loads when opened, bringing the rollout within the existing performance budgets without changing budget thresholds.
- Root-level unknown public URLs use a minimal Navy message shell; store-level missing products use the existing store shell; admin error appearance retains its old branch.
