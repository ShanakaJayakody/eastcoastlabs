# Coastal Precision Implementation Plan

**Goal:** A polished, functional storefront redesign served on localhost for user review.

**Architecture:** Keep server-side catalog, prices, certificates and content loaders. Compose the homepage from server-rendered editorial sections and two small interactive islands: featured product filters and collection previews. Scope visual tokens to the storefront shell, preserving admin and /1.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, CSS, lucide-react, built-in imagegen, sharp for asset encoding.

**Spec:** docs/superpowers/specs/2026-09-13-storefront-redesign-design.md

## Global constraints

- Localhost preview only. No deployment, production data writes or external messages.
- Reuse existing live commerce data and existing purchase components.
- No fabricated testing, review or purity claims.
- No new animation dependencies; support keyboard, mobile and reduced motion.

## Tasks

- [x] 1. Prepare campaign assets and typography. Encode generated still life and coast as WebP with sharp; use local project paths and next/image with unoptimized for custom-loader local assets. Keep asset prompt provenance. Reuse Inter/Newsreader from existing next/font definitions.
- [x] 2. Create scoped storefront shell CSS and refine Header, AnnouncementBar and Footer. Keep useCart/useUI, mobile Modal focus handling, working links and newsletter integration. Add explicit component classes for scoped styling.
- [x] 3. Build homepage sections in components/editorial, feeding CardProduct[], Collection[], CoaRecord[] from existing server loaders. Featured filter uses aria-pressed and collection membership; collection preview responds to hover/focus and touch selection with an explicit collection link. Keep SSR content available before hydration.
- [x] 4. Refine shared product-card styling and Shop/PDP page composition, preserving price and availability calculations. Existing catalog filter URLs, pack selection and cart state must continue working.
- [x] 5. Verify existing relevant tests, lint, typecheck and isolated build. Use browser at desktop and mobile sizes; verify hero composition, image loading, overflow, filtering, a product page and local cart. Fix observable issues and leave localhost running for review.
