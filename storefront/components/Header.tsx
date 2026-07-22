"use client";

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

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur supports-[backdrop-filter]:bg-ink/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="East Coast Labs home">
          <Image
            src="/logo.png"
            alt="East Coast Labs"
            width={38}
            height={40}
            priority
            className="h-9 w-auto transition-transform duration-300 group-hover:scale-105"
          />
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
                data-active={active}
                className={`nav-underline rounded-md px-3 py-2 text-sm font-medium transition-colors ${
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
          className="btn-press relative inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-fg transition-colors hover:border-line-2 hover:border-accent/50"
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
