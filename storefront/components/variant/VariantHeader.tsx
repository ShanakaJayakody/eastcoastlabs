"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useUI } from "@/lib/ui-context";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/stacks", label: "Stacks" },
  { href: "/lab-results", label: "Lab Results" },
  { href: "/learn", label: "Learn" },
  { href: "/about", label: "About" },
];

/**
 * Light header for the /1 variant. Deliberately quieter than the dark-theme
 * Header — thin rule instead of a glow, no gradient underline — but shares the
 * same cart state so the funnel past the landing page is identical.
 */
export default function VariantHeader() {
  const { count } = useCart();
  const { openCart } = useUI();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3.5">
        <Link href="/1" className="flex shrink-0 items-center gap-2.5">
          <Image src="/logo.png" alt="East Coast Labs" width={32} height={32} className="h-8 w-8 object-contain" />
          <span className="text-[15px] font-semibold tracking-tight text-fg">East Coast Labs</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-fg-2 transition hover:bg-surface-2 hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            href="/shop"
            className="btn-press hidden rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110 sm:inline-block"
          >
            Shop peptides
          </Link>
          <button
            type="button"
            onClick={openCart}
            aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
            className="btn-press relative rounded-lg border border-line px-3 py-2 text-sm font-medium text-fg transition hover:border-line-2 hover:bg-surface-2"
          >
            Cart
            {count > 0 && (
              <span
                key={count}
                className="animate-badge-pop absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-ink"
              >
                {count}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="rounded-lg border border-line px-3 py-2 text-sm text-fg md:hidden"
          >
            ☰
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-line bg-surface px-4 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-2 py-2.5 text-sm font-medium text-fg-2 hover:bg-surface-2 hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
