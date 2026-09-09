import { describe, expect, it } from "vitest";
import {
  canonicalCreatorPayload,
  isSocialHost,
  validateCreatorInput,
} from "@/lib/creators/validation";
import { CREATOR_PRIVACY_VERSION } from "@/lib/creators/content";
import type { CreatorInput } from "@/lib/creators/types";

const validInput = (overrides: Record<string, unknown> = {}) => ({
  name: "  Taylor Example  ",
  email: "  TAYLOR@EXAMPLE.TEST  ",
  phone: "  0400 123 456  ",
  socialUrl: "https://www.instagram.com/taylor.example/?utm_source=profile#bio",
  portfolioUrl: "https://portfolio.example.test/work?utm_campaign=launch&case=hero#top",
  discipline: "video",
  focus: "fitness",
  focusDetail: "",
  region: "VIC",
  pitch:
    "I create precise vertical product stories with natural light, careful pacing and a clear point of view.",
  audienceSize: "12500",
  adultAustralia: true,
  contactConsent: true,
  website: "",
  ...overrides,
});

describe("creator input validation", () => {
  it("normalizes a valid creator application without fetching profile URLs", () => {
    const result = validateCreatorInput(validInput());
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Taylor Example",
        email: "taylor@example.test",
        phone: "+61400123456",
        socialUrl: "https://www.instagram.com/taylor.example/",
        portfolioUrl: "https://portfolio.example.test/work?case=hero",
        discipline: "video",
        focus: "fitness",
        focusDetail: "",
        region: "VIC",
        pitch:
          "I create precise vertical product stories with natural light, careful pacing and a clear point of view.",
        audienceSize: 12500,
        adultAustralia: true,
        contactConsent: true,
        website: "",
      },
    });
  });

  it("accepts every preset creator focus and canonicalizes stale hidden Other detail", () => {
    for (const focus of ["fitness", "health", "biohacking"] as const) {
      const result = validateCreatorInput(validInput({ focus, focusDetail: "  stale hidden detail  ", portfolioUrl: "" }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.focus).toBe(focus);
        expect(result.value.focusDetail).toBe("");
        expect(result.value.portfolioUrl).toBe("");
      }
    }
  });

  it("requires typed detail when creator focus is Other", () => {
    const valid = validateCreatorInput(validInput({ focus: "other", focusDetail: "  Outdoor endurance  " }));
    expect(valid.ok).toBe(true);
    if (valid.ok) expect(valid.value.focusDetail).toBe("Outdoor endurance");

    for (const focusDetail of ["", " ", "x", "x".repeat(161)]) {
      const result = validateCreatorInput(validInput({ focus: "other", focusDetail }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.focusDetail).toBeTruthy();
    }
  });

  it("requires a normalized phone number and exact nonnegative whole audience size", () => {
    const auLocal = validateCreatorInput(validInput({ phone: "(03) 9123-4567", audienceSize: 0 }));
    expect(auLocal.ok).toBe(true);
    if (auLocal.ok) {
      expect(auLocal.value.phone).toBe("+61391234567");
      expect(auLocal.value.audienceSize).toBe(0);
    }

    const international = validateCreatorInput(validInput({ phone: "+64 21 123 4567", audienceSize: "00042" }));
    expect(international.ok).toBe(true);
    if (international.ok) {
      expect(international.value.phone).toBe("+64211234567");
      expect(international.value.audienceSize).toBe(42);
    }

    const cases: Array<[Record<string, unknown> | unknown, keyof CreatorInput]> = [
      [validInput({ phone: "" }), "phone"],
      [validInput({ phone: "0400 FLOWERS" }), "phone"],
      [validInput({ phone: "1300 123 456" }), "phone"],
      [validInput({ phone: "+0123456789" }), "phone"],
      [validInput({ audienceSize: "" as unknown as number }), "audienceSize"],
      [validInput({ audienceSize: null as unknown as number }), "audienceSize"],
      [validInput({ audienceSize: "12.5" as unknown as number }), "audienceSize"],
      [validInput({ audienceSize: -1 }), "audienceSize"],
      [validInput({ audienceSize: Number.POSITIVE_INFINITY }), "audienceSize"],
      [validInput({ audienceSize: 2_147_483_648 }), "audienceSize"],
    ];
    for (const [input, field] of cases) {
      const result = validateCreatorInput(input);
      expect(result.ok, JSON.stringify(input)).toBe(false);
      if (!result.ok) expect(result.fieldErrors[field]).toBeTruthy();
    }
  });

  it("accepts max length name and pitch boundaries", () => {
    const name = "N".repeat(80);
    const pitch = "P".repeat(1000);
    const result = validateCreatorInput(validInput({ name, pitch }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe(name);
      expect(result.value.pitch).toBe(pitch);
    }
  });

  it("accepts normalized Unicode URLs that stay under the stored length limit", () => {
    const result = validateCreatorInput(validInput({
      portfolioUrl: `https://portfolio.example.test/${"é".repeat(60)}`,
    }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.portfolioUrl.length).toBeLessThanOrEqual(500);
  });

  it("uses hostname boundaries for allowed social profiles", () => {
    expect(isSocialHost("instagram.com")).toBe(true);
    expect(isSocialHost("studio.youtube.com")).toBe(true);
    expect(isSocialHost("m.tiktok.com")).toBe(true);
    expect(isSocialHost("youtu.be")).toBe(true);
    expect(isSocialHost("instagram.com.evil.test")).toBe(false);
  });

  it("rejects malformed, hostile or non-consenting applications", () => {
    const cases: Array<[Record<string, unknown> | unknown, keyof CreatorInput]> = [
      [null, "name"],
      [["not", "an", "object"], "name"],
      [{ name: "Taylor" }, "email"],
      [validInput({ name: " " }), "name"],
      [validInput({ name: "A" }), "name"],
      [validInput({ name: "N".repeat(81) }), "name"],
      [validInput({ email: "not-email" }), "email"],
      [validInput({ email: `${"a".repeat(245)}@example.test` }), "email"],
      [validInput({ phone: "+1234567" }), "phone"],
      [validInput({ socialUrl: "javascript:alert(1)" }), "socialUrl"],
      [validInput({ socialUrl: "http://instagram.com/taylor" }), "socialUrl"],
      [validInput({ socialUrl: "https://instagram.com.evil.test/taylor" }), "socialUrl"],
      [validInput({ socialUrl: "https://user:pass@instagram.com/taylor" }), "socialUrl"],
      [validInput({ socialUrl: `https://instagram.com/${"é".repeat(100)}` }), "socialUrl"],
      [validInput({ portfolioUrl: 42 as unknown as string }), "portfolioUrl"],
      [validInput({ portfolioUrl: "ftp://portfolio.example.test/work" }), "portfolioUrl"],
      [validInput({ portfolioUrl: `https://portfolio.example.test/${"a".repeat(501)}` }), "portfolioUrl"],
      [validInput({ discipline: "writing" as CreatorInput["discipline"] }), "discipline"],
      [validInput({ focus: "medical" as CreatorInput["focus"] }), "focus"],
      [validInput({ region: "NZ" as CreatorInput["region"] }), "region"],
      [validInput({ pitch: "Too short." }), "pitch"],
      [validInput({ pitch: "P".repeat(1001) }), "pitch"],
      [{ ...validInput(), audience: "1m-plus" }, "website"],
      [validInput({ adultAustralia: false }), "adultAustralia"],
      [validInput({ contactConsent: false }), "contactConsent"],
      [validInput({ adultAustralia: undefined as unknown as boolean }), "adultAustralia"],
      [validInput({ website: "spam" }), "website"],
      [validInput({ website: {} as unknown as string }), "website"],
      [{ ...validInput(), unexpected: "bot-field" }, "website"],
    ];

    for (const [input, field] of cases) {
      const result = validateCreatorInput(input);
      expect(result.ok, JSON.stringify(input)).toBe(false);
      if (!result.ok) expect(result.fieldErrors[field]).toBeTruthy();
    }
  });

  it("serializes canonical payloads in a fixed non-personal-storage order", () => {
    const first = validateCreatorInput(validInput());
    const second = validateCreatorInput({
      contactConsent: true,
      website: "",
      audienceSize: "12500",
      pitch:
        "I create precise vertical product stories with natural light, careful pacing and a clear point of view.",
      region: "VIC",
      focusDetail: "",
      focus: "fitness",
      discipline: "video",
      portfolioUrl: "https://portfolio.example.test/work?case=hero",
      socialUrl: "https://www.instagram.com/taylor.example/",
      phone: "+61400123456",
      email: "taylor@example.test",
      adultAustralia: true,
      name: "Taylor Example",
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(canonicalCreatorPayload(first.value)).toBe(canonicalCreatorPayload(second.value));
    expect(JSON.parse(canonicalCreatorPayload(first.value))).toEqual({
      privacyVersion: CREATOR_PRIVACY_VERSION,
      name: "Taylor Example",
      email: "taylor@example.test",
      phone: "+61400123456",
      socialUrl: "https://www.instagram.com/taylor.example/",
      portfolioUrl: "https://portfolio.example.test/work?case=hero",
      discipline: "video",
      focus: "fitness",
      focusDetail: "",
      region: "VIC",
      pitch:
        "I create precise vertical product stories with natural light, careful pacing and a clear point of view.",
      audienceSize: 12500,
      adultAustralia: true,
      contactConsent: true,
    });
    expect(canonicalCreatorPayload(first.value)).not.toContain("website");
  });
});
