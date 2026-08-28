import { Bar } from "@/components/admin/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Bar className="h-6 w-40" />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-line bg-surface p-4">
            <Bar className="h-3 w-24" />
            <Bar className="h-7 w-20" />
          </div>
        ))}
      </div>
      <Bar className="h-8 w-64 rounded-full" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Bar key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}
