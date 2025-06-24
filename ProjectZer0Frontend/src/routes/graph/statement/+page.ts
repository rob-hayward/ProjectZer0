// src/routes/graph/statement/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { GraphPageData } from '$lib/types/graph/enhanced';
import { getStatementData } from '$lib/services/statement';

export const ssr = false;

export const load = (async ({ url }): Promise<GraphPageData> => {
    // Get statement ID param from URL
    const idParam = url.searchParams.get('id');
    if (!idParam) {
        throw redirect(307, '/graph/dashboard');
    }

    try {
        // Load statement data directly from API
        const statementData = await getStatementData(idParam);
        
        if (!statementData) {
            throw redirect(307, '/graph/dashboard');
        }

        console.debug('[STATEMENT-ROUTE] Statement data loaded successfully', {
            statementId: statementData.id,
            statement: statementData.statement,
            keywordCount: statementData.keywords?.length
        });

        // Return page data with statement data
        return {
            view: 'statement',
            viewType: 'statement',
            wordData: null,
            statementData,
            _routeKey: Math.random().toString(36).substring(2) // Random key for forcing re-renders
        };
    } catch (error) {
        console.error('[STATEMENT-ROUTE] Error loading statement data:', error);
        throw redirect(307, '/graph/dashboard');
    }
}) satisfies PageLoad;