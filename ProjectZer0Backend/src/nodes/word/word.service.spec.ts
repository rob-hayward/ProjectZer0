// src/nodes/word/word.service.spec.ts - COMPLETE WITH TYPE FIXES

import { Test, TestingModule } from '@nestjs/testing';
import { WordService } from './word.service';
import { WordSchema } from '../../neo4j/schemas/word.schema';
import { DictionaryService } from '../../dictionary/dictionary.service';
import { DiscussionService } from '../discussion/discussion.service';
import { VisibilityService } from '../../users/visibility/visibility.service';
import { HttpException, NotFoundException, Logger } from '@nestjs/common';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';
import type { VisibilityPreference } from '../../users/dto/visibility.dto';
import type { DiscussionData } from '../../neo4j/schemas/discussion.schema';

describe('WordService with BaseNodeSchema + VisibilityService Integration', () => {
  let service: WordService;
  let wordSchema: jest.Mocked<WordSchema>;
  let dictionaryService: jest.Mocked<DictionaryService>;
  let discussionService: jest.Mocked<DiscussionService>;
  let visibilityService: jest.Mocked<VisibilityService>;

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 6,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 4,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree' as const,
    inclusionPositiveVotes: 6,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 4,
    contentStatus: null,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockWordData = {
    id: 'test',
    word: 'test',
    createdBy: 'user-123',
    publicCredit: true,
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
    definitions: [
      { id: 'def-1', definitionText: 'First definition' },
      { id: 'def-2', definitionText: 'Second definition' },
    ],
  };

  // ✅ FIXED: Complete DiscussionData objects

  beforeEach(async () => {
    wordSchema = {
      checkWordExistence: jest.fn(),
      createWord: jest.fn(),
      getWord: jest.fn(),
      getAllWords: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      voteInclusion: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
      findById: jest.fn(),
      addDefinition: jest.fn(),
      updateWordWithDiscussionId: jest.fn(),
      isWordAvailableForDefinitionCreation: jest.fn(),
      isWordAvailableForCategoryComposition: jest.fn(),
      getApprovedWords: jest.fn(),
      checkWords: jest.fn(),
    } as any;

    dictionaryService = {
      getDefinition: jest.fn(),
    } as any;

    discussionService = {
      createDiscussion: jest.fn(),
      getDiscussion: jest.fn(),
    } as any;

    visibilityService = {
      setUserVisibilityPreference: jest.fn(),
      getObjectVisibility: jest.fn(),
      getUserVisibilityPreferences: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordService,
        {
          provide: WordSchema,
          useValue: wordSchema,
        },
        {
          provide: DictionaryService,
          useValue: dictionaryService,
        },
        {
          provide: DiscussionService,
          useValue: discussionService,
        },
        {
          provide: VisibilityService,
          useValue: visibilityService,
        },
        {
          provide: Logger,
          useFactory: () => ({
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          }),
        },
      ],
    }).compile();

    service = module.get<WordService>(WordService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // INHERITED VOTING FUNCTIONALITY TESTS
  describe('Voting Integration with BaseNodeSchema', () => {
    describe('voteWord', () => {
      it('should call inherited voteInclusion method', async () => {
        wordSchema.voteInclusion.mockResolvedValue(mockVoteResult);

        const result = await service.voteWord('test', 'user-456', true);

        expect(wordSchema.voteInclusion).toHaveBeenCalledWith(
          'test',
          'user-456',
          true,
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate inputs', async () => {
        await expect(service.voteWord('', 'user-456', true)).rejects.toThrow(
          HttpException,
        );
        await expect(service.voteWord('test', '', true)).rejects.toThrow(
          HttpException,
        );
        expect(wordSchema.voteInclusion).not.toHaveBeenCalled();
      });

      it('should handle voting errors gracefully', async () => {
        wordSchema.voteInclusion.mockRejectedValue(new Error('Vote failed'));

        await expect(
          service.voteWord('test', 'user-456', true),
        ).rejects.toThrow(HttpException);
      });
    });

    describe('getWordVotes', () => {
      it('should call inherited getVotes method', async () => {
        wordSchema.getVotes.mockResolvedValue(mockVoteResult);

        const result = await service.getWordVotes('test');

        expect(wordSchema.getVotes).toHaveBeenCalledWith('test');
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate word input', async () => {
        await expect(service.getWordVotes('')).rejects.toThrow(HttpException);
        expect(wordSchema.getVotes).not.toHaveBeenCalled();
      });
    });

    describe('getWordVoteStatus', () => {
      it('should call inherited getVoteStatus method', async () => {
        wordSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await service.getWordVoteStatus('test', 'user-456');

        expect(wordSchema.getVoteStatus).toHaveBeenCalledWith(
          'test',
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should validate inputs', async () => {
        await expect(service.getWordVoteStatus('', 'user-456')).rejects.toThrow(
          HttpException,
        );
        await expect(service.getWordVoteStatus('test', '')).rejects.toThrow(
          HttpException,
        );
        expect(wordSchema.getVoteStatus).not.toHaveBeenCalled();
      });
    });

    describe('removeWordVote', () => {
      it('should call inherited removeVote method with INCLUSION kind', async () => {
        wordSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await service.removeWordVote('test', 'user-456');

        expect(wordSchema.removeVote).toHaveBeenCalledWith(
          'test',
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate inputs', async () => {
        await expect(service.removeWordVote('', 'user-456')).rejects.toThrow(
          HttpException,
        );
        await expect(service.removeWordVote('test', '')).rejects.toThrow(
          HttpException,
        );
        expect(wordSchema.removeVote).not.toHaveBeenCalled();
      });
    });
  });

  // VISIBILITY INTEGRATION TESTS
  describe('Visibility Integration with VisibilityService', () => {
    describe('setWordVisibilityPreference', () => {
      it('should call VisibilityService.setUserVisibilityPreference', async () => {
        const mockVisibilityPreference: VisibilityPreference = {
          isVisible: true,
          source: 'user' as const,
          timestamp: Date.now(),
        };
        visibilityService.setUserVisibilityPreference.mockResolvedValue(
          mockVisibilityPreference,
        );

        const result = await service.setWordVisibilityPreference(
          'user-456',
          'word-123',
          true,
        );

        expect(
          visibilityService.setUserVisibilityPreference,
        ).toHaveBeenCalledWith('user-456', 'word-123', true);
        expect(result).toEqual(mockVisibilityPreference);
      });

      it('should validate inputs', async () => {
        await expect(
          service.setWordVisibilityPreference('', 'word-123', true),
        ).rejects.toThrow(HttpException);
        await expect(
          service.setWordVisibilityPreference('user-456', '', true),
        ).rejects.toThrow(HttpException);
        expect(
          visibilityService.setUserVisibilityPreference,
        ).not.toHaveBeenCalled();
      });

      it('should handle visibility service errors', async () => {
        visibilityService.setUserVisibilityPreference.mockRejectedValue(
          new Error('Visibility error'),
        );

        await expect(
          service.setWordVisibilityPreference('user-456', 'word-123', true),
        ).rejects.toThrow(HttpException);
      });
    });

    describe('getWordVisibilityForUser', () => {
      it('should get word data and call VisibilityService.getObjectVisibility', async () => {
        wordSchema.findById.mockResolvedValue(mockWordData);
        visibilityService.getObjectVisibility.mockResolvedValue(true);

        const result = await service.getWordVisibilityForUser(
          'word-123',
          'user-456',
        );

        expect(wordSchema.findById).toHaveBeenCalledWith('word-123');
        expect(visibilityService.getObjectVisibility).toHaveBeenCalledWith(
          'user-456',
          'word-123',
          {
            netVotes: mockWordData.inclusionNetVotes,
            isVisible: undefined,
          },
        );
        expect(result).toBe(true);
      });

      it('should handle anonymous users (null userId)', async () => {
        wordSchema.findById.mockResolvedValue(mockWordData);
        visibilityService.getObjectVisibility.mockResolvedValue(false);

        const result = await service.getWordVisibilityForUser('word-123');

        expect(visibilityService.getObjectVisibility).toHaveBeenCalledWith(
          null,
          'word-123',
          {
            netVotes: mockWordData.inclusionNetVotes,
            isVisible: undefined,
          },
        );
        expect(result).toBe(false);
      });

      it('should throw NotFoundException when word not found', async () => {
        wordSchema.findById.mockResolvedValue(null);

        await expect(
          service.getWordVisibilityForUser('nonexistent'),
        ).rejects.toThrow(NotFoundException);
        expect(visibilityService.getObjectVisibility).not.toHaveBeenCalled();
      });

      it('should validate word ID input', async () => {
        await expect(service.getWordVisibilityForUser('')).rejects.toThrow(
          HttpException,
        );
        expect(wordSchema.findById).not.toHaveBeenCalled();
      });
    });

    describe('getWordWithVisibility', () => {
      it('should return word with visibility information', async () => {
        wordSchema.getWord.mockResolvedValue(mockWordData);
        visibilityService.getObjectVisibility.mockResolvedValue(true);

        const result = await service.getWordWithVisibility('test', 'user-456');

        expect(wordSchema.getWord).toHaveBeenCalledWith('test');
        expect(visibilityService.getObjectVisibility).toHaveBeenCalledWith(
          'user-456',
          'test',
          {
            netVotes: mockWordData.inclusionNetVotes,
            isVisible: undefined,
          },
        );
        expect(result).toEqual({ ...mockWordData, isVisible: true });
      });

      it('should return null when word not found', async () => {
        wordSchema.getWord.mockResolvedValue(null);

        const result = await service.getWordWithVisibility('nonexistent');

        expect(result).toBeNull();
        expect(visibilityService.getObjectVisibility).not.toHaveBeenCalled();
      });

      it('should handle visibility errors gracefully', async () => {
        wordSchema.getWord.mockResolvedValue(mockWordData);
        visibilityService.getObjectVisibility.mockRejectedValue(
          new Error('Visibility error'),
        );

        const result = await service.getWordWithVisibility('test');

        expect(result).toEqual({ ...mockWordData, isVisible: true });
      });
    });
  });

  // WORD-SPECIFIC FUNCTIONALITY TESTS
  describe('Word-Specific Functionality', () => {
    describe('checkWordExistence', () => {
      it('should call schema.checkWordExistence', async () => {
        wordSchema.checkWordExistence.mockResolvedValue(true);

        const result = await service.checkWordExistence('test');

        expect(wordSchema.checkWordExistence).toHaveBeenCalledWith('test');
        expect(result).toBe(true);
      });

      it('should validate word input', async () => {
        await expect(service.checkWordExistence('')).rejects.toThrow(
          HttpException,
        );
        expect(wordSchema.checkWordExistence).not.toHaveBeenCalled();
      });

      it('should handle schema errors gracefully', async () => {
        wordSchema.checkWordExistence.mockRejectedValue(
          new Error('Database error'),
        );

        await expect(service.checkWordExistence('test')).rejects.toThrow(
          HttpException,
        );
      });
    });

    describe('createWord', () => {
      const mockCreateData = {
        word: 'test',
        createdBy: 'user-123',
        definitionText: 'User definition',
        publicCredit: true,
      };

      beforeEach(() => {
        wordSchema.checkWordExistence.mockResolvedValue(false);
        wordSchema.createWord.mockResolvedValue({
          word: { id: 'word-123', word: 'test' },
          definition: { id: 'def-123' },
        });
        wordSchema.getWord.mockResolvedValue(mockWordData);
      });

      it('should create word with API definition as alternative when different from user definition', async () => {
        dictionaryService.getDefinition.mockResolvedValue('API definition');
        wordSchema.addDefinition.mockResolvedValue({
          id: 'def-api',
          definitionText: 'API definition',
        });

        const result = await service.createWord(mockCreateData);

        expect(wordSchema.checkWordExistence).toHaveBeenCalledWith('test');
        expect(dictionaryService.getDefinition).toHaveBeenCalledWith('test');
        expect(wordSchema.createWord).toHaveBeenCalledWith({
          word: 'test',
          createdBy: 'user-123',
          initialDefinition: 'User definition',
          publicCredit: true,
        });
        expect(wordSchema.addDefinition).toHaveBeenCalledWith({
          word: 'test',
          createdBy: 'FreeDictionaryAPI',
          definitionText: 'API definition',
          publicCredit: true,
        });
        expect(result).toEqual(mockWordData);
      });

      it('should use API definition as primary when no user definition provided', async () => {
        dictionaryService.getDefinition.mockResolvedValue('API definition');
        const createDataWithoutDefinition = {
          ...mockCreateData,
          definitionText: undefined,
        };

        await service.createWord(createDataWithoutDefinition);

        expect(wordSchema.createWord).toHaveBeenCalledWith({
          word: 'test',
          createdBy: 'user-123',
          initialDefinition: 'API definition',
          publicCredit: true,
        });
        expect(wordSchema.addDefinition).not.toHaveBeenCalled();
      });

      it('should continue when API definition fetch fails', async () => {
        dictionaryService.getDefinition.mockRejectedValue(
          new Error('API unavailable'),
        );

        await service.createWord(mockCreateData);

        expect(wordSchema.createWord).toHaveBeenCalledWith({
          word: 'test',
          createdBy: 'user-123',
          initialDefinition: 'User definition',
          publicCredit: true,
        });
        expect(wordSchema.addDefinition).not.toHaveBeenCalled();
      });

      it('should create discussion when provided', async () => {
        dictionaryService.getDefinition.mockResolvedValue('API definition');
        // ✅ FIXED: Complete DiscussionData mock
        discussionService.createDiscussion.mockResolvedValue({
          id: 'discussion-123',
          createdBy: 'user-123',
          associatedNodeId: 'word-123',
          associatedNodeType: 'WordNode',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        wordSchema.updateWordWithDiscussionId.mockResolvedValue({});

        const createDataWithDiscussion = {
          ...mockCreateData,
          discussion: 'Initial discussion comment',
        };

        await service.createWord(createDataWithDiscussion);

        expect(discussionService.createDiscussion).toHaveBeenCalledWith({
          createdBy: 'user-123',
          associatedNodeId: 'word-123',
          associatedNodeType: 'WordNode',
          initialComment: 'Initial discussion comment',
        });
        expect(wordSchema.updateWordWithDiscussionId).toHaveBeenCalledWith(
          'word-123',
          'discussion-123',
        );
      });

      it('should continue when discussion creation fails', async () => {
        dictionaryService.getDefinition.mockResolvedValue('API definition');
        discussionService.createDiscussion.mockRejectedValue(
          new Error('Discussion failed'),
        );

        const createDataWithDiscussion = {
          ...mockCreateData,
          discussion: 'Initial discussion comment',
        };

        const result = await service.createWord(createDataWithDiscussion);
        expect(result).toEqual(mockWordData);
      });

      it('should throw ConflictException when word already exists', async () => {
        wordSchema.checkWordExistence.mockResolvedValue(true);

        await expect(service.createWord(mockCreateData)).rejects.toThrow(
          'Word already exists',
        );
        expect(wordSchema.createWord).not.toHaveBeenCalled();
      });

      it('should validate word input', async () => {
        await expect(
          service.createWord({ ...mockCreateData, word: '' }),
        ).rejects.toThrow(HttpException);
        expect(wordSchema.checkWordExistence).not.toHaveBeenCalled();
      });
    });

    describe('getWord', () => {
      it('should get word and fetch discussion if available', async () => {
        const wordWithDiscussion = {
          ...mockWordData,
          discussionId: 'discussion-123',
        };
        // ✅ FIXED: Complete DiscussionData mock
        const mockDiscussion: DiscussionData = {
          id: 'discussion-123',
          createdBy: 'user-123',
          associatedNodeId: 'word-123',
          associatedNodeType: 'WordNode',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        wordSchema.getWord.mockResolvedValue(wordWithDiscussion);
        discussionService.getDiscussion.mockResolvedValue(mockDiscussion);

        const result = await service.getWord('test');

        expect(wordSchema.getWord).toHaveBeenCalledWith('test');
        expect(discussionService.getDiscussion).toHaveBeenCalledWith(
          'discussion-123',
        );
        expect(result).toEqual({
          ...wordWithDiscussion,
          discussion: mockDiscussion,
        });
      });

      it('should return word without discussion when no discussionId', async () => {
        wordSchema.getWord.mockResolvedValue(mockWordData);

        const result = await service.getWord('test');

        expect(wordSchema.getWord).toHaveBeenCalledWith('test');
        expect(discussionService.getDiscussion).not.toHaveBeenCalled();
        expect(result).toEqual(mockWordData);
      });

      it('should return null when word not found', async () => {
        wordSchema.getWord.mockResolvedValue(null);

        const result = await service.getWord('nonexistent');

        expect(result).toBeNull();
      });

      it('should validate word input', async () => {
        await expect(service.getWord('')).rejects.toThrow(HttpException);
        expect(wordSchema.getWord).not.toHaveBeenCalled();
      });
    });

    describe('getAllWords', () => {
      it('should call schema.getAllWords', async () => {
        const mockWords = [mockWordData, { ...mockWordData, word: 'test2' }];
        wordSchema.getAllWords.mockResolvedValue(mockWords);

        const result = await service.getAllWords();

        expect(wordSchema.getAllWords).toHaveBeenCalled();
        expect(result).toEqual(mockWords);
      });

      it('should handle schema errors gracefully', async () => {
        wordSchema.getAllWords.mockRejectedValue(new Error('Database error'));

        await expect(service.getAllWords()).rejects.toThrow(HttpException);
      });
    });

    describe('updateWord', () => {
      it('should call inherited update method', async () => {
        const updateData = { publicCredit: false };
        const updatedWord = { ...mockWordData, publicCredit: false };
        wordSchema.update.mockResolvedValue(updatedWord);

        const result = await service.updateWord('test', updateData);

        expect(wordSchema.update).toHaveBeenCalledWith('test', updateData);
        expect(result).toEqual(updatedWord);
      });

      it('should throw NotFoundException when word not found', async () => {
        wordSchema.update.mockResolvedValue(null);

        await expect(
          service.updateWord('nonexistent', { publicCredit: false }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should validate word input', async () => {
        await expect(
          service.updateWord('', { publicCredit: false }),
        ).rejects.toThrow(HttpException);
        expect(wordSchema.update).not.toHaveBeenCalled();
      });
    });

    describe('deleteWord', () => {
      it('should call inherited delete method', async () => {
        wordSchema.delete.mockResolvedValue({ success: true });

        const result = await service.deleteWord('test');

        expect(wordSchema.delete).toHaveBeenCalledWith('test');
        expect(result).toEqual({ success: true });
      });

      it('should validate word input', async () => {
        await expect(service.deleteWord('')).rejects.toThrow(HttpException);
        expect(wordSchema.delete).not.toHaveBeenCalled();
      });
    });

    describe('addDefinition', () => {
      const mockDefinitionData = {
        word: 'test',
        createdBy: 'user-123',
        definitionText: 'New definition',
        publicCredit: true,
      };

      it('should call schema.addDefinition', async () => {
        const mockDefinition = { id: 'def-123', ...mockDefinitionData };
        wordSchema.addDefinition.mockResolvedValue(mockDefinition);

        const result = await service.addDefinition(mockDefinitionData);

        expect(wordSchema.addDefinition).toHaveBeenCalledWith(
          mockDefinitionData,
        );
        expect(result).toEqual(mockDefinition);
      });

      it('should validate inputs', async () => {
        await expect(
          service.addDefinition({ ...mockDefinitionData, word: '' }),
        ).rejects.toThrow(HttpException);
        await expect(
          service.addDefinition({
            ...mockDefinitionData,
            definitionText: '',
          }),
        ).rejects.toThrow(HttpException);
        expect(wordSchema.addDefinition).not.toHaveBeenCalled();
      });
    });

    describe('availability methods', () => {
      describe('isWordAvailableForDefinitionCreation', () => {
        it('should call schema method', async () => {
          wordSchema.isWordAvailableForDefinitionCreation.mockResolvedValue(
            true,
          );

          const result =
            await service.isWordAvailableForDefinitionCreation('test');

          expect(
            wordSchema.isWordAvailableForDefinitionCreation,
          ).toHaveBeenCalledWith('test');
          expect(result).toBe(true);
        });

        it('should validate word input', async () => {
          await expect(
            service.isWordAvailableForDefinitionCreation(''),
          ).rejects.toThrow(HttpException);
        });
      });

      describe('isWordAvailableForCategoryComposition', () => {
        it('should call schema method', async () => {
          wordSchema.isWordAvailableForCategoryComposition.mockResolvedValue(
            true,
          );

          const result =
            await service.isWordAvailableForCategoryComposition('word-123');

          expect(
            wordSchema.isWordAvailableForCategoryComposition,
          ).toHaveBeenCalledWith('word-123');
          expect(result).toBe(true);
        });

        it('should validate word ID input', async () => {
          await expect(
            service.isWordAvailableForCategoryComposition(''),
          ).rejects.toThrow(HttpException);
        });
      });

      describe('getApprovedWords', () => {
        it('should call schema method with options', async () => {
          const mockWords = [mockWordData];
          const options = {
            limit: 50,
            sortBy: 'votes' as const,
          };
          wordSchema.getApprovedWords.mockResolvedValue(mockWords);

          const result = await service.getApprovedWords(options);

          expect(wordSchema.getApprovedWords).toHaveBeenCalledWith(options);
          expect(result).toEqual(mockWords);
        });

        it('should work without options', async () => {
          const mockWords = [mockWordData];
          wordSchema.getApprovedWords.mockResolvedValue(mockWords);

          const result = await service.getApprovedWords();

          expect(wordSchema.getApprovedWords).toHaveBeenCalledWith(undefined);
          expect(result).toEqual(mockWords);
        });
      });

      describe('checkWords', () => {
        it('should call schema method', async () => {
          wordSchema.checkWords.mockResolvedValue({ count: 156 });

          const result = await service.checkWords();

          expect(wordSchema.checkWords).toHaveBeenCalled();
          expect(result).toEqual({ count: 156 });
        });
      });
    });
  });

  // ERROR HANDLING CONSISTENCY TESTS
  describe('Error Handling', () => {
    it('should handle schema errors consistently', async () => {
      wordSchema.checkWordExistence.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.checkWordExistence('test')).rejects.toThrow(
        'Error checking if word exists',
      );
    });

    it('should handle visibility service errors consistently', async () => {
      visibilityService.setUserVisibilityPreference.mockRejectedValue(
        new Error('Visibility error'),
      );

      await expect(
        service.setWordVisibilityPreference('user-456', 'word-123', true),
      ).rejects.toThrow('Failed to set word visibility preference');
    });
  });

  // INTEGRATION TESTS
  describe('Integration Tests', () => {
    it('should handle complete word creation flow with all services', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(false);
      dictionaryService.getDefinition.mockResolvedValue('API definition');
      wordSchema.createWord.mockResolvedValue({
        word: { id: 'word-123', word: 'test' },
        definition: { id: 'def-123' },
      });
      wordSchema.addDefinition.mockResolvedValue({
        id: 'def-api',
        definitionText: 'API definition',
      });
      // ✅ FIXED: Complete DiscussionData mock
      discussionService.createDiscussion.mockResolvedValue({
        id: 'discussion-123',
        createdBy: 'user-123',
        associatedNodeId: 'word-123',
        associatedNodeType: 'WordNode',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      wordSchema.updateWordWithDiscussionId.mockResolvedValue({});
      wordSchema.getWord.mockResolvedValue(mockWordData);

      const createData = {
        word: 'test',
        createdBy: 'user-123',
        definitionText: 'User definition',
        discussion: 'Initial comment',
        publicCredit: true,
      };

      const result = await service.createWord(createData);

      // Verify all services were called in correct order
      expect(wordSchema.checkWordExistence).toHaveBeenCalled();
      expect(dictionaryService.getDefinition).toHaveBeenCalled();
      expect(wordSchema.createWord).toHaveBeenCalled();
      expect(wordSchema.addDefinition).toHaveBeenCalled();
      expect(discussionService.createDiscussion).toHaveBeenCalled();
      expect(wordSchema.updateWordWithDiscussionId).toHaveBeenCalled();
      expect(wordSchema.getWord).toHaveBeenCalled();
      expect(result).toEqual(mockWordData);
    });

    it('should handle word retrieval with visibility for authenticated user', async () => {
      wordSchema.getWord.mockResolvedValue(mockWordData);
      visibilityService.getObjectVisibility.mockResolvedValue(true);

      const result = await service.getWordWithVisibility('test', 'user-456');

      expect(wordSchema.getWord).toHaveBeenCalledWith('test');
      expect(visibilityService.getObjectVisibility).toHaveBeenCalledWith(
        'user-456',
        'test',
        {
          netVotes: mockWordData.inclusionNetVotes,
          isVisible: undefined,
        },
      );
      expect(result).toEqual({ ...mockWordData, isVisible: true });
    });

    it('should handle voting and visibility workflow', async () => {
      // Vote on word
      wordSchema.voteInclusion.mockResolvedValue(mockVoteResult);
      const voteResult = await service.voteWord('test', 'user-456', true);
      expect(voteResult).toEqual(mockVoteResult);

      // Check vote status
      wordSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);
      const voteStatus = await service.getWordVoteStatus('test', 'user-456');
      expect(voteStatus).toEqual(mockVoteStatus);

      // Set visibility preference
      const mockVisibilityPreference: VisibilityPreference = {
        isVisible: false,
        source: 'user' as const,
        timestamp: Date.now(),
      };
      visibilityService.setUserVisibilityPreference.mockResolvedValue(
        mockVisibilityPreference,
      );
      const visibilityResult = await service.setWordVisibilityPreference(
        'user-456',
        'word-123',
        false,
      );
      expect(visibilityResult).toEqual(mockVisibilityPreference);

      // Get word with visibility
      wordSchema.findById.mockResolvedValue(mockWordData);
      visibilityService.getObjectVisibility.mockResolvedValue(false);
      const finalVisibility = await service.getWordVisibilityForUser(
        'word-123',
        'user-456',
      );
      expect(finalVisibility).toBe(false);
    });
  });

  // BACKWARD COMPATIBILITY TESTS
  describe('API Compatibility', () => {
    it('should maintain existing external API structure', async () => {
      // Ensure service methods return expected structures for external consumers
      wordSchema.checkWordExistence.mockResolvedValue(true);
      const existsResult = await service.checkWordExistence('test');
      expect(typeof existsResult).toBe('boolean');

      wordSchema.getWord.mockResolvedValue(mockWordData);
      const wordResult = await service.getWord('test');
      expect(wordResult).toHaveProperty('word');
      expect(wordResult).toHaveProperty('inclusionNetVotes');

      wordSchema.voteInclusion.mockResolvedValue(mockVoteResult);
      const voteResult = await service.voteWord('test', 'user-456', true);
      expect(voteResult).toHaveProperty('inclusionPositiveVotes');
      expect(voteResult).toHaveProperty('inclusionNegativeVotes');
      expect(voteResult).toHaveProperty('inclusionNetVotes');
    });

    it('should maintain error response formats', async () => {
      // Test that error responses maintain expected HTTP status codes
      await expect(service.checkWordExistence('')).rejects.toMatchObject({
        status: 400,
        message: 'Word cannot be empty',
      });

      wordSchema.update.mockResolvedValue(null);
      await expect(
        service.updateWord('nonexistent', { publicCredit: false }),
      ).rejects.toMatchObject({
        status: 404,
        message: expect.stringContaining('not found'),
      });
    });
  });

  // REMOVED FUNCTIONALITY VERIFICATION
  describe('Removed Legacy Methods', () => {
    it('should not have old voting method signatures', () => {
      // Verify old methods are not present
      expect((service as any).voteWordInclusion).toBeUndefined();
      expect((service as any).getWordVotingData).toBeUndefined();
    });

    it('should not have old visibility method signatures', () => {
      // Verify old visibility methods are not present
      expect((service as any).setWordVisibilityStatus).toBeUndefined();
      expect((service as any).getWordVisibilityStatus).toBeUndefined();
    });

    it('should have new method signatures for voting', () => {
      // Verify new methods exist and have correct signatures
      expect(typeof service.voteWord).toBe('function');
      expect(service.voteWord.length).toBe(3); // word, userId, isPositive

      expect(typeof service.getWordVoteStatus).toBe('function');
      expect(service.getWordVoteStatus.length).toBe(2); // word, userId

      expect(typeof service.removeWordVote).toBe('function');
      expect(service.removeWordVote.length).toBe(2); // word, userId
    });

    it('should have new method signatures for visibility', () => {
      // Verify new visibility methods exist
      expect(typeof service.setWordVisibilityPreference).toBe('function');
      expect(service.setWordVisibilityPreference.length).toBe(3); // userId, wordId, isVisible

      expect(typeof service.getWordVisibilityForUser).toBe('function');
      expect(service.getWordVisibilityForUser.length).toBe(2); // wordId, userId?

      expect(typeof service.getWordWithVisibility).toBe('function');
      expect(service.getWordWithVisibility.length).toBe(2); // word, userId?
    });
  });
});
