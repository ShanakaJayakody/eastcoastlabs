// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/app/admin/(dashboard)/orders/actions", () => ({
  advanceStatus: vi.fn(),
}));

import PackingMode, { type PackOrder } from "@/components/admin/PackingMode";
import PackingSlip from "@/components/admin/PackingSlip";
import type { OrderDetail } from "@/lib/admin/order-queries";

afterEach(cleanup);

const basePackOrder: PackOrder = {
  id: "order",
  orderNumber: "ECL-1",
  customerName: "Synthetic Buyer",
  customerEmail: "buyer@example.test",
  address: { line1: "1 Test Street", suburb: "Melbourne", state: "VIC", postcode: "3000" },
  totalCents: 3200,
  notes: null,
  items: [
    {
      id: "item",
      productName: "Sample",
      variantLabel: "1 vial",
      sku: "SAMPLE",
      qty: 1,
      refundedQty: 0,
      lineTotalCents: 3200,
    },
  ],
};

function renderPacking(shippingMethod?: string) {
  return render(
    <PackingMode
      order={{
        ...basePackOrder,
        address: {
          ...basePackOrder.address,
          ...(shippingMethod ? { shipping_method: shippingMethod } : {}),
        },
      }}
      nextId={null}
      position={1}
      total={1}
    />,
  );
}

it.each([
  ["express", "EXPRESS SHIPPING"],
  ["standard", "STANDARD SHIPPING"],
  [undefined, "STANDARD SHIPPING"],
])("makes the %s method prominent before an order is packed", (method, expected) => {
  renderPacking(method);

  expect(screen.getByRole("region", { name: "Shipping method" })).toHaveTextContent(expected);
});

it("repeats express shipping at the address and final dispatch confirmation", () => {
  renderPacking("express");

  expect(screen.getByRole("heading", { name: "Ship to" }).parentElement).toHaveTextContent(
    "EXPRESS SHIPPING",
  );

  fireEvent.change(screen.getByLabelText("Tracking number"), { target: { value: "TRACK-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Mark shipped anyway" }));

  expect(within(screen.getByRole("dialog")).getByText("EXPRESS SHIPPING")).toBeVisible();
});

it.each([
  ["express", "EXPRESS SHIPPING"],
  ["standard", "STANDARD SHIPPING"],
  [undefined, "STANDARD SHIPPING"],
])("prints the %s method prominently on the packing slip", (method, expected) => {
  const order = {
    id: "order",
    order_number: "ECL-1",
    status: "paid",
    customer_email: "buyer@example.test",
    customer_name: "Synthetic Buyer",
    shipping_address: {
      line1: "1 Test Street",
      suburb: "Melbourne",
      state: "VIC",
      postcode: "3000",
      ...(method ? { shipping_method: method } : {}),
    },
    subtotal_cents: 3200,
    discount_cents: 0,
    shipping_cents: 1000,
    total_cents: 4200,
    discount_code: null,
    payment_method: "bank_transfer",
    payment_ref: null,
    tracking_number: null,
    notes: null,
    stock_settled: true,
    refunded_cents: 0,
    created_at: "2026-09-30",
    paid_at: "2026-09-30",
    shipped_at: null,
    items: [
      {
        id: "item",
        variant_id: "variant",
        product_name: "Sample",
        product_slug: "sample",
        variant_label: "1 vial",
        size_label: null,
        sku: "SAMPLE",
        unit_price_cents: 3200,
        qty: 1,
        line_total_cents: 3200,
        refunded_qty: 0,
        refunded_cents: 0,
      },
    ],
    events: [],
  } as OrderDetail;

  render(<PackingSlip order={order} />);

  expect(screen.getByRole("region", { name: "Shipping method" })).toHaveTextContent(expected);
});
