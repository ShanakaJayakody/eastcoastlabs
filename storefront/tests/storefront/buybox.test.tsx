// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
const m=vi.hoisted(()=>({add:vi.fn(),selectPack:vi.fn(),lines:[] as unknown[],subtotal:0,giftThreshold:100,stock:null as number|null}));
afterEach(()=>{cleanup();m.selectPack.mockClear();m.lines=[];m.subtotal=0;m.giftThreshold=100;m.stock=null;});
vi.mock('@/lib/cart-context',()=>({useCart:()=>({addLine:m.add,stockFor:()=>m.stock,lines:m.lines,subtotal:m.subtotal,giftThreshold:m.giftThreshold})}));
vi.mock('@/lib/ui-context',()=>({useUI:()=>({openCart:vi.fn()})}));
vi.mock('@/lib/analytics',async(importOriginal)=>({...await importOriginal<typeof import('@/lib/analytics')>(),trackAddToCart:vi.fn(),trackSelectPack:m.selectPack}));
import BuyBox from '@/components/BuyBox';
const product={id:1,name:'Product',slug:'product',sku:'P'};
const tiers=[{id:'single' as const,label:'1 vial',vials:1,total:20,perVial:20},{id:'pack3' as const,label:'3-pack',vials:3,total:50,perVial:16.67,preselected:true}];
it('offers one-time purchases only',()=>{render(<BuyBox product={product} tiers={tiers} singlePriceMinor='2000' minorUnit={2} available={3}/>);expect(screen.queryByText(/Subscribe & save/)).toBeNull();});
it('chooses a feasible pack and bounds adds against cart vials',()=>{m.lines=[{key:'old',slug:'product',variantLabel:'1 vial',quantity:1}];render(<BuyBox product={product} tiers={tiers} singlePriceMinor='2000' minorUnit={2} available={2}/>);expect(screen.getByRole('radio',{name:/3-pack/})).toBeDisabled();expect(screen.getByRole('radio',{name:/1 vial/})).toBeChecked();expect(screen.getByRole('button',{name:'Increase quantity'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:/Add to Cart ·/}));expect(m.add).toHaveBeenCalledWith(expect.objectContaining({variantLabel:'1 vial',unitPrice:20}),1,1);});
it('shows the selected pack total beside the action and uses a factual pack badge',()=>{
 render(<BuyBox product={product} tiers={[tiers[0],{...tiers[1],badge:'MOST POPULAR'}]} singlePriceMinor='2000' minorUnit={2} available={6}/>);
 expect(screen.getByText('Selected total')).toBeInTheDocument();
 expect(screen.getAllByText('$50.00').length).toBeGreaterThan(0);
 expect(screen.queryByText(/most popular/i)).toBeNull();
 expect(screen.getByText(/3 vials/i)).toBeInTheDocument();
});
it('uses the catalogue slug as the analytics item identity',async()=>{
 render(<BuyBox product={product} tiers={tiers} singlePriceMinor='2000' minorUnit={2} available={6}/>);
 fireEvent.click(screen.getByRole('button',{name:/Add to Cart ·/}));
 const analytics=vi.mocked((await import('@/lib/analytics')).trackAddToCart);
 expect(analytics).toHaveBeenCalledWith(expect.objectContaining({item_id:'product',item_variant:'3-pack'}),50);
});
it('measures an intentional pack change with canonical catalogue identity',()=>{
 render(<BuyBox product={product} tiers={tiers} singlePriceMinor='2000' minorUnit={2} available={6}/>);
 fireEvent.click(screen.getByRole('radio',{name:/1 vial/}));
 expect(m.selectPack).toHaveBeenCalledWith(expect.objectContaining({item_id:'product',item_name:'Product',item_variant:'1 vial',price:20}));
});
it('explains an included gift before the paid water option',()=>{
 m.subtotal=60;m.giftThreshold=100;m.stock=3;
 render(<BuyBox product={product} tiers={tiers} singlePriceMinor='2000' minorUnit={2} available={6} bacWater={{id:9,name:'Bacteriostatic Water',price:12}}/>);
 expect(screen.getByText(/selected pack qualifies for an included bacteriostatic water vial/i)).toBeInTheDocument();
 expect(screen.queryByRole('checkbox')).toBeNull();
});
it('labels water as an optional extra when the basket already includes it',()=>{
 m.lines=[{key:'kit',slug:'reconstitution-kit',components:['bacteriostatic-water'],variantLabel:'Kit',quantity:1}];m.subtotal=60;m.stock=3;
 render(<BuyBox product={product} tiers={tiers} singlePriceMinor='2000' minorUnit={2} available={6} bacWater={{id:9,name:'Bacteriostatic Water',price:12}}/>);
 expect(screen.getByText(/basket already includes bacteriostatic water/i)).toBeInTheDocument();
 expect(screen.getByText(/Add an extra Bacteriostatic Water/i)).toBeInTheDocument();
 expect(screen.getByRole('checkbox')).not.toBeChecked();
});
