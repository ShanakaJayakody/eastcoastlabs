"use client";

import Modal from "./Modal";
import { useUI } from "@/lib/ui-context";
import CartContents from "./CartContents";

export default function CartDrawer() {
  const { cartOpen, closeCart } = useUI();

  return (
    <Modal open={cartOpen} onClose={closeCart} label="Shopping cart" className="absolute right-0 top-0 flex h-[100dvh] w-full max-w-md flex-col border-l border-line bg-ink shadow-2xl">
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
    </Modal>
  );
}
