import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/recovery-consent",()=>({verifiedRecoveryEpisode:async()=>undefined}));
vi.mock("next/server", () => ({ after: vi.fn() }));
const m = vi.hoisted(() => ({ resolve: vi.fn(), create: vi.fn(), replay: vi.fn(), recovered: vi.fn(), discount: vi.fn() }));
vi.mock("@/lib/checkout", () => ({ resolveCart: m.resolve }));
vi.mock("@/lib/admin/orders", () => ({ createOrder: m.create, findCheckoutReplay: m.replay, setOrderPaymentPlan: vi.fn() }));
vi.mock("@/lib/admin/cart-recovery", () => ({ markCartRecovered: m.recovered, captureCart: vi.fn() }));
vi.mock("@/lib/admin/discounts", () => ({ validateDiscount: m.discount }));
vi.mock("@/lib/admin/email", () => ({ queueEmail: vi.fn() }));
vi.mock("@/lib/settings", () => ({ getSettings: async () => ({ freeShippingThreshold: 150, giftThreshold: 250, payidEnabled: false, bankTransferEnabled: true, bankBsb: "123456", bankAccountNumber: "12345678", standardShippingCents: 1200, expressShippingEnabled: false, paymentExpiryHours: 48 }) }));
import { placeOrder, quoteCart, recoverCheckoutAttempt, type PlaceOrderInput } from "@/app/(store)/checkout/actions";
const id = "31a1e654-4577-4176-99d8-255613de2911";
const cart = [{ key: "test:1", slug: "test", variantLabel: "1 vial", quantity: 1 }];
const input: PlaceOrderInput = { email: "person@example.test", name: "Test Person", address: { line1: "1 Test St", suburb: "Test", state: "VIC", postcode: "3000" }, lines: cart, paymentMethod: "bank_transfer", shippingMethod: "standard", idempotencyKey: id, quoteVersion: "old" };
const resolved = { items: [{ variantId: id, qty: 1 }], extraItems: [], lines: [{ ...cart[0], name: "Test product", unitPriceCents: 1000, lineTotalCents: 1000, isGift: false }], subtotalCents: 1000, giftApplied: false, warnings: [] };
beforeEach(() => {
 vi.clearAllMocks(); vi.stubEnv("ORDER_ACCESS_SECRET", "test-only-secret-with-more-than-32-characters");
 m.resolve.mockResolvedValue(resolved); m.replay.mockResolvedValue(null); m.recovered.mockResolvedValue(undefined);
 m.create.mockResolvedValue({ orderId: id, orderNumber: "ECL-1", totalCents: 2200, paymentReference: "ECL-1", paymentExpiresAt: "2026-09-10", replayed: false });
});
it("returns the changed authoritative quote without creating an order", async () => {
 const result = await placeOrder(input);
 expect(result.ok).toBe(false); expect(m.create).not.toHaveBeenCalled();
 if (!result.ok) expect(result.quote?.lines[0].lineTotalCents).toBe(1000);
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
