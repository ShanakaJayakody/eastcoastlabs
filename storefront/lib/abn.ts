const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const;

/** Remove the conventional spaces used when displaying an ABN. */
export function normalizeAbn(value: string): string {
  return value.replace(/ /g, '');
}

/** Validate the Australian Business Register's 11-digit checksum format. */
export function isValidAbn(value: string): boolean {
  const abn = normalizeAbn(value);
  if (!/^\d{11}$/.test(abn)) return false;

  const sum = ABN_WEIGHTS.reduce((total, weight, index) => {
    const digit = Number(abn[index]) - (index === 0 ? 1 : 0);
    return total + digit * weight;
  }, 0);
  return sum % 89 === 0;
}
