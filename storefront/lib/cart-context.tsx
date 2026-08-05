"use client";

/**
 * Cart state.
 *
 * The UI source of truth is a localStorage-backed mirror so the drawer, badge,
 * and free-shipping progress work immediately — including right now, while the
 * WooCommerce Store API cart endpoints are still CORS-gated / unshipped.
 *
 * Every mutation ALSO fires a best-effort call to the real Store API
 * (lib/woo.ts `wooCart`). Those calls persist the Cart-Token cookie on success.
 * They currently fail (CORS) and are swallowed; once the backend plugin ships
 * they succeed and the server-side cart is populated for the checkout hand-off.
 */

import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { wooCart } from "./woo";
import { checkoutUrl, FREE_SHIPPING_THRESHOLD, GIFT_THRESHOLD } from "./env";
import { trackBeginCheckout, type GaItem } from "./analytics";

export interface CartLine {
  key: string; // stable per product+variant
  productId: number;
  variationId?: number;
  name: string;
  slug: string;
  variantLabel: string; // e.g. "3-pack" or "1 vial"
  image?: string;
  unitPrice: number; // AUD major units (price for this pack)
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  amountToFreeShipping: number;
  hasFreeShipping: boolean;
  freeShippingThreshold: number;
  giftThreshold: number;
  ready: boolean;
  addLine: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  updateQty: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
  goToCheckout: () => void;
}

/**
 * Reward thresholds come from admin settings, resolved server-side in the
 * layout and passed down. The env constants remain only as the fallback for
 * when settings are unreachable — they are no longer the source of truth, so
 * changing a threshold in /admin now actually changes what shoppers see.
 */
export interface CartThresholds {
  freeShipping: number;
  gift: number;
}

const STORAGE_KEY = "ecl_cart_v1";
const CartContext = createContext<CartContextValue | null>(null);

function loadLines(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({
  children,
  thresholds,
}: {
  children: ReactNode;
  thresholds?: CartThresholds;
}) {
  const freeShippingThreshold = thresholds?.freeShipping ?? FREE_SHIPPING_THRESHOLD;
  const giftThreshold = thresholds?.gift ?? GIFT_THRESHOLD;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(loadLines());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [lines, ready]);

  const addLine = useCallback((line: Omit<CartLine, "quantity">, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.key === line.key);
      if (existing) {
        return prev.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + quantity } : l));
      }
      return [...prev, { ...line, quantity }];
    });
    // Best-effort server sync (currently CORS-gated; failure is expected + safe).
    void wooCart.addItem(line.variationId ?? line.productId, quantity).catch(() => {});
  }, []);

  const updateQty = useCallback((key: string, quantity: number) => {
    if (quantity <= 0) {
      setLines((prev) => prev.filter((l) => l.key !== key));
      return;
    }
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity } : l)));
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0), [lines]);
  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);
  const amountToFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  const goToCheckout = useCallback(() => {
    const gaItems: GaItem[] = lines.map((l) => ({
      item_id: l.productId,
      item_name: l.name,
      item_variant: l.variantLabel,
      price: l.unitPrice,
      quantity: l.quantity,
    }));
    trackBeginCheckout(gaItems, subtotal);

    // ---- Native checkout -------------------------------------------------
    // Orders are now created in our own database (Supabase) by the checkout
    // server action, which re-prices every line server-side and reserves stock.
    // The legacy WooCommerce hand-off is gone; set USE_WOO_CHECKOUT=1 only as an
    // emergency fallback if the native checkout ever needs to be bypassed.
    if (process.env.USE_WOO_CHECKOUT === "1") {
      window.location.href = checkoutUrl();
      return;
    }
    window.location.href = "/checkout";
  }, [lines, subtotal]);

  const value: CartContextValue = {
    lines,
    itemCount,
    subtotal,
    amountToFreeShipping,
    hasFreeShipping: subtotal >= freeShippingThreshold,
    freeShippingThreshold,
    giftThreshold,
    ready,
    addLine,
    updateQty,
    removeLine,
    clear,
    goToCheckout,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
