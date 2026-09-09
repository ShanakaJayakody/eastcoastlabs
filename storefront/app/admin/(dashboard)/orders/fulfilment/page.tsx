import Link from 'next/link';
import {requireAdmin} from '@/lib/admin/auth';
import {getLotCatalog} from '@/lib/admin/fulfilment';
import StockLotRegister from '@/components/admin/StockLotRegister';
import CarrierImport from '@/components/admin/CarrierImport';
export const dynamic='force-dynamic';
export default async function FulfilmentPage(){
 await requireAdmin();const catalog=await getLotCatalog();
 return <div className="space-y-6"><Link href="/admin/orders" className="text-sm underline">Back to orders</Link><h2 className="text-xl font-semibold">Stock lots and carrier reconciliation</h2><CarrierImport/><StockLotRegister catalog={catalog}/><section className="rounded-xl border border-line bg-surface p-4"><h3 className="mb-3 font-semibold">Registered lots</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Pool</th><th>Lot</th><th>Registered units</th><th>Unassigned units</th><th>Evidence</th></tr></thead><tbody>{catalog.lots.map(l=><tr key={l.id} className="border-t border-line"><td className="py-2">{catalog.pools.find(p=>p.id===l.poolId)?.name??l.poolId}</td><td>{l.code}</td><td>{l.units}</td><td>{l.availableUnits}</td><td>{l.receiptId?'Receipt linked':'Physical count'} · {l.coaId?'Certificate linked':'No certificate linked'}</td></tr>)}</tbody></table></div>{!catalog.lots.length&&<p className="text-sm text-muted">No physical lots registered yet.</p>}</section></div>;
}
