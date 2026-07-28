/**
 * 04 / THE METHOD — the four testing steps as a single continuous process
 * rule with numbered waypoints, instead of four interchangeable cards.
 */
export default function MethodRule({ steps }: { steps: { title: string; body: string }[] }) {
  if (steps.length === 0) return null;

  return (
    <div>
      <div className="hidden border-t border-line-2 sm:block" />
      <div className="grid gap-8 sm:grid-cols-4 sm:gap-6 sm:pt-8">
        {steps.map((step, i) => (
          <div key={i} className="relative border-t border-line-2 pt-5 sm:border-t-0">
            <span className="absolute -top-px left-0 hidden h-px w-10 bg-accent sm:block" aria-hidden />
            <p className="font-data text-xs text-accent">{String(i + 1).padStart(2, "0")}</p>
            <p className="font-serif-display mt-2 text-lg text-fg">{step.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            {i === 2 && (
              <p className="mt-2 font-data text-[11px] text-accent">↳ published to /lab-results</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
