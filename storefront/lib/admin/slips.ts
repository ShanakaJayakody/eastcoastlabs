import { adminDb } from "./db";

/**
 * Latest published COA batch per compound, keyed by the product names passed in.
 * General document reference only; no parcel lot allocation is inferred.
 */
export async function coaByCompound(names: string[]): Promise<Record<string, string>> {
  if (!names.length) return {};
  const { data, error } = await adminDb()
    .from("coa_batches")
    .select("batch_id, compound, purity_pct, test_date, coa_url, document_verified_at")
    .not("document_verified_at", "is", null)
    .order("test_date", { ascending: false });

  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const compound = String(row.compound).toLowerCase();
    const match = names.find((n) => {
      const a = n.toLowerCase();
      return a.trim() === compound.trim();
    });
    if (match && !map[match]) map[match] = `${row.batch_id} · ${row.purity_pct}%`;
  }
  return map;
}
