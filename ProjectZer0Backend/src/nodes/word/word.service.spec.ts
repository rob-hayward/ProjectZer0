// src/nodes/word/word.service.spec.ts - REFACTORED ARCHITECTURE TESTS - FIXED

import { Test, TestingModule } from '@nestjs/testing';
import { WordService } from './word.service';
import { WordSchema } from '../../neo4j/schemas/word.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VisibilityService } from '../../users/visibility/visibility.service';
import { DictionaryService } from '../../dictionary/dictionary.service';
import { DefinitionService } from '../definition/definition.service'; // ← ADDED
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('WordService - Refactored Architecture', () => {
  let service: WordService;
  let wordSchema: jest.Mocked<WordSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  let visibilityService: jest.Mocked<VisibilityService>;
  let dictionaryService: jest.Mocked<DictionaryService>;
  let definitionService: jest.Mocked<DefinitionService>; // ← ADDED

  // Mock data
  const mockWordData = {
    id: 'test',
    word: 'test',
    createdBy: 'user-123',
    publicCredit: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
    definitions: [],
    discussionId: null,
  };

  const mockVoteResult = {
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus = {
    inclusionStatus: 'agree' as const,
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentStatus: null,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  beforeEach(async () => {
    // Create comprehensive mocks
    const mockWordSchema = {
      checkWordExistence: jest.fn(),
      createWord: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      voteInclusion: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
      getAllWords: jest.fn(),
      getApprovedWords: jest.fn(),
      checkWords: jest.fn(),
      isWordAvailableForDefinitionCreation: jest.fn(),
    };

    const mockDiscussionSchema = {
      createDiscussionForNode: jest.fn(),
    };

    const mockVisibilityService = {
      setUserVisibilityPreference: jest.fn(),
      getObjectVisibility: jest.fn(),
    };

    const mockDictionaryService = {
      getDefinition: jest.fn(),
    };

    // ✅ ADDED: Mock DefinitionService
    const mockDefinitionService = {
      getDefinitionsByWord: jest.fn(),
      getDefinition: jest.fn(),
      createDefinition: jest.fn(),
      updateDefinition: jest.fn(),
      deleteDefinition: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordService,
        {
          provide: WordSchema,
          useValue: mockWordSchema,
        },
        {
          provide: DiscussionSchema,
          useValue: mockDiscussionSchema,
        },
        {
          provide: UserSchema,
          useValue: {}, // Empty mock since it's not used in service
        },
        {
          provide: VisibilityService,
          useValue: mockVisibilityService,
        },
        {
          provide: DictionaryService,
          useValue: mockDictionaryService,
        },
        // ✅ ADDED: Provide DefinitionService mock
        {
          provide: DefinitionService,
          useValue: mockDefinitionService,
        },
      ],
    }).compile();

    service = module.get<WordService>(WordService);
    wordSchema = module.get(WordSchema) as jest.Mocked<WordSchema>;
    discussionSchema = module.get(
      DiscussionSchema,
    ) as jest.Mocked<DiscussionSchema>;
    visibilityService = module.get(
      VisibilityService,
    ) as jest.Mocked<VisibilityService>;
    dictionaryService = module.get(
      DictionaryService,
    ) as jest.Mocked<DictionaryService>;
    // ✅ ADDED: Get DefinitionService mock
    definitionService = module.get(
      DefinitionService,
    ) as jest.Mocked<DefinitionService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  describe('createWord', () => {
    const createWordData = {
      word: 'test',
      createdBy: 'user-123',
      publicCredit: true,
    };

    it('should create a word via schema', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(false);
      // ✅ FIXED: createWord returns { word: WordNodeData, definition?: ... }
      wordSchema.createWord.mockResolvedValue({
        word: mockWordData,
        definition: undefined,
      } as any);

      const result = await service.createWord(createWordData);

      expect(wordSchema.checkWordExistence).toHaveBeenCalledWith('test');
      expect(wordSchema.createWord).toHaveBeenCalledWith({
        word: 'test',
        createdBy: 'user-123',
        publicCredit: true,
        initialDefinition: undefined,
        isApiDefinition: undefined,
        isAICreated: undefined,
      });
      // ✅ FIXED: No longer fetches via findById, returns directly from createWord result
      expect(wordSchema.findById).not.toHaveBeenCalled();
      expect(result).toEqual(mockWordData);
    });

    it('should create word with initial definition', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(false);
      wordSchema.createWord.mockResolvedValue({
        word: mockWordData,
        definition: { id: 'def-123', definitionText: 'A test word' },
      } as any);

      await service.createWord({
        ...createWordData,
        initialDefinition: 'A test word',
      });

      expect(wordSchema.createWord).toHaveBeenCalledWith(
        expect.objectContaining({
          initialDefinition: 'A test word',
        }),
      );
    });

    it('should create discussion if initialComment provided', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(false);
      wordSchema.createWord.mockResolvedValue({
        word: mockWordData,
        definition: undefined,
      } as any);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createWord({
        ...createWordData,
        initialComment: 'Initial comment',
      });

      // ✅ CRITICAL: Verify DiscussionSchema is called directly
      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: 'test',
        nodeType: 'WordNode',
        nodeIdField: 'word', // ✅ CRITICAL: 'word' not 'id'
        createdBy: 'user-123',
        initialComment: 'Initial comment',
      });
    });

    it('should continue if discussion creation fails', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(false);
      wordSchema.createWord.mockResolvedValue({
        word: mockWordData,
        definition: undefined,
      } as any);
      discussionSchema.createDiscussionForNode.mockRejectedValue(
        new Error('Discussion creation failed'),
      );

      // Should not throw despite discussion creation failure
      const result = await service.createWord({
        ...createWordData,
        initialComment: 'Initial comment',
      });

      // Verify word was created successfully
      expect(wordSchema.createWord).toHaveBeenCalled();
      expect(result).toEqual(mockWordData);
    });

    it('should fetch API definition if isApiDefinition true', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(false);
      wordSchema.createWord.mockResolvedValue({
        word: mockWordData,
        definition: undefined,
      } as any);
      dictionaryService.getDefinition.mockResolvedValue('API definition text');

      await service.createWord({
        ...createWordData,
        isApiDefinition: true,
      });

      expect(dictionaryService.getDefinition).toHaveBeenCalledWith('test');
      expect(wordSchema.createWord).toHaveBeenCalledWith(
        expect.objectContaining({
          initialDefinition: 'API definition text',
          isApiDefinition: true,
        }),
      );
    });

    it('should continue if API definition fetch fails', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(false);
      wordSchema.createWord.mockResolvedValue({
        word: mockWordData,
        definition: undefined,
      } as any);
      dictionaryService.getDefinition.mockRejectedValue(new Error('API error'));

      // Should not throw
      await service.createWord({
        ...createWordData,
        isApiDefinition: true,
      });

      expect(wordSchema.createWord).toHaveBeenCalled();
    });

    it('should throw ConflictException if word already exists', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(true);

      await expect(service.createWord(createWordData)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createWord(createWordData)).rejects.toThrow(
        `Word 'test' already exists`,
      );

      expect(wordSchema.createWord).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(
        service.createWord({
          word: '',
          createdBy: 'user-123',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createWord({
          word: '  ',
          createdBy: 'user-123',
        }),
      ).rejects.toThrow('Word cannot be empty');
    });

    it('should throw BadRequestException if createdBy is missing', async () => {
      await expect(
        service.createWord({
          word: 'test',
          createdBy: '',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createWord({
          word: 'test',
          createdBy: '',
        }),
      ).rejects.toThrow('Creator is required');
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      wordSchema.checkWordExistence.mockRejectedValue(new Error('DB error'));

      await expect(service.createWord(createWordData)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getWord', () => {
    it('should get word by word value via schema', async () => {
      wordSchema.findById.mockResolvedValue(mockWordData);

      const result = await service.getWord('test');

      expect(wordSchema.findById).toHaveBeenCalledWith('test');
      expect(result).toEqual(mockWordData);
    });

    it('should return null if word not found', async () => {
      wordSchema.findById.mockResolvedValue(null);

      const result = await service.getWord('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(service.getWord('')).rejects.toThrow(BadRequestException);
      await expect(service.getWord('  ')).rejects.toThrow(
        'Word cannot be empty',
      );
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      wordSchema.findById.mockRejectedValue(new Error('DB error'));

      await expect(service.getWord('test')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getWordWithVisibility', () => {
    it('should get word with visibility context', async () => {
      wordSchema.findById.mockResolvedValue(mockWordData);
      visibilityService.getObjectVisibility.mockResolvedValue(true);

      const result = await service.getWordWithVisibility('test', 'user-456');

      expect(wordSchema.findById).toHaveBeenCalledWith('test');
      expect(visibilityService.getObjectVisibility).toHaveBeenCalledWith(
        'user-456',
        'test',
        {
          netVotes: 3,
          isVisible: undefined,
        },
      );
      expect(result).toEqual({
        ...mockWordData,
        isVisible: true,
      });
    });

    it('should work for anonymous users', async () => {
      wordSchema.findById.mockResolvedValue(mockWordData);
      visibilityService.getObjectVisibility.mockResolvedValue(true);

      const result = await service.getWordWithVisibility('test');

      expect(visibilityService.getObjectVisibility).toHaveBeenCalledWith(
        null,
        'test',
        expect.any(Object),
      );
      expect(result).toHaveProperty('isVisible');
    });

    it('should return null if word not found', async () => {
      wordSchema.findById.mockResolvedValue(null);

      const result = await service.getWordWithVisibility('nonexistent');

      expect(result).toBeNull();
      expect(visibilityService.getObjectVisibility).not.toHaveBeenCalled();
    });

    it('should handle visibility check errors gracefully', async () => {
      wordSchema.findById.mockResolvedValue(mockWordData);
      visibilityService.getObjectVisibility.mockRejectedValue(
        new Error('Visibility error'),
      );

      const result = await service.getWordWithVisibility('test', 'user-456');

      // Should return word with isVisible: true on error
      expect(result).toEqual({
        ...mockWordData,
        isVisible: true,
      });
    });
  });

  describe('updateWord', () => {
    const updateData = { publicCredit: false };

    it('should update word via schema', async () => {
      const updatedWord = { ...mockWordData, ...updateData };
      wordSchema.update.mockResolvedValue(updatedWord);

      const result = await service.updateWord('test', updateData);

      expect(wordSchema.update).toHaveBeenCalledWith('test', updateData);
      expect(result).toEqual(updatedWord);
    });

    it('should throw NotFoundException if word not found', async () => {
      wordSchema.update.mockResolvedValue(null);

      await expect(
        service.updateWord('nonexistent', updateData),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateWord('nonexistent', updateData),
      ).rejects.toThrow('Word "nonexistent" not found');
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(service.updateWord('', updateData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      wordSchema.update.mockRejectedValue(new Error('DB error'));

      await expect(service.updateWord('test', updateData)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('deleteWord', () => {
    it('should delete word via schema', async () => {
      wordSchema.delete.mockResolvedValue(undefined);

      await service.deleteWord('test');

      expect(wordSchema.delete).toHaveBeenCalledWith('test');
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(service.deleteWord('')).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      wordSchema.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteWord('test')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // VOTING OPERATIONS
  // ============================================

  describe('voteInclusion', () => {
    it('should vote on inclusion via schema', async () => {
      wordSchema.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await service.voteInclusion('test', 'user-456', true);

      expect(wordSchema.voteInclusion).toHaveBeenCalledWith(
        'test',
        'user-456',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(service.voteInclusion('', 'user-456', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if userId is empty', async () => {
      await expect(service.voteInclusion('test', '', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      wordSchema.voteInclusion.mockRejectedValue(new Error('Vote error'));

      await expect(
        service.voteInclusion('test', 'user-456', true),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getVoteStatus', () => {
    it('should get vote status via schema', async () => {
      wordSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await service.getVoteStatus('test', 'user-456');

      expect(wordSchema.getVoteStatus).toHaveBeenCalledWith('test', 'user-456');
      expect(result).toEqual(mockVoteStatus);
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(service.getVoteStatus('', 'user-456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if userId is empty', async () => {
      await expect(service.getVoteStatus('test', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeVote', () => {
    it('should remove vote via schema', async () => {
      wordSchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await service.removeVote('test', 'user-456');

      expect(wordSchema.removeVote).toHaveBeenCalledWith(
        'test',
        'user-456',
        'INCLUSION',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(service.removeVote('', 'user-456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if userId is empty', async () => {
      await expect(service.removeVote('test', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getVotes', () => {
    it('should get votes via schema', async () => {
      wordSchema.getVotes.mockResolvedValue(mockVoteResult);

      const result = await service.getVotes('test');

      expect(wordSchema.getVotes).toHaveBeenCalledWith('test');
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(service.getVotes('')).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // VISIBILITY OPERATIONS
  // ============================================

  describe('setVisibilityPreference', () => {
    it('should set visibility preference via VisibilityService', async () => {
      visibilityService.setUserVisibilityPreference.mockResolvedValue(
        undefined,
      );

      await service.setVisibilityPreference('user-456', 'test', false);

      expect(
        visibilityService.setUserVisibilityPreference,
      ).toHaveBeenCalledWith('user-456', 'test', false);
    });

    it('should throw BadRequestException if wordId is empty', async () => {
      await expect(
        service.setVisibilityPreference('user-456', '', false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if userId is empty', async () => {
      await expect(
        service.setVisibilityPreference('', 'test', false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on service error', async () => {
      visibilityService.setUserVisibilityPreference.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(
        service.setVisibilityPreference('user-456', 'test', false),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getVisibilityForUser', () => {
    it('should get visibility for user', async () => {
      wordSchema.findById.mockResolvedValue(mockWordData);
      visibilityService.getObjectVisibility.mockResolvedValue(true);

      const result = await service.getVisibilityForUser('test', 'user-456');

      expect(wordSchema.findById).toHaveBeenCalledWith('test');
      expect(visibilityService.getObjectVisibility).toHaveBeenCalledWith(
        'user-456',
        'test',
        {
          netVotes: 3,
          isVisible: undefined,
        },
      );
      expect(result).toBe(true);
    });

    it('should work for anonymous users', async () => {
      wordSchema.findById.mockResolvedValue(mockWordData);
      visibilityService.getObjectVisibility.mockResolvedValue(true);

      const result = await service.getVisibilityForUser('test');

      expect(visibilityService.getObjectVisibility).toHaveBeenCalledWith(
        null,
        'test',
        expect.any(Object),
      );
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if word not found', async () => {
      wordSchema.findById.mockResolvedValue(null);

      await expect(
        service.getVisibilityForUser('nonexistent', 'user-456'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if wordId is empty', async () => {
      await expect(
        service.getVisibilityForUser('', 'user-456'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  describe('checkWordExistence', () => {
    it('should check word existence via schema', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(true);

      const result = await service.checkWordExistence('test');

      expect(wordSchema.checkWordExistence).toHaveBeenCalledWith('test');
      expect(result).toBe(true);
    });

    it('should return false for non-existent word', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(false);

      const result = await service.checkWordExistence('nonexistent');

      expect(result).toBe(false);
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(service.checkWordExistence('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getAllWords', () => {
    it('should get all words via schema', async () => {
      const mockWords = [
        {
          ...mockWordData,
        },
      ];
      wordSchema.getAllWords.mockResolvedValue(mockWords);

      const result = await service.getAllWords();

      expect(wordSchema.getAllWords).toHaveBeenCalled();
      expect(result).toEqual(mockWords);
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      wordSchema.getAllWords.mockRejectedValue(new Error('DB error'));

      await expect(service.getAllWords()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getApprovedWords', () => {
    it('should get approved words with default options', async () => {
      const mockWords = [
        {
          ...mockWordData,
        },
      ];
      wordSchema.getApprovedWords.mockResolvedValue(mockWords);

      const result = await service.getApprovedWords();

      expect(wordSchema.getApprovedWords).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockWords);
    });

    it('should get approved words with pagination', async () => {
      const mockWords = [
        {
          ...mockWordData,
        },
      ];
      wordSchema.getApprovedWords.mockResolvedValue(mockWords);
      const options = { limit: 10, offset: 20 };

      const result = await service.getApprovedWords(options);

      expect(wordSchema.getApprovedWords).toHaveBeenCalledWith({
        limit: 10,
        offset: 20,
        sortDirection: undefined,
      });
      expect(result).toEqual(mockWords);
    });

    it('should convert sort direction to uppercase', async () => {
      const mockWords = [
        {
          ...mockWordData,
        },
      ];
      wordSchema.getApprovedWords.mockResolvedValue(mockWords);
      const options = {
        sortBy: 'alphabetical' as const,
        sortDirection: 'asc' as const,
      };

      await service.getApprovedWords(options);

      expect(wordSchema.getApprovedWords).toHaveBeenCalledWith({
        sortBy: 'alphabetical',
        sortDirection: 'ASC',
      });
    });

    it('should handle DESC sort direction', async () => {
      const mockWords = [
        {
          ...mockWordData,
        },
      ];
      wordSchema.getApprovedWords.mockResolvedValue(mockWords);
      const options = { sortDirection: 'desc' as const };

      await service.getApprovedWords(options);

      expect(wordSchema.getApprovedWords).toHaveBeenCalledWith({
        sortDirection: 'DESC',
      });
    });
  });

  describe('checkWords', () => {
    it('should get word count via schema', async () => {
      wordSchema.checkWords.mockResolvedValue({ count: 42 });

      const result = await service.checkWords();

      expect(wordSchema.checkWords).toHaveBeenCalled();
      expect(result).toEqual({ count: 42 });
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      wordSchema.checkWords.mockRejectedValue(new Error('DB error'));

      await expect(service.checkWords()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('isWordAvailableForDefinitionCreation', () => {
    it('should check availability via schema', async () => {
      wordSchema.isWordAvailableForDefinitionCreation.mockResolvedValue(true);

      const result = await service.isWordAvailableForDefinitionCreation('test');

      expect(
        wordSchema.isWordAvailableForDefinitionCreation,
      ).toHaveBeenCalledWith('test');
      expect(result).toBe(true);
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(
        service.isWordAvailableForDefinitionCreation(''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on schema error', async () => {
      wordSchema.isWordAvailableForDefinitionCreation.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        service.isWordAvailableForDefinitionCreation('test'),
      ).rejects.toThrow(InternalServerErrorException);
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
      wordSchema.checkWordExistence.mockResolvedValue(false);
      wordSchema.createWord.mockResolvedValue({
        word: mockWordData,
        definition: undefined,
      } as any);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createWord({
        word: 'test',
        createdBy: 'user-123',
        initialComment: 'Test comment',
      });

      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: 'test',
        nodeType: 'WordNode',
        nodeIdField: 'word', // ✅ CRITICAL: Uses 'word' not 'id'
        createdBy: 'user-123',
        initialComment: 'Test comment',
      });
    });

    it('should use nodeIdField: "word" for discussions', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(false);
      wordSchema.createWord.mockResolvedValue({
        word: mockWordData,
        definition: undefined,
      } as any);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createWord({
        word: 'test',
        createdBy: 'user-123',
        initialComment: 'Comment',
      });

      const callArgs =
        discussionSchema.createDiscussionForNode.mock.calls[0][0];
      expect(callArgs.nodeIdField).toBe('word'); // Not 'id'
    });

    it('should only create discussion if initialComment provided', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(false);
      wordSchema.createWord.mockResolvedValue({
        word: mockWordData,
        definition: undefined,
      } as any);

      // Without initialComment
      await service.createWord({
        word: 'test',
        createdBy: 'user-123',
      });

      expect(discussionSchema.createDiscussionForNode).not.toHaveBeenCalled();
    });

    it('should continue if discussion creation fails', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(false);
      wordSchema.createWord.mockResolvedValue({
        word: mockWordData,
        definition: undefined,
      } as any);
      discussionSchema.createDiscussionForNode.mockRejectedValue(
        new Error('Discussion failed'),
      );

      // Should not throw
      const result = await service.createWord({
        word: 'test',
        createdBy: 'user-123',
        initialComment: 'Comment',
      });

      expect(result).toEqual(mockWordData);
    });
  });

  // ============================================
  // GRAPH EXPANSION (Phase 2b)
  // ============================================

  describe('getWordWithDefinitionsForGraph', () => {
    it('should get word with definitions for graph visualization', async () => {
      const mockDefinitions = [
        {
          id: 'def-1',
          word: 'test', // ✅ ADDED: Required by DefinitionData
          definitionText: 'First definition',
          createdBy: 'user-1',
          publicCredit: true,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          inclusionPositiveVotes: 5,
          inclusionNegativeVotes: 1,
          inclusionNetVotes: 4,
          contentPositiveVotes: 3,
          contentNegativeVotes: 0,
          contentNetVotes: 3,
          discussionId: 'disc-1',
        },
        {
          id: 'def-2',
          word: 'test', // ✅ ADDED: Required by DefinitionData
          definitionText: 'Second definition',
          createdBy: 'user-2',
          publicCredit: true,
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          inclusionPositiveVotes: 8,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 6,
          contentPositiveVotes: 5,
          contentNegativeVotes: 1,
          contentNetVotes: 4,
          discussionId: 'disc-2',
        },
      ];

      wordSchema.findById.mockResolvedValue(mockWordData);
      definitionService.getDefinitionsByWord.mockResolvedValue(mockDefinitions);

      const result = await service.getWordWithDefinitionsForGraph('test', {
        sortBy: 'votes',
        userId: 'user-123',
      });

      expect(wordSchema.findById).toHaveBeenCalledWith('test');
      expect(definitionService.getDefinitionsByWord).toHaveBeenCalledWith(
        'test',
      );

      // Verify response structure
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('relationships');
      expect(result).toHaveProperty('performance_metrics');

      // Verify nodes: 1 word + 2 definitions = 3 nodes
      expect(result.nodes).toHaveLength(3);

      // Verify word node
      const wordNode = result.nodes.find((n) => n.id === 'test');
      expect(wordNode).toBeDefined();
      expect(wordNode?.type).toBe('word');
      expect(wordNode?.content).toBe('test');

      // Verify definition nodes
      const defNodes = result.nodes.filter((n) => n.type === 'definition');
      expect(defNodes).toHaveLength(2);

      // Verify relationships: 2 DEFINES relationships
      expect(result.relationships).toHaveLength(2);
      expect(result.relationships[0].type).toBe('defines');
      expect(result.relationships[0].source).toBe('def-1');
      expect(result.relationships[0].target).toBe('test');

      // Verify performance metrics
      expect(result.performance_metrics.node_count).toBe(3);
      expect(result.performance_metrics.relationship_count).toBe(2);
      expect(result.performance_metrics.relationship_density).toBeCloseTo(
        0.67,
        2,
      );
    });

    it('should handle word not found', async () => {
      wordSchema.findById.mockResolvedValue(null);

      await expect(
        service.getWordWithDefinitionsForGraph('nonexistent', {}),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getWordWithDefinitionsForGraph('nonexistent', {}),
      ).rejects.toThrow("Word 'nonexistent' not found");
    });

    it('should handle word with no definitions', async () => {
      wordSchema.findById.mockResolvedValue(mockWordData);
      definitionService.getDefinitionsByWord.mockResolvedValue([]);

      const result = await service.getWordWithDefinitionsForGraph('test', {});

      expect(result.nodes).toHaveLength(1); // Just the word node
      expect(result.relationships).toHaveLength(0); // No relationships
      expect(result.performance_metrics.node_count).toBe(1);
      expect(result.performance_metrics.relationship_count).toBe(0);
    });

    it('should work without userId', async () => {
      wordSchema.findById.mockResolvedValue(mockWordData);
      definitionService.getDefinitionsByWord.mockResolvedValue([]);

      const result = await service.getWordWithDefinitionsForGraph('test', {
        sortBy: 'alphabetical',
      });

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(1);
    });
  });

  // ============================================
  // ERROR HANDLING
  // ============================================

  describe('Error Handling', () => {
    it('should preserve BadRequestException from service', async () => {
      await expect(service.getWord('')).rejects.toThrow(BadRequestException);
    });

    it('should preserve NotFoundException from service', async () => {
      wordSchema.update.mockResolvedValue(null);
      await expect(service.updateWord('test', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve ConflictException from service', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(true);
      await expect(
        service.createWord({ word: 'test', createdBy: 'user-123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      wordSchema.findById.mockRejectedValue(new Error('Unknown error'));
      await expect(service.getWord('test')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should include error messages in wrapped exceptions', async () => {
      wordSchema.checkWordExistence.mockRejectedValue(
        new Error('DB connection failed'),
      );

      await expect(
        service.createWord({ word: 'test', createdBy: 'user-123' }),
      ).rejects.toThrow('Failed to create word: DB connection failed');
    });
  });
});
