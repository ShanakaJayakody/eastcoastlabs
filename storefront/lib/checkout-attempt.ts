/** Tab-scoped recovery credential. Never persist the raw checkout request. */
export interface StoredCheckoutAttempt { id:string;hash:string }
const KEY='ecl_checkout_attempt';
export function readCheckoutAttempt():StoredCheckoutAttempt|null {
 try {
  const value=JSON.parse(sessionStorage.getItem(KEY)??'null');
  return value && /^[a-f0-9-]{36}$/i.test(value.id) && /^[a-f0-9]{64}$/.test(value.hash)
   ? {id:value.id,hash:value.hash}:null;
 } catch {return null;}
}
export function saveCheckoutAttempt(value:StoredCheckoutAttempt) {
 try {sessionStorage.setItem(KEY,JSON.stringify(value));} catch { /* In-memory attempt still supports retries. */ }
}
export function clearCheckoutAttempt() {try {sessionStorage.removeItem(KEY);} catch { /* Storage may be unavailable. */ }}
export async function checkoutRequestHash(request:string):Promise<string|null> {
 try {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(request))),b=>b.toString(16).padStart(2,'0')).join('');}
 catch {return null;}
}
