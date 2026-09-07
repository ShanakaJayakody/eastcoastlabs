import { requireAdmin } from "@/lib/admin/auth";
import { listPeoplePage, peopleCsv, SEGMENT_LABELS, type PersonRow, type Segment } from "@/lib/admin/people";

export const dynamic = "force-dynamic";

/** CSV of the current customers view — same segment and search as the page. */
export async function GET(request: Request) {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  const selected=params.get("segment") ?? "all";
  const segment=(selected in SEGMENT_LABELS ? selected : "all") as Segment;
  const rows:PersonRow[]=[];
  for(let page=1;;page++){
    const result=await listPeoplePage(segment,params.get("q")??undefined,page,500);
    rows.push(...result.rows);
    if(rows.length>=result.total || result.rows.length===0)break;
  }
  const date = new Date().toISOString().slice(0, 10);
  return new Response(peopleCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ecl-customers-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
