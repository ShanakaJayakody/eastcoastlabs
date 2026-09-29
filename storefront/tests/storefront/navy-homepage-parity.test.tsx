// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import RebrandExperience from '@/components/rebrand/RebrandExperience';
import NavyFooter from '@/components/rebrand/NavyFooter';
import {CartProvider} from '@/lib/cart-context';
import {UIProvider} from '@/lib/ui-context';
import {getCollections} from '@/lib/collections';
import {labReports} from '@/lib/lab-reports';
import {searchProducts} from '../fixtures/product-search';

vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()}),usePathname:()=>'/2'}));
vi.mock('next/web-vitals',()=>({useReportWebVitals:()=>{}}));
afterEach(cleanup);

function homepage(){
 const products=searchProducts.map(product=>product.slug==='retatrutide'?{...product,images:[{src:'/images/rebrand/vials/v2/retatrutide.webp',alt:'Retatrutide vial'}]}:product);
 return render(<CartProvider stock={{}}><UIProvider><RebrandExperience variant="v2" products={products} collections={getCollections()} records={[]} report={labReports[0]} productReports={[]} reportCount={1} supportEmail="support@example.test"><NavyFooter collections={getCollections()} supportEmail="support@example.test" /></RebrandExperience></UIProvider></CartProvider>);
}

it('makes the existing storefront destinations available from both navigation menus',()=>{
 homepage();
 const desktop=screen.getByRole('navigation',{name:'Main navigation'});
 for(const [label,href] of [['Shop','/shop?rebrand=v2'],['Stacks','/stacks?rebrand=v2'],['Lab reports','/lab-results'],['Learn','/learn'],['Creators','/creators'],['About','/about']]){
  expect(within(desktop).getByRole('link',{name:label})).toHaveAttribute('href',href);
 }
 fireEvent.click(screen.getByRole('button',{name:'Open menu'}));
 const mobile=screen.getByRole('navigation',{name:'Mobile navigation'});
 expect(within(mobile).getByRole('link',{name:'Creators'})).toHaveAttribute('href','/creators');
 fireEvent.click(within(mobile).getByRole('link',{name:'Explore this page'}));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('lets customers preview another research area and follow its collection',()=>{
 homepage();
 const explorer=screen.getByRole('region',{name:'Explore by research area.'});
 const metabolic=within(explorer).getByRole('button',{name:'Preview Metabolic & Weight'});
 fireEvent.click(metabolic);
 expect(metabolic).toHaveAttribute('aria-pressed','true');
 expect(within(explorer).getByRole('button',{name:'Preview Recovery & Repair'})).toHaveAttribute('aria-pressed','false');
 expect(within(explorer).getByRole('img')).toHaveAccessibleName('Retatrutide — Metabolic & Weight collection');
 expect(within(explorer).getByRole('link',{name:'Explore Metabolic & Weight'})).toHaveAttribute('href','/collections/metabolic-weight?rebrand=v2');
 fireEvent.click(within(explorer).getByRole('button',{name:'Preview Cognitive & Focus'}));
 expect(within(explorer).queryByRole('img')).toBeNull();
 expect(within(explorer).getByRole('link',{name:'Explore Cognitive & Focus'})).toHaveAttribute('href','/collections/cognitive-focus?rebrand=v2');
});

it('offers newsletter retry and then announces the confirmation step',async()=>{
 homepage();
 const newsletter=screen.getByRole('region',{name:'Stay curious. Stay informed.'});
 const fetch=vi.fn().mockResolvedValueOnce({ok:false,json:async()=>({ok:false})})
  .mockResolvedValueOnce({ok:true,json:async()=>({ok:true,message:'Check your email to confirm your subscription.'})});
 vi.stubGlobal('fetch',fetch);
 fireEvent.change(await within(newsletter).findByRole('textbox',{name:'Email address'}),{target:{value:'reader@example.test'}});
 fireEvent.click(within(newsletter).getByRole('button',{name:'Subscribe'}));
 expect(await within(newsletter).findByRole('alert')).toHaveTextContent('try again');
 expect(within(newsletter).getByRole('textbox')).toHaveValue('reader@example.test');
 fireEvent.click(within(newsletter).getByRole('button',{name:'Subscribe'}));
 expect(await within(newsletter).findByRole('status')).toHaveTextContent('Check your email');
 expect(fetch).toHaveBeenLastCalledWith('/api/subscribe',expect.objectContaining({body:JSON.stringify({email:'reader@example.test',source:'footer'})}));
});
