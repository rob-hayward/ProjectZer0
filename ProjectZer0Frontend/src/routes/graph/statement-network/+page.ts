// src/routes/graph/statement-network/+page.ts
import type { PageLoad } from './$types';
import type { GraphPageData } from '$lib/types/graph/enhanced';

export const ssr = false;

export const load = (async (): Promise<GraphPageData> => {
    return {
        view: 'statement-network',
        viewType: 'statement-network',
        wordData: null,
        statementData: null,
        _routeKey: Math.random().toString(36).substring(2) // Random key for forcing re-renders
    };
}) satisfies PageLoad;