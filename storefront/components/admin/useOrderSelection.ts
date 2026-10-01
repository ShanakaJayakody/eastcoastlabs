'use client';
import {useRef,useState} from 'react';
import type {OrderWorkspaceRow} from '@/lib/admin/order-workspace/types';
export function useOrderSelection(rows:OrderWorkspaceRow[],scopeKey:string){
 const [state,setState]=useState({scope:scopeKey,ids:new Set<string>()});
 const visible=new Set(rows.map(r=>r.id));
 const selectedIds=state.scope===scopeKey?new Set([...state.ids].filter(id=>visible.has(id))):new Set<string>();
 if(state.scope!==scopeKey||selectedIds.size!==state.ids.size)setState({scope:scopeKey,ids:selectedIds});
 const current=useRef({scopeKey,visible});current.current={scopeKey,visible};
 const set=(ids:Set<string>)=>setState({scope:scopeKey,ids});
 return {
  selectedIds,
  toggle:(id:string)=>{if(visible.has(id))set(new Set(selectedIds.has(id)?[...selectedIds].filter(x=>x!==id):[...selectedIds,id]));},
  togglePage:()=>set(selectedIds.size===rows.length?new Set():visible),
  clear:()=>set(new Set()),
  retainFailures:(failures:{id:string;error:string}[])=>{if(current.current.scopeKey===scopeKey)set(new Set(failures.filter(f=>current.current.visible.has(f.id)).map(f=>f.id)));},
 };
}
export type OrderSelection=ReturnType<typeof useOrderSelection>;
