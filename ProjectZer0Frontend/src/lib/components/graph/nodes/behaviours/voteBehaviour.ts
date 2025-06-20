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
  voteSuccess: boolean;
  lastVoteType: VoteStatus | null;
  error: string | null;
}

export interface VoteBehaviourOptions {
  voteStore?: any;
  graphStore?: any;
  getVoteEndpoint?: (id: string) => string;
  getRemoveVoteEndpoint?: (id: string) => string;
  // NEW: Custom identifier for API calls (e.g., word text instead of node ID)
  apiIdentifier?: string;
  // NEW: Data object to update directly for reactivity
  dataObject?: any;
  // NEW: Properties to update in data object
  dataProperties?: {
    positiveVotesKey?: string;
    negativeVotesKey?: string;
  };
  // NEW: Callback to trigger reactivity in parent component
  onDataUpdate?: () => void;
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
  voteSuccess: Readable<boolean>;
  lastVoteType: Readable<VoteStatus | null>;
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
  const apiIdentifier = options.apiIdentifier || nodeId; // Use custom identifier if provided
  const dataObject = options.dataObject || null;
  const dataProperties = options.dataProperties || {
    positiveVotesKey: 'positiveVotes',
    negativeVotesKey: 'negativeVotes'
  };
  const onDataUpdate = options.onDataUpdate || null;
  
  // Default endpoint functions
  const getVoteEndpoint = options.getVoteEndpoint || ((id: string) => `/nodes/${nodeType}/${id}/vote`);
  const getRemoveVoteEndpoint = options.getRemoveVoteEndpoint || ((id: string) => `/nodes/${nodeType}/${id}/vote/remove`);

  // Internal state stores
  const userVoteStatus: Writable<VoteStatus> = writable('none');
  const positiveVotes: Writable<number> = writable(0);
  const negativeVotes: Writable<number> = writable(0);
  const isVoting: Writable<boolean> = writable(false);
  const voteSuccess: Writable<boolean> = writable(false);
  const lastVoteType: Writable<VoteStatus | null> = writable(null);
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
    
    console.log(`[VoteBehaviour] Updating vote counts for ${nodeId}:`, { pos, neg });
    
    // Update internal stores
    positiveVotes.set(pos);
    negativeVotes.set(neg);
    
    // Update data object directly for reactivity (NEW)
    if (dataObject && dataProperties && dataProperties.positiveVotesKey && dataProperties.negativeVotesKey) {
      dataObject[dataProperties.positiveVotesKey] = pos;
      dataObject[dataProperties.negativeVotesKey] = neg;
      
      console.log(`[VoteBehaviour] Updated data object for ${nodeId}:`, {
        [dataProperties.positiveVotesKey]: dataObject[dataProperties.positiveVotesKey],
        [dataProperties.negativeVotesKey]: dataObject[dataProperties.negativeVotesKey]
      });
      
      // Trigger reactivity callback if provided
      if (onDataUpdate && typeof onDataUpdate === 'function') {
        onDataUpdate();
        console.log(`[VoteBehaviour] Triggered reactivity callback for ${nodeId}`);
      }
    }
    
    // Update external store if provided - but check if the node exists in the store first
    if (voteStore && typeof voteStore.updateVoteData === 'function') {
      // Only update if this is actually a statement network view or the statement exists in the store
      try {
        voteStore.updateVoteData(nodeId, pos, neg);
        console.log(`[VoteBehaviour] Updated external store for ${nodeId}:`, { pos, neg });
      } catch (error) {
        // Silently ignore if the statement doesn't exist in this store
        console.log(`[VoteBehaviour] Node ${nodeId} not in external store, skipping update`);
      }
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
        result = await fetchWithAuth(getRemoveVoteEndpoint(apiIdentifier), {
          method: 'POST'
        });
      } else {
        // Cast vote
        result = await fetchWithAuth(getVoteEndpoint(apiIdentifier), {
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

  async function initializeVoteStatus(retryCount: number = 0): Promise<void> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    
    try {
      console.log(`[VoteBehaviour] Fetching vote status for ${nodeType}:`, apiIdentifier);
      const response = await fetchWithAuth(getVoteEndpoint(apiIdentifier));
      
      if (!response) {
        throw new Error('No response from vote status endpoint');
      }
      
      console.log(`[VoteBehaviour] Vote status response:`, response);
      
      userVoteStatus.set(response.status || 'none');
      
      // Update vote counts from API response
      if (response.positiveVotes !== undefined && response.negativeVotes !== undefined) {
        updateVoteCounts(response);
      }
      
      error.set(null);
    } catch (err) {
      console.error(`[VoteBehaviour] Error fetching vote status:`, err);
      
      if (retryCount < MAX_RETRIES) {
        console.log(`[VoteBehaviour] Retrying vote status fetch (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        await initializeVoteStatus(retryCount + 1);
      } else {
        error.set('Failed to load vote status');
        throw err;
      }
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
        const pos = getNeo4jNumber(initialData.positiveVotes);
        positiveVotes.set(pos);
        
        // Update data object as well
        if (dataObject && dataProperties && dataProperties.positiveVotesKey) {
          dataObject[dataProperties.positiveVotesKey] = pos;
        }
      }
      if (initialData.negativeVotes !== undefined) {
        const neg = getNeo4jNumber(initialData.negativeVotes);
        negativeVotes.set(neg);
        
        // Update data object as well
        if (dataObject && dataProperties && dataProperties.negativeVotesKey) {
          dataObject[dataProperties.negativeVotesKey] = neg;
        }
      }

      // Fetch user's vote status from API
      await initializeVoteStatus();

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
    lastVoteType.set(voteType);
    
    // Store original values for potential rollback
    const originalVoteStatus = currentVoteStatus;
    const originalPositiveVotes = get(positiveVotes);
    const originalNegativeVotes = get(negativeVotes);

    try {
      console.log(`[VoteBehaviour] Processing vote: ${voteType} for ${apiIdentifier}`);
      
      // Optimistic update
      userVoteStatus.set(voteType);
      
      // Perform API call
      const result = await performVoteAction(voteType);
      
      // Update vote counts from API response
      updateVoteCounts(result);
      
      // Update last vote time for rate limiting
      lastVoteTime.set(Date.now());
      
      // Trigger success animation
      voteSuccess.set(true);
      setTimeout(() => {
        voteSuccess.set(false);
        lastVoteType.set(null);
      }, 1000);
      
      console.log(`[VoteBehaviour] Vote successful: ${voteType} for ${apiIdentifier}`);
      return true;
      
    } catch (err) {
      console.error(`[VoteBehaviour] Error voting on ${apiIdentifier}:`, err);
      
      // Rollback optimistic update
      userVoteStatus.set(originalVoteStatus);
      positiveVotes.set(originalPositiveVotes);
      negativeVotes.set(originalNegativeVotes);
      lastVoteType.set(null);
      
      // Rollback data object changes
      if (dataObject && dataProperties && dataProperties.positiveVotesKey && dataProperties.negativeVotesKey) {
        dataObject[dataProperties.positiveVotesKey] = originalPositiveVotes;
        dataObject[dataProperties.negativeVotesKey] = originalNegativeVotes;
      }
      
      error.set('Failed to record vote');
      return false;
      
    } finally {
      isVoting.set(false);
    }
  }

  function updateFromExternalSource(voteData: Partial<VoteBehaviourState>): void {
    if (voteData.positiveVotes !== undefined) {
      const pos = getNeo4jNumber(voteData.positiveVotes);
      positiveVotes.set(pos);
      if (dataObject && dataProperties && dataProperties.positiveVotesKey) {
        dataObject[dataProperties.positiveVotesKey] = pos;
      }
    }
    if (voteData.negativeVotes !== undefined) {
      const neg = getNeo4jNumber(voteData.negativeVotes);
      negativeVotes.set(neg);
      if (dataObject && dataProperties && dataProperties.negativeVotesKey) {
        dataObject[dataProperties.negativeVotesKey] = neg;
      }
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
    voteSuccess.set(false);
    lastVoteType.set(null);
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
      voteSuccess: get(voteSuccess),
      lastVoteType: get(lastVoteType),
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
    voteSuccess: { subscribe: voteSuccess.subscribe },
    lastVoteType: { subscribe: lastVoteType.subscribe },
    error: { subscribe: error.subscribe },
    
    // Methods
    initialize,
    handleVote,
    updateFromExternalSource,
    reset,
    getCurrentState
  };
}