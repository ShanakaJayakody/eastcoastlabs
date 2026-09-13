import 'server-only';
import { adminDb } from './db';
export interface ReorderItem {
    product_name: string;
    product_slug?: string;
    variant_id?: string | null;
    qty: number;
}
/** Only link to a purchased SKU after the existing stock-aware RPC confirms it is purchasable. */
export async function reorderItems(items: ReorderItem[]) {
    const result: {
        name: string;
        qty: number;
        url?: string;
    }[] = [];
    for (const item of items) {
        let url: string | undefined;
        if (item.variant_id && item.product_slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.product_slug)) {
            const { data, error } = await adminDb().rpc('stock_notification_variant_available', { p_variant: item.variant_id });
            if (error)
                throw new Error(`Cannot verify reorder availability: ${error.message}`);
            if (data === true)
                url = `/product/${item.product_slug}`;
        }
        result.push({ name: item.product_name, qty: item.qty, ...(url ? { url } : {}) });
    }
    return result;
}
