import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import '../../app/globals.css';
import CartRecoveryRestore from '../../components/CartRecoveryRestore';
import CheckoutForm from '../../components/CheckoutForm';
import BuyBox from '../../components/BuyBox';
import CartDrawer from '../../components/CartDrawer';
import Header from '../../components/Header';
import DossierHeader from '../../components/variant/v2/DossierHeader';
import {CartProvider,useCart} from '../../lib/cart-context';
import {UIProvider,useUI} from '../../lib/ui-context';
import {setQuoteMode,type QuoteMode} from './actions';
const stock={'bacteriostatic-water':0,'reconstitution-kit':0,'insulin-syringes':0,'alcohol-swabs':0,'sharps-container':0};
const prices={'synthetic-compound:1':4500,'synthetic-compound:3':12000,'synthetic-compound:6':21600};
const tiers=[{id:'single' as const,label:'1 vial',vials:1,total:45,perVial:45},{id:'pack3' as const,label:'3-pack',vials:3,total:120,perVial:40,preselected:true},{id:'pack6' as const,label:'6-pack',vials:6,total:216,perVial:36}];
function Preview(){
 const dossier=new URLSearchParams(window.location.search).get('header')==='dossier';
 const {clear,addLine,lines}=useCart();
 const {openCart}=useUI();
 const [page,setPage]=useState('checkout');
 const [mode,setMode]=useState<QuoteMode>('normal');
 function load(){clear();addLine({key:'900001:single:once',productId:900001,slug:'synthetic-compound',name:'Synthetic Research Compound',variantLabel:'1 vial',unitPrice:45},1);}
 return <><div className="border-b border-line bg-surface p-4 text-sm">
  <p className="font-semibold text-accent">Isolated audit preview — synthetic data only</p>
  <p className="my-2 text-muted">No production connection, payment or email. Use fixture controls below; refreshing preserves only this local preview cart.</p>
  <div className="flex flex-wrap gap-2"><button onClick={load} className="rounded border border-line p-2">Load synthetic cart</button><button onClick={clear} className="rounded border border-line p-2">Reset cart</button><button onClick={openCart} className="rounded border border-line p-2">Open preview cart</button><button onClick={()=>setPage('checkout')} className="rounded border border-line p-2">Preview checkout</button><button onClick={()=>setPage('recovery')} className="rounded border border-line p-2">Preview recovery confirmation</button><button onClick={()=>setPage('purchase')} className="rounded border border-line p-2">Preview purchase controls</button></div>
  <label className="mt-3 block">Quote simulation<select value={mode} onChange={e=>{const m=e.target.value as QuoteMode;setMode(m);setQuoteMode(m);}} className="ml-2 rounded border border-line bg-ink p-2"><option value="normal">Normal</option><option value="failure">Fail requests</option><option value="delayed">Delay 20 seconds</option><option value="higher-price">Higher price</option></select></label>
  <p className="mt-2 text-xs text-muted">{lines.length} cart lines. After changing simulation, use Refresh order total or change shipping in checkout.</p>
 </div><div className={dossier?'theme-paper flex min-h-screen flex-col bg-ink text-fg':'flex min-h-screen flex-col'}>{dossier?<DossierHeader/>:<Header/>}<main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 py-8">
 {page==='recovery'?<><h1 className="text-2xl font-bold">Restore your cart</h1><CartRecoveryRestore token={'a'.repeat(43)}/></>:page==='checkout'?<><h1 className="text-2xl font-bold">Checkout preview</h1><CheckoutForm/></>:<><h1 className="mb-6 text-2xl font-bold">Synthetic compound · 4 vials available</h1><BuyBox product={{id:900001,name:'Synthetic Research Compound',slug:'synthetic-compound',sku:'SYNTHETIC'}} tiers={tiers} singlePriceMinor="4500" minorUnit={2} available={4}/></>}
 </main><CartDrawer/></div></>;
}
createRoot(document.getElementById('root')!).render(<CartProvider stock={stock} prices={prices}><UIProvider><Preview/></UIProvider></CartProvider>);
