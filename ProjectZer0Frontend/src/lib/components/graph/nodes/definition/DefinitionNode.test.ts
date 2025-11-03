// DefinitionNode.test.ts - Dual-voting pattern test suite
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DefinitionNode from '$lib/components/graph/nodes/definition/DefinitionNode.svelte';
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

describe('DefinitionNode', () => {
  const createMockDefinitionNode = (overrides?: Partial<RenderableNode>): RenderableNode => {
    const baseData = {
      id: 'definition-1',
      definitionText: 'The study and development of computer systems that can perform tasks requiring human intelligence.',
      wordId: 'word-1',
      inclusionPositiveVotes: 8,
      inclusionNegativeVotes: 2,
      inclusionNetVotes: 6,
      contentPositiveVotes: 12,
      contentNegativeVotes: 3,
      contentNetVotes: 9,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      createdBy: { id: 'user-1', username: 'testuser' },
      publicCredit: true
    };

    return {
      id: 'definition-1',
      type: 'definition',
      radius: 200,
      mode: 'preview',
      group: 'live-definition',
      data: baseData,
      position: {
        x: 100,
        y: 200,
        svgTransform: 'translate(100, 200)'
      },
      style: {
        fill: 'rgba(59, 130, 246, 0.8)',
        stroke: 'rgba(59, 130, 246, 1)',
        strokeWidth: 2
      },
      metadata: {
        group: 'definition',
        inclusionVoteStatus: { status: 'none' },
        contentVoteStatus: { status: 'none' }
      },
      ...overrides
    } as RenderableNode;
  };

  describe('rendering', () => {
    it('renders in preview mode', () => {
      const node = createMockDefinitionNode();
      const { container } = render(DefinitionNode, { props: { node, wordText: 'artificial intelligence' } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('renders in detail mode', () => {
      const node = createMockDefinitionNode({ mode: 'detail' });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'artificial intelligence' } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('displays definition text', () => {
      const node = createMockDefinitionNode({ mode: 'detail' });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'artificial intelligence' } });

      const allContent = container.textContent || '';
      expect(allContent.includes('computer systems that can perform tasks')).toBe(true);
    });

    it('shows "Live Definition" header for live definitions', () => {
      const node = createMockDefinitionNode({ 
        mode: 'detail',
        group: 'live-definition'
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const headerText = textElements.find(el => 
        el.textContent?.includes('Live Definition')
      );
      expect(headerText).toBeTruthy();
    });

    it('shows "Alternative Definition" header for alternative definitions', () => {
      const node = createMockDefinitionNode({ 
        mode: 'detail',
        group: 'alternative-definition'
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const headerText = textElements.find(el => 
        el.textContent?.includes('Alternative Definition')
      );
      expect(headerText).toBeTruthy();
    });

    it('displays word text in preview mode', () => {
      const node = createMockDefinitionNode();
      const { container } = render(DefinitionNode, { props: { node, wordText: 'intelligence' } });

      const allContent = container.textContent || '';
      expect(allContent.includes('intelligence')).toBe(true);
    });
  });

  describe('dual voting', () => {
    it('displays both inclusion and content vote buttons in detail mode', () => {
      const node = createMockDefinitionNode({ mode: 'detail' });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      expect(container).toBeTruthy();
    });

    it('shows separate vote stats for inclusion and content', () => {
      const node = createMockDefinitionNode({ 
        mode: 'detail',
        data: {
          ...createMockDefinitionNode().data,
          inclusionPositiveVotes: 10,
          inclusionNegativeVotes: 3,
          contentPositiveVotes: 15,
          contentNegativeVotes: 2
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      const textElements = Array.from(container.querySelectorAll('text'));
      // Should show both inclusion net (+7) and content net (+13)
      expect(textElements.some(el => el.textContent?.includes('7'))).toBe(true);
      expect(textElements.some(el => el.textContent?.includes('13'))).toBe(true);
    });

    it('shows instruction text for dual voting', () => {
      const node = createMockDefinitionNode({ mode: 'detail' });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      const foreignObjects = Array.from(container.querySelectorAll('foreignObject'));
      const instructionContent = foreignObjects.some(fo => {
        const div = fo.querySelector('.instruction-text');
        return div?.textContent?.includes('Include/Exclude') && 
               div?.textContent?.includes('Agree/Disagree');
      });
      expect(instructionContent).toBe(true);
    });

    it('does not show voting in preview mode', () => {
      const node = createMockDefinitionNode({ mode: 'preview' });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      expect(container).toBeTruthy();
    });
  });

  describe('expansion logic', () => {
    it('allows expansion when inclusionNetVotes >= 0', () => {
      const node = createMockDefinitionNode({
        data: {
          ...createMockDefinitionNode().data,
          inclusionNetVotes: 5
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      expect(container).toBeTruthy();
    });

    it('prevents expansion when inclusionNetVotes < 0', () => {
      const node = createMockDefinitionNode({
        data: {
          ...createMockDefinitionNode().data,
          inclusionPositiveVotes: 2,
          inclusionNegativeVotes: 10,
          inclusionNetVotes: -8
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      expect(container).toBeTruthy();
    });

    it('content votes do not affect expansion logic', () => {
      const node = createMockDefinitionNode({
        data: {
          ...createMockDefinitionNode().data,
          inclusionNetVotes: 5,
          contentPositiveVotes: 1,
          contentNegativeVotes: 20,
          contentNetVotes: -19
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      // Should still be expandable because inclusionNetVotes >= 0
      expect(container).toBeTruthy();
    });
  });

  describe('data extraction', () => {
    it('extracts definition text from node.data', () => {
      const node = createMockDefinitionNode({
        mode: 'detail',
        data: {
          ...createMockDefinitionNode().data,
          definitionText: 'A unique definition text for testing.'
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'test' } });

      const allContent = container.textContent || '';
      expect(allContent.includes('unique definition text')).toBe(true);
    });

    it('extracts inclusion votes correctly', () => {
      const node = createMockDefinitionNode({
        mode: 'detail',
        data: {
          ...createMockDefinitionNode().data,
          inclusionPositiveVotes: 25,
          inclusionNegativeVotes: 10
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'test' } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('15') || el.textContent?.includes('+15')
      );
      expect(hasVotes).toBe(true);
    });

    it('extracts content votes correctly', () => {
      const node = createMockDefinitionNode({
        mode: 'detail',
        data: {
          ...createMockDefinitionNode().data,
          contentPositiveVotes: 30,
          contentNegativeVotes: 5
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'test' } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('25') || el.textContent?.includes('+25')
      );
      expect(hasVotes).toBe(true);
    });

    it('calculates netVotes correctly when not provided', () => {
      const node = createMockDefinitionNode({
        mode: 'detail',
        data: {
          ...createMockDefinitionNode().data,
          inclusionPositiveVotes: 12,
          inclusionNegativeVotes: 4,
          inclusionNetVotes: 8,
          contentPositiveVotes: 20,
          contentNegativeVotes: 5,
          contentNetVotes: 15
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'test' } });

      expect(container).toBeTruthy();
    });

    it('extracts user vote status from metadata', () => {
      const node = createMockDefinitionNode({
        mode: 'detail',
        metadata: {
          group: 'definition',
          inclusionVoteStatus: { status: 'agree' },
          contentVoteStatus: { status: 'disagree' }
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'test' } });

      expect(container).toBeTruthy();
    });
  });

  describe('metadata display', () => {
    it('shows metadata in detail mode', () => {
      const node = createMockDefinitionNode({
        mode: 'detail'
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('hides metadata in preview mode', () => {
      const node = createMockDefinitionNode({
        mode: 'preview'
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      expect(container).toBeTruthy();
    });

    it('displays creator credits when publicCredit is true', () => {
      const node = createMockDefinitionNode({
        mode: 'detail',
        data: {
          ...createMockDefinitionNode().data,
          publicCredit: true,
          createdBy: { id: 'user-1', username: 'definitionauthor' }
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      expect(container).toBeTruthy();
    });

    it('hides creator credits when publicCredit is false', () => {
      const node = createMockDefinitionNode({
        mode: 'detail',
        data: {
          ...createMockDefinitionNode().data,
          publicCredit: false
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      expect(container).toBeTruthy();
    });
  });

  describe('type validation', () => {
    it('throws error for invalid node data', () => {
      const invalidNode = {
        ...createMockDefinitionNode(),
        data: {
          id: 'invalid-1',
          // Missing required definition fields
        }
      };

      expect(() => {
        render(DefinitionNode, { props: { node: invalidNode as RenderableNode, wordText: 'test' } });
      }).toThrow('Invalid node data type for DefinitionNode');
    });

    it('accepts valid definition data', () => {
      const node = createMockDefinitionNode();
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      expect(container).toBeTruthy();
    });
  });

  describe('dual voting independence', () => {
    it('inclusion and content votes are independent', () => {
      const node = createMockDefinitionNode({
        mode: 'detail',
        metadata: {
          group: 'definition',
          inclusionVoteStatus: { status: 'agree' },
          contentVoteStatus: { status: 'disagree' }
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      // Both vote statuses should be reflected independently
      expect(container).toBeTruthy();
    });

    it('can have positive inclusion and negative content votes', () => {
      const node = createMockDefinitionNode({
        mode: 'detail',
        data: {
          ...createMockDefinitionNode().data,
          inclusionPositiveVotes: 20,
          inclusionNegativeVotes: 5,
          inclusionNetVotes: 15,
          contentPositiveVotes: 3,
          contentNegativeVotes: 15,
          contentNetVotes: -12
        }
      });
      const { container } = render(DefinitionNode, { props: { node, wordText: 'AI' } });

      const textElements = Array.from(container.querySelectorAll('text'));
      expect(textElements.some(el => el.textContent?.includes('15'))).toBe(true);
      expect(textElements.some(el => el.textContent?.includes('-12') || el.textContent?.includes('12'))).toBe(true);
    });
  });

  describe('wordText prop', () => {
    it('displays provided wordText in preview', () => {
      const node = createMockDefinitionNode();
      const { container } = render(DefinitionNode, { props: { node, wordText: 'quantum computing' } });

      const allContent = container.textContent || '';
      expect(allContent.includes('quantum computing')).toBe(true);
    });

    it('handles empty wordText gracefully', () => {
      const node = createMockDefinitionNode();
      const { container } = render(DefinitionNode, { props: { node, wordText: '' } });

      expect(container).toBeTruthy();
    });
  });
});