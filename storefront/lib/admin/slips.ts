import { adminDb } from "./db";

/**
 * Latest published COA batch per compound, keyed by the product names passed in.
 * Printed on packing slips so each parcel carries its own proof of testing.
 */
export async function coaByCompound(names: string[]): Promise<Record<string, string>> {
  if (!names.length) return {};
  const { data } = await adminDb()
    .from("coa_batches")
    .select("batch_id, compound, purity_pct, test_date")
    .order("test_date", { ascending: false });

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const compound = String(row.compound).toLowerCase();
    const match = names.find((n) => {
      const a = n.toLowerCase();
      return a === compound || a.includes(compound) || compound.includes(a);
    });
    if (match && !map[match]) map[match] = `${row.batch_id} · ${row.purity_pct}%`;
  }
  return map;
}
