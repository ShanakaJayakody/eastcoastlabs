"use client";

import { useId, useState } from "react";
import { ArrowDown, Calculator, RotateCcw } from "lucide-react";
import { calculateConcentration, formatQuantity, positiveNumber } from "@/lib/reconstitution";

const inputClass = "w-full min-w-0 rounded-lg border border-line-2 bg-ink px-4 py-3.5 pr-16 text-xl tabular-nums text-fg placeholder:text-muted-2/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 aria-invalid:border-warn";

function QuantityField({ id, step, label, hint, unit, value, onChange, presets, shortcutLabel }: {
  id: string; step: string; label: string; hint: string; unit: string;
  value: string; onChange: (value: string) => void; presets: number[]; shortcutLabel: string;
}) {
  const invalid = value.trim() !== "" && positiveNumber(value) === null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2.5">
        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-2 text-xs text-accent">{step}</span>
        <label htmlFor={id} className="text-sm font-semibold text-fg">{label}</label>
      </div>
      <p id={`${id}-hint`} className="mb-3 text-xs leading-relaxed text-muted">{hint}</p>
      <div className="relative">
        <input id={id} type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
          value={value} onChange={e => onChange(e.target.value)} placeholder="Enter amount"
          aria-invalid={invalid} aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ""}`}
          className={inputClass} />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">{unit}</span>
      </div>
      {invalid && <p id={`${id}-error`} className="mt-2 text-xs text-warn">Enter a number greater than 0, using a decimal point if needed.</p>}
      <div role="group" aria-label={shortcutLabel} className="mt-3 flex flex-wrap gap-2">
        {presets.map(preset => <button key={preset} type="button" onClick={() => onChange(String(preset))}
          aria-pressed={positiveNumber(value) === preset}
          className="min-h-10 rounded-md border border-line px-3 text-xs text-muted hover:border-accent hover:text-fg aria-pressed:border-accent/60 aria-pressed:bg-accent/10 aria-pressed:text-accent">
          {preset} {unit}
        </button>)}
      </div>
    </div>
  );
}

/** Concentration and sample-volume math only; no suggested dose or diluent volume. */
export default function ReconstitutionCalculator() {
  const id = useId();
  const [mg, setMg] = useState("");
  const [ml, setMl] = useState("");
  const [sample, setSample] = useState("");
  const [sampleUnit, setSampleUnit] = useState<"ml" | "units">("ml");
  const [sampleOpen, setSampleOpen] = useState(false);
  const concentration = calculateConcentration(mg, ml);
  const sampleNumber = positiveNumber(sample);
  const sampleMl = sampleNumber === null ? null : sampleNumber / (sampleUnit === "units" ? 100 : 1);
  // Unit switches retain 12 significant figures; allow only their relative rounding noise.
  const tooLarge = concentration !== null && sampleMl !== null
    && sampleMl - concentration.volumeMl > concentration.volumeMl * 1e-11;
  const sampleMcg = concentration !== null && sampleMl !== null ? concentration.mcgPerMl * sampleMl : null;
  const sampleError = sample.trim() === "" ? null : sampleNumber === null
    ? "Enter a sample volume greater than 0."
    : tooLarge ? "Sample volume cannot exceed the total solution volume."
    : sampleMcg !== null && (!Number.isFinite(sampleMcg) || sampleMcg <= 0)
      ? "These values are outside the calculator’s numeric range." : null;
  const rangeError = positiveNumber(mg) !== null && positiveNumber(ml) !== null && concentration === null;

  function reset() {
    setMg(""); setMl(""); setSample(""); setSampleUnit("ml"); setSampleOpen(false);
  }

  function changeSampleUnit(unit: "ml" | "units") {
    if (sampleNumber !== null && unit !== sampleUnit) {
      const converted = sampleNumber * (unit === "units" ? 100 : 0.01);
      setSample(Number.isFinite(converted) && converted > 0 ? String(Number(converted.toPrecision(12))) : "");
    }
    setSampleUnit(unit);
  }

  return (
    <section id="reconstitution-calculator" aria-labelledby={`${id}-title`} className="scroll-mt-32 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-6 sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-accent"><Calculator size={15} aria-hidden="true" /> Research tool</p>
          <button type="button" onClick={reset} className="flex min-h-10 items-center gap-1.5 text-xs text-muted hover:text-fg"><RotateCcw size={13} aria-hidden="true" /> Reset</button>
        </div>
        <h2 id={`${id}-title`} className="mt-2 text-2xl leading-tight text-fg sm:text-3xl">Reconstitution calculator</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">Your vial. Your volume. Clear results.<br />Enter two values to calculate the concentration of your solution.</p>
      </div>

      <div className="grid md:grid-cols-2">
        <div className="space-y-7 p-5 sm:p-7">
          <QuantityField id={`${id}-mass`} step="1" label="Peptide in vial" hint="Total peptide amount shown on the vial, in milligrams (mg)."
            unit="mg" value={mg} onChange={setMg} presets={[5, 10, 20, 50]} shortcutLabel="Vial amount shortcuts" />
          <QuantityField id={`${id}-volume`} step="2" label="Diluent volume" hint="Volume of diluent added, in millilitres (mL). Use your measured final volume if it differs."
            unit="mL" value={ml} onChange={setMl} presets={[1, 2, 3, 5]} shortcutLabel="Diluent volume shortcuts" />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-4">
            <p className="text-xs text-muted">Try it: 10 mg + 2 mL</p>
            <button type="button" onClick={() => { setMg("10"); setMl("2"); setSample(""); setSampleUnit("ml"); setSampleOpen(false); }} className="min-h-10 text-xs font-semibold text-accent underline underline-offset-4">Load example</button>
          </div>
        </div>

        <div className="min-w-0 border-t border-line bg-ink-2 p-5 sm:p-7 md:border-t-0 md:border-l">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Your concentration</p>
          <div aria-live="polite" aria-atomic="true">
            {concentration ? (
              <div className="mt-4">
                <p aria-label="Concentration result" className="flex flex-wrap items-baseline gap-x-2 text-accent"><strong className="break-all text-4xl font-medium tracking-tight tabular-nums sm:text-5xl">{formatQuantity(concentration.mgPerMl)}</strong> <span className="text-lg">mg/mL</span></p>
                <p aria-label="Concentration in micrograms" className="mt-2 text-sm text-muted">{formatQuantity(concentration.mcgPerMl)} mcg/mL</p>
                <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-fg-2">{formatQuantity(concentration.massMg)} mg ÷ {formatQuantity(concentration.volumeMl)} mL = <strong className="font-medium text-fg">{formatQuantity(concentration.mgPerMl)} mg/mL</strong></p>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted">In 1 U-100 unit <span className="text-xs">(0.01 mL)</span></dt><dd className="font-medium tabular-nums text-fg">{formatQuantity(concentration.mcgPerUnit)} mcg</dd></div>
                  <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted">In 10 U-100 units <span className="text-xs">(0.1 mL)</span></dt><dd className="font-medium tabular-nums text-fg">{formatQuantity(concentration.mcgPerMl / 10)} mcg</dd></div>
                </dl>
              </div>
            ) : (
              <div className="py-9">
                <span aria-hidden="true" className="text-5xl font-light text-line-2">—</span>
                <p className="mt-4 text-base text-fg">{rangeError ? "Check your quantities" : "Start with your vial details"}</p>
                <p className={`mt-2 max-w-xs text-sm leading-relaxed ${rangeError ? "text-warn" : "text-muted"}`}>{rangeError ? "These values are outside the calculator’s numeric range. Enter smaller quantities." : "Enter a positive vial amount and diluent volume. Your result updates automatically."}</p>
              </div>
            )}
          </div>

          {concentration && <details open={sampleOpen} onToggle={e => setSampleOpen(e.currentTarget.open)} className="mt-6 border-t border-line pt-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-accent [&::-webkit-details-marker]:hidden">Convert a sample volume <ArrowDown size={15} aria-hidden="true" className={sampleOpen ? "rotate-180" : ""} /></summary>
            <p id={`${id}-sample-hint`} className="mt-2 text-xs leading-relaxed text-muted">Optional: find the amount of peptide in a volume you specify.</p>
            <label htmlFor={`${id}-sample`} className="mt-4 mb-2 block text-sm text-fg-2">Sample volume</label>
            <div className="flex flex-wrap gap-2">
              <input id={`${id}-sample`} type="text" inputMode="decimal" autoComplete="off" value={sample} placeholder="Enter volume"
                onChange={e => setSample(e.target.value)} aria-invalid={sampleError !== null}
                aria-describedby={`${id}-sample-hint${sampleError ? ` ${id}-sample-error` : ""}`}
                className="min-h-12 min-w-0 flex-1 rounded-lg border border-line-2 bg-ink px-3 text-base tabular-nums text-fg aria-invalid:border-warn" />
              <select aria-label="Sample volume unit" value={sampleUnit} onChange={e => changeSampleUnit(e.target.value as "ml" | "units")}
                className="min-h-12 max-w-full rounded-lg border border-line-2 bg-ink px-3 text-sm text-fg"><option value="ml">mL</option><option value="units">U-100 units</option></select>
            </div>
            <div aria-live="polite" aria-atomic="true">
              {sampleError && <p id={`${id}-sample-error`} className="mt-3 text-xs leading-relaxed text-warn">{sampleError}</p>}
              {!sampleError && sampleMcg !== null && sampleMl !== null && <div className="mt-4 rounded-lg border border-accent/25 bg-accent/5 p-4">
                <p aria-label="Peptide in sample" className="text-xl font-semibold tabular-nums text-accent">{formatQuantity(sampleMcg)} mcg</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{formatQuantity(sampleMcg / 1000)} mg in {formatQuantity(sampleMl)} mL ({formatQuantity(sampleMl * 100)} U-100 units).</p>
              </div>}
            </div>
          </details>}
        </div>
      </div>

      <div className="space-y-2 border-t border-line px-5 py-4 text-xs leading-relaxed text-muted sm:px-7">
        <p><span className="font-medium text-fg-2">Know your units:</span> 1 mg = 1,000 mcg. On a U-100 scale, 100 units = 1 mL. These markings measure volume, not peptide mass.</p>
        <p>Assumes complete dissolution. For blends, enter total peptide mass; results describe the combined concentration. Research reference only; not dosing or administration guidance.</p>
      </div>
    </section>
  );
}
