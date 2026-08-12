"use client";

import { useState } from "react";
import type { CoaRecord } from "@/lib/coa";

/**
 * Batch-number verification. A buyer enters the batch # on their vial and gets
 * the matching published COA back — turning the transparency claim into a
 * self-serve tool. Searches the same published records shown in the table.
 */
export default function CoaVerify({ records }: { records: CoaRecord[] }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CoaRecord | "none" | null>(null);

  function verify(e: React.FormEvent) {
    e.preventDefault();
    const term = query.trim().replace(/^#/, "").toLowerCase();
    if (!term) {
      setResult(null);
      return;
    }
    const match = records.find(
      (r) => r.batch_id.toLowerCase() === term || r.batch_id.toLowerCase().includes(term),
    );
    setResult(match ?? "none");
  }

  return (
    <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-surface to-ink-2 p-6">
      <h2 className="text-lg font-semibold text-fg">Verify your batch</h2>
      <p className="mt-1 text-sm text-muted">
        Enter the batch number printed on your vial to pull up its published Certificate of Analysis.
      </p>

      <form onSubmit={verify} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. 89845"
          aria-label="Batch number"
          className="min-w-0 flex-1 rounded-lg border border-line bg-ink px-3.5 py-2.5 text-sm text-fg outline-none transition focus:border-accent"
        />
        <button
          type="submit"
          className="btn-press shrink-0 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-95"
        >
          Verify
        </button>
      </form>

      {result === "none" && (
        <p className="mt-4 rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          No published COA matches that batch number. Double-check the digits, or email{" "}
          <a href="mailto:eclpeptides@gmail.com" className="underline">eclpeptides@gmail.com</a>.
        </p>
      )}

      {result && result !== "none" && (
        <div className="mt-4 rounded-xl border border-success/30 bg-success/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-success">
            <span>✓</span> Verified — Batch #{result.batch_id}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-2">Compound</dt>
              <dd className="font-medium text-fg">{result.compound}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-2">Purity</dt>
              <dd className="font-medium text-fg">{result.purity_pct.toFixed(2)}%</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-2">Lab</dt>
              <dd className="font-medium text-fg">{result.lab}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-2">Tested</dt>
              <dd className="font-medium text-fg">{result.test_date}</dd>
            </div>
          </dl>
          {(result.coa_url || result.lab_verify_url) && (
            <div className="mt-3 flex gap-4 text-sm">
              {result.coa_url && (
                <a href={result.coa_url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                  View COA →
                </a>
              )}
              {result.lab_verify_url && (
                <a href={result.lab_verify_url} target="_blank" rel="noopener noreferrer" className="text-fg-2 hover:text-accent hover:underline">
                  Verify at lab →
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
