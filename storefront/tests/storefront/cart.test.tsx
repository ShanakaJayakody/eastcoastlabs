// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {afterEach} from "vitest";
import {cleanup} from "@testing-library/react";
afterEach(cleanup);
import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/analytics', () => ({ trackBeginCheckout: vi.fn() }));
vi.mock('@/lib/woo', () => ({ wooCart:{addItem:()=>Promise.resolve()} }));
import { CartProvider, useCart } from '@/lib/cart-context';
const line={key:'one',productId:1,name:'One',slug:'one',variantLabel:'1 vial',unitPrice:20};
function Probe(){const c=useCart();return <><output>{JSON.stringify(c.lines)}</output><button onClick={()=>c.addLine(line,100)}>Add</button></>}
beforeEach(()=>localStorage.clear());
it('rejects corrupted stored line records',()=>{localStorage.setItem('ecl_cart_v1',JSON.stringify([{key:'broken'}])); render(<CartProvider><Probe/></CartProvider>);expect(screen.getByRole('status').textContent).toBe('[]');});
it('bounds quantities and refreshes price when readding',()=>{localStorage.setItem('ecl_cart_v1',JSON.stringify([{...line,unitPrice:10,quantity:2}]));render(<CartProvider><Probe/></CartProvider>);fireEvent.click(screen.getByText('Add'));expect(JSON.parse(screen.getByRole('status').textContent!)[0]).toMatchObject({unitPrice:20,quantity:99});});
it('accepts another tab clearing the cart',()=>{localStorage.setItem('ecl_cart_v1',JSON.stringify([{...line,quantity:2}]));render(<CartProvider><Probe/></CartProvider>);act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'ecl_cart_v1',newValue:null})));expect(screen.getByRole('status').textContent).toBe('[]');});
it('refreshes persisted prices from the current server catalogue snapshot',()=>{localStorage.setItem('ecl_cart_v1',JSON.stringify([{...line,unitPrice:10,quantity:2}]));render(<CartProvider prices={{'one:1':2500}}><Probe/></CartProvider>);expect(JSON.parse(screen.getByRole('status').textContent!)[0].unitPrice).toBe(25);});

function CompleteProbe(){const c=useCart();return <><output>{JSON.stringify(c.lines)}</output><button onClick={()=>c.completeOrder([{key:'one',quantity:1}])}>Complete</button></>}
it('removes only purchased quantities and preserves unavailable lines',()=>{localStorage.setItem('ecl_cart_v1',JSON.stringify([{...line,quantity:3},{...line,key:'unavailable',slug:'unavailable',quantity:1}]));render(<CartProvider><CompleteProbe/></CartProvider>);fireEvent.click(screen.getByText('Complete'));const result=JSON.parse(screen.getByRole('status').textContent!);expect(result.map((l:{key:string;quantity:number})=>[l.key,l.quantity])).toEqual([['one',2],['unavailable',1]]);});
