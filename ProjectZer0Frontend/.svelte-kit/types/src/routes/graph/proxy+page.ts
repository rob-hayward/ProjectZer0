// @ts-nocheck
// ProjectZer0Frontend/src/routes/graph/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const ssr = false;

interface PageParams {
    view?: string;
}

export const load = async ({ params }: { params: PageParams }) => {
    const validViews = ['dashboard'];  // Only supporting dashboard for now
    const view = params.view;

    if (!view || !validViews.includes(view)) {
        throw redirect(307, '/graph/dashboard');
    }

    return {
        view
    };
};;null as any as PageLoad;