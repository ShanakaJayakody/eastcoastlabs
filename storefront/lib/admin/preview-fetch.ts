import {isReadOnlyPreview,PREVIEW_READ_ONLY_MESSAGE} from './preview-policy';

// Audited SELECT-only RPCs. Neither HTTP GET nor a name containing "preview"
// establishes that a stored procedure is read-only.
const READ_RPCS = new Set([
  'admin_order_status_counts','admin_people_counts','admin_settings_snapshot',
  'admin_order_workspace','admin_order_workspace_scope','admin_order_workspace_export',
  'admin_order_fulfilment','admin_lot_catalog','admin_fulfilment_report',
  'admin_fulfilment_orders','recovery_episode_metrics','commerce_reinstatement_preview',
]);

export function createPreviewDataFetch(baseUrl:string, transport:typeof fetch):typeof fetch {
  const origin=new URL(baseUrl).origin;
  return async (input,init)=>{
    if(!isReadOnlyPreview()) return transport(input,init);
    const raw=input instanceof Request?input.url:String(input);
    const url=new URL(raw);
    const method=(init?.method??(input instanceof Request?input.method:'GET')).toUpperCase();
    const read=method==='GET'||method==='HEAD';
    const rpc=url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
    const allowed=url.origin===origin&&!url.username&&!url.password&&(
      rpc ? READ_RPCS.has(rpc[1])&&(read||method==='POST') :
      !url.pathname.startsWith('/rest/v1/rpc')&&read&&(
        /^\/rest\/v1\/[a-z_]+$/.test(url.pathname)||
        url.pathname.startsWith('/storage/v1/object/')||
        url.pathname.startsWith('/storage/v1/render/image/')
      )
    );
    if(!allowed) throw new Error(PREVIEW_READ_ONLY_MESSAGE);
    return transport(input,{...init,redirect:'error'});
  };
}
