'use client';
import {useState} from 'react';
import type {OrderPreferences,OrderWorkspaceParams,StoredOrderView} from '@/lib/admin/order-workspace/types';
import {saveOrderView} from '@/lib/admin/order-workspace/preferences';
import ConfirmModal from './ConfirmModal';
interface Props {current:OrderWorkspaceParams;preferences:OrderPreferences;onPreferencesChange:(p:OrderPreferences)=>void;onApply:(v:StoredOrderView)=>void;}
export default function SavedOrderViews({current,preferences,onPreferencesChange,onApply}:Props){
 const [selected,setSelected]=useState(''),[editing,setEditing]=useState<'new'|'rename'|null>(null),[name,setName]=useState(''),[error,setError]=useState(''),[deleting,setDeleting]=useState(false);
 const view=preferences.views.find(v=>v.id===selected);
 return <div className="ow-saved">
  <label className="sr-only" htmlFor="order-saved-views">Saved views</label>
  <select id="order-saved-views" value={view?selected:''} onChange={e=>{setSelected(e.target.value);const next=preferences.views.find(v=>v.id===e.target.value);if(next)onApply(next);}}><option value="">Saved views</option>{preferences.views.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>
  <button type="button" onClick={()=>{setEditing('new');setName('');setError('');}}>Save view</button>
  {view&&<><button type="button" aria-label="Rename saved view" onClick={()=>{setEditing('rename');setName(view.name);setError('');}}>Rename</button><button type="button" aria-label="Delete saved view" onClick={()=>setDeleting(true)}>Delete</button></>}
  {editing&&<form className="ow-inline-panel" onSubmit={e=>{e.preventDefault();try{onPreferencesChange(saveOrderView(preferences,current,name,editing==='rename'?selected:undefined));setEditing(null);}catch(err){setError((err as Error).message);}}}>
   <label>View name<input value={name} maxLength={40} onChange={e=>setName(e.target.value)} autoFocus/></label><button type="submit">Save</button><button type="button" onClick={()=>setEditing(null)}>Cancel</button>{error&&<p role="alert">{error}</p>}
  </form>}
  <span className="ow-secondary">Search text is not saved in views.</span>
  <ConfirmModal open={deleting} title="Delete saved view?" body="This removes your saved preference. Orders are unchanged." confirmLabel="Delete view" onCancel={()=>setDeleting(false)} onConfirm={()=>{onPreferencesChange({...preferences,views:preferences.views.filter(v=>v.id!==selected)});setSelected('');setDeleting(false);}}/>
 </div>;
}
