import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/recovery-consent",()=>({verifiedRecoveryEpisode:async()=>undefined}));
vi.mock("next/server", () => ({ after: vi.fn() }));
const m = vi.hoisted(() => ({ resolve: vi.fn(), applyGift:vi.fn(),create: vi.fn(), replay: vi.fn(), recovered: vi.fn(), discount: vi.fn(),cookieGet:vi.fn() }));
vi.mock("@/lib/checkout", () => ({ resolveCart: m.resolve,applyGiftThreshold:m.applyGift }));
vi.mock("@/lib/admin/orders", () => ({ createOrder: m.create, findCheckoutReplay: m.replay, setOrderPaymentPlan: vi.fn() }));
vi.mock("@/lib/admin/cart-recovery", () => ({ markCartRecovered: m.recovered, captureCart: vi.fn() }));
vi.mock("@/lib/admin/discounts", () => ({ validateDiscount: m.discount }));
vi.mock("@/lib/admin/email", () => ({ queueEmail: vi.fn() }));
vi.mock("next/headers",()=>({cookies:async()=>({get:m.cookieGet})}));
vi.mock("@/lib/settings", () => ({ getSettings: async () => ({ freeShippingThreshold: 150, giftThreshold: 250, payidEnabled: false, bankTransferEnabled: true, bankBsb: "123456", bankAccountNumber: "12345678", standardShippingCents: 1200, expressShippingEnabled: false, paymentExpiryHours: 48 }) }));
import { placeOrder, quoteCart, recoverCheckoutAttempt, type PlaceOrderInput } from "@/app/(store)/checkout/actions";
const id = "31a1e654-4577-4176-99d8-255613de2911";
const cart = [{ key: "test:1", slug: "test", variantLabel: "1 vial", quantity: 1 }];
const input: PlaceOrderInput = { email: "person@example.test", name: "Test Person", address: { line1: "1 Test St", suburb: "Test", state: "VIC", postcode: "3000" }, lines: cart, paymentMethod: "bank_transfer", shippingMethod: "standard", idempotencyKey: id, quoteVersion: "old" };
const resolved = { items: [{ variantId: id, qty: 1, expectedPriceCents:1000, legacyDiscountEligible:true }], extraItems: [], lines: [{ ...cart[0], name: "Test product", unitPriceCents: 1000, lineTotalCents: 1000, isGift: false }], subtotalCents: 1000, giftApplied: false, warnings: [] };
beforeEach(() => {
 vi.clearAllMocks(); vi.stubEnv("ORDER_ACCESS_SECRET", "test-only-secret-with-more-than-32-characters");vi.stubEnv('GA4_API_SECRET','test-secret');vi.stubEnv('NEXT_PUBLIC_GA4_ID','G-TEST123');vi.stubEnv('NEXT_PUBLIC_MEASUREMENT_CAMPAIGNS','launch_2026');vi.stubEnv('NEXT_PUBLIC_MEASUREMENT_EXPERIMENTS','offer-holdout:control|holdout');
 m.resolve.mockResolvedValue(resolved);m.applyGift.mockImplementation((cart)=>cart);m.replay.mockResolvedValue(null); m.recovered.mockResolvedValue(undefined);
 m.create.mockResolvedValue({ orderId: id, orderNumber: "ECL-1", totalCents: 2200, paymentReference: "ECL-1", paymentExpiresAt: "2026-09-10", replayed: false });
});
it("returns the changed authoritative quote without creating an order", async () => {
 const result = await placeOrder(input);
 expect(result.ok).toBe(false); expect(m.create).not.toHaveBeenCalled();
 if (!result.ok) expect(result.quote?.lines[0].lineTotalCents).toBe(1000);
});
it('normalizes legacy email and quotes only authoritative resolved lines',async()=>{
 m.discount.mockResolvedValue({ok:true,code:'ECLLEGACY',discountCents:200,allocations:[{lineIndex:0,discountCents:200}]});
 const quote=await quoteCart(cart,'ECLLEGACY','standard',' Original@Example.Test ');
 expect(m.discount).toHaveBeenCalledWith({code:'ECLLEGACY',email:'original@example.test',subtotalCents:1000,lines:[{lineIndex:0,variantId:id,qty:1,unitPriceCents:1000,legacyEligible:true,hasPriceOverride:false}]});
 expect(quote.discountCents).toBe(200);
 expect((await quoteCart(cart,'ECLLEGACY','standard','other@example.test')).version).not.toBe(quote.version);
 expect((await quoteCart(cart,'ECLLEGACY','standard','original@example.test')).version).toBe(quote.version);
 m.discount.mockResolvedValue({ok:false,discountCents:0,error:'Invalid code.'});
 expect((await quoteCart(cart,'ECLLEGACY','standard','original@example.test')).version).not.toBe(quote.version);
});
it('invalidates confirmation when the same total is allocated to different variants',async()=>{
 m.resolve.mockResolvedValue({...resolved,subtotalCents:2000,items:[...resolved.items,{...resolved.items[0],variantId:'second'}]});
 m.discount.mockResolvedValue({ok:true,code:'ECLLEGACY',discountCents:200,allocations:[{lineIndex:0,discountCents:200},{lineIndex:1,discountCents:0}]});
 const quote=await quoteCart(cart,'ECLLEGACY','standard',input.email);
 m.discount.mockResolvedValue({ok:true,code:'ECLLEGACY',discountCents:200,allocations:[{lineIndex:0,discountCents:0},{lineIndex:1,discountCents:200}]});
 const updated=await quoteCart(cart,'ECLLEGACY','standard',input.email);
 expect(updated.totalCents).toBe(quote.totalCents);
 expect(updated.version).not.toBe(quote.version);
});
it('keeps generic quote identity independent of email',async()=>{
 m.discount.mockResolvedValue({ok:true,code:'WELCOME',discountCents:100});
 expect((await quoteCart(cart,'WELCOME')).version).toBe((await quoteCart(cart,'WELCOME','standard',input.email)).version);
 expect(m.discount).toHaveBeenCalledWith(expect.objectContaining({subtotalCents:1000}));
});
it('refreshes legacy validation when the transaction disables the program',async()=>{
 m.discount.mockResolvedValue({ok:true,code:'ECLLEGACY',discountCents:200,allocations:[{lineIndex:0,discountCents:200}]});
 const quote=await quoteCart(cart,'ECLLEGACY','standard',input.email);
 m.create.mockImplementationOnce(async()=>{m.discount.mockResolvedValue({ok:false,discountCents:0,error:'Invalid code.'});throw new Error('Discount unavailable');});
 const result=await placeOrder({...input,discountCode:'ECLLEGACY',quoteVersion:quote.version});
 expect(result).toMatchObject({ok:false,quote:{discountCents:0,discountError:'Invalid code.'}});
 expect(m.create).toHaveBeenCalledWith(expect.objectContaining({items:resolved.items}));
});
it('fails closed when legacy validation is temporarily unavailable',async()=>{
 m.discount.mockRejectedValueOnce(new Error('RPC unavailable'));
 await expect(quoteCart(cart,'ECLLEGACY','standard',input.email)).rejects.toThrow('RPC unavailable');
 expect(m.create).not.toHaveBeenCalled();
});
it('rejects a missing server price instead of using browser line prices',async()=>{
 m.resolve.mockResolvedValue({...resolved,items:[{variantId:id,qty:1,legacyDiscountEligible:true}]});
 await expect(quoteCart(cart,'ECLLEGACY','standard',input.email)).rejects.toThrow('Missing authoritative item price');
});
it('uses post-legacy goods totals for shipping and gifts and retains final allocation identities',async()=>{
 const {applyGiftThreshold}=await vi.importActual<typeof import('@/lib/checkout')>('@/lib/checkout');
 m.applyGift.mockImplementation(applyGiftThreshold);
 const paid={...resolved.items[0],expectedPriceCents:15000};
 const second={...paid,variantId:'second'};
 const gift={variantId:'gift',qty:1,priceOverrideCents:0,labelSuffix:' · Free gift'};
 const paidLines=[{...resolved.lines[0],unitPriceCents:15000,lineTotalCents:15000},{...resolved.lines[0],key:'second',unitPriceCents:15000,lineTotalCents:15000}];
 const withGift={...resolved,subtotalCents:30000,giftApplied:true,items:[paid,gift,second],lines:[...paidLines,{...resolved.lines[0],key:'gift:water',isGift:true,unitPriceCents:0,lineTotalCents:0}]};
 m.resolve.mockResolvedValue(withGift);
 m.discount.mockResolvedValue({ok:true,code:'ECLLEGACY',discountCents:16000,allocations:[{lineIndex:0,discountCents:8000},{lineIndex:1,discountCents:0},{lineIndex:2,discountCents:8000}]});
 const quote=await quoteCart(cart,'ECLLEGACY','standard',input.email);
 expect(quote).toMatchObject({subtotalCents:30000,discountCents:16000,shippingCents:1200,totalCents:15200,giftApplied:false,lines:paidLines});
 await placeOrder({...input,discountCode:'ECLLEGACY',quoteVersion:quote.version});
 expect(m.create).toHaveBeenCalledWith(expect.objectContaining({items:[paid,second],expectedTotalCents:15200}));
 m.resolve.mockResolvedValue({...withGift,giftApplied:false,items:[paid,second],lines:paidLines,warnings:quote.warnings});
 m.discount.mockResolvedValue({ok:true,code:'ECLLEGACY',discountCents:16000,allocations:[{lineIndex:0,discountCents:8000},{lineIndex:1,discountCents:8000}]});
 expect((await quoteCart(cart,'ECLLEGACY','standard',input.email)).version).toBe(quote.version);
});
it("commits a reviewed quote with an atomic expiry and a secure payment URL", async () => {
 const quote = await quoteCart(cart);
 const result = await placeOrder({ ...input, quoteVersion: quote.version });
 expect(result.ok).toBe(true);
 expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: id, expectedTotalCents: 2200, paymentExpiryHours: 48, requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) }));
 if (result.ok) expect(result.paymentUrl).toMatch(/\/pay\/.*\?token=v1\./);
});
it("retrieves an identical committed attempt before rechecking changed stock", async () => {
 m.replay.mockResolvedValue({ orderId: id, orderNumber: "ECL-1", totalCents: 2200, replayed: true });
 const result = await placeOrder(input);
 expect(result.ok).toBe(true); expect(m.resolve).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
});
it("rejects non-Australian/invalid state and invalid request identities before any lookup", async () => {
 for (const bad of [{ ...input, idempotencyKey: "" }, { ...input, address: { ...input.address, state: "XX" } }, { ...input, address: { ...input.address, country: "US" } }]) {
  expect((await placeOrder(bad)).ok).toBe(false);
 }
 expect(m.replay).not.toHaveBeenCalled(); expect(m.resolve).not.toHaveBeenCalled();
});

it('returns validation errors for hostile runtime optional field types',async()=>{
 for(const change of [{address:{...input.address,country:42}},{address:{...input.address,line2:0}},{discountCode:0},{deliveryInstructions:false},{recoveryEpisodeId:{}}]) {
  const result=await placeOrder({...input,...change} as unknown as PlaceOrderInput);
  expect(result.ok).toBe(false);
 }
 expect(m.replay).not.toHaveBeenCalled();
});
it('provides a fresh reviewable quote after the transactional price check races',async()=>{
 const quote=await quoteCart(cart);m.create.mockRejectedValueOnce(new Error('QUOTE_CHANGED'));
 const result=await placeOrder({...input,quoteVersion:quote.version});
 expect(result.ok).toBe(false);if(!result.ok)expect(result.quote?.version).toBeTruthy();
});
it('uses the post-discount gift decision in the quote and order payload',async()=>{
 const withGift={...resolved,giftApplied:true,lines:[...resolved.lines,{...resolved.lines[0],key:'gift:bac',slug:'bacteriostatic-water',name:'Water',unitPriceCents:0,lineTotalCents:0,isGift:true}],items:[...resolved.items,{variantId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',qty:1,priceOverrideCents:0,labelSuffix:' · Free gift'}]};
 const withoutGift={...withGift,giftApplied:false,lines:resolved.lines,items:resolved.items,warnings:['Free gift removed']};
 m.resolve.mockResolvedValue(withGift);m.discount.mockResolvedValue({ok:true,discountCents:500});m.applyGift.mockReturnValue(withoutGift);
 const quote=await quoteCart(cart,'WELCOME');expect(quote).toMatchObject({giftApplied:false,warnings:['Free gift removed'],lines:resolved.lines});
 await placeOrder({...input,discountCode:'WELCOME',quoteVersion:quote.version});expect(m.create.mock.calls[0][0].items).toEqual(resolved.items);
});

it('checks an uncertain attempt without resolving or placing another order',async()=>{
 const fingerprint='a'.repeat(64);
 m.replay.mockResolvedValue({orderId:id,orderNumber:'ECL-1',totalCents:2200,replayed:true,purchasedLines:resolved.lines});
 const result=await recoverCheckoutAttempt(id,fingerprint);
 expect(result.ok).toBe(true);expect(m.replay).toHaveBeenCalledWith(id,fingerprint);
 expect(m.resolve).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled();
 if(result.ok)expect(result.purchasedLines).toEqual(resolved.lines);
});
it('does not expose a receipt for missing or invalid recovery credentials',async()=>{
 expect((await recoverCheckoutAttempt(id,'bad')).ok).toBe(false);expect(m.replay).not.toHaveBeenCalled();
 const result=await recoverCheckoutAttempt(id,'b'.repeat(64));
 expect(result).toMatchObject({ok:false,notFound:true});expect(m.create).not.toHaveBeenCalled();
});

it('returns named field errors for all invalid checkout details',async()=>{
 const r=await placeOrder({...input,email:'bad',name:'',address:{line1:'',suburb:'',state:'XX',postcode:'x'}});
 expect(r).toMatchObject({ok:false,fieldErrors:{email:expect.any(String),name:expect.any(String),street:expect.any(String),suburb:expect.any(String),state:expect.any(String),postcode:expect.any(String)}});
 expect(m.create).not.toHaveBeenCalled();
});
it('persists validated consented first-party acquisition and experiment assignment on the created order',async()=>{
 const measurement=encodeURIComponent(JSON.stringify({acquisition:{source:'google',medium:'cpc',campaign:'launch_2026',landingPath:'/product/bpc-157'},experiments:[{experimentId:'offer-holdout',variant:'holdout'}]}));
 m.cookieGet.mockImplementation((name:string)=>({ecl_analytics_consent:{value:'granted'},ecl_measurement:{value:measurement},_ga:{value:'GA1.1.123456.789012'}} as Record<string,{value:string}>)[name]);
 const quote=await quoteCart(cart);await placeOrder({...input,quoteVersion:quote.version});
 expect(m.create).toHaveBeenCalledWith(expect.objectContaining({analyticsClientId:'123456.789012',orderAttribution:{acquisition:{source:'google',medium:'cpc',campaign:'launch_2026',landingPath:'/product/bpc-157'},experiments:[{experimentId:'offer-holdout',variant:'holdout'}]}}));
});
it.each(['denied',undefined])('does not persist measurement when analytics consent is %s',async(consent)=>{
 const measurement=encodeURIComponent(JSON.stringify({acquisition:{source:'google',landingPath:'/shop'},experiments:[]}));
 m.cookieGet.mockImplementation((name:string)=>name==='ecl_analytics_consent'&&consent?{value:consent}:name==='ecl_measurement'?{value:measurement}:name==='_ga'?{value:'GA1.1.123456.789012'}:undefined);
 const quote=await quoteCart(cart);await placeOrder({...input,quoteVersion:quote.version});
 expect(m.create).toHaveBeenCalledWith(expect.objectContaining({analyticsClientId:undefined,orderAttribution:undefined}));
});
