import { Bar } from "@/components/admin/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Bar className="h-6 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-line bg-surface p-4">
            <Bar className="h-3 w-24" />
            <Bar className="h-7 w-20" />
            <Bar className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bar className="h-64 w-full rounded-xl" />
        <Bar className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
