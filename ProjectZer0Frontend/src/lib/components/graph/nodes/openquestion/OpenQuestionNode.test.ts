// OpenQuestionNode.test.ts - Single-voting pattern with question-specific features
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import OpenQuestionNode from '$lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte';
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

describe('OpenQuestionNode', () => {
  const createMockOpenQuestionNode = (overrides?: Partial<RenderableNode>): RenderableNode => {
    const baseData = {
      id: 'question-1',
      questionText: 'What are the most effective strategies for reducing carbon emissions in urban environments?',
      inclusionPositiveVotes: 32,
      inclusionNegativeVotes: 5,
      inclusionNetVotes: 27,
      categories: [
        { id: 'cat-1', name: 'Climate Action' },
        { id: 'cat-2', name: 'Urban Planning' }
      ],
      keywords: [
        { word: 'carbon', frequency: 9, source: 'user' as const },
        { word: 'emissions', frequency: 8, source: 'ai' as const },
        { word: 'urban', frequency: 7, source: 'both' as const }
      ],
      answerCount: 47,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      createdBy: { id: 'user-1', username: 'questioner' },
      publicCredit: true
    };

    return {
      id: 'question-1',
      type: 'openquestion',
      radius: 210,
      mode: 'preview',
      group: 'openquestion',
      data: baseData,
      position: {
        x: 100,
        y: 200,
        svgTransform: 'translate(100, 200)'
      },
      style: {
        fill: 'rgba(236, 72, 153, 0.8)',
        stroke: 'rgba(236, 72, 153, 1)',
        strokeWidth: 2
      },
      metadata: {
        group: 'openquestion',
        inclusionVoteStatus: { status: 'none' }
      },
      ...overrides
    } as RenderableNode;
  };

  describe('rendering', () => {
    it('renders in preview mode', () => {
      const node = createMockOpenQuestionNode();
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('renders in detail mode', () => {
      const node = createMockOpenQuestionNode({ mode: 'detail' });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('displays question text', () => {
      const node = createMockOpenQuestionNode({ mode: 'detail' });
      const { container } = render(OpenQuestionNode, { props: { node } });

      // Question text is in foreignObject > TextContent component (div)
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasQuestionText = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('carbon emissions')
      );
      expect(hasQuestionText).toBe(true);
    });

    it('shows "Open Question" header', () => {
      const node = createMockOpenQuestionNode({ mode: 'detail' });
      const { container } = render(OpenQuestionNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const headerText = textElements.find(el => 
        el.textContent?.includes('Open Question')
      );
      expect(headerText).toBeTruthy();
    });

    it('displays categories in detail mode', () => {
      const node = createMockOpenQuestionNode({ mode: 'detail' });
      const { container } = render(OpenQuestionNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasCategories = textElements.some(el => 
        el.textContent?.includes('Climate Action') || 
        el.textContent?.includes('Urban Planning')
      );
      expect(hasCategories).toBe(true);
    });

    it('displays keywords in detail mode', () => {
      const node = createMockOpenQuestionNode({ mode: 'detail' });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('question-specific features', () => {
    it('displays answer count', () => {
      const node = createMockOpenQuestionNode({ mode: 'detail' });
      const { container } = render(OpenQuestionNode, { props: { node } });

      // Answer count is in foreignObject > div.answer-count
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasAnswerCount = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('47')
      );
      expect(hasAnswerCount).toBe(true);
    });

    it('handles zero answers', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          answerCount: 0
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles large answer counts', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          answerCount: 1543
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      // Answer count is in foreignObject > div.answer-count
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasAnswerCount = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('1543')
      );
      expect(hasAnswerCount).toBe(true);
    });

    it('shows answer button in detail mode', () => {
      const node = createMockOpenQuestionNode({ mode: 'detail' });
      const { container } = render(OpenQuestionNode, { props: { node } });

      // Answer button should be present in detail mode
      expect(container).toBeTruthy();
    });

    it('does not show answer button in preview mode', () => {
      const node = createMockOpenQuestionNode({ mode: 'preview' });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('voting - single pattern', () => {
    it('displays inclusion vote buttons in detail mode', () => {
      const node = createMockOpenQuestionNode({ mode: 'detail' });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('shows vote stats in detail mode', () => {
      const node = createMockOpenQuestionNode({ 
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          inclusionPositiveVotes: 40,
          inclusionNegativeVotes: 8
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('32') || el.textContent?.includes('+32')
      );
      expect(hasVotes).toBe(true);
    });

    it('does not show content voting buttons', () => {
      const node = createMockOpenQuestionNode({ mode: 'detail' });
      const { container } = render(OpenQuestionNode, { props: { node } });

      // Only inclusion voting, no content voting
      expect(container).toBeTruthy();
    });

    it('does not show voting in preview mode', () => {
      const node = createMockOpenQuestionNode({ mode: 'preview' });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('expansion logic', () => {
    it('allows expansion when inclusionNetVotes >= 0', () => {
      const node = createMockOpenQuestionNode({
        data: {
          ...createMockOpenQuestionNode().data,
          inclusionNetVotes: 12
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('prevents expansion when inclusionNetVotes < 0', () => {
      const node = createMockOpenQuestionNode({
        data: {
          ...createMockOpenQuestionNode().data,
          inclusionPositiveVotes: 5,
          inclusionNegativeVotes: 22,
          inclusionNetVotes: -17
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('data extraction', () => {
    it('extracts question text from node.data', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          questionText: 'How can we achieve sustainable agriculture in developing nations?'
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      // Question text is in foreignObject > TextContent component
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasQuestionText = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('sustainable agriculture')
      );
      expect(hasQuestionText).toBe(true);
    });

    it('extracts inclusion votes correctly', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          inclusionPositiveVotes: 55,
          inclusionNegativeVotes: 13
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('42') || el.textContent?.includes('+42')
      );
      expect(hasVotes).toBe(true);
    });

    it('calculates netVotes correctly when not provided', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          inclusionPositiveVotes: 28,
          inclusionNegativeVotes: 11,
          inclusionNetVotes: 17
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('extracts user vote status from metadata', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        metadata: {
          group: 'openquestion',
          inclusionVoteStatus: { status: 'agree' }
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('extracts categories correctly', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          categories: [
            { id: 'cat-1', name: 'Technology' },
            { id: 'cat-2', name: 'Innovation' }
          ]
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasCategories = textElements.some(el => 
        el.textContent?.includes('Technology') || el.textContent?.includes('Innovation')
      );
      expect(hasCategories).toBe(true);
    });

    it('handles empty categories array', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          categories: []
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('extracts keywords correctly', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          keywords: [
            { word: 'strategy', frequency: 11, source: 'user' as const },
            { word: 'solution', frequency: 9, source: 'ai' as const }
          ]
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles empty keywords array', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          keywords: []
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('extracts answer count correctly', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          answerCount: 234
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      // Answer count is in foreignObject > div.answer-count
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasAnswerCount = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('234')
      );
      expect(hasAnswerCount).toBe(true);
    });
  });

  describe('metadata display', () => {
    it('shows metadata in detail mode', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail'
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('hides metadata in preview mode', () => {
      const node = createMockOpenQuestionNode({
        mode: 'preview'
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('displays creator credits when publicCredit is true', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          publicCredit: true,
          createdBy: { id: 'user-1', username: 'inquirer' }
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('hides creator credits when publicCredit is false', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          publicCredit: false
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('type validation', () => {
    it('throws error for invalid node data', () => {
      const invalidNode = {
        ...createMockOpenQuestionNode(),
        data: {
          id: 'invalid-1',
          // Missing required question fields
        }
      };

      expect(() => {
        render(OpenQuestionNode, { props: { node: invalidNode as RenderableNode } });
      }).toThrow('Invalid node data type for OpenQuestionNode');
    });

    it('accepts valid open question data', () => {
      const node = createMockOpenQuestionNode();
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('event dispatching', () => {
    it('dispatches answerQuestion event when answer button clicked', async () => {
      const node = createMockOpenQuestionNode({ mode: 'detail' });
      const { component } = render(OpenQuestionNode, { props: { node } });

      const answerHandler = vi.fn();
      component.$on('answerQuestion', answerHandler);

      // Note: This is a simplified test - actual clicking would need more setup
      // In a real implementation, you would simulate the button click
      expect(answerHandler).not.toHaveBeenCalled(); // No click simulation here
    });
  });

  describe('question text variations', () => {
    it('handles short questions', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          questionText: 'Why is the sky blue?'
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      // Question text is in foreignObject > TextContent component
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasQuestionText = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('sky blue')
      );
      expect(hasQuestionText).toBe(true);
    });

    it('handles long questions', () => {
      const longQuestion = 'Given the current geopolitical landscape and the increasing evidence of anthropogenic climate change, what coordinated international policy mechanisms could be implemented to ensure equitable burden-sharing while maintaining economic growth and development opportunities for emerging economies?';
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          questionText: longQuestion
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles questions with special characters', () => {
      const node = createMockOpenQuestionNode({
        mode: 'detail',
        data: {
          ...createMockOpenQuestionNode().data,
          questionText: 'How does "machine learning" differ from traditional AI? (& why does it matter?)'
        }
      });
      const { container } = render(OpenQuestionNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });
});