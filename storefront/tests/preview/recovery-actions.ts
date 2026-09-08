import type {ClientCartLine} from '../../lib/checkout';
import type {CartRestoreResult} from '../../app/cart-recovery/actions';
export async function requestCartRecovery(_email:string,_lines:ClientCartLine[],agreed:boolean){return {ok:agreed,message:agreed?'Synthetic confirmation queued. No email was sent.':'Choose the cart option first.'};}
export async function confirmCartRecovery(_token:string):Promise<CartRestoreResult>{return {ok:true,lines:[{key:'restored:1',productId:900001,slug:'synthetic-compound',name:'Synthetic restored cart',variantId:'00000000-0000-0000-0000-000000000001',variantLabel:'1 vial',unitPrice:45,quantity:2}],warnings:[]};}
