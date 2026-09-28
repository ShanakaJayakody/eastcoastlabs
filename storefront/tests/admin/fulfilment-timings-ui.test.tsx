// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import OrderTimings from '@/components/admin/fulfilment/OrderTimings';
import {parseFulfilmentParams} from '@/lib/admin/fulfilment-analytics/params';
import type {TimingPage} from '@/lib/admin/fulfilment-analytics/types';
afterEach(cleanup);
const page:TimingPage={as_of:'2026-09-27T04:00:00Z',total:1,rows:[{id:'one',order_number:'ECL-101',customer_name:'Customer',status:'paid',created_at:'2026-09-24T04:00:00Z',paid_at:'2026-09-25T04:00:00Z',shipped_at:null,payment_seconds:86400,fulfilment_seconds:null,total_seconds:null,payment_wait_seconds:null,fulfilment_wait_seconds:172800,total_wait_seconds:259200,quality_issue:false}]};
it('distinguishes a running wait from a completed interval and reveals milestone timestamps',()=>{
 render(<OrderTimings page={page} params={parseFulfilmentParams({})}/>);
 expect(screen.getAllByText(/so far/).length).toBeGreaterThan(0);
 fireEvent.click(screen.getByRole('button',{name:'Timeline for ECL-101'}));
 expect(screen.getByText('Awaiting fulfilment')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Open order ECL-101'})).toHaveAttribute('href','/admin/orders/one');
});
it('presents missing data without turning it into a zero-day performance result',()=>{
 render(<OrderTimings page={{...page,rows:[{...page.rows[0],paid_at:null,payment_seconds:null,fulfilment_wait_seconds:null,quality_issue:true}]}} params={parseFulfilmentParams({})}/>);
 expect(screen.getAllByText('—').length).toBeGreaterThan(0);expect(screen.getByText('Check timestamps')).toBeInTheDocument();
});
