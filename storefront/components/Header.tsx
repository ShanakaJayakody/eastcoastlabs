"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { useUI } from "@/lib/ui-context";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/stacks", label: "Stacks" },
  { href: "/lab-results", label: "Lab Results" },
  { href: "/learn", label: "Learn" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const { itemCount, ready } = useCart();
  const { openCart } = useUI();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur supports-[backdrop-filter]:bg-ink/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="East Coast Labs home">
          <Image
            src="/logo.png"
            alt="East Coast Labs"
            width={38}
            height={40}
            priority
            className="h-8 w-auto sm:h-9 transition-transform duration-300 group-hover:scale-105"
          />
          <span className="flex flex-col leading-none">
            <span className="text-[13px] font-semibold tracking-[0.14em] text-fg sm:text-sm sm:tracking-[0.18em]">
              EAST COAST LABS
            </span>
            <span className="text-[9px] tracking-[0.2em] text-muted-2 sm:text-[10px] sm:tracking-[0.22em]">
              RESEARCH PEPTIDES
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-active={isActive(item.href)}
              className={`nav-underline rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.href) ? "text-accent" : "text-fg-2 hover:text-fg"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCart}
            className="btn-press relative inline-flex h-10 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg transition-colors hover:border-accent/50"
            aria-label="Open cart"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6h15l-1.5 9h-12L6 6ZM6 6l-.7-3H3M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">Cart</span>
            {ready && itemCount > 0 && (
              <span
                key={itemCount}
                className="animate-badge-pop absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-ink"
              >
                {itemCount}
              </span>
            )}
          </button>

          {/* Hamburger (mobile only) */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="btn-press grid h-10 w-10 place-items-center rounded-md border border-line bg-surface text-fg transition-colors hover:border-accent/50 md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      <div
        className={`overflow-hidden border-t border-line bg-ink/95 backdrop-blur transition-[max-height] duration-300 ease-out md:hidden ${
          menuOpen ? "max-h-96" : "max-h-0"
        }`}
      >
        <nav className="mx-auto flex max-w-6xl flex-col px-4 py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center justify-between rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                isActive(item.href) ? "bg-accent/10 text-accent" : "text-fg-2 hover:bg-surface hover:text-fg"
              }`}
            >
              {item.label}
              <span aria-hidden className="text-muted-2">→</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
