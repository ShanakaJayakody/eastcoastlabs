// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {afterEach} from "vitest";
import {cleanup} from "@testing-library/react";
afterEach(cleanup);
import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const analytics=vi.hoisted(()=>({begin:vi.fn(),remove:vi.fn()}));
vi.mock('@/lib/analytics', () => ({ trackBeginCheckout:analytics.begin,trackRemoveFromCart:analytics.remove,commerceItem:(input:{slug:string;name:string;pack?:string;price?:number;quantity?:number})=>({item_id:input.slug,item_name:input.name,item_variant:input.pack,price:input.price,quantity:input.quantity}) }));
vi.mock('@/lib/woo', () => ({ wooCart:{addItem:()=>Promise.resolve()} }));
import { CartProvider, useCart } from '@/lib/cart-context';
const line={key:'one',productId:1,name:'One',slug:'one',variantLabel:'1 vial',unitPrice:20};
function Probe(){const c=useCart();return <><output>{JSON.stringify(c.lines)}</output><button onClick={()=>c.addLine(line,100)}>Add</button><button onClick={()=>c.removeLine('one')}>Remove</button><button onClick={()=>c.updateQty('one',0)}>Zero</button><button onClick={()=>c.goToCheckout()}>Checkout</button></>}
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();});
it('rejects corrupted stored line records',()=>{localStorage.setItem('ecl_cart_v1',JSON.stringify([{key:'broken'}])); render(<CartProvider><Probe/></CartProvider>);expect(screen.getByRole('status').textContent).toBe('[]');});
it('bounds quantities and refreshes price when readding',()=>{localStorage.setItem('ecl_cart_v1',JSON.stringify([{...line,unitPrice:10,quantity:2}]));render(<CartProvider><Probe/></CartProvider>);fireEvent.click(screen.getByText('Add'));expect(JSON.parse(screen.getByRole('status').textContent!)[0]).toMatchObject({unitPrice:20,quantity:99});});
it('accepts another tab clearing the cart',()=>{localStorage.setItem('ecl_cart_v1',JSON.stringify([{...line,quantity:2}]));render(<CartProvider><Probe/></CartProvider>);act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'ecl_cart_v1',newValue:null})));expect(screen.getByRole('status').textContent).toBe('[]');});
it('refreshes persisted prices from the current server catalogue snapshot',()=>{localStorage.setItem('ecl_cart_v1',JSON.stringify([{...line,unitPrice:10,quantity:2}]));render(<CartProvider prices={{'one:1':2500}}><Probe/></CartProvider>);expect(JSON.parse(screen.getByRole('status').textContent!)[0].unitPrice).toBe(25);});

function CompleteProbe(){const c=useCart();return <><output>{JSON.stringify(c.lines)}</output><button onClick={()=>c.completeOrder([{key:'one',quantity:1}])}>Complete</button></>}
it('removes only purchased quantities and preserves unavailable lines',()=>{localStorage.setItem('ecl_cart_v1',JSON.stringify([{...line,quantity:3},{...line,key:'unavailable',slug:'unavailable',quantity:1}]));render(<CartProvider><CompleteProbe/></CartProvider>);fireEvent.click(screen.getByText('Complete'));const result=JSON.parse(screen.getByRole('status').textContent!);expect(result.map((l:{key:string;quantity:number})=>[l.key,l.quantity])).toEqual([['one',2],['unavailable',1]]);});
it('adds modern purchase identities from live variants while retaining explicit stored identities',()=>{
 localStorage.setItem('ecl_cart_v1',JSON.stringify([{...line,key:'old',variantId:'stale-id',quantity:1}]));
 render(<CartProvider variants={{'one:1':'live-id'}}><Probe/></CartProvider>);fireEvent.click(screen.getByText('Add'));
 const rows=JSON.parse(screen.getByRole('status').textContent!);expect(rows[0].variantId).toBe('stale-id');expect(rows[1].variantId).toBe('live-id');
});
function VariantCompleteProbe(){const c=useCart();return <><output>{JSON.stringify(c.lines)}</output><button onClick={()=>c.completeOrder([{key:'one',quantity:1,variantId:'original',slug:'one'}])}>Complete variant</button></>}
it('replay completion never removes a newer variant sharing the original cart key',()=>{
 localStorage.setItem('ecl_cart_v1',JSON.stringify([{...line,variantId:'replacement',quantity:1}]));render(<CartProvider><VariantCompleteProbe/></CartProvider>);
 fireEvent.click(screen.getByText('Complete variant'));expect(JSON.parse(screen.getByRole('status').textContent!)[0].quantity).toBe(1);
});
function PackProbe(){const c=useCart();return <><output>{JSON.stringify(c.lines)}</output><button onClick={()=>c.addLine({...line,variantLabel:'Custom label'},1,3)}>Add pack</button></>}
it('selects modern pack identity from structured purchase size, independent of display labels',()=>{
 render(<CartProvider variants={{'one:1':'single-id','one:3':'pack-id'}}><PackProbe/></CartProvider>);fireEvent.click(screen.getByText('Add pack'));
 expect(JSON.parse(screen.getByRole('status').textContent!)[0].variantId).toBe('pack-id');
});
it.each(['Remove','Zero'])('emits canonical slug identity when %s removes a cart line',(action)=>{
 localStorage.setItem('ecl_cart_v1',JSON.stringify([{...line,quantity:2}]));render(<CartProvider><Probe/></CartProvider>);fireEvent.click(screen.getByText(action));
 expect(analytics.remove).toHaveBeenCalledWith({item_id:'one',item_name:'One',item_variant:'1 vial',price:20,quantity:2},40);
});
it('uses canonical slugs for begin checkout item identity',()=>{
 history.replaceState({},'','/checkout');localStorage.setItem('ecl_cart_v1',JSON.stringify([{...line,productId:999,quantity:2}]));render(<CartProvider><Probe/></CartProvider>);fireEvent.click(screen.getByText('Checkout'));
 expect(analytics.begin).toHaveBeenCalledWith([{item_id:'one',item_name:'One',item_variant:'1 vial',price:20,quantity:2}],40);
});
