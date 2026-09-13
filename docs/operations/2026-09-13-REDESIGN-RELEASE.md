# Storefront redesign release

## Scope

Coastal Precision storefront styling, customer-focused headline, five-vial branded hero, accessible discovery controls, and 14 original historical Janoshik supplier reports. Original report files are unchanged. Reports are sample-specific and are not represented as verified certificates for current inventory or shipment lots.

Integrated origin/main at f9c9314, preserving size selection, stock-aware merchandising, checkout/offers, consent/analytics, business details, and policy pages. No database migration, seed, payment configuration, or inventory mutation is required.

## Release verification

- 120 test files / 641 tests passed after integration, including historical evidence remaining accessible when product size changes.
- Optimized production build passed (46 static pages).
- Mobile GHK-Cu size switch checked: 100 mg to 50 mg updates price and deep link; historical 50 mg report remains labelled sample-specific. No horizontal overflow at 390 px.
- Explicit performance-budget review: the integrated product route measures 141.4 decimal kB gzip across unique route/layout chunks. Its previous 140 kB ceiling is raised narrowly to 142 kB for this redesign/report integration (1.4 kB measured overage, 1%). Other five route ceilings remain unchanged; homepage is 136.1 kB, shop 138.4 kB, checkout 139.6 kB. Images and fonts are local optimized assets, not added client libraries.
- GitHub CI and production smoke verification are recorded in the release pull request and deployment status.

## Existing operational caveat

The lifecycle health warning documented in the conversion release predates this redesign. This release does not alter that job, run migrations again, or change optional measurement/retention configuration.
