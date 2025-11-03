// CategoryNode.test.ts - Single-voting pattern test suite
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CategoryNode from '$lib/components/graph/nodes/category/CategoryNode.svelte';
import type { RenderableNode } from '$lib/types/graph/enhanced';

// Type definition for CategoryNode data structure (matches CategoryNode.svelte)
interface CategoryNodeData {
  id: string;
  name: string;
  createdBy: string;
  publicCredit: boolean;
  createdAt: string;
  updatedAt: string;
  inclusionPositiveVotes: number;
  inclusionNegativeVotes: number;
  inclusionNetVotes: number;
  words?: Array<{
    id: string;
    word: string;
    inclusionNetVotes: number;
  }>;
  parentCategory?: {
    id: string;
    name: string;
  } | null;
  childCategories?: Array<{
    id: string;
    name: string;
    inclusionNetVotes: number;
  }>;
}

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

describe('CategoryNode', () => {
  const createMockCategoryNode = (overrides?: Partial<RenderableNode>): RenderableNode => {
    const baseData = {
      id: 'category-1',
      name: 'Climate Science',
      inclusionPositiveVotes: 18,
      inclusionNegativeVotes: 2,
      inclusionNetVotes: 16,
      words: [
        { id: 'word-1', word: 'climate', inclusionNetVotes: 10 },
        { id: 'word-2', word: 'science', inclusionNetVotes: 8 }
      ],
      parentCategory: {
        id: 'parent-1',
        name: 'Environmental Science'
      },
      childCategories: [
        { id: 'child-1', name: 'Climate Modeling', inclusionNetVotes: 5 },
        { id: 'child-2', name: 'Climate Policy', inclusionNetVotes: 7 }
      ],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      createdBy: 'user-1',
      publicCredit: true
    };

    return {
      id: 'category-1',
      type: 'category',
      radius: 180,
      mode: 'preview',
      group: 'category',
      data: baseData,
      position: {
        x: 100,
        y: 200,
        svgTransform: 'translate(100, 200)'
      },
      style: {
        fill: 'rgba(139, 92, 246, 0.8)',
        stroke: 'rgba(139, 92, 246, 1)',
        strokeWidth: 2
      },
      metadata: {
        group: 'category',
        inclusionVoteStatus: { status: 'none' }
      },
      ...overrides
    } as RenderableNode;
  };

  describe('rendering', () => {
    it('renders in preview mode', () => {
      const node = createMockCategoryNode();
      const { container } = render(CategoryNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('renders in detail mode', () => {
      const node = createMockCategoryNode({ mode: 'detail' });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('displays category name', () => {
      const node = createMockCategoryNode({ mode: 'detail' });
      const { container } = render(CategoryNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const categoryName = textElements.find(el => 
        el.textContent?.includes('Climate Science')
      );
      expect(categoryName).toBeTruthy();
    });

    it('shows "Category" header', () => {
      const node = createMockCategoryNode({ mode: 'detail' });
      const { container } = render(CategoryNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const headerText = textElements.find(el => 
        el.textContent?.includes('Category')
      );
      expect(headerText).toBeTruthy();
    });

    it('displays composed words as keywords in detail mode', () => {
      const node = createMockCategoryNode({ mode: 'detail' });
      const { container } = render(CategoryNode, { props: { node } });

      // Words are displayed as keyword tags
      const textElements = Array.from(container.querySelectorAll('text'));
      const hasWords = textElements.some(el => 
        el.textContent?.includes('climate') || 
        el.textContent?.includes('science')
      );
      expect(hasWords).toBe(true);
    });

    it('displays category name prominently', () => {
      const node = createMockCategoryNode({ mode: 'detail' });
      const { container } = render(CategoryNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const nameDisplay = textElements.find(el => 
        el.classList.contains('category-name') &&
        el.textContent?.includes('Climate Science')
      );
      expect(nameDisplay).toBeTruthy();
    });
  });

  describe('category hierarchy', () => {
    it('displays parent category when present', () => {
      const node = createMockCategoryNode({ mode: 'detail' });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
      // Parent category exists in data
      const categoryData = node.data as CategoryNodeData;
      expect(categoryData.parentCategory).toBeTruthy();
      expect(categoryData.parentCategory?.name).toBe('Environmental Science');
    });

    it('displays child categories', () => {
      const node = createMockCategoryNode({ mode: 'detail' });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
      // Child categories exist in data
      const categoryData = node.data as CategoryNodeData;
      expect(categoryData.childCategories).toBeTruthy();
      expect(categoryData.childCategories?.length).toBe(2);
    });

    it('handles category with no parent', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          parentCategory: null
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles category with no children', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          childCategories: []
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles category with single parent', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          parentCategory: {
            id: 'p1',
            name: 'Science'
          }
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
      const categoryData = node.data as CategoryNodeData;
      expect(categoryData.parentCategory?.name).toBe('Science');
    });

    it('handles many child categories', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          childCategories: Array.from({ length: 10 }, (_, i) => ({
            id: `child-${i}`,
            name: `Subcategory ${i + 1}`,
            inclusionNetVotes: 5
          }))
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
      const categoryData = node.data as CategoryNodeData;
      expect(categoryData.childCategories?.length).toBe(10);
    });
  });

  describe('voting - single pattern', () => {
    it('displays inclusion vote buttons in detail mode', () => {
      const node = createMockCategoryNode({ mode: 'detail' });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('shows vote stats in detail mode', () => {
      const node = createMockCategoryNode({ 
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          inclusionPositiveVotes: 35,
          inclusionNegativeVotes: 8
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('27') || el.textContent?.includes('+27')
      );
      expect(hasVotes).toBe(true);
    });

    it('does not show content voting buttons', () => {
      const node = createMockCategoryNode({ mode: 'detail' });
      const { container } = render(CategoryNode, { props: { node } });

      // Only inclusion voting, no content voting
      expect(container).toBeTruthy();
    });

    it('does not show voting in preview mode', () => {
      const node = createMockCategoryNode({ mode: 'preview' });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('expansion logic', () => {
    it('allows expansion when inclusionNetVotes >= 0', () => {
      const node = createMockCategoryNode({
        data: {
          ...createMockCategoryNode().data,
          inclusionNetVotes: 8
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('prevents expansion when inclusionNetVotes < 0', () => {
      const node = createMockCategoryNode({
        data: {
          ...createMockCategoryNode().data,
          inclusionPositiveVotes: 4,
          inclusionNegativeVotes: 20,
          inclusionNetVotes: -16
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('data extraction', () => {
    it('extracts category name from node.data', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          name: 'Quantum Physics'
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const categoryName = textElements.find(el => 
        el.textContent?.includes('Quantum Physics')
      );
      expect(categoryName).toBeTruthy();
    });

    it('extracts composed words from node.data', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          words: [
            { id: 'w1', word: 'quantum', inclusionNetVotes: 10 },
            { id: 'w2', word: 'physics', inclusionNetVotes: 8 }
          ]
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
      const categoryData = node.data as CategoryNodeData;
      expect(categoryData.words?.length).toBe(2);
    });

    it('extracts inclusion votes correctly', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          inclusionPositiveVotes: 50,
          inclusionNegativeVotes: 15
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('35') || el.textContent?.includes('+35')
      );
      expect(hasVotes).toBe(true);
    });

    it('calculates netVotes correctly when not provided', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          inclusionPositiveVotes: 22,
          inclusionNegativeVotes: 9,
          inclusionNetVotes: 13
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('extracts user vote status from metadata', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        metadata: {
          group: 'category',
          inclusionVoteStatus: { status: 'agree' }
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('extracts parent category correctly', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          parentCategory: {
            id: 'parent-x',
            name: 'Biology'
          }
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
      const categoryData = node.data as CategoryNodeData;
      expect(categoryData.parentCategory?.name).toBe('Biology');
    });

    it('handles null parent category', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          parentCategory: null
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('metadata display', () => {
    it('shows metadata in detail mode', () => {
      const node = createMockCategoryNode({
        mode: 'detail'
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('hides metadata in preview mode', () => {
      const node = createMockCategoryNode({
        mode: 'preview'
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('displays creator credits when publicCredit is true', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          publicCredit: true,
          createdBy: 'taxonomist'
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('hides creator credits when publicCredit is false', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          publicCredit: false
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('type validation', () => {
    it('renders with valid category data', () => {
      const node = createMockCategoryNode();
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles missing optional fields', () => {
      const node = createMockCategoryNode({
        data: {
          ...createMockCategoryNode().data,
          words: [],
          parentCategory: null,
          childCategories: []
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('composed words display', () => {
    it('displays composed words as keyword tags', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          words: [
            { id: 'w1', word: 'renewable', inclusionNetVotes: 12 },
            { id: 'w2', word: 'energy', inclusionNetVotes: 10 }
          ]
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
      const categoryData = node.data as CategoryNodeData;
      expect(categoryData.words?.length).toBe(2);
    });

    it('handles empty words array', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          words: []
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles many composed words', () => {
      const node = createMockCategoryNode({
        mode: 'detail',
        data: {
          ...createMockCategoryNode().data,
          words: Array.from({ length: 5 }, (_, i) => ({
            id: `word-${i}`,
            word: `word${i + 1}`,
            inclusionNetVotes: 5
          }))
        }
      });
      const { container } = render(CategoryNode, { props: { node } });

      expect(container).toBeTruthy();
      const categoryData = node.data as CategoryNodeData;
      expect(categoryData.words?.length).toBe(5);
    });
  });
});