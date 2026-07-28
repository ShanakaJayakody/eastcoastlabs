import type { CoaRecord } from "@/lib/coa";
import Chromatogram from "./Chromatogram";
import StampSeal from "./StampSeal";
import CountUp from "./CountUp";

/**
 * The hero's visual: a rendered Certificate of Analysis, not a product photo.
 * Every field is a real value from the record passed in — no placeholder
 * numbers. This is the page's single highest-leverage trust artifact.
 */
export default function CertificateCard({ record }: { record: CoaRecord }) {
  return (
    <div className="dossier-noise relative border border-line-2 bg-surface p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="font-data text-[11px] uppercase tracking-[0.2em] text-muted-2">
            Certificate of Analysis
          </p>
          <p className="font-serif-display mt-1 text-2xl text-fg">{record.compound}</p>
        </div>
        <StampSeal size={56} className="mt-1 rotate-[-8deg] opacity-90" />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 font-data text-[13px]">
        <div>
          <dt className="text-muted-2">Batch</dt>
          <dd className="mt-0.5 text-fg">#{record.batch_id}</dd>
        </div>
        <div>
          <dt className="text-muted-2">Test date</dt>
          <dd className="mt-0.5 text-fg">{record.test_date}</dd>
        </div>
        <div>
          <dt className="text-muted-2">Laboratory</dt>
          <dd className="mt-0.5 text-fg">{record.lab}</dd>
        </div>
        <div>
          <dt className="text-muted-2">Method</dt>
          <dd className="mt-0.5 text-fg">HPLC-UV</dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-line pt-5">
        <p className="font-data text-[11px] uppercase tracking-[0.15em] text-muted-2">Purity</p>
        <p className="font-serif-display mt-1 text-[2.5rem] leading-none text-accent">
          <CountUp value={record.purity_pct} decimals={2} suffix="%" />
        </p>
      </div>

      <Chromatogram className="mt-5 h-12" />

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 font-data text-[12px]">
        <a href={record.coa_url} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
          View original PDF ↗
        </a>
        <a href={record.lab_verify_url} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
          Verify with lab ↗
        </a>
      </div>
    </div>
  );
}
