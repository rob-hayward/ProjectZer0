// src/routes/graph/create-node/+page.ts
import type { PageLoad } from './$types';
import type { GraphPageData } from '$lib/types/graph/enhanced';

export const ssr = false;

export const load = (async (): Promise<GraphPageData> => {
    return {
        view: 'create-node',
        viewType: 'create-node',
        wordData: null,
        statementData: null,
        _routeKey: Math.random().toString(36).substring(2) // Random key for forcing re-renders
    };
}) satisfies PageLoad;