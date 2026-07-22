/**
 * Typed WooCommerce Store API client.
 *
 * Catalog reads run server-side (they work despite CORS because they are
 * plain server->server fetches). Cart writes run client-side in the browser
 * and depend on the Store API CORS headers + Cart-Token, which are NOT enabled
 * on the live server yet — those calls degrade gracefully until the backend
 * plugin ships. See lib/cart-context.tsx for how the UI stays functional.
 */

import { WOO_API_BASE } from "./env";
import type { StoreApiPrices } from "./format";

const STORE_API = `${WOO_API_BASE}/wp-json/wc/store/v1`;

// ---------- Types ----------

export interface WooImage {
  id?: number;
  src: string;
  thumbnail?: string;
  alt?: string;
}

export interface WooVariationAttribute {
  attribute: string;
  value: string;
}

/** Reference to a variation on a variable product (Store API shape). */
export interface WooProductVariationRef {
  id: number;
  attributes: WooVariationAttribute[];
}

export interface WooProduct {
  id: number;
  name: string;
  slug: string;
  type: string; // "simple" | "variable" | ...
  sku: string;
  permalink: string;
  short_description: string;
  description: string;
  is_in_stock: boolean;
  prices: StoreApiPrices;
  images: WooImage[];
  variations: WooProductVariationRef[];
}

export interface WooCartItem {
  key: string;
  id: number;
  quantity: number;
  name: string;
  sku: string;
  permalink: string;
  images: WooImage[];
  prices: {
    price: string;
    currency_minor_unit: number;
    currency_prefix: string;
    currency_suffix: string;
  };
  totals: {
    line_total: string;
    currency_minor_unit: number;
  };
}

export interface WooCart {
  items: WooCartItem[];
  items_count: number;
  totals: {
    total_items: string;
    total_price: string;
    currency_minor_unit: number;
    currency_prefix: string;
    currency_suffix: string;
  };
}

// ---------- Catalog (server-side) ----------

const CATALOG_REVALIDATE = 300; // seconds

async function storeFetch<T>(path: string, revalidate = CATALOG_REVALIDATE): Promise<T | null> {
  try {
    const res = await fetch(`${STORE_API}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });
    if (!res.ok) {
      console.warn(`[woo] ${path} -> HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[woo] ${path} fetch failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Fetch the product catalog. Returns [] on any failure (never throws). */
export async function getProducts(perPage = 20): Promise<WooProduct[]> {
  const data = await storeFetch<WooProduct[]>(`/products?per_page=${perPage}`);
  return Array.isArray(data) ? data : [];
}

/** Fetch a single product by slug. Returns null when not found / on failure. */
export async function getProductBySlug(slug: string): Promise<WooProduct | null> {
  const data = await storeFetch<WooProduct[]>(`/products?slug=${encodeURIComponent(slug)}`);
  if (Array.isArray(data) && data.length > 0) return data[0];
  return null;
}

/** Fetch a single product by numeric id. */
export async function getProductById(id: number): Promise<WooProduct | null> {
  return storeFetch<WooProduct>(`/products/${id}`);
}

// ---------- Cart (client-side, Cart-Token persisted) ----------

const CART_TOKEN_COOKIE = "ecl_cart_token";

function readCartTokenCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CART_TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCartTokenCookie(token: string) {
  if (typeof document === "undefined" || !token) return;
  // The Store API's Cart-Token identifies the guest cart session. We persist it
  // so subsequent cart calls (and ultimately the WooCommerce /checkout page on
  // the same domain) resolve to the same server-side cart.
  document.cookie = `${CART_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 14}; SameSite=Lax`;
}

interface CartFetchOptions {
  method?: "GET" | "POST";
  body?: unknown;
}

/**
 * Low-level client cart request. Reads/writes the Cart-Token header <-> cookie.
 * Throws on network/CORS failure so callers can fall back to the local cart.
 */
async function cartFetch(path: string, { method = "GET", body }: CartFetchOptions = {}): Promise<WooCart> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  const token = readCartTokenCookie();
  if (token) headers["Cart-Token"] = token;

  const res = await fetch(`${STORE_API}${path}`, {
    method,
    headers,
    credentials: "include", // carry the WooCommerce session cookie for the hand-off
    body: body ? JSON.stringify(body) : undefined,
  });

  const respToken = res.headers.get("Cart-Token");
  if (respToken) writeCartTokenCookie(respToken);

  if (!res.ok) throw new Error(`Cart request failed: HTTP ${res.status}`);
  return (await res.json()) as WooCart;
}

export const wooCart = {
  get: () => cartFetch("/cart"),
  addItem: (id: number, quantity: number) =>
    cartFetch("/cart/add-item", { method: "POST", body: { id, quantity } }),
  updateItem: (key: string, quantity: number) =>
    cartFetch("/cart/update-item", { method: "POST", body: { key, quantity } }),
  removeItem: (key: string) =>
    cartFetch("/cart/remove-item", { method: "POST", body: { key } }),
};
