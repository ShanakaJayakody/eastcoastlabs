// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,within,waitFor,cleanup} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
const {previewRefund,commitRefund,recordRefundSettlement}=vi.hoisted(()=>({previewRefund:vi.fn(),commitRefund:vi.fn(),recordRefundSettlement:vi.fn()}));
vi.mock('@/app/admin/(dashboard)/orders/refund-actions',()=>({previewRefund,commitRefund,recordRefundSettlement}));
vi.mock('@/app/admin/(dashboard)/orders/actions',()=>({editItemQty:vi.fn(),removeItem:vi.fn(),confirmPayment:vi.fn(),correctTracking:vi.fn(),advanceStatus:vi.fn(),cancel:vi.fn(),addNote:vi.fn(),reinstate:vi.fn()}));
import OrderActions from '@/components/admin/OrderActions';
import OrderItemsPanel from '@/components/admin/OrderItemsPanel';
import RefundSettlements from '@/components/admin/RefundSettlements';
const quote={token:'review-token',lines:[{itemId:'item',name:'Sample',label:'1 vial',qty:1,itemCents:1000,discountCents:100,totalCents:900}],itemCents:1000,discountCents:100,shippingCents:500,totalCents:1400,remainingCents:0,fullyRefunded:true};
afterEach(()=>{cleanup();vi.resetAllMocks()});
it('requires exact full refund review, binds stock choice, and forces renewed review after stale state',async()=>{
 previewRefund.mockResolvedValue({ok:true,quote});commitRefund.mockResolvedValueOnce({ok:false,error:'Review the updated refund',stale:true}).mockResolvedValue({ok:true,refundedCents:1400});
 render(<OrderActions orderId="order" status="paid"/>);fireEvent.click(screen.getByRole('button',{name:'Record refund'}));
 const dialog=screen.getByRole('dialog');expect(within(dialog).queryByRole('button',{name:'Record refund'})).toBeNull();
 fireEvent.click(within(dialog).getByRole('button',{name:'Preview refund'}));
 await within(dialog).findByText('Refund to record: $14.00');expect(within(dialog).getByText('Discount: −$1.00')).toBeTruthy();expect(within(dialog).getByText('Shipping: $5.00')).toBeTruthy();
 fireEvent.click(within(dialog).getByRole('checkbox'));expect(within(dialog).queryByText('Refund to record: $14.00')).toBeNull();
 fireEvent.click(within(dialog).getByRole('button',{name:'Preview refund'}));await within(dialog).findByText('Refund to record: $14.00');
 const fullRecordButton=await within(dialog).findByRole('button',{name:'Record refund'});await waitFor(()=>expect((fullRecordButton as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(fullRecordButton);await within(dialog).findByRole('alert');
 expect(commitRefund).toHaveBeenCalledWith('order',null,true,'review-token',expect.any(String));
 expect(within(dialog).queryByRole('button',{name:'Record refund'})).toBeNull();
});
it('previews selected line quantities and retains the same commit key after uncertain failure',async()=>{
 previewRefund.mockResolvedValue({ok:true,quote:{...quote,shippingCents:0,totalCents:900,remainingCents:2300,fullyRefunded:false}});
 commitRefund.mockResolvedValueOnce({ok:false,error:'Connection failed'}).mockResolvedValue({ok:true,refundedCents:900});
 render(<OrderItemsPanel orderId="order" status="paid" items={[{id:'item',product_name:'Sample',variant_label:'1 vial',sku:'S',qty:3,unit_price_cents:1000,line_total_cents:3000,refunded_qty:0,refunded_cents:0}]} subtotalCents={3000} discountCents={300} discountCode="WELCOME10" shippingCents={500} totalCents={3200}/>);
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1'}});fireEvent.click(screen.getByRole('button',{name:'Refund selected'}));
 fireEvent.click(screen.getByRole('button',{name:'Preview refund'}));await screen.findByText('Refund to record: $9.00');expect(screen.getByText('Remaining refundable: $23.00')).toBeTruthy();
 const recordButton=await screen.findByRole('button',{name:'Record refund'});await waitFor(()=>expect((recordButton as HTMLButtonElement).disabled).toBe(false));
 expect(previewRefund).toHaveBeenCalledWith('order',[{itemId:'item',qty:1}],false);
 fireEvent.click(recordButton);await screen.findByRole('alert');const key=commitRefund.mock.calls[0][4];
 const retryButton=await screen.findByRole('button',{name:'Record refund'});await waitFor(()=>expect((retryButton as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(retryButton);await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(commitRefund.mock.calls[1][4]).toBe(key);
});
it('records an already-made manual transfer with reference and date, and displays saved evidence',async()=>{
 recordRefundSettlement.mockResolvedValue({ok:true});
 render(<RefundSettlements orderId="order" refundedCents={1400} settlements={[{id:'prior',amount_cents:400,transfer_reference:'OLD',transfer_date:'2026-01-01',actor_email:'operator',created_at:'2026-01-01'}]}/>);
 expect(screen.getByText('Still to settle: $10.00')).toBeTruthy();expect(screen.getByText(/OLD/)).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Amount transferred (AUD)'),{target:{value:'10.00'}});fireEvent.change(screen.getByLabelText('Transfer reference'),{target:{value:'BANK-123'}});fireEvent.change(screen.getByLabelText('Transfer date'),{target:{value:'2026-01-02'}});
 fireEvent.click(screen.getByLabelText(/already made this transfer/));fireEvent.click(screen.getByRole('button',{name:'Record completed transfer'}));
 await waitFor(()=>expect(recordRefundSettlement).toHaveBeenCalledWith('order',1000,'BANK-123','2026-01-02',expect.any(String)));
 expect(screen.getByText(/does not send money/)).toBeTruthy();
});
