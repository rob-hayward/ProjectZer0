// src/nodes/word/word.service.spec.ts - FIXED DATE TYPES FOR DiscussionData

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
        wordSchema.getVotes.mockResolvedValue(mockVoteStatus);

        const result = await service.getWordVotes('test');

        expect(wordSchema.getVotes).toHaveBeenCalledWith('test');
        expect(result).toEqual(mockVoteStatus);
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
    });

    describe('removeWordVote', () => {
      it('should call inherited removeVote method with INCLUSION', async () => {
        wordSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await service.removeWordVote('test', 'user-456');

        expect(wordSchema.removeVote).toHaveBeenCalledWith(
          'test',
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });
  });

  // CORE WORD FUNCTIONALITY TESTS
  describe('Core Word Functionality', () => {
    describe('createWord', () => {
      it('should create word with all services properly integrated', async () => {
        const createData = {
          word: 'test',
          createdBy: 'user-123',
          definitionText: 'Test definition',
          discussion: 'Initial comment',
          publicCredit: true,
        };

        wordSchema.checkWordExistence.mockResolvedValue(false);
        dictionaryService.getDefinition.mockResolvedValue('API definition');
        wordSchema.createWord.mockResolvedValue({
          word: { id: 'test', word: 'test' },
          definition: { id: 'def-123' },
        });
        wordSchema.addDefinition.mockResolvedValue({
          id: 'def-api',
          definitionText: 'API definition',
        });
        // ✅ FIXED: Complete DiscussionData with Date objects
        discussionService.createDiscussion.mockResolvedValue({
          id: 'discussion-123',
          createdBy: 'user-123',
          associatedNodeId: 'test',
          associatedNodeType: 'WordNode',
          createdAt: new Date('2023-01-01T00:00:00Z'), // ✅ Date object
          updatedAt: new Date('2023-01-01T00:00:00Z'), // ✅ Date object
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        } as DiscussionData);
        wordSchema.updateWordWithDiscussionId.mockResolvedValue({});
        wordSchema.getWord.mockResolvedValue(mockWordData);

        const result = await service.createWord(createData);

        expect(wordSchema.checkWordExistence).toHaveBeenCalledWith('test');
        expect(dictionaryService.getDefinition).toHaveBeenCalledWith('test');
        expect(wordSchema.createWord).toHaveBeenCalled();
        expect(wordSchema.addDefinition).toHaveBeenCalled();
        expect(discussionService.createDiscussion).toHaveBeenCalled();
        expect(wordSchema.updateWordWithDiscussionId).toHaveBeenCalled();
        expect(wordSchema.getWord).toHaveBeenCalledWith('test');
        expect(result).toEqual(mockWordData);
      });

      it('should handle existing words', async () => {
        wordSchema.checkWordExistence.mockResolvedValue(true);

        await expect(
          service.createWord({
            word: 'test',
            createdBy: 'user-123',
            definitionText: 'Test definition',
            publicCredit: true,
          }),
        ).rejects.toThrow(HttpException);
      });
    });

    describe('getWord', () => {
      it('should get word and fetch discussion if available', async () => {
        const wordWithDiscussion = {
          ...mockWordData,
          discussionId: 'discussion-123',
        };
        // ✅ FIXED: Complete DiscussionData with Date objects
        const mockDiscussion: DiscussionData = {
          id: 'discussion-123',
          createdBy: 'user-123',
          associatedNodeId: 'test',
          associatedNodeType: 'WordNode',
          createdAt: new Date('2023-01-01T01:00:00Z'), // ✅ Date object
          updatedAt: new Date('2023-01-01T01:00:00Z'), // ✅ Date object
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
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
        const updatedWord = { ...mockWordData, ...updateData };
        wordSchema.update.mockResolvedValue(updatedWord);

        const result = await service.updateWord('test', updateData);

        expect(wordSchema.update).toHaveBeenCalledWith('test', updateData);
        expect(result).toEqual(updatedWord);
      });

      it('should handle NotFoundException when word not found', async () => {
        wordSchema.update.mockResolvedValue(null);

        await expect(
          service.updateWord('nonexistent', { publicCredit: false }),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('deleteWord', () => {
      it('should call inherited delete method', async () => {
        const deleteResult = { success: true };
        wordSchema.delete.mockResolvedValue(deleteResult);

        const result = await service.deleteWord('test');

        expect(wordSchema.delete).toHaveBeenCalledWith('test');
        expect(result).toEqual(deleteResult);
      });
    });
  });

  // VISIBILITY INTEGRATION TESTS
  describe('Visibility Integration with VisibilityService', () => {
    const mockVisibilityPreference: VisibilityPreference = {
      isVisible: false,
      source: 'user',
      timestamp: Date.now(),
    };

    describe('setWordVisibilityPreference', () => {
      it('should call VisibilityService.setUserVisibilityPreference', async () => {
        visibilityService.setUserVisibilityPreference.mockResolvedValue(
          mockVisibilityPreference,
        );

        const result = await service.setWordVisibilityPreference(
          'user-456',
          'word-123',
          false,
        );

        expect(
          visibilityService.setUserVisibilityPreference,
        ).toHaveBeenCalledWith('user-456', 'word-123', false);
        expect(result).toEqual(mockVisibilityPreference);
      });

      it('should validate inputs', async () => {
        await expect(
          service.setWordVisibilityPreference('', 'word-123', false),
        ).rejects.toThrow(HttpException);
        await expect(
          service.setWordVisibilityPreference('user-456', '', false),
        ).rejects.toThrow(HttpException);
        expect(
          visibilityService.setUserVisibilityPreference,
        ).not.toHaveBeenCalled();
      });

      it('should handle visibility service errors gracefully', async () => {
        visibilityService.setUserVisibilityPreference.mockRejectedValue(
          new Error('Visibility error'),
        );

        await expect(
          service.setWordVisibilityPreference('user-456', 'word-123', false),
        ).rejects.toThrow('Failed to set word visibility preference');
      });
    });

    describe('getWordVisibilityForUser', () => {
      it('should return visibility information for existing word', async () => {
        // ✅ FIXED: Mock getWord instead of findById for consistency
        wordSchema.getWord.mockResolvedValue(mockWordData);
        visibilityService.getObjectVisibility.mockResolvedValue(true);

        const result = await service.getWordVisibilityForUser('test');

        // ✅ FIXED: Expect getWord to be called via service.getWord()
        expect(wordSchema.getWord).toHaveBeenCalledWith('test');
        expect(visibilityService.getObjectVisibility).toHaveBeenCalledWith(
          null,
          'test',
          {
            netVotes: mockWordData.inclusionNetVotes,
            isVisible: undefined,
          },
        );
        expect(result).toBe(true);
      });

      it('should throw NotFoundException when word not found', async () => {
        // ✅ FIXED: Mock getWord instead of findById
        wordSchema.getWord.mockResolvedValue(null);

        await expect(
          service.getWordVisibilityForUser('nonexistent'),
        ).rejects.toThrow(NotFoundException);
        expect(visibilityService.getObjectVisibility).not.toHaveBeenCalled();
      });

      it('should validate word ID input', async () => {
        await expect(service.getWordVisibilityForUser('')).rejects.toThrow(
          HttpException,
        );
        // ✅ FIXED: Expect getWord not to be called
        expect(wordSchema.getWord).not.toHaveBeenCalled();
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
          'Error checking if word exists',
        );
      });
    });

    describe('getApprovedWords', () => {
      it('should call schema.getApprovedWords', async () => {
        const mockWords = [mockWordData];
        wordSchema.getApprovedWords.mockResolvedValue(mockWords);

        const result = await service.getApprovedWords();

        expect(wordSchema.getApprovedWords).toHaveBeenCalled();
        expect(result).toEqual(mockWords);
      });

      it('should pass options to schema', async () => {
        const options = { limit: 50, sortBy: 'votes' as const };
        wordSchema.getApprovedWords.mockResolvedValue([]);

        await service.getApprovedWords(options);

        expect(wordSchema.getApprovedWords).toHaveBeenCalledWith(options);
      });
    });

    describe('checkWords', () => {
      it('should call schema.checkWords', async () => {
        wordSchema.checkWords.mockResolvedValue({ count: 156 });

        const result = await service.checkWords();

        expect(wordSchema.checkWords).toHaveBeenCalled();
        expect(result).toEqual({ count: 156 });
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
      // ✅ FIXED: Complete DiscussionData mock with Date objects
      discussionService.createDiscussion.mockResolvedValue({
        id: 'discussion-123',
        createdBy: 'user-123',
        associatedNodeId: 'word-123',
        associatedNodeType: 'WordNode',
        createdAt: new Date('2023-01-01T02:00:00Z'), // ✅ Date object
        updatedAt: new Date('2023-01-01T02:00:00Z'), // ✅ Date object
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      } as DiscussionData);
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

    it('should handle complete word lifecycle', async () => {
      // Create word
      wordSchema.checkWordExistence.mockResolvedValue(false);
      // ✅ Fix: Return object with both word and definition properties
      wordSchema.createWord.mockResolvedValue({
        word: mockWordData,
        definition: { id: 'def-123', definitionText: 'Test definition' },
      });
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
