// src/nodes/definition/definition.service.spec.ts - REFACTORED ARCHITECTURE TESTS

import { Test, TestingModule } from '@nestjs/testing';
import { DefinitionService } from './definition.service';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('DefinitionService - Refactored Architecture', () => {
  let service: DefinitionService;
  let definitionSchema: jest.Mocked<DefinitionSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;

  // Mock data
  const mockDefinitionData = {
    id: 'def-123',
    word: 'test',
    definitionText: 'A test definition',
    createdBy: 'user-123',
    publicCredit: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentPositiveVotes: 4,
    contentNegativeVotes: 1,
    contentNetVotes: 3,
    discussionId: 'discussion-123',
    isApiDefinition: false,
    isAICreated: false,
  };

  const mockVoteResult = {
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentPositiveVotes: 4,
    contentNegativeVotes: 1,
    contentNetVotes: 3,
  };

  const mockVoteStatus = {
    inclusionStatus: 'agree' as const,
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentStatus: 'agree' as const,
    contentPositiveVotes: 4,
    contentNegativeVotes: 1,
    contentNetVotes: 3,
  };

  beforeEach(async () => {
    // Create comprehensive mocks
    const mockDefinitionSchema = {
      createDefinition: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      voteInclusion: jest.fn(),
      voteContent: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
      getDefinitionsByWord: jest.fn(),
      getTopDefinitionForWord: jest.fn(),
      canCreateDefinitionForWord: jest.fn(),
    };

    const mockDiscussionSchema = {
      createDiscussionForNode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DefinitionService,
        {
          provide: DefinitionSchema,
          useValue: mockDefinitionSchema,
        },
        {
          provide: DiscussionSchema,
          useValue: mockDiscussionSchema,
        },
        {
          provide: UserSchema,
          useValue: {}, // Empty mock since it's not used in service
        },
      ],
    }).compile();

    service = module.get<DefinitionService>(DefinitionService);
    definitionSchema = module.get(
      DefinitionSchema,
    ) as jest.Mocked<DefinitionSchema>;
    discussionSchema = module.get(
      DiscussionSchema,
    ) as jest.Mocked<DiscussionSchema>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  describe('createDefinition', () => {
    const createDefinitionData = {
      word: 'test',
      createdBy: 'user-123',
      definitionText: 'A test definition',
      publicCredit: true,
    };

    it('should create a definition via schema', async () => {
      definitionSchema.createDefinition.mockResolvedValue(mockDefinitionData);

      const result = await service.createDefinition(createDefinitionData);

      expect(definitionSchema.createDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String), // UUID generated
          word: 'test',
          createdBy: 'user-123',
          definitionText: 'A test definition',
          publicCredit: true,
        }),
      );
      expect(result).toEqual(mockDefinitionData);
    });

    it('should create discussion if initialComment provided', async () => {
      definitionSchema.createDefinition.mockResolvedValue(mockDefinitionData);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createDefinition({
        ...createDefinitionData,
        initialComment: 'Initial comment',
      });

      // ✅ CRITICAL: Verify DiscussionSchema is called with correct params
      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: 'def-123',
        nodeType: 'DefinitionNode',
        nodeIdField: 'id', // ✅ Standard 'id' not 'word'
        createdBy: 'user-123',
        initialComment: 'Initial comment',
      });
    });

    it('should continue if discussion creation fails', async () => {
      definitionSchema.createDefinition.mockResolvedValue(mockDefinitionData);
      discussionSchema.createDiscussionForNode.mockRejectedValue(
        new Error('Discussion creation failed'),
      );

      // Should not throw despite discussion creation failure
      const result = await service.createDefinition({
        ...createDefinitionData,
        initialComment: 'Initial comment',
      });

      // Verify definition was created successfully
      expect(definitionSchema.createDefinition).toHaveBeenCalled();
      expect(result).toEqual(mockDefinitionData);
    });

    it('should normalize word to lowercase', async () => {
      definitionSchema.createDefinition.mockResolvedValue(mockDefinitionData);

      await service.createDefinition({
        ...createDefinitionData,
        word: 'TEST',
      });

      expect(definitionSchema.createDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          word: 'test', // Normalized to lowercase
        }),
      );
    });

    it('should trim definition text', async () => {
      definitionSchema.createDefinition.mockResolvedValue(mockDefinitionData);

      await service.createDefinition({
        ...createDefinitionData,
        definitionText: '  Test definition  ',
      });

      expect(definitionSchema.createDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          definitionText: 'Test definition', // Trimmed
        }),
      );
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(
        service.createDefinition({
          ...createDefinitionData,
          word: '',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDefinition({
          ...createDefinitionData,
          word: '  ',
        }),
      ).rejects.toThrow('Word is required');
    });

    it('should throw BadRequestException if createdBy is empty', async () => {
      await expect(
        service.createDefinition({
          ...createDefinitionData,
          createdBy: '',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDefinition({
          ...createDefinitionData,
          createdBy: '',
        }),
      ).rejects.toThrow('Creator is required');
    });

    it('should throw BadRequestException if definitionText is empty', async () => {
      await expect(
        service.createDefinition({
          ...createDefinitionData,
          definitionText: '',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDefinition({
          ...createDefinitionData,
          definitionText: '  ',
        }),
      ).rejects.toThrow('Definition text is required');
    });

    it('should throw BadRequestException if definitionText exceeds max length', async () => {
      const longText = 'a'.repeat(5001); // Assuming TEXT_LIMITS.MAX_DEFINITION_LENGTH is 5000

      await expect(
        service.createDefinition({
          ...createDefinitionData,
          definitionText: longText,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      definitionSchema.createDefinition.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        service.createDefinition(createDefinitionData),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getDefinition', () => {
    it('should get definition by ID via schema', async () => {
      definitionSchema.findById.mockResolvedValue(mockDefinitionData);

      const result = await service.getDefinition('def-123');

      expect(definitionSchema.findById).toHaveBeenCalledWith('def-123');
      expect(result).toEqual(mockDefinitionData);
    });

    it('should return null if definition not found', async () => {
      definitionSchema.findById.mockResolvedValue(null);

      const result = await service.getDefinition('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(service.getDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getDefinition('  ')).rejects.toThrow(
        'Definition ID is required',
      );
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      definitionSchema.findById.mockRejectedValue(new Error('DB error'));

      await expect(service.getDefinition('def-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('updateDefinition', () => {
    const updateData = { definitionText: 'Updated definition' };

    it('should update definition via schema', async () => {
      const updatedDefinition = { ...mockDefinitionData, ...updateData };
      definitionSchema.update.mockResolvedValue(updatedDefinition);

      const result = await service.updateDefinition('def-123', updateData);

      expect(definitionSchema.update).toHaveBeenCalledWith(
        'def-123',
        updateData,
      );
      expect(result).toEqual(updatedDefinition);
    });

    it('should throw NotFoundException if definition not found', async () => {
      definitionSchema.update.mockResolvedValue(null);

      await expect(
        service.updateDefinition('nonexistent', updateData),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateDefinition('nonexistent', updateData),
      ).rejects.toThrow('Definition with ID nonexistent not found');
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(service.updateDefinition('', updateData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if definitionText is empty', async () => {
      await expect(
        service.updateDefinition('def-123', { definitionText: '' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateDefinition('def-123', { definitionText: '  ' }),
      ).rejects.toThrow('Definition text cannot be empty');
    });

    it('should throw BadRequestException if definitionText exceeds max length', async () => {
      const longText = 'a'.repeat(5001);

      await expect(
        service.updateDefinition('def-123', { definitionText: longText }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      definitionSchema.update.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateDefinition('def-123', updateData),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deleteDefinition', () => {
    it('should delete definition via schema', async () => {
      definitionSchema.delete.mockResolvedValue(undefined);

      await service.deleteDefinition('def-123');

      expect(definitionSchema.delete).toHaveBeenCalledWith('def-123');
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(service.deleteDefinition('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      definitionSchema.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteDefinition('def-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // VOTING OPERATIONS (DUAL VOTING)
  // ============================================

  describe('voteInclusion', () => {
    it('should vote on inclusion via schema', async () => {
      definitionSchema.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await service.voteInclusion('def-123', 'user-456', true);

      expect(definitionSchema.voteInclusion).toHaveBeenCalledWith(
        'def-123',
        'user-456',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(service.voteInclusion('', 'user-456', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if userId is empty', async () => {
      await expect(service.voteInclusion('def-123', '', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      definitionSchema.voteInclusion.mockRejectedValue(new Error('Vote error'));

      await expect(
        service.voteInclusion('def-123', 'user-456', true),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('voteContent', () => {
    it('should vote on content via schema', async () => {
      definitionSchema.voteContent.mockResolvedValue(mockVoteResult);

      const result = await service.voteContent('def-123', 'user-456', true);

      expect(definitionSchema.voteContent).toHaveBeenCalledWith(
        'def-123',
        'user-456',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(service.voteContent('', 'user-456', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if userId is empty', async () => {
      await expect(service.voteContent('def-123', '', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      definitionSchema.voteContent.mockRejectedValue(
        new Error('Content vote error'),
      );

      await expect(
        service.voteContent('def-123', 'user-456', true),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle schema threshold validation errors', async () => {
      // Schema will throw BadRequestException if inclusion not passed
      definitionSchema.voteContent.mockRejectedValue(
        new BadRequestException('Must pass inclusion threshold'),
      );

      await expect(
        service.voteContent('def-123', 'user-456', true),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getVoteStatus', () => {
    it('should get vote status via schema', async () => {
      definitionSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await service.getVoteStatus('def-123', 'user-456');

      expect(definitionSchema.getVoteStatus).toHaveBeenCalledWith(
        'def-123',
        'user-456',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(service.getVoteStatus('', 'user-456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if userId is empty', async () => {
      await expect(service.getVoteStatus('def-123', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeVote', () => {
    it('should remove inclusion vote via schema', async () => {
      definitionSchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await service.removeVote(
        'def-123',
        'user-456',
        'INCLUSION',
      );

      expect(definitionSchema.removeVote).toHaveBeenCalledWith(
        'def-123',
        'user-456',
        'INCLUSION',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should remove content vote via schema', async () => {
      definitionSchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await service.removeVote('def-123', 'user-456', 'CONTENT');

      expect(definitionSchema.removeVote).toHaveBeenCalledWith(
        'def-123',
        'user-456',
        'CONTENT',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(
        service.removeVote('', 'user-456', 'INCLUSION'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if userId is empty', async () => {
      await expect(
        service.removeVote('def-123', '', 'INCLUSION'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getVotes', () => {
    it('should get votes via schema', async () => {
      definitionSchema.getVotes.mockResolvedValue(mockVoteResult);

      const result = await service.getVotes('def-123');

      expect(definitionSchema.getVotes).toHaveBeenCalledWith('def-123');
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(service.getVotes('')).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  describe('getDefinitionsByWord', () => {
    it('should get definitions by word via schema', async () => {
      const mockDefinitions = [mockDefinitionData];
      definitionSchema.getDefinitionsByWord.mockResolvedValue(mockDefinitions);

      const result = await service.getDefinitionsByWord('test');

      expect(definitionSchema.getDefinitionsByWord).toHaveBeenCalledWith(
        'test',
      );
      expect(result).toEqual(mockDefinitions);
    });

    it('should normalize word to lowercase', async () => {
      definitionSchema.getDefinitionsByWord.mockResolvedValue([]);

      await service.getDefinitionsByWord('TEST');

      expect(definitionSchema.getDefinitionsByWord).toHaveBeenCalledWith(
        'test',
      );
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(service.getDefinitionsByWord('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      definitionSchema.getDefinitionsByWord.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(service.getDefinitionsByWord('test')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getTopDefinitionForWord', () => {
    it('should get top definition via schema', async () => {
      definitionSchema.getTopDefinitionForWord.mockResolvedValue(
        mockDefinitionData,
      );

      const result = await service.getTopDefinitionForWord('test');

      expect(definitionSchema.getTopDefinitionForWord).toHaveBeenCalledWith(
        'test',
      );
      expect(result).toEqual(mockDefinitionData);
    });

    it('should return null if no definition found', async () => {
      definitionSchema.getTopDefinitionForWord.mockResolvedValue(null);

      const result = await service.getTopDefinitionForWord('nonexistent');

      expect(result).toBeNull();
    });

    it('should normalize word to lowercase', async () => {
      definitionSchema.getTopDefinitionForWord.mockResolvedValue(null);

      await service.getTopDefinitionForWord('TEST');

      expect(definitionSchema.getTopDefinitionForWord).toHaveBeenCalledWith(
        'test',
      );
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(service.getTopDefinitionForWord('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('canCreateDefinitionForWord', () => {
    it('should check if definitions can be created via schema', async () => {
      definitionSchema.canCreateDefinitionForWord.mockResolvedValue(true);

      const result = await service.canCreateDefinitionForWord('test');

      expect(definitionSchema.canCreateDefinitionForWord).toHaveBeenCalledWith(
        'test',
      );
      expect(result).toBe(true);
    });

    it('should return false if word has not passed inclusion', async () => {
      definitionSchema.canCreateDefinitionForWord.mockResolvedValue(false);

      const result = await service.canCreateDefinitionForWord('test');

      expect(result).toBe(false);
    });

    it('should normalize word to lowercase', async () => {
      definitionSchema.canCreateDefinitionForWord.mockResolvedValue(true);

      await service.canCreateDefinitionForWord('TEST');

      expect(definitionSchema.canCreateDefinitionForWord).toHaveBeenCalledWith(
        'test',
      );
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(service.canCreateDefinitionForWord('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      definitionSchema.canCreateDefinitionForWord.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(service.canCreateDefinitionForWord('test')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // DISCUSSION INTEGRATION
  // ============================================

  describe('Discussion Integration', () => {
    it('should inject DiscussionSchema not DiscussionService', () => {
      // Verify that DiscussionSchema is injected
      expect(discussionSchema).toBeDefined();
      expect(discussionSchema.createDiscussionForNode).toBeDefined();
    });

    it('should call createDiscussionForNode with correct params', async () => {
      definitionSchema.createDefinition.mockResolvedValue(mockDefinitionData);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createDefinition({
        word: 'test',
        createdBy: 'user-123',
        definitionText: 'Test definition',
        initialComment: 'Test comment',
      });

      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: 'def-123',
        nodeType: 'DefinitionNode',
        nodeIdField: 'id', // ✅ Standard 'id' not 'word'
        createdBy: 'user-123',
        initialComment: 'Test comment',
      });
    });

    it('should use nodeIdField: "id" for discussions', async () => {
      definitionSchema.createDefinition.mockResolvedValue(mockDefinitionData);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createDefinition({
        word: 'test',
        createdBy: 'user-123',
        definitionText: 'Test',
        initialComment: 'Comment',
      });

      const callArgs =
        discussionSchema.createDiscussionForNode.mock.calls[0][0];
      expect(callArgs.nodeIdField).toBe('id'); // Standard 'id'
    });

    it('should only create discussion if initialComment provided', async () => {
      definitionSchema.createDefinition.mockResolvedValue(mockDefinitionData);

      // Without initialComment
      await service.createDefinition({
        word: 'test',
        createdBy: 'user-123',
        definitionText: 'Test',
      });

      expect(discussionSchema.createDiscussionForNode).not.toHaveBeenCalled();
    });

    it('should continue if discussion creation fails', async () => {
      definitionSchema.createDefinition.mockResolvedValue(mockDefinitionData);
      discussionSchema.createDiscussionForNode.mockRejectedValue(
        new Error('Discussion failed'),
      );

      // Should not throw
      const result = await service.createDefinition({
        word: 'test',
        createdBy: 'user-123',
        definitionText: 'Test',
        initialComment: 'Comment',
      });

      expect(result).toEqual(mockDefinitionData);
    });
  });

  // ============================================
  // ERROR HANDLING
  // ============================================

  describe('Error Handling', () => {
    it('should preserve BadRequestException from service', async () => {
      await expect(service.getDefinition('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should preserve NotFoundException from service', async () => {
      definitionSchema.update.mockResolvedValue(null);
      await expect(
        service.updateDefinition('def-123', { definitionText: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      definitionSchema.findById.mockRejectedValue(new Error('Unknown error'));
      await expect(service.getDefinition('def-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should include error messages in wrapped exceptions', async () => {
      definitionSchema.createDefinition.mockRejectedValue(
        new Error('DB connection failed'),
      );

      await expect(
        service.createDefinition({
          word: 'test',
          createdBy: 'user-123',
          definitionText: 'Test',
        }),
      ).rejects.toThrow('Failed to create definition: DB connection failed');
    });
  });
});
