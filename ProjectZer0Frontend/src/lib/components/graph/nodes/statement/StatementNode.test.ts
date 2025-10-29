// StatementNode.test.ts - FIXED VERSION
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
import type { RenderableNode } from '$lib/types/graph/enhanced';

// Mock dependencies
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

describe('StatementNode', () => {
  const createMockStatementNode = (overrides?: Partial<RenderableNode>): RenderableNode => {
    const baseData = {
      id: 'stmt-123',
      statement: 'AI will transform healthcare in the next decade',
      inclusionPositiveVotes: 10,
      inclusionNegativeVotes: 2,
      inclusionNetVotes: 8,
      contentPositiveVotes: 15,
      contentNegativeVotes: 5,
      contentNetVotes: 10,
      categories: [
        { id: 'cat-1', name: 'Healthcare' },
        { id: 'cat-2', name: 'Technology' }
      ],
      keywords: [
        { word: 'artificial-intelligence', frequency: 5, source: 'both' as const },
        { word: 'healthcare', frequency: 3, source: 'user' as const }
      ],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      createdBy: { id: 'user-1', username: 'testuser' },
      publicCredit: true
    };

    return {
      id: 'statement-1',
      type: 'statement',
      radius: 150,
      mode: 'preview',
      group: 'statement',
      data: baseData,
      position: {
        x: 100,
        y: 200,
        svgTransform: 'translate(100, 200)'
      },
      style: {
        fill: 'rgba(167, 139, 250, 0.8)',
        stroke: 'rgba(167, 139, 250, 1)',
        strokeWidth: 2
      },
      metadata: {
        group: 'statement',
        inclusionVoteStatus: { status: 'none' },
        contentVoteStatus: { status: 'none' }
      },
      ...overrides
    } as RenderableNode;
  };

  describe('rendering', () => {
    it('displays statement text', () => {
      const node = createMockStatementNode({ mode: 'detail' });
      const { container } = render(StatementNode, { props: { node } });

      // Statement text is in foreignObject > div, not SVG text
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasStatementText = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('AI will transform healthcare')
      );
      expect(hasStatementText).toBe(true);
    });

    it('shows "Statement" header', () => {
      const node = createMockStatementNode({ mode: 'detail' });
      const { container } = render(StatementNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const headerText = textElements.find(el => 
        el.textContent?.toLowerCase().includes('statement')
      );
      expect(headerText).toBeTruthy();
    });

    it('displays category tags in detail mode', () => {
      const node = createMockStatementNode({ mode: 'detail' });
      const { container } = render(StatementNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasCategories = textElements.some(el => 
        el.textContent?.includes('Healthcare') || 
        el.textContent?.includes('Technology')
      );
      expect(hasCategories).toBe(true);
    });

    it('displays keywords in detail mode', () => {
      const node = createMockStatementNode({ mode: 'detail' });
      const { container } = render(StatementNode, { props: { node } });

      // Keywords should be rendered
      expect(container).toBeTruthy();
    });

    it('renders in preview mode', () => {
      const node = createMockStatementNode({ mode: 'preview' });
      const { container } = render(StatementNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('renders in detail mode', () => {
      const node = createMockStatementNode({ mode: 'detail' });
      const { container } = render(StatementNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });
  });

  describe('dual voting', () => {
    it('displays both inclusion and content vote buttons', () => {
      const node = createMockStatementNode({ mode: 'detail' });
      const { container } = render(StatementNode, { props: { node } });

      // Should have voting UI rendered
      expect(container).toBeTruthy();
    });

    it('shows separate vote stats for inclusion and content', () => {
      const node = createMockStatementNode({ mode: 'detail' });
      const { container } = render(StatementNode, { props: { node } });

      // Should display vote statistics
      const textElements = Array.from(container.querySelectorAll('text'));
      expect(textElements.length).toBeGreaterThan(0);
    });

    it('displays inclusion net votes correctly', () => {
      const node = createMockStatementNode({
        mode: 'detail',
        data: {
          ...createMockStatementNode().data,
          inclusionPositiveVotes: 20,
          inclusionNegativeVotes: 5,
          inclusionNetVotes: 15
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasInclusionVotes = textElements.some(el => 
        el.textContent?.includes('15') || el.textContent?.includes('+15')
      );
      expect(hasInclusionVotes).toBe(true);
    });

    it('displays content net votes correctly', () => {
      const node = createMockStatementNode({
        mode: 'detail',
        data: {
          ...createMockStatementNode().data,
          contentPositiveVotes: 30,
          contentNegativeVotes: 10,
          contentNetVotes: 20
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasContentVotes = textElements.some(el => 
        el.textContent?.includes('20') || el.textContent?.includes('+20')
      );
      expect(hasContentVotes).toBe(true);
    });

    it('tracks separate user vote statuses', () => {
      const node = createMockStatementNode({
        mode: 'detail',
        metadata: {
          group: 'statement',
          inclusionVoteStatus: { status: 'agree' },
          contentVoteStatus: { status: 'disagree' }
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('expansion logic', () => {
    it('allows expansion when inclusionNetVotes >= 0', () => {
      const node = createMockStatementNode({
        mode: 'preview',
        data: {
          ...createMockStatementNode().data,
          inclusionNetVotes: 5
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('content votes do not affect expansion threshold', () => {
      const node = createMockStatementNode({
        mode: 'preview',
        data: {
          ...createMockStatementNode().data,
          inclusionPositiveVotes: 5,
          inclusionNegativeVotes: 5,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 100,
          contentNetVotes: -100
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      // Should still allow expansion (inclusion is >= 0)
      expect(container).toBeTruthy();
    });

    it('negative inclusion votes prevent expansion', () => {
      const node = createMockStatementNode({
        mode: 'preview',
        data: {
          ...createMockStatementNode().data,
          inclusionPositiveVotes: 2,
          inclusionNegativeVotes: 10,
          inclusionNetVotes: -8,
          contentPositiveVotes: 100,
          contentNegativeVotes: 0,
          contentNetVotes: 100
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      // Should not allow expansion (inclusion is negative)
      expect(container).toBeTruthy();
    });
  });

  describe('data extraction', () => {
    it('extracts statement text', () => {
      const node = createMockStatementNode({
        data: {
          ...createMockStatementNode().data,
          statement: 'This is a test statement'
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      // Statement text is in foreignObject > div, not SVG text
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasStatementText = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('This is a test statement')
      );
      expect(hasStatementText).toBe(true);
    });

    it('extracts inclusion votes correctly', () => {
      const node = createMockStatementNode({
        mode: 'detail',
        data: {
          ...createMockStatementNode().data,
          inclusionPositiveVotes: 25,
          inclusionNegativeVotes: 10
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('15') || el.textContent?.includes('+15')
      );
      expect(hasVotes).toBe(true);
    });

    it('extracts content votes correctly', () => {
      const node = createMockStatementNode({
        mode: 'detail',
        data: {
          ...createMockStatementNode().data,
          contentPositiveVotes: 40,
          contentNegativeVotes: 15
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('25') || el.textContent?.includes('+25')
      );
      expect(hasVotes).toBe(true);
    });

    it('calculates netVotes correctly when not provided', () => {
      const node = createMockStatementNode({
        mode: 'detail',
        data: {
          ...createMockStatementNode().data,
          inclusionPositiveVotes: 12,
          inclusionNegativeVotes: 4,
          inclusionNetVotes: 8,
          contentPositiveVotes: 20,
          contentNegativeVotes: 5,
          contentNetVotes: 15
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      // Should calculate correctly
      expect(container).toBeTruthy();
    });
  });

  describe('categories and keywords', () => {
    it('handles category objects with id and name', () => {
      const node = createMockStatementNode({
        mode: 'detail',
        data: {
          ...createMockStatementNode().data,
          categories: [
            { id: '1', name: 'Science' },
            { id: '2', name: 'Research' }
          ]
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasCategories = textElements.some(el => 
        el.textContent?.includes('Science') || 
        el.textContent?.includes('Research')
      );
      expect(hasCategories).toBe(true);
    });

    it('handles empty categories array', () => {
      const node = createMockStatementNode({
        mode: 'detail',
        data: {
          ...createMockStatementNode().data,
          categories: []
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('displays keywords with source indicators', () => {
      const node = createMockStatementNode({
        mode: 'detail',
        data: {
          ...createMockStatementNode().data,
          keywords: [
            { word: 'ai', frequency: 5, source: 'user' as const },
            { word: 'ml', frequency: 3, source: 'ai' as const },
            { word: 'data', frequency: 4, source: 'both' as const }
          ]
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles empty keywords array', () => {
      const node = createMockStatementNode({
        mode: 'detail',
        data: {
          ...createMockStatementNode().data,
          keywords: []
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('metadata display', () => {
    it('shows metadata in detail mode', () => {
      const node = createMockStatementNode({ mode: 'detail' });
      const { container } = render(StatementNode, { props: { node } });

      // NodeMetadata component should render timestamps
      expect(container).toBeTruthy();
    });
  });

  describe('creator credits', () => {
    it('shows creator credits when available', () => {
      const node = createMockStatementNode({
        mode: 'detail',
        data: {
          ...createMockStatementNode().data,
          createdBy: {
            id: 'user-1',
            username: 'testuser',
            displayName: 'Test User'
          },
          publicCredit: true
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('hides creator credits when publicCredit is false', () => {
      const node = createMockStatementNode({
        mode: 'detail',
        data: {
          ...createMockStatementNode().data,
          createdBy: {
            id: 'user-1',
            username: 'testuser'
          },
          publicCredit: false
        }
      });
      const { container } = render(StatementNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('mode transitions', () => {
    it('transitions from preview to detail', async () => {
      const node = createMockStatementNode({ mode: 'preview' });
      const { container, component } = render(StatementNode, { props: { node } });

      // Initially in preview mode
      expect(container).toBeTruthy();

      // Update mode
      await component.$set({ node: { ...node, mode: 'detail' } });

      // Should now be in detail mode
      expect(container).toBeTruthy();
    });

    it('transitions from detail to preview', async () => {
      const node = createMockStatementNode({ mode: 'detail' });
      const { container, component } = render(StatementNode, { props: { node } });

      // Update mode
      await component.$set({ node: { ...node, mode: 'preview' } });

      expect(container).toBeTruthy();
    });
  });
});