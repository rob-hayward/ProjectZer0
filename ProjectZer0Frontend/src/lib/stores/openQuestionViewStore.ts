// src/lib/stores/openQuestionViewStore.ts
import { writable, get } from 'svelte/store';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
import type { OpenQuestionNode, AnswerStatement } from '$lib/types/domain/nodes';

export type OpenQuestionViewState = 'full' | 'alternative-answers';
export type SortMode = 'newest' | 'popular';

// Vote data interface
export interface VoteData {
    positiveVotes: number;
    negativeVotes: number;
    netVotes: number;
    shouldBeHidden: boolean;
}

interface OpenQuestionViewStore {
  currentView: OpenQuestionViewState;
  sortMode: SortMode;
  isTransitioning: boolean;
  currentQuestion?: OpenQuestionNode;  // Add current question to the store
}

function createOpenQuestionViewStore() {
  const { subscribe, set, update } = writable<OpenQuestionViewStore>({
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
    
    // View management methods
    showAlternativeAnswers: () => update(state => ({
      ...state,
      currentView: 'alternative-answers',
      isTransitioning: true
    })),
    
    showFullQuestion: () => update(state => ({
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
    
    // Question data and vote management
    setQuestionData: (question: OpenQuestionNode) => {
      update(state => {
        // Normalize the question data when adding it
        const normalizedQuestion = { ...question };
        normalizedQuestion.positiveVotes = getNeo4jNumber(question.positiveVotes);
        normalizedQuestion.negativeVotes = getNeo4jNumber(question.negativeVotes);
        
        // Cache the question's vote data
        cacheVoteData(question.id, normalizedQuestion.positiveVotes, normalizedQuestion.negativeVotes);
        
        // Cache vote data for all answers
        if (question.answers) {
          question.answers.forEach(answer => {
            const positiveVotes = getNeo4jNumber(answer.netVotes > 0 ? answer.netVotes : 0);
            const negativeVotes = getNeo4jNumber(answer.netVotes < 0 ? Math.abs(answer.netVotes) : 0);
            cacheVoteData(answer.id, positiveVotes, negativeVotes);
          });
        }
        
        return { ...state, currentQuestion: normalizedQuestion };
      });
    },
    
    // Get vote data for a question or answer
    getVoteData: (nodeId: string): VoteData => {
      // Check the cache first
      if (voteCache.has(nodeId)) {
        return voteCache.get(nodeId)!;
      }
      
      // If not in cache, check if it's the current question
      const state = get({ subscribe });
      if (state.currentQuestion?.id === nodeId) {
        return cacheVoteData(
          nodeId,
          getNeo4jNumber(state.currentQuestion.positiveVotes),
          getNeo4jNumber(state.currentQuestion.negativeVotes)
        );
      }
      
      // Check if it's one of the answers
      if (state.currentQuestion?.answers) {
        const answer = state.currentQuestion.answers.find(a => a.id === nodeId);
        if (answer) {
          const positiveVotes = getNeo4jNumber(answer.netVotes > 0 ? answer.netVotes : 0);
          const negativeVotes = getNeo4jNumber(answer.netVotes < 0 ? Math.abs(answer.netVotes) : 0);
          return cacheVoteData(nodeId, positiveVotes, negativeVotes);
        }
      }
      
      // Return default values if not found
      return { positiveVotes: 0, negativeVotes: 0, netVotes: 0, shouldBeHidden: false };
    },
    
    // Update vote data for a question or answer
    updateVoteData: (nodeId: string, positiveVotes: number, negativeVotes: number) => {
      update(state => {
        const posVotes = getNeo4jNumber(positiveVotes);
        const negVotes = getNeo4jNumber(negativeVotes);
        
        // Update the current question if it matches
        if (state.currentQuestion && state.currentQuestion.id === nodeId) {
          state.currentQuestion.positiveVotes = posVotes;
          state.currentQuestion.negativeVotes = negVotes;
        }
        
        // Update answer if it matches
        if (state.currentQuestion?.answers) {
          const answer = state.currentQuestion.answers.find(a => a.id === nodeId);
          if (answer) {
            answer.netVotes = posVotes - negVotes;
          }
        }
        
        // Update the cache
        cacheVoteData(nodeId, posVotes, negVotes);
        
        return { ...state };
      });
    },
    
    // Add a new answer to the current question
    addAnswer: (answer: AnswerStatement) => {
      update(state => {
        if (state.currentQuestion) {
          const updatedAnswers = [...(state.currentQuestion.answers || []), answer];
          // Sort by netVotes to maintain order
          updatedAnswers.sort((a, b) => b.netVotes - a.netVotes);
          
          state.currentQuestion.answers = updatedAnswers;
          
          // Cache vote data for the new answer
          const positiveVotes = getNeo4jNumber(answer.netVotes > 0 ? answer.netVotes : 0);
          const negativeVotes = getNeo4jNumber(answer.netVotes < 0 ? Math.abs(answer.netVotes) : 0);
          cacheVoteData(answer.id, positiveVotes, negativeVotes);
        }
        
        return { ...state };
      });
    },
    
    // Remove an answer from the current question
    removeAnswer: (answerId: string) => {
      update(state => {
        if (state.currentQuestion?.answers) {
          state.currentQuestion.answers = state.currentQuestion.answers.filter(a => a.id !== answerId);
          // Remove from cache
          voteCache.delete(answerId);
        }
        
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
    },
    
    // Reset the entire store
    reset: () => {
      voteCache.clear();
      set({
        currentView: 'full',
        sortMode: 'popular',
        isTransitioning: false
      });
    }
  };
}

export const openQuestionViewStore = createOpenQuestionViewStore();