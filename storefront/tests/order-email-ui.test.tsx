// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen,fireEvent,within} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
vi.mock('@/app/admin/(dashboard)/orders/actions',()=>({confirmPayment:vi.fn(),advanceStatus:vi.fn(),correctTracking:vi.fn(),cancel:vi.fn(),addNote:vi.fn(),reinstate:vi.fn(),bulkConfirmPayment:vi.fn(),bulkReinstate:vi.fn()}));
import OrderActions from '@/components/admin/OrderActions';
import OrdersWorkspace from '@/components/admin/OrdersWorkspace';
import {makeWorkspaceRow,makeWorkspaceParams,makeWorkspacePage} from './helpers/order-workspace-fixtures';
import PackingMode from '@/components/admin/PackingMode';
afterEach(()=>{cleanup();sessionStorage.clear();});
it('requires nonblank tracking before enabling the shipment action',()=>{
 render(<OrderActions orderId="order" status="paid"/>);
 expect(screen.getByRole('button',{name:/Mark shipped/})).toBeDisabled();
 fireEvent.change(screen.getByPlaceholderText('Tracking number'),{target:{value:'   '}});
 expect(screen.getByRole('button',{name:/Mark shipped/})).toBeDisabled();
 fireEvent.change(screen.getByPlaceholderText('Tracking number'),{target:{value:'TRACK123'}});
 expect(screen.getByRole('button',{name:/Mark shipped/})).toBeEnabled();
});
it('offers selected packing and independent carrier tools without bulk shipping',()=>{
 const {container}=render(<OrdersWorkspace params={makeWorkspaceParams()} data={makeWorkspacePage([makeWorkspaceRow()])} adminUserId="synthetic"/>);
 fireEvent.click(within(container.querySelector('.ow-desktop-list')!).getByLabelText('Select all orders on this page'));
 expect(screen.queryByRole('button',{name:/Mark .*shipped/})).toBeNull();
 expect(screen.getByRole('link',{name:'Prepare packing (1)'}).getAttribute('href')).toContain('batch=');
 fireEvent.click(screen.getByText('Tools'));
 expect(screen.getByRole('link',{name:'Stock lots and carrier CSV'}).getAttribute('href')).toBe('/admin/orders/fulfilment');
});
it('also requires tracking on the packing screen',()=>{
 render(<PackingMode order={{id:'order',orderNumber:'ECL-TEST',customerName:'Test',customerEmail:'test@example.test',address:null,totalCents:100,notes:null,items:[]}} nextId={null} position={1} total={1}/>);
 expect(screen.getByRole('button',{name:/Mark shipped/})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Tracking number'),{target:{value:'TRACK123'}});
 expect(screen.getByRole('button',{name:/Mark shipped/})).toBeEnabled();
});
