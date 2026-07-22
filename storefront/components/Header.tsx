"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { useUI } from "@/lib/ui-context";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/stacks", label: "Stacks" },
  { href: "/lab-results", label: "Lab Results" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const { itemCount, ready } = useCart();
  const { openCart } = useUI();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur supports-[backdrop-filter]:bg-ink/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="East Coast Labs home">
          <span className="grid h-8 w-8 place-items-center rounded-md border border-accent/40 bg-accent/10 text-accent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M9 3h6M10 3v6.2L5.5 17.4A2 2 0 0 0 7.3 20.5h9.4a2 2 0 0 0 1.8-3.1L14 9.2V3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-[0.18em] text-fg">EAST COAST LABS</span>
            <span className="text-[10px] tracking-[0.22em] text-muted-2">RESEARCH PEPTIDES</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "text-accent" : "text-fg-2 hover:text-fg"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={openCart}
          className="relative inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-fg transition-colors hover:border-line-2"
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
            <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-ink">
              {itemCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 border-t border-line px-4 py-2 md:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="rounded px-3 py-1.5 text-sm text-fg-2">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
