// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
afterEach(cleanup);
import ConfirmModal from '@/components/admin/ConfirmModal';
import PackingSlip from '@/components/admin/PackingSlip';
import type { OrderDetail } from '@/lib/admin/order-queries';

describe('admin confirmations and fulfilment', () => {
  it('starts on cancel and contains keyboard focus', () => {
    render(<ConfirmModal open title="Record refund" confirmLabel="Record" tone="danger" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const cancel = screen.getByRole('button', {name:'Cancel'});
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, {key:'Tab', shiftKey:true});
    expect(document.activeElement).toBe(screen.getByRole('button', {name:'Record'}));
  });
  it('prints remaining quantities and excludes fully refunded lines', () => {
    const order = {order_number:'TEST', created_at:'2026-09-08', status:'paid', shipping_address:{}, subtotal_cents:600, total_cents:600, discount_cents:0, shipping_cents:0, items:[
      {id:'1',product_name:'Partly returned',qty:3,refunded_qty:1,line_total_cents:300},
      {id:'2',product_name:'Fully returned',qty:3,refunded_qty:3,line_total_cents:300},
    ]} as unknown as OrderDetail;
    render(<PackingSlip order={order} coas={{}} />);
    expect(screen.queryByText('Fully returned')).toBeNull();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByText('Batch / COA')).toBeNull();
  });
});

it('focuses the safe cancel action even when the body contains a stock checkbox',()=>{
 const {unmount}=render(<ConfirmModal open title="Restock" body={<input type="checkbox" aria-label="Restock"/>} confirmLabel="Record" onConfirm={vi.fn()} onCancel={vi.fn()}/>);
 expect(document.activeElement?.textContent).toBe('Cancel');
 unmount();
});
