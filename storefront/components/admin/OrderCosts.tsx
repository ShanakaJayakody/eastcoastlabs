'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveOrderCosts } from '@/app/admin/(dashboard)/orders/cost-actions';
import { VARIABLE_COST_FIELDS, type VariableCosts } from '@/lib/admin/economics';
const labels: Record<typeof VARIABLE_COST_FIELDS[number], string> = { carrier_cents: 'Carrier charges', packaging_fulfilment_cents: 'Packaging and pick/pack', payment_cents: 'Payment fees', replacement_cents: 'Replacement costs', service_cents: 'Variable service costs', acquisition_cents: 'Acquisition (including creator commissions)' };
export default function OrderCosts({ orderId, initial }: {
    orderId: string;
    initial: VariableCosts | null;
}) {
    const [pending, start] = useTransition();
    const [message, setMessage] = useState('');
    const [revision, setRevision] = useState(initial?.revision ?? 0);
    const router = useRouter();
    return <details className="rounded-xl border border-line bg-surface p-4 text-sm">
  <summary className="cursor-pointer font-semibold">Actual variable order costs</summary>
  <p className="my-3 text-xs text-muted">Enter AUD amounts from actual records. Blank means unknown; enter 0 only when verified. Keep categories separate: landed product and gift costs already belong in COGS; refunds already reduce revenue. Replacement costs cover additional unrecovered costs only. Include creator commissions in acquisition once.</p>
  <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const costs: Record<string, unknown> = {}; for (const key of VARIABLE_COST_FIELDS) {
        const value = String(form.get(key) ?? '').trim();
        if (value && !/^\d+(\.\d{1,2})?$/.test(value)) {
            setMessage('Enter valid AUD amounts with at most two decimal places.');
            return;
        }
        costs[key] = value ? Math.round(Number(value) * 100) : null;
    }
    const tax = String(form.get('tax_adjustment_cents') ?? '').trim();
    if (tax && !/^-?\d+(\.\d{1,2})?$/.test(tax)) { setMessage('Enter a signed AUD tax adjustment with at most two decimal places.'); return; }
    const taxCents = tax ? Math.round(Number(tax) * 100) : null;
    if (taxCents !== null && (!Number.isSafeInteger(taxCents) || taxCents < -2147483648 || taxCents > 2147483647)) { setMessage('Tax adjustment must be between -21,474,836.48 and 21,474,836.47 AUD.'); return; }
    costs.tax_adjustment_cents = taxCents;
    costs.note = String(form.get('note') ?? ''); costs.tax_basis_confirmed = form.get('tax_basis_confirmed') === 'on'; start(async () => { const result = await saveOrderCosts(orderId, costs, revision); if (result.ok) {
        setRevision(result.revision);
        setMessage('Costs saved.');
        router.refresh();
    }
    else
        setMessage(result.error); }); }}>
   <div className="grid gap-3 sm:grid-cols-2">{VARIABLE_COST_FIELDS.map(key => <label key={key} className="block text-xs text-muted">{labels[key]} (AUD)<input name={key} inputMode="decimal" defaultValue={initial?.[key] == null ? '' : (initial[key]! / 100).toFixed(2)} className="mt-1 block w-full rounded border border-line bg-ink p-2 text-fg" placeholder="Unknown" disabled={pending}/></label>)}</div>
   <label className="mt-3 block text-xs text-muted">Reconciled tax adjustment (AUD)<input name="tax_adjustment_cents" inputMode="decimal" defaultValue={initial?.tax_adjustment_cents == null ? '' : (initial.tax_adjustment_cents / 100).toFixed(2)} className="mt-1 block w-full rounded border border-line bg-ink p-2 text-fg" placeholder="Unknown" disabled={pending}/></label>
   <p className="mt-2 text-xs text-muted">Enter the accountant-reconciled adjustment that converts recorded receipts, frozen COGS and the five operating expense categories to a consistent net-of-applicable-tax basis. Positive amounts reduce contribution; negative credits increase it. Exclude acquisition from this adjustment and enter acquisition expense on the resulting basis. Blank keeps contribution unknown; use 0 only when verified. Signed range: −21,474,836.48 to 21,474,836.47 AUD. No tax rate or registration is assumed.</p>
   <label className="mt-3 block text-xs text-muted">Sources and cost basis<textarea name="note" maxLength={2000} defaultValue={initial?.note ?? ''} className="mt-1 block w-full rounded border border-line bg-ink p-2 text-fg" disabled={pending}/></label>
   <label className="my-3 flex items-start gap-2 text-xs text-muted"><input type="checkbox" name="tax_basis_confirmed" defaultChecked={initial?.tax_basis_confirmed ?? false} disabled={pending}/>I verified that the entered adjustment reconciles receipts, frozen COGS and operating expenses to a consistent net-of-applicable-tax basis, and acquisition is entered on that resulting basis.</label>
   <button type="submit" disabled={pending} className="rounded bg-accent px-3 py-2 font-medium text-ink disabled:opacity-50">{pending ? 'Saving…' : 'Save actual costs'}</button>
   {message && <p role="status" className="mt-2 text-xs text-muted">{message}</p>}
  </form>
 </details>;
}
