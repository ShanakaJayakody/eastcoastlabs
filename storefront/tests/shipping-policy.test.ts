import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { quoteShipping, shippingCentsFor } from "@/lib/shipping";

describe("shipping charges against the discounted goods total", () => {
  it.each([
    { subtotal: 1, standard: 1000, express: 1500 },
    { subtotal: 9999, standard: 1000, express: 1500 },
    { subtotal: 10000, standard: 0, express: 1500 },
    { subtotal: 10001, standard: 0, express: 1500 },
    { subtotal: 14999, standard: 0, express: 1500 },
    { subtotal: 15000, standard: 0, express: 0 },
    { subtotal: 15001, standard: 0, express: 0 },
  ])("quotes standard $standard and express $express cents at $subtotal cents", ({ subtotal, standard, express }) => {
    expect(shippingCentsFor(subtotal, "standard", DEFAULT_SETTINGS)).toEqual({ method: "standard", cents: standard });
    expect(shippingCentsFor(subtotal, "express", DEFAULT_SETTINGS)).toEqual({ method: "express", cents: express });
  });

  it("keeps express paid when standard is unlocked and exposes the remaining express spend", () => {
    expect(quoteShipping(10000, DEFAULT_SETTINGS)).toMatchObject([
      { method: "standard", cents: 0, isFree: true, remainingCents: 0 },
      { method: "express", cents: 1500, isFree: false, remainingCents: 5000 },
    ]);
  });

  it("charges shipping again when discounts reduce a $100 basket to $99", () => {
    expect(shippingCentsFor(9900, "standard", DEFAULT_SETTINGS).cents).toBe(1000);
  });

  it("does not charge an empty cart or let a disabled express method bypass standard", () => {
    expect(quoteShipping(0, DEFAULT_SETTINGS).map((quote) => quote.cents)).toEqual([0, 0]);
    expect(shippingCentsFor(9999, "express", { ...DEFAULT_SETTINGS, expressShippingEnabled: false })).toEqual({ method: "standard", cents: 1000 });
  });
});
