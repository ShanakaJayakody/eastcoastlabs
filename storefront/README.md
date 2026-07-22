# East Coast Labs — Storefront

Production Next.js headless-commerce storefront for **East Coast Labs**, a research-use-only
peptide supplier. The storefront reads the catalog and COA data from a headless WooCommerce
backend over REST and hands the cart off to WooCommerce's own `/checkout` (where the Bankful
gateway runs). **Payment stays on WooCommerce — this app never touches card data.**

## Stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript** (strict)
- **Tailwind CSS v4**
- **marked** for markdown copy rendering
- Server-side catalog/COA fetches (work despite CORS); client-side cart (Store API + Cart-Token).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values (defaults point at live prod)
npm run dev                  # http://localhost:3000
```

### Production build

```bash
npm run build
npm run start
```

## Environment

See `.env.example`. All values are non-secret public endpoints.

| Var | Purpose | Default |
|-----|---------|---------|
| `WOO_API_BASE` | WooCommerce Store API + custom ECL REST base | `https://eastcoastlabs.com.au` |
| `WOO_CHECKOUT_BASE` | Base for the checkout hand-off (`<base>/checkout`) | `https://eastcoastlabs.com.au` |
| `NEXT_PUBLIC_GA4_ID` | GA4 measurement ID (`G-XXXX…`). Blank = analytics off | *(unset)* |
| `NEXT_PUBLIC_KLAVIYO_ID` | Klaviyo company/site ID. Blank = Klaviyo off | *(unset)* |

`WOO_API_BASE` and `WOO_CHECKOUT_BASE` are exposed to the browser bundle via
`next.config.ts` `env` (the client cart and checkout hand-off need them).

## Routes

| Route | Description |
|-------|-------------|
| `/` | Home — hero, live batch-results strip (COA), bestsellers, testing steps, restock promo, FAQ |
| `/shop` | Collection grid — image, name, "from $X/vial", stock |
| `/product/[slug]` | PDP — gallery, tier radio cards, restock/bac-water options, add-to-cart, sticky bar, COA module, description, guarantee, FAQ, cross-sells, Product JSON-LD |
| `/lab-results` | All published COA rows |
| `/about` | About page (from copy deck) |
| `/cart` | Full-page cart (mirrors the drawer) |

## Data sources

- **Catalog** — `GET {WOO_API_BASE}/wp-json/wc/store/v1/products` (live, public). Prices are integer
  minor units formatted to AUD in `lib/format.ts`.
- **Cart** — `wc/store/v1/cart` + `add-item`/`update-item`/`remove-item`, with the `Cart-Token`
  response header persisted to a cookie and resent (`lib/woo.ts`). See "Backend-gated" below.
- **COA** — custom `GET {WOO_API_BASE}/wp-json/ecl/v1/coa`. Falls back to the CSV fixture at
  `data/coa-seed.csv` when the endpoint 404s (`lib/coa.ts`).
- **Copy** — markdown decks in `content/` (synced from the project `docs/`), parsed by
  `lib/content.ts`.
- **Tier pricing / cross-sells** — `data/price-table.json`, `data/cross-sells.json`.

> The `content/` and `data/` files are bundled in-repo so the app is self-contained and
> Vercel-deployable. Re-sync them from `../docs` and `../ecl-conversion/data` when the source
> copy changes.

## ⚠️ Backend-gated (works only after the WooCommerce plugin ships)

The build and all catalog/COA reads work **now**. These light up automatically once the backend
plugin is pushed — no code change required:

1. **Client-side cart** — `wc/store/v1/cart*` endpoints are **CORS-gated and not enabled yet**, so
   live add/update/remove calls fail. The UI uses a localStorage-backed cart mirror so the drawer,
   badge, and free-shipping progress work regardless; each mutation also fires a best-effort Store
   API call that succeeds post-deploy.
2. **Checkout hand-off** — relies on the storefront and WooCommerce sharing a domain (shared
   `Cart-Token` + session cookie). See the comment in `lib/cart-context.tsx`.
3. **COA endpoint** — `ecl/v1/coa` 404s today; the app renders the CSV fixture until it's live.
4. **Tier cards** — the live catalog currently exposes every product as `simple`. Tier (1/3/6)
   pricing comes from `data/price-table.json` as a bridge; when the backend exposes real
   `variations`, the PDP prefers those.

## Compliance

Research-use-only store. No dosing, benefit, results, or human/animal-consumption language
anywhere. Quantities are "vials"/"packs". The line **"Research use only — not for human or animal
consumption."** appears on the PDP, cart, and footer.

## Deploy (Vercel)

1. Push this directory to a Git repo (or `vercel` from here).
2. Import the project in Vercel; framework preset **Next.js** is auto-detected.
3. Set env vars (`WOO_API_BASE`, `WOO_CHECKOUT_BASE`, `NEXT_PUBLIC_GA4_ID`,
   `NEXT_PUBLIC_KLAVIYO_ID`) in **Project → Settings → Environment Variables**.
4. Deploy. For the client cart + checkout hand-off to work, host the storefront on the **same
   registrable domain** as WooCommerce (e.g. `shop.eastcoastlabs.com.au`) and ensure the backend
   Store API sends CORS + `Cart-Token` headers.

Catalog and COA pages use `revalidate = 300` (ISR, 5-minute freshness).
