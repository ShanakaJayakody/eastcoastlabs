import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/admin/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/admin/db", () => ({ adminDb: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/admin/orders", () => ({
  markPaid: vi.fn(),
  updateOrderTracking: vi.fn(),
  setStatus: vi.fn(),
  updatePendingOrderItemQty: vi.fn(),
  removeOrderItem: vi.fn(),
  cancelOrder: vi.fn(),
  reinstateOrder: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import * as actions from "@/app/admin/(dashboard)/orders/actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ email: "operator@example.test" });
  mocks.rpc.mockResolvedValue({
    data: { id: "order-id", orderNumber: "ECL-1001", status: "completed" },
    error: null,
  });
});

it("deletes through the guarded RPC and invalidates every affected admin view", async () => {
  expect(actions.deleteOrder).toBeTypeOf("function");

  expect(await actions.deleteOrder("order-id", "ECL-1001")).toEqual({ ok: true });
  expect(mocks.rpc).toHaveBeenCalledWith("admin_delete_order", {
    p_order: "order-id",
    p_confirmation: "ECL-1001",
    p_actor: "operator@example.test",
  });
  expect(mocks.revalidate.mock.calls).toEqual([
    ["/admin/orders"],
    ["/admin"],
    ["/admin/customers"],
    ["/admin/reports"],
    ["/admin/stock"],
    ["/admin/fulfilment"],
  ]);
});

it("returns the database error without invalidating views or claiming success", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Type the exact order number to confirm deletion" } });

  expect(await actions.deleteOrder("order-id", "WRONG")).toEqual({
    ok: false,
    error: "Type the exact order number to confirm deletion",
  });
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
