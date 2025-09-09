// src/nodes/comment/comment.controller.spec.ts - FIXED FOR BaseNodeSchema Integration

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';
import type { CommentData } from '../../neo4j/schemas/comment.schema';

describe('CommentController with BaseNodeSchema Integration', () => {
  let controller: CommentController;
  let commentService: jest.Mocked<CommentService>;

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentPositiveVotes: 5,
    contentNegativeVotes: 2,
    contentNetVotes: 3,
  };

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

  const mockCommentData: CommentData = {
    id: 'comment-123',
    createdBy: 'user-456',
    discussionId: 'discussion-789',
    commentText: 'This is a test comment',
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

  const mockRequest = {
    user: { sub: 'user-456' },
  };

  beforeEach(async () => {
    const mockCommentService = {
      createComment: jest.fn(),
      getComment: jest.fn(),
      getCommentWithVisibility: jest.fn(),
      updateComment: jest.fn(),
      deleteComment: jest.fn(),
      canEditComment: jest.fn(),
      voteComment: jest.fn(),
      getCommentVoteStatus: jest.fn(),
      removeCommentVote: jest.fn(),
      getCommentVotes: jest.fn(),
      setCommentVisibilityPreference: jest.fn(),
      getCommentVisibilityForUser: jest.fn(),
      getCommentsByDiscussionIdWithVisibility: jest.fn(),
      getDiscussionCommentStats: jest.fn(),
      getCommentReplies: jest.fn(),
      getCommentThread: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
      ],
    }).compile();

    controller = module.get<CommentController>(CommentController);
    commentService = module.get(CommentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createComment', () => {
    const validCommentData = {
      createdBy: 'user-456',
      discussionId: 'discussion-789',
      commentText: 'Test comment',
    };

    it('should create a comment successfully', async () => {
      commentService.createComment.mockResolvedValue(mockCommentData);

      const result = await controller.createComment(validCommentData);

      expect(commentService.createComment).toHaveBeenCalledWith(
        validCommentData,
      );
      expect(result).toEqual(mockCommentData);
    });

    it('should throw BadRequestException if discussionId is missing', async () => {
      const invalidData = { ...validCommentData, discussionId: '' };

      await expect(controller.createComment(invalidData)).rejects.toThrow(
        BadRequestException,
      );

      expect(commentService.createComment).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if commentText is empty', async () => {
      const invalidData = { ...validCommentData, commentText: '' };

      await expect(controller.createComment(invalidData)).rejects.toThrow(
        BadRequestException,
      );

      expect(commentService.createComment).not.toHaveBeenCalled();
    });
  });

  describe('getComment', () => {
    it('should get comment with visibility', async () => {
      // ✅ FIXED: Mock return includes isVisible property
      const commentWithVisibility = { ...mockCommentData, isVisible: true };
      commentService.getCommentWithVisibility.mockResolvedValue(
        commentWithVisibility,
      );

      const result = await controller.getComment('comment-123', mockRequest);

      expect(commentService.getCommentWithVisibility).toHaveBeenCalledWith(
        'comment-123',
        'user-456',
      );
      expect(result).toEqual(commentWithVisibility);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getComment('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );

      expect(commentService.getCommentWithVisibility).not.toHaveBeenCalled();
    });
  });

  describe('updateComment', () => {
    const updateData = { commentText: 'Updated comment text' };

    it('should update comment successfully', async () => {
      commentService.canEditComment.mockResolvedValue(true);
      commentService.updateComment.mockResolvedValue({
        ...mockCommentData,
        commentText: 'Updated comment text',
      });

      const result = await controller.updateComment(
        'comment-123',
        updateData,
        mockRequest,
      );

      expect(commentService.canEditComment).toHaveBeenCalledWith(
        'comment-123',
        'user-456',
      );
      expect(commentService.updateComment).toHaveBeenCalledWith(
        'comment-123',
        updateData,
      );
      expect(result.commentText).toBe('Updated comment text');
    });

    it('should throw HttpException if user cannot edit comment', async () => {
      commentService.canEditComment.mockResolvedValue(false);

      await expect(
        controller.updateComment('comment-123', updateData, mockRequest),
      ).rejects.toThrow(HttpException);

      expect(commentService.updateComment).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty comment text', async () => {
      await expect(
        controller.updateComment(
          'comment-123',
          { commentText: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(commentService.canEditComment).not.toHaveBeenCalled();
    });
  });

  describe('deleteComment', () => {
    it('should delete comment successfully', async () => {
      commentService.getComment.mockResolvedValue(mockCommentData);
      commentService.deleteComment.mockResolvedValue({ success: true });

      const result = await controller.deleteComment('comment-123', mockRequest);

      expect(commentService.getComment).toHaveBeenCalledWith('comment-123');
      expect(commentService.deleteComment).toHaveBeenCalledWith('comment-123');
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException if comment not found', async () => {
      commentService.getComment.mockResolvedValue(null);

      await expect(
        controller.deleteComment('comment-123', mockRequest),
      ).rejects.toThrow(NotFoundException);

      expect(commentService.deleteComment).not.toHaveBeenCalled();
    });

    it('should throw HttpException if user is not comment creator', async () => {
      const otherUserComment = { ...mockCommentData, createdBy: 'other-user' };
      commentService.getComment.mockResolvedValue(otherUserComment);

      await expect(
        controller.deleteComment('comment-123', mockRequest),
      ).rejects.toThrow(HttpException);

      expect(commentService.deleteComment).not.toHaveBeenCalled();
    });
  });

  describe('Content Voting (BaseNodeSchema Integration)', () => {
    describe('voteCommentContent', () => {
      it('should vote on comment content successfully', async () => {
        commentService.voteComment.mockResolvedValue(mockVoteResult);

        const result = await controller.voteCommentContent(
          'comment-123',
          { isPositive: true },
          mockRequest,
        );

        expect(commentService.voteComment).toHaveBeenCalledWith(
          'comment-123',
          'user-456',
          true,
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should handle negative content vote', async () => {
        const negativeVoteResult = { ...mockVoteResult, contentNetVotes: -1 };
        commentService.voteComment.mockResolvedValue(negativeVoteResult);

        const result = await controller.voteCommentContent(
          'comment-123',
          { isPositive: false },
          mockRequest,
        );

        expect(commentService.voteComment).toHaveBeenCalledWith(
          'comment-123',
          'user-456',
          false,
          'CONTENT',
        );
        expect(result.contentNetVotes).toBe(-1);
      });

      it('should throw BadRequestException for invalid isPositive', async () => {
        await expect(
          controller.voteCommentContent(
            'comment-123',
            { isPositive: 'invalid' as any },
            mockRequest,
          ),
        ).rejects.toThrow(BadRequestException);

        expect(commentService.voteComment).not.toHaveBeenCalled();
      });
    });

    describe('getCommentVoteStatus', () => {
      it('should get vote status successfully', async () => {
        commentService.getCommentVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await controller.getCommentVoteStatus(
          'comment-123',
          mockRequest,
        );

        expect(commentService.getCommentVoteStatus).toHaveBeenCalledWith(
          'comment-123',
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });
    });

    describe('removeCommentVote', () => {
      it('should remove content vote successfully', async () => {
        commentService.removeCommentVote.mockResolvedValue(mockVoteResult);

        const result = await controller.removeCommentVote(
          'comment-123',
          { kind: 'CONTENT' },
          mockRequest,
        );

        expect(commentService.removeCommentVote).toHaveBeenCalledWith(
          'comment-123',
          'user-456',
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for invalid vote kind', async () => {
        await expect(
          controller.removeCommentVote(
            'comment-123',
            { kind: 'INCLUSION' as any },
            mockRequest,
          ),
        ).rejects.toThrow(BadRequestException);

        expect(commentService.removeCommentVote).not.toHaveBeenCalled();
      });
    });

    describe('getCommentVotes', () => {
      it('should get vote counts successfully', async () => {
        commentService.getCommentVotes.mockResolvedValue(mockVoteResult);

        const result = await controller.getCommentVotes('comment-123');

        expect(commentService.getCommentVotes).toHaveBeenCalledWith(
          'comment-123',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });
  });

  describe('Visibility Integration (VisibilityService)', () => {
    describe('setCommentVisibilityPreference', () => {
      it('should set visibility preference successfully', async () => {
        // ✅ FIXED: Mock returns VisibilityPreference object, not { success: boolean }
        const mockVisibilityPreference = {
          isVisible: false,
          source: 'user' as const,
          timestamp: Date.now(),
        };

        commentService.setCommentVisibilityPreference.mockResolvedValue(
          mockVisibilityPreference,
        );

        const result = await controller.setCommentVisibilityPreference(
          'comment-123',
          { isVisible: false },
          mockRequest,
        );

        expect(
          commentService.setCommentVisibilityPreference,
        ).toHaveBeenCalledWith('user-456', 'comment-123', false);
        expect(result).toEqual(mockVisibilityPreference);
      });

      it('should throw BadRequestException for invalid isVisible', async () => {
        await expect(
          controller.setCommentVisibilityPreference(
            'comment-123',
            { isVisible: 'invalid' as any },
            mockRequest,
          ),
        ).rejects.toThrow(BadRequestException);

        expect(
          commentService.setCommentVisibilityPreference,
        ).not.toHaveBeenCalled();
      });
    });

    describe('getCommentVisibility', () => {
      it('should get visibility status successfully', async () => {
        commentService.getCommentVisibilityForUser.mockResolvedValue(true);

        const result = await controller.getCommentVisibility(
          'comment-123',
          mockRequest,
        );

        expect(commentService.getCommentVisibilityForUser).toHaveBeenCalledWith(
          'comment-123',
          'user-456',
        );
        expect(result).toEqual({ isVisible: true });
      });
    });
  });

  describe('getCommentsByDiscussion', () => {
    const mockCommentsWithVisibility = [
      { ...mockCommentData, isVisible: true },
      { ...mockCommentData, id: 'comment-456', isVisible: false },
    ];

    it('should get comments by discussion with visibility', async () => {
      commentService.getCommentsByDiscussionIdWithVisibility.mockResolvedValue(
        mockCommentsWithVisibility,
      );

      const result = await controller.getCommentsByDiscussion(
        'discussion-789',
        mockRequest,
        'popularity',
      );

      expect(
        commentService.getCommentsByDiscussionIdWithVisibility,
      ).toHaveBeenCalledWith('discussion-789', 'user-456', 'popularity');
      expect(result).toEqual(mockCommentsWithVisibility);
    });

    it('should use default sort order', async () => {
      commentService.getCommentsByDiscussionIdWithVisibility.mockResolvedValue(
        [],
      );

      await controller.getCommentsByDiscussion('discussion-789', mockRequest);

      expect(
        commentService.getCommentsByDiscussionIdWithVisibility,
      ).toHaveBeenCalledWith('discussion-789', 'user-456', 'popularity');
    });

    it('should throw BadRequestException for empty discussion ID', async () => {
      await expect(
        controller.getCommentsByDiscussion('', mockRequest),
      ).rejects.toThrow(BadRequestException);

      expect(
        commentService.getCommentsByDiscussionIdWithVisibility,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Comment Statistics', () => {
    describe('getDiscussionCommentStats', () => {
      // ✅ FIXED: Use correct property names from CommentSchema interface
      const mockStats = {
        totalComments: 15,
        rootComments: 8,
        replies: 7,
        averageContentScore: 2.3,
      };

      it('should get comment stats successfully', async () => {
        commentService.getDiscussionCommentStats.mockResolvedValue(mockStats);

        const result =
          await controller.getDiscussionCommentStats('discussion-789');

        expect(commentService.getDiscussionCommentStats).toHaveBeenCalledWith(
          'discussion-789',
        );
        expect(result).toEqual(mockStats);
      });

      it('should throw BadRequestException for empty discussion ID', async () => {
        await expect(controller.getDiscussionCommentStats('')).rejects.toThrow(
          BadRequestException,
        );

        expect(commentService.getDiscussionCommentStats).not.toHaveBeenCalled();
      });
    });

    describe('getDiscussionCommentCount', () => {
      it('should get comment count successfully', async () => {
        // ✅ FIXED: Use correct property names
        const mockStats = {
          totalComments: 12,
          rootComments: 5,
          replies: 7,
          averageContentScore: 1.8,
        };
        commentService.getDiscussionCommentStats.mockResolvedValue(mockStats);

        const result =
          await controller.getDiscussionCommentCount('discussion-789');

        expect(commentService.getDiscussionCommentStats).toHaveBeenCalledWith(
          'discussion-789',
        );
        expect(result).toEqual({ count: 12 });
      });
    });
  });

  describe('Comment Hierarchy', () => {
    describe('getCommentReplies', () => {
      // ✅ FIXED: All replies include isVisible property
      const mockReplies = [
        {
          ...mockCommentData,
          id: 'reply-1',
          parentCommentId: 'comment-123',
          isVisible: true,
        },
        {
          ...mockCommentData,
          id: 'reply-2',
          parentCommentId: 'comment-123',
          isVisible: true,
        },
      ];

      it('should get comment replies successfully', async () => {
        commentService.getCommentReplies.mockResolvedValue(mockReplies);

        const result = await controller.getCommentReplies(
          'comment-123',
          mockRequest,
        );

        expect(commentService.getCommentReplies).toHaveBeenCalledWith(
          'comment-123',
          'user-456',
        );
        expect(result).toEqual(mockReplies);
      });

      it('should throw BadRequestException for empty comment ID', async () => {
        await expect(
          controller.getCommentReplies('', mockRequest),
        ).rejects.toThrow(BadRequestException);

        expect(commentService.getCommentReplies).not.toHaveBeenCalled();
      });
    });

    describe('getCommentThread', () => {
      // ✅ FIXED: Root comment and replies have isVisible property
      const mockThread = {
        rootComment: { ...mockCommentData, isVisible: true },
        replies: [
          {
            ...mockCommentData,
            id: 'reply-1',
            parentCommentId: 'comment-123',
            isVisible: true,
          },
        ],
        totalCount: 2,
      };

      it('should get comment thread successfully', async () => {
        commentService.getCommentThread.mockResolvedValue(mockThread);

        const result = await controller.getCommentThread(
          'comment-123',
          mockRequest,
        );

        expect(commentService.getCommentThread).toHaveBeenCalledWith(
          'comment-123',
          'user-456',
        );
        expect(result).toEqual(mockThread);
      });

      it('should throw BadRequestException for empty comment ID', async () => {
        await expect(
          controller.getCommentThread('', mockRequest),
        ).rejects.toThrow(BadRequestException);

        expect(commentService.getCommentThread).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      commentService.getCommentWithVisibility.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        controller.getComment('comment-123', mockRequest),
      ).rejects.toThrow('Database connection failed');
    });

    it('should require user authentication for voting', async () => {
      const requestWithoutUser = { user: null };

      await expect(
        controller.voteCommentContent(
          'comment-123',
          { isPositive: true },
          requestWithoutUser,
        ),
      ).rejects.toThrow(HttpException);

      expect(commentService.voteComment).not.toHaveBeenCalled();
    });

    it('should require user authentication for visibility preferences', async () => {
      const requestWithoutUser = { user: null };

      await expect(
        controller.setCommentVisibilityPreference(
          'comment-123',
          { isVisible: true },
          requestWithoutUser,
        ),
      ).rejects.toThrow(HttpException);

      expect(
        commentService.setCommentVisibilityPreference,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Integration with BaseNodeSchema', () => {
    it('should only support content voting (no inclusion voting)', async () => {
      // This test verifies that comments don't support inclusion voting
      commentService.voteComment.mockResolvedValue({
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 1,
        contentNegativeVotes: 0,
        contentNetVotes: 1,
      });

      const result = await controller.voteCommentContent(
        'comment-123',
        { isPositive: true },
        mockRequest,
      );

      expect(commentService.voteComment).toHaveBeenCalledWith(
        'comment-123',
        'user-456',
        true,
        'CONTENT', // Only CONTENT voting supported
      );

      // Verify inclusion votes remain 0
      expect(result.inclusionPositiveVotes).toBe(0);
      expect(result.inclusionNegativeVotes).toBe(0);
      expect(result.inclusionNetVotes).toBe(0);

      // Content votes should work
      expect(result.contentPositiveVotes).toBe(1);
      expect(result.contentNetVotes).toBe(1);
    });

    it('should use VisibilityService for centralized visibility management', async () => {
      const mockVisibilityPreference = {
        isVisible: false,
        source: 'user' as const,
        timestamp: Date.now(),
      };

      commentService.setCommentVisibilityPreference.mockResolvedValue(
        mockVisibilityPreference,
      );

      const result = await controller.setCommentVisibilityPreference(
        'comment-123',
        { isVisible: false },
        mockRequest,
      );

      expect(
        commentService.setCommentVisibilityPreference,
      ).toHaveBeenCalledWith('user-456', 'comment-123', false);

      // This verifies that visibility is handled centrally, not per-comment
      expect(result.isVisible).toBe(false);
      expect(result.source).toBe('user');
    });
  });
});
