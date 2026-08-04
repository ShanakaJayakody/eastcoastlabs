/**
 * Shared loading primitives for admin route segments.
 *
 * These exist so navigation feels instant: a `loading.tsx` creates a Suspense
 * boundary, which lets the App Router swap the view immediately and stream the
 * real content in. Without one, the browser sits on the previous page until the
 * server responds — which reads as "the click did nothing".
 */
export function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line ${className}`} />;
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Bar className="h-4 w-40" />
        <Bar className="h-8 w-32" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bar key={i} className="h-6 w-20 rounded-full" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line bg-ink-2 px-4 py-3">
          <Bar className="h-3 w-24" />
        </div>
        <div className="divide-y divide-line">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Bar className="h-3 w-28" />
              <Bar className="h-3 flex-1" />
              <Bar className="h-3 w-16" />
              <Bar className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-line bg-surface p-5">
            <Bar className="h-4 w-32" />
            <Bar className="h-9 w-full" />
            <Bar className="h-9 w-full" />
            <Bar className="h-24 w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-line bg-surface p-4">
            <Bar className="h-3 w-20" />
            <Bar className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
