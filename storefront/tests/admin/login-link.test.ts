import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { exchangeCodeForSession, getUser, signInWithOtp } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn<() => Promise<{ data: { user: { email: string } | null } }>>(async () => ({
    data: { user: null },
  })),
  signInWithOtp: vi.fn(),
}));

vi.mock("@/lib/admin/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { exchangeCodeForSession, signInWithOtp },
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { email: "eclpeptides@gmail.com" } }) }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

describe("admin magic-link sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.eastcoastlabs.com.au");
    signInWithOtp.mockResolvedValue({ error: null });
    exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          access_token: "test-access-token",
          expires_at: 4_102_444_800,
          expires_in: 3_600,
          refresh_token: "test-refresh-token",
          token_type: "bearer",
          user: { email: "eclpeptides@gmail.com", id: "test-admin-user" },
        },
        user: { email: "eclpeptides@gmail.com", id: "test-admin-user" },
      },
      error: null,
    });
  });

  it("requests a magic link that returns to the production admin callback", async () => {
    const { sendOtp } = await import("@/app/admin/login/actions");

    await expect(sendOtp("eclpeptides@gmail.com")).resolves.toEqual({ ok: true });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "eclpeptides@gmail.com",
      options: {
        emailRedirectTo: "https://www.eastcoastlabs.com.au/admin/auth/callback",
        shouldCreateUser: true,
      },
    });
  });

  it("lets an unauthenticated magic-link callback reach its route handler", async () => {
    const { middleware } = await import("@/middleware");
    const response = await middleware(
      new NextRequest("https://www.eastcoastlabs.com.au/admin/auth/callback?code=auth-code"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets an authenticated user open login to switch admin accounts", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "admin@omthentic.ai" } } });
    const { middleware } = await import("@/middleware");
    const response = await middleware(
      new NextRequest("https://www.eastcoastlabs.com.au/admin/login"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("exchanges the PKCE code for a cookie-backed session", async () => {
    const actions = await import("@/app/admin/login/actions");
    const exchange = (actions as typeof actions & {
      exchangeMagicLinkCode?: (code: string) => Promise<{ ok: boolean; error?: string }>;
    }).exchangeMagicLinkCode;

    const result = exchange ? await exchange("auth-code") : undefined;
    expect(result).toEqual({ ok: true });
    expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
  });
});
