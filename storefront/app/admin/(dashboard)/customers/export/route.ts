import { requireAdmin } from "@/lib/admin/auth";
import { listPeople, filterPeople, peopleCsv, type Segment } from "@/lib/admin/people";

export const dynamic = "force-dynamic";

/** CSV of the current customers view — same segment and search as the page. */
export async function GET(request: Request) {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  const people = await listPeople();
  const rows = filterPeople(
    people,
    (params.get("segment") ?? "all") as Segment,
    params.get("q") ?? undefined,
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response(peopleCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ecl-customers-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
