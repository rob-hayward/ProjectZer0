// src/neo4j/schemas/__tests__/comment.schema.spec.ts - FIXED FOR BaseNodeSchema Integration

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CommentSchema, CommentData } from '../comment.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';

describe('CommentSchema with BaseNodeSchema Integration', () => {
  let commentSchema: CommentSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  const mockCommentData: CommentData = {
    id: 'comment-123',
    createdBy: 'user-456',
    discussionId: 'discussion-789',
    commentText: 'Test comment text',
    parentCommentId: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentPositiveVotes: 5,
    contentNegativeVotes: 2,
    contentNetVotes: 3,
  };

  // ✅ FIXED: Correct VoteResult interface
  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentPositiveVotes: 5,
    contentNegativeVotes: 2,
    contentNetVotes: 3,
  };

  // ✅ FIXED: Correct VoteStatus interface
  const mockVoteStatus: VoteStatus = {
    inclusionStatus: null, // Comments don't have inclusion voting
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentStatus: 'agree',
    contentPositiveVotes: 5,
    contentNegativeVotes: 2,
    contentNetVotes: 3,
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

    commentSchema = module.get<CommentSchema>(CommentSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(commentSchema).toBeDefined();
  });

  describe('BaseNodeSchema Integration', () => {
    describe('supportsContentVoting', () => {
      it('should return true for comments', () => {
        // Access the protected method for testing
        const supportsContentVoting = (
          commentSchema as any
        ).supportsContentVoting();
        expect(supportsContentVoting).toBe(true);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should map Neo4j record to CommentData correctly', () => {
        const mockRecord = {
          get: jest.fn().mockImplementation((key) => {
            if (key === 'n') {
              return {
                properties: {
                  id: 'comment-123',
                  createdBy: 'user-456',
                  discussionId: 'discussion-789',
                  commentText: 'Test comment',
                  parentCommentId: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  // Neo4j Integer objects
                  contentPositiveVotes: { low: 5, high: 0 } as Integer,
                  contentNegativeVotes: { low: 2, high: 0 } as Integer,
                  contentNetVotes: { low: 3, high: 0 } as Integer,
                },
              };
            }
            return null;
          }),
        } as unknown as Record;

        const result = (commentSchema as any).mapNodeFromRecord(mockRecord);

        expect(result).toMatchObject({
          id: 'comment-123',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
          commentText: 'Test comment',
          parentCommentId: null,
          // Should convert Neo4j Integers to numbers
          contentPositiveVotes: 5,
          contentNegativeVotes: 2,
          contentNetVotes: 3,
          // Comments don't have inclusion voting
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
        });
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build correct update query', () => {
        const updateData = { commentText: 'Updated comment' };
        const result = (commentSchema as any).buildUpdateQuery(
          'comment-123',
          updateData,
        );

        expect(result.cypher).toContain('MATCH (n:CommentNode {id: $id})');
        expect(result.cypher).toContain(
          'SET n.commentText = $updateData.commentText',
        );
        expect(result.cypher).toContain('n.updatedAt = datetime()');
        expect(result.params).toEqual({
          id: 'comment-123',
          updateData: updateData,
        });
      });

      it('should not include id field in update', () => {
        const updateData = {
          id: 'should-be-filtered',
          commentText: 'Updated comment',
        };
        const result = (commentSchema as any).buildUpdateQuery(
          'comment-123',
          updateData,
        );

        expect(result.cypher).not.toContain('n.id =');
        expect(result.cypher).toContain('n.commentText =');
      });
    });
  });

  describe('Inherited Voting Methods (from BaseNodeSchema)', () => {
    describe('voteContent', () => {
      it('should vote on comment content successfully', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        // ✅ FIXED: Use voteContent (inherited method), not voteComment
        const result = await commentSchema.voteContent(
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

      it('should handle negative votes', async () => {
        const negativeResult = { ...mockVoteResult, contentNetVotes: -1 };
        voteSchema.vote.mockResolvedValue(negativeResult);

        const result = await commentSchema.voteContent(
          'comment-123',
          'user-456',
          false,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'CommentNode',
          { id: 'comment-123' },
          'user-456',
          false,
          'CONTENT',
        );
        expect(result.contentNetVotes).toBe(-1);
      });

      it('should validate inputs', async () => {
        await expect(
          commentSchema.voteContent('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(
          commentSchema.voteContent('comment-123', '', true),
        ).rejects.toThrow(BadRequestException);

        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus', () => {
      it('should get vote status successfully', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        // ✅ FIXED: Use getVoteStatus (inherited method), not getCommentVoteStatus
        const result = await commentSchema.getVoteStatus(
          'comment-123',
          'user-456',
        );

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'CommentNode',
          { id: 'comment-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when no vote status exists', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await commentSchema.getVoteStatus(
          'comment-123',
          'user-456',
        );

        expect(result).toBeNull();
      });

      it('should validate inputs', async () => {
        await expect(
          commentSchema.getVoteStatus('', 'user-456'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          commentSchema.getVoteStatus('comment-123', ''),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('removeVote', () => {
      it('should remove content vote successfully', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await commentSchema.removeVote(
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

      it('should validate inputs', async () => {
        await expect(
          commentSchema.removeVote('', 'user-456', 'CONTENT'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          commentSchema.removeVote('comment-123', '', 'CONTENT'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getVotes', () => {
      it('should get vote counts successfully', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await commentSchema.getVotes('comment-123');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'CommentNode',
          { id: 'comment-123' },
          '',
        );
        expect(result).toEqual({
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 5,
          contentNegativeVotes: 2,
          contentNetVotes: 3,
        });
      });

      it('should return null when no votes exist', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await commentSchema.getVotes('comment-123');

        expect(result).toBeNull();
      });
    });
  });

  describe('Inherited CRUD Methods (from BaseNodeSchema)', () => {
    describe('findById', () => {
      it('should find comment by id', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              id: 'comment-123',
              createdBy: 'user-456',
              discussionId: 'discussion-789',
              commentText: 'Test comment',
              contentPositiveVotes: 5,
              contentNegativeVotes: 2,
              contentNetVotes: 3,
            },
          }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await commentSchema.findById('comment-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:CommentNode {id: $id})'),
          { id: 'comment-123' },
        );
        expect(result).toMatchObject({
          id: 'comment-123',
          createdBy: 'user-456',
        });
      });

      it('should return null when comment not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await commentSchema.findById('nonexistent');

        expect(result).toBeNull();
      });

      it('should validate id', async () => {
        await expect(commentSchema.findById('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('update', () => {
      it('should update comment successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              ...mockCommentData,
              commentText: 'Updated comment',
            },
          }),
        } as unknown as Record;

        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await commentSchema.update('comment-123', {
          commentText: 'Updated comment',
        });

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:CommentNode {id: $id})'),
          expect.objectContaining({
            id: 'comment-123',
            updateData: { commentText: 'Updated comment' },
          }),
        );
        expect(result.commentText).toBe('Updated comment');
      });
    });

    describe('delete', () => {
      it('should delete comment successfully', async () => {
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await commentSchema.delete('comment-123');

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:CommentNode {id: $id})'),
          { id: 'comment-123' },
        );
        expect(result).toBeDefined();
      });
    });
  });

  describe('Comment-Specific Methods', () => {
    describe('createComment', () => {
      it('should create a comment successfully', async () => {
        const commentData = {
          id: 'comment-123',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
          commentText: 'Test comment',
          parentCommentId: undefined,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: mockCommentData,
          }),
        } as unknown as Record;

        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await commentSchema.createComment(commentData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (c:CommentNode'),
          expect.objectContaining(commentData),
        );
        expect(result).toMatchObject({
          id: 'comment-123',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
          commentText: 'Test comment',
        });
      });

      it('should create comment with parent relationship', async () => {
        const commentData = {
          id: 'reply-123',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
          commentText: 'Reply comment',
          parentCommentId: 'comment-123',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: commentData }),
        } as unknown as Record;

        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        await commentSchema.createComment(commentData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('HAS_REPLY'),
          expect.objectContaining({
            parentCommentId: 'comment-123',
          }),
        );
      });

      it('should validate comment text length', async () => {
        const longText = 'a'.repeat(10001); // Assuming MAX_COMMENT_LENGTH is 10000
        const commentData = {
          id: 'comment-123',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
          commentText: longText,
        };

        await expect(commentSchema.createComment(commentData)).rejects.toThrow(
          BadRequestException,
        );

        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });

    describe('getCommentsByDiscussionId', () => {
      it('should get comments by discussion id', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: mockCommentData,
          }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result =
          await commentSchema.getCommentsByDiscussionId('discussion-789');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (d:DiscussionNode {id: $discussionId})',
          ),
          { discussionId: 'discussion-789' },
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'comment-123',
          discussionId: 'discussion-789',
        });
      });

      it('should return empty array for discussion with no comments', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result =
          await commentSchema.getCommentsByDiscussionId('discussion-789');

        expect(result).toEqual([]);
      });

      it('should validate discussion id', async () => {
        await expect(
          commentSchema.getCommentsByDiscussionId(''),
        ).rejects.toThrow(BadRequestException);

        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('getDiscussionCommentStats', () => {
      it('should get comment statistics', async () => {
        const mockRecord = {
          get: jest.fn().mockImplementation((key) => {
            const stats = {
              totalComments: { low: 15, high: 0 } as Integer,
              rootComments: { low: 8, high: 0 } as Integer,
              replies: { low: 7, high: 0 } as Integer,
              averageContentScore: 2.5,
            };
            return stats[key] || 0;
          }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result =
          await commentSchema.getDiscussionCommentStats('discussion-789');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('COUNT(c) as totalComments'),
          { discussionId: 'discussion-789' },
        );
        expect(result).toEqual({
          totalComments: 15,
          rootComments: 8,
          replies: 7,
          averageContentScore: 2.5,
        });
      });

      it('should validate discussion id', async () => {
        await expect(
          commentSchema.getDiscussionCommentStats(''),
        ).rejects.toThrow(BadRequestException);

        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('canEditComment', () => {
      it('should allow editing within time limit', async () => {
        const recentComment = {
          ...mockCommentData,
          createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        };

        jest.spyOn(commentSchema, 'findById').mockResolvedValue(recentComment);

        const result = await commentSchema.canEditComment(
          'comment-123',
          'user-456',
        );

        expect(result).toBe(true);
      });

      it('should deny editing after time limit', async () => {
        const oldComment = {
          ...mockCommentData,
          createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        };

        jest.spyOn(commentSchema, 'findById').mockResolvedValue(oldComment);

        const result = await commentSchema.canEditComment(
          'comment-123',
          'user-456',
        );

        expect(result).toBe(false);
      });

      it('should deny editing by non-author', async () => {
        jest
          .spyOn(commentSchema, 'findById')
          .mockResolvedValue(mockCommentData);

        const result = await commentSchema.canEditComment(
          'comment-123',
          'other-user',
        );

        expect(result).toBe(false);
      });

      it('should handle non-existent comment', async () => {
        jest.spyOn(commentSchema, 'findById').mockResolvedValue(null);

        const result = await commentSchema.canEditComment(
          'nonexistent',
          'user-456',
        );

        expect(result).toBe(false);
      });
    });

    describe('getRepliesForComment', () => {
      it('should get replies for a comment', async () => {
        const mockReply = {
          ...mockCommentData,
          id: 'reply-123',
          parentCommentId: 'comment-123',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: mockReply,
          }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await commentSchema.getRepliesForComment('comment-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('WHERE reply.parentCommentId = $commentId'),
          { commentId: 'comment-123' },
        );
        expect(result).toHaveLength(1);
        expect(result[0].parentCommentId).toBe('comment-123');
      });

      it('should validate comment id', async () => {
        await expect(commentSchema.getRepliesForComment('')).rejects.toThrow(
          BadRequestException,
        );

        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Neo4j errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Neo4j connection failed'));

      await expect(commentSchema.findById('comment-123')).rejects.toThrow(
        'Failed to find by ID',
      );
    });

    it('should use standardError helper for consistent error messages', async () => {
      neo4jService.write.mockRejectedValue(
        new Error('Database constraint violation'),
      );

      await expect(
        commentSchema.createComment({
          id: 'comment-123',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
          commentText: 'Test',
        }),
      ).rejects.toThrow('Failed to create comment Comment');
    });
  });

  describe('Integration with VoteSchema', () => {
    it('should properly delegate voting to VoteSchema', async () => {
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      await commentSchema.voteContent('comment-123', 'user-456', true);

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'CommentNode',
        { id: 'comment-123' },
        'user-456',
        true,
        'CONTENT',
      );
    });

    it('should handle voting errors from VoteSchema', async () => {
      voteSchema.vote.mockRejectedValue(new Error('Voting failed'));

      await expect(
        commentSchema.voteContent('comment-123', 'user-456', true),
      ).rejects.toThrow('Failed to vote on Comment');
    });
  });

  describe('Neo4j Integer Conversion', () => {
    it('should convert Neo4j Integer objects to numbers', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: {
            id: 'comment-123',
            createdBy: 'user-456',
            discussionId: 'discussion-789',
            commentText: 'Test',
            contentPositiveVotes: { low: 42, high: 0 } as Integer,
            contentNegativeVotes: { low: 7, high: 0 } as Integer,
            contentNetVotes: { low: 35, high: 0 } as Integer,
          },
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await commentSchema.findById('comment-123');

      expect(result.contentPositiveVotes).toBe(42);
      expect(result.contentNegativeVotes).toBe(7);
      expect(result.contentNetVotes).toBe(35);
    });
  });
});
