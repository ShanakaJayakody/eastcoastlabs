"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Search, X } from "lucide-react";
import type { LabReport } from "@/lib/lab-reports";

export default function LabReportLibrary({
  reports,
}: {
  reports: LabReport[];
}) {
  const [query, setQuery] = useState("");
  const term = query.trim().replace(/^#/, "").toLowerCase();
  const filtered = reports.filter((report) =>
    [
      report.compound,
      report.sample,
      report.taskNumber,
      report.batch ?? "",
      report.verificationKey,
    ].some((value) => value.toLowerCase().includes(term)),
  );

  return (
    <section
      className="ecl-report-library"
      aria-labelledby="report-library-title"
    >
      <div className="ecl-report-intro">
        <p className="ecl-eyebrow">JANOSHIK / ORIGINAL DOCUMENTS</p>
        <h2 id="report-library-title">The report library.</h2>
        <p>
          Historical supplier test reports, shared in full. These reports
          describe the samples tested and do not establish which batch is
          currently supplied. Check the sample size and batch with our team
          before ordering.
        </p>
        <p className="ecl-report-provenance">
          Client and manufacturer names are preserved as reported. Open the
          original or use its QR-code link and unique key to check the report
          with Janoshik.
        </p>
      </div>
      <div className="ecl-report-toolbar">
        <div className="ecl-report-search">
          <Search size={18} aria-hidden />
          <input
            type="search"
            aria-label="Search reports by compound, task or batch"
            placeholder="Compound, task number or batch…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <p role="status" aria-live="polite">
          {filtered.length} of {reports.length} reports
        </p>
      </div>
      {filtered.length === 0 && (
        <p className="ecl-report-empty">
          No reports match your search. Try a compound name or clear the search.
        </p>
      )}
      <div className="ecl-report-grid">
        {filtered.map((report) => (
          <article
            key={report.taskNumber}
            id={`report-${report.taskNumber}`}
            className="ecl-report-card"
            aria-labelledby={`report-title-${report.taskNumber}`}
          >
            <a
              className="ecl-report-preview"
              href={report.image}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Preview ${report.compound} original report ${report.taskNumber}`}
            >
              <Image
                src={report.image}
                alt={`Janoshik test report ${report.taskNumber} for ${report.compound}`}
                width={1600}
                height={2360}
                unoptimized
                sizes="(max-width: 760px) 90px, 130px"
              />
              <span>
                VIEW REPORT <ArrowUpRight size={13} />
              </span>
            </a>
            <div className="ecl-report-summary">
              <p className="ecl-report-task">
                JANOSHIK / TASK #{report.taskNumber}
              </p>
              <h3 id={`report-title-${report.taskNumber}`}>
                {report.compound}
              </h3>
              <p className="ecl-report-sample">{report.sample}</p>
              <dl className="ecl-report-facts">
                <div>
                  <dt>Analysis date</dt>
                  <dd>{report.testDate}</dd>
                </div>
                <div>
                  <dt>Batch</dt>
                  <dd>{report.batch ?? "Unknown (as reported)"}</dd>
                </div>
                <div>
                  <dt>Reported purity</dt>
                  <dd>
                    {report.purityPct.length
                      ? report.purityPct
                          .map((value) => `${value.toFixed(3)}%`)
                          .join("; ")
                      : "Not reported"}
                  </dd>
                </div>
              </dl>
              <details className="ecl-report-details">
                <summary>Results & source details</summary>
                <dl>
                  {report.measurements.map((measurement) => (
                    <div key={measurement.analyte}>
                      <dt>{measurement.analyte}</dt>
                      <dd>
                        {measurement.mg
                          .map((value) => value.toFixed(2))
                          .join("; ")}{" "}
                        mg
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt>Client</dt>
                    <dd>{report.client}</dd>
                  </div>
                  <div>
                    <dt>Manufacturer</dt>
                    <dd>{report.manufacturer}</dd>
                  </div>
                  <div>
                    <dt>Verification key</dt>
                    <dd className="font-mono">{report.verificationKey}</dd>
                  </div>
                </dl>
                <p>
                  Values are listed in report order. Multiple values represent
                  the individual measurements shown in the original, not an
                  average.
                </p>
              </details>
              <div className="ecl-report-actions">
                <a
                  href={report.image}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open original <ArrowUpRight size={14} />
                </a>
                <a
                  href={report.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Verify at Janoshik <ArrowUpRight size={14} />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
