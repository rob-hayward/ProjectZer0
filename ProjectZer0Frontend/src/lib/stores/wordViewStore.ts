// src/lib/stores/wordViewStore.ts
import { writable } from 'svelte/store';

export type WordViewState = 'full' | 'alternative-definitions';
export type SortMode = 'newest' | 'popular';

interface WordViewStore {
  currentView: WordViewState;
  sortMode: SortMode;
  isTransitioning: boolean;
}

function createWordViewStore() {
  const { subscribe, set, update } = writable<WordViewStore>({
    currentView: 'full',
    sortMode: 'popular',
    isTransitioning: false
  });

  return {
    subscribe,
    showAlternativeDefinitions: () => update(state => ({
      ...state,
      currentView: 'alternative-definitions',
      isTransitioning: true
    })),
    showFullWord: () => update(state => ({
      ...state,
      currentView: 'full',
      isTransitioning: true
    })),
    setSortMode: (mode: SortMode) => update(state => ({
      ...state,
      sortMode: mode
    })),
    setTransitioning: (isTransitioning: boolean) => update(state => ({
      ...state,
      isTransitioning
    }))
  };
}

export const wordViewStore = createWordViewStore();