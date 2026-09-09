import { beforeEach, describe, expect, it, vi } from "vitest";

const submitCreatorApplication = vi.hoisted(() => vi.fn());
vi.mock("@/lib/creators/applications", () => ({ submitCreatorApplication }));

const body = {
  name: "Taylor Example",
  email: "taylor@example.test",
  phone: "0400 123 456",
  socialUrl: "https://instagram.com/taylor.example/",
  portfolioUrl: "",
  discipline: "video",
  focus: "other",
  focusDetail: "Outdoor endurance",
  region: "VIC",
  pitch:
    "I create considered short-form stories with controlled lighting and careful product framing.",
  audienceSize: 12500,
  adultAustralia: true,
  contactConsent: true,
  website: "",
};

async function post(options: {
  body?: unknown;
  origin?: string;
  type?: string;
  key?: string;
  client?: string;
  raw?: string;
} = {}) {
  const { POST } = await import("@/app/api/creators/apply/route");
  const headers = new Headers();
  if (options.type !== null) headers.set("content-type", options.type ?? "application/json");
  headers.set("origin", options.origin ?? "https://www.eastcoastlabs.com.au");
  headers.set("idempotency-key", options.key ?? "30000000-0000-0000-0000-000000000001");
  headers.set("x-ecl-client-ip", options.client ?? "203.0.113.44");
  return POST(
    new Request("https://www.eastcoastlabs.com.au/api/creators/apply", {
      method: "POST",
      headers,
      body: options.raw ?? JSON.stringify(options.body ?? body),
    }),
  );
}

describe("creator application route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("CREATOR_ALLOWED_ORIGINS", "https://www.eastcoastlabs.com.au");
    vi.stubEnv("CREATOR_TRUSTED_CLIENT_IP_HEADER", "x-ecl-client-ip");
    submitCreatorApplication.mockResolvedValue({ ok: true });
  });

  it("commits valid JSON with a trusted client identity and no-store cache control", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(submitCreatorApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "taylor@example.test",
        phone: "+61400123456",
        focus: "other",
        focusDetail: "Outdoor endurance",
        audienceSize: 12500,
      }),
      {
        idempotencyKey: "30000000-0000-0000-0000-000000000001",
        clientAddress: "203.0.113.44",
      },
    );
  });

  it("rejects invalid request boundaries before calling the database", async () => {
    for (const options of [
      { origin: "https://evil.example.test" },
      { type: "text/plain" },
      { key: "not-a-uuid" },
      { raw: "{not-json" },
    ]) {
      const response = await post(options);
      expect(response.status).toBe(400);
    }
    expect(submitCreatorApplication).not.toHaveBeenCalled();
  });

  it("rejects stale legacy wizard payloads with a readable refresh error", async () => {
    const response = await post({
      body: {
        ...body,
        phone: undefined,
        focusDetail: undefined,
        audienceSize: undefined,
        audience: "10k-50k",
      },
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "validation",
      fieldErrors: {
        name: "This application form has changed. Refresh the page and try again.",
      },
    });
    expect(submitCreatorApplication).not.toHaveBeenCalled();
  });

  it("fails closed when the trusted client identity adapter is unavailable", async () => {
    const response = await post({ client: "" });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, code: "unavailable" });
    expect(submitCreatorApplication).not.toHaveBeenCalled();
  });

  it("uses Vercel's platform forwarded address header by default when deployed there", async () => {
    vi.stubEnv("CREATOR_TRUSTED_CLIENT_IP_HEADER", "");
    vi.stubEnv("VERCEL", "1");
    const { POST } = await import("@/app/api/creators/apply/route");
    const response = await POST(
      new Request("https://www.eastcoastlabs.com.au/api/creators/apply", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://www.eastcoastlabs.com.au",
          "idempotency-key": "30000000-0000-0000-0000-000000000001",
          "x-vercel-forwarded-for": "203.0.113.55",
        },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(200);
    expect(submitCreatorApplication).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ clientAddress: "203.0.113.55" }));
  });

  it("returns validation errors and treats the honeypot as an invalid application", async () => {
    const response = await post({ body: { ...body, website: "bot" } });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "validation",
      fieldErrors: expect.objectContaining({ website: expect.any(String) }),
    });
    expect(submitCreatorApplication).not.toHaveBeenCalled();
  });

  it("enforces the streamed 16 KiB body cap", async () => {
    const response = await post({ raw: JSON.stringify({ ...body, pitch: "P".repeat(17 * 1024) }) });
    expect(response.status).toBe(413);
    expect(submitCreatorApplication).not.toHaveBeenCalled();
  });

  it("returns a typed invalid request response when the body stream errors", async () => {
    const { POST } = await import("@/app/api/creators/apply/route");
    const headers = new Headers({
      "content-type": "application/json",
      origin: "https://www.eastcoastlabs.com.au",
      "idempotency-key": "30000000-0000-0000-0000-000000000001",
      "x-ecl-client-ip": "203.0.113.44",
    });
    const response = await POST(
      new Request("https://www.eastcoastlabs.com.au/api/creators/apply", {
        method: "POST",
        headers,
        body: new ReadableStream({
          pull() {
            return Promise.reject(new Error("reader failed"));
          },
        }),
        duplex: "half",
      } as RequestInit),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: false, code: "invalid_request" });
    expect(submitCreatorApplication).not.toHaveBeenCalled();
  });

  it("maps typed adapter failures without exposing internals", async () => {
    submitCreatorApplication.mockResolvedValueOnce({ ok: false, code: "conflict" });
    expect((await post()).status).toBe(409);
    submitCreatorApplication.mockResolvedValueOnce({ ok: false, code: "rate_limited" });
    const limited = await post();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    submitCreatorApplication.mockResolvedValueOnce({ ok: false, code: "unavailable" });
    const unavailable = await post();
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({ ok: false, code: "unavailable" });
  });
});
