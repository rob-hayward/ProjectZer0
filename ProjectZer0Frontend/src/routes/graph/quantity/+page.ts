// src/routes/graph/quantity/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { GraphPageData } from '$lib/types/graph/enhanced';
import { getQuantityData } from '$lib/services/quantity';

export const ssr = false;

export const load = (async ({ url }): Promise<GraphPageData> => {
    // Get quantity ID param from URL
    const idParam = url.searchParams.get('id');
    if (!idParam) {
        throw redirect(307, '/graph/dashboard');
    }

    try {
        // Load quantity data directly from API
        const quantityData = await getQuantityData(idParam);
        
        if (!quantityData) {
            throw redirect(307, '/graph/dashboard');
        }

        console.debug('[QUANTITY-ROUTE] Quantity data loaded successfully', {
            quantityId: quantityData.id,
            question: quantityData.question,
            unitCategoryId: quantityData.unitCategoryId,
            defaultUnitId: quantityData.defaultUnitId
        });

        // Return page data with quantity data
        return {
            view: 'quantity',
            viewType: 'quantity',
            wordData: null,
            statementData: null,
            quantityData,
            _routeKey: Math.random().toString(36).substring(2) // Random key for forcing re-renders
        };
    } catch (error) {
        console.error('[QUANTITY-ROUTE] Error loading quantity data:', error);
        throw redirect(307, '/graph/dashboard');
    }
}) satisfies PageLoad;