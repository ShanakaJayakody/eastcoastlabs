"use client";
import {useEffect,useRef,type RefObject} from 'react';
/** Keeps keyboard and pointer interaction inside the visible modal, including
 * dialogs rendered inside the application tree rather than in a portal. */
export function useDialogFocus(open:boolean,ref:RefObject<HTMLElement|null>,onClose:()=>void,pending=false){
 const latest=useRef({onClose,pending});
 latest.current={onClose,pending};
 useEffect(()=>{
  if(!open || !ref.current) return;
  const dialog=ref.current;
  const previous=document.activeElement as HTMLElement|null;
  const inerted: {element:HTMLElement;value:boolean}[]=[];
  let node:HTMLElement|null=dialog;
  while(node?.parentElement){
   for(const sibling of Array.from(node.parentElement.children)){
    if(sibling!==node && sibling instanceof HTMLElement){inerted.push({element:sibling,value:sibling.inert});sibling.inert=true;}
   }
   node=node.parentElement;
   if(node===document.body) break;
  }
  const focusable=()=>Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'));
  (dialog.querySelector<HTMLElement>("[data-dialog-initial]") ?? focusable()[0] ?? dialog).focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!latest.current.pending)latest.current.onClose();}
   if(event.key==='Tab'){
    const items=focusable();const first=items[0];const last=items.at(-1);
    if(!first){event.preventDefault();dialog.focus();}
    else if(event.shiftKey && (document.activeElement===first || !dialog.contains(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && (document.activeElement===last || !dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
   }
  };
  const focus=(event:FocusEvent)=>{if(!dialog.contains(event.target as Node)) (focusable()[0] ?? dialog).focus();};
  document.addEventListener('keydown',key,true);document.addEventListener('focusin',focus,true);
  return ()=>{document.removeEventListener('keydown',key,true);document.removeEventListener('focusin',focus,true);for(const {element,value} of inerted)element.inert=value;previous?.focus();};
 },[open,ref]);
}
