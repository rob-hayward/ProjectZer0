// src/nodes/discussion/discussion.service.spec.ts - UPDATED FOR BaseNodeSchema

import { Test, TestingModule } from '@nestjs/testing';
import { DiscussionService } from './discussion.service';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { CommentService } from '../comment/comment.service';

describe('DiscussionService with BaseNodeSchema Integration', () => {
  let service: DiscussionService;
  let schema: jest.Mocked<DiscussionSchema>;
  let commentService: jest.Mocked<CommentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionService,
        {
          provide: DiscussionSchema,
          useValue: {
            // ✅ BaseNodeSchema inherited methods
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),

            // ✅ DiscussionSchema specific methods
            createDiscussion: jest.fn(),
            getDiscussionsByAssociatedNode: jest.fn(),
            getDiscussionCommentCount: jest.fn(),

            // ❌ REMOVED: Old custom methods no longer exist
            // getDiscussion, updateDiscussion, deleteDiscussion
            // setVisibilityStatus, getVisibilityStatus
          },
        },
        {
          provide: CommentService,
          useValue: {
            createComment: jest.fn(),
            getCommentsByDiscussionId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DiscussionService>(DiscussionService);
    schema = module.get(DiscussionSchema);
    commentService = module.get(CommentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDiscussion', () => {
    it('should call schema.createDiscussion with correct parameters', async () => {
      const discussionData = {
        createdBy: 'user1',
        associatedNodeId: 'node1',
        associatedNodeType: 'BeliefNode',
      };

      const mockDiscussion = {
        id: 'discussion1',
        ...discussionData,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      schema.createDiscussion.mockResolvedValue(mockDiscussion);

      await service.createDiscussion(discussionData);

      expect(schema.createDiscussion).toHaveBeenCalledWith(
        expect.objectContaining({
          ...discussionData,
          id: expect.any(String),
        }),
      );
    });

    it('should create an initial comment if provided', async () => {
      const discussionData = {
        createdBy: 'user1',
        associatedNodeId: 'node1',
        associatedNodeType: 'BeliefNode',
        initialComment: 'Initial comment',
      };

      const mockDiscussion = {
        id: 'discussion1',
        ...discussionData,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      const mockComment = {
        id: 'comment1',
        createdBy: 'user1',
        discussionId: 'discussion1',
        commentText: 'Initial comment',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      schema.createDiscussion.mockResolvedValue(mockDiscussion);
      commentService.createComment.mockResolvedValue(mockComment);

      await service.createDiscussion(discussionData);

      expect(schema.createDiscussion).toHaveBeenCalledWith(
        expect.objectContaining({
          ...discussionData,
          id: expect.any(String),
        }),
      );
      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: discussionData.createdBy,
        discussionId: mockDiscussion.id,
        commentText: discussionData.initialComment,
        parentCommentId: undefined,
      });
    });
  });

  // ✅ UPDATED: Use inherited findById() method
  describe('getDiscussion', () => {
    it('should call schema.findById with correct parameters', async () => {
      const discussionId = 'discussion1';
      const mockDiscussion = {
        id: discussionId,
        createdBy: 'user1',
        associatedNodeId: 'node1',
        associatedNodeType: 'BeliefNode',
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      schema.findById.mockResolvedValue(mockDiscussion);

      const result = await service.getDiscussion(discussionId);

      expect(schema.findById).toHaveBeenCalledWith(discussionId);
      expect(result).toEqual(mockDiscussion);
    });

    it('should return null when discussion not found', async () => {
      schema.findById.mockResolvedValue(null);

      const result = await service.getDiscussion('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ✅ UPDATED: Use inherited update() method
  describe('updateDiscussion', () => {
    it('should call schema.update with correct parameters', async () => {
      const id = 'discussion1';
      const updateData = { associatedNodeType: 'UpdatedType' };
      const updatedDiscussion = {
        id,
        createdBy: 'user1',
        associatedNodeId: 'node1',
        associatedNodeType: 'UpdatedType',
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      schema.update.mockResolvedValue(updatedDiscussion);

      const result = await service.updateDiscussion(id, updateData);

      expect(schema.update).toHaveBeenCalledWith(id, updateData);
      expect(result).toEqual(updatedDiscussion);
    });
  });

  // ✅ UPDATED: Use inherited delete() method
  describe('deleteDiscussion', () => {
    it('should call schema.delete with correct parameters', async () => {
      const id = 'discussion1';
      const deleteResult = { success: true };

      schema.delete.mockResolvedValue(deleteResult);

      const result = await service.deleteDiscussion(id);

      expect(schema.delete).toHaveBeenCalledWith(id);
      expect(result).toEqual(deleteResult);
    });
  });

  // ✅ PRESERVED: Container-specific methods
  describe('getDiscussionsByAssociatedNode', () => {
    it('should call schema.getDiscussionsByAssociatedNode with correct parameters', async () => {
      const nodeId = 'node1';
      const nodeType = 'BeliefNode';
      const mockDiscussions = [
        {
          id: 'discussion1',
          createdBy: 'user1',
          associatedNodeId: nodeId,
          associatedNodeType: nodeType,
          createdAt: new Date(),
          updatedAt: new Date(),
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        },
      ];

      schema.getDiscussionsByAssociatedNode.mockResolvedValue(mockDiscussions);

      const result = await service.getDiscussionsByAssociatedNode(
        nodeId,
        nodeType,
      );

      expect(schema.getDiscussionsByAssociatedNode).toHaveBeenCalledWith(
        nodeId,
        nodeType,
      );
      expect(result).toEqual(mockDiscussions);
    });
  });

  describe('getDiscussionWithComments', () => {
    it('should get discussion with comments using inherited findById', async () => {
      const discussionId = 'discussion1';
      const mockDiscussion = {
        id: discussionId,
        createdBy: 'user1',
        associatedNodeId: 'node1',
        associatedNodeType: 'BeliefNode',
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      const mockComments = [
        {
          id: 'comment1',
          createdBy: 'user1',
          discussionId,
          commentText: 'Test comment',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      schema.findById.mockResolvedValue(mockDiscussion);
      commentService.getCommentsByDiscussionId.mockResolvedValue(mockComments);

      const result = await service.getDiscussionWithComments(discussionId);

      expect(schema.findById).toHaveBeenCalledWith(discussionId);
      expect(commentService.getCommentsByDiscussionId).toHaveBeenCalledWith(
        discussionId,
      );
      expect(result).toEqual({
        ...mockDiscussion,
        comments: mockComments,
      });
    });
  });

  describe('getDiscussionCommentCount', () => {
    it('should call schema.getDiscussionCommentCount with correct parameters', async () => {
      const discussionId = 'discussion1';
      const commentCount = 5;

      schema.getDiscussionCommentCount.mockResolvedValue(commentCount);

      const result = await service.getDiscussionCommentCount(discussionId);

      expect(schema.getDiscussionCommentCount).toHaveBeenCalledWith(
        discussionId,
      );
      expect(result).toBe(commentCount);
    });
  });

  // ❌ REMOVED: Visibility methods are no longer part of DiscussionService
  // These methods don't exist anymore since discussions don't use user visibility preferences
});
