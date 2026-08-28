import "server-only";

/**
 * Svix webhook signature verification (Resend signs with Svix).
 *
 * Hand-rolled on node:crypto rather than pulling in the `svix` package — the
 * algorithm is a single HMAC and the dependency isn't worth carrying.
 *
 * This endpoint can suppress a real customer's marketing on the strength of a
 * "bounced" payload, so verification is FAIL-CLOSED: anything we cannot prove
 * came from Resend is rejected. The one exception is a missing secret in local
 * development, which is explicit and logged rather than silent.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifyResult =
  | { ok: true; unverified?: boolean }
  | { ok: false; status: 401 | 400; reason: string };

/** Webhook timestamps older than this are replays, not deliveries. */
const TOLERANCE_SECONDS = 5 * 60;

export function verifySvixSignature(
  body: string,
  headers: {
    id: string | null;
    timestamp: string | null;
    signature: string | null;
  },
  secret: string | undefined,
): VerifyResult {
  if (!secret) {
    // No secret configured: only tolerable outside production, and never silent.
    if (process.env.NODE_ENV === "production") {
      return { ok: false, status: 401, reason: "webhook secret not configured" };
    }
    console.warn("resend webhook: no RESEND_WEBHOOK_SECRET set — payload NOT verified");
    return { ok: true, unverified: true };
  }

  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) {
    return { ok: false, status: 400, reason: "missing svix headers" };
  }

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) {
    return { ok: false, status: 400, reason: "bad svix-timestamp" };
  }
  if (Math.abs(Date.now() / 1000 - sentAt) > TOLERANCE_SECONDS) {
    return { ok: false, status: 401, reason: "timestamp outside tolerance" };
  }

  // Secrets arrive as "whsec_<base64>"; the raw key is the decoded remainder.
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  // The header carries a space-delimited list of versioned signatures, because
  // Svix rotates keys — any one matching is a pass.
  const provided = signature
    .split(" ")
    .map((part) => part.split(",", 2))
    .filter(([version]) => version === "v1")
    .map(([, sig]) => sig);

  const match = provided.some((sig) => {
    const a = Buffer.from(sig ?? "", "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });

  return match ? { ok: true } : { ok: false, status: 401, reason: "signature mismatch" };
}
