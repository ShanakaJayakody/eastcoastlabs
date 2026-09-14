import { beforeEach, expect, it, vi } from "vitest";
const { admin, rpc, db, revalidate } = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), db: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: admin }));
vi.mock("@/lib/admin/db", () => ({ adminDb: db }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
import { saveCustomerDetails } from "@/app/admin/(dashboard)/customers/profile-actions";
const input = { email: " NEW@Example.Test ", name: " Customer ", phone: "", address: {} };
beforeEach(() => { vi.clearAllMocks(); admin.mockResolvedValue({ email: "admin@example.test" }); db.mockReturnValue({ rpc }); });

it("requires admin access before opening the service database", async () => {
  admin.mockRejectedValueOnce(new Error("Forbidden"));
  await expect(saveCustomerDetails("old@example.test", input, 0)).rejects.toThrow("Forbidden");
  expect(db).not.toHaveBeenCalled();
});
it("normalizes contact data and invalidates both email URLs only on success", async () => {
  rpc.mockResolvedValueOnce({ data: { email: "new@example.test", version: 1 }, error: null });
  expect(await saveCustomerDetails(" OLD@Example.Test ", input, 0)).toMatchObject({ ok: true, email: "new@example.test", version: 1 });
  expect(rpc).toHaveBeenCalledWith("admin_save_customer", { p_email: "old@example.test", p_details: { email: "new@example.test", name: "Customer", phone: "", address: {} }, p_version: 0, p_actor: "admin@example.test" });
  expect(revalidate).toHaveBeenCalledWith("/admin/customers/old%40example.test");
  expect(revalidate).toHaveBeenCalledWith("/admin/customers/new%40example.test");
  expect(revalidate).toHaveBeenCalledWith("/admin/orders", "layout");
});
it("rejects invalid inputs and surfaces database conflicts without claiming success", async () => {
  expect(await saveCustomerDetails("old@example.test", { ...input, email: "bad" }, 0)).toMatchObject({ ok: false });
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValueOnce({ data: null, error: { message: "Customer changed in another editor" } });
  expect(await saveCustomerDetails("old@example.test", input, 0)).toEqual({ ok: false, message: "Customer changed in another editor" });
  expect(revalidate).not.toHaveBeenCalled();
});
