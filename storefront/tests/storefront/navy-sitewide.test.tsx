// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import NavyHeader from '@/components/rebrand/NavyHeader';
import NavyFooter from '@/components/rebrand/NavyFooter';
import {CartProvider} from '@/lib/cart-context';
import {UIProvider} from '@/lib/ui-context';
import NavyPage from '@/app/(variant)/2/page';

const route=vi.hoisted(()=>({pathname:'/shop'}));
vi.mock('next/navigation',async importOriginal=>({...await importOriginal<object>(),usePathname:()=>route.pathname}));
afterEach(cleanup);
beforeEach(()=>{route.pathname='/shop';});
function header(){return render(<CartProvider><UIProvider><NavyHeader/></UIProvider></CartProvider>);}

it('uses canonical home and search destinations from an interior page',()=>{
 header();
 expect(screen.getByRole('link',{name:'East Coast Labs home'})).toHaveAttribute('href','/');
 expect(screen.getByRole('link',{name:'Search peptides'})).toHaveAttribute('href','/shop#catalog-search');
 expect(screen.getByRole('link',{name:'Original lab reports, open to you'})).toHaveAttribute('href','/lab-results');
 expect(within(screen.getByRole('navigation',{name:'Main navigation'})).getByRole('link',{name:'Shop'})).toHaveAttribute('aria-current','page');
});

it('keeps homepage search local and makes the mobile menu work between routes',()=>{
 route.pathname='/';const view=header();
 expect(screen.getByRole('link',{name:'Search peptides'})).toHaveAttribute('href','#homepage-product-search');
 fireEvent.click(screen.getByRole('button',{name:'Open menu'}));
 expect(screen.getByRole('dialog',{name:'Navigation menu'})).toBeInTheDocument();
 route.pathname='/learn';
 view.rerender(<CartProvider><UIProvider><NavyHeader/></UIProvider></CartProvider>);
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it.each(['/checkout','/checkout/thank-you','/pay/example','/leave-a-review','/subscribe/confirm','/creators'])('keeps newsletter capture out of %s',pathname=>{
 route.pathname=pathname;
 render(<NavyFooter collections={[]} supportEmail="support@example.test"/>);
 expect(screen.queryByRole('region',{name:'Stay curious. Stay informed.'})).toBeNull();
 expect(screen.getByRole('link',{name:'Privacy policy'})).toBeInTheDocument();
});

it('redirects the Navy preview bookmark to the canonical homepage',()=>{
 try {NavyPage();expect.fail('The former preview must redirect.');}
 catch(error){expect(error).toHaveProperty('digest','NEXT_REDIRECT;replace;/;308;');}
});
