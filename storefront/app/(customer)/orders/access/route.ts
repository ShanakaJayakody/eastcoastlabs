import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { customerOrdersEnabled } from '@/lib/customer-orders/flags';
import { createOrderCookie, orderCookieName, verifyOrderViewToken } from '@/lib/customer-orders/tokens';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, url.origin), 303);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return response;
  };
  const unavailable = () => redirect('/account/sign-in?link=unavailable');
  if (!customerOrdersEnabled()) return unavailable();
  const grant = verifyOrderViewToken(url.searchParams.get('token') ?? undefined);
  if (!grant) return unavailable();
  const db = supabaseAdmin();
  if (!db) return unavailable();
  const { data, error } = await db.from('orders').select('id,order_access_version')
    .eq('id', grant.orderId).eq('order_access_version', grant.version).maybeSingle();
  if (error || !data || data.id !== grant.orderId || data.order_access_version !== grant.version) return unavailable();
  const response = redirect(`/orders/${grant.orderId}`);
  response.cookies.set(orderCookieName(grant.orderId), createOrderCookie(grant), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: `/orders/${grant.orderId}`, maxAge: Math.min(86400, grant.expiresAt - Math.floor(Date.now() / 1000)),
  });
  return response;
}
