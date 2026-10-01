'use client';
import {ORDER_COLUMNS} from '@/lib/admin/order-workspace/params';
import {COLUMN_LABELS} from '@/lib/admin/order-workspace/presentation';
import type {OrderColumn} from '@/lib/admin/order-workspace/types';
export default function OrderColumnsControl({columns,onChange,onReset}:{columns:OrderColumn[];onChange:(c:OrderColumn[])=>void;onReset:()=>void}){
 function move(index:number,delta:number){const next=[...columns];[next[index],next[index+delta]]=[next[index+delta],next[index]];onChange(next);}
 return <details className="ow-disclosure"><summary>Columns</summary><div className="ow-panel">
  {([...columns,...ORDER_COLUMNS.filter(c=>!columns.includes(c))]).map(c=>{const i=columns.indexOf(c);return <div className="ow-column-choice" key={c}>
   <label><input type="checkbox" checked={i>=0} disabled={c==='identity'||(i>=0&&columns.length===2)} onChange={()=>onChange(i>=0?columns.filter(x=>x!==c):[...columns,c])}/>{COLUMN_LABELS[c]}</label>
   {i>0&&<><button type="button" aria-label={`Move ${COLUMN_LABELS[c]} up`} disabled={i===1} onClick={()=>move(i,-1)}>↑</button><button type="button" aria-label={`Move ${COLUMN_LABELS[c]} down`} disabled={i===columns.length-1} onClick={()=>move(i,1)}>↓</button></>}
  </div>;})}<button type="button" onClick={onReset}>Reset columns</button>
 </div></details>;
}
