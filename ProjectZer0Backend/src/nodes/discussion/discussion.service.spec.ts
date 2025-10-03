// src/nodes/discussion/discussion.service.spec.ts - REFACTORED FOR NEW ARCHITECTURE

import { Test, TestingModule } from '@nestjs/testing';
import { DiscussionService } from './discussion.service';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { CommentService } from '../comment/comment.service';
import {
  HttpException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { DiscussionData } from '../../neo4j/schemas/discussion.schema';
import type { CommentData } from '../../neo4j/schemas/comment.schema';

describe('DiscussionService - Refactored Architecture', () => {
  let service: DiscussionService;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  let commentService: jest.Mocked<CommentService>;

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

  const mockCommentData: CommentData = {
    id: 'comment-1',
    createdBy: 'user-123',
    discussionId: 'discussion-123',
    commentText: 'Test comment',
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

  beforeEach(async () => {
    const mockDiscussionSchema = {
      // BaseNodeSchema inherited methods
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),

      // DiscussionSchema specific methods
      getDiscussionIdForNode: jest.fn(),
      hasDiscussion: jest.fn(),
      getDiscussionCommentCount: jest.fn(),
    };

    const mockCommentService = {
      getCommentsByDiscussionId: jest.fn(),
      getCommentsByDiscussionIdWithVisibility: jest.fn(),
      createComment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionService,
        {
          provide: DiscussionSchema,
          useValue: mockDiscussionSchema,
        },
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
      ],
    }).compile();

    service = module.get<DiscussionService>(DiscussionService);
    discussionSchema = module.get(DiscussionSchema);
    commentService = module.get(CommentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // READ OPERATIONS
  // ============================================

  describe('getDiscussion', () => {
    it('should get discussion by id successfully', async () => {
      discussionSchema.findById.mockResolvedValue(mockDiscussionData);

      const result = await service.getDiscussion('discussion-123');

      expect(discussionSchema.findById).toHaveBeenCalledWith('discussion-123');
      expect(result).toEqual(mockDiscussionData);
    });

    it('should throw NotFoundException when discussion not found', async () => {
      discussionSchema.findById.mockResolvedValue(null);

      await expect(service.getDiscussion('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(service.getDiscussion('')).rejects.toThrow(
        BadRequestException,
      );

      expect(discussionSchema.findById).not.toHaveBeenCalled();
    });

    it('should handle schema errors', async () => {
      discussionSchema.findById.mockRejectedValue(new Error('Database error'));

      await expect(service.getDiscussion('discussion-123')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getDiscussionIdForNode', () => {
    it('should get discussion ID for a node', async () => {
      discussionSchema.getDiscussionIdForNode.mockResolvedValue(
        'discussion-123',
      );

      const result = await service.getDiscussionIdForNode(
        'WordNode',
        'word-789',
      );

      expect(discussionSchema.getDiscussionIdForNode).toHaveBeenCalledWith(
        'WordNode',
        'word-789',
        'id',
      );
      expect(result).toBe('discussion-123');
    });

    it('should return null if no discussion exists', async () => {
      discussionSchema.getDiscussionIdForNode.mockResolvedValue(null);

      const result = await service.getDiscussionIdForNode(
        'WordNode',
        'word-789',
      );

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for missing parameters', async () => {
      await expect(
        service.getDiscussionIdForNode('', 'word-789'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getDiscussionIdForNode('WordNode', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle schema errors and return null', async () => {
      discussionSchema.getDiscussionIdForNode.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.getDiscussionIdForNode(
        'WordNode',
        'word-789',
      );

      expect(result).toBeNull();
    });
  });

  describe('hasDiscussion', () => {
    it('should return true if node has discussion', async () => {
      discussionSchema.hasDiscussion.mockResolvedValue(true);

      const result = await service.hasDiscussion('WordNode', 'word-789');

      expect(discussionSchema.hasDiscussion).toHaveBeenCalledWith(
        'WordNode',
        'word-789',
        'id',
      );
      expect(result).toBe(true);
    });

    it('should return false if node has no discussion', async () => {
      discussionSchema.hasDiscussion.mockResolvedValue(false);

      const result = await service.hasDiscussion('WordNode', 'word-789');

      expect(result).toBe(false);
    });

    it('should throw BadRequestException for missing parameters', async () => {
      await expect(service.hasDiscussion('', 'word-789')).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.hasDiscussion('WordNode', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle schema errors and return false', async () => {
      discussionSchema.hasDiscussion.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.hasDiscussion('WordNode', 'word-789');

      expect(result).toBe(false);
    });
  });

  // ============================================
  // ORCHESTRATION METHODS
  // ============================================

  describe('getDiscussionWithComments', () => {
    it('should get discussion with comments successfully', async () => {
      discussionSchema.findById.mockResolvedValue(mockDiscussionData);
      const mockComments = [mockCommentData];
      commentService.getCommentsByDiscussionId.mockResolvedValue(mockComments);

      const result = await service.getDiscussionWithComments('discussion-123');

      expect(discussionSchema.findById).toHaveBeenCalledWith('discussion-123');
      expect(commentService.getCommentsByDiscussionId).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(result).toEqual({
        ...mockDiscussionData,
        comments: mockComments,
        commentCount: 1,
      });
    });

    it('should throw NotFoundException if discussion not found', async () => {
      discussionSchema.findById.mockResolvedValue(null);

      await expect(
        service.getDiscussionWithComments('nonexistent'),
      ).rejects.toThrow(NotFoundException);

      expect(commentService.getCommentsByDiscussionId).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(service.getDiscussionWithComments('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDiscussionWithCommentsAndVisibility', () => {
    it('should get discussion with comments and visibility', async () => {
      discussionSchema.findById.mockResolvedValue(mockDiscussionData);
      const mockCommentsWithVisibility = [
        { ...mockCommentData, isVisible: true },
      ];
      commentService.getCommentsByDiscussionIdWithVisibility.mockResolvedValue(
        mockCommentsWithVisibility,
      );

      const result = await service.getDiscussionWithCommentsAndVisibility(
        'discussion-123',
        'user-456',
        'newest',
      );

      expect(discussionSchema.findById).toHaveBeenCalledWith('discussion-123');
      expect(
        commentService.getCommentsByDiscussionIdWithVisibility,
      ).toHaveBeenCalledWith('discussion-123', 'user-456', 'newest');
      expect(result).toEqual({
        ...mockDiscussionData,
        comments: mockCommentsWithVisibility,
        commentCount: 1,
      });
    });

    it('should work without userId (anonymous)', async () => {
      discussionSchema.findById.mockResolvedValue(mockDiscussionData);
      commentService.getCommentsByDiscussionIdWithVisibility.mockResolvedValue(
        [],
      );

      const result =
        await service.getDiscussionWithCommentsAndVisibility('discussion-123');

      expect(
        commentService.getCommentsByDiscussionIdWithVisibility,
      ).toHaveBeenCalledWith('discussion-123', undefined, 'newest');
      expect(result.comments).toEqual([]);
    });

    it('should throw NotFoundException if discussion not found', async () => {
      discussionSchema.findById.mockResolvedValue(null);

      await expect(
        service.getDiscussionWithCommentsAndVisibility('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // COMMENT-RELATED UTILITY METHODS
  // ============================================

  describe('getDiscussionComments', () => {
    it('should get all comments for a discussion', async () => {
      discussionSchema.findById.mockResolvedValue(mockDiscussionData);
      const mockComments = [mockCommentData];
      commentService.getCommentsByDiscussionId.mockResolvedValue(mockComments);

      const result = await service.getDiscussionComments('discussion-123');

      expect(discussionSchema.findById).toHaveBeenCalledWith('discussion-123');
      expect(commentService.getCommentsByDiscussionId).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(result).toEqual({ comments: mockComments });
    });

    it('should throw BadRequestException for empty discussionId', async () => {
      await expect(service.getDiscussionComments('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDiscussionCommentCount', () => {
    it('should get comment count for discussion', async () => {
      discussionSchema.getDiscussionCommentCount.mockResolvedValue(5);

      const result = await service.getDiscussionCommentCount('discussion-123');

      expect(discussionSchema.getDiscussionCommentCount).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(result).toBe(5);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(service.getDiscussionCommentCount('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('addCommentToDiscussion', () => {
    it('should add comment to discussion successfully', async () => {
      discussionSchema.findById.mockResolvedValue(mockDiscussionData);
      commentService.createComment.mockResolvedValue(mockCommentData);

      const result = await service.addCommentToDiscussion(
        'discussion-123',
        { commentText: 'New comment' },
        'user-456',
      );

      expect(discussionSchema.findById).toHaveBeenCalledWith('discussion-123');
      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: 'user-456',
        discussionId: 'discussion-123',
        commentText: 'New comment',
        parentCommentId: undefined,
      });
      expect(result).toEqual(mockCommentData);
    });

    it('should handle parent comment ID', async () => {
      discussionSchema.findById.mockResolvedValue(mockDiscussionData);
      commentService.createComment.mockResolvedValue(mockCommentData);

      await service.addCommentToDiscussion(
        'discussion-123',
        { commentText: 'Reply', parentCommentId: 'parent-comment-1' },
        'user-456',
      );

      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: 'user-456',
        discussionId: 'discussion-123',
        commentText: 'Reply',
        parentCommentId: 'parent-comment-1',
      });
    });

    it('should throw BadRequestException for empty parameters', async () => {
      await expect(
        service.addCommentToDiscussion('', { commentText: 'Test' }, 'user-456'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.addCommentToDiscussion(
          'discussion-123',
          { commentText: '' },
          'user-456',
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.addCommentToDiscussion(
          'discussion-123',
          { commentText: 'Test' },
          '',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // MANAGEMENT OPERATIONS
  // ============================================

  describe('updateDiscussion', () => {
    it('should update discussion successfully', async () => {
      const updateData = { updatedAt: new Date('2023-01-02') };
      const updatedDiscussion = { ...mockDiscussionData, ...updateData };

      discussionSchema.findById.mockResolvedValue(mockDiscussionData);
      discussionSchema.update.mockResolvedValue(updatedDiscussion);

      const result = await service.updateDiscussion(
        'discussion-123',
        updateData,
      );

      expect(discussionSchema.findById).toHaveBeenCalledWith('discussion-123');
      expect(discussionSchema.update).toHaveBeenCalledWith(
        'discussion-123',
        updateData,
      );
      expect(result).toEqual(updatedDiscussion);
    });

    it('should throw NotFoundException if discussion not found', async () => {
      discussionSchema.findById.mockResolvedValue(null);

      await expect(
        service.updateDiscussion('nonexistent', { updatedAt: new Date() }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(
        service.updateDiscussion('', { updatedAt: new Date() }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteDiscussion', () => {
    it('should delete discussion successfully', async () => {
      discussionSchema.findById.mockResolvedValue(mockDiscussionData);
      discussionSchema.delete.mockResolvedValue(undefined);

      const result = await service.deleteDiscussion('discussion-123');

      expect(discussionSchema.findById).toHaveBeenCalledWith('discussion-123');
      expect(discussionSchema.delete).toHaveBeenCalledWith('discussion-123');
      expect(result).toEqual({
        success: true,
        message: 'Discussion deleted successfully',
      });
    });

    it('should throw NotFoundException if discussion not found', async () => {
      discussionSchema.findById.mockResolvedValue(null);

      await expect(service.deleteDiscussion('nonexistent')).rejects.toThrow(
        NotFoundException,
      );

      expect(discussionSchema.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(service.deleteDiscussion('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDiscussionsByAssociatedNode', () => {
    it('should get discussions for a node', async () => {
      discussionSchema.getDiscussionIdForNode.mockResolvedValue(
        'discussion-123',
      );
      discussionSchema.findById.mockResolvedValue(mockDiscussionData);

      const result = await service.getDiscussionsByAssociatedNode(
        'word-789',
        'WordNode',
      );

      expect(discussionSchema.getDiscussionIdForNode).toHaveBeenCalledWith(
        'WordNode',
        'word-789',
        'id',
      );
      expect(discussionSchema.findById).toHaveBeenCalledWith('discussion-123');
      expect(result).toEqual([mockDiscussionData]);
    });

    it('should return empty array if no discussion exists', async () => {
      discussionSchema.getDiscussionIdForNode.mockResolvedValue(null);

      const result = await service.getDiscussionsByAssociatedNode(
        'word-789',
        'WordNode',
      );

      expect(result).toEqual([]);
    });

    it('should throw BadRequestException for missing parameters', async () => {
      await expect(
        service.getDiscussionsByAssociatedNode('', 'WordNode'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getDiscussionsByAssociatedNode('word-789', ''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // NOTE: createDiscussion() method has been REMOVED
  // ============================================

  describe('Architecture Note', () => {
    it('should NOT have a createDiscussion method', () => {
      // Verify that createDiscussion is not a method on the service
      expect((service as any).createDiscussion).toBeUndefined();
    });
  });
});
