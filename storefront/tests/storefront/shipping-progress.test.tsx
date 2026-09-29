// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import FreeShippingProgress from "@/components/FreeShippingProgress";

afterEach(cleanup);

it.each([
  [149.99, "$0.01 away from free standard shipping"],
  [150, "$50.00 away from free bacteriostatic water"],
  [199.99, "$0.01 away from free bacteriostatic water"],
  [200, "$50.00 away from free Express shipping"],
  [249.99, "$0.01 away from free Express shipping"],
  [250, "All available rewards unlocked"],
])("shows the next reward accurately at $%s", (subtotal, message) => {
  render(<FreeShippingProgress subtotal={subtotal as number} threshold={150} giftThreshold={200} expressThreshold={250} />);
  expect(screen.getByRole("status")).toHaveTextContent(message);
  expect(screen.getByText(/after discounts.*checkout/i)).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(subtotal));
});

it("keeps earned milestones visible and updates when a cart falls below a reward", () => {
  const { rerender } = render(<FreeShippingProgress subtotal={200} threshold={100} giftThreshold={150} expressThreshold={200} />);
  expect(screen.getAllByText("Unlocked")).toHaveLength(3);
  rerender(<FreeShippingProgress subtotal={149.99} threshold={100} giftThreshold={150} expressThreshold={200} />);
  expect(screen.getAllByText("Unlocked")).toHaveLength(1);
  expect(screen.getByRole("status")).toHaveTextContent("$0.01 away from free bacteriostatic water");
});

it("skips unavailable gifts and disabled Express without promising them", () => {
  const { rerender } = render(<FreeShippingProgress subtotal={150} threshold={100} expressThreshold={200} />);
  expect(screen.getByRole("status")).toHaveTextContent("$50.00 away from free Express shipping");
  expect(screen.queryByText(/bacteriostatic/i)).not.toBeInTheDocument();
  rerender(<FreeShippingProgress subtotal={150} threshold={100} giftThreshold={150} />);
  expect(screen.getByRole("status")).toHaveTextContent("All available rewards unlocked");
  expect(screen.queryByText(/Express/i)).not.toBeInTheDocument();
});

it("handles included shipping and admin thresholds in a different order", () => {
  render(<FreeShippingProgress subtotal={25} threshold={0} giftThreshold={150} expressThreshold={100} />);
  expect(screen.getByRole("status")).toHaveTextContent("$75.00 away from free Express shipping");
  expect(screen.getAllByText("Unlocked")).toHaveLength(1);
});
