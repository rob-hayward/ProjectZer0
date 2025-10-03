// src/nodes/comment/comment.controller.spec.ts - REFACTORED FOR NEW ARCHITECTURE

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

describe('CommentController - Refactored Architecture', () => {
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
    publicCredit: false,
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

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  describe('createComment', () => {
    const validCommentData = {
      createdBy: 'user-456',
      discussionId: 'discussion-789',
      commentText: 'Test comment',
    };

    it('should create a comment successfully', async () => {
      commentService.createComment.mockResolvedValue(mockCommentData);

      const result = await controller.createComment(
        validCommentData,
        mockRequest,
      );

      expect(commentService.createComment).toHaveBeenCalledWith({
        ...validCommentData,
        createdBy: 'user-456', // From mockRequest.user.sub
      });
      expect(result).toEqual(mockCommentData);
    });

    it('should throw BadRequestException if discussionId is missing', async () => {
      const invalidData = { ...validCommentData, discussionId: '' };

      await expect(
        controller.createComment(invalidData, mockRequest),
      ).rejects.toThrow(BadRequestException);

      expect(commentService.createComment).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if commentText is empty', async () => {
      const invalidData = { ...validCommentData, commentText: '' };

      await expect(
        controller.createComment(invalidData, mockRequest),
      ).rejects.toThrow(BadRequestException);

      expect(commentService.createComment).not.toHaveBeenCalled();
    });

    it('should throw HttpException if user is not authenticated', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(
        controller.createComment(validCommentData, unauthenticatedRequest),
      ).rejects.toThrow(HttpException);

      expect(commentService.createComment).not.toHaveBeenCalled();
    });
  });

  describe('getComment', () => {
    it('should get comment with visibility', async () => {
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

    it('should throw NotFoundException if comment not found', async () => {
      commentService.getCommentWithVisibility.mockResolvedValue(null);

      await expect(
        controller.getComment('nonexistent', mockRequest),
      ).rejects.toThrow(NotFoundException);
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
      commentService.updateComment.mockResolvedValue({
        ...mockCommentData,
        commentText: 'Updated comment text',
      });

      const result = await controller.updateComment(
        'comment-123',
        updateData,
        mockRequest,
      );

      expect(commentService.updateComment).toHaveBeenCalledWith(
        'comment-123',
        'user-456',
        updateData,
      );
      expect(result.commentText).toBe('Updated comment text');
    });

    it('should throw BadRequestException for empty comment text', async () => {
      await expect(
        controller.updateComment(
          'comment-123',
          { commentText: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(commentService.updateComment).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.updateComment('', updateData, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw HttpException if user not authenticated', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(
        controller.updateComment(
          'comment-123',
          updateData,
          unauthenticatedRequest,
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteComment', () => {
    it('should delete comment successfully', async () => {
      commentService.getComment.mockResolvedValue(mockCommentData);
      commentService.deleteComment.mockResolvedValue(undefined);

      await controller.deleteComment('comment-123', mockRequest);

      expect(commentService.getComment).toHaveBeenCalledWith('comment-123');
      expect(commentService.deleteComment).toHaveBeenCalledWith('comment-123');
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

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.deleteComment('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw HttpException if user not authenticated', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(
        controller.deleteComment('comment-123', unauthenticatedRequest),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('canEditComment', () => {
    it('should check edit permission successfully', async () => {
      commentService.canEditComment.mockResolvedValue(true);

      const result = await controller.canEditComment(
        'comment-123',
        mockRequest,
      );

      expect(commentService.canEditComment).toHaveBeenCalledWith(
        'comment-123',
        'user-456',
      );
      expect(result).toEqual({ canEdit: true });
    });

    it('should return false if user cannot edit', async () => {
      commentService.canEditComment.mockResolvedValue(false);

      const result = await controller.canEditComment(
        'comment-123',
        mockRequest,
      );

      expect(result).toEqual({ canEdit: false });
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.canEditComment('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw HttpException if user not authenticated', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(
        controller.canEditComment('comment-123', unauthenticatedRequest),
      ).rejects.toThrow(HttpException);
    });
  });

  // ============================================
  // VOTING ENDPOINTS
  // ============================================

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

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.voteCommentContent('', { isPositive: true }, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw HttpException if user not authenticated', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(
        controller.voteCommentContent(
          'comment-123',
          { isPositive: true },
          unauthenticatedRequest,
        ),
      ).rejects.toThrow(HttpException);
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

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.getCommentVoteStatus('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw HttpException if user not authenticated', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(
        controller.getCommentVoteStatus('comment-123', unauthenticatedRequest),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('removeCommentVote', () => {
    it('should remove content vote successfully', async () => {
      commentService.removeCommentVote.mockResolvedValue(mockVoteResult);

      const result = await controller.removeCommentVote(
        'comment-123',
        mockRequest,
      );

      expect(commentService.removeCommentVote).toHaveBeenCalledWith(
        'comment-123',
        'user-456',
        'CONTENT',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.removeCommentVote('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw HttpException if user not authenticated', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(
        controller.removeCommentVote('comment-123', unauthenticatedRequest),
      ).rejects.toThrow(HttpException);
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

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getCommentVotes('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // VISIBILITY ENDPOINTS
  // ============================================

  describe('setCommentVisibilityPreference', () => {
    it('should set visibility preference successfully', async () => {
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
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.setCommentVisibilityPreference(
          '',
          { isVisible: true },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw HttpException if user not authenticated', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(
        controller.setCommentVisibilityPreference(
          'comment-123',
          { isVisible: true },
          unauthenticatedRequest,
        ),
      ).rejects.toThrow(HttpException);
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

    it('should work for anonymous users', async () => {
      commentService.getCommentVisibilityForUser.mockResolvedValue(true);
      const anonymousRequest = { user: null };

      const result = await controller.getCommentVisibility(
        'comment-123',
        anonymousRequest,
      );

      expect(commentService.getCommentVisibilityForUser).toHaveBeenCalledWith(
        'comment-123',
        undefined,
      );
      expect(result).toEqual({ isVisible: true });
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.getCommentVisibility('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // DISCUSSION-LEVEL ENDPOINTS
  // ============================================

  describe('getCommentsByDiscussion', () => {
    it('should get comments for discussion with default sorting', async () => {
      const mockComments = [
        { ...mockCommentData, isVisible: true },
        { ...mockCommentData, id: 'comment-2', isVisible: true },
      ];
      commentService.getCommentsByDiscussionIdWithVisibility.mockResolvedValue(
        mockComments,
      );

      const result = await controller.getCommentsByDiscussion(
        'discussion-789',
        'newest',
        mockRequest,
      );

      expect(
        commentService.getCommentsByDiscussionIdWithVisibility,
      ).toHaveBeenCalledWith('discussion-789', 'user-456', 'newest');
      expect(result).toEqual(mockComments);
    });

    it('should support different sort options', async () => {
      const mockComments = [{ ...mockCommentData, isVisible: true }];
      commentService.getCommentsByDiscussionIdWithVisibility.mockResolvedValue(
        mockComments,
      );

      await controller.getCommentsByDiscussion(
        'discussion-789',
        'topVoted',
        mockRequest,
      );

      expect(
        commentService.getCommentsByDiscussionIdWithVisibility,
      ).toHaveBeenCalledWith('discussion-789', 'user-456', 'topVoted');
    });

    it('should throw BadRequestException for empty discussion ID', async () => {
      await expect(
        controller.getCommentsByDiscussion('', 'newest', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDiscussionCommentStats', () => {
    it('should get comment stats successfully', async () => {
      const mockStats = {
        totalComments: 15,
        rootComments: 8,
        replies: 7,
        averageContentScore: 2.3,
      };
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
    });
  });

  describe('getDiscussionCommentCount', () => {
    it('should get comment count successfully', async () => {
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

    it('should throw BadRequestException for empty discussion ID', async () => {
      await expect(controller.getDiscussionCommentCount('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // THREADED COMMENT ENDPOINTS
  // ============================================

  describe('getCommentReplies', () => {
    it('should get comment replies successfully', async () => {
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
      expect(result).toHaveLength(2);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.getCommentReplies('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCommentThread', () => {
    it('should get complete comment thread successfully', async () => {
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
      expect(result.totalCount).toBe(2);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.getCommentThread('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
