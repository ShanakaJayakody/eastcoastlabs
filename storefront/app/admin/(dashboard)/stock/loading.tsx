import { Bar } from "@/components/admin/Skeleton";

export default function Loading() {
  return <section className="space-y-4 rounded-2xl border border-line bg-surface p-6" aria-label="Loading stock management">
    <Bar className="h-6 w-44"/>
    <div className="grid gap-3 sm:grid-cols-3">{[1,2,3].map(key => <Bar key={key} className="h-32"/>)}</div>
  </section>;
}
