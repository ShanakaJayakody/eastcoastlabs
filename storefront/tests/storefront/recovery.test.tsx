// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
const m=vi.hoisted(()=>({confirm:vi.fn(),request:vi.fn(),replace:vi.fn()}));
vi.mock('@/app/cart-recovery/actions',()=>({confirmCartRecovery:m.confirm,requestCartRecovery:m.request}));
vi.mock('@/lib/cart-context',()=>({useCart:()=>({replaceLines:m.replace,ready:true})}));
import CartRecoveryRestore from '@/components/CartRecoveryRestore';
import CartRecoveryRequest from '@/components/CartRecoveryRequest';
afterEach(cleanup);beforeEach(()=>vi.clearAllMocks());
it('viewing a recovery page has no consent or cart effects; network failure keeps the cart',async()=>{
 m.confirm.mockRejectedValue(new Error('Synthetic lost response'));render(<CartRecoveryRestore token={'a'.repeat(43)}/>);
 expect(m.confirm).not.toHaveBeenCalled();expect(m.replace).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirm and restore my cart'}));
 expect(await screen.findByText(/could not restore/i)).toBeVisible();expect(m.replace).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'Confirm and restore my cart'})).toBeEnabled();
});
it('request transport failure shows an actionable message without a form submission',async()=>{
 m.request.mockRejectedValue(new Error('Synthetic offline'));render(<CartRecoveryRequest email='synthetic@test.local' lines={[{key:'one',slug:'one',variantLabel:'1 vial',quantity:1}]}/>);
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Email my cart link'}));
 expect(await screen.findByText(/could not request/i)).toBeVisible();expect(screen.getByRole('button',{name:'Email my cart link'})).toBeEnabled();
});
