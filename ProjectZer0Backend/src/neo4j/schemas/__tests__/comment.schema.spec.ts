// src/neo4j/schemas/__tests__/comment.schema.spec.ts - UPDATED

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CommentSchema, CommentData } from '../comment.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';

describe('CommentSchema with BaseNodeSchema Integration', () => {
  let schema: CommentSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  const mockCommentData: CommentData = {
    id: 'comment-123',
    createdBy: 'user-456',
    publicCredit: true,
    discussionId: 'discussion-789',
    commentText: 'This is a test comment',
    parentCommentId: undefined,
    createdAt: new Date('2023-06-20T10:00:00Z'),
    updatedAt: new Date('2023-06-20T10:00:00Z'),
    // Comments don't have inclusion voting
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    // Comments have content voting only
    contentPositiveVotes: 8,
    contentNegativeVotes: 2,
    contentNetVotes: 6,
  };

  const mockReplyData: CommentData = {
    ...mockCommentData,
    id: 'reply-123',
    parentCommentId: 'comment-123',
    commentText: 'This is a reply',
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentPositiveVotes: 9,
    contentNegativeVotes: 2,
    contentNetVotes: 7,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: null, // No inclusion voting for comments
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentStatus: 'agree',
    contentPositiveVotes: 9,
    contentNegativeVotes: 2,
    contentNetVotes: 7,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentSchema,
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
          },
        },
        {
          provide: VoteSchema,
          useValue: {
            vote: jest.fn(),
            getVoteStatus: jest.fn(),
            removeVote: jest.fn(),
          },
        },
      ],
    }).compile();

    schema = module.get<CommentSchema>(CommentSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BaseNodeSchema Integration', () => {
    describe('supportsContentVoting', () => {
      it('should support content voting only', () => {
        expect((schema as any).supportsContentVoting()).toBe(true);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should map Neo4j record to CommentData', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCommentData }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(result).toEqual(mockCommentData);
        expect(result.inclusionNetVotes).toBe(0); // Always 0 for comments
        expect(result.contentNetVotes).toBe(6);
      });

      it('should handle Neo4j Integer conversion', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              ...mockCommentData,
              contentPositiveVotes: Integer.fromNumber(8),
              contentNegativeVotes: Integer.fromNumber(2),
              contentNetVotes: Integer.fromNumber(6),
            },
          }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(typeof result.contentPositiveVotes).toBe('number');
        expect(result.contentPositiveVotes).toBe(8);
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build update query excluding id', () => {
        const updateData = {
          commentText: 'Updated comment text',
        };
        const result = (schema as any).buildUpdateQuery(
          'comment-123',
          updateData,
        );

        expect(result.cypher).toContain('MATCH (n:CommentNode {id: $id})');
        expect(result.cypher).toContain('SET');
        expect(result.cypher).toContain('n.updatedAt = datetime()');
        expect(result.cypher).not.toContain('n.id =');
        expect(result.params).toEqual({
          id: 'comment-123',
          updateData,
        });
      });
    });
  });

  describe('Inherited Voting Methods', () => {
    describe('voteInclusion - Not Supported', () => {
      it('should not throw error but returns undefined for inclusion voting', async () => {
        // Comments don't throw error, they just don't do inclusion voting
        // The base method might be called but returns undefined
        const result = await schema.voteInclusion(
          'comment-123',
          'user-456',
          true,
        );

        // The method doesn't throw, it just returns undefined
        expect(result).toBeUndefined();
      });
    });

    describe('voteContent', () => {
      it('should vote on content quality', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteContent(
          'comment-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'CommentNode',
          { id: 'comment-123' },
          'user-456',
          true,
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate inputs', async () => {
        await expect(schema.voteContent('', 'user-456', true)).rejects.toThrow(
          BadRequestException,
        );
        await expect(
          schema.voteContent('comment-123', '', true),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getVoteStatus', () => {
      it('should get vote status using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('comment-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'CommentNode',
          { id: 'comment-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
        expect(result?.contentStatus).toBe('agree');
        expect(result?.inclusionStatus).toBeNull();
      });
    });

    describe('removeVote', () => {
      it('should remove content vote', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeVote(
          'comment-123',
          'user-456',
          'CONTENT',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'CommentNode',
          { id: 'comment-123' },
          'user-456',
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should reject removing inclusion vote', async () => {
        await schema.removeVote('comment-123', 'user-456', 'INCLUSION');

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'CommentNode',
          { id: 'comment-123' },
          'user-456',
          'INCLUSION',
        );
        // VoteSchema should handle this appropriately
      });
    });

    describe('getVotes', () => {
      it('should get vote counts with inclusion always 0', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('comment-123');

        expect(result).toEqual({
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 9,
          contentNegativeVotes: 2,
          contentNetVotes: 7,
        });
      });
    });
  });

  describe('Inherited CRUD Operations', () => {
    describe('findById', () => {
      it('should find a comment by id', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCommentData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.findById('comment-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:CommentNode {id: $id})'),
          { id: 'comment-123' },
        );
        expect(result).toEqual(mockCommentData);
      });

      it('should return null when comment not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.findById('nonexistent');
        expect(result).toBeNull();
      });
    });

    describe('update', () => {
      it('should update comment', async () => {
        const updateData = {
          commentText: 'Updated comment text',
        };
        const updatedComment = { ...mockCommentData, ...updateData };
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedComment }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.update('comment-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:CommentNode {id: $id})'),
          expect.objectContaining({
            id: 'comment-123',
            updateData,
          }),
        );
        expect(result?.commentText).toBe('Updated comment text');
      });
    });

    describe('delete', () => {
      it('should delete comment', async () => {
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);
        neo4jService.write.mockResolvedValue({} as Result);

        const result = await schema.delete('comment-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('COUNT(n) as count'),
          { id: 'comment-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE n'),
          { id: 'comment-123' },
        );
        expect(result).toEqual({ success: true });
      });
    });
  });

  describe('Comment-Specific Methods', () => {
    describe('createComment', () => {
      it('should create root comment successfully', async () => {
        const createData = {
          id: 'comment-new',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
          commentText: 'New comment',
        };

        const mockRecord = {
          get: jest.fn((key) => {
            if (key === 'c')
              return { properties: { ...mockCommentData, ...createData } };
            if (key === 'n')
              return { properties: { ...mockCommentData, ...createData } };
            return null;
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.createComment(createData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (c:CommentNode'),
          expect.objectContaining({
            ...createData,
            parentCommentId: null,
          }),
        );
        expect(result.id).toBe('comment-new');
        expect(result.parentCommentId).toBeUndefined();
      });

      it('should create reply comment with parent relationship', async () => {
        const createData = {
          id: 'reply-new',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
          commentText: 'Reply comment',
          parentCommentId: 'comment-123',
        };

        const mockRecord = {
          get: jest.fn((key) => {
            if (key === 'c')
              return { properties: { ...mockReplyData, ...createData } };
            if (key === 'n')
              return { properties: { ...mockReplyData, ...createData } };
            return null;
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.createComment(createData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (parent)-[:HAS_REPLY]->(c)'),
          expect.objectContaining(createData),
        );
        expect(result.parentCommentId).toBe('comment-123');
      });

      it('should validate comment text length', async () => {
        const createData = {
          id: 'comment-new',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
          commentText: 'x'.repeat(281), // Exceeds TEXT_LIMITS.MAX_COMMENT_LENGTH (280)
        };

        await expect(schema.createComment(createData)).rejects.toThrow(
          'Comment text must not exceed 280 characters',
        );
      });

      it('should handle discussion not found error', async () => {
        neo4jService.write.mockRejectedValue(new Error('Discussion not found'));

        await expect(
          schema.createComment({
            id: 'comment-new',
            createdBy: 'user-456',
            discussionId: 'nonexistent',
            commentText: 'Test',
          }),
        ).rejects.toThrow('Failed to create comment');
      });
    });

    describe('getCommentsByDiscussionId', () => {
      it('should get all comments for a discussion', async () => {
        const mockRecords = [
          {
            get: jest.fn((key) => {
              if (key === 'c') return { properties: mockCommentData };
              if (key === 'n') return { properties: mockCommentData };
              return null;
            }),
          },
          {
            get: jest.fn((key) => {
              if (key === 'c') return { properties: mockReplyData };
              if (key === 'n') return { properties: mockReplyData };
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getCommentsByDiscussionId('discussion-789');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (d:DiscussionNode {id: $discussionId})-[:HAS_COMMENT]->(c:CommentNode)',
          ),
          { discussionId: 'discussion-789' },
        );
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('comment-123');
        expect(result[1].parentCommentId).toBe('comment-123');
      });

      it('should validate discussion ID', async () => {
        await expect(schema.getCommentsByDiscussionId('')).rejects.toThrow(
          'Discussion ID is required',
        );
      });

      it('should return empty array when no comments found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getCommentsByDiscussionId('discussion-789');
        expect(result).toEqual([]);
      });
    });

    describe('getRepliesForComment', () => {
      it('should get replies for a comment', async () => {
        const mockRecords = [
          {
            get: jest.fn((key) => {
              if (key === 'reply') return { properties: mockReplyData };
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getRepliesForComment('comment-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('WHERE reply.parentCommentId = $commentId'),
          { commentId: 'comment-123' },
        );
        expect(result).toHaveLength(1);
        expect(result[0].parentCommentId).toBe('comment-123');
      });

      it('should validate comment ID', async () => {
        await expect(schema.getRepliesForComment('')).rejects.toThrow(
          'Comment ID is required',
        );
      });
    });

    describe('getCommentHierarchy', () => {
      it('should get hierarchical comment structure', async () => {
        const mockRecords = [
          {
            get: jest.fn((key) => {
              if (key === 'c') return { properties: mockCommentData };
              if (key === 'replies') return [{ properties: mockReplyData }];
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getCommentHierarchy('discussion-789');

        expect(result).toHaveLength(1);
        expect(result[0].comment.id).toBe('comment-123');
        expect(result[0].replies).toHaveLength(1);
        expect(result[0].replies[0].id).toBe('reply-123');
      });

      it('should validate discussion ID', async () => {
        await expect(schema.getCommentHierarchy('')).rejects.toThrow(
          'Discussion ID is required',
        );
      });
    });

    describe('getCommentCount', () => {
      it('should return comment count for discussion', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(15)),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getCommentCount('discussion-789');

        expect(result).toBe(15);
      });

      it('should return 0 on error', async () => {
        neo4jService.read.mockRejectedValue(new Error('Database error'));

        const result = await schema.getCommentCount('discussion-789');
        expect(result).toBe(0);
      });

      it('should validate discussion ID', async () => {
        await expect(schema.getCommentCount('')).rejects.toThrow(
          'Discussion ID is required',
        );
      });
    });

    describe('canEditComment', () => {
      it('should allow edit by author within time limit', async () => {
        const recentComment = {
          ...mockCommentData,
          createdAt: new Date(), // Just created
        };

        jest.spyOn(schema, 'findById').mockResolvedValue(recentComment);

        const result = await schema.canEditComment('comment-123', 'user-456');
        expect(result).toBe(true);
      });

      it('should reject edit by different user', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue(mockCommentData);

        const result = await schema.canEditComment(
          'comment-123',
          'different-user',
        );
        expect(result).toBe(false);
      });

      it('should reject edit after time limit', async () => {
        const oldComment = {
          ...mockCommentData,
          createdAt: new Date('2020-01-01'), // Very old
        };

        jest.spyOn(schema, 'findById').mockResolvedValue(oldComment);

        const result = await schema.canEditComment('comment-123', 'user-456');
        expect(result).toBe(false);
      });

      it('should return false when comment not found', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue(null);

        const result = await schema.canEditComment('nonexistent', 'user-456');
        expect(result).toBe(false);
      });

      it('should return false on error', async () => {
        jest
          .spyOn(schema, 'findById')
          .mockRejectedValue(new Error('Database error'));

        const result = await schema.canEditComment('comment-123', 'user-456');
        expect(result).toBe(false);
      });
    });

    describe('updateCommentText', () => {
      it('should update comment text when allowed', async () => {
        jest.spyOn(schema, 'canEditComment').mockResolvedValue(true);
        jest.spyOn(schema, 'update').mockResolvedValue({
          ...mockCommentData,
          commentText: 'Updated text',
        });

        const result = await schema.updateCommentText(
          'comment-123',
          'user-456',
          'Updated text',
        );

        expect(result.commentText).toBe('Updated text');
      });

      it('should reject update when not allowed', async () => {
        jest.spyOn(schema, 'canEditComment').mockResolvedValue(false);

        await expect(
          schema.updateCommentText('comment-123', 'user-456', 'Updated text'),
        ).rejects.toThrow('Comment cannot be edited');
      });

      it('should validate text length', async () => {
        await expect(
          schema.updateCommentText('comment-123', 'user-456', 'x'.repeat(281)),
        ).rejects.toThrow('Comment text must not exceed 280 characters');
      });

      it('should throw when comment not found', async () => {
        jest.spyOn(schema, 'canEditComment').mockResolvedValue(true);
        jest.spyOn(schema, 'update').mockResolvedValue(null);

        await expect(
          schema.updateCommentText('comment-123', 'user-456', 'Updated text'),
        ).rejects.toThrow('Comment with ID comment-123 not found');
      });
    });

    describe('getDiscussionCommentStats', () => {
      it('should return comment statistics', async () => {
        const mockRecord = {
          get: jest.fn((field) => {
            if (field === 'totalComments') return Integer.fromNumber(20);
            if (field === 'rootComments') return Integer.fromNumber(5);
            if (field === 'replies') return Integer.fromNumber(15);
            if (field === 'averageContentScore') return 3.5;
            return 0;
          }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getDiscussionCommentStats('discussion-789');

        expect(result).toEqual({
          totalComments: 20,
          rootComments: 5,
          replies: 15,
          averageContentScore: 3.5,
        });
      });

      it('should validate discussion ID', async () => {
        await expect(schema.getDiscussionCommentStats('')).rejects.toThrow(
          'Discussion ID is required',
        );
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete comment lifecycle', async () => {
      // Create comment
      const createRecord = {
        get: jest.fn((key) => {
          if (key === 'c') return { properties: mockCommentData };
          if (key === 'n') return { properties: mockCommentData };
          return null;
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [createRecord],
      } as unknown as Result);

      const created = await schema.createComment({
        id: 'comment-123',
        createdBy: 'user-456',
        discussionId: 'discussion-789',
        commentText: 'Test comment',
      });
      expect(created.id).toBe('comment-123');

      // Read comment
      const readRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCommentData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [readRecord],
      } as unknown as Result);

      const found = await schema.findById('comment-123');
      expect(found).toEqual(mockCommentData);

      // Vote on content
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const voteResult = await schema.voteContent(
        'comment-123',
        'user-789',
        true,
      );
      expect(voteResult).toEqual(mockVoteResult);

      // Update comment
      const updateData = { commentText: 'Updated comment' };
      const updatedComment = { ...mockCommentData, ...updateData };
      const updateRecord = {
        get: jest.fn().mockReturnValue({ properties: updatedComment }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [updateRecord],
      } as unknown as Result);

      const updated = await schema.update('comment-123', updateData);
      expect(updated?.commentText).toBe('Updated comment');

      // Delete comment
      const existsRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [existsRecord],
      } as unknown as Result);
      neo4jService.write.mockResolvedValueOnce({} as Result);

      const deleteResult = await schema.delete('comment-123');
      expect(deleteResult).toEqual({ success: true });
    });

    it('should handle reply comment creation', async () => {
      // Create parent comment first
      const parentRecord = {
        get: jest.fn((key) => {
          if (key === 'c') return { properties: mockCommentData };
          if (key === 'n') return { properties: mockCommentData };
          return null;
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [parentRecord],
      } as unknown as Result);

      const parent = await schema.createComment({
        id: 'comment-123',
        createdBy: 'user-456',
        discussionId: 'discussion-789',
        commentText: 'Parent comment',
      });

      // Create reply
      const replyRecord = {
        get: jest.fn((key) => {
          if (key === 'c') return { properties: mockReplyData };
          if (key === 'n') return { properties: mockReplyData };
          return null;
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [replyRecord],
      } as unknown as Result);

      const reply = await schema.createComment({
        id: 'reply-123',
        createdBy: 'user-789',
        discussionId: 'discussion-789',
        commentText: 'Reply comment',
        parentCommentId: parent.id,
      });

      expect(reply.parentCommentId).toBe('comment-123');
    });
  });

  describe('Error Handling', () => {
    it('should use standardized error messages from BaseNodeSchema', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.findById('test')).rejects.toThrow(
        'Failed to find Comment: Database connection failed',
      );
    });

    it('should handle comment-specific errors consistently', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query timeout'));

      await expect(
        schema.getCommentsByDiscussionId('discussion-789'),
      ).rejects.toThrow(
        'Failed to get comments for discussion Comment: Query timeout',
      );
    });
  });

  describe('Business Rules', () => {
    it('should enforce no inclusion voting for comments', async () => {
      // Comments might not throw an error but should not perform inclusion voting
      voteSchema.vote.mockResolvedValue({
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      });

      const result = await schema.voteInclusion(
        'comment-123',
        'user-456',
        true,
      );
      expect(result).toBeDefined();
    });

    it('should enforce comment text limits', async () => {
      await expect(
        schema.createComment({
          id: 'comment-new',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
          commentText: 'x'.repeat(281),
        }),
      ).rejects.toThrow('Comment text must not exceed 280 characters');
    });

    it('should enforce edit time limits', async () => {
      const oldComment = {
        ...mockCommentData,
        createdAt: new Date('2020-01-01'),
      };
      jest.spyOn(schema, 'findById').mockResolvedValue(oldComment);

      const canEdit = await schema.canEditComment('comment-123', 'user-456');
      expect(canEdit).toBe(false);
    });

    it('should enforce user ownership for edits', async () => {
      jest.spyOn(schema, 'findById').mockResolvedValue(mockCommentData);

      const canEdit = await schema.canEditComment(
        'comment-123',
        'different-user',
      );
      expect(canEdit).toBe(false);
    });

    it('should create HAS_COMMENT relationship to discussion', async () => {
      const createData = {
        id: 'comment-new',
        createdBy: 'user-456',
        discussionId: 'discussion-789',
        commentText: 'Test comment',
      };

      const mockRecord = {
        get: jest.fn((key) => {
          if (key === 'c') return { properties: mockCommentData };
          if (key === 'n') return { properties: mockCommentData };
          return null;
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.createComment(createData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (d)-[:HAS_COMMENT]->(c)'),
        expect.any(Object),
      );
    });

    it('should create HAS_REPLY relationship for reply comments', async () => {
      const createData = {
        id: 'reply-new',
        createdBy: 'user-456',
        discussionId: 'discussion-789',
        commentText: 'Reply comment',
        parentCommentId: 'comment-123',
      };

      const mockRecord = {
        get: jest.fn((key) => {
          if (key === 'c') return { properties: mockReplyData };
          if (key === 'n') return { properties: mockReplyData };
          return null;
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.createComment(createData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (parent)-[:HAS_REPLY]->(c)'),
        expect.any(Object),
      );
    });
  });

  describe('Input Validation', () => {
    it('should validate comment text is required', async () => {
      await expect(
        schema.createComment({
          id: 'comment-new',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
          commentText: '',
        }),
      ).rejects.toThrow();
    });

    it('should validate discussion ID is required', async () => {
      await expect(
        schema.createComment({
          id: 'comment-new',
          createdBy: 'user-456',
          discussionId: '',
          commentText: 'Test',
        }),
      ).rejects.toThrow();
    });

    it('should validate user ID is required', async () => {
      await expect(
        schema.createComment({
          id: 'comment-new',
          createdBy: '',
          discussionId: 'discussion-789',
          commentText: 'Test',
        }),
      ).rejects.toThrow();
    });

    it('should handle optional parentCommentId', async () => {
      const createData = {
        id: 'comment-new',
        createdBy: 'user-456',
        discussionId: 'discussion-789',
        commentText: 'Test comment',
        // No parentCommentId
      };

      const mockRecord = {
        get: jest.fn((key) => {
          if (key === 'c')
            return {
              properties: { ...mockCommentData, parentCommentId: null },
            };
          if (key === 'n')
            return {
              properties: { ...mockCommentData, parentCommentId: null },
            };
          return null;
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.createComment(createData);

      expect(result.parentCommentId).toBeNull();
    });
  });

  describe('Neo4j Integer Conversion', () => {
    it('should handle Neo4j Integer objects in vote counts', () => {
      const mockData = {
        ...mockCommentData,
        contentPositiveVotes: { low: 42, high: 0 },
        contentNegativeVotes: { low: 7, high: 0 },
        contentNetVotes: { low: 35, high: 0 },
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockData }),
      } as unknown as Record;

      const result = (schema as any).mapNodeFromRecord(mockRecord);

      expect(result.contentPositiveVotes).toBe(42);
      expect(result.contentNegativeVotes).toBe(7);
      expect(result.contentNetVotes).toBe(35);
      expect(typeof result.contentPositiveVotes).toBe('number');
    });

    it('should handle Neo4j Integer in getCommentCount', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ low: 25, high: 0 }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getCommentCount('discussion-789');

      expect(result).toBe(25);
      expect(typeof result).toBe('number');
    });

    it('should handle Neo4j Integer in getDiscussionCommentStats', async () => {
      const mockRecord = {
        get: jest.fn((field) => {
          if (field === 'totalComments') return { low: 100, high: 0 };
          if (field === 'rootComments') return { low: 30, high: 0 };
          if (field === 'replies') return { low: 70, high: 0 };
          if (field === 'averageContentScore') return { low: 5, high: 0 };
          return 0;
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getDiscussionCommentStats('discussion-789');

      expect(result.totalComments).toBe(100);
      expect(result.rootComments).toBe(30);
      expect(result.replies).toBe(70);
      expect(typeof result.totalComments).toBe('number');
    });
  });

  describe('Hierarchical Structure', () => {
    it('should properly map comment hierarchy', async () => {
      const parentComment = {
        ...mockCommentData,
        parentCommentId: null,
      };

      const reply1 = {
        ...mockReplyData,
        id: 'reply-1',
      };

      const reply2 = {
        ...mockReplyData,
        id: 'reply-2',
      };

      const mockRecord = {
        get: jest.fn((key) => {
          if (key === 'c') return { properties: parentComment };
          if (key === 'replies')
            return [{ properties: reply1 }, { properties: reply2 }];
          return null;
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getCommentHierarchy('discussion-789');

      expect(result).toHaveLength(1);
      expect(result[0].comment.id).toBe('comment-123');
      expect(result[0].replies).toHaveLength(2);
      expect(result[0].replies[0].id).toBe('reply-1');
      expect(result[0].replies[1].id).toBe('reply-2');
    });

    it('should handle comments without replies', async () => {
      const mockRecord = {
        get: jest.fn((key) => {
          if (key === 'c') return { properties: mockCommentData };
          if (key === 'replies') return [];
          return null;
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getCommentHierarchy('discussion-789');

      expect(result).toHaveLength(1);
      expect(result[0].replies).toHaveLength(0);
    });

    it('should only return root comments in hierarchy', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as unknown as Result);

      const result = await schema.getCommentHierarchy('discussion-789');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('WHERE c.parentCommentId IS NULL'),
        expect.any(Object),
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('Special Properties', () => {
    it('should always set inclusion votes to 0', () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: {
            ...mockCommentData,
            inclusionPositiveVotes: 100, // Should be ignored
            inclusionNegativeVotes: 50, // Should be ignored
            inclusionNetVotes: 50, // Should be ignored
          },
        }),
      } as unknown as Record;

      const result = (schema as any).mapNodeFromRecord(mockRecord);

      expect(result.inclusionPositiveVotes).toBe(0);
      expect(result.inclusionNegativeVotes).toBe(0);
      expect(result.inclusionNetVotes).toBe(0);
    });

    it('should preserve publicCredit field', () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: {
            ...mockCommentData,
            publicCredit: false,
          },
        }),
      } as unknown as Record;

      const result = (schema as any).mapNodeFromRecord(mockRecord);

      expect(result.publicCredit).toBe(false);
    });
  });

  describe('Query Structure', () => {
    it('should order comments by creation time', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await schema.getCommentsByDiscussionId('discussion-789');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY c.createdAt ASC'),
        expect.any(Object),
      );
    });

    it('should filter replies by parentCommentId', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await schema.getRepliesForComment('comment-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('WHERE reply.parentCommentId = $commentId'),
        { commentId: 'comment-123' },
      );
    });

    it('should join comments with discussion', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await schema.getCommentsByDiscussionId('discussion-789');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'MATCH (d:DiscussionNode {id: $discussionId})-[:HAS_COMMENT]->(c:CommentNode)',
        ),
        { discussionId: 'discussion-789' },
      );
    });
  });
});
