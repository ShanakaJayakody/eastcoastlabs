// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const m=vi.hoisted(()=>({save:vi.fn(),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:m.refresh})}));
vi.mock('@/app/admin/(dashboard)/orders/cost-actions',()=>({saveOrderCosts:m.save}));
import OrderCosts from '@/components/admin/OrderCosts';
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();m.save.mockResolvedValue({ok:true,revision:1});});
it('leaves unknown costs blank and sends explicit zero separately with tax unconfirmed by default',async()=>{
 render(<OrderCosts orderId="order" initial={null}/>);fireEvent.click(screen.getByText('Actual variable order costs'));
 fireEvent.change(screen.getByLabelText('Carrier charges (AUD)'),{target:{value:'0'}});
 fireEvent.click(screen.getByRole('button',{name:'Save actual costs'}));
 await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Costs saved.'));
 expect(m.save).toHaveBeenCalledWith('order',{carrier_cents:0,packaging_fulfilment_cents:null,payment_cents:null,replacement_cents:null,service_cents:null,acquisition_cents:null,tax_adjustment_cents:null,tax_basis_confirmed:false,note:''},0);
});
it('rejects fractional cents in visible currency input without saving',async()=>{
 render(<OrderCosts orderId="order" initial={null}/>);fireEvent.click(screen.getByText('Actual variable order costs'));
 fireEvent.change(screen.getByLabelText('Payment fees (AUD)'),{target:{value:'1.005'}});fireEvent.click(screen.getByRole('button',{name:'Save actual costs'}));
 expect(screen.getByRole('status')).toHaveTextContent('at most two decimal places');expect(m.save).not.toHaveBeenCalled();
});
it('keeps stale-edit errors visible and preserves unsaved inputs',async()=>{
 m.save.mockResolvedValue({ok:false,error:'Costs changed; reload before saving'});
 render(<OrderCosts orderId="order" initial={null}/>);fireEvent.click(screen.getByText('Actual variable order costs'));
 fireEvent.change(screen.getByLabelText('Carrier charges (AUD)'),{target:{value:'7.25'}});fireEvent.click(screen.getByRole('button',{name:'Save actual costs'}));
 await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Costs changed'));
 expect(screen.getByLabelText('Carrier charges (AUD)')).toHaveValue('7.25');expect(m.refresh).not.toHaveBeenCalled();
});

it('exposes a separate signed tax adjustment and persists a reconciled credit in cents',async()=>{
 render(<OrderCosts orderId="order" initial={null}/>);fireEvent.click(screen.getByText('Actual variable order costs'));
 fireEvent.change(screen.getByLabelText('Reconciled tax adjustment (AUD)'),{target:{value:'-5.00'}});
 fireEvent.click(screen.getByRole('button',{name:'Save actual costs'}));
 await waitFor(()=>expect(m.save).toHaveBeenCalledWith('order',expect.objectContaining({tax_adjustment_cents:-500}),0));
});
