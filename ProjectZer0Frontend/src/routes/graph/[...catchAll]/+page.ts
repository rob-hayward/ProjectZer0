// src/routes/graph/[...catchAll]/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const ssr = false;

interface Params {
    catchAll: string;
}

export const load = (({ params, url }: { params: Params; url: URL }) => {
    console.log('[CATCH-ALL] Caught invalid route:', params.catchAll);
    
    // Check for legacy routes that might still be in use
    
    // Legacy 'create-alternative' route
    if (params.catchAll === 'create-alternative') {
        const wordParam = url.searchParams.get('word');
        if (wordParam) {
            throw redirect(307, `/graph/create-definition?word=${encodeURIComponent(wordParam)}`);
        }
    }
    
    // Handle any view that doesn't have a dedicated component
    throw redirect(307, '/graph/dashboard');
}) satisfies PageLoad;