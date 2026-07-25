import { requireAdmin } from "@/lib/admin/auth";
import { productsCsv } from "@/lib/admin/products";

export const dynamic = "force-dynamic";

/** CSV of every variant with price + stock. Gated by requireAdmin like any page. */
export async function GET() {
  await requireAdmin();
  const csv = await productsCsv();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ecl-products-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
