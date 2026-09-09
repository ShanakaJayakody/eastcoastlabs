import ProductPurchase from '@/components/ProductPurchase';
import ProductSizesEditor from '@/components/admin/ProductSizesEditor';
import type { ProductListRow } from '@/lib/admin/products';
const sizes=[{id:900011,slug:'size-fixture',label:'10 mg',priceMinor:'4500',available:9,tiers:[{id:'single' as const,label:'1 vial',vials:1,total:45,perVial:45},{id:'pack3' as const,label:'3-pack',vials:3,total:122,perVial:40.67,preselected:true}]},
 {id:900012,slug:'size-fixture-20',label:'20 mg',priceMinor:'7500',available:12,tiers:[{id:'single' as const,label:'1 vial',vials:1,total:75,perVial:75},{id:'pack3' as const,label:'3-pack',vials:3,total:203,perVial:67.67,preselected:true}]},
 {id:900013,slug:'size-fixture-30',label:'30 mg',priceMinor:'9900',available:0,tiers:null}];
const adminSizes:ProductListRow[]=sizes.map((size,index)=>({id:String(size.id),slug:size.slug,name:'Research compound',sku:`SIZE-${index}`,status:'active',unit_cost_cents:null,image:null,size_label:size.label,edit_version:1,totalOnHand:size.available,lowStock:!size.available,minPriceCents:Number(size.priceMinor),
 variants:[1,3,6].map(pack=>({id:`${size.id}-${pack}`,sku:`SIZE-${index}-${pack}`,pack_size:pack,label:pack===1?'1 vial':`${pack}-pack`,price_cents:Math.round(Number(size.priceMinor)*pack*(pack===3?0.9:pack===6?0.8:1)),compare_at_cents:null,low_stock_threshold:5,on_hand:Math.floor(size.available/pack),reserved:0,available:Math.floor(size.available/pack),active:true}))}));
export default function SizeFixture({admin=false}:{admin?:boolean}){
 return <div className={admin?'mx-auto max-w-3xl':'mx-auto max-w-lg'}><p className="mb-2 text-xs uppercase tracking-widest text-accent">Synthetic example</p><h1 className="mb-6 text-3xl font-semibold">Research compound</h1>
  {admin?<ProductSizesEditor product={adminSizes[0]} sizes={adminSizes}/>:<ProductPurchase product={{id:900011,name:'Research compound',slug:'size-fixture',sku:'SIZE-0'}} sizes={sizes} minorUnit={2}/>}</div>;
}
