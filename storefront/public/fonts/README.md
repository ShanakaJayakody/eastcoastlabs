# Storefront typography

The commerce shell uses Tenor Sans (400, upright) for display headings and Commissioner (400–700, upright variable) for body text and controls. Both are self-hosted Latin WOFF2 files loaded through `next/font/local` with swap and adjusted fallbacks. Admin retains its existing typography. The three rebrand routes (`/1`, `/2`, `/3`) use Commissioner for both headings and body copy, with upright weights and a separate scoped type scale.

- Tenor Sans: Denis Masharov; [Google Fonts source and license](https://github.com/google/fonts/tree/main/ofl/tenorsans). License included as `TenorSans-OFL.txt`.
- Commissioner: The Commissioner Project Authors; [upstream source](https://github.com/kosbarts/Commissioner). License included as `Commissioner-OFL.txt`.
- Font binaries supplied by the Google Fonts CSS API on 2026-09-13; unchanged Latin subsets, totaling 46,952 bytes. No third-party font requests are made by the storefront.

Inter and Newsreader files from the preceding design remain archived here but are no longer referenced or preloaded by the commerce shell or rebrand routes.
