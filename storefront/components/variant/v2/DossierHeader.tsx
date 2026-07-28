"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useUI } from "@/lib/ui-context";

const NAV = [
  { href: "/shop", label: "Compounds" },
  { href: "/stacks", label: "Protocols" },
  { href: "/lab-results", label: "Lab Results" },
  { href: "/about", label: "About" },
];

/** Masthead-style header: typographic wordmark, no logo image, mono microcopy. */
export default function DossierHeader() {
  const { itemCount, ready } = useCart();
  const { openCart } = useUI();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const count = ready ? itemCount : 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 bg-ink/95 backdrop-blur transition-[border-color] ${
        scrolled ? "border-b border-line" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-8 px-6">
        <Link href="/1" className="shrink-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-fg">
          East Coast Labs
        </Link>

        <nav className="ml-auto hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] font-medium text-fg-2 transition hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-5 md:ml-0">
          <span className="hidden font-data text-[11px] tracking-wide text-muted-2 lg:inline">
            AU · 1-DAY DISPATCH
          </span>
          <button
            type="button"
            onClick={openCart}
            aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
            className="font-data text-[13px] font-medium text-fg transition hover:text-accent"
          >
            Cart {count > 0 && <span className="text-accent">({count})</span>}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="text-[13px] text-fg md:hidden"
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-line bg-ink px-6 py-4 md:hidden">
          {NAV.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-baseline gap-3 border-t border-line py-3 first:border-t-0"
            >
              <span className="font-data text-[11px] text-muted-2">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-serif-display text-lg text-fg">{item.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
