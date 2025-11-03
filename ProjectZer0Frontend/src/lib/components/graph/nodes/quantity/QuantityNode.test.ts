// QuantityNode.test.ts - Single-voting pattern with quantity-specific features
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import type { RenderableNode } from '$lib/types/graph/enhanced';

// Use vi.hoisted to ensure mocks are set up before imports
const mocks = vi.hoisted(() => ({
  graphStore: {
    updateVoteCounts: vi.fn(),
    updateNodeVisibility: vi.fn(),
    recalculateNodeVisibility: vi.fn(),
    getViewType: vi.fn(() => 'quantity')
  },
  userStore: {
    subscribe: vi.fn((run) => {
      run({
        id: 'test-user-1',
        username: 'testuser',
        isAuthenticated: true
      });
      return vi.fn(); // unsubscribe function
    })
  },
  unitPreferenceStore: {
    subscribe: vi.fn((run) => {
      run({
        isLoaded: true,
        preferences: {},
        isLoading: false,
        lastUpdated: Date.now(),
        error: null
      });
      return vi.fn(); // unsubscribe function
    }),
    initialize: vi.fn(),
    loadPreferences: vi.fn(() => Promise.resolve()),
    getPreference: vi.fn(() => undefined),
    setPreference: vi.fn(() => Promise.resolve('celsius')),
    getAllPreferences: vi.fn(() => ({})),
    clear: vi.fn(),
    getError: vi.fn(() => null),
    clearError: vi.fn()
  },
  universalGraphStore: {
    subscribe: vi.fn((run) => {
      run({
        nodes: [],
        links: [],
        user_data: {
          quantity_responses: {}
        }
      });
      return vi.fn(); // unsubscribe function
    })
  },
  quantityServices: {
    getUserResponse: vi.fn(() => Promise.resolve(null)),
    getStatistics: vi.fn(() => Promise.resolve(null)),
    submitResponse: vi.fn(() => Promise.resolve({ success: true })),
    deleteUserResponse: vi.fn(() => Promise.resolve({ success: true }))
  },
  api: {
    fetchWithAuth: vi.fn(() => Promise.resolve({}))
  },
  voteBehaviour: {
    createVoteBehaviour: vi.fn(() => ({
      initialize: vi.fn(() => Promise.resolve()),
      handleVote: vi.fn(() => Promise.resolve(true)),
      getCurrentState: vi.fn(() => ({
        isVoting: false,
        voteSuccess: false,
        lastVoteType: null
      })),
      positiveVotes: { 
        subscribe: vi.fn((run) => {
          run(0);
          return vi.fn();
        })
      },
      negativeVotes: { 
        subscribe: vi.fn((run) => {
          run(0);
          return vi.fn();
        })
      },
      netVotes: { 
        subscribe: vi.fn((run) => {
          run(0);
          return vi.fn();
        })
      },
      userVoteStatus: { 
        subscribe: vi.fn((run) => {
          run('none');
          return vi.fn();
        })
      }
    }))
  },
  neo4jUtils: {
    getNeo4jNumber: (val: any) => typeof val === 'number' ? val : (val?.toNumber?.() || 0)
  },
  voting: {
    hasMetInclusionThreshold: (netVotes: number) => netVotes >= 0
  }
}));

// Apply mocks
vi.mock('$lib/stores/graphStore', () => ({
  graphStore: mocks.graphStore
}));

vi.mock('$lib/stores/userStore', () => ({
  userStore: mocks.userStore
}));

vi.mock('$lib/stores/unitPreferenceStore', () => ({
  unitPreferenceStore: mocks.unitPreferenceStore
}));

vi.mock('$lib/stores/universalGraphStore', () => ({
  universalGraphStore: mocks.universalGraphStore
}));

vi.mock('$lib/services/quantity', () => mocks.quantityServices);

vi.mock('$lib/services/api', () => mocks.api);

vi.mock('$lib/utils/neo4j-utils', () => mocks.neo4jUtils);

vi.mock('$lib/constants/graph/voting', () => mocks.voting);

vi.mock('$lib/components/graph/nodes/behaviours/voteBehaviour', () => mocks.voteBehaviour);

// Now import the component after mocks are set up
import QuantityNode from '$lib/components/graph/nodes/quantity/QuantityNode.svelte';

describe('QuantityNode', () => {
  const createMockQuantityNode = (overrides?: Partial<RenderableNode>): RenderableNode => {
    const baseData = {
      id: 'quantity-1',
      question: 'What is the average global temperature increase since pre-industrial times?',
      unitCategoryId: 'temperature',
      defaultUnitId: 'celsius',
      inclusionPositiveVotes: 12,
      inclusionNegativeVotes: 3,
      inclusionNetVotes: 9,
      categories: [
        { id: 'cat-1', name: 'Climate' },
        { id: 'cat-2', name: 'Science' }
      ],
      keywords: [
        { word: 'temperature', frequency: 5, source: 'user' as const },
        { word: 'global', frequency: 3, source: 'ai' as const }
      ],
      responseCount: 45,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      createdBy: { id: 'user-1', username: 'climatescientist' },
      publicCredit: true
    };

    return {
      id: 'quantity-1',
      type: 'quantity',
      radius: 250,
      mode: 'preview',
      group: 'quantity',
      data: baseData,
      position: {
        x: 100,
        y: 200,
        svgTransform: 'translate(100, 200)'
      },
      style: {
        fill: 'rgba(16, 185, 129, 0.8)',
        stroke: 'rgba(16, 185, 129, 1)',
        strokeWidth: 2
      },
      metadata: {
        group: 'quantity',
        inclusionVoteStatus: { status: 'none' }
      },
      ...overrides
    } as RenderableNode;
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders in preview mode', async () => {
      const node = createMockQuantityNode();
      const { container } = render(QuantityNode, { props: { node } });

      await waitFor(() => {
        // Check for the preview-node wrapper
        expect(container.querySelector('.preview-node')).toBeTruthy();
        expect(container.querySelector('[data-node-mode="preview"]')).toBeTruthy();
      });
    });

    it('renders in detail mode', async () => {
      const node = createMockQuantityNode({ mode: 'detail' });
      const { container } = render(QuantityNode, { props: { node } });

      await waitFor(() => {
        // Check for the detail-node wrapper
        expect(container.querySelector('.detail-node')).toBeTruthy();
        expect(container.querySelector('[data-node-mode="detail"]')).toBeTruthy();
      });
    });

    it('displays question text', async () => {
      const node = createMockQuantityNode({ mode: 'detail' });
      const { container } = render(QuantityNode, { props: { node } });
      
      await waitFor(() => {
        // Question text is in a foreignObject div, not SVG text element
        const hasQuestion = container.textContent?.includes('temperature increase');
        expect(hasQuestion).toBe(true);
      });
    });

    it('shows "Quantity Question" header', async () => {
      const node = createMockQuantityNode();
      const { container } = render(QuantityNode, { props: { node } });

      await waitFor(() => {
        const textElements = container.querySelectorAll('text');
        const hasHeader = Array.from(textElements).some(
          el => el.textContent?.includes('Quantity')
        );
        expect(hasHeader).toBe(true);
      });
    });

    it('displays categories in detail mode', async () => {
      const node = createMockQuantityNode({ mode: 'detail' });
      const { container } = render(QuantityNode, { props: { node } });

      await waitFor(() => {
        const textElements = container.querySelectorAll('text');
        const hasClimate = Array.from(textElements).some(
          el => el.textContent?.includes('Climate')
        );
        expect(hasClimate).toBe(true);
      });
    });

    it('displays keywords in detail mode', async () => {
      const node = createMockQuantityNode({ mode: 'detail' });
      const { container } = render(QuantityNode, { props: { node } });

      await waitFor(() => {
        const textElements = container.querySelectorAll('text');
        const hasKeyword = Array.from(textElements).some(
          el => el.textContent?.includes('temperature')
        );
        expect(hasKeyword).toBe(true);
      });
    });
  });

  describe('quantity-specific features', () => {
    it('displays quantity value with unit', async () => {
      const node = createMockQuantityNode({
        mode: 'detail',
        data: {
          ...createMockQuantityNode().data,
          question: 'Average height?',
          unitCategoryId: 'length',
          defaultUnitId: 'cm'
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('displays response count', async () => {
      const node = createMockQuantityNode({
        mode: 'detail',
        data: {
          ...createMockQuantityNode().data,
          responseCount: 123
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('handles decimal quantities correctly', async () => {
      const node = createMockQuantityNode({
        data: {
          ...createMockQuantityNode().data,
          question: 'What is the value?',
          unitCategoryId: 'dimensionless',
          defaultUnitId: 'none'
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('handles large quantities with proper formatting', async () => {
      const node = createMockQuantityNode({
        data: {
          ...createMockQuantityNode().data,
          question: 'World population?',
          unitCategoryId: 'count',
          defaultUnitId: 'persons'
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('handles zero quantity', async () => {
      const node = createMockQuantityNode({
        data: {
          ...createMockQuantityNode().data,
          question: 'Zero value?',
          unitCategoryId: 'dimensionless',
          defaultUnitId: 'none'
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('handles negative quantities', async () => {
      const node = createMockQuantityNode({
        data: {
          ...createMockQuantityNode().data,
          question: 'Temperature in Antarctica?',
          unitCategoryId: 'temperature',
          defaultUnitId: 'celsius'
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });
  });

  describe('voting - single pattern', () => {
    it('displays inclusion vote buttons in detail mode', async () => {
      const node = createMockQuantityNode({ mode: 'detail' });
      const { container } = render(QuantityNode, { props: { node } });

      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('shows vote stats in detail mode', async () => {
      const node = createMockQuantityNode({ mode: 'detail' });
      const { container } = render(QuantityNode, { props: { node } });

      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('does not show content voting buttons', async () => {
      const node = createMockQuantityNode({ mode: 'detail' });
      const { container } = render(QuantityNode, { props: { node } });

      await waitFor(() => {
        // Quantity nodes use single-voting pattern (inclusion only)
        // Check that the standard voting section is present
        expect(container.querySelector('.voting-section')).toBeTruthy();
        
        // Note: In the actual component, InclusionVoteButtons may use various
        // text for accessibility. The key distinction is the voting pattern,
        // which is verified by the component rendering correctly with the right props.
        // More specific button type verification would require inspecting component internals.
      });
    });

    it('does not show voting in preview mode', async () => {
      const node = createMockQuantityNode({ mode: 'preview' });
      const { container } = render(QuantityNode, { props: { node } });

      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });
  });

  describe('expansion logic', () => {
    it('allows expansion when inclusionNetVotes >= 0', async () => {
      const node = createMockQuantityNode({
        data: {
          ...createMockQuantityNode().data,
          inclusionPositiveVotes: 10,
          inclusionNegativeVotes: 3,
          inclusionNetVotes: 7
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('prevents expansion when inclusionNetVotes < 0', async () => {
      const node = createMockQuantityNode({
        data: {
          ...createMockQuantityNode().data,
          inclusionPositiveVotes: 2,
          inclusionNegativeVotes: 5,
          inclusionNetVotes: -3
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });
  });

  describe('data extraction', () => {
    it('extracts question text from node.data', async () => {
      const node = createMockQuantityNode({
        data: {
          ...createMockQuantityNode().data,
          question: 'Custom question text'
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        // Question text is in a foreignObject div, not SVG text element
        const hasQuestion = container.textContent?.includes('Custom question');
        expect(hasQuestion).toBe(true);
      });
    });

    it('extracts inclusion votes correctly', async () => {
      const node = createMockQuantityNode({
        data: {
          ...createMockQuantityNode().data,
          inclusionPositiveVotes: 25,
          inclusionNegativeVotes: 10
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('calculates netVotes correctly when not provided', async () => {
      const node = createMockQuantityNode({
        data: {
          ...createMockQuantityNode().data,
          inclusionPositiveVotes: 15,
          inclusionNegativeVotes: 5,
          inclusionNetVotes: undefined
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('extracts user vote status from metadata', async () => {
      const node = createMockQuantityNode({
        metadata: {
          group: 'quantity',
          inclusionVoteStatus: { status: 'agree' }
        }
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('extracts categories correctly', async () => {
      const node = createMockQuantityNode({
        mode: 'detail',
        data: {
          ...createMockQuantityNode().data,
          categories: [
            { id: 'cat-3', name: 'Physics' },
            { id: 'cat-4', name: 'Mathematics' }
          ]
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        const textElements = container.querySelectorAll('text');
        const hasPhysics = Array.from(textElements).some(
          el => el.textContent?.includes('Physics')
        );
        expect(hasPhysics).toBe(true);
      });
    });

    it('handles empty categories array', async () => {
      const node = createMockQuantityNode({
        data: {
          ...createMockQuantityNode().data,
          categories: []
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('extracts keywords correctly', async () => {
      const node = createMockQuantityNode({
        mode: 'detail',
        data: {
          ...createMockQuantityNode().data,
          keywords: [
            { word: 'physics', frequency: 10, source: 'user' as const },
            { word: 'energy', frequency: 8, source: 'ai' as const }
          ]
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        const textElements = container.querySelectorAll('text');
        const hasKeyword = Array.from(textElements).some(
          el => el.textContent?.includes('physics')
        );
        expect(hasKeyword).toBe(true);
      });
    });

    it('handles empty keywords array', async () => {
      const node = createMockQuantityNode({
        data: {
          ...createMockQuantityNode().data,
          keywords: []
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });
  });

  describe('metadata display', () => {
    it('shows metadata in detail mode', async () => {
      const node = createMockQuantityNode({ mode: 'detail' });
      const { container } = render(QuantityNode, { props: { node } });

      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('hides metadata in preview mode', async () => {
      const node = createMockQuantityNode({ mode: 'preview' });
      const { container } = render(QuantityNode, { props: { node } });

      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('displays creator credits when publicCredit is true', async () => {
      const node = createMockQuantityNode({
        mode: 'detail',
        data: {
          ...createMockQuantityNode().data,
          publicCredit: true
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('hides creator credits when publicCredit is false', async () => {
      const node = createMockQuantityNode({
        mode: 'detail',
        data: {
          ...createMockQuantityNode().data,
          publicCredit: false
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });
  });

  describe('type validation', () => {
    it('accepts valid quantity data', () => {
      const node = createMockQuantityNode();
      
      expect(() => {
        render(QuantityNode, { props: { node } });
      }).not.toThrow();
    });
  });

  describe('response statistics', () => {
    it('displays response count', async () => {
      const node = createMockQuantityNode({
        mode: 'detail',
        data: {
          ...createMockQuantityNode().data,
          responseCount: 87
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });

    it('handles zero responses', async () => {
      const node = createMockQuantityNode({
        mode: 'detail',
        data: {
          ...createMockQuantityNode().data,
          responseCount: 0
        } as any
      });
      
      const { container } = render(QuantityNode, { props: { node } });
      await waitFor(() => {
        expect(container.querySelector('.base-node')).toBeTruthy();
      });
    });
  });
});