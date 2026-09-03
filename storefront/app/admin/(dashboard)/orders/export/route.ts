import { requireAdmin } from "@/lib/admin/auth";
import { ordersCsv, parseOrderSort, type OrderFilter } from "@/lib/admin/order-queries";

export const dynamic = "force-dynamic";

/** CSV of the current orders view — same filters as the page, so the download
 *  matches what the operator was looking at. Gated by requireAdmin like any page. */
export async function GET(request: Request) {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  const csv = await ordersCsv({
    status: (params.get("status") ?? "all") as OrderFilter,
    search: params.get("q") ?? undefined,
    from: params.get("from"),
    to: params.get("to"),
    sort: parseOrderSort(params.get("sort")),
    dir: params.get("dir") === "asc" ? "asc" : "desc",
  });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ecl-orders-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
