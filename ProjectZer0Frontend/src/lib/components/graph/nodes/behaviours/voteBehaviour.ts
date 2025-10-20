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
  // Custom identifier for API calls (e.g., word text instead of node ID)
  apiIdentifier?: string;
  // Data object to update directly for reactivity
  dataObject?: any;
  // Properties to update in data object
  dataProperties?: {
    positiveVotesKey?: string;
    negativeVotesKey?: string;
  };
  // Callback to trigger reactivity in parent component
  onDataUpdate?: () => void;
  // Support for pre-loaded batch data
  initialVoteData?: {
    userVoteStatus?: VoteStatus;
    positiveVotes?: number;
    negativeVotes?: number;
    votedAt?: string;
  };
  // NEW: Metadata configuration for updating node.metadata
  metadataConfig?: {
    nodeMetadata: any; // Reference to node.metadata object
    voteStatusKey: 'inclusionVoteStatus' | 'contentVoteStatus' | 'userVoteStatus';
    metadataGroup?: string; // e.g., 'definition', 'statement'
  };
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
  initialize: (initialData?: Partial<VoteBehaviourState> & { skipVoteStatusFetch?: boolean }) => Promise<void>;
  handleVote: (voteType: VoteStatus) => Promise<boolean>;
  updateFromExternalSource: (voteData: Partial<VoteBehaviourState>) => void;
  reset: () => void;
  getCurrentState: () => VoteBehaviourState;
}

/**
 * Creates standardised voting behaviour for node components
 * Supports both single and dual voting systems
 * 
 * @param nodeId - Node identifier
 * @param nodeType - Type of node (e.g., 'definition', 'statement')
 * @param options - Configuration options
 */
export function createVoteBehaviour(
  nodeId: string, 
  nodeType: string, 
  options: VoteBehaviourOptions = {}
): VoteBehaviour {
  
  // Extract options with defaults
  const voteStore = options.voteStore || null;
  const graphStore = options.graphStore || null;
  const apiIdentifier = options.apiIdentifier || nodeId;
  const dataObject = options.dataObject || null;
  const dataProperties = options.dataProperties || {
    positiveVotesKey: 'positiveVotes',
    negativeVotesKey: 'negativeVotes'
  };
  const onDataUpdate = options.onDataUpdate || null;
  const initialVoteData = options.initialVoteData || null;
  const metadataConfig = options.metadataConfig || null;
  
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
  
  /**
   * Updates vote counts from API response
   * Handles data object mutation, store updates, and graph visibility
   */
  function updateVoteCounts(apiResponse: any): void {
    const pos = getNeo4jNumber(apiResponse.positiveVotes);
    const neg = getNeo4jNumber(apiResponse.negativeVotes);
    
    // Update internal stores
    positiveVotes.set(pos);
    negativeVotes.set(neg);
    
    // Update data object directly for reactivity
    if (dataObject && dataProperties && dataProperties.positiveVotesKey && dataProperties.negativeVotesKey) {
      dataObject[dataProperties.positiveVotesKey] = pos;
      dataObject[dataProperties.negativeVotesKey] = neg;
      
      // Trigger reactivity callback if provided
      if (onDataUpdate && typeof onDataUpdate === 'function') {
        onDataUpdate();
      }
    }
    
    // Update external store if provided - each view uses its correct store
    if (voteStore && typeof voteStore.updateVoteData === 'function') {
      voteStore.updateVoteData(nodeId, pos, neg);
    }
    
    // Update graph store visibility if provided
    if (graphStore && typeof graphStore.recalculateNodeVisibility === 'function') {
      graphStore.recalculateNodeVisibility(nodeId, pos, neg);
    }
  }

  /**
   * NEW: Updates node.metadata with current vote status
   * Ensures UI components display correct vote button states
   */
  function updateMetadata(voteType: VoteStatus): void {
    if (!metadataConfig) return;
    
    const { nodeMetadata, voteStatusKey, metadataGroup } = metadataConfig;
    
    // Ensure metadata object exists
    if (!nodeMetadata) {
      console.warn('[VoteBehaviour] nodeMetadata not provided, skipping metadata update');
      return;
    }
    
    // Create metadata group if needed (for dual-voting nodes)
    if (metadataGroup && !nodeMetadata.group) {
      nodeMetadata.group = metadataGroup;
    }
    
    // Create vote status structure if needed
    if (!nodeMetadata[voteStatusKey]) {
      nodeMetadata[voteStatusKey] = { status: null };
    }
    
    // Update vote status (null for 'none', otherwise the vote type)
    nodeMetadata[voteStatusKey].status = voteType === 'none' ? null : voteType;
  }

  /**
   * Performs the actual API call with retry logic
   */
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
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return performVoteAction(voteType, retryCount + 1);
      }
      throw err;
    }
  }

  /**
   * Fetches initial vote status from API
   */
  async function initializeVoteStatus(retryCount: number = 0): Promise<void> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    
    try {
      const response = await fetchWithAuth(getVoteEndpoint(apiIdentifier));
      
      if (!response) {
        throw new Error('No response from vote status endpoint');
      }
      
      userVoteStatus.set(response.status || 'none');
      
      // Update vote counts from API response
      if (response.positiveVotes !== undefined && response.negativeVotes !== undefined) {
        updateVoteCounts(response);
      }
      
      error.set(null);
    } catch (err) {
      console.error(`[VoteBehaviour] Error fetching vote status:`, err);
      
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        await initializeVoteStatus(retryCount + 1);
      } else {
        error.set('Failed to load vote status');
        throw err;
      }
    }
  }

  // Public methods

  /**
   * Initialize voting behaviour with optional pre-loaded data
   */
  async function initialize(
    initialData: Partial<VoteBehaviourState> & { skipVoteStatusFetch?: boolean } = {}
  ): Promise<void> {
    try {
      // Check if we have pre-loaded initial vote data
      if (initialVoteData) {
        console.log(`[VoteBehaviour] Using pre-loaded vote data for ${nodeId}:`, initialVoteData);
        
        // Set user vote status from batch data
        if (initialVoteData.userVoteStatus !== undefined) {
          userVoteStatus.set(initialVoteData.userVoteStatus);
        }
        
        // Set vote counts from batch data
        if (initialVoteData.positiveVotes !== undefined && initialVoteData.negativeVotes !== undefined) {
          positiveVotes.set(getNeo4jNumber(initialVoteData.positiveVotes));
          negativeVotes.set(getNeo4jNumber(initialVoteData.negativeVotes));
          
          // Also update data object if provided
          if (dataObject && dataProperties) {
            if (dataProperties.positiveVotesKey) {
              dataObject[dataProperties.positiveVotesKey] = getNeo4jNumber(initialVoteData.positiveVotes);
            }
            if (dataProperties.negativeVotesKey) {
              dataObject[dataProperties.negativeVotesKey] = getNeo4jNumber(initialVoteData.negativeVotes);
            }
          }
        }
        
        // Skip API call since we have batch data
        error.set(null);
        return;
      }

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

      // Skip vote status fetch if we have batch data or explicit skip
      if (!initialData.skipVoteStatusFetch) {
        // Fetch user's vote status from API
        await initializeVoteStatus();
      } else {
        console.log(`[VoteBehaviour] Skipping vote status fetch for ${nodeId} (using batch data)`);
      }

    } catch (err) {
      console.error(`[VoteBehaviour] Error initializing votes for ${nodeId}:`, err);
      error.set('Failed to load vote data');
    }
  }

  /**
   * Handle vote action with optimistic updates and rollback on failure
   */
  async function handleVote(voteType: VoteStatus): Promise<boolean> {
    const currentVoteStatus = get(userVoteStatus);
    const currentIsVoting = get(isVoting);
    
    if (currentIsVoting) {
      return false;
    }

    // Prevent duplicate votes of the same type
    if (voteType !== 'none' && currentVoteStatus === voteType) {
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
      // Optimistic update
      userVoteStatus.set(voteType);
      
      // Perform API call
      const result = await performVoteAction(voteType);
      
      // Update vote counts from API response
      updateVoteCounts(result);
      
      // NEW: Update metadata
      updateMetadata(voteType);
      
      // Update last vote time for rate limiting
      lastVoteTime.set(Date.now());
      
      // Trigger success animation
      voteSuccess.set(true);
      setTimeout(() => {
        voteSuccess.set(false);
        lastVoteType.set(null);
      }, 1000);
      
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
      
      // Rollback metadata changes
      if (metadataConfig) {
        updateMetadata(originalVoteStatus);
      }
      
      error.set('Failed to record vote');
      return false;
      
    } finally {
      isVoting.set(false);
    }
  }

  /**
   * Update vote data from external source (e.g., batch updates)
   */
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
      
      // Update metadata as well
      if (metadataConfig) {
        updateMetadata(voteData.userVoteStatus);
      }
    }
  }

  /**
   * Reset all voting state to initial values
   */
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

  /**
   * Get current state snapshot
   */
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