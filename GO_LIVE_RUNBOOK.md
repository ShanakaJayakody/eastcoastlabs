# East Coast Labs — Go-Live Runbook (headless Next.js + WooCommerce + Bankful)

> This is the punch-list that takes the built code to a live site. Steps are ordered; do them top to bottom. **Nothing here runs the DNS cutover until a real test order has passed** (Step 7). Each step marks who must do it — several need credentials only you have.
>
> **What's already built (in this repo):** the Next.js storefront (`/storefront`), and the three backend changes in the `ecl-conversion` plugin (COA REST endpoint, CORS, cross-subdomain cart-cookie support — `includes/class-ecl-rest-api.php`).

---

## Step 1 — Push & activate the backend plugin update  ·  YOU (or me, with SSH/wp-admin)
The new headless code sits in this repo's `ecl-conversion/` but is **not on your live WordPress yet**.
1. Upload the updated `ecl-conversion` plugin to the WP host (SFTP/SSH, or zip + Plugins → Upload).
2. Ensure it's active. The new `ECL_REST_API` module auto-loads.
3. Verify:
   ```
   curl -s https://eastcoastlabs.com.au/wp-json/ecl/v1/coa | head -c 400
   ```
   Expect a JSON array of COA rows. If `[]`, run the COA importer / seed (Step 2).
4. Verify CORS is live (should echo your origin):
   ```
   curl -s -I -H "Origin: https://eastcoastlabs.com.au" \
     "https://eastcoastlabs.com.au/wp-json/wc/store/v1/products?per_page=1" | grep -i access-control
   ```
> Needs: WP host access. I can drive this if you give me SSH or an admin app-password.

## Step 2 — Apply the tier catalog + COA data on the backend  ·  YOU / me-with-access
The live API currently returns **simple** products (single price). The storefront already renders those, but tier cards need the variable-product conversion.
1. Run the ecl-conversion WP-CLI setup (converts the 14 peptides to 1/3/6-vial variable products from `data/price-table.json`) — see `ecl-conversion/docs/INSTALL.md`.
2. Seed COA meta from `data/coa-seed.csv` so `/wp-json/ecl/v1/coa` returns real batches.
3. Verify a product now shows `type":"variable"` with 3 variations:
   ```
   curl -s "https://eastcoastlabs.com.au/wp-json/wc/store/v1/products?slug=bpc-157" | grep -o '"type":"[a-z]*"'
   ```
> Needs: WP-CLI/SSH. Irreversible-ish (changes your catalog) — do it on **staging first** if you have one.

## Step 3 — Bankful confirmation  ·  YOU ONLY
Call/email Bankful and confirm:
- Hosted-checkout **return URL** can be `https://eastcoastlabs.com.au/thank-you`.
- **Tokenized recurring** billing is supported (needed for the Restock subscription). If not → the plan's reminder-based restock fallback ships instead.
- The exact **statement descriptor** (set it in the plugin: `wp option ...` / `ECL_STATEMENT_DESCRIPTOR`).
> Needs: you — this is a merchant-account conversation I can't have.

## Step 4 — Deploy the storefront to Vercel  ·  YOU (or me, with a Vercel token)
1. Import `/storefront` into Vercel (framework auto-detected: Next.js).
2. Set env vars (from `storefront/.env.example`):
   - `WOO_API_BASE=https://eastcoastlabs.com.au` (→ `https://shop.eastcoastlabs.com.au` after Step 6)
   - `WOO_CHECKOUT_BASE=https://eastcoastlabs.com.au` (→ shop. after Step 6)
   - `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_KLAVIYO_ID`
3. Deploy → you get a `*.vercel.app` preview URL. This is your new site, live but not yet on your domain. **This alone resolves the original 404** — a real Next.js build on a real host.
> Needs: Vercel account. I can drive it with a Vercel access token or the Vercel CLI logged in.

## Step 5 — Verify everything on the Vercel preview  ·  me + you
Against the `*.vercel.app` URL, confirm:
- [ ] Home, /shop, PDPs render live products + prices
- [ ] PDP tier cards show (after Step 2), 3-pack preselected, per-vial correct
- [ ] COA module + /lab-results show real batches (after Steps 1–2)
- [ ] Add-to-cart works in the browser (after Step 1 CORS) and cart drawer updates
- [ ] "Checkout" hands off to the Woo checkout with the cart intact
- [ ] A **Bankful sandbox order** completes and returns to /thank-you
- [ ] A restock/subscription line creates a Woo subscription (if Step 3 = yes)
> I can run all of these against the preview URL and report pass/fail before you touch DNS.

## Step 6 — Move WooCommerce to `shop.eastcoastlabs.com.au`  ·  YOU / me-with-access
1. Create DNS record `shop` → current host IP.
2. In WP: set Site Address/WordPress Address to `https://shop.eastcoastlabs.com.au`; search-replace URLs; set `COOKIE_DOMAIN` to `.eastcoastlabs.com.au` in `wp-config.php` (this is what lets the headless cart carry into checkout).
3. Update Bankful return URLs to the new host.
4. Point Vercel env `WOO_API_BASE` / `WOO_CHECKOUT_BASE` at `https://shop.eastcoastlabs.com.au`; redeploy.
> Needs: WP host + DNS. Reversible if you keep the old records until Step 7.

## Step 7 — DNS cutover to the new storefront  ·  YOU ONLY — THE ONE-WAY DOOR
**Do this only after Step 5 fully passes, including a real payment.** This is the moment the public site changes.
1. Lower TTL on the apex/`www` records beforehand.
2. Point `eastcoastlabs.com.au` + `www` at Vercel (A/CNAME per Vercel's domain instructions); add the domain in Vercel.
3. Watch: the apex should now serve the Next.js site.
> Needs: you, at the registrar, with an explicit go. I will not initiate this — I'll tell you exactly what records to change and verify the result, but you throw the switch on a store that's currently taking orders.

## Step 8 — 301 redirects + post-launch verify  ·  me + you
1. Map old WP URLs → new routes (`/shop-all/`→`/shop`, `/coa/`→`/lab-results`, `/product/…` stays). Add as redirects in `next.config` or the WP `shop.` host.
2. Run a **real** end-to-end order on the live domain; confirm Bankful charge, order in WooCommerce, /thank-you redirect, GA4 `purchase` event.
3. Confirm no unintended 404s (crawl the sitemap).

---

## Division of labour summary
| Step | I can do (with access) | Only you |
|------|------------------------|----------|
| 1 Push/activate plugin | ✅ with SSH/app-password | — |
| 2 Tier + COA data | ✅ with WP-CLI | approve catalog change |
| 3 Bankful confirm | — | ✅ |
| 4 Vercel deploy | ✅ with Vercel token/CLI | — |
| 5 Preview verification | ✅ | — |
| 6 Subdomain move | ✅ with WP + DNS access | — |
| 7 DNS cutover | ❌ (irreversible — I guide, you execute) | ✅ |
| 8 Redirects + live order | ✅ redirects; you place the live order | ✅ live order |

**Fastest path if you want me to drive most of it:** give me (a) an SSH or admin **application password** for the WP host and (b) a **Vercel access token**. Then I run Steps 1–2, 4–6, and 8's redirects, verify Step 5 end-to-end, and hand you Steps 3 and 7 with exact instructions. Share credentials through your password manager / a secure channel — not pasted in chat.
