// src/lib/stores/wordStore.ts
import { writable } from 'svelte/store';
import type { WordNode } from '$lib/types/nodes';

export type WordViewType = 'word' | 'alternative-definitions' | 'create-alternative' | 'discuss';

function createWordStore() {
    const { subscribe, set: baseSet } = writable<WordNode | null>(null);

    function updateUrl(word: string | null, view: WordViewType) {
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
        set: (wordData: WordNode | null, view: WordViewType = 'word') => {
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
        },
        getCurrentWord: () => {
            let currentWord: WordNode | null = null;
            subscribe(value => {
                currentWord = value;
            })();
            return currentWord;
        }
    };
}

export const wordStore = createWordStore();