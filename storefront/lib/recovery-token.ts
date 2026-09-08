import 'server-only';
import {createHash,createHmac} from 'node:crypto';
const SITE='https://www.eastcoastlabs.com.au';
/** Opaque bearer value reconstructed only at private email rendering. */
export function recoveryToken(requestId:string):string {
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(requestId))throw new Error('Invalid recovery identity');
 const secret=process.env.ORDER_ACCESS_SECRET??process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret||secret.length<32)throw new Error('Recovery signing key is not configured');
 return createHmac('sha256',secret).update(`ecl-cart-recovery:v1:${requestId}`).digest('base64url');
}
export function recoveryTokenHash(token:unknown):string|null {
 return typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token) ? createHash('sha256').update(token).digest('hex') : null;
}
export function recoveryLink(requestId:string):string {return `${SITE}/cart-recovery?token=${recoveryToken(requestId)}`;}
