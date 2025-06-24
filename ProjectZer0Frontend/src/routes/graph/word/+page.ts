// src/routes/graph/word/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { GraphPageData } from '$lib/types/graph/enhanced';
import { getWordData } from '$lib/services/word';

export const ssr = false;

export const load = (async ({ url }): Promise<GraphPageData> => {
    // Get word param from URL
    const wordParam = url.searchParams.get('word');
    if (!wordParam) {
        throw redirect(307, '/graph/dashboard');
    }

    try {
        // Load word data directly from API
        const wordData = await getWordData(wordParam);
        
        if (!wordData) {
            throw redirect(307, '/graph/dashboard');
        }

        console.debug('[WORD-ROUTE] Word data loaded successfully', {
            wordId: wordData.id,
            word: wordData.word,
            definitionCount: wordData.definitions?.length
        });

        // Return page data with word data
        return {
            view: 'word',
            viewType: 'word',
            wordData,
            statementData: null,
            _routeKey: Math.random().toString(36).substring(2) // Random key for forcing re-renders
        };
    } catch (error) {
        console.error('[WORD-ROUTE] Error loading word data:', error);
        throw redirect(307, '/graph/dashboard');
    }
}) satisfies PageLoad;