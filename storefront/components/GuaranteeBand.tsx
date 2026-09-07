import Link from "next/link";
export default function GuaranteeBand() {
  return <div className="rounded-2xl border border-accent/25 bg-surface p-8 sm:p-10">
    <h2 className="text-xl font-semibold text-fg">Check the batch documentation</h2>
    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Review the available Certificate of Analysis and match its compound and batch identifier to your product. If a document is unavailable, contact support before ordering.</p>
    <Link href="/lab-results" className="mt-4 inline-block text-sm text-accent">View available lab results →</Link>
  </div>;
}
