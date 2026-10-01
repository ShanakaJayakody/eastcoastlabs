// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,it,expect,vi} from 'vitest';
import {act,cleanup,render,screen,fireEvent} from '@testing-library/react';
import {makeOrderPreview} from '../helpers/order-workspace-fixtures';
const {confirm}=vi.hoisted(()=>({confirm:vi.fn()}));vi.mock('@/app/admin/(dashboard)/orders/actions',()=>({confirmPayment:confirm}));
import OrderQuickPayment from '@/components/admin/OrderQuickPayment';
afterEach(()=>{cleanup();confirm.mockReset();});
it('reviews effects, preserves reference on failure and prevents duplicate writes',async()=>{let resolve!:(v:unknown)=>void;confirm.mockImplementation(()=>new Promise(r=>resolve=r));const changed=vi.fn(),success=vi.fn();render(<OrderQuickPayment preview={makeOrderPreview({status:'pending'})} onStateChange={changed} onSuccess={success}/>);fireEvent.change(screen.getByLabelText('Payment reference'),{target:{value:' BANK-01 '}});fireEvent.click(screen.getByText('Review payment'));expect(screen.getByText(/Confirms payment, commits stock/)).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Confirm payment'}));fireEvent.click(screen.getByRole('button',{name:'Confirming…'}));expect(confirm).toHaveBeenCalledTimes(1);expect(confirm).toHaveBeenCalledWith(makeOrderPreview().facts.id,'BANK-01');await act(async()=>resolve({ok:false,error:'Stock unavailable'}));expect(screen.getByRole('alert')).toHaveTextContent('Stock unavailable');expect(screen.getByLabelText('Payment reference')).toHaveValue(' BANK-01 ');confirm.mockResolvedValue({ok:true});fireEvent.click(screen.getByRole('button',{name:'Confirm payment'}));await screen.findByText(/Customer receipt queued/);expect(success).toHaveBeenCalledOnce();});
