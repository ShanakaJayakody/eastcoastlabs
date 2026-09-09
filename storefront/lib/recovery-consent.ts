import 'server-only';
import {cookies} from 'next/headers';
import {adminDb} from './admin/db';
import {recoveryTokenHash} from './recovery-token';
import {normalizeCheckoutLines} from './checkout-lines';
import type {ClientCartLine} from './checkout';
export const RECOVERY_COOKIE='ecl_cart_recovery';
/** A caller-supplied episode ID cannot grant attribution. The cookie is issued
 * only by an explicit mailbox-confirmed restore and SQL checks the exact cart. */
export async function verifiedRecoveryEpisode(email:string,lines:ClientCartLine[]):Promise<string|undefined> {
 const token=(await cookies()).get(RECOVERY_COOKIE)?.value;
 const hash=recoveryTokenHash(token);if(!hash)return undefined;
 const {data,error}=await adminDb().rpc('recovery_attribution',{p_hash:hash,p_email:email,p_cart:normalizeCheckoutLines(lines)});
 if(error)throw new Error('Recovery attribution unavailable');
 return typeof data==='string'?data:undefined;
}
