import Link from 'next/link';
import {Package,CreditCard,Box,ArrowRight} from 'lucide-react';
export default function OpenWork({counts}:{counts:{toFulfil:number;pendingPayment:number;lowStock:number}}){
 const cards=[{title:'Orders to fulfil',value:counts.toFulfil,href:'/admin/orders?status=to_fulfil',Icon:Package},{title:'Awaiting payment',value:counts.pendingPayment,href:'/admin/orders?status=pending',Icon:CreditCard},{title:'Low stock',value:counts.lowStock,href:'/admin/products?low=1',Icon:Box}];
 return <section className="open-work" aria-label="All open work"><div className="open-work-heading"><h2>Open work</h2><span>All open work · not filtered by date</span></div><div className="open-work-cards">{cards.map(({title,value,href,Icon})=><Link key={href} href={href}><span className="open-work-icon"><Icon size={21}/></span><div><span>{title}</span><strong>{value.toString().padStart(2,'0')}</strong></div><ArrowRight size={18}/></Link>)}</div></section>;
}
