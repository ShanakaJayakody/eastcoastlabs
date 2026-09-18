import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  admin: { id: "00000000-0000-0000-0000-000000000001", name: "Alex", email: "alex@example.test", active: true },
  auth: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: fixture.auth }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: () => ({ insert: fixture.audit }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/db", () => ({ adminDb: () => ({ from: () => ({
  update: (patch: Record<string, unknown>) => ({ eq: (_key: string, id: string) => ({ select: () => ({ maybeSingle: async () => {
    if (id !== fixture.admin.id) return { data: null, error: null };
    Object.assign(fixture.admin, patch);
    return { data: { id }, error: null };
  } }) }) }),
}) }) }));
import { saveAdminName } from "@/app/admin/(dashboard)/settings/admin-name-actions";
beforeEach(() => {
  vi.clearAllMocks();
  fixture.admin.name = "Alex";
  fixture.auth.mockResolvedValue({ email: "operator@example.test" });
  fixture.audit.mockResolvedValue({ error: null });
});

it("saves a trimmed display name while preserving the account's identity and access", async () => {
  expect(await saveAdminName(fixture.admin.id, "  Alex Chen  ")).toEqual({ ok: true, warning: undefined });
  expect(fixture.admin).toEqual({ id: fixture.admin.id, name: "Alex Chen", email: "alex@example.test", active: true });
});

it.each(["", "   ", "alex@example.test", "x".repeat(81), "Alex\nChen"])("rejects an unusable display name: %j", async name => {
  expect(await saveAdminName(fixture.admin.id, name)).toMatchObject({ ok: false });
  expect(fixture.admin.name).toBe("Alex");
});

it("requires an authenticated admin before changing names", async () => {
  fixture.auth.mockRejectedValue(new Error("Forbidden"));
  await expect(saveAdminName(fixture.admin.id, "Changed")).rejects.toThrow("Forbidden");
  expect(fixture.admin.name).toBe("Alex");
});

it("does not describe a saved name as a failed update if audit delivery fails", async () => {
  fixture.audit.mockRejectedValue(new Error("offline"));
  expect(await saveAdminName(fixture.admin.id, "Alex Chen")).toMatchObject({ ok: true, warning: expect.stringContaining("Name saved") });
  expect(fixture.admin.name).toBe("Alex Chen");
});

it("warns when the database rejects the audit entry after the name was saved", async () => {
  fixture.audit.mockResolvedValue({ error: { message: "Audit insert rejected" } });
  expect(await saveAdminName(fixture.admin.id, "Alex Chen")).toMatchObject({ ok: true, warning: expect.stringContaining("Name saved") });
  expect(fixture.admin.name).toBe("Alex Chen");
});
