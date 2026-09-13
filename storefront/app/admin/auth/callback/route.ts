import { NextResponse } from "next/server";
import { exchangeMagicLinkCode } from "@/app/admin/login/actions";

const loginErrorUrl = (origin: string) => {
  const url = new URL("/admin/login", origin);
  url.searchParams.set("error", "The sign-in link is invalid or has expired. Request a new link.");
  return url;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) return NextResponse.redirect(loginErrorUrl(url.origin), 303);

  const result = await exchangeMagicLinkCode(code);
  if (!result.ok) return NextResponse.redirect(loginErrorUrl(url.origin), 303);

  return NextResponse.redirect(new URL("/admin", url.origin), 303);
}
