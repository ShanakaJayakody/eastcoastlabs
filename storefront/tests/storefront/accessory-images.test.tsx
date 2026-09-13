// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/lib/cart-context", () => ({
  useCart: () => ({
    addLine: vi.fn(),
    stockFor: () => 10,
    priceFor: () => null,
  }),
}));
vi.mock("@/lib/ui-context", () => ({ useUI: () => ({ openCart: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ trackAddToCart: vi.fn() }));

import AccessoryGrid from "@/components/AccessoryGrid";

afterEach(cleanup);

it("shows branded pack shots for every research accessory", () => {
  render(<AccessoryGrid />);

  expect(screen.getAllByRole("img")).toHaveLength(3);
  expect(screen.getByRole("img", { name: /Insulin Syringes/i })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Alcohol Prep Swabs/i })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Reconstitution Starter Kit/i })).toBeInTheDocument();
});
