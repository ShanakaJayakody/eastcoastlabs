// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';

const {getOrder}=vi.hoisted(()=>({getOrder:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
vi.mock('@/lib/admin/auth',()=>({requireAdmin:vi.fn()}));
vi.mock('@/lib/admin/order-queries',()=>({getOrder}));
vi.mock('@/lib/admin/costs',()=>({profitForOrders:async()=>({})}));
vi.mock('@/lib/admin/reports',()=>({variableCosts:async()=>new Map()}));
vi.mock('@/lib/admin/refunds',()=>({getRefundSettlements:async()=>[]}));
vi.mock('@/lib/admin/fulfilment',()=>({
 getOrderFulfilment:async()=>({orderId:'order',editable:true,status:'paid',lines:[]}),
 getLotCatalog:async()=>({pools:[],lots:[],receipts:[],certificates:[]}),
}));
vi.mock('@/components/admin/AuditTrail',()=>({default:()=>null}));
vi.mock('@/app/admin/(dashboard)/orders/actions',()=>({advanceStatus:vi.fn(),editItemQty:vi.fn(),removeItem:vi.fn()}));
import OrderDetailPage from '@/app/admin/(dashboard)/orders/[id]/page';

afterEach(()=>{cleanup();vi.clearAllMocks();});

it.each([
 ['express','EXPRESS SHIPPING'],
 ['standard','STANDARD SHIPPING'],
 [undefined,'STANDARD SHIPPING'],
])('shows %s shipping throughout the order detail route reached from Orders',async(method,label)=>{
 getOrder.mockResolvedValue({
  id:'order',order_number:'ECL-1',status:'paid',created_at:'2026-09-30',
  customer_email:'buyer@example.test',customer_name:'Synthetic Buyer',
  shipping_address:{line1:'1 Test Street',shipping_method:method},
  subtotal_cents:40500,total_cents:40500,discount_cents:0,shipping_cents:0,refunded_cents:0,
  paid_at:null,events:[],items:[{
   id:'item',product_name:'Retatrutide',variant_label:'3-pack',size_label:'20 mg',
   qty:1,unit_price_cents:40500,line_total_cents:40500,refunded_qty:0,refunded_cents:0,
  }],
 });
 render(await OrderDetailPage({params:Promise.resolve({id:'order'})}));
 expect(screen.getByRole('region',{name:'Shipping method'})).toHaveTextContent(label);
 expect(screen.getByRole('heading',{name:'Actions'}).parentElement).toHaveTextContent(label);
 expect(screen.getByRole('heading',{name:'Shipping'}).parentElement).toHaveTextContent(label);
 expect(screen.getByRole('row')).toHaveTextContent('Retatrutide20 mg');
});
