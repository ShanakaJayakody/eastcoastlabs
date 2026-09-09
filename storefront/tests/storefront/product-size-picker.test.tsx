// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import ProductPurchase from '@/components/ProductPurchase';
const m=vi.hoisted(()=>({add:vi.fn(),lines:[] as unknown[]}));
vi.mock('@/lib/cart-context',()=>({useCart:()=>({addLine:m.add,stockFor:()=>null,lines:m.lines})}));
vi.mock('@/lib/ui-context',()=>({useUI:()=>({openCart:vi.fn()})}));
vi.mock('@/lib/analytics',()=>({trackAddToCart:vi.fn()}));
afterEach(()=>{cleanup();m.add.mockClear();m.lines=[];});
const product={id:1,name:'Sample',slug:'sample',sku:'SAMPLE'};
const sizes=[{id:1,slug:'sample',label:'10 mg',priceMinor:'1000',available:4,tiers:[{id:'single' as const,label:'1 vial',vials:1,total:10,perVial:10}]},
 {id:2,slug:'sample-size-20',label:'20 mg',priceMinor:'1800',available:6,tiers:[{id:'single' as const,label:'1 vial',vials:1,total:18,perVial:18},{id:'pack3' as const,label:'3-pack',vials:3,total:48,perVial:16,preselected:true}]}];
it('switches prices and pack offers and adds different sizes as separate cart lines',()=>{
 render(<ProductPurchase product={product} sizes={sizes} minorUnit={2}/>);
 fireEvent.click(screen.getByRole('button',{name:/Add to Cart ·/}));
 expect(m.add).toHaveBeenLastCalledWith(expect.objectContaining({slug:'sample',variantLabel:'1 vial · 10 mg',unitPrice:10}),1,1);
 fireEvent.click(screen.getByRole('radio',{name:'20 mg'}));
 expect(screen.getByTestId('size-price')).toHaveTextContent('$18.00');
 fireEvent.click(screen.getByRole('button',{name:/Add to Cart ·/}));
 expect(m.add).toHaveBeenLastCalledWith(expect.objectContaining({slug:'sample-size-20',variantLabel:'3-pack · 20 mg',unitPrice:48}),1,3);
 expect(m.add.mock.calls[0][0].key).not.toBe(m.add.mock.calls[1][0].key);
});
it('keeps a sold-out size visible with its price and prevents adding it',()=>{
 render(<ProductPurchase product={product} sizes={[{...sizes[0],available:0},sizes[1]]} minorUnit={2}/>);
 expect(screen.getByRole('radio',{name:'20 mg'})).toBeChecked();
 fireEvent.click(screen.getByRole('radio',{name:/10 mg/}));
 expect(screen.getByTestId('size-price')).toHaveTextContent('$10.00');
 expect(screen.getByText(/This size is out of stock/)).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:/Add to Cart ·/})).toBeNull();
});
it('keeps child SKUs separate even if their legacy numeric display IDs collide',()=>{
 const children=[{...sizes[0],id:99,slug:'child-a'},{...sizes[1],id:99,slug:'child-b',tiers:sizes[1].tiers.slice(0,1)}];
 render(<ProductPurchase product={product} sizes={children} minorUnit={2}/>);
 fireEvent.click(screen.getByRole('button',{name:/Add to Cart ·/}));
 fireEvent.click(screen.getByRole('radio',{name:'20 mg'}));
 fireEvent.click(screen.getByRole('button',{name:/Add to Cart ·/}));
 expect(m.add.mock.calls[0][0].key).not.toBe(m.add.mock.calls[1][0].key);
});
