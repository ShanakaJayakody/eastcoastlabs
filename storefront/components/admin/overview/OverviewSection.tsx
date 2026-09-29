"use client";
import {Component,type ReactNode,useState} from 'react';
import {useRouter} from 'next/navigation';
export function SectionFailure({title}:{title:string}){
 const router=useRouter();
 return <section className="overview-unavailable" role="alert"><h2>{title} unavailable</h2><p>Please retry. No placeholder totals are shown.</p><button onClick={()=>router.refresh()}>Retry</button></section>;
}
class Boundary extends Component<{title:string;children:ReactNode;retry:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<section className="overview-unavailable" role="alert"><h2>{this.props.title} unavailable</h2><p>Other sections are still available.</p><button onClick={this.props.retry}>Retry</button></section>:this.props.children;}
}
export default function OverviewSection({title,children}:{title:string;children:ReactNode}){
 const router=useRouter(),[key,setKey]=useState(0);
 return <Boundary key={key} title={title} retry={()=>{router.refresh();setKey(k=>k+1);}}>{children}</Boundary>;
}
