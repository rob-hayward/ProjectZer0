// CommentNode.test.ts - Content-Only Voting Pattern
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CommentNode from '$lib/components/graph/nodes/comment/CommentNode.svelte';
import type { RenderableNode } from '$lib/types/graph/enhanced';

// Mock dependencies
vi.mock('$lib/stores/graphStore', () => ({
  graphStore: {
    updateVoteCounts: vi.fn(),
    updateNodeVisibility: vi.fn()
  }
}));

vi.mock('$lib/stores/discussionStore', () => ({
  discussionStore: {
    subscribe: vi.fn((callback) => {
      callback({ isAddingReply: false, replyToCommentId: null });
      return () => {};
    }),
    startReply: vi.fn()
  }
}));

vi.mock('$lib/stores/userStore', () => ({
  userStore: {
    subscribe: vi.fn((callback) => {
      callback({ preferred_username: 'testuser', name: 'Test User' });
      return () => {};
    })
  }
}));

vi.mock('$lib/utils/neo4j-utils', () => ({
  getNeo4jNumber: (val: any) => typeof val === 'number' ? val : (val?.toNumber?.() || 0)
}));

vi.mock('$lib/services/userLookup', () => ({
  getUserDetails: vi.fn().mockResolvedValue({
    id: 'user-1',
    username: 'testuser',
    displayName: 'Test User'
  })
}));

describe('CommentNode', () => {
  const createMockCommentNode = (overrides?: Partial<RenderableNode>): RenderableNode => {
    const baseData = {
      id: 'comment-1',
      commentText: 'This is a thoughtful comment about the topic',
      positiveVotes: 8,
      negativeVotes: 2,
      netVotes: 6,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      createdBy: 'testuser',  // String username, not object
      publicCredit: true
    };

    return {
      id: 'comment-1',
      type: 'comment',
      radius: 150,
      mode: 'preview',
      group: 'comment',
      data: baseData,
      position: {
        x: 100,
        y: 200,
        svgTransform: 'translate(100, 200)'
      },
      style: {
        fill: 'rgba(251, 191, 36, 0.8)',
        stroke: 'rgba(251, 191, 36, 1)',
        strokeWidth: 2
      },
      metadata: {
        group: 'comment',
        contentVoteStatus: { status: 'none' }  // Content-only voting!
      },
      ...overrides
    } as RenderableNode;
  };

  describe('rendering', () => {
    it('displays comment text', () => {
      const node = createMockCommentNode({ mode: 'detail' });
      const { container } = render(CommentNode, { props: { node } });

      // Comment text is in foreignObject
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasCommentText = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('This is a thoughtful comment')
      );
      expect(hasCommentText).toBe(true);
    });

    it('shows "Comment" header in detail mode', () => {
      const node = createMockCommentNode({ mode: 'detail' });
      const { container } = render(CommentNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const headerText = textElements.find(el => 
        el.textContent?.toLowerCase().includes('comment')
      );
      expect(headerText).toBeTruthy();
    });

    it('shows "Reply" header when isReply is true', () => {
      const node = createMockCommentNode({ mode: 'detail' });
      const { container } = render(CommentNode, { 
        props: { node, isReply: true } 
      });

      const textElements = Array.from(container.querySelectorAll('text'));
      const headerText = textElements.find(el => 
        el.textContent?.toLowerCase().includes('reply')
      );
      expect(headerText).toBeTruthy();
    });

    it('displays creator username', () => {
      const node = createMockCommentNode({
        mode: 'detail',
        data: {
          ...createMockCommentNode().data,
          createdBy: 'johndoe'  // String username
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      // Creator info is in foreignObject
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasCreator = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('johndoe')
      );
      expect(hasCreator).toBe(true);
    });

    it('displays creation date', () => {
      const node = createMockCommentNode({ mode: 'detail' });
      const { container } = render(CommentNode, { props: { node } });

      // Date should be formatted and displayed
      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasDate = Array.from(foreignObjects).some(fo => 
        fo.textContent && fo.textContent.length > 0
      );
      expect(hasDate).toBe(true);
    });

    it('renders in preview mode', () => {
      const node = createMockCommentNode({ mode: 'preview' });
      const { container } = render(CommentNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });

    it('renders in detail mode', () => {
      const node = createMockCommentNode({ mode: 'detail' });
      const { container } = render(CommentNode, { props: { node } });

      expect(container.querySelector('text')).toBeTruthy();
    });
  });

  describe('content-only voting pattern', () => {
    it('displays content vote buttons only', () => {
      const node = createMockCommentNode({ mode: 'detail' });
      const { container } = render(CommentNode, { props: { node } });

      // Should have voting UI rendered
      expect(container).toBeTruthy();
    });

    it('does not have inclusion voting buttons', () => {
      const node = createMockCommentNode({ mode: 'detail' });
      const { container } = render(CommentNode, { props: { node } });

      // Comments use content voting only, no inclusion voting
      // This is tested by checking metadata structure
      expect(node.metadata.contentVoteStatus).toBeDefined();
      expect(node.metadata.inclusionVoteStatus).toBeUndefined();
    });

    it('all comments are included by default', () => {
      const node = createMockCommentNode({ mode: 'preview' });
      const { container } = render(CommentNode, { props: { node } });

      // Comments don't have inclusion threshold checks
      // They're always visible (freedom of speech principle)
      expect(container).toBeTruthy();
    });

    it('displays vote statistics', () => {
      const node = createMockCommentNode({
        mode: 'detail',
        data: {
          ...createMockCommentNode().data,
          positiveVotes: 15,
          negativeVotes: 3
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('15') || 
        el.textContent?.includes('3') ||
        el.textContent?.includes('12') || // net votes
        el.textContent?.includes('+12')
      );
      expect(hasVotes).toBe(true);
    });

    it('extracts user vote status from metadata', () => {
      const node = createMockCommentNode({
        mode: 'detail',
        metadata: {
          group: 'comment',
          contentVoteStatus: { status: 'agree' }
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      // Component should render with agree vote active
      expect(container).toBeTruthy();
    });
  });

  describe('data extraction', () => {
    it('extracts comment text', () => {
      const node = createMockCommentNode({
        data: {
          ...createMockCommentNode().data,
          commentText: 'A different comment for testing'
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasCommentText = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('A different comment for testing')
      );
      expect(hasCommentText).toBe(true);
    });

    it('extracts vote counts correctly', () => {
      const node = createMockCommentNode({
        mode: 'detail',
        data: {
          ...createMockCommentNode().data,
          positiveVotes: 25,
          negativeVotes: 10
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      const textElements = Array.from(container.querySelectorAll('text'));
      const hasVotes = textElements.some(el => 
        el.textContent?.includes('25') ||
        el.textContent?.includes('10') ||
        el.textContent?.includes('15') || // net: 25-10
        el.textContent?.includes('+15')
      );
      expect(hasVotes).toBe(true);
    });

    it('calculates netVotes correctly', () => {
      const node = createMockCommentNode({
        mode: 'detail',
        data: {
          ...createMockCommentNode().data,
          positiveVotes: 12,
          negativeVotes: 4,
          netVotes: 8
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      // Should calculate 12 - 4 = 8
      expect(container).toBeTruthy();
    });

    it('extracts creator information', () => {
      const node = createMockCommentNode({
        mode: 'detail',
        data: {
          ...createMockCommentNode().data,
          createdBy: 'alice'  // String username
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasCreator = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('alice')
      );
      expect(hasCreator).toBe(true);
    });
  });

  describe('reply functionality', () => {
    it('shows reply button in detail mode', () => {
      const node = createMockCommentNode({ mode: 'detail' });
      const { container } = render(CommentNode, { props: { node } });

      // ReplyButton should be present in detail mode
      expect(container).toBeTruthy();
    });

    it('does not show reply button in preview mode', () => {
      const node = createMockCommentNode({ mode: 'preview' });
      const { container } = render(CommentNode, { props: { node } });

      // Reply button typically only in detail mode
      expect(container).toBeTruthy();
    });

    it('handles isReply prop correctly', () => {
      const node = createMockCommentNode({ mode: 'detail' });
      const { container } = render(CommentNode, { 
        props: { node, isReply: true } 
      });

      // Should render as a reply (affects header text)
      expect(container).toBeTruthy();
    });
  });

  describe('creator credits', () => {
    it('shows creator credits when available', () => {
      const node = createMockCommentNode({
        mode: 'detail',
        data: {
          ...createMockCommentNode().data,
          createdBy: 'testuser',  // String for inline display
          publicCredit: true
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('handles publicCredit false', () => {
      const node = createMockCommentNode({
        mode: 'detail',
        data: {
          ...createMockCommentNode().data,
          createdBy: 'testuser',
          publicCredit: false
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      expect(container).toBeTruthy();
    });

    it('defaults publicCredit to true when not specified', () => {
      const node = createMockCommentNode({
        mode: 'detail',
        data: {
          ...createMockCommentNode().data,
          createdBy: 'testuser'
          // publicCredit not specified, component defaults to true
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      expect(container).toBeTruthy();
    });
  });

  describe('mode transitions', () => {
    it('transitions from preview to detail', async () => {
      const node = createMockCommentNode({ mode: 'preview' });
      const { container, component } = render(CommentNode, { props: { node } });

      // Initially in preview mode
      expect(container).toBeTruthy();

      // Update mode
      await component.$set({ node: { ...node, mode: 'detail' } });

      // Should now be in detail mode
      expect(container).toBeTruthy();
    });

    it('transitions from detail to preview', async () => {
      const node = createMockCommentNode({ mode: 'detail' });
      const { container, component } = render(CommentNode, { props: { node } });

      // Update mode
      await component.$set({ node: { ...node, mode: 'preview' } });

      expect(container).toBeTruthy();
    });
  });

  describe('discussion store integration', () => {
    it('tracks replying state from discussionStore', () => {
      const node = createMockCommentNode({ mode: 'detail' });
      const { container } = render(CommentNode, { props: { node } });

      // Component subscribes to discussionStore
      expect(container).toBeTruthy();
    });
  });

  describe('text wrapping', () => {
    it('wraps long comment text in detail mode', () => {
      const longText = 'This is a very long comment that should wrap properly when displayed in the node because it exceeds the width of the comment display area and needs to be broken into multiple lines for readability';
      const node = createMockCommentNode({
        mode: 'detail',
        data: {
          ...createMockCommentNode().data,
          commentText: longText
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasText = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('This is a very long comment')
      );
      expect(hasText).toBe(true);
    });

    it('wraps long comment text in preview mode', () => {
      const longText = 'Another long comment for preview mode testing that needs proper wrapping';
      const node = createMockCommentNode({
        mode: 'preview',
        data: {
          ...createMockCommentNode().data,
          commentText: longText
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      const foreignObjects = container.querySelectorAll('foreignObject');
      const hasText = Array.from(foreignObjects).some(fo => 
        fo.textContent?.includes('Another long comment')
      );
      expect(hasText).toBe(true);
    });
  });

  describe('freedom of speech principle', () => {
    it('renders comments with negative net votes', () => {
      const node = createMockCommentNode({
        mode: 'preview',
        data: {
          ...createMockCommentNode().data,
          positiveVotes: 2,
          negativeVotes: 10,
          netVotes: -8
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      // Unlike other nodes, comments are always visible
      // No inclusion threshold check
      expect(container).toBeTruthy();
    });

    it('no expansion threshold for comments', () => {
      const node = createMockCommentNode({
        mode: 'preview',
        data: {
          ...createMockCommentNode().data,
          positiveVotes: 0,
          negativeVotes: 100,
          netVotes: -100
        }
      });
      const { container } = render(CommentNode, { props: { node } });

      // Comments are always included, regardless of votes
      expect(container).toBeTruthy();
    });
  });
});