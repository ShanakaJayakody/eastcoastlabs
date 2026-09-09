import type {Metadata} from 'next';
import {CartProvider} from '@/lib/cart-context';
import CartRecoveryRestore from '@/components/CartRecoveryRestore';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Restore your cart',robots:{index:false,follow:false},referrer:'no-referrer'};
/** Standalone private route: no analytics, exit-intent capture or marketing shell. GET has no consent effects. */
export default async function CartRecoveryPage({searchParams}:{searchParams:Promise<{token?:string}>}) {
 const {token}=await searchParams;const valid=typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token);
 return <main className="mx-auto max-w-xl px-5 py-16"><h1 className="text-2xl font-bold">Restore your cart</h1>{valid?<CartProvider><CartRecoveryRestore token={token}/></CartProvider>:<p className="mt-5">This link is invalid. Request a new cart link at checkout.</p>}</main>;
}
