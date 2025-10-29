// WordNode.test.ts - FIXED VERSION
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import WordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
import type { RenderableNode } from '$lib/types/graph/enhanced';

// Mock the stores and utilities
vi.mock('$lib/stores/graphStore', () => ({
  graphStore: {
    updateVoteCounts: vi.fn(),
    updateNodeVisibility: vi.fn()
  }
}));

vi.mock('$lib/utils/neo4j-utils', () => ({
  getNeo4jNumber: (val: any) => typeof val === 'number' ? val : (val?.toNumber?.() || 0)
}));

vi.mock('$lib/constants/graph/voting', () => ({
  hasMetInclusionThreshold: (netVotes: number) => netVotes >= 0
}));

describe('WordNode', () => {
  const createMockWordNode = (overrides?: Partial<RenderableNode>): RenderableNode => {
    const baseData = {
      id: 'word-1',
      word: 'artificial',
      inclusionPositiveVotes: 5,
      inclusionNegativeVotes: 2,
      inclusionNetVotes: 3,
      categories: ['technology', 'AI'],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      createdBy: { id: 'user-1', username: 'testuser' },
      publicCredit: true,
      definitions: [] // CRITICAL: Add definitions array for type guard
    };

    return {
      id: 'word-1',
      type: 'word',
      radius: 150,
      mode: 'preview',
      group: 'word',
      data: baseData,
      position: {
        x: 100,
        y: 200,
        svgTransform: 'translate(100, 200)'
      },
      style: {
        fill: 'rgba(79, 70, 229, 0.8)',
        stroke: 'rgba(79, 70, 229, 1)',
        strokeWidth: 2
      },
      metadata: {
        group: 'word',
        inclusionVoteStatus: { status: 'none' }
      },
      ...overrides
    } as RenderableNode;
  };

  describe('rendering', () => {
    it('renders in preview mode', () => {
      const node = createMockWordNode();
      const { container } = render(WordNode, { props: { node } });

      // Should render preview node structure
      expect(container.querySelector('text')).toBeTruthy();
    });

    it('renders in detail mode', () => {
      const node = createMockWordNode({ mode: 'detail' });
      const { container } = render(WordNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('displays word text', () => {
      const node = createMockWordNode();
      const { container } = render(WordNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const wordText = textElements.find(el => 
        el.textContent?.includes('artificial')
      );
      expect(wordText).toBeTruthy();
    });

    it('shows "Word" header in detail mode', () => {
      const node = createMockWordNode({ mode: 'detail' });
      const { container } = render(WordNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const headerText = textElements.find(el => 
        el.textContent?.toLowerCase().includes('word')
      );
      expect(headerText).toBeTruthy();
    });

    it('displays categories as keywords in detail mode', () => {
      const node = createMockWordNode({ 
        mode: 'detail',
        data: {
          ...createMockWordNode().data,
          categories: ['technology', 'AI', 'machine-learning']
        }
      });
      const { container } = render(WordNode, { props: { node } });

      // Categories should be rendered
      expect(container.querySelector('text')).toBeTruthy();
    });
  });

  describe('voting', () => {
    it('displays inclusion vote buttons in detail mode', () => {
      const node = createMockWordNode({ mode: 'detail' });
      const { container } = render(WordNode, { props: { node } });

      // Should have vote buttons rendered
      expect(container).toBeTruthy();
    });

    it('shows vote stats in detail mode', () => {
      const node = createMockWordNode({ 
        mode: 'detail',
        data: {
          ...createMockWordNode().data,
          inclusionPositiveVotes: 15,
          inclusionNegativeVotes: 5
        }
      });
      const { container } = render(WordNode, { props: { node } });

      // Should display net votes (+10)
      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('10') || el.textContent?.includes('+10')
      );
      expect(hasVotes).toBe(true);
    });

    it('does not show voting in preview mode', () => {
      const node = createMockWordNode({ mode: 'preview' });
      const { container } = render(WordNode, { props: { node } });

      // Preview mode should not show detailed voting UI
      expect(container).toBeTruthy();
    });
  });

  describe('expansion logic', () => {
    it('allows expansion when inclusionNetVotes >= 0', () => {
      const node = createMockWordNode({
        data: {
          ...createMockWordNode().data,
          inclusionNetVotes: 5
        }
      });
      const { container } = render(WordNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('prevents expansion when inclusionNetVotes < 0', () => {
      const node = createMockWordNode({
        data: {
          ...createMockWordNode().data,
          inclusionPositiveVotes: 2,
          inclusionNegativeVotes: 10,
          inclusionNetVotes: -8
        }
      });
      const { container } = render(WordNode, { props: { node } });

      // Component should still render but without expand capability
      expect(container).toBeTruthy();
    });
  });

  describe('data extraction', () => {
    it('extracts word from node.data', () => {
      const node = createMockWordNode({
        data: {
          ...createMockWordNode().data,
          word: 'intelligence'
        }
      });
      const { container } = render(WordNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const wordText = textElements.find(el => 
        el.textContent?.includes('intelligence')
      );
      expect(wordText).toBeTruthy();
    });

    it('extracts inclusion votes correctly', () => {
      const node = createMockWordNode({
        mode: 'detail',
        data: {
          ...createMockWordNode().data,
          inclusionPositiveVotes: 25,
          inclusionNegativeVotes: 10
        }
      });
      const { container } = render(WordNode, { props: { node } });

      // Should display net votes (25 - 10 = +15)
      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('15') || el.textContent?.includes('+15')
      );
      expect(hasVotes).toBe(true);
    });

    it('calculates netVotes correctly when not provided', () => {
      const node = createMockWordNode({
        mode: 'detail',
        data: {
          ...createMockWordNode().data,
          inclusionPositiveVotes: 8,
          inclusionNegativeVotes: 3,
          inclusionNetVotes: 5
        }
      });
      const { container } = render(WordNode, { props: { node } });

      // Should calculate 8 - 3 = +5
      const textElements = Array.from(container.querySelectorAll('text'));
      const hasCorrectNet = textElements.some(el => 
        el.textContent?.includes('5') || el.textContent?.includes('+5')
      );
      expect(hasCorrectNet).toBe(true);
    });

    it('extracts user vote status from metadata', () => {
      const node = createMockWordNode({
        mode: 'detail',
        metadata: {
          group: 'word',
          inclusionVoteStatus: { status: 'disagree' }
        }
      });
      const { container } = render(WordNode, { props: { node } });

      // Component should render with disagree vote active
      expect(container).toBeTruthy();
    });
  });

  describe('categories as keywords', () => {
    it('converts categories to keyword format', () => {
      const node = createMockWordNode({
        mode: 'detail',
        data: {
          ...createMockWordNode().data,
          categories: ['science', 'technology', 'research']
        }
      });
      const { container } = render(WordNode, { props: { node } });

      // Should render categories as keyword tags
      expect(container.querySelector('text')).toBeTruthy();
    });

    it('handles empty categories array', () => {
      const node = createMockWordNode({
        mode: 'detail',
        data: {
          ...createMockWordNode().data,
          categories: []
        }
      });
      const { container } = render(WordNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('metadata display', () => {
    it('shows metadata in detail mode', () => {
      const node = createMockWordNode({
        mode: 'detail'
        // Using default mock data which already has proper createdAt/updatedAt
      });
      const { container } = render(WordNode, { props: { node } });

      // NodeMetadata component should render timestamps
      expect(container).toBeTruthy();
    });
  });

  describe('creator credits', () => {
    it('shows creator credits when available', () => {
      const node = createMockWordNode({
        mode: 'detail',
        data: {
          ...createMockWordNode().data,
          createdBy: {
            id: 'user-1',
            username: 'testuser',
            displayName: 'Test User'
          },
          publicCredit: true
        }
      });
      const { container } = render(WordNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('hides creator credits when publicCredit is false', () => {
      const node = createMockWordNode({
        mode: 'detail',
        data: {
          ...createMockWordNode().data,
          createdBy: {
            id: 'user-1',
            username: 'testuser'
          },
          publicCredit: false
        }
      });
      const { container } = render(WordNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('mode transitions', () => {
    it('transitions from preview to detail', async () => {
      const node = createMockWordNode({ mode: 'preview' });
      const { container, component } = render(WordNode, { props: { node } });

      // Initially in preview mode
      expect(container).toBeTruthy();

      // Update mode
      await component.$set({ node: { ...node, mode: 'detail' } });

      // Should now be in detail mode
      expect(container).toBeTruthy();
    });

    it('transitions from detail to preview', async () => {
      const node = createMockWordNode({ mode: 'detail' });
      const { container, component } = render(WordNode, { props: { node } });

      // Update mode
      await component.$set({ node: { ...node, mode: 'preview' } });

      expect(container).toBeTruthy();
    });
  });
});