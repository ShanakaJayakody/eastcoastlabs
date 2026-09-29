// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
vi.mock('@/app/admin/(dashboard)/orders/actions',()=>({confirmPayment:vi.fn(),advanceStatus:vi.fn(),correctTracking:vi.fn(),cancel:vi.fn(),addNote:vi.fn(),reinstate:vi.fn(),bulkConfirmPayment:vi.fn(),bulkReinstate:vi.fn()}));
import OrderActions from '@/components/admin/OrderActions';
import OrdersTable from '@/components/admin/OrdersTable';
import PackingMode from '@/components/admin/PackingMode';
import type {OrderListRow} from '@/lib/admin/order-queries';
afterEach(()=>{cleanup();sessionStorage.clear();});
it('requires nonblank tracking before enabling the shipment action',()=>{
 render(<OrderActions orderId="order" status="paid"/>);
 expect(screen.getByRole('button',{name:/Mark shipped/})).toBeDisabled();
 fireEvent.change(screen.getByPlaceholderText('Tracking number'),{target:{value:'   '}});
 expect(screen.getByRole('button',{name:/Mark shipped/})).toBeDisabled();
 fireEvent.change(screen.getByPlaceholderText('Tracking number'),{target:{value:'TRACK123'}});
 expect(screen.getByRole('button',{name:/Mark shipped/})).toBeEnabled();
});
it('routes bulk shipping to the carrier import that collects a tracking number for each order',()=>{
 render(<OrdersTable rows={[{id:'order',order_number:'ECL-TEST',status:'paid',created_at:'2026-09-29',total_cents:100,item_count:1} as OrderListRow]}/>);
 fireEvent.click(screen.getByLabelText('Select all orders'));
 expect(screen.queryByRole('button',{name:/Mark .*shipped/})).toBeNull();
 expect(screen.getByRole('link',{name:/Import tracking/}).getAttribute('href')).toBe('/admin/orders/fulfilment');
});
it('also requires tracking on the packing screen',()=>{
 render(<PackingMode order={{id:'order',orderNumber:'ECL-TEST',customerName:'Test',customerEmail:'test@example.test',address:null,totalCents:100,notes:null,items:[]}} nextId={null} position={1} total={1}/>);
 expect(screen.getByRole('button',{name:/Mark shipped/})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Tracking number'),{target:{value:'TRACK123'}});
 expect(screen.getByRole('button',{name:/Mark shipped/})).toBeEnabled();
});
