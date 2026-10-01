import { redirect } from 'next/navigation';
import { customerAccountsEnabled } from '@/lib/customer-orders/flags';
import { getCustomerSession } from '@/lib/customer-auth/server';
import { safeCustomerReturnPath } from '@/lib/customer-auth/return-path';
import SignInForm from '@/components/customer-orders/SignInForm';
export const metadata = { title: 'Sign in to your orders' };
export default async function CustomerSignIn({ searchParams }: { searchParams: Promise<{ returnTo?: string; link?: string }> }) {
  const query = await searchParams;
  const returnTo = safeCustomerReturnPath(query.returnTo);
  const enabled = customerAccountsEnabled();
  if (enabled && await getCustomerSession()) redirect(query.link ? '/account/orders' : returnTo);
  return <section className="co-card co-signin"><p className="co-eyebrow">Your East Coast Labs account</p><h1>Your orders, made simple</h1>
    {query.link && <p role="status">This link is unavailable or has expired. Sign in with your checkout email to find your orders, or contact us for help.</p>}
    {enabled ? <><p>Review purchases, follow dispatch updates and find your delivery details.</p><SignInForm returnTo={returnTo} /></> : <p>Customer sign-in is currently unavailable. Please contact us using the details below for help with your order.</p>}
  </section>;
}
