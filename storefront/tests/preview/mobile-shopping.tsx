import {createRoot} from 'react-dom/client';
import '../../app/globals.css';
import '../../app/(store)/editorial.css';
import SizedProductExperience from '@/components/SizedProductExperience';
import NavyStoreShell from '@/components/rebrand/NavyStoreShell';
import {getCollections} from '@/lib/collections';
import {CartProvider} from '@/lib/cart-context';
import {UIProvider} from '@/lib/ui-context';
import SupplierReportLinks from '@/components/SupplierReportLinks';
import {labReports} from '@/lib/lab-reports';
const sizes=[
  {id:90001,slug:'sample',sku:'DEMO-100',label:'100 mg',priceMinor:'8000',available:12,images:[{src:'/images/rebrand/vials/v2/ghk-cu.webp',alt:'GHK-Cu 100 mg illustration'}],description:'<p>Synthetic product details for this local preview.</p>',tiers:[{id:'single' as const,label:'1 vial',vials:1,total:80,perVial:80},{id:'pack3' as const,label:'3-pack',vials:3,total:216,perVial:72},{id:'pack6' as const,label:'6-pack',vials:6,total:408,perVial:68}]},
  {id:90002,slug:'sample-50',sku:'DEMO-50',label:'50 mg',priceMinor:'5000',available:5,images:[{src:'/images/rebrand/vials/v2/ghk-cu-50mg.webp',alt:'GHK-Cu 50 mg illustration'}],description:'<p>50 mg synthetic product details.</p>',tiers:[{id:'single' as const,label:'1 vial',vials:1,total:50,perVial:50}]},
  {id:90003,slug:'sample-20',sku:'DEMO-20',label:'20 mg',priceMinor:'3000',available:0,images:[],tiers:null},
];
createRoot(document.getElementById('root')!).render(
  <CartProvider stock={{'bacteriostatic-water':0}} shipping={[{method:'standard',label:'Standard shipping',rateCents:1000,freeThresholdCents:10000,eta:'2–5 business days'},{method:'express',label:'Express shipping',rateCents:1500,freeThresholdCents:15000,eta:'1–2 business days'}]} paymentLabels={['PayID','Bank Transfer']}>
    <UIProvider><NavyStoreShell collections={getCollections()} supportEmail="support@example.test">
      <div className="border-b border-line px-4 py-2 text-center text-xs text-muted">Local preview · synthetic prices and stock</div>
      <div className="ecl-product-page mx-auto">
        <nav className="text-xs text-muted">Shop / GHK-Cu</nav>
        <SizedProductExperience product={{id:90001,name:'GHK-Cu',slug:'sample',sku:'DEMO'}} sizes={sizes} minorUnit={2} coa={null} supplierEvidence={<SupplierReportLinks reports={labReports.filter(report => report.productSlug === 'ghk-cu')}/>}/>
      </div>
    </NavyStoreShell></UIProvider>
  </CartProvider>
);
