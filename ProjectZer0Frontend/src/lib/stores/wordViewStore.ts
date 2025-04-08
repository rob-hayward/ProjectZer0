// src/lib/stores/wordViewStore.ts
import { writable, get } from 'svelte/store';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
import type { WordNode, Definition } from '$lib/types/domain/nodes';

export type WordViewState = 'full' | 'alternative-definitions';
export type SortMode = 'newest' | 'popular';

// New vote data interface
export interface VoteData {
    positiveVotes: number;
    negativeVotes: number;
    netVotes: number;
    shouldBeHidden: boolean;
}

interface WordViewStore {
  currentView: WordViewState;
  sortMode: SortMode;
  isTransitioning: boolean;
  currentWord?: WordNode;  // Add current word to the store
}

function createWordViewStore() {
  const { subscribe, set, update } = writable<WordViewStore>({
    currentView: 'full',
    sortMode: 'popular',
    isTransitioning: false
  });
  
  // Add vote caching
  const voteCache = new Map<string, VoteData>();

  // Helper function to cache vote data
  function cacheVoteData(
    nodeId: string,
    positiveVotes: number,
    negativeVotes: number
  ): VoteData {
    const netVotes = positiveVotes - negativeVotes;
    const shouldBeHidden = netVotes < 0;
    
    const voteData = {
      positiveVotes,
      negativeVotes,
      netVotes,
      shouldBeHidden
    };
    
    voteCache.set(nodeId, voteData);
    return voteData;
  }
  
  return {
    subscribe,
    
    // Original methods
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
    })),
    
    // New methods for word data and vote management
    setWordData: (word: WordNode) => {
      update(state => {
        // Normalize the word data when adding it
        const normalizedWord = { ...word };
        normalizedWord.positiveVotes = getNeo4jNumber(word.positiveVotes);
        normalizedWord.negativeVotes = getNeo4jNumber(word.negativeVotes);
        
        // Cache the word's vote data
        cacheVoteData(word.id, normalizedWord.positiveVotes, normalizedWord.negativeVotes);
        
        // Cache vote data for all definitions
        if (word.definitions) {
          word.definitions.forEach(def => {
            const positiveVotes = getNeo4jNumber(def.positiveVotes);
            const negativeVotes = getNeo4jNumber(def.negativeVotes);
            cacheVoteData(def.id, positiveVotes, negativeVotes);
          });
        }
        
        return { ...state, currentWord: normalizedWord };
      });
    },
    
    // Get vote data for a word or definition
    getVoteData: (nodeId: string): VoteData => {
      // Check the cache first
      if (voteCache.has(nodeId)) {
        return voteCache.get(nodeId)!;
      }
      
      // If not in cache, check if it's the current word
      const state = get({ subscribe });
      if (state.currentWord?.id === nodeId) {
        return cacheVoteData(
          nodeId,
          getNeo4jNumber(state.currentWord.positiveVotes),
          getNeo4jNumber(state.currentWord.negativeVotes)
        );
      }
      
      // Check if it's one of the definitions
      if (state.currentWord?.definitions) {
        const definition = state.currentWord.definitions.find(d => d.id === nodeId);
        if (definition) {
          return cacheVoteData(
            nodeId,
            getNeo4jNumber(definition.positiveVotes),
            getNeo4jNumber(definition.negativeVotes)
          );
        }
      }
      
      // Return default values if not found
      return { positiveVotes: 0, negativeVotes: 0, netVotes: 0, shouldBeHidden: false };
    },
    
    // Update vote data for a word or definition
    updateVoteData: (nodeId: string, positiveVotes: number, negativeVotes: number) => {
      update(state => {
        const posVotes = getNeo4jNumber(positiveVotes);
        const negVotes = getNeo4jNumber(negativeVotes);
        
        // Update the current word if it matches
        if (state.currentWord && state.currentWord.id === nodeId) {
          state.currentWord.positiveVotes = posVotes;
          state.currentWord.negativeVotes = negVotes;
        }
        
        // Update definition if it matches
        if (state.currentWord?.definitions) {
          const definition = state.currentWord.definitions.find(d => d.id === nodeId);
          if (definition) {
            definition.positiveVotes = posVotes;
            definition.negativeVotes = negVotes;
          }
        }
        
        // Update the cache
        cacheVoteData(nodeId, posVotes, negVotes);
        
        return { ...state };
      });
    },
    
    // Clear the vote cache or reset entirely
    clearVoteCache: (nodeId?: string) => {
      if (nodeId) {
        voteCache.delete(nodeId);
      } else {
        voteCache.clear();
      }
    }
  };
}

export const wordViewStore = createWordViewStore();