// src/routes/graph/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { GraphPageData } from '$lib/types/graph';

export const ssr = false;

interface RouteParams {
    view?: string;
}

interface LoadEvent {
    params: RouteParams;
}

export const load = (async ({ params }: LoadEvent): Promise<GraphPageData> => {
    const validViews = ['dashboard', 'word', 'create-node', 'edit-profile'];
    const view = params.view;

    if (!view || !validViews.includes(view)) {
        throw redirect(307, '/graph/dashboard');
    }

    // Handle word view data
    let wordData = null;
    if (view === 'word') {
        const state = history.state?.['wordData'];
        if (state) {
            wordData = state;
        } else {
            throw redirect(307, '/graph/dashboard');
        }
    }

    return {
        view,
        wordData
    };
}) satisfies PageLoad;