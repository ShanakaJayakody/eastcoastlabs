import { describe, expect, it, vi } from "vitest";

const { database, lookup } = vi.hoisted(() => {
  const lookup = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: "pending" } }) }) }) }));
  return { lookup, database: vi.fn(() => ({ from: lookup })) };
});
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: database }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
}));

describe("private order routes", () => {
  it("does not query customer records using a sequential receipt number", async () => {
    const { default: page } = await import("@/app/(store)/checkout/thank-you/page");
    await page({ searchParams: Promise.resolve({ order: "ECL-1042" }) }).catch(() => {});
    expect(lookup).not.toHaveBeenCalled();
  });

  it("does not query payment details knowing only an order UUID", async () => {
    lookup.mockClear();
    const { default: page } = await import("@/app/(store)/pay/[id]/page");
    await expect(page({ params: Promise.resolve({ id: "31a1e654-4577-4176-99d8-255613de2911" }), searchParams: Promise.resolve({}) } as Parameters<typeof page>[0])).rejects.toThrow();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("does not query polling status knowing only an order UUID", async () => {
    lookup.mockClear();
    const { getOrderPaymentStatus } = await import("@/app/(store)/pay/actions");
    await expect(getOrderPaymentStatus("31a1e654-4577-4176-99d8-255613de2911")).resolves.toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
});
