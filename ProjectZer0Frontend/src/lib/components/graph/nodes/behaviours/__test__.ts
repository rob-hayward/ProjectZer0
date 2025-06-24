// src/lib/components/graph/nodes/behaviours/__test__.ts
// This is a test file to verify TypeScript compilation

import { createVoteBehaviour, createVisibilityBehaviour, createModeBehaviour, createDataBehaviour } from './index';
import type { VoteBehaviourOptions, VoteBehaviourState } from './voteBehaviour';
import type { VoteStatus } from '$lib/types/domain/nodes';

// Test vote behaviour creation
function testVoteBehaviour() {
  const options: VoteBehaviourOptions = {
    voteStore: null,
    graphStore: null,
    getVoteEndpoint: (id: string) => `/test/${id}/vote`,
    getRemoveVoteEndpoint: (id: string) => `/test/${id}/vote/remove`
  };

  const voteBehaviour = createVoteBehaviour('test-node', 'word', options);
  
  // Test state access
  voteBehaviour.userVoteStatus.subscribe((status: VoteStatus) => {
    console.log('Vote status:', status);
  });

  // Test methods
  voteBehaviour.initialize().then(() => {
  });

  return voteBehaviour;
}

// Test visibility behaviour
function testVisibilityBehaviour() {
  const visibilityBehaviour = createVisibilityBehaviour('test-node', {
    communityThreshold: -1
  });

  return visibilityBehaviour;
}

// Test mode behaviour
function testModeBehaviour() {
  const modeBehaviour = createModeBehaviour('preview', {
    allowModeChange: true
  });

  return modeBehaviour;
}

// Test data behaviour
function testDataBehaviour() {
  const dataBehaviour = createDataBehaviour('word', { text: 'test' }, {
    transformData: (data: any) => ({ ...data, processed: true })
  });

  return dataBehaviour;
}

// Export tests for potential use
export {
  testVoteBehaviour,
  testVisibilityBehaviour,
  testModeBehaviour,
  testDataBehaviour
};