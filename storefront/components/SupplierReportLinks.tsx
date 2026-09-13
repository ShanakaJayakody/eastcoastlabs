import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import type { LabReport } from "@/lib/lab-reports";

export default function SupplierReportLinks({
  reports,
}: {
  reports: LabReport[];
}) {
  if (!reports.length) return null;
  return (
    <section
      className="ecl-supplier-reports"
      aria-label="Historical supplier reports"
    >
      <div className="flex items-center gap-3">
        <FileText size={20} />
        <h2>Lab documentation</h2>
      </div>
      <p>
        Original supplier reports are available for the samples below. They are
        historical records, not confirmation of the size or batch currently
        supplied. Contact us to confirm the applicable documentation before
        ordering.
      </p>
      {reports.map((report) => (
        <Link
          key={report.taskNumber}
          href={`/lab-results#report-${report.taskNumber}`}
        >
          <span>
            <strong>{report.sample}</strong>
            <small>
              Janoshik task #{report.taskNumber} · {report.testDate}
            </small>
          </span>
          <span>
            View report <ArrowUpRight size={16} />
          </span>
        </Link>
      ))}
    </section>
  );
}
