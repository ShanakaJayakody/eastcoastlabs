import { PackagePlus, UserRound } from "lucide-react";
import Link from "next/link";
import type { MovementRow } from "@/lib/admin/products";

const reasons: Record<string, string> = {
  received: "Stock received",
  recount: "Recount / correction",
  adjustment: "Stock adjustment",
  return: "Customer return",
  sale: "Sale",
};

export default function StockHistory({ movements, productName }: {
  movements: MovementRow[];
  productName: string;
}) {
  return <ul className="space-y-3" aria-label="Stock history">
    {movements.map(movement => <li key={movement.id} className="rounded-xl border border-line bg-ink-2/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 hidden rounded-lg bg-accent/10 p-2 text-accent sm:block" aria-hidden="true">
            {movement.reason === "received" ? <PackagePlus size={20}/> : <UserRound size={20}/>}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">{movement.reason === "received" ? "Added by" : "Recorded by"}</p>
            <p className="mt-0.5 break-words text-base font-semibold text-fg">
              {movement.actor_name || (movement.actor_email ? "Name not set" : "Admin not recorded")}
            </p>
            {!movement.actor_name && movement.actor_email && <Link href="/admin/settings#admin-names" className="mt-1 block text-xs font-medium text-accent underline">Set admin names</Link>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-xl font-bold tabular-nums ${movement.reversed ? "text-muted line-through" : movement.qty > 0 ? "text-success" : "text-fg"}`}>
            {movement.qty > 0 ? "+" : ""}{movement.qty.toLocaleString("en-AU")}
          </p>
          <p className="text-xs text-muted">{Math.abs(movement.qty) === 1 ? "vial" : "vials"}</p>
        </div>
      </div>
      <p className="mt-3 break-words text-sm font-medium text-fg-2">{productName}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span>{reasons[movement.reason] ?? movement.reason}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={movement.created_at}>{new Date(movement.created_at).toLocaleString("en-AU", {
          day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
          timeZone: "Australia/Melbourne", timeZoneName: "short",
        })}</time>
        {movement.reversed && <span className="rounded bg-surface-2 px-2 py-0.5 font-semibold text-fg-2">Reversed</span>}
      </div>
      {movement.note && <p className="mt-3 whitespace-pre-wrap break-words border-t border-line pt-3 text-sm text-fg-2">{movement.note}</p>}
    </li>)}
  </ul>;
}
