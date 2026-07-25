import type { Metadata } from "next";
import { getAllCoa } from "@/lib/coa";
import ResearchDisclaimer from "@/components/ResearchDisclaimer";
import CoaVerify from "@/components/CoaVerify";

export const metadata: Metadata = {
  title: "Lab Results",
  description:
    "Every batch tested by an independent lab. Every result published. Browse published Certificates of Analysis from JanoShik.",
};

export const revalidate = 300;

export default async function LabResultsPage() {
  const records = await getAllCoa();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Transparency</p>
        <h1 className="mt-2 text-3xl font-bold text-fg">
          Every batch tested by an independent lab. Every result published.
        </h1>
        <p className="mt-3 text-sm text-muted">
          We test every batch through JanoShik, an independent laboratory. Purity results are
          published here before products are listed. No exceptions. If a batch doesn&apos;t pass, it
          doesn&apos;t ship.
        </p>
      </div>

      {records.length > 0 && (
        <div className="mt-8">
          <CoaVerify records={records} />
        </div>
      )}

      {records.length === 0 ? (
        <div className="mt-10 rounded-lg border border-line bg-surface p-8 text-center text-muted">
          Published results will appear here shortly.
        </div>
      ) : (
        <>
        {/* Mobile: stacked cards (no horizontal scroll) */}
        <ul className="mt-8 grid gap-3 sm:hidden">
          {records.map((r) => (
            <li key={r.batch_id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-fg">{r.compound}</span>
                <span className="rounded bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                  {r.purity_pct.toFixed(2)}%
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                <span className="font-mono">#{r.batch_id}</span>
                <span>{r.lab}</span>
                <span>{r.test_date}</span>
              </div>
              {(r.coa_url || r.lab_verify_url) && (
                <div className="mt-3 flex gap-4 text-sm">
                  {r.coa_url && (
                    <a href={r.coa_url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                      View COA →
                    </a>
                  )}
                  {r.lab_verify_url && (
                    <a href={r.lab_verify_url} target="_blank" rel="noopener noreferrer" className="text-fg-2 hover:text-accent hover:underline">
                      Verify at lab →
                    </a>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* Desktop: table */}
        <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-line sm:block">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted-2">
                <th className="px-4 py-3 font-semibold">Compound</th>
                <th className="px-4 py-3 font-semibold">Batch ID</th>
                <th className="px-4 py-3 font-semibold">Purity</th>
                <th className="px-4 py-3 font-semibold">Lab</th>
                <th className="px-4 py-3 font-semibold">Test date</th>
                <th className="px-4 py-3 font-semibold">COA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {records.map((r) => (
                <tr key={r.batch_id} className="bg-surface/40 hover:bg-surface">
                  <td className="px-4 py-3 font-semibold text-fg">{r.compound}</td>
                  <td className="px-4 py-3 font-mono text-muted">#{r.batch_id}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                      {r.purity_pct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-fg-2">{r.lab}</td>
                  <td className="px-4 py-3 text-muted">{r.test_date}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      {r.coa_url && (
                        <a href={r.coa_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          View
                        </a>
                      )}
                      {r.lab_verify_url && (
                        <a
                          href={r.lab_verify_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-fg-2 hover:text-accent hover:underline"
                        >
                          Verify
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <ResearchDisclaimer variant="badge" className="mt-8" />
    </div>
  );
}
