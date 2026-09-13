"use client";
import {useEffect,useState} from "react";
import {analyticsConsent,setAnalyticsConsent,type AnalyticsConsent} from "@/lib/attribution";

/** Reusable on the initial choice banner and privacy page so consent can be
 * changed or withdrawn without loading a third-party script first. */
export default function AnalyticsConsentControls({compact=false,showStatus=true}:{compact?:boolean;showStatus?:boolean}){
  const [choice,setChoice]=useState<AnalyticsConsent|null>(null);
  useEffect(()=>setChoice(analyticsConsent()),[]);
  const choose=(value:AnalyticsConsent)=>{setAnalyticsConsent(value);setChoice(value);};
  return <div className={compact?"space-y-2":"mt-3"}>
    {showStatus&&<p role="status" className="text-sm text-fg-2">Analytics is {choice==="granted"?"allowed":choice==="denied"?"declined":"not chosen"}.</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>choose("granted")} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Allow analytics</button>
      <button type="button" onClick={()=>choose("denied")} className="rounded-lg border border-line-2 px-4 py-2 text-sm font-semibold text-fg">Decline analytics</button>
    </div>
  </div>;
}
