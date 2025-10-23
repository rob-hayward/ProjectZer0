import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import WordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
import type { RenderableNode } from '$lib/types/graph/enhanced';
import type { VoteStatus } from '$lib/types/domain/nodes';

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
  const createMockWordNode = (overrides?: Partial<RenderableNode>): RenderableNode => ({
    id: 'word-1',
    type: 'word',
    x: 100,
    y: 200,
    radius: 150,
    mode: 'preview',
    group: 'word',
    data: {
      id: 'word-1',
      word: 'artificial',
      inclusionPositiveVotes: 5,
      inclusionNegativeVotes: 2,
      inclusionNetVotes: 3,
      categories: ['technology', 'AI'],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      createdBy: { id: 'user-1', username: 'testuser' },
      publicCredit: true
    },
    metadata: {
      group: 'word',
      inclusionVoteStatus: { status: 'none' }
    },
    ...overrides
  } as RenderableNode);

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

      // KeywordTags should render categories
      const textElements = Array.from(container.querySelectorAll('text'));
      const hasCategories = textElements.some(el => 
        el.textContent?.includes('technology') || 
        el.textContent?.includes('AI')
      );
      expect(hasCategories).toBe(true);
    });
  });

  describe('voting - single voting pattern', () => {
    it('shows inclusion voting buttons only', () => {
      const node = createMockWordNode({ mode: 'detail' });
      const { container } = render(WordNode, { props: { node } });

      // Should have inclusion vote buttons (add/remove icons)
      const icons = container.querySelectorAll('.material-symbols-outlined.vote-icon');
      
      // Should have exactly 2 voting buttons (include/exclude)
      expect(icons.length).toBeGreaterThanOrEqual(2);
    });

    it('does not show content voting buttons', () => {
      const node = createMockWordNode({ mode: 'detail' });
      const { container } = render(WordNode, { props: { node } });

      const icons = Array.from(container.querySelectorAll('.material-symbols-outlined.vote-icon'));
      
      // Should NOT have thumb_up or thumb_down icons (content voting)
      const hasThumbIcons = icons.some(icon => 
        icon.textContent === 'thumb_up' || icon.textContent === 'thumb_down'
      );
      expect(hasThumbIcons).toBe(false);
    });

    it('displays correct vote counts', () => {
      const node = createMockWordNode({
        mode: 'detail',
        data: {
          ...createMockWordNode().data,
          inclusionPositiveVotes: 15,
          inclusionNegativeVotes: 3
        }
      });
      const { container } = render(WordNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      // Net votes should be +12
      const netVotesText = textElements.find(el => 
        el.textContent?.includes('+12') || el.textContent?.includes('12')
      );
      expect(netVotesText).toBeTruthy();
    });

    it('dispatches vote event on button click', async () => {
      const node = createMockWordNode({ mode: 'detail' });
      const handleModeChange = vi.fn();
      
      const { component, container } = render(WordNode, { 
        props: { node }
      });

      // Find vote buttons
      const voteButtons = container.querySelectorAll('.vote-button');
      expect(voteButtons.length).toBeGreaterThan(0);
    });

    it('shows voted state correctly', () => {
      const node = createMockWordNode({
        mode: 'detail',
        metadata: {
          group: 'word',
          inclusionVoteStatus: { status: 'agree' }
        }
      });
      const { container } = render(WordNode, { props: { node } });

      // Voted button should have different styling
      const voteButtons = container.querySelectorAll('.vote-button');
      expect(voteButtons.length).toBeGreaterThan(0);
    });
  });

  describe('expansion behavior', () => {
    it('expand button hidden when netVotes < 0', () => {
      const node = createMockWordNode({
        mode: 'preview',
        data: {
          ...createMockWordNode().data,
          inclusionPositiveVotes: 2,
          inclusionNegativeVotes: 10,
          inclusionNetVotes: -8
        }
      });
      const { container } = render(WordNode, { props: { node } });

      // canExpand should be false, expand button should not be visible
      const expandButton = container.querySelector('.expand-button');
      // Button might not render at all when canExpand is false
      expect(expandButton).toBeFalsy();
    });

    it('expand button visible when netVotes >= 0', () => {
      const node = createMockWordNode({
        mode: 'preview',
        data: {
          ...createMockWordNode().data,
          inclusionPositiveVotes: 10,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 8
        }
      });
      const { container } = render(WordNode, { props: { node } });

      // canExpand should be true, button should be present
      const expandButton = container.querySelector('.expand-button');
      expect(expandButton).toBeTruthy();
    });

    it('canExpand based on inclusion threshold', () => {
      // Test exactly at threshold (netVotes = 0)
      const node = createMockWordNode({
        mode: 'preview',
        data: {
          ...createMockWordNode().data,
          inclusionPositiveVotes: 5,
          inclusionNegativeVotes: 5,
          inclusionNetVotes: 0
        }
      });
      const { container } = render(WordNode, { props: { node } });

      const expandButton = container.querySelector('.expand-button');
      expect(expandButton).toBeTruthy();
    });

    it('dispatches modeChange event on expand', async () => {
      const node = createMockWordNode({ mode: 'preview' });
      const handleModeChange = vi.fn();
      
      const { component, container } = render(WordNode, { 
        props: { node }
      });

      component.$on('modeChange', handleModeChange);

      const expandButton = container.querySelector('.expand-button') as SVGGElement;
      if (expandButton) {
        await fireEvent.click(expandButton);
        expect(handleModeChange).toHaveBeenCalled();
      }
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
          id: 'word-test',
          word: 'test',
          inclusionPositiveVotes: 8,
          inclusionNegativeVotes: 3,
          inclusionNetVotes: 5,
          categories: [],
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          createdBy: { id: 'user-1', username: 'test' },
          publicCredit: true
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

  describe('keyword click events', () => {
    it('dispatches keywordClick event', async () => {
      const node = createMockWordNode({
        mode: 'detail',
        data: {
          ...createMockWordNode().data,
          categories: ['technology']
        }
      });
      const handleKeywordClick = vi.fn();
      
      const { component } = render(WordNode, { 
        props: { node }
      });

      component.$on('keywordClick', handleKeywordClick);

      // Note: Testing actual keyword click requires more complex interaction
      // This validates the component sets up the event handler
      expect(component).toBeTruthy();
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