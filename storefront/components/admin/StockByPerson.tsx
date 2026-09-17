"use client";

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Boxes, Search, UsersRound, X } from "lucide-react";
import { UNASSIGNED_STOCK, type AttributedStockRow, type StockAttribution } from "@/lib/admin/stock-attribution";
import { useDialogFocus } from "./useDialogFocus";

const count = (value: number) => value.toLocaleString("en-AU");
const date = (value: string) => new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Melbourne" });
const vialName = (row: AttributedStockRow) => `${row.productName}${row.sizeLabel ? ` · ${row.sizeLabel}` : ""}`;

function Metrics({ supplied, sold, remaining }: { supplied: number; sold: number; remaining: number }) {
  return <dl className="grid grid-cols-3 gap-2">
    {([{ label: "Supplied", value: supplied }, { label: "Sold", value: sold }, { label: "Remaining", value: remaining }]).map(metric =>
      <div key={metric.label} className="min-w-0"><dt className="text-[11px] font-medium text-muted">{metric.label}</dt>
        <dd className={`mt-1 break-words text-xl font-semibold tabular-nums ${metric.label === "Sold" ? "text-accent" : metric.value < 0 ? "text-warn" : "text-fg"}`}>{count(metric.value)}</dd>
      </div>)}
  </dl>;
}

function SalesDialog({ row, onClose }: { row: AttributedStockRow | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useDialogFocus(Boolean(row), ref, onClose);
  if (!row) return null;
  return <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
    <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={onClose}/>
    <div className="relative flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-line p-5">
        <div className="min-w-0"><p className="text-xs text-accent">Sales attributed to</p><h3 id={`${id}-title`} className="mt-1 break-words text-xl font-semibold text-fg">{row.personName}</h3><p className="mt-1 break-words text-sm text-fg-2">{vialName(row)}</p></div>
        <button type="button" onClick={onClose} aria-label="Close sale allocations" className="rounded-lg p-2 text-muted hover:text-fg"><X size={18}/></button>
      </div>
      <div className="min-h-0 space-y-4 overflow-y-auto p-5">
        <div className="rounded-xl border border-accent/25 bg-accent/5 p-4"><p className="text-2xl font-semibold text-fg">{count(row.sold)} <span className="text-sm font-normal text-fg-2">vials sold, net of physical returns</span></p>
          <p className="mt-2 text-xs text-muted">FIFO estimate: sales are assigned to the oldest supplied stock. This does not confirm which physical batch was picked.</p></div>
        <p className="text-xs text-muted">{row.saleCount > row.sales.length ? `Latest ${row.sales.length} of ${row.saleCount} sale entries` : `${row.saleCount} sale ${row.saleCount === 1 ? "entry" : "entries"}`} · quantities in vials</p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {row.sales.map(sale => <li key={sale.movementId} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              {sale.orderId && sale.orderNumber ? <Link href={`/admin/orders/${encodeURIComponent(sale.orderId)}`} className="inline-flex items-center gap-1 break-all text-sm font-semibold text-accent-2 hover:underline">{sale.orderNumber}<ArrowUpRight size={14}/></Link>
                : <p className="text-sm font-medium text-fg-2">{sale.orderId ? "Order record unavailable" : "Manual stock sale"}</p>}
              <time className="mt-1 block text-xs text-muted" dateTime={sale.createdAt}>{date(sale.createdAt)}</time>
            </div>
            <div className="text-right"><p className="text-sm font-semibold tabular-nums text-fg">{count(sale.quantity - sale.returned)} vials</p>
              {sale.returned > 0 && <p className="mt-1 text-xs text-muted">{count(sale.quantity)} sold · {count(sale.returned)} returned</p>}</div>
          </li>)}
        </ul>
      </div>
    </div>
  </div>;
}

export default function StockByPerson({ report }: { report: StockAttribution }) {
  const id = useId();
  const [personId, setPersonId] = useState("all");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const contributors = report.people.filter(person => person.productCount > 0);
  const rows = useMemo(() => report.rows.filter(row => (personId === "all" || row.personId === personId)
    && `${row.productName} ${row.sizeLabel ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [report.rows, personId, search]);
  const selectedPerson = report.people.find(person => person.id === personId);
  const detail = report.rows.find(row => row.id === detailId) ?? null;
  function soldButton(row: AttributedStockRow) {
    return row.saleCount > 0 ? <button type="button" onClick={() => setDetailId(row.id)}
      aria-label={`View sales for ${row.personName}: ${vialName(row)}`} className="inline-flex items-center gap-1 font-semibold tabular-nums text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">{count(row.sold)}<ArrowUpRight size={13} aria-hidden="true"/></button>
      : <span className="tabular-nums text-muted">{count(row.sold)}</span>;
  }
  return <section id="stock-by-person" className="overflow-hidden rounded-2xl border border-accent/30 bg-surface shadow-[0_0_40px_-25px_var(--color-accent)]" aria-labelledby={`${id}-title`}>
    <div className="border-b border-line bg-accent/5 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent"><UsersRound size={16}/>People &amp; inventory</p>
          <h2 id={`${id}-title`} className="text-xl font-semibold text-fg sm:text-2xl">Stock by person</h2>
          <p className="mt-1 text-sm text-fg-2">Who supplied each vial, how many sold, and what remains.</p></div>
        <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">FIFO estimate</span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">Vials only · all-time totals. Sales are allocated to the person who added the oldest available stock, not the person processing the order.</p>
    </div>

    <div className="space-y-5 p-4 sm:p-6">
      {!report.rows.length ? <div className="rounded-xl border border-dashed border-line p-6 text-center"><Boxes className="mx-auto mb-3 text-muted" size={26}/><p className="font-medium text-fg">No stock activity recorded yet</p><p className="mt-1 text-sm text-muted">Receive stock under a named admin to start seeing their supplied and sold vials here.</p><Link href="/admin/products" className="mt-3 inline-block text-sm font-medium text-accent-2 underline">Manage stock</Link></div> : <>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Filter stock by person">
          {contributors.map(person => <button key={person.id} type="button" onClick={() => setPersonId(personId === person.id ? "all" : person.id)}
            aria-pressed={personId === person.id} aria-label={`View stock for ${person.name}`}
            className={`flex min-w-0 shrink-0 basis-[85%] snap-start flex-col rounded-xl border p-4 text-left transition sm:basis-auto ${personId === person.id ? "border-accent bg-accent/10" : "border-line bg-ink-2/40 hover:border-accent/50"}`}>
            <div className="mb-4 flex items-center gap-3"><span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${person.id === UNASSIGNED_STOCK ? "bg-surface-2 text-muted" : "bg-accent/15 text-accent"}`}>{person.id === UNASSIGNED_STOCK ? "?" : person.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("")}</span>
              <div className="min-w-0"><p className="break-words text-base font-semibold text-fg">{person.name}</p><p className="mt-0.5 text-xs text-muted">{person.productCount} vial {person.productCount === 1 ? "type" : "types"}{!person.active && person.id !== UNASSIGNED_STOCK ? " · former admin" : ""}</p></div></div>
            <div className="mt-auto w-full"><Metrics supplied={person.supplied} sold={person.sold} remaining={person.remaining}/></div>
          </button>)}
        </div>
        <p className="text-xs text-muted sm:hidden">Swipe to see people; tap a card to filter their vials.</p>
        {contributors.some(person => person.nameMissing) && <p className="text-xs text-muted">Some admin names are missing. <Link href="/admin/settings#admin-names" className="font-medium text-accent-2 underline">Set their display names</Link></p>}
        {(report.unresolvedVials > 0 || report.unlinkedReturnVials > 0) && <p role="status" className="rounded-lg border border-warn/30 bg-warn/5 p-3 text-xs leading-relaxed text-fg-2">
          {report.unresolvedVials > 0 && `${count(report.unresolvedVials)} vials are affected by gaps or conflicting entries in stock history. `}
          {report.unlinkedReturnVials > 0 && `${count(report.unlinkedReturnVials)} returned vials could not be matched to an original sale. `}
          These entries remain in Unassigned / legacy for review.
        </p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-base font-semibold text-fg">{selectedPerson ? `${selectedPerson.name}’s vials` : "Vials by person"}</h3><p className="mt-1 text-xs text-muted">{rows.length} {rows.length === 1 ? "row" : "rows"} · select a sold count to see its orders</p></div>
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            {personId !== "all" && <button type="button" onClick={() => setPersonId("all")} className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-medium text-fg-2">Everyone</button>}
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-ink-2 px-3 py-2"><Search size={15} className="shrink-0 text-muted" aria-hidden="true"/><span className="sr-only">Search vials</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search vial or size…" className="w-full min-w-0 bg-transparent text-sm text-fg outline-none sm:w-44"/></label>
          </div>
        </div>

        {rows.length ? <>
          <div className="hidden max-h-[420px] overflow-auto rounded-xl border border-line md:block">
            <table className="w-full text-left text-sm"><caption className="sr-only">Supplied, sold, other stock changes and remaining vials by person and product. Sold quantities use FIFO estimates.</caption>
              <thead className="sticky top-0 z-10 bg-ink-2 text-xs text-muted"><tr><th scope="col" className="px-4 py-3 font-medium">Person</th><th scope="col" className="px-4 py-3 font-medium">Vial / size</th><th scope="col" className="px-3 py-3 text-right font-medium">Supplied</th><th scope="col" className="px-3 py-3 text-right font-medium">Sold</th><th scope="col" className="px-3 py-3 text-right font-medium">Other changes</th><th scope="col" className="px-4 py-3 text-right font-medium">Remaining</th></tr></thead>
              <tbody className="divide-y divide-line">{rows.map(row => <tr key={row.id} className="hover:bg-surface-2/40"><th scope="row" className="px-4 py-3 font-medium text-fg">{row.personName}</th>
                <td className="px-4 py-3"><Link href={row.productHref} className="font-medium text-fg-2 hover:text-accent">{row.productName}</Link>{row.sizeLabel && <span className="mt-0.5 block text-xs text-muted">{row.sizeLabel}</span>}</td>
                <td className="px-3 py-3 text-right tabular-nums text-fg-2">{count(row.supplied)}</td><td className="px-3 py-3 text-right">{soldButton(row)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-muted">{row.adjusted > 0 ? "+" : ""}{count(row.adjusted)}</td><td className={`px-4 py-3 text-right font-semibold tabular-nums ${row.remaining < 0 ? "text-warn" : "text-fg"}`}>{count(row.remaining)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <ul className="max-h-[560px] space-y-3 overflow-y-auto md:hidden" aria-label="Vials by person">{rows.map(row => <li key={row.id} className="rounded-xl border border-line bg-ink-2/30 p-4">
            <p className="break-words text-xs font-semibold text-accent">{row.personName}</p><Link href={row.productHref} className="mt-1 block break-words text-sm font-semibold text-fg">{vialName(row)}</Link>
            <div className="mt-4"><Metrics supplied={row.supplied} sold={row.sold} remaining={row.remaining}/></div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3"><p className="text-xs text-muted">Other changes: {row.adjusted > 0 ? "+" : ""}{count(row.adjusted)}</p>
              {row.saleCount > 0 && <button type="button" onClick={() => setDetailId(row.id)} aria-label={`View sales for ${row.personName}: ${vialName(row)}`} className="text-xs font-semibold text-accent-2 underline">View sold vials</button>}</div>
          </li>)}</ul>
        </> : <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">No vials match this person and search.</p>}
      </>}

      <details className="border-t border-line pt-4 text-xs text-muted"><summary className="cursor-pointer font-medium text-fg-2">How the numbers are matched</summary>
        <div className="mt-3 space-y-2 leading-relaxed"><p>Supplied counts receipts recorded under that admin’s account, excluding receipt reversals. Actual suppliers can differ if someone entered stock on another person’s behalf.</p>
          <p>Sold counts physical vials removed for sales, allocated to the oldest available receipt for the same vial and size. A sale can be split between people. These are estimates, not confirmed physical picks.</p>
          <p>Physical returns reverse the latest allocation for that same order and vial. A refund without returned stock does not put vials back. Other changes include damage and recounts; stock found in a recount remains unassigned.</p>
          <p>Remaining = supplied − sold + other changes. It includes stock reserved for unpaid orders. Product sizes are kept separate; packs are counted as physical vials.</p>
          <p>Swab packs, syringe boxes and kits are excluded from vial totals. Vials included as gifts with orders still count as stock used for sales.</p>
          <p>Updated {date(report.asOf)}. All-time totals come from the recorded stock ledger.</p></div>
      </details>
    </div>
    <SalesDialog row={detail} onClose={() => setDetailId(null)}/>
  </section>;
}
