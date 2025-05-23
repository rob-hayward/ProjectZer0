// src/lib/components/graph/nodes/behaviours/voteBehaviour.ts

import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
import type { VoteStatus } from '$lib/types/domain/nodes';

// Type definitions
export interface VoteBehaviourState {
  userVoteStatus: VoteStatus;
  positiveVotes: number;
  negativeVotes: number;
  netVotes: number;
  totalVotes: number;
  isVoting: boolean;
  error: string | null;
}

export interface VoteBehaviourOptions {
  voteStore?: any;
  graphStore?: any;
  getVoteEndpoint?: (id: string) => string;
  getRemoveVoteEndpoint?: (id: string) => string;
}

export interface VoteBehaviour {
  // State (readable stores)
  userVoteStatus: Readable<VoteStatus>;
  positiveVotes: Readable<number>;
  negativeVotes: Readable<number>;
  netVotes: Readable<number>;
  totalVotes: Readable<number>;
  scoreDisplay: Readable<string>;
  voteStatus: Readable<string>;
  isVoting: Readable<boolean>;
  error: Readable<string | null>;
  
  // Methods
  initialize: (initialData?: Partial<VoteBehaviourState>) => Promise<void>;
  handleVote: (voteType: VoteStatus) => Promise<boolean>;
  updateFromExternalSource: (voteData: Partial<VoteBehaviourState>) => void;
  reset: () => void;
  getCurrentState: () => VoteBehaviourState;
}

/**
 * Creates standardised voting behaviour for node components
 */
export function createVoteBehaviour(
  nodeId: string, 
  nodeType: string, 
  options: VoteBehaviourOptions = {}
): VoteBehaviour {
  
  // Extract options with defaults
  const voteStore = options.voteStore || null;
  const graphStore = options.graphStore || null;
  const getVoteEndpoint = options.getVoteEndpoint || ((id: string) => `/nodes/${nodeType}/${id}/vote`);
  const getRemoveVoteEndpoint = options.getRemoveVoteEndpoint || ((id: string) => `/nodes/${nodeType}/${id}/vote/remove`);

  // Internal state stores
  const userVoteStatus: Writable<VoteStatus> = writable('none');
  const positiveVotes: Writable<number> = writable(0);
  const negativeVotes: Writable<number> = writable(0);
  const isVoting: Writable<boolean> = writable(false);
  const error: Writable<string | null> = writable(null);
  const lastVoteTime: Writable<number> = writable(0);

  // Derived state
  const netVotes = derived(
    [positiveVotes, negativeVotes],
    ([pos, neg]) => pos - neg
  );

  const totalVotes = derived(
    [positiveVotes, negativeVotes], 
    ([pos, neg]) => pos + neg
  );

  const scoreDisplay = derived(
    netVotes,
    (net) => net > 0 ? `+${net}` : net.toString()
  );

  const voteStatus = derived(
    netVotes,
    (net) => net > 0 ? 'agreed' : net < 0 ? 'disagreed' : 'undecided'
  );

  // Private helper functions
  function updateVoteCounts(apiResponse: any): void {
    const pos = getNeo4jNumber(apiResponse.positiveVotes);
    const neg = getNeo4jNumber(apiResponse.negativeVotes);
    
    positiveVotes.set(pos);
    negativeVotes.set(neg);
    
    // Update external store if provided
    if (voteStore && typeof voteStore.updateVoteData === 'function') {
      voteStore.updateVoteData(nodeId, pos, neg);
    }
    
    // Update graph store visibility if provided
    if (graphStore && typeof graphStore.recalculateNodeVisibility === 'function') {
      graphStore.recalculateNodeVisibility(nodeId, pos, neg);
    }
  }

  async function performVoteAction(voteType: VoteStatus, retryCount: number = 0): Promise<any> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    try {
      let result;
      
      if (voteType === 'none') {
        // Remove vote
        result = await fetchWithAuth(getRemoveVoteEndpoint(nodeId), {
          method: 'POST'
        });
      } else {
        // Cast vote
        result = await fetchWithAuth(getVoteEndpoint(nodeId), {
          method: 'POST',
          body: JSON.stringify({
            isPositive: voteType === 'agree'
          })
        });
      }

      if (!result) {
        throw new Error('No response from vote endpoint');
      }

      return result;
    } catch (err) {
      if (retryCount < MAX_RETRIES) {
        console.log(`[VoteBehaviour] Retrying vote action (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return performVoteAction(voteType, retryCount + 1);
      }
      throw err;
    }
  }

  // Public methods
  async function initialize(initialData: Partial<VoteBehaviourState> = {}): Promise<void> {
    try {
      // Initialize from external store if available
      if (voteStore && typeof voteStore.getVoteData === 'function') {
        const storeData = voteStore.getVoteData(nodeId);
        positiveVotes.set(storeData.positiveVotes || 0);
        negativeVotes.set(storeData.negativeVotes || 0);
      }

      // Initialize from initial data if provided
      if (initialData.positiveVotes !== undefined) {
        positiveVotes.set(getNeo4jNumber(initialData.positiveVotes));
      }
      if (initialData.negativeVotes !== undefined) {
        negativeVotes.set(getNeo4jNumber(initialData.negativeVotes));
      }

      // Fetch user's vote status from API
      const voteStatusResponse = await fetchWithAuth(getVoteEndpoint(nodeId));
      if (voteStatusResponse) {
        userVoteStatus.set(voteStatusResponse.status || 'none');
        
        // Update vote counts if API provides them
        if (voteStatusResponse.positiveVotes !== undefined) {
          updateVoteCounts(voteStatusResponse);
        }
      }

      error.set(null);
    } catch (err) {
      console.error(`[VoteBehaviour] Error initializing votes for ${nodeId}:`, err);
      error.set('Failed to load vote data');
    }
  }

  async function handleVote(voteType: VoteStatus): Promise<boolean> {
    const currentVoteStatus = get(userVoteStatus);
    const currentIsVoting = get(isVoting);
    
    if (currentIsVoting) {
      console.log('[VoteBehaviour] Vote already in progress');
      return false;
    }

    // Prevent duplicate votes of the same type
    if (voteType !== 'none' && currentVoteStatus === voteType) {
      console.log('[VoteBehaviour] Already voted this way');
      return false;
    }

    isVoting.set(true);
    error.set(null);
    
    // Store original values for potential rollback
    const originalVoteStatus = currentVoteStatus;
    const originalPositiveVotes = get(positiveVotes);
    const originalNegativeVotes = get(negativeVotes);

    try {
      console.log(`[VoteBehaviour] Processing vote: ${voteType} for ${nodeId}`);
      
      // Optimistic update
      userVoteStatus.set(voteType);
      
      // Perform API call
      const result = await performVoteAction(voteType);
      
      // Update vote counts from API response
      updateVoteCounts(result);
      
      // Update last vote time for rate limiting
      lastVoteTime.set(Date.now());
      
      console.log(`[VoteBehaviour] Vote successful: ${voteType} for ${nodeId}`);
      return true;
      
    } catch (err) {
      console.error(`[VoteBehaviour] Error voting on ${nodeId}:`, err);
      
      // Rollback optimistic update
      userVoteStatus.set(originalVoteStatus);
      positiveVotes.set(originalPositiveVotes);
      negativeVotes.set(originalNegativeVotes);
      
      error.set('Failed to record vote');
      return false;
      
    } finally {
      isVoting.set(false);
    }
  }

  function updateFromExternalSource(voteData: Partial<VoteBehaviourState>): void {
    if (voteData.positiveVotes !== undefined) {
      positiveVotes.set(getNeo4jNumber(voteData.positiveVotes));
    }
    if (voteData.negativeVotes !== undefined) {
      negativeVotes.set(getNeo4jNumber(voteData.negativeVotes));
    }
    if (voteData.userVoteStatus !== undefined) {
      userVoteStatus.set(voteData.userVoteStatus);
    }
  }

  function reset(): void {
    userVoteStatus.set('none');
    positiveVotes.set(0);
    negativeVotes.set(0);
    isVoting.set(false);
    error.set(null);
    lastVoteTime.set(0);
  }

  function getCurrentState(): VoteBehaviourState {
    return {
      userVoteStatus: get(userVoteStatus),
      positiveVotes: get(positiveVotes),
      negativeVotes: get(negativeVotes),
      netVotes: get(netVotes),
      totalVotes: get(totalVotes),
      isVoting: get(isVoting),
      error: get(error)
    };
  }

  // Return public interface
  return {
    // State (readable stores)
    userVoteStatus: { subscribe: userVoteStatus.subscribe },
    positiveVotes: { subscribe: positiveVotes.subscribe },
    negativeVotes: { subscribe: negativeVotes.subscribe },
    netVotes: { subscribe: netVotes.subscribe },
    totalVotes: { subscribe: totalVotes.subscribe },
    scoreDisplay: { subscribe: scoreDisplay.subscribe },
    voteStatus: { subscribe: voteStatus.subscribe },
    isVoting: { subscribe: isVoting.subscribe },
    error: { subscribe: error.subscribe },
    
    // Methods
    initialize,
    handleVote,
    updateFromExternalSource,
    reset,
    getCurrentState
  };
}