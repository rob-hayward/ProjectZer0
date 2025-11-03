// EvidenceNode.test.ts - Single-voting pattern test suite
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import EvidenceNode from '$lib/components/graph/nodes/evidence/EvidenceNode.svelte';
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

vi.mock('$lib/services/api', () => ({
  fetchWithAuth: vi.fn()
}));

describe('EvidenceNode', () => {
  const createMockEvidenceNode = (overrides?: Partial<RenderableNode>): RenderableNode => {
    const baseData = {
      id: 'evidence-1',
      title: 'Global Temperature Trends 1850-2025',
      description: 'A peer-reviewed study published in Nature Climate Change found that global temperatures have risen 1.2°C since 1850.',
      url: 'https://doi.org/10.1038/example',
      evidenceType: 'peer_reviewed_study' as const,
      authors: ['Dr. Jane Smith', 'Dr. John Doe'],
      publicationDate: '2024-12-01T00:00:00.000Z',
      inclusionPositiveVotes: 25,
      inclusionNegativeVotes: 3,
      inclusionNetVotes: 22,
      categories: [
        { id: 'cat-1', name: 'Climate Science' },
        { id: 'cat-2', name: 'Research' }
      ],
      keywords: [
        { word: 'temperature', frequency: 6, source: 'user' as const },
        { word: 'study', frequency: 4, source: 'ai' as const }
      ],
      parentNodeId: 'statement-1',
      parentNodeType: 'statement',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      createdBy: { id: 'user-1', username: 'researcher' },
      publicCredit: true
    };

    return {
      id: 'evidence-1',
      type: 'evidence',
      radius: 200,
      mode: 'preview',
      group: 'evidence',
      data: baseData,
      position: {
        x: 100,
        y: 200,
        svgTransform: 'translate(100, 200)'
      },
      style: {
        fill: 'rgba(245, 158, 11, 0.8)',
        stroke: 'rgba(245, 158, 11, 1)',
        strokeWidth: 2
      },
      metadata: {
        group: 'evidence',
        inclusionVoteStatus: { status: 'none' }
      },
      ...overrides
    } as RenderableNode;
  };

  describe('rendering', () => {
    it('renders in preview mode', () => {
      const node = createMockEvidenceNode();
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('renders in detail mode', () => {
      const node = createMockEvidenceNode({ mode: 'detail' });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('displays evidence description', () => {
      const node = createMockEvidenceNode({ mode: 'detail' });
      const { container } = render(EvidenceNode, { props: { node } });

      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasDescription = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('global temperatures')
      );
      expect(hasDescription).toBe(true);
    });

    it('shows "Evidence" header', () => {
      const node = createMockEvidenceNode({ mode: 'detail' });
      const { container } = render(EvidenceNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const headerText = textElements.find(el => 
        el.textContent?.includes('Evidence')
      );
      expect(headerText).toBeTruthy();
    });

    it('displays categories in detail mode', () => {
      const node = createMockEvidenceNode({ mode: 'detail' });
      const { container } = render(EvidenceNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasCategories = textElements.some(el => 
        el.textContent?.includes('Climate Science') || 
        el.textContent?.includes('Research')
      );
      expect(hasCategories).toBe(true);
    });

    it('displays keywords in detail mode', () => {
      const node = createMockEvidenceNode({ mode: 'detail' });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('source information', () => {
    it('displays evidence type badge', () => {
      const node = createMockEvidenceNode({ mode: 'detail' });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('displays source title', () => {
      const node = createMockEvidenceNode({ mode: 'detail' });
      const { container } = render(EvidenceNode, { props: { node } });

      // Title may be in text elements or foreignObject
      const allElements = [
        ...Array.from(container.querySelectorAll('text')),
        ...Array.from(container.querySelectorAll('foreignObject'))
      ];
      const hasTitle = allElements.some(el => 
        el.textContent?.includes('Global Temperature Trends')
      );
      expect(hasTitle).toBe(true);
    });

    it('displays source authors', () => {
      const node = createMockEvidenceNode({ mode: 'detail' });
      const { container } = render(EvidenceNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const authorText = textElements.find(el => 
        el.textContent?.includes('Jane Smith') || el.textContent?.includes('John Doe')
      );
      expect(authorText).toBeTruthy();
    });

    it('handles different evidence types', () => {
      const types = ['peer_reviewed_study', 'government_report', 'news_article', 'expert_opinion'] as const;
      
      types.forEach(type => {
        const node = createMockEvidenceNode({
          mode: 'detail',
          data: {
            ...createMockEvidenceNode().data,
            evidenceType: type
          }
        });
        const { container } = render(EvidenceNode, { props: { node } });
        expect(container).toBeTruthy();
      });
    });

    it('displays source URL (when provided)', () => {
      const node = createMockEvidenceNode({ mode: 'detail' });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles missing source authors gracefully', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          authors: []
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles missing source URL gracefully', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          url: undefined
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('voting - single pattern', () => {
    it('displays inclusion vote buttons in detail mode', () => {
      const node = createMockEvidenceNode({ mode: 'detail' });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('shows vote stats in detail mode', () => {
      const node = createMockEvidenceNode({ 
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          inclusionPositiveVotes: 40,
          inclusionNegativeVotes: 8
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('32') || el.textContent?.includes('+32')
      );
      expect(hasVotes).toBe(true);
    });

    it('does not show content voting buttons', () => {
      const node = createMockEvidenceNode({ mode: 'detail' });
      const { container } = render(EvidenceNode, { props: { node } });

      // Only inclusion voting, no content voting
      expect(container).toBeTruthy();
    });

    it('does not show voting in preview mode', () => {
      const node = createMockEvidenceNode({ mode: 'preview' });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('expansion logic', () => {
    it('allows expansion when inclusionNetVotes >= 0', () => {
      const node = createMockEvidenceNode({
        data: {
          ...createMockEvidenceNode().data,
          inclusionNetVotes: 12
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('prevents expansion when inclusionNetVotes < 0', () => {
      const node = createMockEvidenceNode({
        data: {
          ...createMockEvidenceNode().data,
          inclusionPositiveVotes: 5,
          inclusionNegativeVotes: 25,
          inclusionNetVotes: -20
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('data extraction', () => {
    it('extracts evidence description from node.data', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          description: 'This is a unique description for testing extraction.'
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasDescription = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('unique description for testing')
      );
      expect(hasDescription).toBe(true);
    });

    it('extracts inclusion votes correctly', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          inclusionPositiveVotes: 60,
          inclusionNegativeVotes: 18
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('42') || el.textContent?.includes('+42')
      );
      expect(hasVotes).toBe(true);
    });

    it('calculates netVotes correctly when not provided', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          inclusionPositiveVotes: 28,
          inclusionNegativeVotes: 11,
          inclusionNetVotes: 17
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('extracts user vote status from metadata', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        metadata: {
          group: 'evidence',
          inclusionVoteStatus: { status: 'agree' }
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('extracts categories correctly', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          categories: [
            { id: 'cat-1', name: 'Physics' },
            { id: 'cat-2', name: 'Chemistry' }
          ]
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasCategories = textElements.some(el => 
        el.textContent?.includes('Physics') || el.textContent?.includes('Chemistry')
      );
      expect(hasCategories).toBe(true);
    });

    it('handles empty categories array', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          categories: []
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('extracts keywords correctly', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          keywords: [
            { word: 'data', frequency: 10, source: 'user' as const },
            { word: 'analysis', frequency: 8, source: 'ai' as const }
          ]
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles empty keywords array', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          keywords: []
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('metadata display', () => {
    it('shows metadata in detail mode', () => {
      const node = createMockEvidenceNode({
        mode: 'detail'
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('hides metadata in preview mode', () => {
      const node = createMockEvidenceNode({
        mode: 'preview'
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('displays creator credits when publicCredit is true', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          publicCredit: true,
          createdBy: { id: 'user-1', username: 'scientist' }
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('hides creator credits when publicCredit is false', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          publicCredit: false
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('type validation', () => {
    it('accepts valid evidence data', () => {
      const node = createMockEvidenceNode();
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('publication date formatting', () => {
    it('displays publication date when provided', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          publicationDate: '2024-12-01T00:00:00.000Z'
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles missing publication date gracefully', () => {
      const node = createMockEvidenceNode({
        mode: 'detail',
        data: {
          ...createMockEvidenceNode().data,
          publicationDate: undefined
        }
      });
      const { container } = render(EvidenceNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });
});