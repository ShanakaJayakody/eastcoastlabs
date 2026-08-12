import type { CoaRecord } from "@/lib/coa";

/**
 * COA verification module for the PDP. When `record` is null (no COA published
 * yet, or the endpoint is unavailable) it renders a graceful "publishing"
 * state instead of crashing.
 */
export default function CoaModule({ record }: { record: CoaRecord | null }) {
  return (
    <section className="rounded-2xl border border-accent/25 bg-gradient-to-br from-surface to-ink-2 p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-accent/15 text-accent">🔬</span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg">COA verification</h2>
      </div>

      {record ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Batch ID" value={`#${record.batch_id}`} mono />
            <Field label="Purity" value={`${record.purity_pct.toFixed(2)}%`} highlight />
            <Field label="Lab" value={record.lab} />
            <Field label="Test date" value={record.test_date} />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {record.coa_url && (
              <a
                href={record.coa_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:brightness-95"
              >
                View COA (PDF)
              </a>
            )}
            {record.lab_verify_url && (
              <a
                href={record.lab_verify_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg hover:border-line-2"
              >
                Verify with {record.lab} →
              </a>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-2">
            Independently verify your batch against the published result, or send it to any lab — if
            it&apos;s below our purity guarantee, we cover the test.
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted">
          The Certificate of Analysis for the current batch is being published. Results appear on our{" "}
          <a href="/lab-results" className="text-accent">
            Lab Results
          </a>{" "}
          page before listing.
        </p>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-2">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold ${highlight ? "text-success" : "text-fg"} ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
