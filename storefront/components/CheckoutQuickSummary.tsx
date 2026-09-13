'use client';
import { useState } from 'react';
import { formatAud } from '@/lib/format';
import type { CartQuote } from '@/app/(store)/checkout/actions';

/** Mobile orientation before the form; authoritative item details expand on demand. */
export default function CheckoutQuickSummary({quote,ready}:{quote:CartQuote|null;ready:boolean}) {
  const [open,setOpen]=useState(false);
  const itemCount=quote?.lines.reduce((n,l)=>n+l.quantity,0) ?? 0;
  return <details className="rounded-xl border border-line bg-surface p-4 lg:hidden" onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-semibold text-fg marker:text-accent">
      {ready && quote ? `Review ${itemCount} ${itemCount===1?'item':'items'} · Total ${formatAud(quote.totalCents/100)}` : 'Review order · Confirming total'}
    </summary>
    {open && <div className="mt-3 border-t border-line pt-3 text-sm">
      {ready && quote ? <ul className="space-y-2">{quote.lines.map(line=><li key={line.key} className="flex justify-between gap-3">
        <span>{line.name}<span className="block text-xs text-muted">{line.variantLabel} × {line.quantity}</span></span>
        <span className="shrink-0">{formatAud(line.lineTotalCents/100)}</span>
      </li>)}</ul> : <p className="text-muted">Your confirmed items and charges will appear here.</p>}
      <a href="#order-summary" className="mt-3 inline-block text-accent underline">Review charges and place order</a>
    </div>}
  </details>;
}
