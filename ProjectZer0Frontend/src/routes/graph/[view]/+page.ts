// src/routes/graph/[view]/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from '../$types';
import type { GraphPageData, ViewType } from '$lib/types/graph/core';
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
    console.log('=== PAGE LOAD START ===');
    console.log('Raw params:', params);
    console.log('Raw URL:', url.toString());
    console.log('URL params:', Object.fromEntries(url.searchParams));
    console.log('View param:', params.view);
    
    // Define valid views as ViewType
    const validViews: ViewType[] = ['dashboard', 'word', 'create-node', 'edit-profile', 'network', 'statement'];
    const view = params.view as ViewType;

    // Type guard to verify view is valid
    if (!view || !validViews.includes(view)) {
        console.log('View validation failed:', { 
            view, 
            isValid: validViews.includes(view),
            validViews 
        });
        console.log('Redirecting to dashboard...');
        throw redirect(307, '/graph/dashboard');
    }

    console.log('View validation passed:', view);

    // Handle word view data
    let wordData = null;
    if (view === 'word') {
        const wordParam = url.searchParams.get('word');
        console.log('Processing word view:', { wordParam, view });

        if (!wordParam) {
            console.warn('No word parameter found, redirecting to dashboard');
            throw redirect(307, '/graph/dashboard');
        }

        try {
            console.log('Loading word data for:', wordParam);
            wordData = await getWordData(wordParam);
            if (!wordData) {
                console.error('No word data found for:', wordParam);
                throw new Error('No word data found');
            }
            console.log('Word data loaded successfully:', wordData);
        } catch (error) {
            console.error('Error loading word data:', error);
            throw redirect(307, '/graph/dashboard');
        }
    }

    const pageData: GraphPageData = {
        view,
        viewType: view,
        wordData
    };

    console.log('=== PAGE LOAD COMPLETE ===');
    console.log('Returning page data:', pageData);
    
    return pageData;
}) satisfies PageLoad;