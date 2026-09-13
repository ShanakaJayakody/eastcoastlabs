// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CartProvider } from "@/lib/cart-context";
import CartContents from "@/components/CartContents";

vi.mock("@/lib/analytics", () => ({ trackBeginCheckout: vi.fn() }));
vi.mock("@/components/CartUpsell", () => ({ default: () => null }));
beforeEach(() => localStorage.clear());
afterEach(cleanup);

const paid = { key: "paid", productId: 1, name: "Test compound", slug: "test", variantLabel: "1 vial", unitPrice: 20, quantity: 1 };
const gift = { key: "gift:bac-water", productId: 990101, name: "Bacteriostatic Water", slug: "bacteriostatic-water", variantLabel: "Free gift", unitPrice: 0, quantity: 1 };

it("keeps an empty cart empty when the gift threshold is zero", () => {
  render(<CartProvider thresholds={{ freeShipping: 0, gift: 0 }}><CartContents /></CartProvider>);
  expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Checkout →" })).not.toBeInTheDocument();
});

it("removes a persisted gift with no paid items", () => {
  localStorage.setItem("ecl_cart_v1", JSON.stringify([gift]));
  render(<CartProvider thresholds={{ freeShipping: 0, gift: 0 }}><CartContents /></CartProvider>);
  expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
});

it("preserves eligible gifts but removes them when the last paid item is removed", () => {
  localStorage.setItem("ecl_cart_v1", JSON.stringify([paid]));
  render(<CartProvider thresholds={{ freeShipping: 0, gift: 0 }}><CartContents /></CartProvider>);
  expect(screen.getByRole("link", { name: "Bacteriostatic Water" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove Test compound" }));
  expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
});
