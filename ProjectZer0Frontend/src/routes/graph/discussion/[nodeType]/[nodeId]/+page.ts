// src/routes/graph/discussion/[nodeType]/[nodeId]/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { GraphPageData } from '$lib/types/graph/enhanced';

export const ssr = false;

export const load = (async ({ params }): Promise<GraphPageData> => {
    console.debug('[DISCUSSION-ROUTE] Loading discussion view');

    // Extract node type and ID from params
    const { nodeType, nodeId } = params;
    
    if (!nodeType || !nodeId) {
        console.debug('[DISCUSSION-ROUTE] Missing node type or ID, redirecting to dashboard');
        throw redirect(307, '/graph/dashboard');
    }

    try {
        // We'll return minimal page data here and load actual data client-side
        // This avoids SSR issues with authentication and API calls
        return {
            view: 'discussion',
            viewType: 'discussion',
            wordData: null,
            statementData: null,
            _routeKey: Math.random().toString(36).substring(2) // Random key for forcing re-renders
        };
    } catch (error) {
        console.error('[DISCUSSION-ROUTE] Error loading discussion view:', error);
        throw redirect(307, '/graph/dashboard');
    }
}) satisfies PageLoad;