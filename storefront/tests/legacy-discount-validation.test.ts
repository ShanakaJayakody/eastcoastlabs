import {beforeEach,expect,it,vi} from 'vitest';
const db=vi.hoisted(()=>({row:{} as Record<string,unknown>,rpc:vi.fn()}));
vi.mock('@/lib/admin/db',()=>({adminDb:()=>({from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:db.row,error:null})};return q;},rpc:db.rpc})}));
import {validateDiscount} from '@/lib/admin/discounts';
const lines=[{lineIndex:0,variantId:'variant',qty:2,unitPriceCents:1000,legacyEligible:true,hasPriceOverride:false}];
beforeEach(()=>{vi.resetAllMocks();db.row={active:true,kind:'legacy_price',min_spend_cents:0,used_count:0};});
it('requires email without consulting private eligibility',async()=>{
 expect(await validateDiscount({code:'ECLLEGACY',subtotalCents:2000,lines})).toEqual({ok:false,discountCents:0,error:'Enter the email used for your previous East Coast Labs order.'});
 expect(db.rpc).not.toHaveBeenCalled();
});
it.each([0,400])('returns authoritative ordered allocations, including zero savings (%i)',async(discountCents)=>{
 db.rpc.mockResolvedValue({data:{ok:true,code:'ECLLEGACY',discountCents,allocations:[{lineIndex:0,discountCents}]},error:null});
 expect(await validateDiscount({code:' ecllegacy ',email:' ORIGINAL@Example.Test ',subtotalCents:2000,lines})).toEqual({ok:true,code:'ECLLEGACY',discountCents,allocations:[{lineIndex:0,discountCents}]});
 expect(db.rpc).toHaveBeenCalledWith('commerce_legacy_discount_quote',{p_code:'ECLLEGACY',p_email:'original@example.test',p_lines:lines});
});
it.each([['email_ineligible','Use the email from your previous East Coast Labs order.'],['no_eligible_items','ECLLEGACY does not apply to the products in this cart.'],['invalid_code','Invalid code.']])('maps %s without leaking RPC details',async(reason,error)=>{
 db.rpc.mockResolvedValue({data:{ok:false,reason},error:null});
 expect(await validateDiscount({code:'ECLLEGACY',email:'a@example.test',subtotalCents:2000,lines})).toEqual({ok:false,discountCents:0,error});
});
it('fails closed on RPC errors',async()=>{
 db.rpc.mockResolvedValue({data:null,error:{message:'offline'}});
 await expect(validateDiscount({code:'ECLLEGACY',email:'a@example.test',subtotalCents:2000,lines})).rejects.toThrow();
});
it.each([['percent',15,null,300],['fixed',null,500,500],['fixed',null,3000,2000]])('preserves %s calculation',async(kind,percent,value_cents,discountCents)=>{
 db.row={...db.row,kind,percent,value_cents};
 expect(await validateDiscount({code:' welcome ',subtotalCents:2000,lines})).toEqual({ok:true,code:'WELCOME',discountCents});
 expect(db.rpc).not.toHaveBeenCalled();
});
