"use client";
import { useEffect, useRef, type ReactNode } from 'react';
let locks = 0;
let previousOverflow = '';
const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';
export default function Modal({open,onClose,label,children,className=''}:{open:boolean;onClose:()=>void;label:string;children:ReactNode;className?:string}) {
  const panel=useRef<HTMLDivElement>(null);
  const close=useRef(onClose); close.current=onClose;
  useEffect(()=>{
    if(!open) return;
    const previous=document.activeElement as HTMLElement | null;
    if(locks++===0){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
    const nodes=()=>Array.from(panel.current?.querySelectorAll<HTMLElement>(focusable) ?? []).filter(el=>!el.closest('[inert]'));
    (nodes()[0] ?? panel.current)?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();close.current();}
      if(event.key==='Tab'){
        const list=nodes(),first=list[0],last=list[list.length-1];
        if(!first){event.preventDefault();panel.current?.focus();return;}
        if(event.shiftKey && (document.activeElement===first || !panel.current?.contains(document.activeElement))){event.preventDefault();last.focus();}
        else if(!event.shiftKey && (document.activeElement===last || !panel.current?.contains(document.activeElement))){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',key);
    return ()=>{document.removeEventListener('keydown',key);if(--locks===0)document.body.style.overflow=previousOverflow;previous?.focus();};
  },[open]);
  if(!open)return null;
  return <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div aria-hidden="true" className="absolute inset-0 bg-black/70" onClick={onClose}/>
    <div ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={`${className.includes("absolute") ? "" : "relative"} max-h-[100dvh] overflow-y-auto ${className}`}>{children}</div>
  </div>;
}
