// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
afterEach(cleanup);
const m=vi.hoisted(()=>({add:vi.fn(),lines:[] as unknown[]}));
vi.mock('@/lib/cart-context',()=>({useCart:()=>({addLine:m.add,stockFor:()=>null,lines:m.lines})}));
vi.mock('@/lib/ui-context',()=>({useUI:()=>({openCart:vi.fn()})}));
vi.mock('@/lib/analytics',()=>({trackAddToCart:vi.fn()}));
import BuyBox from '@/components/BuyBox';
const product={id:1,name:'Product',slug:'product',sku:'P'};
const tiers=[{id:'single' as const,label:'1 vial',vials:1,total:20,perVial:20},{id:'pack3' as const,label:'3-pack',vials:3,total:50,perVial:16.67,preselected:true}];
it('offers one-time purchases only',()=>{render(<BuyBox product={product} tiers={tiers} singlePriceMinor='2000' minorUnit={2} available={3}/>);expect(screen.queryByText(/Subscribe & save/)).toBeNull();});
it('chooses a feasible pack and bounds adds against cart vials',()=>{m.lines=[{key:'old',slug:'product',variantLabel:'1 vial',quantity:1}];render(<BuyBox product={product} tiers={tiers} singlePriceMinor='2000' minorUnit={2} available={2}/>);expect(screen.getByRole('radio',{name:/3-pack/})).toBeDisabled();expect(screen.getByRole('radio',{name:/1 vial/})).toBeChecked();expect(screen.getByRole('button',{name:'Increase quantity'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:/Add to Cart ·/}));expect(m.add).toHaveBeenCalledWith(expect.objectContaining({variantLabel:'1 vial',unitPrice:20}),1);});
