// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
vi.mock('@/app/admin/(dashboard)/orders/actions',()=>({advanceStatus:vi.fn()}));
import PackingMode, {type PackOrder} from '@/components/admin/PackingMode';

afterEach(cleanup);
const order:PackOrder={id:'order',orderNumber:'ECL-1',customerName:'Synthetic Buyer',customerEmail:'buyer@example.test',address:null,totalCents:3200,notes:null,
 items:[{id:'item',productName:'Sample',variantLabel:'1 vial',sku:'SAMPLE',qty:2,refundedQty:1,lineTotalCents:2000}]};
function packing(address:PackOrder['address']){
 return render(<PackingMode order={{...order,address}} nextId={null} position={1} total={1}/>);
}
it('prints the native checkout suburb before state and postcode even when a legacy city is present',()=>{
 const {container}=packing({line1:'1 Test Street',suburb:'Melbourne',city:'Old City',state:'VIC',postcode:'3000',country:'AU'});
 expect(container.querySelector('address')).toHaveTextContent('Melbourne VIC 3000');
 expect(container.querySelector('address')).not.toHaveTextContent('Old City');
});
it.each([undefined,'   '])('preserves a legacy city when suburb is unavailable (%s)',suburb=>{
 const {container}=packing({line1:'1 Test Street',...(suburb===undefined?{}:{suburb}),city:'Geelong',state:'VIC',postcode:'3220'});
 expect(container.querySelector('address')).toHaveTextContent('Geelong VIC 3220');
});
it('labels the original line amount when packing only the remaining unrefunded unit',()=>{
 packing({suburb:'Melbourne',state:'VIC',postcode:'3000'});
 expect(screen.getByRole('button',{name:/Sample/})).toHaveTextContent('Original $20.00');
});
