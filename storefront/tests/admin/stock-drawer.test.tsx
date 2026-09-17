// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import StockDrawer, { type StockTarget } from "@/components/admin/StockDrawer";
import type { MovementRow } from "@/lib/admin/products";

const actions = vi.hoisted(() => ({ fetch: vi.fn(), adjust: vi.fn(), reverse: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: actions.refresh }) }));
vi.mock("@/app/admin/(dashboard)/products/actions", () => ({ fetchMovements: actions.fetch, adjustStock: actions.adjust, reverseReceipt: actions.reverse }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const target: StockTarget = { slug: "sample", name: "Sample · 10 mg", poolId: "pool", vialsOnHand: 12, unitCostCents: null, variants: [] };
const receipt: MovementRow = { id: "receipt", qty: 12, reason: "received", actor_email: "alex@example.test", actor_name: "Alex Chen", reversed: false, note: "Batch A", created_at: "2026-09-17T02:00:00Z" };
beforeEach(() => { vi.clearAllMocks(); actions.fetch.mockResolvedValue([receipt]); });
afterEach(cleanup);

it("opens with named receipts visible, without an extra history click or exposed email", async () => {
  render(<StockDrawer target={target} adminName="Taylor Singh" onClose={() => {}}/>);
  const history = await screen.findByRole("list", { name: "Stock history" });
  expect(within(history).getByText("Alex Chen")).toBeVisible();
  expect(within(history).getByText("+12")).toBeVisible();
  expect(within(history).getByText("Sample · 10 mg")).toBeVisible();
  expect(screen.getByText("Taylor Singh")).toBeVisible();
  expect(screen.queryByText(/alex@example/)).not.toBeInTheDocument();
});

it("does not attribute a previous product's delayed receipts to the newly opened product", async () => {
  let resolveOld!: (rows: MovementRow[]) => void;
  actions.fetch.mockImplementation((pool: string) => pool === "pool"
    ? new Promise<MovementRow[]>(resolve => { resolveOld = resolve; })
    : Promise.resolve([{ ...receipt, id: "new", actor_name: "Jordan Lee" }]));
  const view = render(<StockDrawer target={target} onClose={() => {}}/>);
  view.rerender(<StockDrawer target={{ ...target, poolId: "other", name: "Other product" }} onClose={() => {}}/>);
  await screen.findByText("Jordan Lee");
  await act(async () => { resolveOld([receipt]); });
  expect(screen.queryByText("Alex Chen")).not.toBeInTheDocument();
  expect(screen.getByText("Jordan Lee")).toBeVisible();
});

it("refreshes the named receipt history after a successful stock entry", async () => {
  actions.adjust.mockImplementation(async () => {
    actions.fetch.mockResolvedValue([{ ...receipt, id: "new", actor_name: "Taylor Singh", qty: 8 }, receipt]);
    return { ok: true, receiptId: "new", message: "Receipt saved" };
  });
  render(<StockDrawer target={target} initialMovements={[receipt]} adminName="Taylor Singh" onClose={() => {}}/>);
  fireEvent.change(screen.getByLabelText("Change (+ receive, − remove)"), { target: { value: "8" } });
  fireEvent.click(screen.getByRole("button", { name: "Receive stock" }));
  await waitFor(() => expect(within(screen.getByRole("list", { name: "Stock history" })).getByText("Taylor Singh")).toBeVisible());
  expect(screen.getByText("+8")).toBeVisible();
});

it("lets an admin retry a failed history read instead of presenting it as no receipts", async () => {
  actions.fetch.mockRejectedValueOnce(new Error("offline"));
  render(<StockDrawer target={target} onClose={() => {}}/>);
  await screen.findByRole("alert");
  expect(screen.queryByText("No stock receipts recorded yet.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Alex Chen")).toBeVisible();
});
