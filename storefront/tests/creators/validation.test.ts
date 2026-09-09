import { describe, expect, it } from "vitest";
import {
  canonicalCreatorPayload,
  isSocialHost,
  validateCreatorInput,
} from "@/lib/creators/validation";
import { CREATOR_PRIVACY_VERSION } from "@/lib/creators/content";
import type { CreatorInput } from "@/lib/creators/types";

const validInput = (overrides: Partial<CreatorInput> = {}) => ({
  name: "  Taylor Example  ",
  email: "  TAYLOR@EXAMPLE.TEST  ",
  socialUrl: "https://www.instagram.com/taylor.example/?utm_source=profile#bio",
  portfolioUrl: "https://portfolio.example.test/work?utm_campaign=launch&case=hero#top",
  discipline: "video",
  focus: "fitness",
  region: "VIC",
  pitch:
    "I create precise vertical product stories with natural light, careful pacing and a clear point of view.",
  audience: "1k-10k",
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
        socialUrl: "https://www.instagram.com/taylor.example/",
        portfolioUrl: "https://portfolio.example.test/work?case=hero",
        discipline: "video",
        focus: "fitness",
        region: "VIC",
        pitch:
          "I create precise vertical product stories with natural light, careful pacing and a clear point of view.",
        audience: "1k-10k",
        adultAustralia: true,
        contactConsent: true,
        website: "",
      },
    });
  });

  it("accepts every creator focus and an empty optional portfolio/audience", () => {
    for (const focus of ["fitness", "health", "biohacking", "other"] as const) {
      const result = validateCreatorInput(validInput({ focus, portfolioUrl: "", audience: "" }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.focus).toBe(focus);
        expect(result.value.portfolioUrl).toBe("");
        expect(result.value.audience).toBe("");
      }
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
    const cases: Array<[Partial<CreatorInput> | unknown, keyof CreatorInput]> = [
      [null, "name"],
      [["not", "an", "object"], "name"],
      [{ name: "Taylor" }, "email"],
      [validInput({ name: " " }), "name"],
      [validInput({ name: "A" }), "name"],
      [validInput({ name: "N".repeat(81) }), "name"],
      [validInput({ email: "not-email" }), "email"],
      [validInput({ email: `${"a".repeat(245)}@example.test` }), "email"],
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
      [validInput({ audience: "1m-plus" as CreatorInput["audience"] }), "audience"],
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
      audience: "1k-10k",
      pitch:
        "I create precise vertical product stories with natural light, careful pacing and a clear point of view.",
      region: "VIC",
      focus: "fitness",
      discipline: "video",
      portfolioUrl: "https://portfolio.example.test/work?case=hero",
      socialUrl: "https://www.instagram.com/taylor.example/",
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
      socialUrl: "https://www.instagram.com/taylor.example/",
      portfolioUrl: "https://portfolio.example.test/work?case=hero",
      discipline: "video",
      focus: "fitness",
      region: "VIC",
      pitch:
        "I create precise vertical product stories with natural light, careful pacing and a clear point of view.",
      audience: "1k-10k",
      adultAustralia: true,
      contactConsent: true,
    });
    expect(canonicalCreatorPayload(first.value)).not.toContain("website");
  });
});
