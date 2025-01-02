// src/routes/graph/[view]/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { GraphPageData } from '$lib/types/graph';
import { getWordData } from '$lib/services/word';

export const ssr = false;

interface RouteParams {
    view?: string;
}

interface LoadEvent {
    params: RouteParams;
    url: URL;
}

export const load = (async ({ params, url }: LoadEvent): Promise<GraphPageData> => {
    console.log('Page load starting:', { params, url: url.toString() });
    
    const validViews = ['dashboard', 'word', 'create-node', 'edit-profile', 'alternative-definitions'];
    const view = params.view;

    if (!view || !validViews.includes(view)) {
        throw redirect(307, '/graph/dashboard');
    }

    // Handle word view data
    let wordData = null;
    if (view === 'word' || view === 'alternative-definitions') {
        const wordParam = url.searchParams.get('word');
        console.log('Word param in load:', wordParam);

        if (!wordParam) {
            console.warn('No word parameter found, redirecting to dashboard');
            throw redirect(307, '/graph/dashboard');
        }

        try {
            console.log('Loading word data for:', wordParam);
            wordData = await getWordData(wordParam);
            if (!wordData) {
                throw new Error('No word data found');
            }
            console.log('Word data loaded:', wordData);
        } catch (error) {
            console.error('Error loading word data:', error);
            throw redirect(307, '/graph/dashboard');
        }
    }

    return {
        view,
        wordData
    };
}) satisfies PageLoad;