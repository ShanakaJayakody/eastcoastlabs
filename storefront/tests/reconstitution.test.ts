import { expect, it } from "vitest";
import { calculateConcentration, formatQuantity } from "@/lib/reconstitution";

it.each([
  ["10", "2", 5, 5000, 50],
  ["5", "2.5", 2, 2000, 20],
  ["0.5", "2", 0.25, 250, 2.5],
  [".25", "1", 0.25, 250, 2.5],
])("calculates %s mg in %s mL in all displayed units", (mg, ml, expectedMg, expectedMcg, expectedUnit) => {
  const result = calculateConcentration(mg, ml);
  expect(result?.mgPerMl).toBe(expectedMg);
  expect(result?.mcgPerMl).toBe(expectedMcg);
  expect(result?.mcgPerUnit).toBe(expectedUnit);
});

it.each(["", " ", "0", "-1", "10mg", "Infinity", "NaN", "1e309"])("rejects invalid mass or volume %s", value => {
  expect(calculateConcentration(value, "2")).toBeNull();
  expect(calculateConcentration("10", value)).toBeNull();
});

it("rejects overflow and underflow rather than showing misleading numbers", () => {
  expect(calculateConcentration("1e308", "0.1")).toBeNull();
  expect(calculateConcentration("1e-300", "1e100")).toBeNull();
  expect(formatQuantity(0.00000001)).toBe("1e-8");
  expect(formatQuantity(1 / 3)).toBe("0.333333");
});
