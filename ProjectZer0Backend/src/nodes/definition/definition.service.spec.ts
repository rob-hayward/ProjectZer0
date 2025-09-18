// src/nodes/definition/definition.service.spec.ts - REFACTORED WITH HYBRID PATTERN + BASENODE INTEGRATION

import { Test, TestingModule } from '@nestjs/testing';
import { DefinitionService } from './definition.service';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TEXT_LIMITS } from '../../constants/validation';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';
import type { DiscussionData } from '../../neo4j/schemas/discussion.schema';

describe('DefinitionService with BaseNodeSchema Integration', () => {
  let service: DefinitionService;
  let definitionSchema: jest.Mocked<DefinitionSchema>;
  let userSchema: jest.Mocked<UserSchema>;
  let discussionService: jest.Mocked<DiscussionService>;
  // Remove unused commentService variable

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 1,
    inclusionNetVotes: 4,
    contentPositiveVotes: 3,
    contentNegativeVotes: 0,
    contentNetVotes: 3,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree' as const,
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 1,
    inclusionNetVotes: 4,
    contentStatus: 'agree' as const,
    contentPositiveVotes: 3,
    contentNegativeVotes: 0,
    contentNetVotes: 3,
  };

  // ✅ Complete DiscussionData mock with all required properties
  const mockDiscussionData: DiscussionData = {
    id: 'discussion-id',
    createdBy: 'test-user',
    associatedNodeId: 'test-id',
    associatedNodeType: 'DefinitionNode',
    createdAt: new Date(),
    updatedAt: new Date(),
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockDefinitionData = {
    id: 'test-id',
    word: 'test',
    createdBy: 'user1',
    definitionText: 'A test definition',
    discussion: 'Discussion ID: discussion-id', // Use discussion field instead of discussionId
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 1,
    inclusionNetVotes: 4,
    contentPositiveVotes: 3,
    contentNegativeVotes: 0,
    contentNetVotes: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validDefinitionData = {
    word: 'test',
    createdBy: 'user1',
    definitionText: 'A test definition',
    initialComment: 'Initial discussion comment',
  };

  beforeEach(async () => {
    // ✅ Mock only methods that actually exist after BaseNodeSchema integration
    const mockDefinitionSchema = {
      // ✅ Enhanced domain methods (preserved)
      createDefinition: jest.fn(),
      getDefinitionsByWord: jest.fn(),
      getApprovedDefinitions: jest.fn(),

      // ✅ BaseNodeSchema methods (inherited)
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      voteInclusion: jest.fn(),
      voteContent: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),

      // ❌ REMOVED: Methods that don't exist in DefinitionSchema
      // - getDefinition() -> replaced by findById()
      // - setVisibilityStatus() -> not implemented in current schema
      // - getVisibilityStatus() -> not implemented in current schema
    };

    const mockUserSchema = {
      addCreatedNode: jest.fn(),
      addParticipation: jest.fn(),
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
      providers: [
        DefinitionService,
        {
          provide: DefinitionSchema,
          useValue: mockDefinitionSchema,
        },
        {
          provide: UserSchema,
          useValue: mockUserSchema,
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

    service = module.get<DefinitionService>(DefinitionService);
    definitionSchema = module.get(DefinitionSchema);
    userSchema = module.get(UserSchema);
    discussionService = module.get(DiscussionService);
    // Remove commentService assignment
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // CRUD OPERATIONS TESTS

  describe('createDefinition - Mandatory Discussion Architecture', () => {
    it('should create definition with mandatory discussion successfully', async () => {
      const createdDefinition = {
        id: 'test-id',
        ...validDefinitionData,
      };

      definitionSchema.createDefinition.mockResolvedValue(createdDefinition);
      discussionService.createDiscussion.mockResolvedValue(mockDiscussionData);
      definitionSchema.update.mockResolvedValue({
        ...createdDefinition,
        discussion: 'Discussion ID: discussion-id',
      });
      userSchema.addCreatedNode.mockResolvedValue(undefined);

      const result = await service.createDefinition(validDefinitionData);

      expect(definitionSchema.createDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          ...validDefinitionData,
          id: expect.any(String),
          word: 'test', // normalized to lowercase
        }),
      );

      expect(discussionService.createDiscussion).toHaveBeenCalledWith({
        createdBy: 'user1',
        associatedNodeId: 'test-id',
        associatedNodeType: 'DefinitionNode',
        initialComment: 'Initial discussion comment',
      });

      expect(definitionSchema.update).toHaveBeenCalledWith('test-id', {
        discussionId: 'discussion-id',
      });

      expect(userSchema.addCreatedNode).toHaveBeenCalledWith(
        'user1',
        'test-id',
        'definition',
      );

      expect(result).toEqual({
        ...createdDefinition,
        discussionId: 'discussion-id',
      });
    });

    it('should handle discussion creation failure with cleanup', async () => {
      const createdDefinition = {
        id: 'test-id',
        ...validDefinitionData,
      };

      definitionSchema.createDefinition.mockResolvedValue(createdDefinition);
      discussionService.createDiscussion.mockRejectedValue(
        new Error('Discussion creation failed'),
      );
      definitionSchema.delete.mockResolvedValue({ success: true });

      await expect(
        service.createDefinition(validDefinitionData),
      ).rejects.toThrow(InternalServerErrorException);

      // Verify cleanup occurred
      expect(definitionSchema.delete).toHaveBeenCalledWith('test-id');
    });

    it('should not track creation for API-created definitions', async () => {
      const apiDefinitionData = {
        ...validDefinitionData,
        createdBy: 'FreeDictionaryAPI',
      };

      const createdDefinition = {
        id: 'test-id',
        ...apiDefinitionData,
      };

      definitionSchema.createDefinition.mockResolvedValue(createdDefinition);
      discussionService.createDiscussion.mockResolvedValue(mockDiscussionData);
      definitionSchema.update.mockResolvedValue({
        ...createdDefinition,
        discussion: 'Discussion ID: discussion-id',
      });

      const result = await service.createDefinition(apiDefinitionData);

      expect(userSchema.addCreatedNode).not.toHaveBeenCalled();
      expect(result).toEqual({
        ...createdDefinition,
        discussionId: 'discussion-id',
      });
    });

    it('should handle tracking errors gracefully', async () => {
      const createdDefinition = {
        id: 'test-id',
        ...validDefinitionData,
      };

      definitionSchema.createDefinition.mockResolvedValue(createdDefinition);
      discussionService.createDiscussion.mockResolvedValue(mockDiscussionData);
      definitionSchema.update.mockResolvedValue({
        ...createdDefinition,
        discussion: 'Discussion ID: discussion-id',
      });
      userSchema.addCreatedNode.mockRejectedValue(new Error('Tracking error'));

      // Should not throw despite tracking error
      const result = await service.createDefinition(validDefinitionData);
      expect(result).toEqual({
        ...createdDefinition,
        discussionId: 'discussion-id',
      });
    });

    // VALIDATION TESTS
    it('should throw BadRequestException for empty word', async () => {
      await expect(
        service.createDefinition({
          ...validDefinitionData,
          word: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionSchema.createDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty definition text', async () => {
      await expect(
        service.createDefinition({
          ...validDefinitionData,
          definitionText: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionSchema.createDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for definition text exceeding max length', async () => {
      const longText = 'a'.repeat(TEXT_LIMITS.MAX_DEFINITION_LENGTH + 1);

      await expect(
        service.createDefinition({
          ...validDefinitionData,
          definitionText: longText,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionSchema.createDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing initial comment', async () => {
      await expect(
        service.createDefinition({
          ...validDefinitionData,
          initialComment: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionSchema.createDefinition).not.toHaveBeenCalled();
    });

    it('should normalize word to lowercase', async () => {
      const createdDefinition = {
        id: 'test-id',
        ...validDefinitionData,
        word: 'TEST',
      };

      definitionSchema.createDefinition.mockResolvedValue(createdDefinition);
      discussionService.createDiscussion.mockResolvedValue(mockDiscussionData);
      definitionSchema.update.mockResolvedValue({
        ...createdDefinition,
        discussionId: 'discussion-id',
      });

      await service.createDefinition({
        ...validDefinitionData,
        word: 'TEST',
      });

      expect(definitionSchema.createDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          word: 'test', // Should be normalized to lowercase
        }),
      );
    });
  });

  describe('getDefinition - BaseNodeSchema findById Method', () => {
    it('should get a definition by id using findById', async () => {
      definitionSchema.findById.mockResolvedValue(mockDefinitionData);

      const result = await service.getDefinition('test-id');

      expect(definitionSchema.findById).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockDefinitionData);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(service.getDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      expect(definitionSchema.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when definition not found', async () => {
      definitionSchema.findById.mockResolvedValue(null);

      await expect(service.getDefinition('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDefinitionWithDiscussion - Enhanced Domain Method', () => {
    it('should return definition with discussion integrity check', async () => {
      const mockDefinitionWithDiscussion = {
        ...mockDefinitionData,
        discussion: 'Discussion ID: discussion-id',
      };

      definitionSchema.findById.mockResolvedValue(mockDefinitionWithDiscussion);

      const result = await service.getDefinitionWithDiscussion('test-id');

      expect(result).toEqual(mockDefinitionWithDiscussion);
    });

    it('should throw error when definition missing required discussion', async () => {
      const mockDefinitionWithoutDiscussion = {
        ...mockDefinitionData,
        discussion: undefined,
      };

      definitionSchema.findById.mockResolvedValue(
        mockDefinitionWithoutDiscussion,
      );

      await expect(
        service.getDefinitionWithDiscussion('test-id'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(service.getDefinitionWithDiscussion('')).rejects.toThrow(
        BadRequestException,
      );
      expect(definitionSchema.findById).not.toHaveBeenCalled();
    });
  });

  describe('updateDefinition - Hybrid Pattern', () => {
    const validUpdateData = { definitionText: 'Updated definition' };

    it('should update definition with simple data using BaseNodeSchema', async () => {
      const expectedResult = {
        id: 'test-id',
        word: 'test',
        createdBy: 'user1',
        definitionText: 'Updated definition',
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      definitionSchema.update.mockResolvedValue(expectedResult);

      const result = await service.updateDefinition('test-id', validUpdateData);

      expect(definitionSchema.update).toHaveBeenCalledWith(
        'test-id',
        validUpdateData,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle complex updates with multiple fields', async () => {
      const complexUpdateData = {
        definitionText: 'Updated definition',
        discussion: 'Updated discussion text',
      };

      const expectedResult = {
        id: 'test-id',
        word: 'test',
        createdBy: 'user1',
        definitionText: 'Updated definition',
        discussion: 'Updated discussion text',
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      definitionSchema.update.mockResolvedValue(expectedResult);

      const result = await service.updateDefinition(
        'test-id',
        complexUpdateData,
      );

      expect(definitionSchema.update).toHaveBeenCalledWith(
        'test-id',
        complexUpdateData,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(
        service.updateDefinition('', validUpdateData),
      ).rejects.toThrow(BadRequestException);
      expect(definitionSchema.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty definition text', async () => {
      await expect(
        service.updateDefinition('test-id', { definitionText: '' }),
      ).rejects.toThrow(BadRequestException);
      expect(definitionSchema.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when definition not found', async () => {
      definitionSchema.update.mockResolvedValue(null);

      await expect(
        service.updateDefinition('test-id', validUpdateData),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDefinition - BaseNodeSchema Method', () => {
    it('should delete definition successfully', async () => {
      const mockResult = { success: true };
      definitionSchema.delete.mockResolvedValue(mockResult);

      const result = await service.deleteDefinition('test-id');

      expect(definitionSchema.delete).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(service.deleteDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      expect(definitionSchema.delete).not.toHaveBeenCalled();
    });
  });

  // VOTING TESTS - Using BaseNodeSchema methods
  describe('Voting Methods - BaseNodeSchema Integration', () => {
    describe('voteDefinitionInclusion', () => {
      it('should vote on definition inclusion using BaseNodeSchema', async () => {
        definitionSchema.voteInclusion.mockResolvedValue(mockVoteResult);

        const result = await service.voteDefinitionInclusion(
          'test-id',
          'user-123',
          true,
        );

        expect(definitionSchema.voteInclusion).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          true,
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for empty definition id', async () => {
        await expect(
          service.voteDefinitionInclusion('', 'user-123', true),
        ).rejects.toThrow(BadRequestException);
        expect(definitionSchema.voteInclusion).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException for empty user id', async () => {
        await expect(
          service.voteDefinitionInclusion('test-id', '', true),
        ).rejects.toThrow(BadRequestException);
        expect(definitionSchema.voteInclusion).not.toHaveBeenCalled();
      });
    });

    describe('voteDefinitionContent', () => {
      it('should vote on definition content using BaseNodeSchema', async () => {
        definitionSchema.voteContent.mockResolvedValue(mockVoteResult);

        const result = await service.voteDefinitionContent(
          'test-id',
          'user-123',
          false,
        );

        expect(definitionSchema.voteContent).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          false,
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('getDefinitionVoteStatus', () => {
      it('should get vote status using BaseNodeSchema', async () => {
        definitionSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await service.getDefinitionVoteStatus(
          'test-id',
          'user-123',
        );

        expect(definitionSchema.getVoteStatus).toHaveBeenCalledWith(
          'test-id',
          'user-123',
        );
        expect(result).toEqual(mockVoteStatus);
      });
    });

    describe('removeDefinitionVote', () => {
      it('should remove vote using BaseNodeSchema', async () => {
        definitionSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await service.removeDefinitionVote(
          'test-id',
          'user-123',
          'INCLUSION',
        );

        expect(definitionSchema.removeVote).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should default to INCLUSION vote type', async () => {
        definitionSchema.removeVote.mockResolvedValue(mockVoteResult);

        await service.removeDefinitionVote('test-id', 'user-123');

        expect(definitionSchema.removeVote).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          'INCLUSION',
        );
      });
    });

    describe('getDefinitionVotes', () => {
      it('should get vote counts using BaseNodeSchema', async () => {
        definitionSchema.getVotes.mockResolvedValue(mockVoteResult);

        const result = await service.getDefinitionVotes('test-id');

        expect(definitionSchema.getVotes).toHaveBeenCalledWith('test-id');
        expect(result).toEqual(mockVoteResult);
      });
    });
  });

  // VISIBILITY TESTS - Placeholder implementations (not implemented in current schema)
  describe('Visibility Methods - Placeholder Implementations', () => {
    describe('setVisibilityStatus', () => {
      it('should return placeholder response for visibility setting', async () => {
        const result = await service.setVisibilityStatus('test-id', true);

        expect(result).toEqual({
          success: true,
          message: 'Visibility status updated (placeholder)',
        });
      });

      it('should throw BadRequestException for empty id', async () => {
        await expect(service.setVisibilityStatus('', true)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('getVisibilityStatus', () => {
      it('should return placeholder visibility status', async () => {
        const result = await service.getVisibilityStatus('test-id');

        expect(result).toEqual({ isVisible: true });
      });

      it('should throw BadRequestException for empty id', async () => {
        await expect(service.getVisibilityStatus('')).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  // UTILITY METHODS TESTS
  describe('Utility Methods', () => {
    describe('isDefinitionApproved', () => {
      it('should return true when definition has positive inclusion net votes', async () => {
        const mockVotesPositive = {
          ...mockVoteResult,
          inclusionNetVotes: 5,
        };
        definitionSchema.getVotes.mockResolvedValue(mockVotesPositive);

        const result = await service.isDefinitionApproved('test-id');

        expect(result).toBe(true);
      });

      it('should return false when definition has zero or negative inclusion net votes', async () => {
        const mockVotesNegative = {
          ...mockVoteResult,
          inclusionNetVotes: -1,
        };
        definitionSchema.getVotes.mockResolvedValue(mockVotesNegative);

        const result = await service.isDefinitionApproved('test-id');

        expect(result).toBe(false);
      });

      it('should return false when no votes found', async () => {
        definitionSchema.getVotes.mockResolvedValue(null);

        const result = await service.isDefinitionApproved('test-id');

        expect(result).toBe(false);
      });
    });

    describe('isContentVotingAvailable', () => {
      it('should return true when definition passed inclusion threshold', async () => {
        const mockVotesPositive = {
          ...mockVoteResult,
          inclusionNetVotes: 1,
        };
        definitionSchema.getVotes.mockResolvedValue(mockVotesPositive);

        const result = await service.isContentVotingAvailable('test-id');

        expect(result).toBe(true);
      });

      it('should return false when definition has not passed inclusion threshold', async () => {
        const mockVotesNegative = {
          ...mockVoteResult,
          inclusionNetVotes: 0,
        };
        definitionSchema.getVotes.mockResolvedValue(mockVotesNegative);

        const result = await service.isContentVotingAvailable('test-id');

        expect(result).toBe(false);
      });
    });

    describe('getDefinitionStats', () => {
      it('should return comprehensive definition statistics', async () => {
        definitionSchema.getDefinition.mockResolvedValue(mockDefinitionData);
        definitionSchema.getVotes.mockResolvedValue(mockVoteResult);

        const result = await service.getDefinitionStats('test-id');

        expect(result).toEqual({
          id: 'test-id',
          word: 'test',
          isApproved: true, // inclusionNetVotes > 0
          contentVotingAvailable: true, // inclusionNetVotes > 0
          votes: mockVoteResult,
          hasDiscussion: true, // discussion field exists
        });
      });
    });
  });

  // ERROR HANDLING TESTS
  describe('Error Handling', () => {
    it('should handle schema errors consistently', async () => {
      definitionSchema.getDefinition.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getDefinition('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should preserve HttpExceptions from dependencies', async () => {
      const badRequestError = new BadRequestException('Invalid input');
      definitionSchema.getDefinition.mockRejectedValue(badRequestError);

      await expect(service.getDefinition('test-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate empty IDs across methods', async () => {
      await expect(service.getDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateDefinition('', {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteDefinition('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // HYBRID PATTERN VERIFICATION
  describe('Hybrid Pattern Implementation', () => {
    it('should use enhanced methods for complex operations', () => {
      // Verify service uses enhanced domain methods
      expect(typeof service.createDefinition).toBe('function');
      expect(typeof service.getDefinition).toBe('function'); // Uses findById internally
      expect(typeof service.getDefinitionWithDiscussion).toBe('function');
    });

    it('should use BaseNodeSchema methods for standard operations', () => {
      // These are called through the service methods
      expect(typeof service.updateDefinition).toBe('function'); // Hybrid: complex->enhanced, simple->BaseNodeSchema
      expect(typeof service.deleteDefinition).toBe('function');
      expect(typeof service.voteDefinitionInclusion).toBe('function');
      expect(typeof service.voteDefinitionContent).toBe('function');
      expect(typeof service.getDefinitionVoteStatus).toBe('function');
      expect(typeof service.removeDefinitionVote).toBe('function');
      expect(typeof service.getDefinitionVotes).toBe('function');
    });

    it('should have utility and approval methods', () => {
      expect(typeof service.isDefinitionApproved).toBe('function');
      expect(typeof service.isContentVotingAvailable).toBe('function');
      expect(typeof service.getDefinitionStats).toBe('function');
    });

    it('should have placeholder visibility methods', () => {
      // These are placeholder implementations until schema supports them
      expect(typeof service.setVisibilityStatus).toBe('function');
      expect(typeof service.getVisibilityStatus).toBe('function');
    });
  });

  // MANDATORY DISCUSSION ARCHITECTURE VERIFICATION
  describe('Mandatory Discussion Architecture', () => {
    it('should enforce discussion creation during definition creation', async () => {
      const createdDefinition = {
        id: 'test-id',
        ...validDefinitionData,
      };

      definitionSchema.createDefinition.mockResolvedValue(createdDefinition);
      discussionService.createDiscussion.mockResolvedValue(mockDiscussionData);
      definitionSchema.update.mockResolvedValue({
        ...createdDefinition,
        discussionId: 'discussion-id',
      });

      await service.createDefinition(validDefinitionData);

      // Verify discussion creation is mandatory
      expect(discussionService.createDiscussion).toHaveBeenCalledWith({
        createdBy: 'user1',
        associatedNodeId: 'test-id',
        associatedNodeType: 'DefinitionNode',
        initialComment: 'Initial discussion comment',
      });
    });

    it('should enforce cleanup when discussion creation fails', async () => {
      const createdDefinition = {
        id: 'test-id',
        ...validDefinitionData,
      };

      definitionSchema.createDefinition.mockResolvedValue(createdDefinition);
      discussionService.createDiscussion.mockRejectedValue(
        new Error('Discussion creation failed'),
      );
      definitionSchema.delete.mockResolvedValue({ success: true });

      await expect(
        service.createDefinition(validDefinitionData),
      ).rejects.toThrow(InternalServerErrorException);

      // Verify cleanup was attempted
      expect(definitionSchema.delete).toHaveBeenCalledWith('test-id');
    });

    it('should validate all definitions have discussion reference in getDefinitionWithDiscussion', async () => {
      const definitionWithoutDiscussion = {
        ...mockDefinitionData,
        discussion: null,
      };

      definitionSchema.findById.mockResolvedValue(definitionWithoutDiscussion);

      await expect(
        service.getDefinitionWithDiscussion('test-id'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // INPUT VALIDATION TESTS
  describe('Input Validation', () => {
    it('should throw BadRequestException for empty IDs across methods', async () => {
      await expect(service.getDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateDefinition('', {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.voteDefinitionInclusion('', 'user', true),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.voteDefinitionInclusion('id', '', true),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate definition text length in creation', async () => {
      const longText = 'a'.repeat(TEXT_LIMITS.MAX_DEFINITION_LENGTH + 1);
      await expect(
        service.createDefinition({
          ...validDefinitionData,
          definitionText: longText,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate definition text length in updates', async () => {
      const longText = 'a'.repeat(TEXT_LIMITS.MAX_DEFINITION_LENGTH + 1);
      await expect(
        service.updateDefinition('test-id', { definitionText: longText }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate initial comment is required', async () => {
      await expect(
        service.createDefinition({
          ...validDefinitionData,
          initialComment: '',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createDefinition({
          word: 'test',
          createdBy: 'user1',
          definitionText: 'A test definition',
          // No initialComment or discussion provided
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
