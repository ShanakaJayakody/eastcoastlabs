# Storefront typography

The commerce shell uses Tenor Sans (400, upright) for display headings and Commissioner (400–700, upright variable) for body text and controls. Both are self-hosted Latin WOFF2 files loaded through `next/font/local` with swap and adjusted fallbacks. Admin retains its existing typography. The three rebrand routes (`/1`, `/2`, `/3`) use Commissioner for both headings and body copy, with upright weights and a separate scoped type scale.

- Tenor Sans: Denis Masharov; [Google Fonts source and license](https://github.com/google/fonts/tree/main/ofl/tenorsans). License included as `TenorSans-OFL.txt`.
- Commissioner: The Commissioner Project Authors; [upstream source](https://github.com/kosbarts/Commissioner). License included as `Commissioner-OFL.txt`.
- Font binaries supplied by the Google Fonts CSS API on 2026-09-13; unchanged Latin subsets, totaling 46,952 bytes. No third-party font requests are made by the storefront.

The creator pages load bundled Inter and Newsreader through `lib/fonts.ts`. Newsreader's normal and variable italic Latin files were supplied unchanged by the Google Fonts CSS API on 2026-09-27, preserving the 400–500 weights and both styles while avoiding build failures from extensionless Google delivery URLs. License included as `Newsreader-OFL.txt`; [upstream source](https://github.com/google/fonts/tree/main/ofl/newsreader).

The preceding design's `newsreader-italic-latin.woff2` remains archived. Inter and Newsreader are not referenced or preloaded by the commerce shell or rebrand routes.
