// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {aggregatePaidRevenue} from '@/lib/admin/overview/revenue';
import RevenueOverview from '@/components/admin/overview/RevenueOverview';
import OpenWork from '@/components/admin/overview/OpenWork';
const {load}=vi.hoisted(()=>({load:vi.fn()}));
vi.mock('@/app/admin/(dashboard)/overview-actions',()=>({loadOverviewRevenue:load}));
const initial=aggregatePaidRevenue([{id:'1',paid_at:'2026-09-28T00:00:00Z',total_cents:12300}],{kind:'week'},new Date('2026-09-29T02:00:00Z'));
afterEach(()=>{cleanup();vi.clearAllMocks();window.history.replaceState({},'','/admin');});
it('shows paid totals and accessible figures and retains data on failure',async()=>{
 render(<RevenueOverview initial={initial}/>);
 expect(screen.getByTestId('revenue-total').textContent).toContain('123.00');
 fireEvent.click(screen.getByText('View figures'));expect(screen.getByRole('table')).toBeTruthy();
 load.mockRejectedValue(Error('Read failed'));fireEvent.change(screen.getByLabelText('Revenue period'),{target:{value:'today'}});
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Could not'));
 expect(screen.getByTestId('revenue-total').textContent).toContain('123.00');
});
it('discards older responses and uses the most recent selection',async()=>{
 let first!:(value:typeof initial)=>void,second!:(value:typeof initial)=>void;
 load.mockImplementationOnce(()=>new Promise(resolve=>first=resolve)).mockImplementationOnce(()=>new Promise(resolve=>second=resolve));
 render(<RevenueOverview initial={initial}/>);
 fireEvent.change(screen.getByLabelText('Revenue period'),{target:{value:'today'}});
 fireEvent.change(screen.getByLabelText('Revenue period'),{target:{value:'month'}});
 await act(async()=>second({...initial,range:{kind:'month'},totalCents:45600}));
 await act(async()=>first({...initial,range:{kind:'today'},totalCents:99900}));
 expect(screen.getByTestId('revenue-total').textContent).toContain('456.00');
});
it('opens live queues independently of the revenue period',()=>{
 render(<OpenWork counts={{toFulfil:8,pendingPayment:3,lowStock:2}}/>);
 expect(screen.getByRole('link',{name:/orders to fulfil/i}).getAttribute('href')).toBe('/admin/orders?status=to_fulfil');
 expect(screen.getByRole('link',{name:/awaiting payment/i}).getAttribute('href')).toBe('/admin/orders?status=pending');
 expect(screen.getByRole('link',{name:/low stock/i}).getAttribute('href')).toBe('/admin/products?low=1');
});
