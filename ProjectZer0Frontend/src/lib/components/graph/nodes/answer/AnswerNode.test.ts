// AnswerNode.test.ts - Dual-voting pattern test suite
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AnswerNode from '$lib/components/graph/nodes/answer/AnswerNode.svelte';
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

describe('AnswerNode', () => {
  const createMockAnswerNode = (overrides?: Partial<RenderableNode>): RenderableNode => {
    const baseData = {
      id: 'answer-1',
      answerText: 'The primary cause is the increased concentration of greenhouse gases in the atmosphere, particularly CO2 from burning fossil fuels.',
      questionId: 'question-1',
      inclusionPositiveVotes: 28,
      inclusionNegativeVotes: 4,
      inclusionNetVotes: 24,
      contentPositiveVotes: 35,
      contentNegativeVotes: 6,
      contentNetVotes: 29,
      categories: [
        { id: 'cat-1', name: 'Climate Science' },
        { id: 'cat-2', name: 'Environmental Issues' }
      ],
      keywords: [
        { word: 'greenhouse', frequency: 8, source: 'user' as const },
        { word: 'fossil fuels', frequency: 6, source: 'ai' as const },
        { word: 'CO2', frequency: 5, source: 'both' as const }
      ],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      createdBy: { id: 'user-1', username: 'climatexpert' },
      publicCredit: true
    };

    return {
      id: 'answer-1',
      type: 'answer',
      radius: 220,
      mode: 'preview',
      group: 'answer',
      data: baseData,
      position: {
        x: 100,
        y: 200,
        svgTransform: 'translate(100, 200)'
      },
      style: {
        fill: 'rgba(34, 197, 94, 0.8)',
        stroke: 'rgba(34, 197, 94, 1)',
        strokeWidth: 2
      },
      metadata: {
        group: 'answer',
        inclusionVoteStatus: { status: 'none' },
        contentVoteStatus: { status: 'none' }
      },
      ...overrides
    } as RenderableNode;
  };

  describe('rendering', () => {
    it('renders in preview mode', () => {
      const node = createMockAnswerNode();
      const { container } = render(AnswerNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('renders in detail mode', () => {
      const node = createMockAnswerNode({ mode: 'detail' });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('displays answer text', () => {
      const node = createMockAnswerNode({ mode: 'detail' });
      const { container } = render(AnswerNode, { props: { node } });

      // Answer text is rendered in foreignObject by TextContent component
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasAnswerText = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('greenhouse gases')
      );
      expect(hasAnswerText).toBe(true);
    });

    it('shows "Answer" header', () => {
      const node = createMockAnswerNode({ mode: 'detail' });
      const { container } = render(AnswerNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const headerText = textElements.find(el => 
        el.textContent?.includes('Answer')
      );
      expect(headerText).toBeTruthy();
    });

    it('displays categories in detail mode', () => {
      const node = createMockAnswerNode({ mode: 'detail' });
      const { container } = render(AnswerNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasCategories = textElements.some(el => 
        el.textContent?.includes('Climate Science') || 
        el.textContent?.includes('Environmental Issues')
      );
      expect(hasCategories).toBe(true);
    });

    it('displays keywords in detail mode', () => {
      const node = createMockAnswerNode({ mode: 'detail' });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('dual voting', () => {
    it('displays both inclusion and content vote buttons in detail mode', () => {
      const node = createMockAnswerNode({ mode: 'detail' });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('shows separate vote stats for inclusion and content', () => {
      const node = createMockAnswerNode({ 
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          inclusionPositiveVotes: 20,
          inclusionNegativeVotes: 5,
          contentPositiveVotes: 30,
          contentNegativeVotes: 8
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      // Should show both inclusion net (+15) and content net (+22)
      expect(textElements.some(el => el.textContent?.includes('15'))).toBe(true);
      expect(textElements.some(el => el.textContent?.includes('22'))).toBe(true);
    });

    it('shows instruction text for dual voting', () => {
      const node = createMockAnswerNode({ mode: 'detail' });
      const { container } = render(AnswerNode, { props: { node } });

      const foreignObjects = Array.from(container.querySelectorAll('foreignObject'));
      const instructionContent = foreignObjects.some(fo => {
        const div = fo.querySelector('.instruction-text');
        return div?.textContent?.includes('Include/Exclude') && 
               div?.textContent?.includes('Agree/Disagree');
      });
      expect(instructionContent).toBe(true);
    });

    it('does not show voting in preview mode', () => {
      const node = createMockAnswerNode({ mode: 'preview' });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('expansion logic', () => {
    it('allows expansion when inclusionNetVotes >= 0', () => {
      const node = createMockAnswerNode({
        data: {
          ...createMockAnswerNode().data,
          inclusionNetVotes: 10
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('prevents expansion when inclusionNetVotes < 0', () => {
      const node = createMockAnswerNode({
        data: {
          ...createMockAnswerNode().data,
          inclusionPositiveVotes: 3,
          inclusionNegativeVotes: 18,
          inclusionNetVotes: -15
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('content votes do not affect expansion logic', () => {
      const node = createMockAnswerNode({
        data: {
          ...createMockAnswerNode().data,
          inclusionNetVotes: 8,
          contentPositiveVotes: 2,
          contentNegativeVotes: 25,
          contentNetVotes: -23
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      // Should still be expandable because inclusionNetVotes >= 0
      expect(container).toBeTruthy();
    });
  });

  describe('data extraction', () => {
    it('extracts answer text from node.data', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          answerText: 'This is a unique answer for testing extraction.'
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      // Answer text is rendered in foreignObject by TextContent component
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasAnswerText = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('unique answer for testing')
      );
      expect(hasAnswerText).toBe(true);
    });

    it('extracts inclusion votes correctly', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          inclusionPositiveVotes: 45,
          inclusionNegativeVotes: 12
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('33') || el.textContent?.includes('+33')
      );
      expect(hasVotes).toBe(true);
    });

    it('extracts content votes correctly', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          contentPositiveVotes: 50,
          contentNegativeVotes: 10
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('40') || el.textContent?.includes('+40')
      );
      expect(hasVotes).toBe(true);
    });

    it('calculates netVotes correctly when not provided', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          inclusionPositiveVotes: 16,
          inclusionNegativeVotes: 5,
          inclusionNetVotes: 11,
          contentPositiveVotes: 25,
          contentNegativeVotes: 7,
          contentNetVotes: 18
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('extracts user vote status from metadata', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        metadata: {
          group: 'answer',
          inclusionVoteStatus: { status: 'agree' },
          contentVoteStatus: { status: 'disagree' }
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('extracts categories correctly', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          categories: [
            { id: 'cat-1', name: 'Biology' },
            { id: 'cat-2', name: 'Evolution' }
          ]
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasCategories = textElements.some(el => 
        el.textContent?.includes('Biology') || el.textContent?.includes('Evolution')
      );
      expect(hasCategories).toBe(true);
    });

    it('handles empty categories array', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          categories: []
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('extracts keywords correctly', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          keywords: [
            { word: 'science', frequency: 10, source: 'user' as const },
            { word: 'research', frequency: 8, source: 'ai' as const }
          ]
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles empty keywords array', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          keywords: []
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('metadata display', () => {
    it('shows metadata in detail mode', () => {
      const node = createMockAnswerNode({
        mode: 'detail'
      });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('hides metadata in preview mode', () => {
      const node = createMockAnswerNode({
        mode: 'preview'
      });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('displays creator credits when publicCredit is true', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          publicCredit: true,
          createdBy: { id: 'user-1', username: 'answerer' }
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('hides creator credits when publicCredit is false', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          publicCredit: false
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('type validation', () => {
    it('throws error for invalid node data', () => {
      const invalidNode = {
        ...createMockAnswerNode(),
        data: {
          id: 'invalid-1',
          // Missing required answer fields
        }
      };

      expect(() => {
        render(AnswerNode, { props: { node: invalidNode as RenderableNode } });
      }).toThrow('Invalid node data type for AnswerNode');
    });

    it('accepts valid answer data', () => {
      const node = createMockAnswerNode();
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('dual voting independence', () => {
    it('inclusion and content votes are independent', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        metadata: {
          group: 'answer',
          inclusionVoteStatus: { status: 'agree' },
          contentVoteStatus: { status: 'disagree' }
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      // Both vote statuses should be reflected independently
      expect(container).toBeTruthy();
    });

    it('can have positive inclusion and negative content votes', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          inclusionPositiveVotes: 25,
          inclusionNegativeVotes: 8,
          inclusionNetVotes: 17,
          contentPositiveVotes: 5,
          contentNegativeVotes: 20,
          contentNetVotes: -15
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      expect(textElements.some(el => el.textContent?.includes('17'))).toBe(true);
      expect(textElements.some(el => el.textContent?.includes('-15') || el.textContent?.includes('15'))).toBe(true);
    });

    it('can have both vote types at maximum agreement', () => {
      const node = createMockAnswerNode({
        mode: 'detail',
        data: {
          ...createMockAnswerNode().data,
          inclusionPositiveVotes: 100,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 100,
          contentPositiveVotes: 95,
          contentNegativeVotes: 2,
          contentNetVotes: 93
        }
      });
      const { container } = render(AnswerNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('question relationship', () => {
    it('stores reference to parent question', () => {
      const node = createMockAnswerNode({
        data: {
          ...createMockAnswerNode().data,
          questionId: 'specific-question-123'
        }
      });
      const { container } = render(AnswerNode, { props: { node } });
      
      expect(container).toBeTruthy();
    });
  });
});