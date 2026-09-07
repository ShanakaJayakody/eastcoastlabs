import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";

export const metadata: Metadata = { title:"Confirm subscription",robots:{index:false,follow:false} };
export const dynamic="force-dynamic";
async function confirm(formData:FormData) {
 "use server";
 const token=formData.get("token");
 if(typeof token!=="string"||!/^[\w-]{43}$/.test(token))redirect("/subscribe/confirm?result=invalid");
 const db=supabaseAdmin();
 if(!db)redirect("/subscribe/confirm?result=error");
 const {data,error}=await db.rpc("confirm_subscription",{p_hash:createHash("sha256").update(token).digest("hex")});
 if(error)redirect("/subscribe/confirm?result=error");
 redirect(`/subscribe/confirm?result=${data?"confirmed":"invalid"}`);
}
export default async function ConfirmSubscription({searchParams}:{searchParams:Promise<{token?:string;result?:string}>}) {
 const {token,result}=await searchParams;
 const valid=typeof token==="string"&&/^[\w-]{43}$/.test(token);
 return <div className="mx-auto max-w-lg px-4 py-16">
  <h1 className="text-2xl font-bold">{result==="confirmed"?"Subscription confirmed":"Confirm your subscription"}</h1>
  <p className="mt-4 text-muted">{result==="confirmed"?"You’ll receive East Coast Labs email updates. You can unsubscribe from any marketing email.":result==="error"?"We couldn’t save your preference. Please reopen your email link and try again.":!valid?"This link has expired or has already been used. Request a new subscription email from the site footer.":"Confirm below to receive East Coast Labs email updates."}</p>
  {valid&&<form action={confirm} className="mt-6"><input type="hidden" name="token" value={token}/><button className="rounded-lg bg-accent px-5 py-3 font-semibold text-accent-ink">Confirm subscription</button></form>}
 </div>;
}
