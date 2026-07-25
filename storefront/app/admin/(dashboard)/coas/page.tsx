import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import CoaManager, { type CoaRow } from "@/components/admin/CoaManager";

export const dynamic = "force-dynamic";

export default async function CoasPage() {
  await requireAdmin();
  const db = adminDb();
  const [{ data: batches }, { data: products }] = await Promise.all([
    db.from("coa_batches").select("*").order("test_date", { ascending: false }),
    db.from("products").select("name").order("name"),
  ]);
  return (
    <CoaManager
      batches={(batches ?? []) as CoaRow[]}
      compounds={(products ?? []).map((p) => p.name as string)}
    />
  );
}
