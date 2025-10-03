// src/nodes/discussion/discussion.controller.spec.ts - REFACTORED FOR NEW ARCHITECTURE

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';
import type { DiscussionData } from '../../neo4j/schemas/discussion.schema';
import type { CommentData } from '../../neo4j/schemas/comment.schema';

describe('DiscussionController - Refactored Architecture', () => {
  let controller: DiscussionController;
  let discussionService: jest.Mocked<DiscussionService>;

  const mockDiscussionData: DiscussionData = {
    id: 'discussion-123',
    createdBy: 'user-456',
    associatedNodeId: 'word-789',
    associatedNodeType: 'WordNode',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    publicCredit: false,
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockRequest = {
    user: { sub: 'user-456' },
  };

  beforeEach(async () => {
    const mockDiscussionService = {
      getDiscussion: jest.fn(),
      getDiscussionWithComments: jest.fn(),
      getDiscussionWithCommentsAndVisibility: jest.fn(),
      getDiscussionComments: jest.fn(),
      getDiscussionCommentCount: jest.fn(),
      getDiscussionsByAssociatedNode: jest.fn(),
      updateDiscussion: jest.fn(),
      deleteDiscussion: jest.fn(),
      addCommentToDiscussion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscussionController],
      providers: [
        {
          provide: DiscussionService,
          useValue: mockDiscussionService,
        },
      ],
    }).compile();

    controller = module.get<DiscussionController>(DiscussionController);
    discussionService = module.get(DiscussionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================
  // READ ENDPOINTS
  // ============================================

  describe('getDiscussion', () => {
    it('should get discussion successfully', async () => {
      discussionService.getDiscussion.mockResolvedValue(mockDiscussionData);

      const result = await controller.getDiscussion('discussion-123');

      expect(discussionService.getDiscussion).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(result).toEqual(mockDiscussionData);
    });

    it('should throw NotFoundException when discussion not found', async () => {
      discussionService.getDiscussion.mockResolvedValue(null);

      await expect(controller.getDiscussion('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getDiscussion('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDiscussionWithComments', () => {
    it('should get discussion with comments successfully', async () => {
      const mockComment: CommentData = {
        id: 'comment-1',
        commentText: 'First comment',
        createdBy: 'user-123',
        discussionId: 'discussion-123',
        parentCommentId: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        publicCredit: false,
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 2,
        contentNegativeVotes: 0,
        contentNetVotes: 2,
      };

      const mockDiscussionWithComments = {
        ...mockDiscussionData,
        comments: [mockComment],
        commentCount: 1,
      };

      discussionService.getDiscussionWithComments.mockResolvedValue(
        mockDiscussionWithComments,
      );

      const result =
        await controller.getDiscussionWithComments('discussion-123');

      expect(discussionService.getDiscussionWithComments).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(result).toEqual(mockDiscussionWithComments);
      expect(result.comments).toHaveLength(1);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getDiscussionWithComments('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDiscussionWithCommentsAndVisibility', () => {
    it('should get discussion with comments and visibility', async () => {
      const mockResult = {
        ...mockDiscussionData,
        comments: [{ id: 'comment-1', isVisible: true }],
        commentCount: 1,
      };
      discussionService.getDiscussionWithCommentsAndVisibility.mockResolvedValue(
        mockResult as any,
      );

      const result = await controller.getDiscussionWithCommentsAndVisibility(
        'discussion-123',
        'newest',
        mockRequest,
      );

      expect(
        discussionService.getDiscussionWithCommentsAndVisibility,
      ).toHaveBeenCalledWith('discussion-123', 'user-456', 'newest');
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for invalid sortBy', async () => {
      await expect(
        controller.getDiscussionWithCommentsAndVisibility(
          'discussion-123',
          'invalid' as any,
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDiscussionComments', () => {
    it('should get comments for discussion', async () => {
      const mockComments = { comments: [{ id: 'comment-1' }] };
      discussionService.getDiscussionComments.mockResolvedValue(
        mockComments as any,
      );

      const result = await controller.getDiscussionComments('discussion-123');

      expect(discussionService.getDiscussionComments).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(result).toEqual(mockComments);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getDiscussionComments('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDiscussionCommentCount', () => {
    it('should get comment count for discussion', async () => {
      discussionService.getDiscussionCommentCount.mockResolvedValue(5);

      const result =
        await controller.getDiscussionCommentCount('discussion-123');

      expect(discussionService.getDiscussionCommentCount).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(result).toEqual({ count: 5 });
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getDiscussionCommentCount('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDiscussionsByNode', () => {
    it('should get discussions by associated node', async () => {
      discussionService.getDiscussionsByAssociatedNode.mockResolvedValue([
        mockDiscussionData,
      ]);

      const result = await controller.getDiscussionsByNode(
        'WordNode',
        'word-789',
      );

      expect(
        discussionService.getDiscussionsByAssociatedNode,
      ).toHaveBeenCalledWith('word-789', 'WordNode');
      expect(result).toEqual([mockDiscussionData]);
    });

    it('should throw BadRequestException for empty parameters', async () => {
      await expect(
        controller.getDiscussionsByNode('', 'word-789'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.getDiscussionsByNode('WordNode', ''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // UPDATE ENDPOINT
  // ============================================

  describe('updateDiscussion', () => {
    it('should update discussion successfully', async () => {
      const updateData = { updatedAt: new Date('2023-01-02') };
      const updatedDiscussion = { ...mockDiscussionData, ...updateData };

      discussionService.updateDiscussion.mockResolvedValue(updatedDiscussion);

      const result = await controller.updateDiscussion(
        'discussion-123',
        updateData,
      );

      expect(discussionService.updateDiscussion).toHaveBeenCalledWith(
        'discussion-123',
        updateData,
      );
      expect(result).toEqual(updatedDiscussion);
    });

    it('should throw BadRequestException for invalid fields', async () => {
      const invalidData = { associatedNodeType: 'InvalidType' } as any;

      await expect(
        controller.updateDiscussion('discussion-123', invalidData),
      ).rejects.toThrow(BadRequestException);

      expect(discussionService.updateDiscussion).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.updateDiscussion('', { updatedAt: new Date() }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // DELETE ENDPOINT
  // ============================================

  describe('deleteDiscussion', () => {
    it('should delete discussion successfully', async () => {
      discussionService.getDiscussion.mockResolvedValue(mockDiscussionData);
      discussionService.deleteDiscussion.mockResolvedValue(undefined);

      await controller.deleteDiscussion('discussion-123', mockRequest);

      expect(discussionService.getDiscussion).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(discussionService.deleteDiscussion).toHaveBeenCalledWith(
        'discussion-123',
      );
    });

    it('should throw NotFoundException if discussion not found', async () => {
      discussionService.getDiscussion.mockResolvedValue(null);

      await expect(
        controller.deleteDiscussion('nonexistent', mockRequest),
      ).rejects.toThrow(NotFoundException);

      expect(discussionService.deleteDiscussion).not.toHaveBeenCalled();
    });

    it('should throw HttpException if user is not creator', async () => {
      const otherUserDiscussion = {
        ...mockDiscussionData,
        createdBy: 'other-user',
      };
      discussionService.getDiscussion.mockResolvedValue(otherUserDiscussion);

      await expect(
        controller.deleteDiscussion('discussion-123', mockRequest),
      ).rejects.toThrow(HttpException);

      expect(discussionService.deleteDiscussion).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.deleteDiscussion('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw HttpException if user not authenticated', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(
        controller.deleteDiscussion('discussion-123', unauthenticatedRequest),
      ).rejects.toThrow(HttpException);
    });
  });

  // ============================================
  // COMMENT MANAGEMENT ENDPOINT
  // ============================================

  describe('addCommentToDiscussion', () => {
    it('should add comment to discussion successfully', async () => {
      const mockComment = {
        id: 'comment-new',
        commentText: 'New comment',
        createdBy: 'user-456',
      };
      discussionService.addCommentToDiscussion.mockResolvedValue(
        mockComment as any,
      );

      const result = await controller.addCommentToDiscussion(
        'discussion-123',
        { commentText: 'New comment' },
        mockRequest,
      );

      expect(discussionService.addCommentToDiscussion).toHaveBeenCalledWith(
        'discussion-123',
        { commentText: 'New comment' },
        'user-456',
      );
      expect(result).toEqual(mockComment);
    });

    it('should throw BadRequestException for empty discussion ID', async () => {
      await expect(
        controller.addCommentToDiscussion(
          '',
          { commentText: 'Test' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty comment text', async () => {
      await expect(
        controller.addCommentToDiscussion(
          'discussion-123',
          { commentText: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw HttpException if user not authenticated', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(
        controller.addCommentToDiscussion(
          'discussion-123',
          { commentText: 'Test' },
          unauthenticatedRequest,
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  // ============================================
  // NOTE: createDiscussion endpoint has been REMOVED
  // ============================================

  describe('Architecture Note', () => {
    it('should NOT have a createDiscussion endpoint', () => {
      // Verify that createDiscussion is not a method on the controller
      expect((controller as any).createDiscussion).toBeUndefined();
    });

    it('should focus on read and query operations', () => {
      // Verify controller has the expected methods for our new architecture
      expect(controller.getDiscussion).toBeDefined();
      expect(controller.getDiscussionWithComments).toBeDefined();
      expect(controller.getDiscussionWithCommentsAndVisibility).toBeDefined();
      expect(controller.updateDiscussion).toBeDefined();
      expect(controller.deleteDiscussion).toBeDefined();
    });
  });
});
