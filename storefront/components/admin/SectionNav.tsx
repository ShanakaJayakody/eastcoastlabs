"use client";
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {NAV,workspaceForPath} from '@/lib/admin/nav';
export default function SectionNav(){
  const path=usePathname(),workspace=workspaceForPath(path);
  const links=workspace.routes.map(route=>NAV.find(n=>n.href===route)!);
  if(workspace.id==='orders'||workspace.id==='catalogue')links.push({label:'Lots & dispatch',href:'/admin/orders/fulfilment',icon:NAV[1].icon,group:'Today'});
  if(links.length<2)return null;
  const active=[...links].sort((a,b)=>b.href.length-a.href.length).find(n=>path===n.href||path.startsWith(n.href+'/'));
  return <nav className="admin-section-nav" aria-label={workspace.label}>{links.map(n=><Link key={n.href} href={n.href} aria-current={n===active?'page':undefined}>{n.label}</Link>)}</nav>;
}
