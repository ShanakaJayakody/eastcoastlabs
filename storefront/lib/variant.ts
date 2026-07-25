/**
 * A/B split-test variant attribution.
 *
 * `/` is the control arm and `/1` is the variant arm, but purchases complete on
 * a shared `/checkout` — so the landing design a visitor first saw must be
 * carried forward in a cookie, or conversions cannot be attributed at all.
 *
 * FIRST-TOUCH WINS: once the cookie exists it is never overwritten. A visitor
 * who lands on `/1`, leaves, and returns via `/` stays attributed to `v1`.
 *
 * Deliberately client-safe (no `server-only` import): this module is pulled in
 * by a "use client" component, which Next.js still evaluates while rendering on
 * the server, so every `document` / `location` access is guarded.
 */

export type Variant = "control" | "v1";

export const VARIANT_COOKIE = "ecl_variant";

/** Attribution window for the split test, in seconds (120 days). */
const MAX_AGE_SECONDS = 120 * 24 * 60 * 60;

const VARIANTS: readonly Variant[] = ["control", "v1"];

const isVariant = (value: string): value is Variant =>
  (VARIANTS as readonly string[]).includes(value);

/**
 * Exact-name cookie lookup. Returns null when absent or unreadable.
 *
 * Matching is on the trimmed name so `other_ecl_variant=x` does not satisfy a
 * lookup for `ecl_variant`, which a naive `includes`/`startsWith` scan would.
 */
function readCookie(name: string): string | null {
  let jar: string;
  try {
    jar = document.cookie;
  } catch {
    // Sandboxed iframes throw on cookie access rather than returning "".
    // Treating that as "no cookie" degrades attribution instead of breaking
    // the render.
    return null;
  }
  if (jar === "") return null;

  for (const entry of jar.split(";")) {
    const eq = entry.indexOf("=");
    if (eq === -1) continue; // valueless entry — cannot be ours
    if (entry.slice(0, eq).trim() !== name) continue;
    const raw = entry.slice(eq + 1).trim();
    try {
      // Decoded defensively: we write a plain literal, but a server-side or tag
      // manager writer could percent-encode the same cookie.
      return decodeURIComponent(raw);
    } catch {
      // Malformed percent-encoding. Report absent so the caller re-stamps a
      // clean value rather than throwing inside an effect.
      return null;
    }
  }
  return null;
}

/**
 * The arm this visitor is currently attributed to, or null if unattributed.
 * Always null during SSR and whenever the stored value is not a known arm.
 */
export function getVariant(): Variant | null {
  if (typeof document === "undefined") return null;
  const value = readCookie(VARIANT_COOKIE);
  if (value === null) return null;
  return isVariant(value) ? value : null;
}

/**
 * Records `v` as the first touch, unless an earlier first touch already exists.
 * Returns the arm the visitor is attributed to after the call — which may be an
 * earlier arm, not `v`.
 */
export function ensureVariant(v: Variant): Variant {
  // SSR: nothing to read and nothing to write. Return the requested arm so
  // callers stay synchronous; the authoritative write happens on client mount.
  if (typeof document === "undefined") return v;

  const existing = getVariant();
  if (existing !== null) return existing; // first touch already recorded

  // `Secure` makes the cookie unsettable over plain http, which would break
  // localhost development, so it is added only when the page is served on TLS.
  const onHttps = typeof location !== "undefined" && location.protocol === "https:";
  const attributes = [
    `${VARIANT_COOKIE}=${v}`, // both arm literals are URL-safe; no encoding needed
    `Max-Age=${MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
    ...(onHttps ? ["Secure"] : []),
  ];

  try {
    document.cookie = attributes.join("; ");
  } catch {
    // Same sandboxed-iframe case as the read. Attribution degrades to
    // per-pageview rather than taking the page down.
  }
  return v;
}
