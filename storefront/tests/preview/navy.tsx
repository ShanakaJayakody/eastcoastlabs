import {createRoot} from 'react-dom/client';
import '../../app/globals.css';
import '../../components/rebrand/rebrand.css';
import RebrandExperience from '../../components/rebrand/RebrandExperience';
import {CartProvider} from '../../lib/cart-context';
import {UIProvider} from '../../lib/ui-context';
import {getCollections} from '../../lib/collections';
import {labReports} from '../../lib/lab-reports';

// Isolated browser acceptance data. No inventory, payment or service connection.
const products = ['retatrutide', 'ghk-cu', 'klow', 'bpc-157'].map((slug,index) => ({
 id:900100+index, slug, name:['Retatrutide','GHK-Cu','KLOW','BPC-157'][index], sku:`FIXTURE-${index}`, is_in_stock:true,
 prices:{price:'4500',regular_price:'4500',sale_price:'',currency_code:'AUD',currency_symbol:'$',currency_minor_unit:2,currency_decimal_separator:'.',currency_thousand_separator:',',currency_prefix:'$',currency_suffix:''},
 images:[{src:`/images/rebrand/vials/v2/${slug}.webp`,alt:`${slug} illustration`}],
}));
createRoot(document.getElementById('root')!).render(<CartProvider stock={{'bacteriostatic-water':0}}><UIProvider><RebrandExperience variant="v2" products={products} collections={getCollections()} records={[]} report={labReports.find(r=>r.productSlug==='ghk-cu')!} productReports={labReports} reportCount={labReports.length} supportEmail="support@example.test" paymentLabels={['Bank transfer','PayID']}/></UIProvider></CartProvider>);
