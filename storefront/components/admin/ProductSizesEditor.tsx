"use client";

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductListRow } from '@/lib/admin/products';
import { addProductSize, saveProductSize, saveUnitCost } from '@/app/admin/(dashboard)/products/actions';
import { formatAud } from '@/lib/format';
import StockDrawer, { type StockTarget } from './StockDrawer';

const field = 'w-full rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent';
const button = 'rounded-lg border border-line-2 px-3 py-2 text-sm font-medium transition hover:bg-surface-2 disabled:opacity-50';

function SizeRow({ size, parentSlug, disabled, onStock }: {
  size: ProductListRow; parentSlug: string; disabled: boolean; onStock: (size: ProductListRow) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const initial = useMemo(() => ({label:size.size_label ?? '',enabled:size.size_enabled !== false,
    prices:Object.fromEntries(size.variants.map(v=>[v.id,(v.price_cents/100).toFixed(2)]))}), [size]);
  const [form,setForm] = useState(initial);
  const [baseline,setBaseline] = useState(initial);
  const [version,setVersion] = useState(size.edit_version ?? 0);
  const [cost,setCost] = useState(size.unit_cost_cents==null ? '' : (size.unit_cost_cents/100).toFixed(2));
  useEffect(()=>setCost(size.unit_cost_cents==null ? '' : (size.unit_cost_cents/100).toFixed(2)),[size.unit_cost_cents]);
  useEffect(()=>{
    if(JSON.stringify(form)===JSON.stringify(baseline)){
      setForm(initial);setBaseline(initial);setVersion(size.edit_version ?? 0);
    }
    // Stock/media refreshes must not discard a price draft or its revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[initial,size.edit_version]);
  const dirty=JSON.stringify(form)!==JSON.stringify(baseline);
  const single=size.variants.find(v=>v.pack_size===1);
  const packs=size.variants.filter(v=>v.pack_size!==1);
  const priceInput=(id:string,label:string)=><label className="block text-xs text-muted">
    <span className="mb-1.5 block">{label} (AUD)</span>
    <input aria-label={`${size.size_label || 'Current size'} ${label}`} type="number" min="0" max="1000000" step="0.01" className={field}
      value={form.prices[id] ?? ''} onChange={e=>setForm({...form,prices:{...form.prices,[id]:e.target.value}})}/>
  </label>;
  function save(){
    if(Object.values(form.prices).some(price=>price.trim()==='')){toast.error('Enter a price for each pack.');return;}
    start(async()=>{
      const result=await saveProductSize(parentSlug,{id:size.id,label:form.label,enabled:form.enabled,version,
        variants:size.variants.map(v=>({id:v.id,priceAud:Number(form.prices[v.id]),threshold:v.low_stock_threshold}))});
      if(result.ok){setBaseline(form);if(result.version!==undefined)setVersion(result.version);toast.success('Size saved');router.refresh();}
      else toast.error(result.error ?? 'Could not save this size');
    });
  }
  return <div className="rounded-xl border border-line bg-ink-2/30 p-4">
    <fieldset disabled={disabled || pending}>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block text-xs text-muted"><span className="mb-1.5 block">Size</span>
          <input aria-label={`${size.size_label || 'Current size'} label`} maxLength={40} placeholder="e.g. 10 mg" value={form.label} onChange={e=>setForm({...form,label:e.target.value})} className={field}/>
        </label>
        {single && priceInput(single.id,'Single vial')}
        <button type="button" className={button} onClick={()=>onStock(size)}>{size.totalOnHand} in stock · Manage</button>
      </div>
      {packs.length>0 && <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted hover:text-fg">Pack prices · {packs.map(v=>`${v.pack_size} for ${formatAud(Number(form.prices[v.id]) || 0)}`).join(' · ')}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{packs.map(v=><div key={v.id}>{priceInput(v.id,`${v.pack_size}-pack`)}</div>)}</div>
      </details>}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted hover:text-fg">Cost per vial · {size.unit_cost_cents==null?'not set':formatAud(size.unit_cost_cents/100)}</summary>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted"><span className="mb-1.5 block">Cost per vial (AUD)</span><input aria-label={`${size.size_label || 'Current size'} cost per vial`} type="number" min="0" max="1000000" step="0.01" value={cost} onChange={e=>setCost(e.target.value)} className={field}/></label>
          <button type="button" className={button} onClick={()=>start(async()=>{
            const result=await saveUnitCost(size.slug,cost.trim()===''?null:Number(cost));
            if(result.ok){toast.success('Cost saved');router.refresh();}else toast.error(result.error ?? 'Could not save cost');
          })}>Set cost</button>
        </div>
        <p className="mt-2 text-xs text-muted">Saves immediately for this size. No stock quantities change.</p>
      </details>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" className="accent-[var(--color-accent)]" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.target.checked})}/>Show this size on the store</label>
        <button type="button" className={`${button} ${dirty?'border-accent bg-accent text-accent-ink':''}`} disabled={!dirty || pending || disabled || !form.label.trim()} onClick={save}>{pending?'Saving…':'Save size'}</button>
      </div>
    </fieldset>
  </div>;
}

export default function ProductSizesEditor({ product, sizes, disabled=false }: {
  product: ProductListRow; sizes: ProductListRow[]; disabled?: boolean;
}) {
  const router=useRouter();
  const [pending,start]=useTransition();
  const [adding,setAdding]=useState(false);
  const [currentLabel,setCurrentLabel]=useState('');
  const [label,setLabel]=useState('');
  const [single,setSingle]=useState('');
  const [stock,setStock]=useState('0');
  const [includePacks,setIncludePacks]=useState(true);
  const [overrides,setOverrides]=useState<{3?:string;6?:string}>({});
  const [stockSize,setStockSize]=useState<string|null>(null);
  const activeStock=sizes.find(size=>size.id===stockSize);
  const pool=activeStock?.variants.find(v=>v.pack_size===1);
  const target:StockTarget|null=activeStock && pool ? {slug:product.slug,name:`${product.name} · ${activeStock.size_label || 'Current size'}`,poolId:pool.id,vialsOnHand:activeStock.totalOnHand,unitCostCents:activeStock.unit_cost_cents,variants:activeStock.variants}:null;
  const packPrice=(pack:3|6)=>overrides[pack] ?? (single===''?'':String(Math.round(Number(single)*pack*(pack===3?0.9:0.8))));
  function add(){
    if(single.trim()==='' || stock.trim()==='' || (includePacks && (!packPrice(3).trim() || !packPrice(6).trim()))){toast.error('Enter prices and opening stock.');return;}
    start(async()=>{
      const result=await addProductSize(product.slug,{currentLabel,label,singlePriceAud:Number(single),initialStock:Number(stock),
        ...(includePacks?{pack3PriceAud:Number(packPrice(3)),pack6PriceAud:Number(packPrice(6))}:{})});
      if(result.ok){setAdding(false);setLabel('');setSingle('');setStock('0');setOverrides({});toast.success(result.message);router.refresh();}
      else toast.error(result.error ?? 'Could not add this size');
    });
  }
  return <section id="sizes" className="scroll-mt-40 rounded-xl border border-line bg-surface">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
      <div><h3 className="text-sm font-semibold text-fg">Sizes &amp; pricing</h3><p className="mt-1 text-xs text-muted">One product page. A separate price and stock count for each size.</p></div>
      <button type="button" className={`${button} inline-flex items-center gap-1.5`} disabled={disabled || pending || !product.variants.length} onClick={()=>setAdding(true)}><Plus size={14}/>Add size</button>
    </div>
    <div className="space-y-3 p-5">
      {disabled && <p role="status" className="text-xs text-warn">Save or discard your product details before changing sizes.</p>}
      {product.size_label ? sizes.map(size=><SizeRow key={size.id} size={size} parentSlug={product.slug} disabled={disabled || pending} onStock={size=>setStockSize(size.id)}/>)
        : <p className="text-sm text-muted">Add another size, such as 20 mg or 30 mg, to give customers a simple choice. Your current price and stock become the first size.</p>}
      {adding && <fieldset disabled={disabled || pending} className="space-y-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
        <h4 className="text-sm font-semibold text-fg">Add a size</h4>
        {!product.size_label && <label className="block text-xs text-muted"><span className="mb-1.5 block">Current size</span><input aria-label="Current size" value={currentLabel} maxLength={40} onChange={e=>setCurrentLabel(e.target.value)} placeholder="e.g. 10 mg" className={field}/><span className="mt-1 block">Labels your existing price and stock.</span></label>}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted"><span className="mb-1.5 block">New size</span><input aria-label="New size" value={label} maxLength={40} onChange={e=>setLabel(e.target.value)} placeholder="e.g. 20 mg" className={field}/></label>
          <label className="text-xs text-muted"><span className="mb-1.5 block">Single vial (AUD)</span><input aria-label="New size single vial price" type="number" min="0.01" step="0.01" value={single} onChange={e=>setSingle(e.target.value)} className={field}/></label>
          <label className="text-xs text-muted"><span className="mb-1.5 block">Opening stock (vials)</span><input aria-label="New size opening stock" type="number" min="0" step="1" value={stock} onChange={e=>setStock(e.target.value)} className={field}/></label>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={includePacks} onChange={e=>setIncludePacks(e.target.checked)} className="accent-[var(--color-accent)]"/>Include 3-vial and 6-vial packs</label>
        {includePacks && <div className="grid gap-3 sm:grid-cols-2">{([3,6] as const).map(pack=><label key={pack} className="text-xs text-muted"><span className="mb-1.5 block">{pack}-pack price (AUD)</span><input aria-label={`New size ${pack}-pack price`} type="number" min="0.01" step="0.01" value={packPrice(pack)} onChange={e=>setOverrides({...overrides,[pack]:e.target.value})} className={field}/><span className="mt-1 block">{overrides[pack]===undefined?`Suggested ${pack===3?'10':'20'}% pack saving · editable`:'Custom price'}</span></label>)}</div>}
        <p className="text-xs text-muted">Adding a size saves it and records its opening stock immediately.</p>
        <div className="flex justify-end gap-2"><button type="button" className={button} onClick={()=>setAdding(false)}>Cancel</button><button type="button" className={`${button} border-accent bg-accent text-accent-ink`} disabled={pending || disabled || !label.trim() || !Number(single) || (!product.size_label && !currentLabel.trim())} onClick={add}>{pending?'Adding…':'Add size & save'}</button></div>
      </fieldset>}
    </div>
    <StockDrawer target={target} onClose={()=>setStockSize(null)}/>
  </section>;
}
