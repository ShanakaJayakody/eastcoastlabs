"use client";

import { useState } from "react";

/**
 * Reconstitution concentration calculator.
 *
 * Strictly reconstitution/handling MATH: peptide mass + diluent volume →
 * resulting concentration. It does NOT take a target dose or recommend one —
 * that keeps it a lab-handling tool consistent with the research-use-only,
 * no-dosing-guidance policy.
 */
export default function ReconstitutionCalculator() {
  const [mg, setMg] = useState("10");
  const [ml, setMl] = useState("2");

  const mgNum = parseFloat(mg);
  const mlNum = parseFloat(ml);
  const valid = mgNum > 0 && mlNum > 0;

  const mgPerMl = valid ? mgNum / mlNum : 0;
  const mcgPerMl = mgPerMl * 1000;
  const mcgPerUnit = mcgPerMl / 100; // an insulin unit = 0.01 ml
  const mcgPer10Units = mcgPerUnit * 10;

  const fmt = (n: number) =>
    n.toLocaleString("en-AU", { maximumFractionDigits: n < 10 ? 2 : 1 });

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h3 className="text-base font-semibold text-fg">Reconstitution concentration calculator</h3>
      <p className="mt-1 text-sm text-muted">
        Enter the vial contents and the volume of bacteriostatic water you add. Returns the resulting
        concentration for your records.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-fg-2">Vial contents (mg)</span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={mg}
            onChange={(e) => setMg(e.target.value)}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-fg outline-none focus:border-accent"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-fg-2">Bacteriostatic water (ml)</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={ml}
            onChange={(e) => setMl(e.target.value)}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-fg outline-none focus:border-accent"
          />
        </label>
      </div>

      {valid ? (
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-line bg-ink-2 p-3">
            <dt className="text-[11px] uppercase tracking-wide text-muted-2">Concentration</dt>
            <dd className="mt-1 text-lg font-bold text-fg">{fmt(mgPerMl)} <span className="text-xs font-normal text-muted">mg/ml</span></dd>
          </div>
          <div className="rounded-lg border border-line bg-ink-2 p-3">
            <dt className="text-[11px] uppercase tracking-wide text-muted-2">Per insulin unit</dt>
            <dd className="mt-1 text-lg font-bold text-fg">{fmt(mcgPerUnit)} <span className="text-xs font-normal text-muted">mcg</span></dd>
          </div>
          <div className="rounded-lg border border-line bg-ink-2 p-3">
            <dt className="text-[11px] uppercase tracking-wide text-muted-2">Per 10 units</dt>
            <dd className="mt-1 text-lg font-bold text-fg">{fmt(mcgPer10Units)} <span className="text-xs font-normal text-muted">mcg</span></dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-muted-2">Enter positive values to calculate.</p>
      )}

      <p className="mt-4 text-[11px] text-muted-2">
        Concentration reference only, based on a U-100 insulin syringe (1 unit = 0.01 ml). Research use
        only — not dosing guidance.
      </p>
    </div>
  );
}
