// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {webcrypto} from "node:crypto";
import {afterEach} from "vitest";
import {cleanup} from "@testing-library/react";
afterEach(cleanup);
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({quote:vi.fn(),place:vi.fn(),recover:vi.fn(),push:vi.fn(),clear:vi.fn(),lines:[{key:'a',slug:'a',name:'Local name',variantLabel:'1 vial',quantity:1,unitPrice:12}]}));
vi.mock('@/lib/cart-context',()=>({useCart:()=>({lines:m.lines,ready:true,completeOrder:m.clear})}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:m.push})}));
vi.mock('@/app/(store)/checkout/actions',()=>({quoteCart:m.quote,placeOrder:m.place,recoverCheckoutAttempt:m.recover,captureCartEmail:vi.fn()}));
import CheckoutForm from '@/components/CheckoutForm';
const quote={version:'v1',lines:[{key:'a',slug:'a',name:'Authoritative name',variantLabel:'1 vial',quantity:1,unitPriceCents:1200,lineTotalCents:1200,isGift:false}],subtotalCents:1200,totalCents:1200,shippingCents:0,discountCents:0,paymentOptions:[{method:'bank_transfer',label:'Bank transfer',badges:[],blurb:'Transfer'}],shippingOptions:[],warnings:[]};
beforeEach(()=>{sessionStorage.clear();m.lines=[{key:'a',slug:'a',name:'Local name',variantLabel:'1 vial',quantity:1,unitPrice:12}];vi.stubGlobal("crypto",webcrypto);m.quote.mockReset();m.place.mockReset();m.recover.mockReset();m.push.mockReset();m.clear.mockReset();});
it('shows a failed quote with an actionable retry',async()=>{m.quote.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(quote);render(<CheckoutForm/>);fireEvent.click(await screen.findByRole('button',{name:/retry/i}));expect(await screen.findByText('Authoritative name')).toBeTruthy();expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled();});
it('disables submission immediately while a changed cart is repriced',async()=>{m.quote.mockResolvedValueOnce(quote);const ui=render(<CheckoutForm/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());m.quote.mockImplementationOnce(()=>new Promise(()=>{}));m.lines=[{...m.lines[0],quantity:2}];ui.rerender(<CheckoutForm/>);expect(screen.getByRole('button',{name:'Place order'})).toBeDisabled();});
it('gives every checkout field a persistent accessible label',async()=>{m.quote.mockResolvedValue(quote);render(<CheckoutForm/>);await act(async()=>{});for(const name of ['Email address','Full name','Street address','Suburb','State','Postcode','Phone (optional)','Discount code','Delivery instructions (optional)'])expect(screen.getByLabelText(name)).toBeTruthy();});
function submitForm(){fireEvent.submit(screen.getByRole('button',{name:'Place order'}).closest('form')!);}
it('retries an uncertain submission with the same identity and retains contact input',async()=>{m.quote.mockResolvedValue(quote);m.place.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ok:false,error:'Still pending'});render(<CheckoutForm/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'person@example.test'}});submitForm();await screen.findByRole('alert');expect(screen.getByLabelText('Email address')).toHaveValue('person@example.test');submitForm();await waitFor(()=>expect(m.place).toHaveBeenCalledTimes(2));expect(m.place.mock.calls[0][0].idempotencyKey).toBe(m.place.mock.calls[1][0].idempotencyKey);});
it('ignores an obsolete quote response after a newer cart is quoted',async()=>{let older!:(v:typeof quote)=>void;m.quote.mockImplementationOnce(()=>new Promise(r=>{older=r;})).mockResolvedValueOnce({...quote,version:'new',totalCents:2400});const ui=render(<CheckoutForm/>);m.lines=[{...m.lines[0],quantity:3}];ui.rerender(<CheckoutForm/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());await act(async()=>older({...quote,totalCents:9900}));expect(screen.queryByText('$99.00')).toBeNull();});
it('uses a full document navigation to the exact secure payment URL after success',async()=>{const navigate=vi.fn();vi.stubGlobal('location',{assign:navigate});m.quote.mockResolvedValue(quote);m.place.mockResolvedValue({ok:true,orderNumber:'ECL-TEST',orderId:'id',totalCents:1200,purchasedLines:quote.lines,paymentUrl:'/pay/id?token=secure-token'});render(<CheckoutForm/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());submitForm();await waitFor(()=>expect(m.clear).toHaveBeenCalled());expect(navigate).toHaveBeenCalledWith('/pay/id?token=secure-token');expect(m.push).not.toHaveBeenCalled();});
it('keeps an uncertain order identity when only the authoritative quote version changes',async()=>{
 m.quote.mockResolvedValueOnce(quote).mockResolvedValueOnce({...quote,version:'v2',totalCents:1500});
 m.place.mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce({ok:false,error:'Replay still pending'});
 render(<CheckoutForm/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
 submitForm(); await screen.findByRole('alert');
 fireEvent.click(screen.getByRole('button',{name:'Refresh order total'}));
 await screen.findByText('$15.00');
 submitForm(); await waitFor(()=>expect(m.place).toHaveBeenCalledTimes(2));
 expect(m.place.mock.calls[1][0].quoteVersion).toBe('v2');
 expect(m.place.mock.calls[1][0].idempotencyKey).toBe(m.place.mock.calls[0][0].idempotencyKey);
});
it('normalizes cosmetic contact and address edits when retrying an uncertain order',async()=>{
 m.quote.mockResolvedValue(quote); m.place.mockRejectedValue(new Error('response lost'));
 render(<CheckoutForm/>); await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
 for(const [label,value] of [['Email address','Person@Example.test'],['Full name','Researcher'],['Street address','1 Example Street'],['Suburb','Testville'],['Phone (optional)','0400000000'],['Delivery instructions (optional)','Leave at desk']]) fireEvent.change(screen.getByLabelText(label),{target:{value}});
 submitForm(); await screen.findByRole('alert');
 for(const [label,value] of [['Email address','person@example.test'],['Full name',' Researcher '],['Street address',' 1 Example Street '],['Suburb',' Testville '],['Phone (optional)',' 0400000000 '],['Delivery instructions (optional)',' Leave at desk ']]) fireEvent.change(screen.getByLabelText(label),{target:{value}});
 submitForm(); await waitFor(()=>expect(m.place).toHaveBeenCalledTimes(2));
 expect(m.place.mock.calls[1][0].idempotencyKey).toBe(m.place.mock.calls[0][0].idempotencyKey);
});

it('recovers the same attempt after a reload without storing contact or cart details',async()=>{
 m.quote.mockResolvedValue(quote); m.place.mockRejectedValue(new Error('response lost'));
 const enter=()=>{fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'reload@example.test'}});fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Private Researcher'}});};
 let ui=render(<CheckoutForm/>); await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
 enter();submitForm();await screen.findByRole('alert');
 const original=m.place.mock.calls[0][0].idempotencyKey;
 const stored=sessionStorage.getItem('ecl_checkout_attempt');
 expect(stored).not.toBeNull();
 expect(JSON.parse(stored!)).toEqual({id:original,hash:expect.stringMatching(/^[a-f0-9]{64}$/)});
 expect(JSON.parse(stored!).hash).toBe('a2b4c6a3f0eed2fa4eb40eb5d607ccca2e7a51523c031f1aa24fa3c582774ab6');
 expect(stored).not.toContain('reload@example.test');expect(stored).not.toContain('Private Researcher');expect(stored).not.toContain('Local name');
 ui.unmount();ui=render(<CheckoutForm/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
 enter();submitForm();await waitFor(()=>expect(m.place).toHaveBeenCalledTimes(2));
 expect(m.place.mock.calls[1][0].idempotencyKey).toBe(original);
 fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Different Researcher'}});submitForm();await waitFor(()=>expect(m.place).toHaveBeenCalledTimes(3));
 expect(m.place.mock.calls[2][0].idempotencyKey).not.toBe(original);
});

it('recovers an uncertain persisted attempt without a sellable quote or re-entered contact',async()=>{
 const navigate=vi.fn();vi.stubGlobal('location',{assign:navigate});
 sessionStorage.setItem('ecl_checkout_attempt',JSON.stringify({id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',hash:'a'.repeat(64)}));
 m.quote.mockResolvedValue({...quote,lines:[],version:'empty'});
 m.recover.mockResolvedValue({ok:true,replayed:true,orderNumber:'ECL-OLD',totalCents:1200,paymentUrl:'/pay/old?token=protected',purchasedLines:quote.lines});
 render(<CheckoutForm/>);
 fireEvent.click(await screen.findByRole('button',{name:'Check previous order attempt'}));
 await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/pay/old?token=protected'));
 expect(m.place).not.toHaveBeenCalled();expect(m.recover).toHaveBeenCalledWith('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a'.repeat(64));
 expect(m.clear).toHaveBeenCalledWith(quote.lines);expect(sessionStorage.getItem('ecl_checkout_attempt')).toBeNull();
});
it('does not clear the cart from a fresh quote when replay lacks its original purchased lines',async()=>{
 const navigate=vi.fn();vi.stubGlobal('location',{assign:navigate});
 sessionStorage.setItem('ecl_checkout_attempt',JSON.stringify({id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',hash:'b'.repeat(64)}));
 m.quote.mockResolvedValue(quote);m.recover.mockResolvedValue({ok:true,replayed:true,orderNumber:'ECL-LEGACY',totalCents:1200,paymentUrl:'/pay/old?token=protected'});
 render(<CheckoutForm/>);fireEvent.click(await screen.findByRole('button',{name:'Check previous order attempt'}));
 await waitFor(()=>expect(navigate).toHaveBeenCalled());expect(m.clear).not.toHaveBeenCalled();
});
it('keeps recovery available when an earlier transaction has not committed yet',async()=>{
 const navigate=vi.fn();vi.stubGlobal('location',{assign:navigate});
 sessionStorage.setItem('ecl_checkout_attempt',JSON.stringify({id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',hash:'c'.repeat(64)}));
 m.quote.mockResolvedValue({...quote,lines:[]});
 m.recover.mockResolvedValueOnce({ok:false,notFound:true,error:'Not committed yet'}).mockResolvedValueOnce({ok:true,replayed:true,orderNumber:'ECL-RECOVERED',totalCents:1200,paymentUrl:'/pay/recovered?token=secure',purchasedLines:quote.lines});
 render(<CheckoutForm/>);fireEvent.click(await screen.findByRole('button',{name:'Check previous order attempt'}));
 await screen.findByRole('alert');
 fireEvent.click(screen.getByRole('button',{name:'Check previous order attempt'}));
 await waitFor(()=>expect(navigate).toHaveBeenCalled());expect(m.place).not.toHaveBeenCalled();
});
