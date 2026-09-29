// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import OrderQuickView from '@/components/admin/OrderQuickView';
const {load}=vi.hoisted(()=>({load:vi.fn()}));
vi.mock('@/app/admin/(dashboard)/orders/preview-actions',()=>({loadOrderPreview:load}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('keeps a missing order unavailable and restores focus on Escape',async()=>{
 load.mockResolvedValue(null);const close=vi.fn();
 const trigger=document.createElement('button');document.body.append(trigger);trigger.focus();
 const {unmount}=render(<OrderQuickView orderId="missing" onClose={close}/>);
 await waitFor(()=>expect(screen.getByText(/order is unavailable/i)).toBeTruthy());
 fireEvent.keyDown(document,{key:'Escape'});expect(close).toHaveBeenCalled();
 unmount();expect(document.activeElement).toBe(trigger);trigger.remove();
});
it('shows the frozen ordered strength, not a renamed catalogue size',async()=>{
 load.mockResolvedValue({id:'order',order_number:'#10',customer_name:'A long customer name',status:'paid',total_cents:25000,paid_at:'2026-09-29T00:00:00Z',items:[{id:'item',product_name:'Research compound',variant_label:'3-pack · 10 mg/mL',size_label:'New catalogue label',qty:2,line_total_cents:25000}]});
 render(<OrderQuickView orderId="order" onClose={()=>{}}/>);
 await waitFor(()=>expect(screen.getByText('10 mg/mL')).toBeTruthy());
 expect(screen.queryByText('New catalogue label')).toBeNull();expect(screen.getByRole('link',{name:/full order/i}).getAttribute('href')).toBe('/admin/orders/order');
});
