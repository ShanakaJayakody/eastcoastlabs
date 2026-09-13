// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import LabReportLibrary from "@/components/LabReportLibrary";
import type { LabReport } from "@/lib/lab-reports";

afterEach(cleanup);
const reports: LabReport[] = [
  {
    taskNumber: "94556",
    compound: "Retatrutide",
    productSlug: "retatrutide",
    sample: "Retatrutide 10 (White cap)",
    batch: "2025121210",
    client: "G",
    manufacturer: "G",
    testDate: "2025-12-19",
    purityPct: [99.538, 99.661, 99.539],
    measurements: [{ analyte: "Retatrutide", mg: [10.57, 10.46, 10.22] }],
    verificationKey: "RPDUXJ5MV768",
    verificationUrl: "https://www.janoshik.com/tests/94556_RPDUXJ5MV768",
    image: "/lab-reports/retatrutide-94556.png",
  },
  {
    taskNumber: "92380",
    compound: "KLOW",
    productSlug: "klow",
    sample: "Klow 80mg(Pink)",
    batch: "2025126380",
    client: "G",
    manufacturer: "G",
    testDate: "2025-12-09",
    purityPct: [],
    measurements: [{ analyte: "KPV", mg: [5.77, 5.76, 5.53] }],
    verificationKey: "Y8S16NDALBLM",
    verificationUrl: "https://www.janoshik.com/tests/92380_Y8S16NDALBLM",
    image: "/lab-reports/klow-92380.png",
  },
];

it("searches by compound, task or real batch and restores the complete list", () => {
  render(<LabReportLibrary reports={reports} />);
  const search = screen.getByRole("searchbox", { name: /search reports/i });
  for (const query of [" retatrutide ", "#94556", "2025121210"]) {
    fireEvent.change(search, { target: { value: query } });
    expect(
      screen.getByRole("article", { name: /Retatrutide/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("article", { name: /KLOW/ }),
    ).not.toBeInTheDocument();
  }
  fireEvent.change(search, { target: { value: "no-such-report" } });
  expect(screen.getByText(/no reports match/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
  expect(screen.getAllByRole("article")).toHaveLength(2);
});

it("preserves every reported purity measurement and distinguishes a task from a batch", () => {
  render(<LabReportLibrary reports={reports} />);
  const report = within(screen.getByRole("article", { name: /Retatrutide/ }));
  expect(report.getByText("2025121210")).toBeInTheDocument();
  expect(report.getByText("99.538%; 99.661%; 99.539%")).toBeInTheDocument();
  expect(report.getByRole("link", { name: /open original/i })).toHaveAttribute(
    "href",
    "/lab-reports/retatrutide-94556.png",
  );
  expect(
    report.getByRole("link", { name: /verify at janoshik/i }),
  ).toHaveAttribute(
    "href",
    "https://www.janoshik.com/tests/94556_RPDUXJ5MV768",
  );
});

it("does not manufacture purity or a known batch for incomplete supplier reports", () => {
  render(<LabReportLibrary reports={[{ ...reports[1], batch: null }]} />);
  const report = within(screen.getByRole("article", { name: /KLOW/ }));
  expect(report.getByText("Not reported")).toBeInTheDocument();
  expect(report.getByText("Unknown (as reported)")).toBeInTheDocument();
  expect(report.getByText("5.77; 5.76; 5.53 mg")).toBeInTheDocument();
  expect(
    screen.getByText(/do not establish which batch is currently supplied/i),
  ).toBeInTheDocument();
  expect(screen.queryByText(/0\.00%/)).not.toBeInTheDocument();
});
