"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { MAX_CART_QUANTITY, cartLineVials } from "./cart-line";
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
  components?: string[];
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
  /** Live availability for a slug, or null when the server didn't report it
   *  (unknown ≠ sold out — untracked items stay sellable). */
  stockFor: (slug: string) => number | null;
  priceFor: (slug: string, packSize?: number) => number | null;
  ready: boolean;
  addLine: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  updateQty: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
  completeOrder: (purchased: {key: string; quantity: number}[]) => void;
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

function decodeLines(raw: string | null): CartLine[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    const items = Array.isArray(parsed) ? parsed : parsed?.version === 2 ? parsed.lines : [];
    if (!Array.isArray(items)) return [];
    const unique = new Map<string, CartLine>();
    for (const item of items) {
      if (!item || !['key','name','slug','variantLabel'].every(k => typeof item[k] === 'string' && item[k].length > 0 && item[k].length < 500) ||
        !/^[a-z0-9-]+$/.test(item.slug) || !Number.isSafeInteger(item.productId) ||
        !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !Number.isFinite(item.quantity) || item.quantity <= 0) continue;
      unique.set(item.key, {key:item.key,productId:item.productId,name:item.name,slug:item.slug,
        variantLabel:item.variantLabel.replace(/\s*·\s*Subscribe.*$/i, ""),unitPrice:Math.round(item.unitPrice*100)/100,
        quantity:Math.min(MAX_CART_QUANTITY, Math.floor(item.quantity)),
        ...(typeof item.image === 'string' && /^(https:\/\/|\/)/.test(item.image) ? {image:item.image} : {}),
        ...(Array.isArray(item.components) && item.components.every((v:unknown)=>typeof v==='string' && /^[a-z0-9-]+$/.test(v)) ? {components:item.components} : {}),
      });
    }
    return [...unique.values()];
  } catch { return []; }
}
function loadLines(): CartLine[] {
  try { return decodeLines(window.localStorage.getItem(STORAGE_KEY)); } catch { return []; }
}

export function CartProvider({
  children,
  thresholds,
  stock,
  prices,
}: {
  children: ReactNode;
  thresholds?: CartThresholds;
  /** Live availability per slug (bac water + accessories), resolved server-side
   *  in the layout. A page-load snapshot — checkout re-verifies authoritatively. */
  stock?: Record<string, number>;
  prices?: Record<string, number>;
}) {
  const freeShippingThreshold = thresholds?.freeShipping ?? FREE_SHIPPING_THRESHOLD;
  const giftThreshold = thresholds?.gift ?? GIFT_THRESHOLD;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reconcile = (items:CartLine[]) => items.map(line => {
      const current = prices?.[`${line.slug}:${line.key.startsWith("stack:") ? "stack" : cartLineVials(line)}`];
      return current === undefined || line.key.startsWith("gift:") ? line : {...line, unitPrice:current / 100};
    });
    setLines(reconcile(loadLines()));
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setLines(reconcile(decodeLines(event.newValue)));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [prices]);

  useEffect(() => {
    if (!ready) return;
    try {
      const encoded = JSON.stringify({version:2, lines});
      if (window.localStorage.getItem(STORAGE_KEY) !== encoded) window.localStorage.setItem(STORAGE_KEY, encoded);
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [lines, ready]);

  const addLine = useCallback((line: Omit<CartLine, "quantity">, quantity = 1) => {
    if (!Number.isFinite(quantity) || Math.floor(quantity) <= 0) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.key === line.key);
      if (existing) {
        return prev.map((l) => (l.key === line.key ? { ...l, ...line, quantity: Math.min(MAX_CART_QUANTITY, l.quantity + Math.floor(quantity)) } : l));
      }
      return [...prev, { ...line, quantity: Math.min(MAX_CART_QUANTITY, Math.floor(quantity)) }];
    });

  }, []);

  const updateQty = useCallback((key: string, quantity: number) => {
    if (!Number.isFinite(quantity)) return;
    if (Math.floor(quantity) <= 0) {
      setLines((prev) => prev.filter((l) => l.key !== key));
      return;
    }
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_CART_QUANTITY, Math.floor(quantity)) } : l)));
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);
  const completeOrder = useCallback((purchased: {key:string;quantity:number}[]) => {
    const quantities = new Map(purchased.map(line => [line.key, line.quantity]));
    setLines(current => current.map(line => ({...line, quantity:Math.max(0,line.quantity - (quantities.get(line.key) ?? 0))})).filter(line => line.quantity > 0));
  }, []);

  const stockFor = useCallback(
    (slug: string) => (stock && slug in stock ? stock[slug] : null),
    [stock],
  );

  const priceFor = useCallback((slug: string, packSize = 1) => prices?.[`${slug}:${packSize}`] !== undefined ? prices[`${slug}:${packSize}`] / 100 : null, [prices]);

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
    stockFor,
    priceFor,
    ready,
    addLine,
    updateQty,
    removeLine,
    clear,
    completeOrder,
    goToCheckout,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
