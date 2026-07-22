"use client";

import { useEffect } from "react";
import { useUI } from "@/lib/ui-context";
import CartContents from "./CartContents";

export default function CartDrawer() {
  const { cartOpen, closeCart } = useUI();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    if (cartOpen) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [cartOpen, closeCart]);

  return (
    <div
      className={`fixed inset-0 z-50 ${cartOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!cartOpen}
    >
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          cartOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={closeCart}
      />
      <aside
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-line bg-ink shadow-2xl transition-transform duration-300 ${
          cartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <h2 className="text-sm font-semibold tracking-wide text-fg">YOUR CART</h2>
          <button
            type="button"
            onClick={closeCart}
            className="grid h-8 w-8 place-items-center rounded-md text-muted hover:text-fg"
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <CartContents onNavigate={closeCart} />
        </div>
      </aside>
    </div>
  );
}
