import "server-only";

/**
 * HMAC-signed unsubscribe tokens. The token proves the link came from us, so a
 * third party can't unsubscribe arbitrary addresses by guessing URLs. Falls
 * back to CRON_SECRET so production works before UNSUBSCRIBE_SECRET is set;
 * with neither configured, signing returns null and marketing sweeps skip
 * sending entirely (marketing mail without a working unsubscribe link would
 * violate the Spam Act).
 */
import { createHmac, timingSafeEqual } from "crypto";

const SITE = "https://eastcoastlabs.com.au";

const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";

const hmac = (email: string, key: string) =>
  createHmac("sha256", key).update(email).digest("base64url");

export function signUnsubscribeToken(email: string): string | null {
  const key = secret();
  if (!key) return null;
  const clean = email.trim().toLowerCase();
  return `${Buffer.from(clean).toString("base64url")}.${hmac(clean, key)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const key = secret();
  if (!key) return null;
  const [emailPart, sig] = token.split(".");
  if (!emailPart || !sig) return null;
  let email: string;
  try {
    email = Buffer.from(emailPart, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!email.includes("@")) return null;
  const expected = Buffer.from(hmac(email, key));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return email;
}

/** Full unsubscribe URL for an email, or null when no signing secret exists. */
export function unsubscribeUrl(email: string): string | null {
  const token = signUnsubscribeToken(email);
  return token ? `${SITE}/api/unsubscribe?t=${encodeURIComponent(token)}` : null;
}
