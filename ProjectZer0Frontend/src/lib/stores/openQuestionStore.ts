// src/lib/stores/openQuestionStore.ts
import { writable } from 'svelte/store';
import type { OpenQuestionNode } from '$lib/types/domain/nodes';

export type OpenQuestionViewType = 'openquestion' | 'alternative-answers' | 'create-alternative' | 'discuss';

function createOpenQuestionStore() {
    const { subscribe, set: baseSet } = writable<OpenQuestionNode | null>(null);

    function updateUrl(questionId: string | null, view: OpenQuestionViewType) {
        console.log('OpenQuestionStore: Updating URL with:', { questionId, view });
        
        if (questionId) {
            const newUrl = `/graph/${view}?id=${encodeURIComponent(questionId)}`;
            const currentUrl = new URL(window.location.href);
            const currentId = currentUrl.searchParams.get('id');
            
            console.log('OpenQuestionStore: URL check:', {
                newUrl,
                currentId,
                questionId,
                needsUpdate: currentId !== questionId
            });

            if (currentId !== questionId) {
                try {
                    const state = { questionId };
                    window.history.replaceState(state, '', newUrl);
                } catch (error) {
                    console.error('OpenQuestionStore: Error updating URL:', error);
                }
            } else {
            }
        }
    }

    let currentQuestionId: string | null = null;

    return {
        subscribe,
        set: (questionData: OpenQuestionNode | null, view: OpenQuestionViewType = 'openquestion') => {
            console.log('OpenQuestionStore: Setting question data:', { 
                questionData, 
                view,
                currentQuestionId,
                newQuestionId: questionData?.id,
                currentUrl: window.location.href
            });

            baseSet(questionData);
            
            if (questionData) {
                // Small delay to ensure other navigation has completed
                setTimeout(() => {
                    updateUrl(questionData.id, view);
                }, 0);
                currentQuestionId = questionData.id;
            } else {
                currentQuestionId = null;
            }
        },
        reset: () => {
            currentQuestionId = null;
            baseSet(null);
        },
        getCurrentQuestion: () => {
            let currentQuestion: OpenQuestionNode | null = null;
            subscribe(value => {
                currentQuestion = value;
            })();
            return currentQuestion;
        }
    };
}

export const openQuestionStore = createOpenQuestionStore();