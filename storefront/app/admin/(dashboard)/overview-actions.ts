"use server";
import {requireAdmin} from '@/lib/admin/auth';
import {getOverviewRevenue} from '@/lib/admin/overview/queries';
import type {OverviewRange} from '@/lib/admin/overview/types';
export async function loadOverviewRevenue(range:OverviewRange){
 await requireAdmin();return getOverviewRevenue(range);
}
