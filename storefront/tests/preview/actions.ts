import type {CartQuote,PlaceOrderInput} from '../../app/(store)/checkout/actions';
import type {ClientCartLine} from '../../lib/checkout';
import type {ShippingMethod} from '../../lib/shipping';
export type QuoteMode='normal'|'failure'|'delayed'|'higher-price';
let mode:QuoteMode='normal';
let submission=0;
export function setQuoteMode(next:QuoteMode){mode=next;}
export async function quoteCart(lines:ClientCartLine[],discountCode?:string,shippingMethod:ShippingMethod='standard'):Promise<CartQuote>{
 const requestedMode=mode;
 if(requestedMode==='delayed') await new Promise(resolve=>setTimeout(resolve,20000));
 if(requestedMode==='failure') throw new Error('Synthetic quote failure');
 const quotedLines=lines.filter(l=>!l.key.startsWith('gift:')).map(line=>{
  const pack=line.variantLabel.startsWith('3')?3:line.variantLabel.startsWith('6')?6:1;
  const unitPriceCents=(pack===3?12000:pack===6?21600:4500)+(requestedMode==='higher-price'?1000:0);
  return {...line,name:'Synthetic Research Compound',unitPriceCents,lineTotalCents:unitPriceCents*line.quantity,isGift:false};
 });
 const subtotalCents=quotedLines.reduce((sum,l)=>sum+l.lineTotalCents,0);
 const shippingOptions=([
 {method:'standard',label:'Standard shipping',baseCents:1000,eta:'2–5 business days'},
 {method:'express',label:'Express shipping',baseCents:1800,eta:'1–2 business days'},
 ] as const).map(o=>({...o,cents:o.baseCents,freeThresholdCents:15000,isFree:false,remainingCents:Math.max(0,15000-subtotalCents)}));
 const shippingCents=shippingMethod==='express'?1800:1000;
 return {lines:quotedLines,version:JSON.stringify([quotedLines,shippingMethod,discountCode]),subtotalCents,discountCents:0,shippingCents,shippingMethod,shippingOptions,totalCents:subtotalCents+shippingCents,giftApplied:false,discountError:discountCode?'Synthetic code not valid. Clear it to continue.':undefined,warnings:[],paymentOptions:[{method:'bank_transfer',label:'Bank Transfer',blurb:'Synthetic preview only. No transfer or order is created.',badges:['Fixture']} ]};
}
export async function placeOrder(_input:PlaceOrderInput){
 if(_input.email==='field-error@example.test')return {ok:false as const,error:'Synthetic field validation.',fieldErrors:{email:'Synthetic email needs correction.',postcode:'Synthetic postcode needs correction.'}};
 submission++;
 return {ok:false as const,error:`Synthetic submit ${submission}: no order was created. Your entered details remain available.`};
}

export async function recoverCheckoutAttempt(_id:string,_hash:string){return {ok:false as const,notFound:true as const,error:'Synthetic preview: no previous order exists.'};}
