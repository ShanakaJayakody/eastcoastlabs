// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/admin/(dashboard)/discounts/actions", () => ({
  createDiscount: vi.fn(),
  toggleDiscount: vi.fn(),
  deleteDiscount: vi.fn(),
}));

import DiscountsManager, { type DiscountRow } from "@/components/admin/DiscountsManager";

afterEach(cleanup);

const row = (overrides: Partial<DiscountRow>): DiscountRow => ({
  code: "SAVE10",
  kind: "percent",
  percent: 10,
  value_cents: null,
  min_spend_cents: 0,
  usage_limit: null,
  used_count: 0,
  expires_at: null,
  active: true,
  ...overrides,
});

it("presents the legacy price book as disable-only", () => {
  render(
    <DiscountsManager
      discounts={[
        row({ code: "ECLLEGACY", kind: "legacy_price", percent: null }),
      ]}
    />,
  );

  expect(screen.getByText("Legacy price book")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Disable" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete ECLLEGACY" })).not.toBeInTheDocument();
});

it("keeps generic percentage codes deletable", () => {
  render(<DiscountsManager discounts={[row({ code: "WELCOME10" })]} />);

  expect(screen.getByText("10% off")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete WELCOME10" })).toBeInTheDocument();
});
