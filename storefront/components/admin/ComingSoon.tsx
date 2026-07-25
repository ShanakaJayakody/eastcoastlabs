import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Placeholder for modules that ship in later build phases. Keeps the shell
 *  fully navigable so the admin feels complete from day one. */
export default function ComingSoon({
  title,
  phase,
  blurb,
}: {
  title: string;
  phase: string;
  blurb?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="mb-3 rounded-full border border-line-2 bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent">
        {phase}
      </span>
      <h2 className="text-xl font-semibold text-fg">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {blurb ?? `${title} lands in ${phase} of the admin build.`}
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm text-fg-2 transition hover:text-fg"
      >
        <ArrowLeft size={15} />
        Back to dashboard
      </Link>
    </div>
  );
}
