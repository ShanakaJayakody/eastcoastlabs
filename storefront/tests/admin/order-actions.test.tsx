// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,within,waitFor,cleanup} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
const {commitRefund,previewRefund,bulkConfirmPayment}=vi.hoisted(()=>({commitRefund:vi.fn(async()=>({ok:true,refundedCents:100})),previewRefund:vi.fn(async()=>({ok:true,quote:{token:'review',lines:[],itemCents:100,discountCents:0,shippingCents:0,totalCents:100,remainingCents:0,fullyRefunded:true}})),bulkConfirmPayment:vi.fn(async()=>({ok:true,moved:3,failed:[{id:'2',error:'Stock short'},{id:'4',error:'Changed status'}]}))}));
vi.mock('@/app/admin/(dashboard)/orders/actions',()=>({bulkConfirmPayment,confirmPayment:vi.fn(),advanceStatus:vi.fn(),cancel:vi.fn(),addNote:vi.fn(),reinstate:vi.fn(),correctTracking:vi.fn(),bulkAdvanceStatus:vi.fn(),bulkReinstate:vi.fn()}));
vi.mock('@/app/admin/(dashboard)/orders/refund-actions',()=>({commitRefund,previewRefund,recordRefundSettlement:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();sessionStorage.clear();});
import OrderActions from '@/components/admin/OrderActions';
import OrdersTable from '@/components/admin/OrdersTable';
import type {OrderListRow} from '@/lib/admin/order-queries';
it('pending orders have no invalid refund action',()=>{
 render(<OrderActions orderId="test" status="pending"/>);
 expect(screen.queryByRole('button',{name:/refund/i})).toBeNull();
});
it('records a full refund only after explicit confirmation',async()=>{
 render(<OrderActions orderId="test" status="paid"/>);
 fireEvent.click(screen.getByRole('button',{name:/refund/i}));
 expect(commitRefund).not.toHaveBeenCalled();
 const dialog=screen.getByRole('dialog');
 expect(within(dialog).getByText(/bank separately/i)).toBeTruthy();
 fireEvent.click(within(dialog).getByRole('button',{name:'Preview refund'}));
 await within(dialog).findByText('Refund to record: $1.00');
 // The quote can render before React finishes the preview transition.
 // Wait for the ready control, not just the quote, before confirming.
 const confirm=await within(dialog).findByRole('button',{name:'Record refund'});
 expect(commitRefund).not.toHaveBeenCalled();
 fireEvent.click(confirm);
 await waitFor(()=>expect(commitRefund).toHaveBeenCalled());
});
it('a mixed five-order bulk result retains exact failures and their selections',async()=>{
 const rows=Array.from({length:5},(_,i)=>({id:String(i+1),order_number:`ORDER-${i+1}`,status:'pending',created_at:'2026-09-08',total_cents:100,item_count:1})) as OrderListRow[];
 render(<OrdersTable rows={rows}/>);
 fireEvent.click(screen.getByLabelText('Select all orders'));
 fireEvent.click(screen.getByRole('button',{name:/paid/i}));
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Mark paid'}));
 await screen.findByText(/Stock short/);
 expect(screen.getByText(/Changed status/)).toBeTruthy();
 const checked=screen.getAllByRole('checkbox').filter(e=>(e as HTMLInputElement).checked);
 expect(checked).toHaveLength(2);
});
it('a cancelled order with recorded refunds cannot be reinstated even with available stock',()=>{
 render(<OrderActions orderId="test" status="cancelled" hasRefunds stockCheck={[]}/>);
 expect((screen.getByRole('button',{name:'Reinstate & mark paid'}) as HTMLButtonElement).disabled).toBe(true);
 expect(screen.getByRole('alert').textContent).toMatch(/recorded refunds/);
});
