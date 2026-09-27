import Link from 'next/link';
import {METRICS, type FulfilmentParams, type Period} from '@/lib/admin/fulfilment-analytics/types';
import {compareStats, days, duration, periodLabel} from '@/lib/admin/fulfilment-analytics/format';
import {fulfilmentHref} from '@/lib/admin/fulfilment-analytics/params';

export default function PeriodTable({periods, params}: {periods: Period[]; params: FulfilmentParams}) {
  return <section>
    <h3 className="mb-1 text-sm font-medium">{params.grain === 'week' ? 'Week by week' : 'Month by month'}</h3>
    <p className="mb-3 text-xs text-muted">Fulfilment changes compare adjacent complete periods using the selected statistic.</p>
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-line bg-ink-2 text-muted"><tr>
          {['Period', 'Placed → paid', 'Paid → shipped', 'Total journey', 'Fulfilment change', 'Paid / shipped', 'Coverage'].map(h => <th key={h} className="whitespace-nowrap px-3 py-3 font-medium">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-line">{periods.map((p, i) => {
          const previous = periods[i - 1];
          const change = previous && !previous.partial.length && !p.partial.length
            ? compareStats(previous.fulfilment, p.fulfilment, params.stat) : null;
          return <tr key={p.key} className="hover:bg-surface/60">
            <td className="px-3 py-3">
              <Link className="whitespace-nowrap text-accent" href={fulfilmentHref(params, {period: p.key})}>{periodLabel(p.key, params.grain)}</Link>
              {p.partial.length > 0 && <div className="mt-1 text-[11px] text-muted">{p.partial.includes('in_progress') ? 'In progress' : p.partial.includes('history') ? 'History begins here' : 'Partial range'}</div>}
            </td>
            {METRICS.map(m => <td key={m.key} className="whitespace-nowrap px-3 py-3 tabular-nums">
              <Link className="text-fg-2 hover:text-accent" href={fulfilmentHref(params, {tab: 'orders', view: m.key === 'payment' ? 'payments' : 'shipments', metric: m.key, period: p.key, sort: 'milestone'})}>
                {days(p[m.key][params.stat])} d
                <div className="mt-1 text-[11px] text-muted">{p[m.key].n} valid{p[m.key].n > 0 && p[m.key].n < 10 ? ' · small sample' : ''}</div>
              </Link>
            </td>)}
            <td className="whitespace-nowrap px-3 py-3 tabular-nums text-fg-2">{change ? <>
              {duration(Math.abs(change.delta))} {change.delta < 0 ? 'faster' : change.delta > 0 ? 'slower' : 'change'}
              <div className="mt-1 text-[11px] text-muted">{change.percent == null ? 'Zero previous baseline' : `${Math.abs(change.percent).toFixed(1)}%`}{change.smallSample ? ' · small sample' : ''}</div>
            </> : <span className="text-muted" title="Requires two adjacent complete periods with valid observations">—</span>}</td>
            <td className="px-3 py-3 tabular-nums text-muted">{p.paid_count} / {p.shipped_count}</td>
            <td className="whitespace-nowrap px-3 py-3 text-muted">{p.fulfilment.n} / {p.shipped_count} shipping timings</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
}
