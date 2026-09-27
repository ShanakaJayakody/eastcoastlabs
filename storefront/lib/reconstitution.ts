/** Strict parsing prevents partially numeric strings from producing plausible results. */
export function positiveNumber(value: string): number | null {
  if (!/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function calculateConcentration(mass: string, volume: string) {
  const massMg = positiveNumber(mass);
  const volumeMl = positiveNumber(volume);
  if (massMg === null || volumeMl === null) return null;
  const mgPerMl = massMg / volumeMl;
  const mcgPerMl = mgPerMl * 1000;
  const mcgPerUnit = mcgPerMl / 100;
  if (![mgPerMl, mcgPerMl, mcgPerUnit].every(value => Number.isFinite(value) && value > 0)) return null;
  return { massMg, volumeMl, mgPerMl, mcgPerMl, mcgPerUnit };
}

/** Six significant figures; scientific notation keeps tiny nonzero values visible. */
export function formatQuantity(value: number): string {
  if (value !== 0 && (Math.abs(value) < 0.0001 || Math.abs(value) >= 10_000_000)) {
    return Number(value.toPrecision(6)).toExponential();
  }
  return value.toLocaleString("en-AU", { maximumSignificantDigits: 6 });
}
