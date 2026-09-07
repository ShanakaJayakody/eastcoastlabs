import { describe, expect, it } from "vitest";
import { createOrderAccessToken, verifyOrderAccessToken } from "@/lib/order-access";

const id = "31a1e654-4577-4176-99d8-255613de2911";
const other = "41a1e654-4577-4176-99d8-255613de2911";
const secret = "test-only-order-access-secret-at-least-32-bytes";
const nowMs = Date.UTC(2026, 8, 8);
const opts = { secret, nowMs, ttlSeconds: 3600 };

describe("scoped order access", () => {
  it("accepts a signed token only for its order, scope and lifetime", () => {
    const token = createOrderAccessToken(id, "payment", opts);
    expect(verifyOrderAccessToken(token, "payment", opts)).toBe(id);
    expect(verifyOrderAccessToken(token, "review", opts)).toBeNull();
    expect(verifyOrderAccessToken(token.replace(id, other), "payment", opts)).toBeNull();
    expect(verifyOrderAccessToken(token, "payment", { ...opts, nowMs: nowMs + 3600_000 })).toBeNull();
  });
  it("rejects malformed tokens and fails closed when keys are missing or rotated", () => {
    const token = createOrderAccessToken(id, "payment", opts);
    expect(verifyOrderAccessToken(token, "payment", { ...opts, secret: "replacement-secret-at-least-32-bytes-long" })).toBeNull();
    for (const malformed of [undefined, "", id, "v1.bad", `${token}.extra`, `${token.slice(0, -1)}!`]) {
      expect(verifyOrderAccessToken(malformed, "payment", opts)).toBeNull();
    }
    expect(verifyOrderAccessToken(token, "payment")).toBeNull();
    expect(() => createOrderAccessToken(id, "payment")).toThrow(/configured/i);
  });
  it("does not mint tokens for invalid IDs or invalid lifetimes", () => {
    expect(() => createOrderAccessToken("ECL-1042", "payment", opts)).toThrow();
    expect(() => createOrderAccessToken(id, "payment", { ...opts, ttlSeconds: -1 })).toThrow();
    expect(() => createOrderAccessToken(id, "payment", { ...opts, ttlSeconds: 365 * 86400 })).toThrow();
  });
});
