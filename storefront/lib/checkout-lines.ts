import type {ClientCartLine} from './checkout';
export function normalizeCheckoutLines(lines:ClientCartLine[]):ClientCartLine[] {
 return lines.map(({key,slug,variantLabel,quantity,variantId})=>({key,slug,variantLabel,quantity,...(variantId!==undefined?{variantId}:{})}));
}
export function validCheckoutLines(lines:unknown):lines is ClientCartLine[] {
 const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 return Array.isArray(lines)&&lines.length>0&&lines.length<=50&&lines.every(l=>l&&text(l.key,160)&&text(l.slug,120)&&/^[a-z0-9-]+$/.test(l.slug)&&text(l.variantLabel,160)
  &&(l.variantId===undefined||(typeof l.variantId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(l.variantId)))
  &&Number.isInteger(l.quantity)&&l.quantity>=1&&l.quantity<=99)&&new Set(lines.map(l=>l.key)).size===lines.length;
}
