// src/lib/stores/wordStore.ts
import { writable } from 'svelte/store';
import type { WordNode } from '$lib/types/nodes';
import { goto } from '$app/navigation';

function createWordStore() {
    const { subscribe, set: baseSet } = writable<WordNode | null>(null);

    async function updateUrl(word: string | null, view: 'word' | 'alternative-definitions') {
        if (word) {
            // Use replaceState only for alternative-definitions view
            const options = {
                replaceState: view === 'alternative-definitions',
                keepFocus: true
            };
            await goto(`/graph/${view}?word=${encodeURIComponent(word)}`, options);
        }
    }

    return {
        subscribe,
        set: (wordData: WordNode | null, view: 'word' | 'alternative-definitions' = 'word') => {
            baseSet(wordData);
            if (wordData) {
                updateUrl(wordData.word, view);
            }
        },
        reset: () => {
            baseSet(null);
        }
    };
}

export const wordStore = createWordStore();