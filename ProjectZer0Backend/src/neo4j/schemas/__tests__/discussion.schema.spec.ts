// src/neo4j/schemas/__tests__/discussion.schema.spec.ts
// Updated for refactored DiscussionSchema (correct neo4j record shape + lint/type/prettier fixes)

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DiscussionSchema, DiscussionData } from '../discussion.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema } from '../vote.schema';

// --- Helpers to emulate neo4j-driver results ---------------------------------

type Neo4jNodeLike<T = any> = { properties: T };

function node<T extends Record<string, any>>(props: T): Neo4jNodeLike<T> {
  return { properties: props };
}

function recordWithAliases(map: Record<string, any>): {
  get: (k: string) => any;
} {
  return { get: (k: string) => map[k] };
}

// -----------------------------------------------------------------------------

describe('DiscussionSchema (refactored)', () => {
  let discussionSchema: DiscussionSchema;
  let neo4jService: jest.Mocked<Neo4jService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionSchema,
        {
          provide: Neo4jService,
          useValue: {
            read: jest.fn(),
            write: jest.fn(),
          },
        },
        {
          provide: VoteSchema,
          useValue: {},
        },
      ],
    }).compile();

    discussionSchema = module.get<DiscussionSchema>(DiscussionSchema);
    neo4jService = module.get(Neo4jService) as jest.Mocked<Neo4jService>;
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------
  // Base/inherited behavior
  // ------------------------------------------------------------
  describe('findById (inherited from BaseNodeSchema)', () => {
    it('returns a node when found', async () => {
      const nodeData: Partial<DiscussionData> = {
        id: 'discussion-1',
        createdBy: 'user-1',
        associatedNodeId: 'word-123',
        associatedNodeType: 'WordNode',
        createdAt: new Date('2025-09-29T00:00:00Z'),
        updatedAt: new Date('2025-09-29T00:00:00Z'),
      };

      neo4jService.read.mockResolvedValue({
        records: [
          recordWithAliases({
            // cover common aliases the BaseNodeSchema may use
            n: node(nodeData as any),
            node: node(nodeData as any),
            d: node(nodeData as any),
            data: node(nodeData as any),
          }),
        ],
      } as any);

      const result = await discussionSchema.findById('discussion-1');
      expect(neo4jService.read).toHaveBeenCalledTimes(1);
      expect(result?.id).toBe('discussion-1');
      expect(result?.associatedNodeType).toBe('WordNode');
    });

    it('returns null when not found', async () => {
      neo4jService.read.mockResolvedValue({ records: [] } as any);
      const result = await discussionSchema.findById('missing-id');
      expect(result).toBeNull();
    });

    it('throws BadRequestException for empty id', async () => {
      await expect(discussionSchema.findById('')).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.read).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------
  // createDiscussionForNode
  // ------------------------------------------------------------
  describe('createDiscussionForNode', () => {
    it('throws for missing nodeId', async () => {
      await expect(
        discussionSchema.createDiscussionForNode({
          nodeId: '',
          nodeType: 'WordNode',
          createdBy: 'user-1',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws for missing nodeType', async () => {
      await expect(
        discussionSchema.createDiscussionForNode({
          nodeId: 'word-1',
          nodeType: '',
          createdBy: 'user-1',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws for missing createdBy', async () => {
      await expect(
        discussionSchema.createDiscussionForNode({
          nodeId: 'word-1',
          nodeType: 'WordNode',
          createdBy: '',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates discussion without initial comment', async () => {
      neo4jService.write.mockResolvedValue({
        records: [recordWithAliases({ discussionId: 'disc-123' })],
      } as any);

      const out = await discussionSchema.createDiscussionForNode({
        nodeId: 'word-1',
        nodeType: 'WordNode',
        createdBy: 'user-1',
      });

      expect(neo4jService.write).toHaveBeenCalledTimes(1);
      const [cypher, params] = neo4jService.write.mock.calls[0];

      expect(typeof cypher).toBe('string');
      expect(cypher).toContain('MATCH (n:WordNode');
      expect(cypher).toContain('CREATE (d:DiscussionNode');
      expect(cypher).toContain('CREATE (n)-[:HAS_DISCUSSION]->(d)');
      expect(params).toMatchObject({
        nodeId: 'word-1',
        nodeType: 'WordNode',
        createdBy: 'user-1',
      });

      expect(out).toEqual({ discussionId: 'disc-123', commentId: undefined });
    });

    it('creates discussion with initial comment and returns commentId', async () => {
      neo4jService.write.mockResolvedValue({
        records: [recordWithAliases({ discussionId: 'disc-456' })],
      } as any);

      const out = await discussionSchema.createDiscussionForNode({
        nodeId: 'statement-2',
        nodeType: 'StatementNode',
        createdBy: 'author-9',
        initialComment: 'First!',
      });

      expect(neo4jService.write).toHaveBeenCalledTimes(1);
      const [cypher, params] = neo4jService.write.mock.calls[0];

      expect(cypher).toContain('CREATE (c:CommentNode');
      expect(cypher).toContain('CREATE (d)-[:HAS_COMMENT');
      expect(cypher).toContain('RETURN d.id as discussionId');
      expect(params).toMatchObject({
        nodeId: 'statement-2',
        nodeType: 'StatementNode',
        createdBy: 'author-9',
        initialComment: 'First!',
      });

      expect(out.discussionId).toBe('disc-456');
      expect(out.commentId).toBeDefined();
    });

    it('throws a helpful error if MATCHed node does not exist', async () => {
      neo4jService.write.mockResolvedValue({ records: [] } as any);
      await expect(
        discussionSchema.createDiscussionForNode({
          nodeId: 'nope',
          nodeType: 'WordNode',
          createdBy: 'user-1',
        }),
      ).rejects.toThrow(/Failed to create discussion/i);
    });
  });

  // ------------------------------------------------------------
  // createStandaloneDiscussion
  // ------------------------------------------------------------
  describe('createStandaloneDiscussion', () => {
    it('validates inputs', async () => {
      await expect(
        discussionSchema.createStandaloneDiscussion({
          id: '',
          createdBy: 'u',
          associatedNodeId: 'x',
          associatedNodeType: 'WordNode',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        discussionSchema.createStandaloneDiscussion({
          id: 'd1',
          createdBy: '',
          associatedNodeId: 'x',
          associatedNodeType: 'WordNode',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        discussionSchema.createStandaloneDiscussion({
          id: 'd1',
          createdBy: 'u',
          associatedNodeId: '',
          associatedNodeType: 'WordNode',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        discussionSchema.createStandaloneDiscussion({
          id: 'd1',
          createdBy: 'u',
          associatedNodeId: 'x',
          associatedNodeType: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('writes the discussion node and returns mapped data', async () => {
      const disc = {
        id: 'disc-standalone',
        createdBy: 'alice',
        associatedNodeId: 'word-789',
        associatedNodeType: 'WordNode',
        createdAt: '2025-09-29T00:00:00Z',
        updatedAt: '2025-09-29T00:00:00Z',
      };

      neo4jService.write.mockResolvedValue({
        records: [
          recordWithAliases({
            d: node(disc),
            n: node(disc),
            node: node(disc),
          }),
        ],
      } as any);

      const out = await discussionSchema.createStandaloneDiscussion({
        id: 'disc-standalone',
        createdBy: 'alice',
        associatedNodeId: 'word-789',
        associatedNodeType: 'WordNode',
      });

      expect(neo4jService.write).toHaveBeenCalledTimes(1);
      expect(out.id).toBe('disc-standalone');
      expect(out.associatedNodeId).toBe('word-789');
      expect(out.associatedNodeType).toBe('WordNode');
    });
  });

  // ------------------------------------------------------------
  // getDiscussionIdForNode & hasDiscussion
  // ------------------------------------------------------------
  describe('getDiscussionIdForNode / hasDiscussion', () => {
    it('returns discussion id if exists', async () => {
      neo4jService.read.mockResolvedValue({
        records: [recordWithAliases({ discussionId: 'disc-111' })],
      } as any);

      const id = await discussionSchema.getDiscussionIdForNode(
        'WordNode',
        'word-1',
      );
      expect(neo4jService.read).toHaveBeenCalledTimes(1);
      const [cypher, params] = neo4jService.read.mock.calls[0];
      expect(typeof cypher).toBe('string');
      expect(cypher).toContain('MATCH (n:WordNode');
      expect(cypher).toContain('[:HAS_DISCUSSION]');
      expect(params).toEqual({ nodeId: 'word-1' });
      expect(id).toBe('disc-111');
    });

    it('returns null if none exists', async () => {
      neo4jService.read.mockResolvedValue({ records: [] } as any);
      const id = await discussionSchema.getDiscussionIdForNode(
        'StatementNode',
        'stmt-1',
      );
      expect(id).toBeNull();
    });

    it('hasDiscussion returns true/false based on getDiscussionIdForNode', async () => {
      const spy = jest
        .spyOn(discussionSchema, 'getDiscussionIdForNode')
        .mockResolvedValueOnce('disc-1')
        .mockResolvedValueOnce(null);

      await expect(
        discussionSchema.hasDiscussion('WordNode', 'word-1'),
      ).resolves.toBe(true);
      await expect(
        discussionSchema.hasDiscussion('WordNode', 'word-2'),
      ).resolves.toBe(false);

      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  // ------------------------------------------------------------
  // getDiscussionsByAssociatedNode
  // ------------------------------------------------------------
  describe('getDiscussionsByAssociatedNode', () => {
    it('validates inputs', async () => {
      await expect(
        discussionSchema.getDiscussionsByAssociatedNode('', 'WordNode'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        discussionSchema.getDiscussionsByAssociatedNode('word-1', ''),
      ).rejects.toThrow(BadRequestException);
      expect(neo4jService.read).not.toHaveBeenCalled();
    });

    it('returns mapped discussions for a node', async () => {
      const d1 = {
        id: 'disc-1',
        createdBy: 'u1',
        associatedNodeId: 'word-1',
        associatedNodeType: 'WordNode',
        createdAt: '2025-09-29T00:00:00Z',
        updatedAt: '2025-09-29T00:00:00Z',
      };
      const d2 = {
        id: 'disc-2',
        createdBy: 'u2',
        associatedNodeId: 'word-1',
        associatedNodeType: 'WordNode',
        createdAt: '2025-09-29T00:00:00Z',
        updatedAt: '2025-09-29T00:00:00Z',
      };

      neo4jService.read.mockResolvedValue({
        records: [
          recordWithAliases({
            d: node(d1),
            n: node(d1),
            node: node(d1),
            data: node(d1),
          }),
          recordWithAliases({
            d: node(d2),
            n: node(d2),
            node: node(d2),
            data: node(d2),
          }),
        ],
      } as any);

      const out = await discussionSchema.getDiscussionsByAssociatedNode(
        'word-1',
        'WordNode',
      );

      expect(neo4jService.read).toHaveBeenCalledTimes(1);
      expect(Array.isArray(out)).toBe(true);
      expect(out).toHaveLength(2);
      expect(out[0].id).toBe('disc-1');
      expect(out[1].id).toBe('disc-2');
    });
  });

  // ------------------------------------------------------------
  // getDiscussionCommentCount
  // ------------------------------------------------------------
  describe('getDiscussionCommentCount', () => {
    it('validates discussionId', async () => {
      await expect(
        discussionSchema.getDiscussionCommentCount(''),
      ).rejects.toThrow(BadRequestException);
      expect(neo4jService.read).not.toHaveBeenCalled();
    });

    it('returns 0 on internal error (graceful fallback)', async () => {
      neo4jService.read.mockRejectedValue(new Error('boom'));
      const count =
        await discussionSchema.getDiscussionCommentCount('discussion-xyz');
      expect(count).toBe(0);
    });

    it('returns numeric count when successful', async () => {
      neo4jService.read.mockResolvedValue({
        records: [recordWithAliases({ commentCount: 7 })],
      } as any);

      const count =
        await discussionSchema.getDiscussionCommentCount('discussion-xyz');
      expect(count).toBe(7);
    });
  });

  // ------------------------------------------------------------
  // getDiscussionComments
  // ------------------------------------------------------------
  describe('getDiscussionComments', () => {
    it('validates discussionId', async () => {
      await expect(discussionSchema.getDiscussionComments('')).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.read).not.toHaveBeenCalled();
    });

    it('maps hierarchical or flat comments result set', async () => {
      const c1 = {
        id: 'c1',
        body: 'hello',
        createdAt: '2025-09-29T00:00:00Z',
        updatedAt: '2025-09-29T00:00:00Z',
        parentId: null,
      };

      neo4jService.read.mockResolvedValue({
        records: [
          recordWithAliases({
            // comment node under multiple common aliases
            c: node(c1),
            comment: node(c1),
            commentNode: node(c1),
            // user info
            userId: 'u1',
            username: 'Alice',
            u: node({ id: 'u1', username: 'Alice' }),
            user: node({ id: 'u1', username: 'Alice' }),
          }),
          recordWithAliases({
            c: null,
            comment: null,
            commentNode: null,
          }),
        ],
      } as any);

      const comments =
        await discussionSchema.getDiscussionComments('discussion-abc');
      expect(neo4jService.read).toHaveBeenCalledTimes(1);
      expect(Array.isArray(comments)).toBe(true);
      expect(comments).toHaveLength(1);
      expect(comments[0]).toMatchObject({
        id: 'c1',
        body: 'hello',
        userId: 'u1',
        username: 'Alice',
      });
    });

    it('propagates error using standardError', async () => {
      neo4jService.read.mockRejectedValue(new Error('db down'));
      await expect(
        discussionSchema.getDiscussionComments('discussion-abc'),
      ).rejects.toThrow(/get comments/i);
    });
  });

  // ------------------------------------------------------------
  // buildUpdateQuery (private/protected on BaseNodeSchema override)
  // ------------------------------------------------------------
  describe('buildUpdateQuery (internal)', () => {
    it('includes updatedAt set and matches DiscussionNode by id', () => {
      const updateData = { foo: 'bar', associatedNodeType: 'WordNode' };
      const { cypher, params } = (discussionSchema as any).buildUpdateQuery(
        'discussion-123',
        updateData,
      );

      expect(cypher).toContain('MATCH (n:DiscussionNode {id: $id})');
      expect(cypher).toContain('SET');
      expect(cypher).toContain('n.updatedAt = datetime()');
      expect(params).toEqual({ id: 'discussion-123', updateData });
    });
  });
});
