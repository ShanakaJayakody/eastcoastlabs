/**
 * Admin session refresh + first-gate redirect.
 *
 * IMPORTANT (see ISA FirstPrinciples note): this middleware is UX, not the
 * security boundary. It only checks whether a Supabase session cookie is present
 * and refreshes it. The authoritative check — session AND email on the
 * admin_users allow-list — happens server-side in the (dashboard) layout and in
 * every server action, at the point where the service-role key is actually used.
 *
 * Scoped to /admin/* only, so the public storefront is untouched.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {isReadOnlyPreview,PREVIEW_READ_ONLY_MESSAGE} from "./lib/admin/preview-policy";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function middleware(request: NextRequest) {
  const path=request.nextUrl.pathname;
  const isAdmin=path==='/admin'||path.startsWith('/admin/');
  const staticAsset=/^\/(?:_next\/(?:static|image)|fonts|brand|images)\//.test(path)||path==='/favicon.ico';
  if(isReadOnlyPreview()&&!isAdmin&&!staticAsset) {
    if(path==='/'&&['GET','HEAD'].includes(request.method)) return NextResponse.redirect(new URL('/admin',request.url));
    return new NextResponse(PREVIEW_READ_ONLY_MESSAGE,{status:403,headers:{
      'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer',
    }});
  }
  if(!isAdmin) return NextResponse.next();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, ANON, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";
  const isAuthCallback = pathname === "/admin/auth/callback";

  // Unauthenticated hitting a protected admin route → login.
  if (!user && !isLogin && !isAuthCallback) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Keep the login page reachable for an existing session so a signed-in user
  // can deliberately switch to a different admin account.

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
