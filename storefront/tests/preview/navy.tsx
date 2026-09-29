import {createRoot} from 'react-dom/client';
import '../../app/globals.css';
import '../../app/(store)/editorial.css';
import '../../components/rebrand/rebrand.css';
import RebrandExperience from '../../components/rebrand/RebrandExperience';
import NavyStoreShell from '../../components/rebrand/NavyStoreShell';
import {CartProvider} from '../../lib/cart-context';
import {UIProvider} from '../../lib/ui-context';
import {getCollections} from '../../lib/collections';
import {labReports} from '../../lib/lab-reports';
import type {CardProduct} from '../../components/ProductCard';

// Isolated browser acceptance data. No inventory, payment or service connection.
const products:CardProduct[] = ['retatrutide', 'ghk-cu', 'klow', 'bpc-157', 'tesamorelin', 'bpc-157-blend'].map((slug,index) => ({
 id:900100+index, slug, name:['Retatrutide','GHK-Cu','KLOW','BPC-157','Tesamorelin','BPC-157 blend'][index], sku:`FIXTURE-${index}`, is_in_stock:true,
 prices:{price:'4500',regular_price:'4500',sale_price:'',currency_code:'AUD',currency_symbol:'$',currency_minor_unit:2,currency_decimal_separator:'.',currency_thousand_separator:',',currency_prefix:'$',currency_suffix:''},
 images:[{src:`/images/rebrand/vials/v2/${slug === 'bpc-157-blend' ? 'bpc-157' : slug}.webp`,alt:`${slug} illustration`}],
 ...(slug === 'bpc-157' ? {sizes:[
  {id:900103,slug:'bpc-157',sku:'BPC-10',label:'10',priceMinor:'6500',available:8,tiers:null,images:[{src:'/images/rebrand/vials/v2/bpc-157.webp',alt:'BPC-157 10 mg illustration'}]},
  {id:900110,slug:'bpc-157-small',sku:'BPC-5',label:'5 mg',priceMinor:'4500',available:0,tiers:null},
  {id:900115,slug:'bpc-157-large',sku:'BPC-15',label:'15 mg',priceMinor:'8500',available:3,tiers:null},
 ]} : {}),
}));
createRoot(document.getElementById('root')!).render(<CartProvider stock={{'bacteriostatic-water':0}}><UIProvider><NavyStoreShell collections={getCollections()} supportEmail="support@example.test"><RebrandExperience variant="v2" products={products} collections={getCollections()} records={[]} report={labReports.find(r=>r.productSlug==='ghk-cu')!} productReports={labReports} reportCount={labReports.length} supportEmail="support@example.test" paymentLabels={['Bank transfer','PayID']}/></NavyStoreShell></UIProvider></CartProvider>);
