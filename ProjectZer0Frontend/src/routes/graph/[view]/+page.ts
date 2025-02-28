// src/routes/graph/[view]/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from '../$types';
import type { 
    GraphData, 
    GraphNode, 
    GraphLink,
    GraphPageData,
    RenderableNode,
    NodeType,
    NodeGroup,
    NodeMode,
    ViewType,
    LinkType
} from '$lib/types/graph/enhanced';
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
    console.debug('[INIT-1] +page.ts: Starting page load', { 
        params,
        searchParams: Object.fromEntries(url.searchParams.entries())
    });

    const validViews: ViewType[] = ['dashboard', 'word', 'create-node', 'edit-profile', 'network', 'statement'];
    const view = params.view as ViewType;

    console.debug('[INIT-2] +page.ts: View type determined', { 
        view, 
        isValid: validViews.includes(view) 
    });

    if (!view || !validViews.includes(view)) {
        console.debug('[INIT-2a] +page.ts: Invalid view, redirecting to dashboard');
        throw redirect(307, '/graph/dashboard');
    }

    let wordData = null;
    if (view === 'word') {
        const wordParam = url.searchParams.get('word');
        console.debug('[INIT-3] +page.ts: Word view detected', { wordParam });

        if (!wordParam) {
            console.debug('[INIT-3a] +page.ts: No word parameter, redirecting to dashboard');
            throw redirect(307, '/graph/dashboard');
        }

        try {
            console.debug('[INIT-4] +page.ts: Fetching word data', { wordParam });
            wordData = await getWordData(wordParam);
            
            if (!wordData) {
                console.debug('[INIT-4a] +page.ts: No word data found, redirecting to dashboard');
                throw new Error('No word data found');
            }

            console.debug('[INIT-5] +page.ts: Word data loaded successfully', {
                wordId: wordData.id,
                definitionCount: wordData.definitions?.length
            });

        } catch (error) {
            console.debug('[INIT-4b] +page.ts: Error loading word data, redirecting to dashboard', { error });
            throw redirect(307, '/graph/dashboard');
        }
    }

    console.debug('[INIT-6] +page.ts: Returning page data', { 
        view,
        hasWordData: !!wordData,
        wordId: wordData?.id
    });

    return {
        view,
        viewType: view,
        wordData,
        _routeKey: Math.random().toString(36).substring(2) // Add random key for forcing re-renders
    };
}) satisfies PageLoad;