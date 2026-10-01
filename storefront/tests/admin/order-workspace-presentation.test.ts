import {it,expect} from 'vitest';
import {makeWorkspaceRow} from '@/tests/helpers/order-workspace-fixtures';
import {paymentLabel,fulfilmentLabel,waitingLabel,physicalQuantityLabel,defaultOrderColumns} from '@/lib/admin/order-workspace/presentation';
it('does not confuse completion with delivery or a recorded refund with a transfer',()=>{
 expect(fulfilmentLabel(makeWorkspaceRow({status:'completed'})).label).toBe('Completed (internal)');
 expect(fulfilmentLabel(makeWorkspaceRow({status:'refunded',shipped_at:'2026-09-30T10:00:00Z'})).label).toBe('Marked shipped');
 const label=paymentLabel(makeWorkspaceRow({status:'refunded',refunded_cents:14000,refund_settled_cents:0}));
 expect(label.label).toBe('Refund recorded'); expect(label.detail).toContain('outstanding');
});
it('shows the right running clock and never a fabricated zero',()=>{
 expect(waitingLabel(makeWorkspaceRow({waiting_seconds:90000}))).toBe('1d 1h since payment');
 expect(waitingLabel(makeWorkspaceRow({status:'pending',waiting_seconds:3600}))).toBe('1h since order placed');
 expect(waitingLabel(makeWorkspaceRow({waiting_seconds:null}))).toBe('Payment time unavailable');
 expect(waitingLabel(makeWorkspaceRow({status:'shipped',waiting_seconds:null}))).toBe('—');
});
it('distinguishes physical units from lines and refunds',()=>{
 expect(physicalQuantityLabel(makeWorkspaceRow({line_count:2,remaining_physical_units:4,ordered_physical_units:7}))).toBe('4 physical units');
 expect(physicalQuantityLabel(makeWorkspaceRow({remaining_physical_units:null}))).toBe('Physical quantity unavailable');
 expect(defaultOrderColumns('pending')).toContain('payment');
});
