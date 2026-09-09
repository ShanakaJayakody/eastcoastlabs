# Isolated storefront component preview

Run `npx vite --config tests/preview/vite.config.mts --host 127.0.0.1` from `storefront`, then open `http://127.0.0.1:4174/`.

This development-only fixture imports the actual CheckoutForm, BuyBox, CartDrawer, Header, cart/UI providers, and global Tailwind stylesheet. It is outside Next app routes. Vite binds loopback only. Checkout actions are replaced with deterministic local functions; browser environment values are empty. No real order, payment, email or catalog network request is made. The synthetic submit always returns an error.

Use the visible controls to load/reset the synthetic cart and switch between checkout/purchase controls. The outside width control sets the iframe to 390, 320 or 1024 CSS pixels. Measure layout displays the actual frame viewport and document width. Quote scenarios include failure, a 20-second older response and a higher current price. Set the scenario, then use the actual Refresh order total button. To test a race, refresh under Delay, change to Higher price, and refresh again before 20 seconds elapse.

The fixture product has four vials available and one/three/six-vial pack controls. The cart persistence belongs only to the loopback preview origin. Public destination links are exposed for inspection; destination pages themselves are outside this component fixture.

Size previews: `/frame.html?page=sizes` shows the customer selector and `/frame.html?page=sizes-admin` shows the admin size editor. Prices, quantities and names are synthetic. Admin saves are local stubs and do not persist; stock writes are disabled. Browser acceptance tests block API and external requests. Tests cover adding different strengths, cart reloads, sold-out sizes, admin inputs and accessibility at 320, 390 and 1280 pixels.
