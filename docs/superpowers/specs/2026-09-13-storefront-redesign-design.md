# East Coast Labs — Coastal Precision

## Intent and authorization

Build a complete, reviewable localhost redesign under the user's explicit full creative license. Do not deploy or push until the user has reviewed it. Existing checkout, inventory, subscriptions and payments retain their current data and behaviour.

## Assessment and direction

The existing design repeats small boxed sections and glows, gives weak hierarchy to credibility, and stacks the hero too early on laptops. The catalog photography already has distinctive silver, black and iridescent materials.

Considered: a bright clinical catalog (clear but generic), a fully dark technical dossier (credible but dense), and cinematic coastal editorial (recommended). Choose the latter: near-black green, warm ivory, silver, quiet mint; large sans-serif titles with an italic editorial accent; generous spacing and fine rules. Ground the visual language in actual ECL packaging and the Australian coastal brand association.

## Experience

1. Compact announcement and refined responsive navigation, search entry and working cart.
2. Full-width cinematic hero: “A considered approach to research.” Custom still life with the existing ECL vial. Primary shop action and secondary batch documentation action. Small honest context labels.
3. Three concrete trust cues: Australian owned, available batch documentation, transparent pack pricing.
4. Curated products, selected from live popularity ordering, with interactive research-area filters and real current prices/stock.
5. Ivory chapter for research-area discovery with an interactive image preview and five category links.
6. Documentation chapter: an editorial document guide, three verification steps, live certificate status and real document links when available. No invented certificates, purity numbers, aggregate ratings, or endorsements.
7. Coastal image and brand story, linking to About and the research library.
8. Real FAQ content, working newsletter capture, spacious footer.

Shared navigation, colors, product cards and page titles carry the direction through Shop, collections and product pages. Product purchase logic remains intact. Admin and the /1 experiment retain separate styling.

## Motion and accessibility

Short staged entrance for the hero, one-time scroll reveals, CSS crossfades for the research preview, responsive button and card hover states, native smooth anchor navigation. No scroll hijacking. Respect prefers-reduced-motion; all links, filters, accordions and menus support keyboard operation. Text remains readable with JavaScript disabled. Use semantic headings, named controls and visible focus.

## Assets

Generated with built-in imagegen: product campaign still life using the existing BPC-157 render as identity reference; atmospheric coast image (illustrative, not a named location). Optimize to WebP and save into storefront/public/images/editorial. Prompt provenance is saved beside the implementation documentation. Images are aesthetic, never evidence of a laboratory or product test.

## Validation

Run the existing baseline suite; typecheck and lint changed code; build in separate Next output; verify desktop and mobile layout in browser, category filtering, shop search, navigation, product purchase and local cart, keyboard menu/FAQ, image loading and reduced-motion rules. Do not submit orders, newsletter subscriptions or production writes during QA.
