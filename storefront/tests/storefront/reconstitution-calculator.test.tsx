// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReconstitutionCalculator from "@/components/ReconstitutionCalculator";

afterEach(cleanup);

function mixture(mg: string, ml: string) {
  fireEvent.change(screen.getByLabelText("Peptide in vial"), { target: { value: mg } });
  fireEvent.change(screen.getByLabelText("Diluent volume"), { target: { value: ml } });
}

it("starts without assumed quantities and calculates live from both inputs", () => {
  render(<ReconstitutionCalculator />);
  expect(screen.getByLabelText("Peptide in vial")).toHaveValue("");
  expect(screen.queryByLabelText("Concentration result")).not.toBeInTheDocument();
  mixture("10", "2");
  expect(screen.getByLabelText("Concentration result")).toHaveTextContent("5 mg/mL");
  expect(screen.getByLabelText("Concentration in micrograms")).toHaveTextContent("5,000 mcg/mL");
  mixture("5", "2.5");
  expect(screen.getByLabelText("Concentration result")).toHaveTextContent("2 mg/mL");
});

it.each(["0", "-2", "abc", "2mg", "1,000", "Infinity", "1e309"])("rejects invalid volume %s and removes stale results", (value) => {
  render(<ReconstitutionCalculator />);
  mixture("10", "2");
  mixture("10", value);
  expect(screen.getByLabelText("Diluent volume")).toHaveAttribute("aria-invalid", "true");
  expect(screen.queryByLabelText("Concentration result")).not.toBeInTheDocument();
});

it("clears a previous result when either input is cleared and preserves small nonzero results", () => {
  render(<ReconstitutionCalculator />);
  mixture("0.000001", "100");
  expect(screen.getByLabelText("Concentration result")).toHaveTextContent("1e-8 mg/mL");
  mixture("", "100");
  expect(screen.queryByLabelText("Concentration result")).not.toBeInTheDocument();
});

it("converts a sample between mL and U-100 units without changing its physical volume", async () => {
  const user = userEvent.setup();
  render(<ReconstitutionCalculator />);
  mixture("10", "2");
  await user.click(screen.getByText("Convert a sample volume"));
  fireEvent.change(screen.getByLabelText("Sample volume"), { target: { value: "0.1" } });
  expect(screen.getByLabelText("Peptide in sample")).toHaveTextContent("500 mcg");
  await user.selectOptions(screen.getByLabelText("Sample volume unit"), "units");
  expect(screen.getByLabelText("Sample volume")).toHaveValue("10");
  expect(screen.getByLabelText("Peptide in sample")).toHaveTextContent("500 mcg");
  fireEvent.change(screen.getByLabelText("Sample volume"), { target: { value: "201" } });
  expect(screen.getByLabelText("Sample volume")).toHaveAttribute("aria-invalid", "true");
  expect(screen.queryByLabelText("Peptide in sample")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Concentration result")).toHaveTextContent("5 mg/mL");
});

it("loads the labelled example, supports presets, and resets every input", async () => {
  const user = userEvent.setup();
  render(<ReconstitutionCalculator />);
  await user.click(screen.getByRole("button", { name: "Load example" }));
  expect(screen.getByLabelText("Concentration result")).toHaveTextContent("5 mg/mL");
  await user.click(within(screen.getByRole("group", { name: "Vial amount shortcuts" })).getByRole("button", { name: "5 mg" }));
  expect(screen.getByLabelText("Concentration result")).toHaveTextContent("2.5 mg/mL");
  await user.click(screen.getByRole("button", { name: "Reset" }));
  expect(screen.getByLabelText("Peptide in vial")).toHaveValue("");
  expect(screen.getByLabelText("Diluent volume")).toHaveValue("");
  expect(screen.queryByLabelText("Concentration result")).not.toBeInTheDocument();
});

it("accepts a full-volume sample after switching units without treating floating-point noise as excess volume", async () => {
  const user = userEvent.setup();
  render(<ReconstitutionCalculator />);
  mixture("10", "0.566");
  await user.click(screen.getByText("Convert a sample volume"));
  fireEvent.change(screen.getByLabelText("Sample volume"), { target: { value: "0.566" } });
  await user.selectOptions(screen.getByLabelText("Sample volume unit"), "units");
  expect(screen.getByLabelText("Sample volume")).toHaveValue("56.6");
  expect(screen.getByLabelText("Sample volume")).toHaveAttribute("aria-invalid", "false");
  expect(screen.getByLabelText("Peptide in sample")).toHaveTextContent("10,000 mcg");
  fireEvent.change(screen.getByLabelText("Sample volume"), { target: { value: "56.600001" } });
  expect(screen.getByLabelText("Sample volume")).toHaveAttribute("aria-invalid", "true");
});
