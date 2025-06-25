// src/lib/components/graph/nodes/behaviours/voteBehaviour.ts

import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
import type { VoteStatus } from '$lib/types/domain/nodes';

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
  apiIdentifier?: string;
  dataObject?: any;
  dataProperties?: {
    positiveVotesKey?: string;
    negativeVotesKey?: string;
  };
  onDataUpdate?: () => void;
}

export interface VoteBehaviour {
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
  
  initialize: (initialData?: Partial<VoteBehaviourState>) => Promise<void>;
  handleVote: (voteType: VoteStatus) => Promise<boolean>;
  fetchUserVoteStatus: () => Promise<void>;
  updateFromExternalSource: (voteData: Partial<VoteBehaviourState>) => void;
  reset: () => void;
  getCurrentState: () => VoteBehaviourState;
}

export function createVoteBehaviour(
  nodeId: string, 
  nodeType: string, 
  options: VoteBehaviourOptions = {}
): VoteBehaviour {
  
  const voteStore = options.voteStore || null;
  const graphStore = options.graphStore || null;
  const apiIdentifier = options.apiIdentifier || nodeId;
  const dataObject = options.dataObject || null;
  const dataProperties = options.dataProperties || {
    positiveVotesKey: 'positiveVotes',
    negativeVotesKey: 'negativeVotes'
  };
  const onDataUpdate = options.onDataUpdate || null;
  
  const getVoteEndpoint = options.getVoteEndpoint || ((id: string) => `/nodes/${nodeType}/${id}/vote`);
  const getRemoveVoteEndpoint = options.getRemoveVoteEndpoint || ((id: string) => `/nodes/${nodeType}/${id}/vote/remove`);

  const userVoteStatus: Writable<VoteStatus> = writable('none');
  const positiveVotes: Writable<number> = writable(0);
  const negativeVotes: Writable<number> = writable(0);
  const isVoting: Writable<boolean> = writable(false);
  const voteSuccess: Writable<boolean> = writable(false);
  const lastVoteType: Writable<VoteStatus | null> = writable(null);
  const error: Writable<string | null> = writable(null);
  const lastVoteTime: Writable<number> = writable(0);

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

  function updateVoteCounts(apiResponse: any): void {
    const pos = getNeo4jNumber(apiResponse.positiveVotes);
    const neg = getNeo4jNumber(apiResponse.negativeVotes);
    
    positiveVotes.set(pos);
    negativeVotes.set(neg);
    
    if (dataObject && dataProperties && dataProperties.positiveVotesKey && dataProperties.negativeVotesKey) {
      dataObject[dataProperties.positiveVotesKey] = pos;
      dataObject[dataProperties.negativeVotesKey] = neg;
      
      if (onDataUpdate && typeof onDataUpdate === 'function') {
        onDataUpdate();
      }
    }
    
    if (voteStore && typeof voteStore.updateVoteData === 'function') {
      voteStore.updateVoteData(nodeId, pos, neg);
    }
    
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
        result = await fetchWithAuth(getRemoveVoteEndpoint(apiIdentifier), {
          method: 'POST'
        });
      } else {
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

  async function initializeVoteStatus(retryCount: number = 0): Promise<void> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    
    try {
      const response = await fetchWithAuth(getVoteEndpoint(apiIdentifier));
      
      if (!response) {
        throw new Error('No response from vote status endpoint');
      }
      
      userVoteStatus.set(response.status || 'none');
      
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

  async function initialize(initialData: Partial<VoteBehaviourState> = {}): Promise<void> {
    try {
      let hasCompleteVoteData = false;
      
      if (voteStore && typeof voteStore.getVoteData === 'function') {
        const storeData = voteStore.getVoteData(nodeId);
        positiveVotes.set(storeData.positiveVotes || 0);
        negativeVotes.set(storeData.negativeVotes || 0);
        
        if (storeData.positiveVotes >= 0 && storeData.negativeVotes >= 0) {
          hasCompleteVoteData = true;
        }
      }

      if (initialData.positiveVotes !== undefined) {
        const pos = getNeo4jNumber(initialData.positiveVotes);
        positiveVotes.set(pos);
        hasCompleteVoteData = true;
        
        if (dataObject && dataProperties && dataProperties.positiveVotesKey) {
          dataObject[dataProperties.positiveVotesKey] = pos;
        }
      }
      if (initialData.negativeVotes !== undefined) {
        const neg = getNeo4jNumber(initialData.negativeVotes);
        negativeVotes.set(neg);
        hasCompleteVoteData = true;
        
        if (dataObject && dataProperties && dataProperties.negativeVotesKey) {
          dataObject[dataProperties.negativeVotesKey] = neg;
        }
      }

      if (!hasCompleteVoteData) {
        await initializeVoteStatus();
      } else {
        if (initialData.userVoteStatus !== undefined) {
          userVoteStatus.set(initialData.userVoteStatus);
        } else {
          userVoteStatus.set('none');
        }
        
        error.set(null);
      }

    } catch (err) {
      console.error(`[VoteBehaviour] Error initializing votes for ${nodeId}:`, err);
      error.set('Failed to load vote data');
    }
  }

  async function fetchUserVoteStatus(): Promise<void> {
    try {
      await initializeVoteStatus();
    } catch (err) {
      console.error(`[VoteBehaviour] Error fetching user vote status for ${nodeId}:`, err);
      error.set('Failed to load user vote status');
    }
  }

  async function handleVote(voteType: VoteStatus): Promise<boolean> {
    const currentVoteStatus = get(userVoteStatus);
    const currentIsVoting = get(isVoting);
    
    if (currentIsVoting) {
      return false;
    }

    if (voteType !== 'none' && currentVoteStatus === voteType) {
      return false;
    }

    isVoting.set(true);
    error.set(null);
    lastVoteType.set(voteType);
    
    const originalVoteStatus = currentVoteStatus;
    const originalPositiveVotes = get(positiveVotes);
    const originalNegativeVotes = get(negativeVotes);

    try {
      userVoteStatus.set(voteType);
      
      const result = await performVoteAction(voteType);
      
      updateVoteCounts(result);
      
      lastVoteTime.set(Date.now());
      
      voteSuccess.set(true);
      setTimeout(() => {
        voteSuccess.set(false);
        lastVoteType.set(null);
      }, 1000);
      
      return true;
      
    } catch (err) {
      console.error(`[VoteBehaviour] Error voting on ${apiIdentifier}:`, err);
      
      userVoteStatus.set(originalVoteStatus);
      positiveVotes.set(originalPositiveVotes);
      negativeVotes.set(originalNegativeVotes);
      lastVoteType.set(null);
      
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

  return {
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
    
    initialize,
    handleVote,
    fetchUserVoteStatus,
    updateFromExternalSource,
    reset,
    getCurrentState
  };
}