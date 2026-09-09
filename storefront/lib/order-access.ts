import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

type Scope = "payment" | "review";
type Options = { secret?: string; nowMs?: number; ttlSeconds?: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_TTL = 90 * 86400;

function key(options: Options): string | null {
  // Domain separation prevents using these tokens as credentials elsewhere.
  // An explicit key enables rotation independent of the Supabase service key.
  const value = options.secret ?? process.env.ORDER_ACCESS_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return value && value.length >= 32 ? value : null;
}
function signature(value: string, scope: Scope, secret: string) {
  return createHmac("sha256", secret).update(`ecl-order-access:${scope}:${value}`).digest("base64url");
}

export function createOrderAccessToken(orderId: string, scope: Scope, options: Options = {}): string {
  const secret = key(options);
  if (!secret) throw new Error("Order access signing key is not configured");
  const id = orderId.toLowerCase();
  const ttl = options.ttlSeconds ?? MAX_TTL;
  if (!UUID.test(id) || !Number.isSafeInteger(ttl) || ttl < 1 || ttl > MAX_TTL) {
    throw new Error("Invalid order access token parameters");
  }
  const expires = Math.floor((options.nowMs ?? Date.now()) / 1000) + ttl;
  const value = `v1.${id}.${expires}`;
  return `${value}.${signature(value, scope, secret)}`;
}

export function verifyOrderAccessToken(token: string | undefined, scope: Scope, options: Options = {}): string | null {
  const secret = key(options);
  if (!secret || typeof token !== "string" || token.length > 180) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, id, expiry, supplied] = parts;
  if (version !== "v1" || !UUID.test(id) || !/^[1-9]\d{9,10}$/.test(expiry) || !/^[\w-]{43}$/.test(supplied)) return null;
  const now = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const expires = Number(expiry);
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + MAX_TTL) return null;
  const expected = signature(parts.slice(0, 3).join("."), scope, secret);
  if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  return id;
}

export function paymentPath(orderId: string): string {
  return `/pay/${orderId.toLowerCase()}?token=${createOrderAccessToken(orderId, "payment")}`;
}
