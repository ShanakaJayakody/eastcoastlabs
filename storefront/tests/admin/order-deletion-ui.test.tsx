// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { OrderStatus } from "@/lib/admin/orders";

const mocks = vi.hoisted(() => ({
  deleteOrder: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/app/admin/(dashboard)/orders/refund-actions", () => ({
  previewRefund: vi.fn(),
  commitRefund: vi.fn(),
  recordRefundSettlement: vi.fn(),
}));
vi.mock("@/app/admin/(dashboard)/orders/actions", () => ({
  editItemQty: vi.fn(),
  removeItem: vi.fn(),
  confirmPayment: vi.fn(),
  correctTracking: vi.fn(),
  advanceStatus: vi.fn(),
  cancel: vi.fn(),
  addNote: vi.fn(),
  reinstate: vi.fn(),
  deleteOrder: mocks.deleteOrder,
}));

import OrderActions from "@/components/admin/OrderActions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteOrder.mockResolvedValue({ ok: true });
});

afterEach(cleanup);

it.each<OrderStatus>(["pending", "paid", "processing", "shipped", "completed", "cancelled", "refunded"])(
  "offers permanent deletion for a %s order",
  (status) => {
    render(<OrderActions orderId="order-id" orderNumber="ECL-1001" status={status} />);
    expect(screen.getByRole("button", { name: "Delete order" })).toBeInTheDocument();
  },
);

it("requires the exact order number before deleting and returns to the orders list on success", async () => {
  render(<OrderActions orderId="order-id" orderNumber="ECL-1001" status="completed" />);

  fireEvent.click(screen.getByRole("button", { name: "Delete order" }));
  const dialog = screen.getByRole("dialog", { name: "Permanently delete ECL-1001?" });
  const confirmation = within(dialog).getByLabelText("Type ECL-1001 to confirm");
  const deleteButton = within(dialog).getByRole("button", { name: "Permanently delete" });

  expect(deleteButton).toBeDisabled();
  fireEvent.change(confirmation, { target: { value: "ECL-100" } });
  expect(deleteButton).toBeDisabled();
  fireEvent.change(confirmation, { target: { value: "ECL-1001" } });
  expect(deleteButton).toBeEnabled();
  fireEvent.click(deleteButton);

  await waitFor(() => expect(mocks.deleteOrder).toHaveBeenCalledWith("order-id", "ECL-1001"));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin/orders"));
  expect(mocks.success).toHaveBeenCalledWith("ECL-1001 permanently deleted");
  expect(mocks.refresh).not.toHaveBeenCalled();
});
