'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { adminDb } from '@/lib/admin/db';
import { VARIABLE_COST_FIELDS } from '@/lib/admin/economics';
export async function saveOrderCosts(orderId: string, costs: Record<string, unknown>, revision: number) {
    const session = await requireAdmin();
    try {
        if (!Number.isInteger(revision) || revision < 0 || !costs || Array.isArray(costs) || typeof costs !== 'object')
            throw new Error('Invalid cost entry');
        for (const [key, value] of Object.entries(costs)) {
            if ((VARIABLE_COST_FIELDS as readonly string[]).includes(key)) {
                if (value !== null && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 2147483647))
                    throw new Error('Costs must be nonnegative integer cents or blank');
            }
            else if (key === 'tax_adjustment_cents') {
                if (value !== null && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647))
                    throw new Error('Tax adjustment must be signed integer cents between -2147483648 and 2147483647, or blank');
            }
            else if (key === 'tax_basis_confirmed') {
                if (typeof value !== 'boolean')
                    throw new Error('Invalid tax basis confirmation');
            }
            else if (key === 'note') {
                if (typeof value !== 'string' || value.length > 2000)
                    throw new Error('Cost notes must be at most 2000 characters');
            }
            else
                throw new Error('Unknown cost field');
        }
        const { data, error } = await adminDb().rpc('admin_save_order_costs', { p_order: orderId, p_costs: costs, p_revision: revision, p_actor: session.email });
        if (error)
            throw new Error(error.message);
        revalidatePath(`/admin/orders/${orderId}`);
        revalidatePath('/admin/reports');
        revalidatePath('/admin');
        return { ok: true as const, revision: Number(data.revision) };
    }
    catch (error) {
        return { ok: false as const, error: error instanceof Error ? error.message : 'Unable to save costs' };
    }
}
