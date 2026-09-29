"use client";
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {LogOut,X} from 'lucide-react';
import {NAV,WORKSPACES,workspaceForPath} from '@/lib/admin/nav';
import {signOut} from '@/lib/admin/auth-actions';
export default function Sidebar({email,onNavigate,onClose,showClose}:{email:string;onNavigate?:()=>void;onClose?:()=>void;showClose?:boolean}){
 const active=workspaceForPath(usePathname());
 return <div className="admin-sidebar">
   <div className="admin-brand"><Link href="/admin" onClick={onNavigate}><img src="/brand/ecl-cobalt-symbol.png" width="34" height="34" alt=""/><span>east coast labs<small>ADMIN WORKSPACE</small></span></Link>{showClose&&<button aria-label="Close menu" onClick={onClose}><X size={20}/></button>}</div>
   <nav aria-label="Main navigation">{WORKSPACES.map(w=>{const Icon=NAV.find(n=>n.href===w.href)!.icon;return <Link key={w.id} href={w.href} onClick={onNavigate} aria-current={active.id===w.id?'page':undefined}><Icon size={19}/>{w.label}</Link>})}</nav>
   <div className="admin-sidebar-account"><span title={email}>{email}</span><form action={signOut}><button type="submit"><LogOut size={17}/>Sign out</button></form></div>
 </div>;
}
