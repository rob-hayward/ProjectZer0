// src/routes/graph/openquestion/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { GraphPageData } from '$lib/types/graph/enhanced';
import { getOpenQuestionData } from '$lib/services/openQuestion';

export const ssr = false;

export const load = (async ({ url }): Promise<GraphPageData> => {
    // Get id param from URL
    const questionId = url.searchParams.get('id');
    if (!questionId) {
        throw redirect(307, '/graph/dashboard');
    }

    try {
        // Load question data directly from API
        const questionData = await getOpenQuestionData(questionId);
        
        if (!questionData) {
            throw redirect(307, '/graph/dashboard');
        }

        console.debug('[OPENQUESTION-ROUTE] Question data loaded successfully', {
            questionId: questionData.id,
            questionText: questionData.questionText,
            answerCount: questionData.answers?.length
        });

        // Return page data with question data
        return {
            view: 'openquestion',
            viewType: 'openquestion',
            wordData: null,
            statementData: null,
            openQuestionData: questionData,
            _routeKey: Math.random().toString(36).substring(2) // Random key for forcing re-renders
        };
    } catch (error) {
        console.error('[OPENQUESTION-ROUTE] Error loading question data:', error);
        throw redirect(307, '/graph/dashboard');
    }
}) satisfies PageLoad;