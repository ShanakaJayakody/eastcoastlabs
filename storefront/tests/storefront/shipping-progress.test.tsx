// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import FreeShippingProgress from "@/components/FreeShippingProgress";

afterEach(cleanup);

it.each([99, 100, 150, 250])("identifies the cart reward as standard shipping at $%s and defers discounted eligibility to checkout", (subtotal) => {
  const { container } = render(<FreeShippingProgress subtotal={subtotal} threshold={100} giftThreshold={250} />);
  expect(container.querySelector("p")).toHaveTextContent(/standard shipping/i);
  expect(screen.getByText(/after discounts.*checkout/i)).toBeInTheDocument();
});
