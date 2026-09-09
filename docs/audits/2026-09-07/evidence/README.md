# Audit evidence

Collected on 7 September 2026. These files contain public route/asset observations and local verification results; no private order records or credentials are included.

- `ecl-build-audit.log`: isolated production build using `NEXT_DIST_DIR=.next-verify npm run build`; passed. TypeScript separately passed with `tsc --noEmit --incremental false`.
- `ecl-npm-audit.json`: package audit snapshot; four high-severity package entries and zero critical. Parent/transitive entries overlap; this is not exploit verification.
- `ecl-public-route-audit.json`: 29 live sitemap URLs fetched with at most two concurrent reads; records status, HTML bytes, title/H1, canonical, placeholder presence and certificate links. `seconds` measures one complete local HTTP read including redirects, not browser rendering or field performance.
- `ecl-guides-audit.json`: the 14 guide links extracted from the live research hub; all returned 200. They were absent from the live sitemap.
- `ecl-coa-link-audit.json`: all 14 distinct linked certificate PDFs returned 404 on GET. No claim is made about the validity of any underlying lab result.
- `ecl-assets.json`: assets declared by the homepage HTML. Script/CSS transfer measurements requested gzip. Image requests used the literal fallback `src`, often width 3840, rather than the browser-selected responsive `currentSrc`. Do not treat this as a mobile waterfall. Three variants returned 402; one repeated response explicitly carried `OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`.
- `ecl-pagespeed-mobile.json`: PageSpeed API returned quota error 429. No Lighthouse/CrUX values were obtained.

Browser observations: homepage desktop; shop/PDP/cart/checkout at 390 × 844; checkout document width 510; its first main grid child approximately 495 pixels wide; catalogue document width 390. Opening the cart left focus on the underlying trigger. No warning/error console entries were captured in this sampled journey. Cart was emptied after inspection and the temporary viewport override was reset. No order was placed and no contact details were entered.

`npm run lint` exited 1 with an ESLint setup prompt. No lint configuration or dependency was installed during the audit. Build warning: Next inferred workspace tracing root from a lockfile in the parent home directory. Original tracked source remained unchanged; audit documents and an ignored isolated build output were created.
