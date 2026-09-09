// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProductSizesEditor from '@/components/admin/ProductSizesEditor';
import type { ProductListRow } from '@/lib/admin/products';
const m=vi.hoisted(()=>({add:vi.fn(async()=>({ok:true})),save:vi.fn(async()=>({ok:true,version:2})),cost:vi.fn(async()=>({ok:true})),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:m.refresh})}));
vi.mock('@/app/admin/(dashboard)/products/actions',()=>({addProductSize:m.add,saveProductSize:m.save,saveUnitCost:m.cost,fetchMovements:vi.fn(),adjustStock:vi.fn(),reverseReceipt:vi.fn()}));
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn()}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const product:ProductListRow={id:'parent',slug:'sample',name:'Sample',sku:'SAMPLE',status:'active',edit_version:1,unit_cost_cents:null,image:null,totalOnHand:9,lowStock:false,minPriceCents:1000,
  variants:[{id:'single',sku:'SAMPLE-1',pack_size:1,label:'1 vial',price_cents:1000,compare_at_cents:null,low_stock_threshold:5,on_hand:9,reserved:0,available:9,active:true}]};
it('adds a labelled size with editable pack suggestions and opening stock',async()=>{
 render(<ProductSizesEditor product={product} sizes={[product]}/>);
 fireEvent.click(screen.getByRole('button',{name:'Add size'}));
 fireEvent.change(screen.getByLabelText('Current size'),{target:{value:'10 mg'}});
 fireEvent.change(screen.getByLabelText('New size'),{target:{value:'20 mg'}});
 fireEvent.change(screen.getByLabelText('New size single vial price'),{target:{value:'50'}});
 expect(screen.getByLabelText('New size 3-pack price')).toHaveValue(135);
 expect(screen.getByLabelText('New size 6-pack price')).toHaveValue(240);
 fireEvent.change(screen.getByLabelText('New size 3-pack price'),{target:{value:'130'}});
 fireEvent.change(screen.getByLabelText('New size opening stock'),{target:{value:'8'}});
 fireEvent.click(screen.getByRole('button',{name:'Add size & save'}));
 await waitFor(()=>expect(m.add).toHaveBeenCalledWith('sample',{currentLabel:'10 mg',label:'20 mg',singlePriceAud:50,pack3PriceAud:130,pack6PriceAud:240,initialStock:8}));
 await waitFor(()=>expect(screen.queryByLabelText('New size')).toBeNull());
});
it('can add only a single vial and keeps another product draft protected',async()=>{
 const view=render(<ProductSizesEditor product={{...product,size_label:'10 mg'}} sizes={[product]}/>);
 fireEvent.click(screen.getByRole('button',{name:'Add size'}));
 fireEvent.change(screen.getByLabelText('New size'),{target:{value:'30 mg'}});
 fireEvent.change(screen.getByLabelText('New size single vial price'),{target:{value:'70'}});
 fireEvent.click(screen.getByLabelText('Include 3-vial and 6-vial packs'));
 expect(screen.queryByLabelText('New size 3-pack price')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Add size & save'}));
 await waitFor(()=>expect(m.add).toHaveBeenCalledWith('sample',expect.not.objectContaining({pack3PriceAud:expect.anything()})));
 view.rerender(<ProductSizesEditor product={product} sizes={[product]} disabled/>);
 expect(screen.getByRole('button',{name:'Add size'})).toBeDisabled();
});
it('saves a price draft with its original revision after stock refresh',async()=>{
 const size={...product,size_label:'10 mg'};
 const view=render(<ProductSizesEditor product={size} sizes={[size]}/>);
 fireEvent.change(screen.getByLabelText('10 mg Single vial'),{target:{value:'12'}});
 view.rerender(<ProductSizesEditor product={{...size,edit_version:8}} sizes={[{...size,edit_version:8,totalOnHand:15}]}/>);
 expect(screen.getByLabelText('10 mg Single vial')).toHaveValue(12);
 fireEvent.click(screen.getByRole('button',{name:'Save size'}));
 await waitFor(()=>expect(m.save).toHaveBeenCalledWith('sample',expect.objectContaining({version:1,variants:[{id:'single',priceAud:12,threshold:5}]})));
});
it('sets a child size cost without requiring another stock receipt',async()=>{
 const parent={...product,size_label:'10 mg'};
 const child={...parent,id:'child',slug:'sample-size-20',size_label:'20 mg'};
 render(<ProductSizesEditor product={parent} sizes={[child]}/>);
 fireEvent.change(screen.getByLabelText('20 mg cost per vial'),{target:{value:'8.50'}});
 fireEvent.click(screen.getByRole('button',{name:'Set cost'}));
 await waitFor(()=>expect(m.cost).toHaveBeenCalledWith('sample-size-20',8.5));
});
