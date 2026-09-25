// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {webcrypto} from "node:crypto";
import {afterEach} from "vitest";
import {cleanup} from "@testing-library/react";
afterEach(()=>{cleanup();vi.useRealTimers();});
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({quote:vi.fn(),place:vi.fn(),recover:vi.fn(),request:vi.fn(),push:vi.fn(),clear:vi.fn(),lines:[{key:'a',slug:'a',name:'Local name',variantLabel:'1 vial',quantity:1,unitPrice:12}]}));
vi.mock('@/lib/cart-context',()=>({useCart:()=>({lines:m.lines,ready:true,completeOrder:m.clear})}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:m.push})}));
vi.mock('@/app/(store)/checkout/actions',()=>({quoteCart:m.quote,placeOrder:m.place,recoverCheckoutAttempt:m.recover,captureCartEmail:vi.fn()}));
vi.mock('@/app/cart-recovery/actions',()=>({requestCartRecovery:m.request}));
import CheckoutForm from '@/components/CheckoutForm';
const quote={version:'v1',lines:[{key:'a',slug:'a',name:'Authoritative name',variantLabel:'1 vial',quantity:1,unitPriceCents:1200,lineTotalCents:1200,isGift:false}],subtotalCents:1200,totalCents:1200,shippingCents:0,shippingMethod:'standard',discountCents:0,paymentOptions:[{method:'bank_transfer',label:'Bank transfer',badges:[],blurb:'Transfer'}],shippingOptions:[],warnings:[]};
beforeEach(()=>{sessionStorage.clear();m.lines=[{key:'a',slug:'a',name:'Local name',variantLabel:'1 vial',quantity:1,unitPrice:12}];vi.stubGlobal("crypto",webcrypto);m.quote.mockReset();m.place.mockReset();m.recover.mockReset();m.push.mockReset();m.clear.mockReset();});
it('shows a failed quote with an actionable retry',async()=>{m.quote.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(quote);render(<CheckoutForm/>);fireEvent.click(await screen.findByRole('button',{name:/retry/i}));expect(await screen.findByText('Authoritative name')).toBeTruthy();expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled();});
it('times out a hanging quote and ignores its late response while allowing a fresh retry',async()=>{
 vi.useFakeTimers();let late!:(value:typeof quote)=>void;
 m.quote.mockImplementationOnce(()=>new Promise(resolve=>{late=resolve;})).mockResolvedValueOnce(quote);
 render(<CheckoutForm/>);
 await act(async()=>{await vi.advanceTimersByTimeAsync(15000);});
 expect(screen.getByRole('button',{name:'Retry total'})).toBeEnabled();
 expect(screen.getByRole('button',{name:'Place order'})).toBeDisabled();
 await act(async()=>late({...quote,totalCents:9900}));
 expect(screen.queryByText('$99.00')).not.toBeInTheDocument();
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Retry total'})));
 expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled();
});
it('keeps optional cart recovery collapsed after the core contact details',async()=>{
 m.quote.mockResolvedValue(quote);render(<CheckoutForm/>);await act(async()=>{});
 expect(screen.queryByRole('checkbox',{name:/cart link/i})).not.toBeInTheDocument();
 const disclosure=screen.getByText('Save this cart for later (optional)');
 expect(screen.getByLabelText('Full name').compareDocumentPosition(disclosure)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 fireEvent.click(disclosure);
 expect(screen.getByRole('checkbox',{name:/cart link/i})).not.toBeChecked();
});
it('disables submission immediately while a changed cart is repriced',async()=>{m.quote.mockResolvedValueOnce(quote);const ui=render(<CheckoutForm/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());m.quote.mockImplementationOnce(()=>new Promise(()=>{}));m.lines=[{...m.lines[0],quantity:2}];ui.rerender(<CheckoutForm/>);expect(screen.getByRole('button',{name:'Place order'})).toBeDisabled();});
it('gives every checkout field a persistent accessible label',async()=>{m.quote.mockResolvedValue(quote);render(<CheckoutForm/>);await act(async()=>{});for(const name of ['Email address','Full name','Street address','Suburb','State','Postcode','Phone (optional)','Discount code','Delivery instructions (optional)'])expect(screen.getByLabelText(name)).toBeTruthy();});
function submitForm(){fireEvent.submit(screen.getByRole('button',{name:'Place order'}).closest('form')!);}
it('retries an uncertain submission with the same identity and retains contact input',async()=>{
 m.quote.mockResolvedValue(quote);
 m.place.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ok:false,error:'Still pending'});
 render(<CheckoutForm/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'person@example.test'}});
 submitForm();
 await screen.findByRole('alert');
 expect(screen.getByLabelText('Email address')).toHaveValue('person@example.test');
 // The error can render before the asynchronous React transition finishes.
 await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
 submitForm();
 await waitFor(()=>expect(m.place).toHaveBeenCalledTimes(2));
 expect(m.place.mock.calls[0][0].idempotencyKey).toBe(m.place.mock.calls[1][0].idempotencyKey);
});
it('ignores an obsolete quote response after a newer cart is quoted',async()=>{let older!:(v:typeof quote)=>void;m.quote.mockImplementationOnce(()=>new Promise(r=>{older=r;})).mockResolvedValueOnce({...quote,version:'new',totalCents:2400});const ui=render(<CheckoutForm/>);m.lines=[{...m.lines[0],quantity:3}];ui.rerender(<CheckoutForm/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());await act(async()=>older({...quote,totalCents:9900}));expect(screen.queryByText('$99.00')).toBeNull();});
it('uses a full document navigation to the exact secure payment URL after success',async()=>{const navigate=vi.fn();vi.stubGlobal('location',{assign:navigate});m.quote.mockResolvedValue(quote);m.place.mockResolvedValue({ok:true,orderNumber:'ECL-TEST',orderId:'id',totalCents:1200,purchasedLines:quote.lines,paymentUrl:'/pay/id?token=secure-token'});render(<CheckoutForm/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());submitForm();await waitFor(()=>expect(m.clear).toHaveBeenCalled());expect(navigate).toHaveBeenCalledWith('/pay/id?token=secure-token');expect(m.push).not.toHaveBeenCalled();});
it('keeps an uncertain order identity when only the authoritative quote version changes',async()=>{
 m.quote.mockResolvedValueOnce(quote).mockResolvedValueOnce({...quote,version:'v2',totalCents:1500});
 m.place.mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce({ok:false,error:'Replay still pending'});
 render(<CheckoutForm/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
 submitForm(); await screen.findByRole('alert');
 await waitFor(()=>expect(screen.getByRole('button',{name:'Refresh order total'})).toBeEnabled());
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

it('links server errors to fields and focuses the first invalid control while keeping attempt recovery',async()=>{
 m.quote.mockResolvedValue(quote);m.place.mockResolvedValue({ok:false,error:'Check your details.',fieldErrors:{email:'Enter a valid email.',postcode:'Enter four digits.'}});
 render(<CheckoutForm/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());submitForm();
 await waitFor(()=>expect(screen.getByLabelText('Email address')).toHaveFocus());
 expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid','true');
 expect(screen.getByLabelText('Postcode')).toHaveAccessibleDescription('Enter four digits.');
 expect(screen.getByRole('button',{name:'Check previous order attempt'})).toBeEnabled();
});

it('requests cart mail only after an unchecked purpose choice and explicit button, never on email blur',async()=>{
 m.quote.mockResolvedValue(quote);m.request.mockResolvedValue({ok:true,message:'Check your email to confirm.'});render(<CheckoutForm/>);
 const email=screen.getByLabelText('Email address');fireEvent.change(email,{target:{value:'person@test.local'}});fireEvent.blur(email);
 expect(m.request).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Save this cart for later (optional)'));const choice=screen.getByRole('checkbox',{name:/cart link/i});expect(choice).not.toBeChecked();
 expect(screen.getByRole('button',{name:'Email my cart link'})).toBeDisabled();fireEvent.click(choice);fireEvent.click(screen.getByRole('button',{name:'Email my cart link'}));
 expect(await screen.findByText('Check your email to confirm.')).toBeVisible();expect(m.request).toHaveBeenCalledTimes(1);
 expect(localStorage.getItem('ecl_cart_v1')??'').not.toContain('person@test.local');
});
it('keeps quote discount errors linked before any submission',async()=>{
 m.quote.mockResolvedValue({...quote,discountError:'Code is unavailable.'});render(<CheckoutForm/>);
 await screen.findByText('Code is unavailable.');expect(screen.getByLabelText('Discount code')).toHaveAttribute('aria-invalid','true');expect(screen.getByLabelText('Discount code')).toHaveAccessibleDescription('Code is unavailable.');
});

const shippingOptions=[
 {method:'standard',label:'Standard shipping',cents:1000,baseCents:1000,eta:'2–5 days',freeThresholdCents:15000,isFree:false,remainingCents:13800},
 {method:'express',label:'Express shipping',cents:1800,baseCents:1800,eta:'1–2 days',freeThresholdCents:15000,isFree:false,remainingCents:13800},
];
const standardOnlyQuote={...quote,version:'standard-only',shippingMethod:'standard',shippingOptions:shippingOptions.slice(0,1),shippingCents:1000,totalCents:2200};
async function selectExpress(){
 fireEvent.click(await screen.findByRole('radio',{name:/Express shipping/}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
 expect(screen.getByRole('radio',{name:/Express shipping/})).toBeChecked();
}
function quoteWithBothMethods(){
 m.quote.mockImplementation(async(_lines:unknown,_code:unknown,method:string)=>({...quote,shippingMethod:method,shippingOptions,shippingCents:method==='express'?1800:1000,totalCents:method==='express'?3000:2200}));
}
for(const path of ['refresh','submission'] as const){
 it(`reconciles disabled Express shipping from a ${path} quote before successfully submitting Standard`,async()=>{
  const navigate=vi.fn();vi.stubGlobal('location',{assign:navigate});quoteWithBothMethods();
  render(<CheckoutForm/>);await selectExpress();
  m.quote.mockResolvedValue(standardOnlyQuote);
  if(path==='refresh')fireEvent.click(screen.getByRole('button',{name:'Refresh order total'}));
  else {
   m.place.mockResolvedValueOnce({ok:false,error:'Review the updated shipping.',quote:standardOnlyQuote});
   submitForm();await screen.findByText('Review the updated shipping.');
  }
  await waitFor(()=>expect(screen.queryByRole('radio',{name:/Express shipping/})).toBeNull());
  await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
  expect(screen.getByText('$22.00')).toBeVisible();
  m.place.mockImplementation(async(input)=>input.shippingMethod==='standard' && input.quoteVersion==='standard-only'
   ? {ok:true,orderNumber:'ECL-STANDARD',totalCents:2200,purchasedLines:standardOnlyQuote.lines,paymentUrl:'/pay/standard?token=synthetic'}
   : {ok:false,error:'Select an available shipping method.'});
  submitForm();await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/pay/standard?token=synthetic'));
  expect(m.place.mock.lastCall![0].shippingMethod).toBe('standard');
  expect(m.clear).toHaveBeenCalledWith(standardOnlyQuote.lines);
 });
}
it('keeps the original uncertain Express attempt and purchased evidence recoverable after a Standard requote',async()=>{
 const navigate=vi.fn();vi.stubGlobal('location',{assign:navigate});quoteWithBothMethods();
 m.place.mockRejectedValueOnce(new Error('lost response'));
 const ui=render(<CheckoutForm/>);await selectExpress();submitForm();await screen.findByRole('alert');
 const original=sessionStorage.getItem('ecl_checkout_attempt')!;
 m.quote.mockResolvedValue({...standardOnlyQuote,lines:[{...quote.lines[0],quantity:2,lineTotalCents:2400}]});
 m.lines=[{...m.lines[0],quantity:2}];ui.rerender(<CheckoutForm/>);
 await waitFor(()=>expect(screen.queryByRole('radio',{name:/Express shipping/})).toBeNull());
 await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
 expect(sessionStorage.getItem('ecl_checkout_attempt')).toBe(original);
 m.recover.mockResolvedValue({ok:true,replayed:true,orderNumber:'ECL-ORIGINAL',totalCents:3000,paymentUrl:'/pay/original?token=synthetic',purchasedLines:quote.lines});
 fireEvent.click(screen.getByRole('button',{name:'Check previous order attempt'}));
 await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/pay/original?token=synthetic'));
 const saved=JSON.parse(original);expect(m.recover).toHaveBeenCalledWith(saved.id,saved.hash);
 expect(m.clear).toHaveBeenCalledWith(quote.lines);expect(m.place).toHaveBeenCalledTimes(1);
});

for(const path of ['refresh','submission'] as const){
it(`requires recovery before an automatic shipping fallback from ${path} can duplicate an uncertain order`,async()=>{
 quoteWithBothMethods();m.place.mockRejectedValue(new Error('response lost'));
 m.recover.mockResolvedValue({ok:false,notFound:true,error:'Original request may still be pending.'});
 render(<CheckoutForm/>);await selectExpress();submitForm();await screen.findByRole('alert');
 const original=sessionStorage.getItem('ecl_checkout_attempt');
 await waitFor(()=>expect(screen.getByRole('button',{name:'Refresh order total'})).toBeEnabled());
 m.quote.mockResolvedValue(standardOnlyQuote);
 const submittedCount=path==='refresh'?1:2;
 if(path==='refresh')fireEvent.click(screen.getByRole('button',{name:'Refresh order total'}));
 else {
  m.place.mockResolvedValueOnce({ok:false,error:'Review the updated shipping.',quote:standardOnlyQuote});
  submitForm();await screen.findByText('Review the updated shipping.');
 }
 await waitFor(()=>expect(screen.queryByRole('radio',{name:/Express shipping/})).toBeNull());
 await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
 submitForm();
 await screen.findByText('Checkout options changed after an unconfirmed order attempt. Check your previous order attempt before placing another order.');
 expect(m.place).toHaveBeenCalledTimes(submittedCount);expect(sessionStorage.getItem('ecl_checkout_attempt')).toBe(original);
 fireEvent.click(screen.getByRole('button',{name:'Check previous order attempt'}));
 await screen.findByText('Original request may still be pending.');
 await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());submitForm();
 await screen.findByText('Checkout options changed after an unconfirmed order attempt. Check your previous order attempt before placing another order.');
 expect(m.place).toHaveBeenCalledTimes(submittedCount);expect(sessionStorage.getItem('ecl_checkout_attempt')).toBe(original);
 // An explicit customer edit is still a different authorised request.
 fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Changed Researcher'}});submitForm();
 await waitFor(()=>expect(m.place).toHaveBeenCalledTimes(submittedCount+1));
 expect(m.place.mock.lastCall![0].idempotencyKey).not.toBe(m.place.mock.calls[0][0].idempotencyKey);
});
}

it('blocks submission until the reconciled shipping request has a fresh quote',async()=>{
 quoteWithBothMethods();render(<CheckoutForm/>);await selectExpress();
 let resolveStandard!:(value:typeof standardOnlyQuote)=>void;
 m.quote.mockResolvedValueOnce(standardOnlyQuote).mockImplementationOnce(()=>new Promise(resolve=>{resolveStandard=resolve;}));
 fireEvent.click(screen.getByRole('button',{name:'Refresh order total'}));
 await waitFor(()=>expect(screen.queryByRole('radio',{name:/Express shipping/})).toBeNull());
 await waitFor(()=>expect(m.quote.mock.lastCall![2]).toBe('standard'));
 expect(screen.getByRole('button',{name:'Place order'})).toBeDisabled();
 submitForm();expect(m.place).not.toHaveBeenCalled();
 await act(async()=>resolveStandard(standardOnlyQuote));
 expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled();
});

const payidOption={method:'payid',label:'PayID',badges:[],blurb:'PayID transfer'};
for(const path of ['refresh','submission'] as const){
 it(`retains the uncertain PayID attempt when ${path} automatically falls back to bank transfer with unchanged Standard shipping`,async()=>{
  const bothPayments={...standardOnlyQuote,paymentOptions:[payidOption,...quote.paymentOptions]};
  m.quote.mockResolvedValue(bothPayments);m.place.mockRejectedValue(new Error('PayID response lost'));
  m.recover.mockResolvedValue({ok:false,notFound:true,error:'Original PayID request may still be pending.'});
  render(<CheckoutForm/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
  expect(screen.getByRole('radio',{name:/PayID/})).toBeChecked();
  submitForm();await screen.findByRole('alert');
  const original=sessionStorage.getItem('ecl_checkout_attempt');
  expect(m.place.mock.calls[0][0]).toMatchObject({paymentMethod:'payid',shippingMethod:'standard'});
  await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
  m.quote.mockResolvedValue(standardOnlyQuote);
  const submittedCount=path==='refresh'?1:2;
  if(path==='refresh')fireEvent.click(screen.getByRole('button',{name:'Refresh order total'}));
  else {
   m.place.mockResolvedValueOnce({ok:false,error:'PayID is no longer available.',quote:standardOnlyQuote});
   submitForm();await screen.findByText('PayID is no longer available.');
   expect(m.place.mock.calls[1][0].idempotencyKey).toBe(m.place.mock.calls[0][0].idempotencyKey);
  }
  await waitFor(()=>expect(screen.getByRole('radio',{name:/Bank transfer/})).toBeChecked());
  await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
  // Complete any unexpected submission so the call-count assertion catches an
  // actual duplicate request rather than relying only on the wording of an alert.
  m.place.mockResolvedValue({ok:false,error:'Unexpected second order request.'});
  await act(async()=>submitForm());
  expect(m.place).toHaveBeenCalledTimes(submittedCount);
  expect(sessionStorage.getItem('ecl_checkout_attempt')).toBe(original);
  expect(screen.getByRole('alert')).toHaveTextContent('Check your previous order attempt before placing another order.');
  fireEvent.click(screen.getByRole('button',{name:'Check previous order attempt'}));
  await screen.findByText('Original PayID request may still be pending.');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
  await act(async()=>submitForm());
  expect(m.place).toHaveBeenCalledTimes(submittedCount);
  expect(sessionStorage.getItem('ecl_checkout_attempt')).toBe(original);
  const saved=JSON.parse(original!);expect(m.recover).toHaveBeenCalledWith(saved.id,saved.hash);
  // Re-enabling PayID does not retroactively make the earlier bank fallback
  // explicit. A real radio change by the customer does authorise a new request.
  m.quote.mockResolvedValue(bothPayments);fireEvent.click(screen.getByRole('button',{name:'Refresh order total'}));
  await screen.findByRole('radio',{name:/PayID/});
  await waitFor(()=>expect(screen.getByRole('button',{name:'Place order'})).toBeEnabled());
  await act(async()=>submitForm());expect(m.place).toHaveBeenCalledTimes(submittedCount);
  fireEvent.click(screen.getByRole('radio',{name:/PayID/}));
  fireEvent.click(screen.getByRole('radio',{name:/Bank transfer/}));
  submitForm();await waitFor(()=>expect(m.place).toHaveBeenCalledTimes(submittedCount+1));
  expect(m.place.mock.lastCall![0]).toMatchObject({paymentMethod:'bank_transfer',shippingMethod:'standard'});
  expect(m.place.mock.lastCall![0].idempotencyKey).not.toBe(m.place.mock.calls[0][0].idempotencyKey);
 });
}
