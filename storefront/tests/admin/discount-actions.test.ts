import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  deleteRows: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/admin/auth", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("@/lib/admin/db", () => ({ adminDb: () => ({ from: m.from }) }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: m.audit }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));

import { createDiscount, deleteDiscount } from "@/app/admin/(dashboard)/discounts/actions";

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdmin.mockResolvedValue({ email: "operator@example.test" });

  const query = {
    select: m.select,
    eq: m.eq,
    maybeSingle: m.maybeSingle,
    delete: m.deleteRows,
  };
  m.from.mockReturnValue(query);
  m.select.mockReturnValue(query);
  m.eq.mockReturnValue(query);
  m.deleteRows.mockReturnValue(query);
  m.audit.mockResolvedValue(undefined);
});

it("blocks deletion of a legacy price book after a normalized kind lookup", async () => {
  m.maybeSingle.mockResolvedValue({ data: { kind: "legacy_price" }, error: null });

  expect(await deleteDiscount(" ecllegacy ")).toEqual({
    ok: false,
    error: "Legacy pricing programs cannot be deleted. Disable the program instead.",
  });
  expect(m.select).toHaveBeenCalledWith("kind");
  expect(m.eq).toHaveBeenCalledWith("code", "ECLLEGACY");
  expect(m.deleteRows).not.toHaveBeenCalled();
  expect(m.audit).not.toHaveBeenCalled();
  expect(m.revalidate).not.toHaveBeenCalled();
});

it.each(["fixed", "percent"])("retains deletion for a normal %s code", async (kind) => {
  m.maybeSingle.mockResolvedValue({ data: { kind }, error: null });
  m.eq.mockReturnValueOnce({ maybeSingle: m.maybeSingle }).mockResolvedValueOnce({ error: null });

  expect(await deleteDiscount(" save10 ")).toEqual({ ok: true, message: "SAVE10 deleted" });
  expect(m.deleteRows).toHaveBeenCalledTimes(1);
  expect(m.eq).toHaveBeenLastCalledWith("code", "SAVE10");
  expect(m.audit).toHaveBeenCalledWith({
    actor: "operator@example.test",
    action: "discount.delete",
    entityType: "discount",
    entityId: "SAVE10",
  });
  expect(m.revalidate).toHaveBeenCalledWith("/admin/discounts");
});

it.each(["legacy_price", "unknown"])(
  "rejects unsupported creation kind %s before opening the database",
  async (kind) => {
    expect(
      await createDiscount({
        code: "PROGRAM",
        kind: kind as never,
        amount: 10,
        minSpendAud: 0,
      }),
    ).toEqual({ ok: false, error: "Discount kind must be percent or fixed." });
    expect(m.from).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  },
);
