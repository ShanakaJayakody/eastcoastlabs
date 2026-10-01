'use client';
export default function OrdersError({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <div role="alert" className="rounded-xl border border-line bg-surface p-6"><h2 className="text-lg font-semibold">Orders could not be loaded</h2><p className="mt-2 text-sm text-muted">Your filters are still in the address bar. Try loading this view again.</p><button onClick={reset} className="mt-4 min-h-11 rounded-lg border border-line-2 px-4 py-2 text-sm">Retry</button></div>;
}
