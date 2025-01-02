// src/lib/stores/wordStore.ts
import { writable } from 'svelte/store';
import type { WordNode } from '$lib/types/nodes';

function createWordStore() {
    const { subscribe, set: baseSet } = writable<WordNode | null>(null);

    function updateUrl(word: string | null, view: 'word' | 'alternative-definitions') {
        console.log('WordStore: Updating URL with:', { word, view });
        
        if (word) {
            const newUrl = `/graph/${view}?word=${encodeURIComponent(word)}`;
            const currentUrl = new URL(window.location.href);
            const currentWord = currentUrl.searchParams.get('word');
            
            console.log('WordStore: URL check:', {
                newUrl,
                currentWord,
                word,
                needsUpdate: currentWord !== word
            });

            if (currentWord !== word) {
                try {
                    // Use history.replaceState instead of goto
                    const state = { word };
                    window.history.replaceState(state, '', newUrl);
                    console.log('WordStore: URL updated successfully via history API');
                } catch (error) {
                    console.error('WordStore: Error updating URL:', error);
                }
            } else {
                console.log('WordStore: URL already correct');
            }
        }
    }

    let currentWordId: string | null = null;

    return {
        subscribe,
        set: (wordData: WordNode | null, view: 'word' | 'alternative-definitions' = 'word') => {
            console.log('WordStore: Setting word data:', { 
                wordData, 
                view,
                currentWordId,
                newWordId: wordData?.id,
                currentUrl: window.location.href
            });

            baseSet(wordData);
            
            if (wordData) {
                // Small delay to ensure other navigation has completed
                setTimeout(() => {
                    updateUrl(wordData.word, view);
                }, 0);
                currentWordId = wordData.id;
            } else {
                currentWordId = null;
            }
        },
        reset: () => {
            console.log('WordStore: Resetting word data');
            currentWordId = null;
            baseSet(null);
        }
    };
}

export const wordStore = createWordStore();