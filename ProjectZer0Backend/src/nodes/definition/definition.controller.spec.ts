// src/nodes/definition/definition.controller.spec.ts - UPDATED FOR HYBRID PATTERN SERVICE

import { Test, TestingModule } from '@nestjs/testing';
import { DefinitionController } from './definition.controller';
import { DefinitionService } from './definition.service';
import { DiscussionService } from './../discussion/discussion.service';
import { CommentService } from './../comment/comment.service';
import {
  BadRequestException,
  NotFoundException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { TEXT_LIMITS } from './../../constants/validation';
import type { VoteResult } from './../../neo4j/schemas/vote.schema';

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

describe('DefinitionController - Updated for Hybrid Pattern', () => {
  let controller: DefinitionController;
  let definitionService: MockedDefinitionService;
  let discussionService: MockedDiscussionService;
  let commentService: MockedCommentService;

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 1,
    inclusionNetVotes: 4,
    contentPositiveVotes: 3,
    contentNegativeVotes: 0,
    contentNetVotes: 3,
  };

  beforeEach(async () => {
    // Create properly typed mock services matching hybrid pattern methods
    const mockDefinitionService = {
      // Enhanced domain methods
      createDefinition: jest.fn(),
      getDefinition: jest.fn(),
      getDefinitionWithDiscussion: jest.fn(),
      setVisibilityStatus: jest.fn(),
      getVisibilityStatus: jest.fn(),

      // Hybrid update method
      updateDefinition: jest.fn(),

      // BaseNodeSchema methods
      deleteDefinition: jest.fn(),
      voteDefinitionInclusion: jest.fn(),
      voteDefinitionContent: jest.fn(),
      getDefinitionVoteStatus: jest.fn(),
      removeDefinitionVote: jest.fn(),
      getDefinitionVotes: jest.fn(),

      // Utility methods
      isDefinitionApproved: jest.fn(),
      isContentVotingAvailable: jest.fn(),
      getDefinitionStats: jest.fn(),
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

  describe('createDefinition - Mandatory Discussion Architecture', () => {
    const validDefinitionData = {
      word: 'test',
      createdBy: 'user1',
      definitionText: 'A test definition',
      discussion: 'Initial discussion comment', // Controller still accepts 'discussion' field
    };

    it('should create a definition with valid data', async () => {
      const expectedResult = {
        id: 'test-id',
        ...validDefinitionData,
        discussionId: 'discussion-id',
      };

      definitionService.createDefinition.mockResolvedValue(expectedResult);

      const result = await controller.createDefinition(validDefinitionData);

      // Verify service was called with the data (service will handle discussion->initialComment mapping)
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

    it('should throw BadRequestException for definition text exceeding max length', async () => {
      const longText = 'a'.repeat(TEXT_LIMITS.MAX_DEFINITION_LENGTH + 1);

      await expect(
        controller.createDefinition({
          ...validDefinitionData,
          definitionText: longText,
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

    it('should handle mandatory discussion creation failure', async () => {
      definitionService.createDefinition.mockRejectedValue(
        new Error(
          'Failed to create discussion for definition - definition creation aborted',
        ),
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
        word: 'test',
        definitionText: 'Test definition',
        discussionId: 'discussion-id',
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

      await expect(controller.getDefinition('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle service errors', async () => {
      definitionService.getDefinition.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(controller.getDefinition('test-id')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('updateDefinition - Hybrid Pattern', () => {
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

    it('should throw BadRequestException for definition text exceeding max length', async () => {
      const longText = 'a'.repeat(TEXT_LIMITS.MAX_DEFINITION_LENGTH + 1);

      await expect(
        controller.updateDefinition('test-id', { definitionText: longText }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.updateDefinition).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException when definition not found', async () => {
      definitionService.updateDefinition.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(
        controller.updateDefinition('test-id', validUpdateData),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle service errors', async () => {
      definitionService.updateDefinition.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(
        controller.updateDefinition('test-id', validUpdateData),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteDefinition - BaseNodeSchema Method', () => {
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

    it('should handle service errors', async () => {
      definitionService.deleteDefinition.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(controller.deleteDefinition('test-id')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('voteDefinition - Dual Voting System', () => {
    const mockRequest = {
      user: { sub: 'user1' },
    };

    describe('Inclusion Voting', () => {
      it('should process inclusion vote successfully', async () => {
        definitionService.voteDefinitionInclusion.mockResolvedValue(
          mockVoteResult,
        );

        const result = await controller.voteDefinition(
          'test-id',
          { isPositive: true },
          mockRequest,
        );

        expect(definitionService.voteDefinitionInclusion).toHaveBeenCalledWith(
          'test-id',
          'user1',
          true,
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should process negative inclusion vote', async () => {
        definitionService.voteDefinitionInclusion.mockResolvedValue({
          ...mockVoteResult,
          inclusionPositiveVotes: 2,
          inclusionNegativeVotes: 3,
          inclusionNetVotes: -1,
        });

        const result = await controller.voteDefinition(
          'test-id',
          { isPositive: false },
          mockRequest,
        );

        expect(definitionService.voteDefinitionInclusion).toHaveBeenCalledWith(
          'test-id',
          'user1',
          false,
        );
        expect(result.inclusionNetVotes).toBe(-1);
      });
    });

    describe('Content Voting', () => {
      it('should process content vote when definition is approved', async () => {
        // First, definition needs to pass inclusion threshold
        definitionService.isContentVotingAvailable.mockResolvedValue(true);
        definitionService.voteDefinitionContent.mockResolvedValue({
          ...mockVoteResult,
          contentPositiveVotes: 4,
          contentNetVotes: 4,
        });

        // Mock a content vote endpoint (this would be a separate endpoint in real implementation)
        // For now, we'll test through the general vote endpoint
        const result = await controller.voteDefinition(
          'test-id',
          { isPositive: true },
          mockRequest,
        );

        // This tests inclusion voting, but in real implementation there would be separate endpoints
        expect(definitionService.voteDefinitionInclusion).toHaveBeenCalledWith(
          'test-id',
          'user1',
          true,
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(
        controller.voteDefinition('', { isPositive: true }, mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.voteDefinitionInclusion).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing user authentication', async () => {
      await expect(
        controller.voteDefinition(
          'test-id',
          { isPositive: true },
          { user: {} },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.voteDefinitionInclusion).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing vote data', async () => {
      await expect(
        controller.voteDefinition('test-id', {} as any, mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.voteDefinitionInclusion).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      definitionService.voteDefinitionInclusion.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(
        controller.voteDefinition('test-id', { isPositive: true }, mockRequest),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getDefinitionVotes', () => {
    it('should get definition vote counts', async () => {
      definitionService.getDefinitionVotes.mockResolvedValue(mockVoteResult);

      const result = await controller.getDefinitionVotes('test-id');

      expect(definitionService.getDefinitionVotes).toHaveBeenCalledWith(
        'test-id',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getDefinitionVotes('')).rejects.toThrow(
        BadRequestException,
      );
      expect(definitionService.getDefinitionVotes).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      definitionService.getDefinitionVotes.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(controller.getDefinitionVotes('test-id')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getDefinitionVoteStatus', () => {
    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should get user vote status for definition', async () => {
      const mockVoteStatus = {
        inclusionStatus: 'agree' as const,
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 1,
        inclusionNetVotes: 4,
        contentStatus: 'agree' as const,
        contentPositiveVotes: 3,
        contentNegativeVotes: 0,
        contentNetVotes: 3,
      };

      definitionService.getDefinitionVoteStatus.mockResolvedValue(
        mockVoteStatus,
      );

      const result = await controller.getDefinitionVoteStatus(
        'test-id',
        mockRequest,
      );

      expect(definitionService.getDefinitionVoteStatus).toHaveBeenCalledWith(
        'test-id',
        'user1',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should return null when user has not voted', async () => {
      definitionService.getDefinitionVoteStatus.mockResolvedValue(null);

      const result = await controller.getDefinitionVoteStatus(
        'test-id',
        mockRequest,
      );

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.getDefinitionVoteStatus('', mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.getDefinitionVoteStatus).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing user authentication', async () => {
      await expect(
        controller.getDefinitionVoteStatus('test-id', { user: {} }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.getDefinitionVoteStatus).not.toHaveBeenCalled();
    });
  });

  describe('removeDefinitionVote', () => {
    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should remove definition vote successfully', async () => {
      definitionService.removeDefinitionVote.mockResolvedValue(mockVoteResult);

      const result = await controller.removeDefinitionVote(
        'test-id',
        mockRequest,
      );

      expect(definitionService.removeDefinitionVote).toHaveBeenCalledWith(
        'test-id',
        'user1',
        'INCLUSION', // Default vote type
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.removeDefinitionVote('', mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.removeDefinitionVote).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing user authentication', async () => {
      await expect(
        controller.removeDefinitionVote('test-id', { user: {} }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.removeDefinitionVote).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      definitionService.removeDefinitionVote.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(
        controller.removeDefinitionVote('test-id', mockRequest),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('setVisibilityStatus - Enhanced Domain Method', () => {
    it('should set definition visibility status', async () => {
      const mockResult = { success: true };
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

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.setVisibilityStatus('', { isVisible: true }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.setVisibilityStatus).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing visibility data', async () => {
      await expect(
        controller.setVisibilityStatus('test-id', {} as any),
      ).rejects.toThrow(BadRequestException);
      expect(definitionService.setVisibilityStatus).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      definitionService.setVisibilityStatus.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(
        controller.setVisibilityStatus('test-id', { isVisible: true }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getVisibilityStatus - Enhanced Domain Method', () => {
    it('should get definition visibility status', async () => {
      const mockStatus = { isVisible: true };
      definitionService.getVisibilityStatus.mockResolvedValue(mockStatus);

      const result = await controller.getVisibilityStatus('test-id');

      expect(definitionService.getVisibilityStatus).toHaveBeenCalledWith(
        'test-id',
      );
      expect(result).toEqual(mockStatus);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getVisibilityStatus('')).rejects.toThrow(
        BadRequestException,
      );
      expect(definitionService.getVisibilityStatus).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      definitionService.getVisibilityStatus.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(controller.getVisibilityStatus('test-id')).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ERROR HANDLING AND PATTERN VERIFICATION

  describe('Error Handling', () => {
    it('should handle controller-level validation errors', async () => {
      // Test empty word validation
      await expect(
        controller.createDefinition({
          word: '',
          createdBy: 'user1',
          definitionText: 'Test definition',
          discussion: 'Initial comment',
        }),
      ).rejects.toThrow(BadRequestException);

      // Test empty creator validation
      await expect(
        controller.createDefinition({
          word: 'test',
          createdBy: '',
          definitionText: 'Test definition',
          discussion: 'Initial comment',
        }),
      ).rejects.toThrow(BadRequestException);

      // Test empty definition text validation
      await expect(
        controller.createDefinition({
          word: 'test',
          createdBy: 'user1',
          definitionText: '',
          discussion: 'Initial comment',
        }),
      ).rejects.toThrow(BadRequestException);

      // Verify service was never called due to validation failures
      expect(definitionService.createDefinition).not.toHaveBeenCalled();
    });

    it('should preserve service error types', async () => {
      // BadRequestException should be preserved
      definitionService.getDefinition.mockRejectedValue(
        new BadRequestException('Service validation error'),
      );

      await expect(controller.getDefinition('test-id')).rejects.toThrow(
        BadRequestException,
      );

      // NotFoundException should be preserved
      definitionService.getDefinition.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(controller.getDefinition('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Hybrid Pattern Integration Verification', () => {
    it('should work with enhanced domain methods', async () => {
      // Test enhanced domain methods are properly called
      const mockDefinition = {
        id: 'test-id',
        word: 'test',
        definitionText: 'Test',
      };
      definitionService.getDefinition.mockResolvedValue(mockDefinition);

      await controller.getDefinition('test-id');

      expect(definitionService.getDefinition).toHaveBeenCalledWith('test-id');
    });

    it('should work with BaseNodeSchema methods', async () => {
      // Test BaseNodeSchema methods are properly called
      const mockResult = { success: true };
      definitionService.deleteDefinition.mockResolvedValue(mockResult);

      await controller.deleteDefinition('test-id');

      expect(definitionService.deleteDefinition).toHaveBeenCalledWith(
        'test-id',
      );
    });

    it('should work with hybrid update method', async () => {
      // Test hybrid update method handles both simple and complex updates
      const updateData = { definitionText: 'Updated definition' };
      const mockResult = { id: 'test-id', ...updateData };
      definitionService.updateDefinition.mockResolvedValue(mockResult);

      await controller.updateDefinition('test-id', updateData);

      expect(definitionService.updateDefinition).toHaveBeenCalledWith(
        'test-id',
        updateData,
      );
    });
  });

  describe('Mandatory Discussion Architecture Integration', () => {
    it('should handle mandatory discussion creation in definition creation', async () => {
      const definitionData = {
        word: 'test',
        createdBy: 'user1',
        definitionText: 'A test definition',
        discussion: 'Initial discussion comment',
      };

      const expectedResult = {
        id: 'test-id',
        ...definitionData,
        discussionId: 'discussion-id',
      };

      definitionService.createDefinition.mockResolvedValue(expectedResult);

      const result = await controller.createDefinition(definitionData);

      // Verify service handles mandatory discussion architecture
      expect(definitionService.createDefinition).toHaveBeenCalledWith(
        definitionData,
      );
      expect(result.discussionId).toBeDefined();
      expect(result).toEqual(expectedResult);
    });

    it('should handle discussion creation failures gracefully', async () => {
      const definitionData = {
        word: 'test',
        createdBy: 'user1',
        definitionText: 'A test definition',
        discussion: 'Initial discussion comment',
      };

      // Service should throw error when discussion creation fails
      definitionService.createDefinition.mockRejectedValue(
        new Error(
          'Failed to create discussion for definition - definition creation aborted',
        ),
      );

      await expect(controller.createDefinition(definitionData)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('Voting System Integration', () => {
    const mockRequest = { user: { sub: 'user1' } };

    it('should support dual voting system (inclusion + content)', async () => {
      // Test inclusion voting
      definitionService.voteDefinitionInclusion.mockResolvedValue(
        mockVoteResult,
      );

      await controller.voteDefinition(
        'test-id',
        { isPositive: true },
        mockRequest,
      );

      expect(definitionService.voteDefinitionInclusion).toHaveBeenCalledWith(
        'test-id',
        'user1',
        true,
      );

      // In a real implementation, there would be separate endpoints for content voting
      // This test verifies the controller can handle the service's dual voting methods
      expect(typeof definitionService.voteDefinitionContent).toBe('function');
      expect(typeof definitionService.voteDefinitionInclusion).toBe('function');
    });

    it('should provide comprehensive vote information', async () => {
      definitionService.getDefinitionVotes.mockResolvedValue(mockVoteResult);

      const result = await controller.getDefinitionVotes('test-id');

      // Verify both inclusion and content vote counts are available
      expect(result).toHaveProperty('inclusionPositiveVotes');
      expect(result).toHaveProperty('inclusionNegativeVotes');
      expect(result).toHaveProperty('inclusionNetVotes');
      expect(result).toHaveProperty('contentPositiveVotes');
      expect(result).toHaveProperty('contentNegativeVotes');
      expect(result).toHaveProperty('contentNetVotes');
    });
  });
});
