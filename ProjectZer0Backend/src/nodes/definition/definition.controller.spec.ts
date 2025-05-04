// src/nodes/definition/definition.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DefinitionController } from './definition.controller';
import { DefinitionService } from './definition.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import {
  BadRequestException,
  NotFoundException,
  HttpException,
  Logger,
} from '@nestjs/common';

// Define proper types for mocks
type MockedDefinitionService = {
  [K in keyof DefinitionService]: jest.Mock;
};

type MockedDiscussionService = {
  [K in keyof DiscussionService]: jest.Mock;
};

type MockedCommentService = {
  [K in keyof CommentService]: jest.Mock;
};

describe('DefinitionController', () => {
  let controller: DefinitionController;
  let definitionService: MockedDefinitionService;
  let discussionService: MockedDiscussionService;
  let commentService: MockedCommentService;

  beforeEach(async () => {
    // Create properly typed mock services
    const mockDefinitionService = {
      createDefinition: jest.fn(),
      getDefinition: jest.fn(),
      getDefinitionWithDiscussion: jest.fn(),
      updateDefinition: jest.fn(),
      deleteDefinition: jest.fn(),
      setVisibilityStatus: jest.fn(),
      getVisibilityStatus: jest.fn(),
      voteDefinition: jest.fn(),
      getDefinitionVoteStatus: jest.fn(),
      removeDefinitionVote: jest.fn(),
      getDefinitionVotes: jest.fn(),
    };

    const mockDiscussionService = {
      createDiscussion: jest.fn(),
      getDiscussion: jest.fn(),
      updateDiscussion: jest.fn(),
      deleteDiscussion: jest.fn(),
      setVisibilityStatus: jest.fn(),
      getVisibilityStatus: jest.fn(),
    };

    const mockCommentService = {
      createComment: jest.fn(),
      getComment: jest.fn(),
      updateComment: jest.fn(),
      deleteComment: jest.fn(),
      getCommentsByDiscussionId: jest.fn(),
      getCommentsByDiscussionIdWithVisibility: jest.fn(),
      setVisibilityStatus: jest.fn(),
      getVisibilityStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DefinitionController],
      providers: [
        {
          provide: DefinitionService,
          useValue: mockDefinitionService,
        },
        {
          provide: DiscussionService,
          useValue: mockDiscussionService,
        },
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DefinitionController>(DefinitionController);
    definitionService = module.get(
      DefinitionService,
    ) as MockedDefinitionService;
    discussionService = module.get(
      DiscussionService,
    ) as MockedDiscussionService;
    commentService = module.get(CommentService) as MockedCommentService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createDefinition', () => {
    const validDefinitionData = {
      word: 'test',
      createdBy: 'user1',
      definitionText: 'A test definition',
      discussion: 'Initial discussion comment',
    };

    it('should create a definition with valid data', async () => {
      const expectedResult = {
        id: 'test-id',
        ...validDefinitionData,
      };

      definitionService.createDefinition.mockResolvedValue(expectedResult);

      const result = await controller.createDefinition(validDefinitionData);

      expect(definitionService.createDefinition).toHaveBeenCalledWith(
        validDefinitionData,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException for empty word', async () => {
      await expect(
        controller.createDefinition({
          ...validDefinitionData,
          word: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.createDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty creator ID', async () => {
      await expect(
        controller.createDefinition({
          ...validDefinitionData,
          createdBy: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.createDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty definition text', async () => {
      await expect(
        controller.createDefinition({
          ...validDefinitionData,
          definitionText: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.createDefinition).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      definitionService.createDefinition.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(
        controller.createDefinition(validDefinitionData),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getDefinition', () => {
    it('should return a definition when found', async () => {
      const mockDefinition = {
        id: 'test-id',
        definitionText: 'Test definition',
      };
      definitionService.getDefinition.mockResolvedValue(mockDefinition);

      const result = await controller.getDefinition('test-id');

      expect(definitionService.getDefinition).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockDefinition);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      expect(definitionService.getDefinition).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException', async () => {
      definitionService.getDefinition.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(controller.getDefinition('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // Add tests for new discussion endpoints
  describe('getDefinitionWithDiscussion', () => {
    it('should return a definition with its discussion', async () => {
      const mockDefinitionWithDiscussion = {
        id: 'test-id',
        definitionText: 'Test definition',
        discussionId: 'disc-id',
        discussion: {
          id: 'disc-id',
          createdBy: 'user1',
          createdAt: new Date().toISOString(),
        },
      };
      definitionService.getDefinitionWithDiscussion.mockResolvedValue(
        mockDefinitionWithDiscussion,
      );

      const result = await controller.getDefinitionWithDiscussion('test-id');

      expect(
        definitionService.getDefinitionWithDiscussion,
      ).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockDefinitionWithDiscussion);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getDefinitionWithDiscussion('')).rejects.toThrow(
        BadRequestException,
      );
      expect(
        definitionService.getDefinitionWithDiscussion,
      ).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException', async () => {
      definitionService.getDefinitionWithDiscussion.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(
        controller.getDefinitionWithDiscussion('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDefinitionComments', () => {
    it('should return comments for a definition', async () => {
      const mockDefinition = {
        id: 'test-id',
        definitionText: 'Test definition',
        discussionId: 'disc-id',
      };

      const mockComments = [
        { id: 'comment1', commentText: 'Comment 1', createdBy: 'user1' },
        { id: 'comment2', commentText: 'Comment 2', createdBy: 'user2' },
      ];

      definitionService.getDefinition.mockResolvedValue(mockDefinition);
      commentService.getCommentsByDiscussionId.mockResolvedValue(mockComments);

      const result = await controller.getDefinitionComments('test-id');

      expect(definitionService.getDefinition).toHaveBeenCalledWith('test-id');
      expect(commentService.getCommentsByDiscussionId).toHaveBeenCalledWith(
        'disc-id',
      );
      expect(result).toEqual({ comments: mockComments });
    });

    it('should return empty comments array if definition has no discussion', async () => {
      const mockDefinition = {
        id: 'test-id',
        definitionText: 'Test definition',
        // No discussionId
      };

      definitionService.getDefinition.mockResolvedValue(mockDefinition);

      const result = await controller.getDefinitionComments('test-id');

      expect(definitionService.getDefinition).toHaveBeenCalledWith('test-id');
      expect(commentService.getCommentsByDiscussionId).not.toHaveBeenCalled();
      expect(result).toEqual({ comments: [] });
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getDefinitionComments('')).rejects.toThrow(
        BadRequestException,
      );
      expect(definitionService.getDefinition).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException', async () => {
      definitionService.getDefinition.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(
        controller.getDefinitionComments('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addDefinitionComment', () => {
    const mockRequest = {
      user: { sub: 'user1' },
    };

    const validCommentData = {
      commentText: 'Test comment',
    };

    it('should add a comment to an existing discussion', async () => {
      const mockDefinition = {
        id: 'test-id',
        definitionText: 'Test definition',
        discussionId: 'disc-id',
      };

      const mockCreatedComment = {
        id: 'comment1',
        createdBy: 'user1',
        discussionId: 'disc-id',
        commentText: 'Test comment',
        createdAt: new Date().toISOString(),
      };

      definitionService.getDefinition.mockResolvedValue(mockDefinition);
      commentService.createComment.mockResolvedValue(mockCreatedComment);

      const result = await controller.addDefinitionComment(
        'test-id',
        validCommentData,
        mockRequest,
      );

      expect(definitionService.getDefinition).toHaveBeenCalledWith('test-id');
      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: 'user1',
        discussionId: 'disc-id',
        commentText: 'Test comment',
        parentCommentId: undefined,
      });
      expect(result).toEqual(mockCreatedComment);
    });

    it('should create a discussion and add a comment if definition has no discussion', async () => {
      const mockDefinition = {
        id: 'test-id',
        definitionText: 'Test definition',
        // No discussionId
      };

      const mockCreatedDiscussion = {
        id: 'new-disc-id',
        createdBy: 'user1',
        associatedNodeId: 'test-id',
        associatedNodeType: 'DefinitionNode',
      };

      const mockCreatedComment = {
        id: 'comment1',
        createdBy: 'user1',
        discussionId: 'new-disc-id',
        commentText: 'Test comment',
        createdAt: new Date().toISOString(),
      };

      definitionService.getDefinition.mockResolvedValue(mockDefinition);
      discussionService.createDiscussion.mockResolvedValue(
        mockCreatedDiscussion,
      );
      definitionService.updateDefinition.mockResolvedValue({
        ...mockDefinition,
        discussionId: 'new-disc-id',
      });
      commentService.createComment.mockResolvedValue(mockCreatedComment);

      const result = await controller.addDefinitionComment(
        'test-id',
        validCommentData,
        mockRequest,
      );

      expect(definitionService.getDefinition).toHaveBeenCalledWith('test-id');
      expect(discussionService.createDiscussion).toHaveBeenCalledWith({
        createdBy: 'user1',
        associatedNodeId: 'test-id',
        associatedNodeType: 'DefinitionNode',
      });
      expect(definitionService.updateDefinition).toHaveBeenCalledWith(
        'test-id',
        {
          definitionText: 'Test definition',
          discussionId: 'new-disc-id',
        },
      );
      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: 'user1',
        discussionId: 'new-disc-id',
        commentText: 'Test comment',
        parentCommentId: undefined,
      });
      expect(result).toEqual(mockCreatedComment);
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(
        controller.addDefinitionComment('', validCommentData, mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.getDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty comment text', async () => {
      await expect(
        controller.addDefinitionComment(
          'test-id',
          { commentText: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.getDefinition).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException', async () => {
      definitionService.getDefinition.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(
        controller.addDefinitionComment(
          'nonexistent-id',
          validCommentData,
          mockRequest,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // Continue with other tests...
  describe('updateDefinition', () => {
    const validUpdateData = { definitionText: 'Updated definition' };

    it('should update a definition with valid data', async () => {
      const expectedResult = {
        id: 'test-id',
        definitionText: 'Updated definition',
      };

      definitionService.updateDefinition.mockResolvedValue(expectedResult);

      const result = await controller.updateDefinition(
        'test-id',
        validUpdateData,
      );

      expect(definitionService.updateDefinition).toHaveBeenCalledWith(
        'test-id',
        validUpdateData,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.updateDefinition('', validUpdateData),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.updateDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty definition text', async () => {
      await expect(
        controller.updateDefinition('test-id', { definitionText: '' }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.updateDefinition).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException', async () => {
      definitionService.updateDefinition.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(
        controller.updateDefinition('test-id', validUpdateData),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDefinition', () => {
    it('should delete a definition successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Definition deleted successfully',
      };
      definitionService.deleteDefinition.mockResolvedValue(mockResult);

      const result = await controller.deleteDefinition('test-id');

      expect(definitionService.deleteDefinition).toHaveBeenCalledWith(
        'test-id',
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.deleteDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      expect(definitionService.deleteDefinition).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException', async () => {
      definitionService.deleteDefinition.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(controller.deleteDefinition('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('voteDefinition', () => {
    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should process vote successfully', async () => {
      const mockVoteResult = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };

      definitionService.voteDefinition.mockResolvedValue(mockVoteResult);

      const result = await controller.voteDefinition(
        'test-id',
        { isPositive: true },
        mockRequest,
      );

      expect(definitionService.voteDefinition).toHaveBeenCalledWith(
        'test-id',
        'user1',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(
        controller.voteDefinition('', { isPositive: true }, mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.voteDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing user authentication', async () => {
      await expect(
        controller.voteDefinition(
          'test-id',
          { isPositive: true },
          { user: {} },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.voteDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for undefined vote value', async () => {
      await expect(
        controller.voteDefinition(
          'test-id',
          { isPositive: undefined },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.voteDefinition).not.toHaveBeenCalled();
    });
  });

  describe('getDefinitionVoteStatus', () => {
    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should return vote status when found', async () => {
      const mockStatus = {
        status: 'agree' as 'agree' | 'disagree',
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };
      definitionService.getDefinitionVoteStatus.mockResolvedValue(mockStatus);

      const result = await controller.getDefinitionVoteStatus(
        'test-id',
        mockRequest,
      );

      expect(definitionService.getDefinitionVoteStatus).toHaveBeenCalledWith(
        'test-id',
        'user1',
      );
      expect(result).toEqual(mockStatus);
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(
        controller.getDefinitionVoteStatus('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing user authentication', async () => {
      await expect(
        controller.getDefinitionVoteStatus('test-id', { user: {} }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeDefinitionVote', () => {
    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should remove vote successfully', async () => {
      const mockResult = {
        positiveVotes: 4,
        negativeVotes: 2,
        netVotes: 2,
      };
      definitionService.removeDefinitionVote.mockResolvedValue(mockResult);

      const result = await controller.removeDefinitionVote(
        'test-id',
        mockRequest,
      );

      expect(definitionService.removeDefinitionVote).toHaveBeenCalledWith(
        'test-id',
        'user1',
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(
        controller.removeDefinitionVote('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing user authentication', async () => {
      await expect(
        controller.removeDefinitionVote('test-id', { user: {} }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDefinitionVotes', () => {
    it('should return votes when found', async () => {
      const mockVotes = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };
      definitionService.getDefinitionVotes.mockResolvedValue(mockVotes);

      const result = await controller.getDefinitionVotes('test-id');

      expect(definitionService.getDefinitionVotes).toHaveBeenCalledWith(
        'test-id',
      );
      expect(result).toEqual(mockVotes);
    });

    it('should return null when no votes exist', async () => {
      definitionService.getDefinitionVotes.mockResolvedValue(null);

      const result = await controller.getDefinitionVotes('test-id');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(controller.getDefinitionVotes('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setVisibilityStatus', () => {
    it('should set visibility status successfully', async () => {
      const mockResult = { id: 'test-id', visibilityStatus: true };
      definitionService.setVisibilityStatus.mockResolvedValue(mockResult);

      const result = await controller.setVisibilityStatus('test-id', {
        isVisible: true,
      });

      expect(definitionService.setVisibilityStatus).toHaveBeenCalledWith(
        'test-id',
        true,
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(
        controller.setVisibilityStatus('', { isVisible: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for undefined visibility status', async () => {
      await expect(
        controller.setVisibilityStatus('test-id', { isVisible: undefined }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getVisibilityStatus', () => {
    it('should return visibility status successfully', async () => {
      definitionService.getVisibilityStatus.mockResolvedValue(true);

      const result = await controller.getVisibilityStatus('test-id');

      expect(definitionService.getVisibilityStatus).toHaveBeenCalledWith(
        'test-id',
      );
      expect(result).toEqual({ visibilityStatus: true });
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(controller.getVisibilityStatus('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
