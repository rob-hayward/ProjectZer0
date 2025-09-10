// src/nodes/discussion/discussion.controller.spec.ts - FIXED METHOD SIGNATURES

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';
import type { DiscussionData } from '../../neo4j/schemas/discussion.schema';
import type { CommentData } from '../../neo4j/schemas/comment.schema';

describe('DiscussionController', () => {
  let controller: DiscussionController;
  let discussionService: jest.Mocked<DiscussionService>;

  const mockDiscussionData: DiscussionData = {
    id: 'discussion-123',
    createdBy: 'user-456',
    associatedNodeId: 'word-789',
    associatedNodeType: 'WordNode',
    createdAt: new Date('2023-01-01T00:00:00Z'), // ✅ Date object
    updatedAt: new Date('2023-01-01T00:00:00Z'), // ✅ Date object
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
      createDiscussion: jest.fn(),
      getDiscussion: jest.fn(),
      updateDiscussion: jest.fn(),
      deleteDiscussion: jest.fn(),
      getDiscussionWithComments: jest.fn(),
      getDiscussionsByAssociatedNode: jest.fn(),
      getDiscussionCommentCount: jest.fn(),
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

  describe('createDiscussion', () => {
    it('should create a discussion successfully', async () => {
      const createData = {
        createdBy: 'user-456',
        associatedNodeId: 'word-789',
        associatedNodeType: 'WordNode',
        initialComment: 'Initial comment',
      };

      discussionService.createDiscussion.mockResolvedValue(mockDiscussionData);

      const result = await controller.createDiscussion(createData);

      expect(discussionService.createDiscussion).toHaveBeenCalledWith(
        createData,
      );
      expect(result).toEqual(mockDiscussionData);
    });
  });

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
  });

  describe('updateDiscussion', () => {
    it('should update discussion successfully', async () => {
      const updateData = { associatedNodeType: 'UpdatedType' };
      const updatedDiscussion = {
        ...mockDiscussionData,
        ...updateData,
        updatedAt: new Date('2023-01-02T00:00:00Z'), // ✅ Date object
      };

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
  });

  describe('deleteDiscussion', () => {
    it('should delete discussion successfully', async () => {
      discussionService.getDiscussion.mockResolvedValue(mockDiscussionData);
      discussionService.deleteDiscussion.mockResolvedValue({ success: true });

      const result = await controller.deleteDiscussion(
        'discussion-123',
        mockRequest,
      );

      expect(discussionService.getDiscussion).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(discussionService.deleteDiscussion).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getDiscussionWithComments', () => {
    it('should get discussion with comments successfully', async () => {
      const mockDiscussionWithComments = {
        ...mockDiscussionData,
        comments: [
          {
            id: 'comment-1',
            commentText: 'First comment',
            createdBy: 'user-123',
            discussionId: 'discussion-123',
            parentCommentId: undefined,
            createdAt: new Date('2023-01-01T01:00:00Z'), // ✅ Date object
            updatedAt: new Date('2023-01-01T01:00:00Z'), // ✅ Date object
            inclusionPositiveVotes: 0,
            inclusionNegativeVotes: 0,
            inclusionNetVotes: 0,
            contentPositiveVotes: 2,
            contentNegativeVotes: 0,
            contentNetVotes: 2,
          } as CommentData,
        ],
      };

      discussionService.getDiscussionWithComments.mockResolvedValue(
        mockDiscussionWithComments,
      );

      // ✅ FIXED: Only one argument (id)
      const result =
        await controller.getDiscussionWithComments('discussion-123');

      expect(discussionService.getDiscussionWithComments).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(result).toEqual(mockDiscussionWithComments);
    });

    it('should throw BadRequestException for empty ID', async () => {
      // ✅ FIXED: Only one argument (empty id)
      await expect(controller.getDiscussionWithComments('')).rejects.toThrow(
        BadRequestException,
      );

      expect(
        discussionService.getDiscussionWithComments,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getDiscussionsByNode', () => {
    it('should get discussions by node successfully', async () => {
      const discussions = [mockDiscussionData];
      discussionService.getDiscussionsByAssociatedNode.mockResolvedValue(
        discussions,
      );

      const result = await controller.getDiscussionsByNode(
        'WordNode',
        'word-789',
      );

      expect(
        discussionService.getDiscussionsByAssociatedNode,
      ).toHaveBeenCalledWith('word-789', 'WordNode');
      expect(result).toEqual(discussions);
    });
  });

  describe('getDiscussionCommentCount', () => {
    it('should get discussion comment count successfully', async () => {
      discussionService.getDiscussionCommentCount.mockResolvedValue(5);

      const result =
        await controller.getDiscussionCommentCount('discussion-123');

      expect(discussionService.getDiscussionCommentCount).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(result).toBe(5);
    });
  });
});
