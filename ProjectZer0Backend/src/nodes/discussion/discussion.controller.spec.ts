// src/nodes/discussion/discussion.controller.spec.ts - FIXED FOR SIMPLIFIED CONTAINER PATTERN

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

describe('DiscussionController with Simplified Container Pattern', () => {
  let controller: DiscussionController;
  let discussionService: jest.Mocked<DiscussionService>;

  const mockDiscussionData: DiscussionData = {
    id: 'discussion-123',
    createdBy: 'user-456',
    associatedNodeId: 'word-789',
    associatedNodeType: 'WordNode',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
      // ❌ REMOVED: No voting methods (discussions don't vote)
      // ❌ REMOVED: No visibility methods (no user visibility preferences)
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
    const validDiscussionData = {
      createdBy: 'user-456',
      associatedNodeId: 'word-789',
      associatedNodeType: 'WordNode',
    };

    it('should create a discussion successfully', async () => {
      discussionService.createDiscussion.mockResolvedValue(mockDiscussionData);

      const result = await controller.createDiscussion(validDiscussionData);

      expect(discussionService.createDiscussion).toHaveBeenCalledWith(
        validDiscussionData,
      );
      expect(result).toEqual(mockDiscussionData);
    });

    it('should create discussion with initial comment', async () => {
      const dataWithComment = {
        ...validDiscussionData,
        initialComment: 'Initial comment text',
      };

      discussionService.createDiscussion.mockResolvedValue(mockDiscussionData);

      const result = await controller.createDiscussion(dataWithComment);

      expect(discussionService.createDiscussion).toHaveBeenCalledWith(
        dataWithComment,
      );
      expect(result).toEqual(mockDiscussionData);
    });

    it('should throw BadRequestException if createdBy is missing', async () => {
      const invalidData = { ...validDiscussionData, createdBy: '' };

      await expect(controller.createDiscussion(invalidData)).rejects.toThrow(
        BadRequestException,
      );

      expect(discussionService.createDiscussion).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if associatedNodeId is missing', async () => {
      const invalidData = { ...validDiscussionData, associatedNodeId: '' };

      await expect(controller.createDiscussion(invalidData)).rejects.toThrow(
        BadRequestException,
      );

      expect(discussionService.createDiscussion).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if associatedNodeType is missing', async () => {
      const invalidData = { ...validDiscussionData, associatedNodeType: '' };

      await expect(controller.createDiscussion(invalidData)).rejects.toThrow(
        BadRequestException,
      );

      expect(discussionService.createDiscussion).not.toHaveBeenCalled();
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

    it('should throw NotFoundException if discussion not found', async () => {
      discussionService.getDiscussion.mockResolvedValue(null);

      await expect(controller.getDiscussion('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getDiscussion('')).rejects.toThrow(
        BadRequestException,
      );

      expect(discussionService.getDiscussion).not.toHaveBeenCalled();
    });
  });

  describe('updateDiscussion', () => {
    it('should update discussion successfully', async () => {
      const updateData = { updatedAt: new Date().toISOString() };
      const updatedDiscussion = { ...mockDiscussionData, ...updateData };

      discussionService.updateDiscussion.mockResolvedValue(updatedDiscussion);

      // ✅ FIXED: Removed extra parameter - method only takes (id, updateData)
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

    it('should filter out non-allowed fields', async () => {
      const updateData = {
        updatedAt: new Date().toISOString(),
        invalidField: 'should be filtered',
        anotherInvalidField: 'also filtered',
      };

      const filteredData = { updatedAt: updateData.updatedAt };
      discussionService.updateDiscussion.mockResolvedValue({
        ...mockDiscussionData,
        ...filteredData,
      });

      // ✅ FIXED: Removed extra parameter
      await controller.updateDiscussion('discussion-123', updateData);

      expect(discussionService.updateDiscussion).toHaveBeenCalledWith(
        'discussion-123',
        filteredData, // Only allowed fields
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      // ✅ FIXED: Removed extra parameter
      await expect(controller.updateDiscussion('', {})).rejects.toThrow(
        BadRequestException,
      );

      expect(discussionService.updateDiscussion).not.toHaveBeenCalled();
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

    it('should throw NotFoundException if discussion not found', async () => {
      discussionService.getDiscussion.mockResolvedValue(null);

      await expect(
        controller.deleteDiscussion('nonexistent', mockRequest),
      ).rejects.toThrow(NotFoundException);

      expect(discussionService.deleteDiscussion).not.toHaveBeenCalled();
    });

    it('should throw HttpException if user is not discussion creator', async () => {
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

      expect(discussionService.getDiscussion).not.toHaveBeenCalled();
      expect(discussionService.deleteDiscussion).not.toHaveBeenCalled();
    });
  });

  describe('getDiscussionWithComments', () => {
    // ✅ FIXED: Complete CommentData objects with all required properties
    const mockDiscussionWithComments = {
      ...mockDiscussionData,
      comments: [
        {
          id: 'comment-1',
          commentText: 'First comment',
          createdBy: 'user-123',
          discussionId: 'discussion-123', // ✅ FIXED: Added required discussionId
          parentCommentId: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 2,
          contentNegativeVotes: 0,
          contentNetVotes: 2,
        } as CommentData,
        {
          id: 'comment-2',
          commentText: 'Second comment',
          createdBy: 'user-456',
          discussionId: 'discussion-123', // ✅ FIXED: Added required discussionId
          parentCommentId: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 1,
          contentNegativeVotes: 1,
          contentNetVotes: 0,
        } as CommentData,
      ],
    };

    it('should get discussion with comments successfully', async () => {
      discussionService.getDiscussionWithComments.mockResolvedValue(
        mockDiscussionWithComments,
      );

      // ✅ FIXED: Removed extra parameter - method only takes (id)
      const result =
        await controller.getDiscussionWithComments('discussion-123');

      expect(discussionService.getDiscussionWithComments).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(result).toEqual(mockDiscussionWithComments);
      expect(result.comments).toHaveLength(2);
    });

    it('should throw BadRequestException for empty ID', async () => {
      // ✅ FIXED: Removed extra parameter
      await expect(controller.getDiscussionWithComments('')).rejects.toThrow(
        BadRequestException,
      );

      expect(
        discussionService.getDiscussionWithComments,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getDiscussionsByNode', () => {
    const mockDiscussions = [
      mockDiscussionData,
      {
        ...mockDiscussionData,
        id: 'discussion-456',
        createdBy: 'user-789',
      },
    ];

    it('should get discussions by node successfully', async () => {
      discussionService.getDiscussionsByAssociatedNode.mockResolvedValue(
        mockDiscussions,
      );

      const result = await controller.getDiscussionsByNode(
        'WordNode',
        'word-789',
      );

      expect(
        discussionService.getDiscussionsByAssociatedNode,
      ).toHaveBeenCalledWith('word-789', 'WordNode');
      expect(result).toEqual(mockDiscussions);
    });

    it('should throw BadRequestException for empty node type', async () => {
      await expect(
        controller.getDiscussionsByNode('', 'word-789'),
      ).rejects.toThrow(BadRequestException);

      expect(
        discussionService.getDiscussionsByAssociatedNode,
      ).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty node ID', async () => {
      await expect(
        controller.getDiscussionsByNode('WordNode', ''),
      ).rejects.toThrow(BadRequestException);

      expect(
        discussionService.getDiscussionsByAssociatedNode,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getDiscussionCommentCount', () => {
    it('should get comment count successfully', async () => {
      discussionService.getDiscussionCommentCount.mockResolvedValue(15);

      const result =
        await controller.getDiscussionCommentCount('discussion-123');

      expect(discussionService.getDiscussionCommentCount).toHaveBeenCalledWith(
        'discussion-123',
      );
      expect(result).toEqual({ count: 15 });
    });

    it('should return 0 count when service returns 0', async () => {
      discussionService.getDiscussionCommentCount.mockResolvedValue(0);

      const result =
        await controller.getDiscussionCommentCount('discussion-123');

      expect(result).toEqual({ count: 0 });
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getDiscussionCommentCount('')).rejects.toThrow(
        BadRequestException,
      );

      expect(
        discussionService.getDiscussionCommentCount,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      discussionService.getDiscussion.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(controller.getDiscussion('discussion-123')).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should propagate service exceptions', async () => {
      discussionService.createDiscussion.mockRejectedValue(
        new HttpException('Node not found', 404),
      );

      await expect(
        controller.createDiscussion({
          createdBy: 'user-456',
          associatedNodeId: 'nonexistent',
          associatedNodeType: 'WordNode',
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('Simplified Container Pattern Verification', () => {
    it('should NOT have voting endpoints (discussions are containers, not votable)', () => {
      // Verify that voting methods don't exist on the controller
      expect((controller as any).voteDiscussion).toBeUndefined();
      expect((controller as any).getDiscussionVoteStatus).toBeUndefined();
      expect((controller as any).removeDiscussionVote).toBeUndefined();
      expect((controller as any).getDiscussionVotes).toBeUndefined();
    });

    it('should NOT have visibility preference endpoints (no user visibility preferences)', () => {
      // Verify that visibility preference methods don't exist on the controller
      expect((controller as any).setVisibilityStatus).toBeUndefined();
      expect((controller as any).getVisibilityStatus).toBeUndefined();
      expect(
        (controller as any).setDiscussionVisibilityPreference,
      ).toBeUndefined();
      expect((controller as any).getDiscussionVisibility).toBeUndefined();
    });

    it('should focus on CRUD operations only', () => {
      // Verify the controller has the expected simple CRUD methods
      expect(controller.createDiscussion).toBeDefined();
      expect(controller.getDiscussion).toBeDefined();
      expect(controller.updateDiscussion).toBeDefined();
      expect(controller.deleteDiscussion).toBeDefined();
    });

    it('should support container-specific operations', () => {
      // Verify container-specific methods exist
      expect(controller.getDiscussionWithComments).toBeDefined();
      expect(controller.getDiscussionsByNode).toBeDefined();
      expect(controller.getDiscussionCommentCount).toBeDefined();
    });

    it('should handle discussion-comment relationships', async () => {
      // ✅ FIXED: Complete CommentData in mock
      const mockDiscussionWithComments = {
        ...mockDiscussionData,
        comments: [
          {
            id: 'comment-1',
            commentText: 'Test comment',
            createdBy: 'user-123',
            discussionId: 'discussion-123', // ✅ FIXED: Added required property
            parentCommentId: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
            inclusionPositiveVotes: 0,
            inclusionNegativeVotes: 0,
            inclusionNetVotes: 0,
            contentPositiveVotes: 3,
            contentNegativeVotes: 1,
            contentNetVotes: 2,
          } as CommentData,
        ],
      };

      discussionService.getDiscussionWithComments.mockResolvedValue(
        mockDiscussionWithComments,
      );

      // ✅ FIXED: Removed extra parameter
      const result =
        await controller.getDiscussionWithComments('discussion-123');

      // Verify discussions act as containers for comments
      expect(result.id).toBe('discussion-123');
      expect(result.comments).toBeDefined();
      expect(Array.isArray(result.comments)).toBe(true);
      expect(result.comments).toHaveLength(1);
    });

    it('should handle node associations correctly', async () => {
      const mockDiscussions = [mockDiscussionData];
      discussionService.getDiscussionsByAssociatedNode.mockResolvedValue(
        mockDiscussions,
      );

      const result = await controller.getDiscussionsByNode(
        'WordNode',
        'word-789',
      );

      // Verify discussions are properly associated with nodes
      expect(result).toHaveLength(1);
      expect(result[0].associatedNodeId).toBe('word-789');
      expect(result[0].associatedNodeType).toBe('WordNode');
    });
  });

  describe('Integration with BaseNodeSchema Architecture', () => {
    it('should work with other converted node types', async () => {
      // Test that discussions work with converted node types like WordNode
      const wordDiscussionData = {
        createdBy: 'user-456',
        associatedNodeId: 'standardized-word',
        associatedNodeType: 'WordNode',
      };

      discussionService.createDiscussion.mockResolvedValue({
        ...mockDiscussionData,
        associatedNodeId: 'standardized-word',
        associatedNodeType: 'WordNode',
      });

      const result = await controller.createDiscussion(wordDiscussionData);

      expect(result.associatedNodeId).toBe('standardized-word');
      expect(result.associatedNodeType).toBe('WordNode');
    });

    it('should support multiple node types', async () => {
      const nodeTypes = ['WordNode', 'StatementNode', 'DefinitionNode'];

      for (const nodeType of nodeTypes) {
        discussionService.getDiscussionsByAssociatedNode.mockResolvedValue([
          { ...mockDiscussionData, associatedNodeType: nodeType },
        ]);

        const result = await controller.getDiscussionsByNode(
          nodeType,
          'node-123',
        );

        expect(result[0].associatedNodeType).toBe(nodeType);
      }
    });
  });
});
