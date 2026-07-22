/**
 * AUD price formatting from WooCommerce Store API minor units.
 *
 * The Store API returns prices as integer strings in the currency's minor unit
 * (e.g. "5999" with currency_minor_unit 2 = $59.99). This module converts those
 * to display strings without floating-point drift.
 */

export interface StoreApiPrices {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_code: string;
  currency_minor_unit: number;
  currency_prefix: string;
  currency_suffix: string;
}

/** Convert integer minor units + minor-unit count to a major-unit number. */
export function minorToMajor(minor: string | number, minorUnit: number): number {
  const n = typeof minor === "string" ? parseInt(minor, 10) : minor;
  if (!Number.isFinite(n)) return 0;
  return n / Math.pow(10, minorUnit);
}

/**
 * Format an integer minor-unit value as a currency string, using the Store API
 * prefix/suffix when provided (defaults to AUD "$").
 */
export function formatMinor(
  minor: string | number,
  opts?: Partial<Pick<StoreApiPrices, "currency_minor_unit" | "currency_prefix" | "currency_suffix">>,
): string {
  const minorUnit = opts?.currency_minor_unit ?? 2;
  const prefix = opts?.currency_prefix ?? "$";
  const suffix = opts?.currency_suffix ?? "";
  const major = minorToMajor(minor, minorUnit);
  return `${prefix}${major.toLocaleString("en-AU", {
    minimumFractionDigits: minorUnit,
    maximumFractionDigits: minorUnit,
  })}${suffix}`;
}

/** Format a plain major-unit AUD number (e.g. from price-table.json). */
export function formatAud(amount: number, fractionDigits = 2): string {
  return `$${amount.toLocaleString("en-AU", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/** Format a whole-dollar AUD number with no cents (e.g. "$472"). */
export function formatAudWhole(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-AU")}`;
}
