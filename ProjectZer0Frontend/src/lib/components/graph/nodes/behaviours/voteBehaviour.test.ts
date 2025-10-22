// src/lib/components/graph/nodes/behaviours/voteBehaviour.test.ts

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { createVoteBehaviour } from './voteBehaviour';
import type { VoteBehaviour, VoteBehaviourOptions } from './voteBehaviour';
import type { VoteStatus } from '$lib/types/domain/nodes';

// Mock fetchWithAuth
vi.mock('$lib/services/api', () => ({
  fetchWithAuth: vi.fn()
}));

// Mock getNeo4jNumber
vi.mock('$lib/utils/neo4j-utils', () => ({
  getNeo4jNumber: vi.fn((val: any) => {
    if (typeof val === 'number') return val;
    if (val && typeof val === 'object' && 'low' in val) return val.low;
    return 0;
  })
}));

import { fetchWithAuth } from '$lib/services/api';

describe('voteBehaviour - Initialization', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;
  let mockVoteStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };

    mockVoteStore = {
      updateVoteData: vi.fn(),
      getVoteData: vi.fn()
    };
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
  });

  test('initializes with zero votes', async () => {
    behaviour = createVoteBehaviour('test-node-1', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    expect(get(behaviour.positiveVotes)).toBe(0);
    expect(get(behaviour.negativeVotes)).toBe(0);
    expect(get(behaviour.netVotes)).toBe(0);
    expect(get(behaviour.totalVotes)).toBe(0);
  });

  test('initializes with existing votes', async () => {
    behaviour = createVoteBehaviour('test-node-2', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 15, 
      negativeVotes: 3,
      skipVoteStatusFetch: true 
    });

    expect(get(behaviour.positiveVotes)).toBe(15);
    expect(get(behaviour.negativeVotes)).toBe(3);
    expect(get(behaviour.netVotes)).toBe(12);
    expect(get(behaviour.totalVotes)).toBe(18);
  });

  test('calculates scoreDisplay correctly for positive votes', async () => {
    behaviour = createVoteBehaviour('test-node-3', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 10, 
      negativeVotes: 2,
      skipVoteStatusFetch: true 
    });

    expect(get(behaviour.scoreDisplay)).toBe('+8');
  });

  test('calculates scoreDisplay correctly for negative votes', async () => {
    behaviour = createVoteBehaviour('test-node-4', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 2, 
      negativeVotes: 10,
      skipVoteStatusFetch: true 
    });

    expect(get(behaviour.scoreDisplay)).toBe('-8');
  });

  test('calculates voteStatus correctly', async () => {
    behaviour = createVoteBehaviour('test-node-5', 'word', {
      graphStore: mockGraphStore
    });

    // Positive
    await behaviour.initialize({ positiveVotes: 10, negativeVotes: 2, skipVoteStatusFetch: true });
    expect(get(behaviour.voteStatus)).toBe('agreed');

    // Negative
    await behaviour.initialize({ positiveVotes: 2, negativeVotes: 10, skipVoteStatusFetch: true });
    expect(get(behaviour.voteStatus)).toBe('disagreed');

    // Zero
    await behaviour.initialize({ positiveVotes: 0, negativeVotes: 0, skipVoteStatusFetch: true });
    expect(get(behaviour.voteStatus)).toBe('undecided');
  });

  test('handles Neo4j integer objects', async () => {
    behaviour = createVoteBehaviour('test-node-6', 'word', {
      graphStore: mockGraphStore
    });

    // Simulate Neo4j Integer objects
    const neo4jPositive = { low: 15, high: 0 };
    const neo4jNegative = { low: 3, high: 0 };

    await behaviour.initialize({ 
      positiveVotes: neo4jPositive as any, 
      negativeVotes: neo4jNegative as any,
      skipVoteStatusFetch: true 
    });

    expect(get(behaviour.positiveVotes)).toBe(15);
    expect(get(behaviour.negativeVotes)).toBe(3);
  });

  test('initializes with user vote status from batch data', async () => {
    behaviour = createVoteBehaviour('test-node-7', 'word', {
      graphStore: mockGraphStore,
      initialVoteData: {
        userVoteStatus: 'agree',
        positiveVotes: 10,
        negativeVotes: 2
      }
    });

    await behaviour.initialize({ 
      positiveVotes: 10, 
      negativeVotes: 2,
      skipVoteStatusFetch: true 
    });

    // When initialVoteData is provided, userVoteStatus should be set from it
    expect(get(behaviour.userVoteStatus)).toBe('agree');
  });
});

describe('voteBehaviour - Vote Submission', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;
  let mockDataObject: any;
  let onDataUpdateCallback: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };

    mockDataObject = {
      inclusionPositiveVotes: 0,
      inclusionNegativeVotes: 0
    };

    onDataUpdateCallback = vi.fn();

    // Mock successful API response
    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
  });

  test('handles agree vote submission', async () => {
    behaviour = createVoteBehaviour('test-node-1', 'word', {
      graphStore: mockGraphStore,
      dataObject: mockDataObject,
      dataProperties: {
        positiveVotesKey: 'inclusionPositiveVotes',
        negativeVotesKey: 'inclusionNegativeVotes'
      },
      onDataUpdate: onDataUpdateCallback
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    const success = await behaviour.handleVote('agree');

    expect(success).toBe(true);
    expect(get(behaviour.userVoteStatus)).toBe('agree');
    expect(get(behaviour.positiveVotes)).toBe(1);
    expect(get(behaviour.negativeVotes)).toBe(0);
    expect(get(behaviour.isVoting)).toBe(false);
  });

  test('handles disagree vote submission', async () => {
    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: 0,
      negativeVotes: 1,
      netVotes: -1
    });

    behaviour = createVoteBehaviour('test-node-2', 'word', {
      graphStore: mockGraphStore,
      dataObject: mockDataObject,
      dataProperties: {
        positiveVotesKey: 'inclusionPositiveVotes',
        negativeVotesKey: 'inclusionNegativeVotes'
      },
      onDataUpdate: onDataUpdateCallback
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    const success = await behaviour.handleVote('disagree');

    expect(success).toBe(true);
    expect(get(behaviour.userVoteStatus)).toBe('disagree');
    expect(get(behaviour.positiveVotes)).toBe(0);
    expect(get(behaviour.negativeVotes)).toBe(1);
  });

  test('prevents duplicate votes while isVoting=true', async () => {
    // Make API call slow to test race condition
    (fetchWithAuth as any).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        positiveVotes: 1,
        negativeVotes: 0,
        netVotes: 1
      }), 100))
    );

    behaviour = createVoteBehaviour('test-node-3', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    // Try to vote twice rapidly
    const promise1 = behaviour.handleVote('agree');
    const promise2 = behaviour.handleVote('agree');

    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1).toBe(true);
    expect(result2).toBe(false); // Second vote should be prevented
    expect(fetchWithAuth).toHaveBeenCalledTimes(1); // Only one API call
  });

  test('prevents duplicate votes of same type', async () => {
    behaviour = createVoteBehaviour('test-node-4', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    // First vote succeeds
    await behaviour.handleVote('agree');
    expect(get(behaviour.userVoteStatus)).toBe('agree');

    // Try to vote agree again
    const success = await behaviour.handleVote('agree');
    expect(success).toBe(false);
    expect(fetchWithAuth).toHaveBeenCalledTimes(1); // No second API call
  });

  test('calls correct API endpoint for vote', async () => {
    behaviour = createVoteBehaviour('test-node-5', 'word', {
      graphStore: mockGraphStore,
      getVoteEndpoint: (id) => `/nodes/word/${id}/vote`
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(fetchWithAuth).toHaveBeenCalledWith(
      '/nodes/word/test-node-5/vote',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ isPositive: true })
      })
    );
  });

  test('updates dataObject directly for reactivity', async () => {
    behaviour = createVoteBehaviour('test-node-6', 'word', {
      graphStore: mockGraphStore,
      dataObject: mockDataObject,
      dataProperties: {
        positiveVotesKey: 'inclusionPositiveVotes',
        negativeVotesKey: 'inclusionNegativeVotes'
      },
      onDataUpdate: onDataUpdateCallback
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(mockDataObject.inclusionPositiveVotes).toBe(1);
    expect(mockDataObject.inclusionNegativeVotes).toBe(0);
    expect(onDataUpdateCallback).toHaveBeenCalled();
  });

  test('calls graphStore.recalculateNodeVisibility', async () => {
    behaviour = createVoteBehaviour('test-node-7', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(mockGraphStore.recalculateNodeVisibility).toHaveBeenCalledWith(
      'test-node-7',
      1,
      0
    );
  });

  test('calls voteStore.updateVoteData when provided', async () => {
    const mockVoteStore = {
      updateVoteData: vi.fn()
    };

    behaviour = createVoteBehaviour('test-node-8', 'word', {
      graphStore: mockGraphStore,
      voteStore: mockVoteStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(mockVoteStore.updateVoteData).toHaveBeenCalledWith(
      'test-node-8',
      1,
      0
    );
  });
});

describe('voteBehaviour - Vote Removal', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };

    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: 0,
      negativeVotes: 0,
      netVotes: 0
    });
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
  });

  test('removes existing vote by voting same type', async () => {
    // First set up with existing agree vote
    (fetchWithAuth as any).mockResolvedValueOnce({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });

    behaviour = createVoteBehaviour('test-node-1', 'word', {
      graphStore: mockGraphStore,
      getRemoveVoteEndpoint: (id) => `/nodes/word/${id}/vote/remove`
    });

    await behaviour.initialize({ 
      positiveVotes: 1, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    // Manually set user vote status (simulating previous vote)
    await behaviour.handleVote('agree');
    expect(get(behaviour.userVoteStatus)).toBe('agree');

    // Now mock the removal response
    (fetchWithAuth as any).mockResolvedValueOnce({
      positiveVotes: 0,
      negativeVotes: 0,
      netVotes: 0
    });

    // Vote 'none' to remove
    const success = await behaviour.handleVote('none');

    expect(success).toBe(true);
    expect(get(behaviour.userVoteStatus)).toBe('none');
    expect(get(behaviour.positiveVotes)).toBe(0);
    expect(get(behaviour.negativeVotes)).toBe(0);
  });

  test('calls correct remove vote endpoint', async () => {
    behaviour = createVoteBehaviour('test-node-2', 'word', {
      graphStore: mockGraphStore,
      getRemoveVoteEndpoint: (id) => `/nodes/word/${id}/vote/remove`
    });

    await behaviour.initialize({ 
      positiveVotes: 1, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('none');

    expect(fetchWithAuth).toHaveBeenCalledWith(
      '/nodes/word/test-node-2/vote/remove',
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  test('vote counts decrement correctly on removal', async () => {
    behaviour = createVoteBehaviour('test-node-3', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 1, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('none');

    expect(get(behaviour.positiveVotes)).toBe(0);
    expect(get(behaviour.negativeVotes)).toBe(0);
    expect(get(behaviour.netVotes)).toBe(0);
  });
});

describe('voteBehaviour - Vote Switching', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
  });

  test('switches from agree to disagree', async () => {
    behaviour = createVoteBehaviour('test-node-1', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    // First vote agree
    (fetchWithAuth as any).mockResolvedValueOnce({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });
    await behaviour.handleVote('agree');
    expect(get(behaviour.userVoteStatus)).toBe('agree');

    // Then switch to disagree
    (fetchWithAuth as any).mockResolvedValueOnce({
      positiveVotes: 0,
      negativeVotes: 1,
      netVotes: -1
    });
    await behaviour.handleVote('disagree');
    
    expect(get(behaviour.userVoteStatus)).toBe('disagree');
    expect(get(behaviour.positiveVotes)).toBe(0);
    expect(get(behaviour.negativeVotes)).toBe(1);
  });

  test('switches from disagree to agree', async () => {
    behaviour = createVoteBehaviour('test-node-2', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    // First vote disagree
    (fetchWithAuth as any).mockResolvedValueOnce({
      positiveVotes: 0,
      negativeVotes: 1,
      netVotes: -1
    });
    await behaviour.handleVote('disagree');
    expect(get(behaviour.userVoteStatus)).toBe('disagree');

    // Then switch to agree
    (fetchWithAuth as any).mockResolvedValueOnce({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });
    await behaviour.handleVote('agree');
    
    expect(get(behaviour.userVoteStatus)).toBe('agree');
    expect(get(behaviour.positiveVotes)).toBe(1);
    expect(get(behaviour.negativeVotes)).toBe(0);
  });

  test('vote counts update correctly on switch', async () => {
    behaviour = createVoteBehaviour('test-node-3', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 10, 
      negativeVotes: 2,
      skipVoteStatusFetch: true 
    });

    // Switch from agree to disagree (counts adjust)
    (fetchWithAuth as any).mockResolvedValueOnce({
      positiveVotes: 9,
      negativeVotes: 3,
      netVotes: 6
    });
    await behaviour.handleVote('disagree');

    expect(get(behaviour.positiveVotes)).toBe(9);
    expect(get(behaviour.negativeVotes)).toBe(3);
    expect(get(behaviour.netVotes)).toBe(6);
  });
});

describe('voteBehaviour - Optimistic Updates', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
  });

  test('UI updates immediately before API response', async () => {
    let resolveApiCall: any;
    const apiPromise = new Promise((resolve) => {
      resolveApiCall = resolve;
    });

    (fetchWithAuth as any).mockReturnValue(apiPromise);

    behaviour = createVoteBehaviour('test-node-1', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    // Start vote (don't await)
    const votePromise = behaviour.handleVote('agree');

    // Check optimistic update happened immediately
    expect(get(behaviour.userVoteStatus)).toBe('agree');
    expect(get(behaviour.isVoting)).toBe(true);

    // Now resolve the API call
    resolveApiCall({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });

    await votePromise;
    expect(get(behaviour.isVoting)).toBe(false);
  });

  test('rollback on API failure', async () => {
    (fetchWithAuth as any).mockRejectedValue(new Error('API Error'));

    behaviour = createVoteBehaviour('test-node-2', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 5, 
      negativeVotes: 2,
      skipVoteStatusFetch: true 
    });

    const originalPositive = get(behaviour.positiveVotes);
    const originalNegative = get(behaviour.negativeVotes);
    const originalStatus = get(behaviour.userVoteStatus);

    const success = await behaviour.handleVote('agree');

    // Should rollback to original state
    expect(success).toBe(false);
    expect(get(behaviour.userVoteStatus)).toBe(originalStatus);
    expect(get(behaviour.positiveVotes)).toBe(originalPositive);
    expect(get(behaviour.negativeVotes)).toBe(originalNegative);
    expect(get(behaviour.error)).toBe('Failed to record vote');
  });

  test('rollback on network error', async () => {
    (fetchWithAuth as any).mockRejectedValue(new Error('Network Error'));

    behaviour = createVoteBehaviour('test-node-3', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 10, 
      negativeVotes: 3,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(get(behaviour.userVoteStatus)).toBe('none');
    expect(get(behaviour.positiveVotes)).toBe(10);
    expect(get(behaviour.negativeVotes)).toBe(3);
  });

  test('preserves original state on rollback', async () => {
    (fetchWithAuth as any).mockRejectedValue(new Error('API Error'));

    const mockDataObject = {
      inclusionPositiveVotes: 7,
      inclusionNegativeVotes: 2
    };

    behaviour = createVoteBehaviour('test-node-4', 'word', {
      graphStore: mockGraphStore,
      dataObject: mockDataObject,
      dataProperties: {
        positiveVotesKey: 'inclusionPositiveVotes',
        negativeVotesKey: 'inclusionNegativeVotes'
      }
    });

    await behaviour.initialize({ 
      positiveVotes: 7, 
      negativeVotes: 2,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    // Data object should be restored
    expect(mockDataObject.inclusionPositiveVotes).toBe(7);
    expect(mockDataObject.inclusionNegativeVotes).toBe(2);
  });
});

describe('voteBehaviour - Metadata Management', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;
  let mockMetadata: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };

    mockMetadata = {
      inclusionVoteStatus: { status: null }
    };

    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
  });

  test('updates metadata on vote', async () => {
    behaviour = createVoteBehaviour('test-node-1', 'word', {
      graphStore: mockGraphStore,
      metadataConfig: {
        nodeMetadata: mockMetadata,
        voteStatusKey: 'inclusionVoteStatus'
      }
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(mockMetadata.inclusionVoteStatus.status).toBe('agree');
  });

  test('clears metadata on vote removal', async () => {
    mockMetadata.inclusionVoteStatus.status = 'agree';

    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: 0,
      negativeVotes: 0,
      netVotes: 0
    });

    behaviour = createVoteBehaviour('test-node-2', 'word', {
      graphStore: mockGraphStore,
      metadataConfig: {
        nodeMetadata: mockMetadata,
        voteStatusKey: 'inclusionVoteStatus'
      }
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('none');

    expect(mockMetadata.inclusionVoteStatus.status).toBe(null);
  });

  test('handles dual-voting metadata (inclusion + content)', async () => {
    const dualMetadata: any = {
      inclusionVoteStatus: { status: null },
      contentVoteStatus: { status: null }
    };

    behaviour = createVoteBehaviour('test-node-3', 'statement', {
      graphStore: mockGraphStore,
      metadataConfig: {
        nodeMetadata: dualMetadata,
        voteStatusKey: 'contentVoteStatus',
        metadataGroup: 'statement'
      }
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(dualMetadata.contentVoteStatus.status).toBe('agree');
    expect(dualMetadata.group).toBe('statement');
  });

  test('rollback reverts metadata on failure', async () => {
    mockMetadata.inclusionVoteStatus.status = null;

    (fetchWithAuth as any).mockRejectedValue(new Error('API Error'));

    behaviour = createVoteBehaviour('test-node-4', 'word', {
      graphStore: mockGraphStore,
      metadataConfig: {
        nodeMetadata: mockMetadata,
        voteStatusKey: 'inclusionVoteStatus'
      }
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    // Metadata should be reverted to null
    expect(mockMetadata.inclusionVoteStatus.status).toBe(null);
  });
});

describe('voteBehaviour - Error Handling', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
  });

  test('handles malformed API responses', async () => {
    (fetchWithAuth as any).mockResolvedValue({
      // Missing vote counts
      somethingElse: 'data'
    });

    behaviour = createVoteBehaviour('test-node-1', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 5, 
      negativeVotes: 2,
      skipVoteStatusFetch: true 
    });

    const success = await behaviour.handleVote('agree');

    // Should handle gracefully
    expect(success).toBe(true);
    expect(get(behaviour.userVoteStatus)).toBe('agree');
  });

  test('handles null/undefined vote counts', async () => {
    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: null,
      negativeVotes: undefined,
      netVotes: 0
    });

    behaviour = createVoteBehaviour('test-node-2', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    const success = await behaviour.handleVote('agree');

    expect(success).toBe(true);
    expect(get(behaviour.positiveVotes)).toBe(0);
    expect(get(behaviour.negativeVotes)).toBe(0);
  });

  test('retries on network failure', async () => {
    let attemptCount = 0;
    
    (fetchWithAuth as any).mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 3) {
        return Promise.reject(new Error('Network Error'));
      }
      return Promise.resolve({
        positiveVotes: 1,
        negativeVotes: 0,
        netVotes: 1
      });
    });

    behaviour = createVoteBehaviour('test-node-3', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    const success = await behaviour.handleVote('agree');

    expect(success).toBe(true);
    expect(attemptCount).toBe(3); // Should retry twice before success
    expect(get(behaviour.userVoteStatus)).toBe('agree');
  });

  test('gives up after max retries', async () => {
    (fetchWithAuth as any).mockRejectedValue(new Error('Persistent Error'));

    behaviour = createVoteBehaviour('test-node-4', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    const success = await behaviour.handleVote('agree');

    expect(success).toBe(false);
    expect(fetchWithAuth).toHaveBeenCalledTimes(4); // Initial + 3 retries = 4 total
    expect(get(behaviour.error)).toBe('Failed to record vote');
  });

  test('handles no response from endpoint', async () => {
    (fetchWithAuth as any).mockResolvedValue(null);

    behaviour = createVoteBehaviour('test-node-5', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    const success = await behaviour.handleVote('agree');

    expect(success).toBe(false);
    expect(get(behaviour.error)).toBe('Failed to record vote');
  });
});

describe('voteBehaviour - Store Coordination', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;
  let mockVoteStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };

    mockVoteStore = {
      updateVoteData: vi.fn()
    };

    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
  });

  test('updates voteStore when available', async () => {
    behaviour = createVoteBehaviour('test-node-1', 'word', {
      graphStore: mockGraphStore,
      voteStore: mockVoteStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(mockVoteStore.updateVoteData).toHaveBeenCalledWith(
      'test-node-1',
      1,
      0
    );
  });

  test('updates graphStore when available', async () => {
    behaviour = createVoteBehaviour('test-node-2', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(mockGraphStore.recalculateNodeVisibility).toHaveBeenCalledWith(
      'test-node-2',
      1,
      0
    );
  });

  test('works without stores (fallback mode)', async () => {
    behaviour = createVoteBehaviour('test-node-3', 'word', {
      // No stores provided
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    const success = await behaviour.handleVote('agree');

    expect(success).toBe(true);
    expect(get(behaviour.userVoteStatus)).toBe('agree');
    expect(get(behaviour.positiveVotes)).toBe(1);
  });
});

describe('voteBehaviour - Dual Voting', () => {
  let inclusionBehaviour: VoteBehaviour;
  let contentBehaviour: VoteBehaviour;
  let mockGraphStore: any;
  let mockNodeData: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };

    mockNodeData = {
      inclusionPositiveVotes: 0,
      inclusionNegativeVotes: 0,
      contentPositiveVotes: 0,
      contentNegativeVotes: 0
    };

    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });
  });

  afterEach(() => {
    if (inclusionBehaviour) inclusionBehaviour.reset();
    if (contentBehaviour) contentBehaviour.reset();
  });

  test('inclusion and content votes are independent', async () => {
    inclusionBehaviour = createVoteBehaviour('test-node-1', 'statement', {
      graphStore: mockGraphStore,
      dataObject: mockNodeData,
      dataProperties: {
        positiveVotesKey: 'inclusionPositiveVotes',
        negativeVotesKey: 'inclusionNegativeVotes'
      },
      getVoteEndpoint: (id) => `/statements/${id}/inclusion-vote`
    });

    contentBehaviour = createVoteBehaviour('test-node-1', 'statement', {
      graphStore: mockGraphStore,
      dataObject: mockNodeData,
      dataProperties: {
        positiveVotesKey: 'contentPositiveVotes',
        negativeVotesKey: 'contentNegativeVotes'
      },
      getVoteEndpoint: (id) => `/statements/${id}/content-vote`
    });

    await inclusionBehaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await contentBehaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    // Vote on inclusion
    await inclusionBehaviour.handleVote('agree');
    expect(get(inclusionBehaviour.userVoteStatus)).toBe('agree');
    expect(get(contentBehaviour.userVoteStatus)).toBe('none');

    // Vote on content
    await contentBehaviour.handleVote('disagree');
    expect(get(contentBehaviour.userVoteStatus)).toBe('disagree');
    expect(get(inclusionBehaviour.userVoteStatus)).toBe('agree'); // Unchanged
  });

  test('both vote types can be active simultaneously', async () => {
    const mockMetadata = {
      inclusionVoteStatus: { status: null },
      contentVoteStatus: { status: null }
    };

    inclusionBehaviour = createVoteBehaviour('test-node-2', 'statement', {
      graphStore: mockGraphStore,
      metadataConfig: {
        nodeMetadata: mockMetadata,
        voteStatusKey: 'inclusionVoteStatus'
      }
    });

    contentBehaviour = createVoteBehaviour('test-node-2', 'statement', {
      graphStore: mockGraphStore,
      metadataConfig: {
        nodeMetadata: mockMetadata,
        voteStatusKey: 'contentVoteStatus'
      }
    });

    await inclusionBehaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await contentBehaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await inclusionBehaviour.handleVote('agree');
    await contentBehaviour.handleVote('agree');

    expect(mockMetadata.inclusionVoteStatus.status).toBe('agree');
    expect(mockMetadata.contentVoteStatus.status).toBe('agree');
  });

  test('separate API endpoints called for dual voting', async () => {
    inclusionBehaviour = createVoteBehaviour('test-node-3', 'statement', {
      graphStore: mockGraphStore,
      getVoteEndpoint: (id) => `/statements/${id}/inclusion-vote`
    });

    contentBehaviour = createVoteBehaviour('test-node-3', 'statement', {
      graphStore: mockGraphStore,
      getVoteEndpoint: (id) => `/statements/${id}/content-vote`
    });

    await inclusionBehaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await contentBehaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await inclusionBehaviour.handleVote('agree');
    expect(fetchWithAuth).toHaveBeenCalledWith(
      '/statements/test-node-3/inclusion-vote',
      expect.any(Object)
    );

    vi.clearAllMocks();

    await contentBehaviour.handleVote('agree');
    expect(fetchWithAuth).toHaveBeenCalledWith(
      '/statements/test-node-3/content-vote',
      expect.any(Object)
    );
  });

  test('separate metadata keys used for dual voting', async () => {
    const mockMetadata = {
      inclusionVoteStatus: { status: null },
      contentVoteStatus: { status: null }
    };

    inclusionBehaviour = createVoteBehaviour('test-node-4', 'definition', {
      graphStore: mockGraphStore,
      metadataConfig: {
        nodeMetadata: mockMetadata,
        voteStatusKey: 'inclusionVoteStatus'
      }
    });

    contentBehaviour = createVoteBehaviour('test-node-4', 'definition', {
      graphStore: mockGraphStore,
      metadataConfig: {
        nodeMetadata: mockMetadata,
        voteStatusKey: 'contentVoteStatus'
      }
    });

    await inclusionBehaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await contentBehaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await inclusionBehaviour.handleVote('agree');
    await contentBehaviour.handleVote('disagree');

    expect(mockMetadata.inclusionVoteStatus.status).toBe('agree');
    expect(mockMetadata.contentVoteStatus.status).toBe('disagree');
  });
});

describe('voteBehaviour - Data Reactivity', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;
  let mockDataObject: any;
  let onDataUpdateCallback: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };

    mockDataObject = {
      inclusionPositiveVotes: 0,
      inclusionNegativeVotes: 0
    };

    onDataUpdateCallback = vi.fn();

    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
  });

  test('dataObject updates trigger onDataUpdate callback', async () => {
    behaviour = createVoteBehaviour('test-node-1', 'word', {
      graphStore: mockGraphStore,
      dataObject: mockDataObject,
      dataProperties: {
        positiveVotesKey: 'inclusionPositiveVotes',
        negativeVotesKey: 'inclusionNegativeVotes'
      },
      onDataUpdate: onDataUpdateCallback
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(onDataUpdateCallback).toHaveBeenCalled();
    expect(mockDataObject.inclusionPositiveVotes).toBe(1);
  });

  test('store updates propagate to voteStore', async () => {
    const mockVoteStore = {
      updateVoteData: vi.fn()
    };

    behaviour = createVoteBehaviour('test-node-2', 'word', {
      graphStore: mockGraphStore,
      voteStore: mockVoteStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(mockVoteStore.updateVoteData).toHaveBeenCalledWith(
      'test-node-2',
      1,
      0
    );
  });

  test('graphStore visibility recalculates', async () => {
    behaviour = createVoteBehaviour('test-node-3', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(mockGraphStore.recalculateNodeVisibility).toHaveBeenCalledWith(
      'test-node-3',
      1,
      0
    );
  });

  test('metadata object updates correctly', async () => {
    const mockMetadata = {
      inclusionVoteStatus: { status: null }
    };

    behaviour = createVoteBehaviour('test-node-4', 'word', {
      graphStore: mockGraphStore,
      metadataConfig: {
        nodeMetadata: mockMetadata,
        voteStatusKey: 'inclusionVoteStatus'
      }
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(mockMetadata.inclusionVoteStatus.status).toBe('agree');
  });
});

describe('voteBehaviour - Public Methods', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };

    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
  });

  test('getCurrentState returns complete state snapshot', async () => {
    behaviour = createVoteBehaviour('test-node-1', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 10, 
      negativeVotes: 3,
      skipVoteStatusFetch: true 
    });

    const state = behaviour.getCurrentState();

    expect(state).toEqual({
      userVoteStatus: 'none',
      positiveVotes: 10,
      negativeVotes: 3,
      netVotes: 7,
      totalVotes: 13,
      isVoting: false,
      voteSuccess: false,
      lastVoteType: null,
      error: null
    });
  });

  test('reset clears all state', async () => {
    behaviour = createVoteBehaviour('test-node-2', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 10, 
      negativeVotes: 3,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    behaviour.reset();

    const state = behaviour.getCurrentState();

    expect(state).toEqual({
      userVoteStatus: 'none',
      positiveVotes: 0,
      negativeVotes: 0,
      netVotes: 0,
      totalVotes: 0,
      isVoting: false,
      voteSuccess: false,
      lastVoteType: null,
      error: null
    });
  });

  test('updateFromExternalSource updates state without API call', () => {
    behaviour = createVoteBehaviour('test-node-3', 'word', {
      graphStore: mockGraphStore
    });

    behaviour.updateFromExternalSource({
      positiveVotes: 20,
      negativeVotes: 5,
      userVoteStatus: 'agree'
    });

    expect(get(behaviour.positiveVotes)).toBe(20);
    expect(get(behaviour.negativeVotes)).toBe(5);
    expect(get(behaviour.userVoteStatus)).toBe('agree');
    expect(fetchWithAuth).not.toHaveBeenCalled();
  });

  test('updateFromExternalSource handles Neo4j integers', () => {
    behaviour = createVoteBehaviour('test-node-4', 'word', {
      graphStore: mockGraphStore
    });

    behaviour.updateFromExternalSource({
      positiveVotes: { low: 25, high: 0 } as any,
      negativeVotes: { low: 8, high: 0 } as any
    });

    expect(get(behaviour.positiveVotes)).toBe(25);
    expect(get(behaviour.negativeVotes)).toBe(8);
  });

  test('updateFromExternalSource updates dataObject', () => {
    const mockDataObject = {
      inclusionPositiveVotes: 0,
      inclusionNegativeVotes: 0
    };

    behaviour = createVoteBehaviour('test-node-5', 'word', {
      graphStore: mockGraphStore,
      dataObject: mockDataObject,
      dataProperties: {
        positiveVotesKey: 'inclusionPositiveVotes',
        negativeVotesKey: 'inclusionNegativeVotes'
      }
    });

    behaviour.updateFromExternalSource({
      positiveVotes: 15,
      negativeVotes: 4
    });

    expect(mockDataObject.inclusionPositiveVotes).toBe(15);
    expect(mockDataObject.inclusionNegativeVotes).toBe(4);
  });
});

describe('voteBehaviour - Custom API Identifiers', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };

    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
  });

  test('uses custom apiIdentifier for API calls', async () => {
    behaviour = createVoteBehaviour('node-id-123', 'word', {
      graphStore: mockGraphStore,
      apiIdentifier: 'artificial intelligence',
      getVoteEndpoint: (word) => `/nodes/word/${encodeURIComponent(word)}/vote`
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(fetchWithAuth).toHaveBeenCalledWith(
      '/nodes/word/artificial%20intelligence/vote',
      expect.any(Object)
    );
  });

  test('apiIdentifier handles special characters', async () => {
    behaviour = createVoteBehaviour('node-id-456', 'word', {
      graphStore: mockGraphStore,
      apiIdentifier: 'C++ programming',
      getVoteEndpoint: (word) => `/nodes/word/${encodeURIComponent(word)}/vote`
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    expect(fetchWithAuth).toHaveBeenCalledWith(
      '/nodes/word/C%2B%2B%20programming/vote',
      expect.any(Object)
    );
  });
});

describe('voteBehaviour - Rate Limiting', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };

    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
  });

  test('tracks last vote time', async () => {
    behaviour = createVoteBehaviour('test-node-1', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    await behaviour.handleVote('agree');

    const state = behaviour.getCurrentState();
    // voteSuccess is true immediately after vote, then resets after 1 second
    // Since we don't wait, it should still be true
    expect(state.voteSuccess).toBe(true);
  });
});

describe('voteBehaviour - Success Animation', () => {
  let behaviour: VoteBehaviour;
  let mockGraphStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockGraphStore = {
      recalculateNodeVisibility: vi.fn(),
      updateNodeVisibility: vi.fn()
    };

    (fetchWithAuth as any).mockResolvedValue({
      positiveVotes: 1,
      negativeVotes: 0,
      netVotes: 1
    });
  });

  afterEach(() => {
    if (behaviour) {
      behaviour.reset();
    }
    vi.useRealTimers();
  });

  test('triggers success animation on successful vote', async () => {
    behaviour = createVoteBehaviour('test-node-1', 'word', {
      graphStore: mockGraphStore
    });

    await behaviour.initialize({ 
      positiveVotes: 0, 
      negativeVotes: 0,
      skipVoteStatusFetch: true 
    });

    const votePromise = behaviour.handleVote('agree');
    await votePromise;

    expect(get(behaviour.voteSuccess)).toBe(true);
    expect(get(behaviour.lastVoteType)).toBe('agree');

    // Advance timer past animation duration
    vi.advanceTimersByTime(1000);

    expect(get(behaviour.voteSuccess)).toBe(false);
    expect(get(behaviour.lastVoteType)).toBe(null);
  });
});