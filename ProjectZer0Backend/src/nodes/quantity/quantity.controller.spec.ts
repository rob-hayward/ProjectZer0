// src/nodes/quantity/__tests__/quantity.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { QuantityController } from './quantity.controller';
import { QuantityService } from './quantity.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('QuantityController', () => {
  let controller: QuantityController;
  let service: jest.Mocked<QuantityService>;
  let discussionService: jest.Mocked<DiscussionService>;
  let commentService: jest.Mocked<CommentService>;

  beforeEach(async () => {
    const mockQuantityService = {
      createQuantityNode: jest.fn(),
      getQuantityNode: jest.fn(),
      updateQuantityNode: jest.fn(),
      deleteQuantityNode: jest.fn(),
      submitResponse: jest.fn(),
      getUserResponse: jest.fn(),
      deleteUserResponse: jest.fn(),
      getStatistics: jest.fn(),
      setVisibilityStatus: jest.fn(),
      getVisibilityStatus: jest.fn(),
    };

    const mockDiscussionService = {
      createDiscussion: jest.fn(),
      getDiscussion: jest.fn(),
    };

    const mockCommentService = {
      createComment: jest.fn(),
      getCommentsByDiscussionId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuantityController],
      providers: [
        {
          provide: QuantityService,
          useValue: mockQuantityService,
        },
        {
          provide: DiscussionService,
          useValue: mockDiscussionService,
        },
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
      ],
    }).compile();

    controller = module.get<QuantityController>(QuantityController);
    service = module.get(QuantityService);
    discussionService = module.get(DiscussionService);
    commentService = module.get(CommentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createQuantityNode', () => {
    const nodeData = {
      question: 'What is the optimal temperature for brewing coffee?',
      unitCategoryId: 'temperature',
      defaultUnitId: 'celsius',
      publicCredit: true,
      userKeywords: ['coffee', 'brewing'],
      initialComment: 'I think it depends on the type of coffee',
    };

    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should create a quantity node with valid data', async () => {
      const expectedResult = {
        id: 'new-id',
        ...nodeData,
        createdBy: 'user1',
      };
      service.createQuantityNode.mockResolvedValue(expectedResult);

      const result = await controller.createQuantityNode(nodeData, mockRequest);

      expect(service.createQuantityNode).toHaveBeenCalledWith({
        ...nodeData,
        createdBy: 'user1',
      });
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException for missing question', async () => {
      const invalidData = {
        ...nodeData,
        question: '',
      };

      await expect(
        controller.createQuantityNode(invalidData, mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(service.createQuantityNode).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing unit category', async () => {
      const invalidData = {
        ...nodeData,
        unitCategoryId: '',
      };

      await expect(
        controller.createQuantityNode(invalidData, mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(service.createQuantityNode).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing default unit', async () => {
      const invalidData = {
        ...nodeData,
        defaultUnitId: '',
      };

      await expect(
        controller.createQuantityNode(invalidData, mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(service.createQuantityNode).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid publicCredit', async () => {
      const invalidData = {
        ...nodeData,
        publicCredit: 'not-a-boolean', // This will cause an error
      };

      await expect(
        controller.createQuantityNode(invalidData, mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(service.createQuantityNode).not.toHaveBeenCalled();
    });
  });

  describe('getQuantityNode', () => {
    it('should get a quantity node by id', async () => {
      const mockNode = {
        id: 'test-id',
        question: 'What is the optimal temperature for brewing coffee?',
      };
      service.getQuantityNode.mockResolvedValue(mockNode);

      const result = await controller.getQuantityNode('test-id');

      expect(service.getQuantityNode).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockNode);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(controller.getQuantityNode('')).rejects.toThrow(
        BadRequestException,
      );
      expect(service.getQuantityNode).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException from service', async () => {
      service.getQuantityNode.mockRejectedValue(
        new NotFoundException('Quantity node not found'),
      );

      await expect(
        controller.getQuantityNode('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateQuantityNode', () => {
    const updateData = {
      question: 'Updated question for coffee temperature?',
      unitCategoryId: 'temperature',
      defaultUnitId: 'celsius',
    };

    it('should update a quantity node with valid data', async () => {
      const expectedResult = {
        id: 'test-id',
        ...updateData,
      };
      service.updateQuantityNode.mockResolvedValue(expectedResult);

      const result = await controller.updateQuantityNode('test-id', updateData);

      expect(service.updateQuantityNode).toHaveBeenCalledWith(
        'test-id',
        updateData,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(
        controller.updateQuantityNode('', updateData),
      ).rejects.toThrow(BadRequestException);
      expect(service.updateQuantityNode).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty update data', async () => {
      await expect(
        controller.updateQuantityNode('test-id', {}),
      ).rejects.toThrow(BadRequestException);
      expect(service.updateQuantityNode).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException from service', async () => {
      service.updateQuantityNode.mockRejectedValue(
        new NotFoundException('Quantity node not found'),
      );

      await expect(
        controller.updateQuantityNode('nonexistent-id', updateData),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteQuantityNode', () => {
    it('should delete a quantity node', async () => {
      const mockResult = {
        success: true,
        message: 'Quantity node deleted successfully',
      };
      service.deleteQuantityNode.mockResolvedValue(mockResult);

      const result = await controller.deleteQuantityNode('test-id');

      expect(service.deleteQuantityNode).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(controller.deleteQuantityNode('')).rejects.toThrow(
        BadRequestException,
      );
      expect(service.deleteQuantityNode).not.toHaveBeenCalled();
    });
  });

  describe('setVisibilityStatus', () => {
    it('should set visibility status with valid data', async () => {
      const mockResult = {
        id: 'test-id',
        visibilityStatus: false,
      };
      service.setVisibilityStatus.mockResolvedValue(mockResult);

      const result = await controller.setVisibilityStatus('test-id', {
        isVisible: false,
      });

      expect(service.setVisibilityStatus).toHaveBeenCalledWith(
        'test-id',
        false,
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(
        controller.setVisibilityStatus('', { isVisible: false }),
      ).rejects.toThrow(BadRequestException);
      expect(service.setVisibilityStatus).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for non-boolean isVisible', async () => {
      await expect(
        controller.setVisibilityStatus('test-id', {
          // @ts-expect-error Testing with invalid type
          isVisible: 'not-a-boolean',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(service.setVisibilityStatus).not.toHaveBeenCalled();
    });
  });

  describe('getVisibilityStatus', () => {
    it('should get visibility status', async () => {
      service.getVisibilityStatus.mockResolvedValue({ isVisible: true });

      const result = await controller.getVisibilityStatus('test-id');

      expect(service.getVisibilityStatus).toHaveBeenCalledWith('test-id');
      expect(result).toEqual({ isVisible: true });
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(controller.getVisibilityStatus('')).rejects.toThrow(
        BadRequestException,
      );
      expect(service.getVisibilityStatus).not.toHaveBeenCalled();
    });
  });

  describe('submitResponse', () => {
    const responseData = {
      value: 95,
      unitId: 'celsius',
    };

    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should submit a response with valid data', async () => {
      const expectedResult = {
        id: 'response-id',
        userId: 'user1',
        quantityNodeId: 'test-id',
        value: 95,
        unitId: 'celsius',
        normalizedValue: 100,
        categoryId: 'temperature',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.submitResponse.mockResolvedValue(expectedResult);

      const result = await controller.submitResponse(
        'test-id',
        responseData,
        mockRequest,
      );

      expect(service.submitResponse).toHaveBeenCalledWith({
        userId: 'user1',
        quantityNodeId: 'test-id',
        value: 95,
        unitId: 'celsius',
      });
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(
        controller.submitResponse('', responseData, mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(service.submitResponse).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid value', async () => {
      await expect(
        controller.submitResponse(
          'test-id',
          { ...responseData, value: NaN },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(service.submitResponse).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing unit', async () => {
      await expect(
        controller.submitResponse(
          'test-id',
          { ...responseData, unitId: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(service.submitResponse).not.toHaveBeenCalled();
    });
  });

  describe('getUserResponse', () => {
    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should get user response', async () => {
      const mockResponse = {
        id: 'response-id',
        userId: 'user1',
        quantityNodeId: 'test-id',
        value: 95,
        unitId: 'celsius',
        categoryId: 'temperature',
        createdAt: new Date(),
        updatedAt: new Date(),
        normalizedValue: 100,
      };
      service.getUserResponse.mockResolvedValue(mockResponse);

      const result = await controller.getUserResponse('test-id', mockRequest);

      expect(service.getUserResponse).toHaveBeenCalledWith('user1', 'test-id');
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(controller.getUserResponse('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
      expect(service.getUserResponse).not.toHaveBeenCalled();
    });
  });

  describe('deleteUserResponse', () => {
    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should delete user response', async () => {
      const mockResult = {
        success: true,
        message: 'Response successfully deleted',
      };
      service.deleteUserResponse.mockResolvedValue(mockResult);

      const result = await controller.deleteUserResponse(
        'test-id',
        mockRequest,
      );

      expect(service.deleteUserResponse).toHaveBeenCalledWith(
        'user1',
        'test-id',
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(
        controller.deleteUserResponse('', mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(service.deleteUserResponse).not.toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should get statistics for a quantity node', async () => {
      const mockStats = {
        responseCount: 3,
        min: 10,
        max: 30,
        mean: 20,
        median: 20,
        standardDeviation: 8.16,
        percentiles: { 50: 20 },
        distributionCurve: [
          [10, 0.1],
          [20, 0.2],
        ],
      };
      service.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics('test-id');

      expect(service.getStatistics).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockStats);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(controller.getStatistics('')).rejects.toThrow(
        BadRequestException,
      );
      expect(service.getStatistics).not.toHaveBeenCalled();
    });
  });

  // New tests for discussion functionality
  describe('getQuantityNodeWithDiscussion', () => {
    it('should get a quantity node with its discussion', async () => {
      const mockNode = {
        id: 'test-id',
        question: 'Test question?',
        discussionId: 'discussion-id',
      };
      service.getQuantityNode.mockResolvedValue(mockNode);

      const result = await controller.getQuantityNodeWithDiscussion('test-id');

      expect(service.getQuantityNode).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockNode);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(
        controller.getQuantityNodeWithDiscussion(''),
      ).rejects.toThrow(BadRequestException);
      expect(service.getQuantityNode).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when node not found', async () => {
      service.getQuantityNode.mockResolvedValue(null);

      await expect(
        controller.getQuantityNodeWithDiscussion('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getQuantityNodeComments', () => {
    it('should get comments for a quantity node with discussion', async () => {
      const mockNode = {
        id: 'test-id',
        discussionId: 'discussion-id',
      };
      service.getQuantityNode.mockResolvedValue(mockNode);

      const mockComments = [
        { id: 'comment-1', commentText: 'First comment' },
        { id: 'comment-2', commentText: 'Second comment' },
      ];
      commentService.getCommentsByDiscussionId.mockResolvedValue(mockComments);

      const result = await controller.getQuantityNodeComments('test-id');

      expect(service.getQuantityNode).toHaveBeenCalledWith('test-id');
      expect(commentService.getCommentsByDiscussionId).toHaveBeenCalledWith(
        'discussion-id',
      );
      expect(result).toEqual({ comments: mockComments });
    });

    it('should return empty comments array when node has no discussion', async () => {
      const mockNode = {
        id: 'test-id',
        // No discussionId
      };
      service.getQuantityNode.mockResolvedValue(mockNode);

      const result = await controller.getQuantityNodeComments('test-id');

      expect(service.getQuantityNode).toHaveBeenCalledWith('test-id');
      expect(commentService.getCommentsByDiscussionId).not.toHaveBeenCalled();
      expect(result).toEqual({ comments: [] });
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(controller.getQuantityNodeComments('')).rejects.toThrow(
        BadRequestException,
      );
      expect(service.getQuantityNode).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when node not found', async () => {
      service.getQuantityNode.mockResolvedValue(null);

      await expect(
        controller.getQuantityNodeComments('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addQuantityNodeComment', () => {
    const commentData = {
      commentText: 'This is a test comment',
      parentCommentId: 'parent-comment-id',
    };

    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should create a comment for a quantity node with existing discussion', async () => {
      const mockNode = {
        id: 'test-id',
        discussionId: 'discussion-id',
      };
      service.getQuantityNode.mockResolvedValue(mockNode);

      const mockComment = {
        id: 'comment-id',
        commentText: 'This is a test comment',
        createdBy: 'user1',
        discussionId: 'discussion-id',
        parentCommentId: 'parent-comment-id',
      };
      commentService.createComment.mockResolvedValue(mockComment);

      const result = await controller.addQuantityNodeComment(
        'test-id',
        commentData,
        mockRequest,
      );

      expect(service.getQuantityNode).toHaveBeenCalledWith('test-id');
      expect(discussionService.createDiscussion).not.toHaveBeenCalled();
      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: 'user1',
        discussionId: 'discussion-id',
        commentText: 'This is a test comment',
        parentCommentId: 'parent-comment-id',
      });
      expect(result).toEqual(mockComment);
    });

    it('should create a discussion and comment for a node without discussion', async () => {
      const mockNode = {
        id: 'test-id',
        // No discussionId
      };
      service.getQuantityNode.mockResolvedValue(mockNode);

      const mockDiscussion = {
        id: 'new-discussion-id',
        createdBy: 'user1',
      };
      discussionService.createDiscussion.mockResolvedValue(mockDiscussion);

      const mockComment = {
        id: 'comment-id',
        commentText: 'This is a test comment',
        createdBy: 'user1',
        discussionId: 'new-discussion-id',
        parentCommentId: 'parent-comment-id',
      };
      commentService.createComment.mockResolvedValue(mockComment);

      const result = await controller.addQuantityNodeComment(
        'test-id',
        commentData,
        mockRequest,
      );

      expect(service.getQuantityNode).toHaveBeenCalledWith('test-id');
      expect(discussionService.createDiscussion).toHaveBeenCalledWith({
        createdBy: 'user1',
        associatedNodeId: 'test-id',
        associatedNodeType: 'QuantityNode',
      });
      expect(service.updateQuantityNode).toHaveBeenCalledWith('test-id', {
        discussionId: 'new-discussion-id',
      });
      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: 'user1',
        discussionId: 'new-discussion-id',
        commentText: 'This is a test comment',
        parentCommentId: 'parent-comment-id',
      });
      expect(result).toEqual(mockComment);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(
        controller.addQuantityNodeComment('', commentData, mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(service.getQuantityNode).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty comment text', async () => {
      await expect(
        controller.addQuantityNodeComment(
          'test-id',
          { ...commentData, commentText: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(service.getQuantityNode).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when node not found', async () => {
      service.getQuantityNode.mockResolvedValue(null);

      await expect(
        controller.addQuantityNodeComment(
          'nonexistent-id',
          commentData,
          mockRequest,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
