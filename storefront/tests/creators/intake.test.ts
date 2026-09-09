import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatorInput } from "@/lib/creators/types";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ rpc }) }));

const input: CreatorInput = {
  name: "Taylor Example",
  email: "taylor@example.test",
  socialUrl: "https://instagram.com/taylor.example/",
  portfolioUrl: "https://portfolio.example.test/work",
  discipline: "video",
  focus: "health",
  region: "NSW",
  pitch:
    "I create short-form visual stories for curious audiences and want to build a precise ECL concept.",
  audience: "10k-50k",
  adultAustralia: true,
  contactConsent: true,
  website: "",
};

describe("creator application intake adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("CREATOR_APPLICATION_SECRET", "test-secret-with-enough-length");
    rpc.mockResolvedValue({ data: { status: "ok" }, error: null });
  });

  it("hashes canonical and private identifiers without passing browser-only or raw client data", async () => {
    const { submitCreatorApplication } = await import("@/lib/creators/applications");
    await expect(
      submitCreatorApplication(input, {
        idempotencyKey: "30000000-0000-0000-0000-000000000001",
        clientAddress: "203.0.113.10",
      }),
    ).resolves.toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith("creator_submit_application", {
      p_input: {
        name: "Taylor Example",
        email: "taylor@example.test",
        social_url: "https://instagram.com/taylor.example/",
        portfolio_url: "https://portfolio.example.test/work",
        discipline: "video",
        focus: "health",
        region: "NSW",
        pitch:
          "I create short-form visual stories for curious audiences and want to build a precise ECL concept.",
        audience: "10k-50k",
        adult_australia: true,
        contact_consent: true,
        privacy_version: "creator-privacy-2026-09-09",
      },
      p_idempotency_key: "30000000-0000-0000-0000-000000000001",
      p_payload_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_dedupe_key: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_limit_key: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("203.0.113.10");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("website");
  });

  it("maps explicit RPC outcomes and rejects missing service configuration as unavailable", async () => {
    const { submitCreatorApplication } = await import("@/lib/creators/applications");
    rpc.mockResolvedValueOnce({ data: { status: "limited" }, error: null });
    await expect(
      submitCreatorApplication(input, {
        idempotencyKey: "30000000-0000-0000-0000-000000000001",
        clientAddress: "203.0.113.10",
      }),
    ).resolves.toEqual({ ok: false, code: "rate_limited" });
    rpc.mockResolvedValueOnce({ data: { status: "conflict" }, error: null });
    await expect(
      submitCreatorApplication(input, {
        idempotencyKey: "30000000-0000-0000-0000-000000000001",
        clientAddress: "203.0.113.10",
      }),
    ).resolves.toEqual({ ok: false, code: "conflict" });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "private database detail" } });
    await expect(
      submitCreatorApplication(input, {
        idempotencyKey: "30000000-0000-0000-0000-000000000001",
        clientAddress: "203.0.113.10",
      }),
    ).resolves.toEqual({ ok: false, code: "unavailable" });

    vi.stubEnv("CREATOR_APPLICATION_SECRET", "");
    await expect(
      submitCreatorApplication(input, {
        idempotencyKey: "30000000-0000-0000-0000-000000000001",
        clientAddress: "203.0.113.10",
      }),
    ).resolves.toEqual({ ok: false, code: "unavailable" });
  });
});
