// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import ProductPurchase from '@/components/ProductPurchase';
import SizedProductExperience from '@/components/SizedProductExperience';
import SupplierReportLinks from '@/components/SupplierReportLinks';
import { labReports } from '@/lib/lab-reports';
import { setAnalyticsConsent } from '@/lib/attribution';
const m=vi.hoisted(()=>({add:vi.fn(),selectSize:vi.fn(),view:vi.fn(),lines:[] as unknown[]}));
vi.mock('@/lib/cart-context',()=>({useCart:()=>({addLine:m.add,stockFor:()=>null,lines:m.lines})}));
vi.mock('@/lib/ui-context',()=>({useUI:()=>({openCart:vi.fn()})}));
vi.mock('@/lib/analytics',async(importOriginal)=>({...await importOriginal<typeof import('@/lib/analytics')>(),trackAddToCart:vi.fn(),trackSelectSize:m.selectSize,trackViewItem:m.view}));
afterEach(()=>{cleanup();m.add.mockClear();m.selectSize.mockClear();m.view.mockClear();m.lines=[];document.cookie='ecl_analytics_consent=; Max-Age=0; Path=/';});
const product={id:1,name:'Sample',slug:'sample',sku:'SAMPLE'};
it('keeps historical sample evidence accessible without presenting it as selected-size certification',()=>{
 render(<SizedProductExperience product={product} sizes={sizes} minorUnit={2} coa={null} supplierEvidence={<SupplierReportLinks reports={labReports.filter(report=>report.productSlug==='ghk-cu')}/>}/>);
 expect(screen.getByRole('link',{name:/GHK.*View report/i})).toHaveAttribute('href','/lab-results#report-51162');
 fireEvent.click(screen.getByRole('radio',{name:'20 mg'}));
 expect(screen.getByRole('link',{name:/GHK.*View report/i})).toHaveAttribute('href','/lab-results#report-51162');
 expect(screen.getByText(/No verified certificate is currently published for the selected 20 mg supply/)).toBeInTheDocument();
});
const sizes=[{id:1,slug:'sample',sku:'SAMPLE-10',label:'10 mg',priceMinor:'1000',available:4,images:[],tiers:[{id:'single' as const,label:'1 vial',vials:1,total:10,perVial:10}]},
 {id:2,slug:'sample-size-20',sku:'SAMPLE-20',label:'20 mg',priceMinor:'1800',available:6,images:[],tiers:[{id:'single' as const,label:'1 vial',vials:1,total:18,perVial:18},{id:'pack3' as const,label:'3-pack',vials:3,total:48,perVial:16,preselected:true}]}];
it('captures the currently selected size when analytics is allowed after changing sizes',()=>{
 document.cookie='ecl_analytics_consent=; Max-Age=0; Path=/';
 render(<SizedProductExperience product={product} sizes={sizes} minorUnit={2} coa={null}/>);
 fireEvent.click(screen.getByRole('radio',{name:'20 mg'}));
 expect(m.view).not.toHaveBeenCalled();
 setAnalyticsConsent('granted');
 expect(m.view).toHaveBeenCalledExactlyOnceWith({item_id:'sample',item_name:'Sample',item_variant:'20 mg',price:18},18);
});
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
it('updates selected SKU, cart identity and the size deep link when the size changes',()=>{
 history.replaceState({},'', '/product/sample?campaign=kept#pack-options');
 render(<ProductPurchase product={product} sizes={sizes} minorUnit={2}/>);
 expect(screen.getByText('SAMPLE-10')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('radio',{name:'20 mg'}));
 expect(screen.getByText('SAMPLE-20')).toBeInTheDocument();
 expect(m.selectSize).toHaveBeenCalledWith(expect.objectContaining({item_id:'sample',item_name:'Sample',item_variant:'20 mg',price:18}));
 expect(window.location.href).toContain('/product/sample?campaign=kept&size=sample-size-20#pack-options');
 fireEvent.click(screen.getByRole('button',{name:/Add to Cart ·/}));
 expect(m.add).toHaveBeenLastCalledWith(expect.objectContaining({productId:2,slug:'sample-size-20',variantLabel:'3-pack · 20 mg'}),1,3);
});
it('removes stale parent specifications and imagery when a child size is selected',()=>{
 const detailedSizes=[
  {...sizes[0],images:[{src:'/sample-10.png',alt:'Sample 10 mg vial'}],shortDescription:'10 mg supply summary',description:'<p>10 mg product details.</p>'},
  {...sizes[1],images:[{src:'/sample-20.png',alt:'Sample 20 mg vial'}],shortDescription:'20 mg supply summary',description:'<p>20 mg product details.</p>'},
 ];
 render(<SizedProductExperience product={{...product,image:'/sample-10.png'}} sizes={detailedSizes} minorUnit={2} initialSize="sample" bacWater={null} coa={null}/>);
 expect(screen.getByText('10 mg supply summary')).toBeInTheDocument();
 expect(screen.getByText('10 mg product details.')).toBeInTheDocument();
 expect(screen.getByRole('img',{name:'Sample 10 mg vial'})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('radio',{name:'20 mg'}));
 expect(screen.getByText('20 mg supply summary')).toBeInTheDocument();
 expect(screen.getByText('20 mg product details.')).toBeInTheDocument();
 expect(screen.getByRole('img',{name:'Sample 20 mg vial'})).toBeInTheDocument();
 expect(screen.queryByText('10 mg supply summary')).toBeNull();
 expect(screen.queryByText('10 mg product details.')).toBeNull();
 expect(screen.queryByRole('img',{name:'Sample 10 mg vial'})).toBeNull();
 expect(screen.getAllByRole('img').every((image)=>!image.getAttribute('src')?.includes('sample-10'))).toBe(true);
 expect(screen.getByText(/selected 20 mg supply/i)).toBeInTheDocument();
});
it('follows a new initial size when the same product is rerendered after query navigation',()=>{
 const detailedSizes=[
  {...sizes[0],images:[{src:'/sample-10.png',alt:'Sample 10 mg vial'}],shortDescription:'10 mg supply summary',description:'<p>10 mg product details.</p>'},
  {...sizes[1],images:[{src:'/sample-20.png',alt:'Sample 20 mg vial'}],shortDescription:'20 mg supply summary',description:'<p>20 mg product details.</p>'},
 ];
 const experience=(initialSize:string)=><SizedProductExperience product={{...product,image:'/sample-10.png'}} sizes={detailedSizes} minorUnit={2} initialSize={initialSize} bacWater={null} coa={null}/>;
 const {rerender}=render(experience('sample'));
 expect(screen.getByRole('radio',{name:'10 mg'})).toBeChecked();
 rerender(experience('sample-size-20'));
 expect(screen.getByRole('radio',{name:'20 mg'})).toBeChecked();
 expect(screen.getByText('20 mg supply summary')).toBeInTheDocument();
 expect(screen.queryByText('10 mg supply summary')).toBeNull();
});
