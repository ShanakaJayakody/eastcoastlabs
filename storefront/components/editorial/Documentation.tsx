import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, FileText, ScanLine, Fingerprint } from "lucide-react";
import type { CoaRecord } from "@/lib/coa";
import type { LabReport } from "@/lib/lab-reports";

export default function Documentation({
  records,
  reports = [],
}: {
  records: CoaRecord[];
  reports?: LabReport[];
}) {
  const latest = records[0];
  const report = reports[0];
  return (
    <section
      className="ecl-section ecl-documentation"
      aria-labelledby="documentation-title"
    >
      <div className="ecl-container ecl-documentation-grid">
        <div data-reveal>
          <p className="ecl-eyebrow">03 / A CLOSER LOOK</p>
          <h2 id="documentation-title">
            Confidence starts
            <br />
            with <em>clarity.</em>
          </h2>
          <p className="ecl-body-copy">
            You deserve more than a promise. Open the original reports, see
            exactly what was tested, and make a more informed choice.
          </p>
          <div className="ecl-proof-steps">
            <div>
              <Fingerprint size={22} strokeWidth={1.3} />
              <span>
                <strong>Know your compound</strong>
                <small>
                  Check the identity, size and availability on its product page.
                </small>
              </span>
            </div>
            <div>
              <ScanLine size={22} strokeWidth={1.3} />
              <span>
                <strong>Match the batch</strong>
                <small>
                  Compare the batch identifier with the available Certificate of
                  Analysis.
                </small>
              </span>
            </div>
            <div>
              <FileText size={22} strokeWidth={1.3} />
              <span>
                <strong>Read the original</strong>
                <small>
                  Review the source document. Contact our team if anything is
                  missing.
                </small>
              </span>
            </div>
          </div>
          <Link href="/lab-results" className="ecl-button ecl-button-outline">
            Explore the report library <ArrowUpRight size={18} />
          </Link>
        </div>
        {report && !latest ? (
          <div className="ecl-document-card ecl-source-card" data-reveal>
            <div className="ecl-doc-top">
              <span>THE ORIGINAL. IN FULL.</span>
              <FileText size={21} strokeWidth={1.2} />
            </div>
            <a
              href={report.image}
              target="_blank"
              rel="noopener noreferrer"
              className="ecl-source-preview"
              aria-label={`Open ${report.compound} report ${report.taskNumber}`}
            >
              <Image
                src={report.image}
                alt={`Original Janoshik ${report.compound} test report, task ${report.taskNumber}`}
                width={1600}
                height={2360}
                unoptimized
              />
            </a>
            <div className="ecl-source-caption">
              <strong>{reports.length} reports. Open to view.</strong>
              <span>
                Historical supplier report · {report.compound} ·{" "}
                {report.testDate}
              </span>
            </div>
            <Link href="/lab-results" className="ecl-doc-link">
              Read the reports <ArrowUpRight size={16} />
            </Link>
            <span className="ecl-doc-footnote">
              Sample-specific results · confirm current batch applicability with
              us
            </span>
          </div>
        ) : (
          <div className="ecl-document-card" data-reveal>
            <div className="ecl-doc-top">
              <span>EAST COAST LABS</span>
              <FileText size={21} strokeWidth={1.2} />
            </div>
            <p className="ecl-doc-kicker">THE ECL STANDARD</p>
            <h3>
              Look beyond
              <br />
              <em>the label.</em>
            </h3>
            <div className="ecl-doc-rule" />
            <p className="ecl-doc-subtitle">THREE DETAILS TO CHECK</p>
            <dl className="ecl-document-fields">
              <div>
                <dt>01 / Compound identity</dt>
                <dd>Name & composition</dd>
              </div>
              <div>
                <dt>02 / Batch reference</dt>
                <dd>Traceable identifier</dd>
              </div>
              <div>
                <dt>03 / Source document</dt>
                <dd>Original lab report</dd>
              </div>
            </dl>
            <div className="ecl-document-status">
              <span
                className={`ecl-status-dot ${latest ? "is-available" : ""}`}
              />
              <p>
                {latest ? (
                  <>
                    <strong>Published documentation available</strong>
                    <span>
                      {latest.compound} · Batch {latest.batch_id}
                    </span>
                  </>
                ) : (
                  <>
                    <strong>Check current document availability</strong>
                    <span>
                      Verified documents are currently unavailable. Please
                      contact us before ordering.
                    </span>
                  </>
                )}
              </p>
            </div>
            {latest && (
              <a
                href={latest.coa_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ecl-doc-link"
              >
                Read the latest document <ArrowUpRight size={16} />
              </a>
            )}
            <span className="ecl-doc-footnote">
              A guide to verification · not a Certificate of Analysis
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
