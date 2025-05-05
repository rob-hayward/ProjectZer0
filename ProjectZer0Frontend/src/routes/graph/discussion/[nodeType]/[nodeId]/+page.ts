// src/routes/graph/discussion/[nodeType]/[nodeId]/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { GraphPageData } from '$lib/types/graph/enhanced';

export const ssr = false;

export const load = (async ({ params }): Promise<GraphPageData> => {
    console.debug('[DISCUSSION-ROUTE] Loading discussion view');

    // Extract node type and ID from params
    const { nodeType, nodeId } = params;