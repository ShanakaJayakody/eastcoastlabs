// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
const {registerLot,saveLotAssignments,previewCarrier,commitCarrier}=vi.hoisted(()=>({registerLot:vi.fn(),saveLotAssignments:vi.fn(),previewCarrier:vi.fn(),commitCarrier:vi.fn()}));
vi.mock('@/app/admin/(dashboard)/orders/fulfilment-actions',()=>({registerLot,saveLotAssignments,previewCarrier,commitCarrier}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
import LotPacking from '@/components/admin/LotPacking';
import StockLotRegister from '@/components/admin/StockLotRegister';
import CarrierImport from '@/components/admin/CarrierImport';
const catalog={pools:[{id:'pool',name:'Sample',onHand:10}],lots:[{id:'lot',poolId:'pool',code:'LOT-A',units:10,availableUnits:8,receiptId:null,coaId:null}],receipts:[{id:'receipt',poolId:'pool',units:10,createdAt:'2026-01-01'}],certificates:[{id:'coa',batchId:'CERT-A',compound:'Sample'}]};
afterEach(()=>{cleanup();vi.resetAllMocks()});
it('registers counted existing stock with explicit receipt, certificate and physical evidence',async()=>{
 registerLot.mockResolvedValue({ok:true});render(<StockLotRegister catalog={catalog}/>);
 fireEvent.change(screen.getByLabelText('Physical stock pool'),{target:{value:'pool'}});
 fireEvent.change(screen.getByLabelText('Physical lot code'),{target:{value:'LOT-A'}});
 fireEvent.change(screen.getByLabelText('Physical units counted'),{target:{value:'10'}});
 fireEvent.change(screen.getByLabelText('Receipt evidence (optional)'),{target:{value:'receipt'}});
 fireEvent.change(screen.getByLabelText('Verified certificate (optional)'),{target:{value:'coa'}});
 fireEvent.change(screen.getByLabelText('Physical stock evidence'),{target:{value:'Supplier labels checked against ten vials'}});
 fireEvent.click(screen.getByLabelText(/counted these units/));fireEvent.click(screen.getByRole('button',{name:'Register existing stock lot'}));
 await waitFor(()=>expect(registerLot).toHaveBeenCalledWith({poolId:'pool',code:'LOT-A',units:10,receiptId:'receipt',coaId:'coa',evidence:'Supplier labels checked against ten vials'}));expect(screen.getByText(/does not add stock/)).toBeTruthy();
});
it('shows physical pack units and requires evidence when releasing an existing allocation',async()=>{
 saveLotAssignments.mockResolvedValue({ok:true});render(<LotPacking fulfilment={{orderId:'order',editable:true,status:'paid',lines:[{itemId:'item',productName:'Sample',variantLabel:'3 pack',poolId:'pool',poolName:'Sample',requiredUnits:3,allocatedUnits:2,unallocatedUnits:1,allocations:[{lotId:'lot',lotCode:'LOT-A',units:2,coa:null}]}]}} catalog={catalog}/>);
 expect(screen.getByText('1 unallocated physical units')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('LOT-A physical units'),{target:{value:'0'}});fireEvent.change(screen.getByLabelText('Physical pick or return evidence'),{target:{value:'Both vials returned to LOT-A shelf'}});
 fireEvent.click(screen.getByRole('button',{name:'Save physical assignments'}));
 await waitFor(()=>expect(saveLotAssignments).toHaveBeenCalledWith('order','item','pool',[],'Both vials returned to LOT-A shelf'));
});
it('previews CSV, selects valid rows only and reports stale per-row outcomes without resending successes',async()=>{
 previewCarrier.mockResolvedValue({ok:true,rows:[{token:'a',orderNumber:'A',trackingNumber:'TA',status:'paid',currentTracking:null,error:null},{token:null,orderNumber:'B',trackingNumber:'TB',status:'cancelled',currentTracking:null,error:'Order is not shippable'}]});
 commitCarrier.mockResolvedValue({ok:true,rows:[{token:'a',orderNumber:'A',ok:false,error:'CARRIER_PREVIEW_STALE'}]});render(<CarrierImport/>);
 fireEvent.change(screen.getByLabelText('Carrier CSV'),{target:{value:'order_number,tracking_number\nA,TA\nB,TB'}});fireEvent.click(screen.getByRole('button',{name:'Preview carrier rows'}));
 await screen.findByText('Order is not shippable');expect(screen.getByLabelText('Select B')).toBeDisabled();
 fireEvent.click(screen.getByLabelText('Select A'));fireEvent.click(screen.getByLabelText('Queue shipping notifications'));fireEvent.click(screen.getByRole('button',{name:'Commit selected rows'}));
 await screen.findByText('CARRIER_PREVIEW_STALE');expect(commitCarrier).toHaveBeenCalledWith(['a'],true);expect(screen.getByRole('button',{name:'Commit selected rows'})).toBeDisabled();
});
it('prints assigned physical lots and explicit unallocated units without inferring a certificate',async()=>{
 const {default:PackingSlip}=await import('@/components/admin/PackingSlip');
 const order={id:'order',order_number:'ECL-1',status:'paid',created_at:'2026-01-01',shipping_address:{},subtotal_cents:1000,discount_cents:0,shipping_cents:0,total_cents:1000,items:[{id:'item',product_name:'Sample',variant_label:'3 pack',qty:1,refunded_qty:0,line_total_cents:1000}]} as unknown as import('@/lib/admin/order-queries').OrderDetail;
 render(<PackingSlip order={order} fulfilment={{orderId:'order',editable:true,status:'paid',lines:[{itemId:'item',productName:'Sample',variantLabel:'3 pack',poolId:'pool',poolName:'Sample',requiredUnits:3,allocatedUnits:2,unallocatedUnits:1,allocations:[{lotId:'lot',lotCode:'PHYSICAL-A',units:2,coa:{batchId:'CERT-A',url:'https://example.test/a.pdf'}}]}]}}/>);
 expect(screen.getByText('PHYSICAL-A · 2 physical units')).toBeTruthy();expect(screen.getByText('1 unallocated physical units')).toBeTruthy();expect(screen.getByRole('link',{name:'Verified COA CERT-A'}).getAttribute('href')).toBe('https://example.test/a.pdf');expect(screen.queryByText('Latest published COA')).toBeNull();
});
