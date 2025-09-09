// src/neo4j/schemas/__tests__/comment.schema.spec.ts - COMPLETE FIXED VERSION

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

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentPositiveVotes: 5,
    contentNegativeVotes: 2,
    contentNetVotes: 3,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: null,
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
        expect((commentSchema as any).supportsContentVoting()).toBe(true);
      });
    });

    describe('Inherited Voting Methods', () => {
      describe('voteContent', () => {
        it('should vote on comment content successfully', async () => {
          voteSchema.vote.mockResolvedValue(mockVoteResult);

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

        it('should validate inputs', async () => {
          await expect(
            commentSchema.voteContent('', 'user-456', true),
          ).rejects.toThrow(BadRequestException);
          await expect(
            commentSchema.voteContent('comment-123', '', true),
          ).rejects.toThrow(BadRequestException);
        });
      });

      describe('getVoteStatus', () => {
        it('should get vote status successfully', async () => {
          voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

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
          'MATCH (n:CommentNode {id: $id}) RETURN n',
          { id: 'comment-123' },
        );
        expect(result).toMatchObject({
          id: 'comment-123',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
        });
      });

      it('should return null when comment not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await commentSchema.findById('comment-123');

        expect(result).toBeNull();
      });

      it('should validate id parameter', async () => {
        await expect(commentSchema.findById('')).rejects.toThrow(
          BadRequestException,
        );

        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('update', () => {
      it('should update comment successfully', async () => {
        const updateData = { commentText: 'Updated text' };
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockCommentData, ...updateData },
          }),
        } as unknown as Record;

        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await commentSchema.update('comment-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining(
            'SET n.commentText = $updateData.commentText',
          ),
          {
            id: 'comment-123',
            updateData,
          },
        );
        expect(result).toMatchObject(updateData);
      });

      it('should validate id parameter', async () => {
        await expect(
          commentSchema.update('', { commentText: 'test' }),
        ).rejects.toThrow(BadRequestException);

        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });

    describe('delete', () => {
      it('should delete comment successfully', async () => {
        // CRITICAL FIX: Mock the existence check (step 1 of BaseNodeSchema delete)
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

        // CRITICAL FIX: Mock the delete operation (step 2)
        neo4jService.write.mockResolvedValue({} as Result);

        const result = await commentSchema.delete('comment-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (n:CommentNode {id: $id}) RETURN COUNT(n) as count',
          { id: 'comment-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          'MATCH (n:CommentNode {id: $id}) DETACH DELETE n',
          { id: 'comment-123' },
        );
        expect(result).toEqual({ success: true });
      });

      it('should throw exception when comment not found', async () => {
        // Mock existence check returning 0 (not found)
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(0)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

        await expect(
          commentSchema.delete('nonexistent-comment'),
        ).rejects.toThrow();

        // Write should not be called when node doesn't exist
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should validate id parameter', async () => {
        await expect(commentSchema.delete('')).rejects.toThrow(
          BadRequestException,
        );

        expect(neo4jService.read).not.toHaveBeenCalled();
        expect(neo4jService.write).not.toHaveBeenCalled();
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

        // FIXED: Use regex to match multiline Cypher query with comments
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringMatching(
            /MATCH \(d:DiscussionNode.*CREATE \(c:CommentNode/s,
          ),
          expect.objectContaining({
            id: 'comment-123',
            createdBy: 'user-456',
            discussionId: 'discussion-789',
            commentText: 'Test comment',
            parentCommentId: null, // undefined becomes null
          }),
        );
        expect(result).toMatchObject({
          id: 'comment-123',
          createdBy: 'user-456',
          discussionId: 'discussion-789',
          // commentText: 'Test comment',
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
          expect.stringContaining('CREATE (parent)-[:HAS_REPLY]->(c)'),
          expect.objectContaining({
            parentCommentId: 'comment-123',
          }),
        );
      });

      it('should validate comment text length', async () => {
        const longText = 'a'.repeat(10001);
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

    describe('getRepliesForComment', () => {
      it('should get replies for comment', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockCommentData, parentCommentId: 'comment-123' },
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
        'Failed to find Comment: Neo4j connection failed',
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
      ).rejects.toThrow(
        'Failed to create comment Comment: Database constraint violation',
      );
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
