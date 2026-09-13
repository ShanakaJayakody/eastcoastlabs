/** Integer-cent accounting on recorded amounts. No implicit tax or expense estimates. */
export interface EconomicLine {
    order_id: string;
    order_status?: string;
    qty: number;
    refunded_qty: number | null;
    confirmed_returned_qty: number | null;
    unit_cost_cents: number | null;
    line_total_cents: number;
    discount_allocated_cents: number;
    refunded_cents: number | null;
}
export interface ProfitSummary {
    revenueCents: number;
    /** Known COGS subtotal; incomplete when uncostedLines > 0. */
    cogsCents: number;
    profitCents: number | null;
    marginPct: number | null;
    uncostedLines: number;
}
export function summarizeLines(lines: EconomicLine[]): ProfitSummary {
    let revenueCents = 0, cogsCents = 0, uncostedLines = 0;
    for (const line of lines) {
        revenueCents += line.order_status === 'refunded' ? 0 : line.line_total_cents - line.discount_allocated_cents - (line.refunded_cents ?? 0);
        const consumed = Math.max(0, line.qty - Math.min(line.qty, Math.max(0, line.confirmed_returned_qty ?? 0)));
        if (line.unit_cost_cents == null) {
            if (consumed > 0)
                uncostedLines++;
        }
        else
            cogsCents += line.unit_cost_cents * consumed;
    }
    const profitCents = uncostedLines ? null : revenueCents - cogsCents;
    return { revenueCents, cogsCents, profitCents, uncostedLines, marginPct: profitCents != null && revenueCents > 0 ? Math.round(profitCents / revenueCents * 1000) / 10 : null };
}
export const VARIABLE_COST_FIELDS = ['carrier_cents', 'packaging_fulfilment_cents', 'payment_cents', 'replacement_cents', 'service_cents', 'acquisition_cents'] as const;
export type VariableCosts = Record<typeof VARIABLE_COST_FIELDS[number], number | null> & {
    /** Signed accountant-reconciled correction subtracted before acquisition; null is unknown. */
    tax_adjustment_cents: number | null;
    tax_basis_confirmed: boolean;
    note: string;
    revision: number;
};
export function contribution(netOrderRevenue: number, profit: ProfitSummary, costs: VariableCosts | null) {
    const beforeFields = VARIABLE_COST_FIELDS.filter(k => k !== 'acquisition_cents');
    const before = profit.profitCents == null || !costs?.tax_basis_confirmed || costs.tax_adjustment_cents == null || beforeFields.some(k => costs[k] == null)
        ? null : netOrderRevenue - profit.cogsCents - beforeFields.reduce((sum, k) => sum + (costs[k] ?? 0), 0) - costs.tax_adjustment_cents;
    return { beforeAcquisitionCents: before, afterAcquisitionCents: before == null || costs?.acquisition_cents == null ? null : before - costs.acquisition_cents };
}
export interface CustomerEconomicOrder {
    id: string;
    customer_email: string;
    created_at: string;
    paid_at: string | null;
    total_cents: number;
    refunded_cents: number | null;
    contributionCents?: number | null;
}
const DAY = 86400000;
export function matureCreatedToPaid(orders: CustomerEconomicOrder[], now = new Date(), days = 7) {
    const eligible = orders.filter(o => Date.parse(o.created_at) + days * DAY <= now.getTime());
    const paid = eligible.filter(o => o.paid_at && Date.parse(o.paid_at) >= Date.parse(o.created_at) && Date.parse(o.paid_at) <= Date.parse(o.created_at) + days * DAY).length;
    return { days, eligible: eligible.length, paid, immature: orders.length - eligible.length, pct: eligible.length ? Math.round(paid / eligible.length * 1000) / 10 : null };
}
export function customerCohorts(orders: CustomerEconomicOrder[], now = new Date()) {
    const people = new Map<string, CustomerEconomicOrder[]>();
    for (const o of orders) {
        const email = o.customer_email.trim().toLowerCase();
        if (!email || !o.paid_at || Date.parse(o.paid_at) > now.getTime())
            continue;
        const p = people.get(email) ?? [];
        p.push(o);
        people.set(email, p);
    }
    type Horizon = {
        eligible: number;
        repeat: number;
        revenueCents: number;
        contributionCents: number | null;
        coveredOrders: number;
        orders: number;
    };
    type Cohort = {
        month: string;
        customers: number;
        repeatCustomers: number;
        repeatPct: number;
        totalLtvCents: number;
        averageLtvCents: number;
        day60: Horizon;
        day90: Horizon;
    };
    const groups = new Map<string, Cohort>();
    const horizon = (): Horizon => ({ eligible: 0, repeat: 0, revenueCents: 0, contributionCents: 0, coveredOrders: 0, orders: 0 });
    for (const p of people.values()) {
        p.sort((a, b) => a.paid_at!.localeCompare(b.paid_at!) || a.id.localeCompare(b.id));
        const first = Date.parse(p[0].paid_at!);
        const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit' }).format(new Date(first));
        const g = groups.get(month) ?? { month, customers: 0, repeatCustomers: 0, repeatPct: 0, totalLtvCents: 0, averageLtvCents: 0, day60: horizon(), day90: horizon() };
        g.customers++;
        if (p.length > 1)
            g.repeatCustomers++;
        g.totalLtvCents += p.reduce((s, o) => s + o.total_cents - (o.refunded_cents ?? 0), 0);
        for (const days of [60, 90] as const) {
            if (first + days * DAY > now.getTime())
                continue;
            const h = days === 60 ? g.day60 : g.day90;
            h.eligible++;
            const within = p.filter(o => Date.parse(o.paid_at!) <= first + days * DAY);
            if (within.length > 1)
                h.repeat++;
            for (const o of within) {
                h.orders++;
                h.revenueCents += o.total_cents - (o.refunded_cents ?? 0);
                if (o.contributionCents == null)
                    h.contributionCents = null;
                else {
                    h.coveredOrders++;
                    if (h.contributionCents != null)
                        h.contributionCents += o.contributionCents;
                }
            }
        }
        g.repeatPct = Math.round(g.repeatCustomers / g.customers * 1000) / 10;
        g.averageLtvCents = Math.round(g.totalLtvCents / g.customers);
        groups.set(month, g);
    }
    return [...groups.values()].sort((a, b) => b.month.localeCompare(a.month));
}
