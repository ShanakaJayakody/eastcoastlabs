import { NextResponse, after } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (typeof body?.email !== "string" || typeof body?.source !== "string") return NextResponse.json({ ok:false,error:"invalid_request" },{status:400});
    const email=body.email.trim().toLowerCase(), source=body.source;
    if (email.length>254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || source.length>140) return NextResponse.json({ok:false,error:"invalid_email"},{status:400});
    const sb=supabaseAdmin();
    if (!sb) return NextResponse.json({ok:false,error:"temporarily_unavailable"},{status:503});
    if (source.startsWith("back_in_stock:")) {
      const slug=source.slice(14);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ok:false,error:"invalid_product"},{status:400});
      const {data:product,error:readError}=await sb.from("products").select("id").eq("slug",slug).in("status",["active","coming_soon"]).maybeSingle();
      if(readError)throw new Error(readError.message);
      if(!product)return NextResponse.json({ok:false,error:"invalid_product"},{status:400});
      const {error}=await sb.from("stock_notifications").upsert({email,product_slug:slug,notified:false},{onConflict:"email,product_slug"});
      if(error)throw new Error(error.message);
      return NextResponse.json({ok:true,message:"Your notification request is saved."});
    }
    if(!["footer","exit_intent","newsletter"].includes(source))return NextResponse.json({ok:false,error:"invalid_source"},{status:400});
    const token=randomBytes(32).toString("base64url");
    const {data:rowId,error}=await sb.rpc("request_subscription",{
      p_email:email,p_source:source,p_hash:createHash("sha256").update(token).digest("hex"),
      p_url:`https://www.eastcoastlabs.com.au/subscribe/confirm?token=${token}`,
    });
    if(error)throw new Error(error.message);
    if(rowId)after(async()=>{
      const {sendImmediately}=await import("@/lib/email/sender");
      await sendImmediately(rowId).catch(()=>console.error("Subscription confirmation awaits outbox retry"));
    });
    return NextResponse.json({ok:true,message:"Check your email to confirm your subscription."});
  } catch {
    // Never log the submitted email or request body.
    console.error("Subscription request failed");
    return NextResponse.json({ok:false,error:"server_error"},{status:500});
  }
}
