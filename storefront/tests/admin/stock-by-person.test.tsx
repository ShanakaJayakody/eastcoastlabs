// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import StockByPerson from "@/components/admin/StockByPerson";
import { stockAttributionFixture } from "../fixtures/stock-attribution";
afterEach(cleanup);

it("filters by supplying person and vial size while keeping the matching counts together", () => {
  render(<StockByPerson report={stockAttributionFixture()}/>);
  fireEvent.click(screen.getByRole("button", { name: "View stock for Jordan Lee" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Search vials" }), { target: { value: "Retatrutide 10 mg" } });
  const table = screen.getByRole("table");
  const rows = within(table).getAllByRole("row");
  expect(rows).toHaveLength(2);
  expect(within(rows[1]).getByRole("rowheader")).toHaveTextContent("Jordan Lee");
  expect(within(rows[1]).getAllByRole("cell").map(cell => cell.textContent)).toEqual(["Retatrutide10 mg", "40", "10", "0", "30"]);
  expect(screen.getByText("FIFO estimate")).toBeVisible();
});

it("opens the original supplier's order allocation with physical returns accounted for", () => {
  render(<StockByPerson report={stockAttributionFixture()}/>);
  fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "View sales for Jordan Lee: Retatrutide · 10 mg" }));
  const dialog = screen.getByRole("dialog", { name: "Jordan Lee" });
  expect(within(dialog).getByRole("link", { name: "ECL-4001" })).toHaveAttribute("href", "/admin/orders/4001");
  expect(within(dialog).getByText("15 sold · 5 returned")).toBeVisible();
  expect(within(dialog).getByText("10 vials")).toBeVisible();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close sale allocations" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
