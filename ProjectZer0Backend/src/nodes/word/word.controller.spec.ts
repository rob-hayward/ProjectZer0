// src/nodes/word/word.controller.spec.ts - REFACTORED ARCHITECTURE TESTS

import { Test, TestingModule } from '@nestjs/testing';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('WordController - Refactored Architecture', () => {
  let controller: WordController;
  let wordService: jest.Mocked<WordService>;

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
  };

  const mockWordWithVisibility = {
    ...mockWordData,
    isVisible: true,
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

  const mockReq = { user: { sub: 'user-456' } };

  beforeEach(async () => {
    const mockWordService = {
      createWord: jest.fn(),
      getWord: jest.fn(),
      getWordWithVisibility: jest.fn(),
      updateWord: jest.fn(),
      deleteWord: jest.fn(),
      voteInclusion: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
      setVisibilityPreference: jest.fn(),
      getVisibilityForUser: jest.fn(),
      checkWordExistence: jest.fn(),
      getAllWords: jest.fn(),
      getApprovedWords: jest.fn(),
      checkWords: jest.fn(),
      isWordAvailableForDefinitionCreation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WordController],
      providers: [
        {
          provide: WordService,
          useValue: mockWordService,
        },
      ],
    }).compile();

    controller = module.get<WordController>(WordController);
    wordService = module.get(WordService) as jest.Mocked<WordService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  describe('POST /words', () => {
    const createDto = {
      word: 'test',
      createdBy: 'user-123',
      publicCredit: true,
    };

    it('should create word with all fields', async () => {
      wordService.createWord.mockResolvedValue(mockWordData);

      const result = await controller.createWord(createDto, mockReq);

      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'test',
        createdBy: 'user-456', // From req.user.sub
        publicCredit: true,
        initialDefinition: undefined,
        initialComment: undefined,
        isApiDefinition: undefined,
        isAICreated: undefined,
      });
      expect(result).toEqual(mockWordData);
    });

    it('should create word with minimal fields', async () => {
      wordService.createWord.mockResolvedValue(mockWordData);
      const minimalDto = { word: 'test', createdBy: 'ignored' };

      const result = await controller.createWord(minimalDto, mockReq);

      expect(wordService.createWord).toHaveBeenCalledWith(
        expect.objectContaining({
          word: 'test',
          createdBy: 'user-456',
        }),
      );
      expect(result).toEqual(mockWordData);
    });

    it('should create word with initial definition', async () => {
      wordService.createWord.mockResolvedValue(mockWordData);
      const dtoWithDefinition = {
        ...createDto,
        initialDefinition: 'A test word',
      };

      await controller.createWord(dtoWithDefinition, mockReq);

      expect(wordService.createWord).toHaveBeenCalledWith(
        expect.objectContaining({
          initialDefinition: 'A test word',
        }),
      );
    });

    it('should create word with initial comment', async () => {
      wordService.createWord.mockResolvedValue(mockWordData);
      const dtoWithComment = {
        ...createDto,
        initialComment: 'Initial comment',
      };

      await controller.createWord(dtoWithComment, mockReq);

      expect(wordService.createWord).toHaveBeenCalledWith(
        expect.objectContaining({
          initialComment: 'Initial comment',
        }),
      );
    });

    it('should extract user ID from req.user.sub', async () => {
      wordService.createWord.mockResolvedValue(mockWordData);

      await controller.createWord(createDto, mockReq);

      expect(wordService.createWord).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: 'user-456',
        }),
      );
    });

    it('should throw BadRequestException if word is missing', async () => {
      await expect(
        controller.createWord({ word: '', createdBy: 'user' }, mockReq),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createWord({ word: '', createdBy: 'user' }, mockReq),
      ).rejects.toThrow('Word is required');
    });

    it('should throw BadRequestException if user is missing', async () => {
      await expect(
        controller.createWord(createDto, { user: null }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createWord(createDto, { user: null }),
      ).rejects.toThrow('User ID is required');
    });

    it('should re-throw service exceptions', async () => {
      wordService.createWord.mockRejectedValue(
        new BadRequestException('Service error'),
      );

      await expect(controller.createWord(createDto, mockReq)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('GET /words/:word', () => {
    it('should get word with visibility for authenticated user', async () => {
      wordService.getWordWithVisibility.mockResolvedValue(
        mockWordWithVisibility,
      );

      const result = await controller.getWord('test', mockReq);

      expect(wordService.getWordWithVisibility).toHaveBeenCalledWith(
        'test',
        'user-456',
      );
      expect(result).toEqual(mockWordWithVisibility);
    });

    it('should get word for anonymous user', async () => {
      wordService.getWordWithVisibility.mockResolvedValue(
        mockWordWithVisibility,
      );
      const anonReq = { user: null };

      const result = await controller.getWord('test', anonReq);

      expect(wordService.getWordWithVisibility).toHaveBeenCalledWith(
        'test',
        undefined,
      );
      expect(result).toEqual(mockWordWithVisibility);
    });

    it('should convert word to lowercase', async () => {
      wordService.getWordWithVisibility.mockResolvedValue(
        mockWordWithVisibility,
      );

      await controller.getWord('TEST', mockReq);

      expect(wordService.getWordWithVisibility).toHaveBeenCalledWith(
        'test',
        'user-456',
      );
    });

    it('should throw NotFoundException if word not found', async () => {
      wordService.getWordWithVisibility.mockResolvedValue(null);

      await expect(controller.getWord('nonexistent', mockReq)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getWord('nonexistent', mockReq)).rejects.toThrow(
        `Word 'nonexistent' not found`,
      );
    });

    it('should throw BadRequestException if word parameter is empty', async () => {
      await expect(controller.getWord('', mockReq)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getWord('  ', mockReq)).rejects.toThrow(
        'Word parameter is required',
      );
    });
  });

  describe('PUT /words/:word', () => {
    const updateDto = { publicCredit: false };

    it('should update word', async () => {
      const updatedWord = { ...mockWordData, ...updateDto };
      wordService.updateWord.mockResolvedValue(updatedWord);

      const result = await controller.updateWord('test', updateDto, mockReq);

      expect(wordService.updateWord).toHaveBeenCalledWith('test', updateDto);
      expect(result).toEqual(updatedWord);
    });

    it('should throw BadRequestException if word parameter is empty', async () => {
      await expect(
        controller.updateWord('', updateDto, mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user is missing', async () => {
      await expect(
        controller.updateWord('test', updateDto, { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should re-throw service exceptions', async () => {
      wordService.updateWord.mockRejectedValue(
        new NotFoundException('Word not found'),
      );

      await expect(
        controller.updateWord('test', updateDto, mockReq),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('DELETE /words/:word', () => {
    it('should delete word', async () => {
      wordService.deleteWord.mockResolvedValue(undefined);

      await controller.deleteWord('test', mockReq);

      expect(wordService.deleteWord).toHaveBeenCalledWith('test');
    });

    it('should throw BadRequestException if word parameter is empty', async () => {
      await expect(controller.deleteWord('', mockReq)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if user is missing', async () => {
      await expect(
        controller.deleteWord('test', { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should re-throw service exceptions', async () => {
      wordService.deleteWord.mockRejectedValue(
        new NotFoundException('Word not found'),
      );

      await expect(controller.deleteWord('test', mockReq)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================
  // VOTING ENDPOINTS
  // ============================================

  describe('POST /words/:word/vote-inclusion', () => {
    const voteDto = { isPositive: true };

    it('should vote on word inclusion', async () => {
      wordService.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await controller.voteInclusion('test', voteDto, mockReq);

      expect(wordService.voteInclusion).toHaveBeenCalledWith(
        'test',
        'user-456',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should handle negative votes', async () => {
      wordService.voteInclusion.mockResolvedValue(mockVoteResult);
      const negativeVote = { isPositive: false };

      await controller.voteInclusion('test', negativeVote, mockReq);

      expect(wordService.voteInclusion).toHaveBeenCalledWith(
        'test',
        'user-456',
        false,
      );
    });

    it('should throw BadRequestException if word parameter is empty', async () => {
      await expect(
        controller.voteInclusion('', voteDto, mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user is missing', async () => {
      await expect(
        controller.voteInclusion('test', voteDto, { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if isPositive is not boolean', async () => {
      await expect(
        controller.voteInclusion(
          'test',
          { isPositive: 'true' as any },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.voteInclusion(
          'test',
          { isPositive: 'true' as any },
          mockReq,
        ),
      ).rejects.toThrow('isPositive must be a boolean');
    });

    it('should require authentication', async () => {
      await expect(
        controller.voteInclusion('test', voteDto, { user: { sub: '' } }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /words/:word/vote-status', () => {
    it('should get vote status', async () => {
      wordService.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await controller.getVoteStatus('test', mockReq);

      expect(wordService.getVoteStatus).toHaveBeenCalledWith(
        'test',
        'user-456',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should return null if no vote', async () => {
      wordService.getVoteStatus.mockResolvedValue(null);

      const result = await controller.getVoteStatus('test', mockReq);

      expect(result).toBeNull();
    });

    it('should throw BadRequestException if word parameter is empty', async () => {
      await expect(controller.getVoteStatus('', mockReq)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should require authentication', async () => {
      await expect(
        controller.getVoteStatus('test', { user: null }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('DELETE /words/:word/vote', () => {
    it('should remove vote', async () => {
      wordService.removeVote.mockResolvedValue(mockVoteResult);

      const result = await controller.removeVote('test', mockReq);

      expect(wordService.removeVote).toHaveBeenCalledWith('test', 'user-456');
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException if word parameter is empty', async () => {
      await expect(controller.removeVote('', mockReq)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should require authentication', async () => {
      await expect(
        controller.removeVote('test', { user: null }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /words/:word/votes', () => {
    it('should get vote totals', async () => {
      wordService.getVotes.mockResolvedValue(mockVoteResult);

      const result = await controller.getVotes('test');

      expect(wordService.getVotes).toHaveBeenCalledWith('test');
      expect(result).toEqual(mockVoteResult);
    });

    it('should return null if no votes', async () => {
      wordService.getVotes.mockResolvedValue(null);

      const result = await controller.getVotes('test');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException if word parameter is empty', async () => {
      await expect(controller.getVotes('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // VISIBILITY ENDPOINTS
  // ============================================

  describe('POST /words/:word/visibility', () => {
    const visibilityDto = { isVisible: false };

    it('should set visibility preference', async () => {
      wordService.setVisibilityPreference.mockResolvedValue(undefined);

      const result = await controller.setVisibilityPreference(
        'test',
        visibilityDto,
        mockReq,
      );

      expect(wordService.setVisibilityPreference).toHaveBeenCalledWith(
        'user-456',
        'test',
        false,
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle visibility true', async () => {
      wordService.setVisibilityPreference.mockResolvedValue(undefined);
      const visibleDto = { isVisible: true };

      await controller.setVisibilityPreference('test', visibleDto, mockReq);

      expect(wordService.setVisibilityPreference).toHaveBeenCalledWith(
        'user-456',
        'test',
        true,
      );
    });

    it('should throw BadRequestException if word parameter is empty', async () => {
      await expect(
        controller.setVisibilityPreference('', visibilityDto, mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user is missing', async () => {
      await expect(
        controller.setVisibilityPreference('test', visibilityDto, {
          user: null,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if isVisible is not boolean', async () => {
      await expect(
        controller.setVisibilityPreference(
          'test',
          { isVisible: 'false' as any },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.setVisibilityPreference(
          'test',
          { isVisible: 'false' as any },
          mockReq,
        ),
      ).rejects.toThrow('isVisible must be a boolean');
    });
  });

  describe('GET /words/:word/visibility', () => {
    it('should get visibility for authenticated user', async () => {
      wordService.getVisibilityForUser.mockResolvedValue(true);

      const result = await controller.getVisibility('test', mockReq);

      expect(wordService.getVisibilityForUser).toHaveBeenCalledWith(
        'test',
        'user-456',
      );
      expect(result).toEqual({ isVisible: true });
    });

    it('should get visibility for anonymous user', async () => {
      wordService.getVisibilityForUser.mockResolvedValue(true);
      const anonReq = { user: null };

      const result = await controller.getVisibility('test', anonReq);

      expect(wordService.getVisibilityForUser).toHaveBeenCalledWith(
        'test',
        undefined,
      );
      expect(result).toEqual({ isVisible: true });
    });

    it('should return false visibility', async () => {
      wordService.getVisibilityForUser.mockResolvedValue(false);

      const result = await controller.getVisibility('test', mockReq);

      expect(result).toEqual({ isVisible: false });
    });

    it('should throw BadRequestException if word parameter is empty', async () => {
      await expect(controller.getVisibility('', mockReq)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // QUERY ENDPOINTS
  // ============================================

  describe('GET /words/check/:word', () => {
    it('should check word existence', async () => {
      wordService.checkWordExistence.mockResolvedValue(true);

      const result = await controller.checkWordExistence('test');

      expect(wordService.checkWordExistence).toHaveBeenCalledWith('test');
      expect(result).toEqual({ exists: true });
    });

    it('should return false for non-existent word', async () => {
      wordService.checkWordExistence.mockResolvedValue(false);

      const result = await controller.checkWordExistence('nonexistent');

      expect(result).toEqual({ exists: false });
    });

    it('should throw BadRequestException if word parameter is empty', async () => {
      await expect(controller.checkWordExistence('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('GET /words', () => {
    it('should get all words', async () => {
      const mockWords = [mockWordData];
      wordService.getAllWords.mockResolvedValue(mockWords);

      const result = await controller.getAllWords();

      expect(wordService.getAllWords).toHaveBeenCalled();
      expect(result).toEqual(mockWords);
    });
  });

  describe('GET /words/approved/list', () => {
    it('should get approved words with default params', async () => {
      const mockWords = [mockWordData];
      wordService.getApprovedWords.mockResolvedValue(mockWords);

      const result = await controller.getApprovedWords();

      expect(wordService.getApprovedWords).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        sortBy: undefined,
        sortDirection: undefined,
      });
      expect(result).toEqual(mockWords);
    });

    it('should get approved words with pagination', async () => {
      const mockWords = [mockWordData];
      wordService.getApprovedWords.mockResolvedValue(mockWords);

      await controller.getApprovedWords('10', '20');

      expect(wordService.getApprovedWords).toHaveBeenCalledWith({
        limit: 10,
        offset: 20,
        sortBy: undefined,
        sortDirection: undefined,
      });
    });

    it('should get approved words with sorting', async () => {
      const mockWords = [mockWordData];
      wordService.getApprovedWords.mockResolvedValue(mockWords);

      await controller.getApprovedWords(
        undefined,
        undefined,
        'alphabetical',
        'asc',
      );

      expect(wordService.getApprovedWords).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        sortBy: 'alphabetical',
        sortDirection: 'asc',
      });
    });

    it('should get approved words with all params', async () => {
      const mockWords = [mockWordData];
      wordService.getApprovedWords.mockResolvedValue(mockWords);

      await controller.getApprovedWords('5', '10', 'votes', 'desc');

      expect(wordService.getApprovedWords).toHaveBeenCalledWith({
        limit: 5,
        offset: 10,
        sortBy: 'votes',
        sortDirection: 'desc',
      });
    });

    it('should throw BadRequestException for invalid limit', async () => {
      await expect(controller.getApprovedWords('invalid')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getApprovedWords('invalid')).rejects.toThrow(
        'Invalid limit parameter',
      );
    });

    it('should throw BadRequestException for invalid offset', async () => {
      await expect(
        controller.getApprovedWords('10', 'invalid'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.getApprovedWords('10', 'invalid'),
      ).rejects.toThrow('Invalid offset parameter');
    });
  });

  describe('GET /words/stats/count', () => {
    it('should get word count', async () => {
      wordService.checkWords.mockResolvedValue({ count: 42 });

      const result = await controller.checkWords();

      expect(wordService.checkWords).toHaveBeenCalled();
      expect(result).toEqual({ count: 42 });
    });
  });

  describe('GET /words/:word/available-for-definition', () => {
    it('should check if word is available for definition', async () => {
      wordService.isWordAvailableForDefinitionCreation.mockResolvedValue(true);

      const result = await controller.isAvailableForDefinition('test');

      expect(
        wordService.isWordAvailableForDefinitionCreation,
      ).toHaveBeenCalledWith('test');
      expect(result).toEqual({ available: true });
    });

    it('should return false if not available', async () => {
      wordService.isWordAvailableForDefinitionCreation.mockResolvedValue(false);

      const result = await controller.isAvailableForDefinition('test');

      expect(result).toEqual({ available: false });
    });

    it('should throw BadRequestException if word parameter is empty', async () => {
      await expect(controller.isAvailableForDefinition('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // VALIDATION
  // ============================================

  describe('Input Validation', () => {
    it('should validate all required fields in createWord', async () => {
      await expect(
        controller.createWord({ word: '', createdBy: 'user' }, mockReq),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createWord(
          { word: 'test', createdBy: 'user' },
          { user: null },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate parameter formats', async () => {
      await expect(controller.getWord('', mockReq)).rejects.toThrow(
        BadRequestException,
      );

      await expect(controller.checkWordExistence('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate query parameters', async () => {
      await expect(controller.getApprovedWords('invalid')).rejects.toThrow(
        BadRequestException,
      );

      await expect(
        controller.getApprovedWords('10', 'invalid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate body DTOs', async () => {
      await expect(
        controller.voteInclusion(
          'test',
          { isPositive: 'not-bool' as any },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.setVisibilityPreference(
          'test',
          { isVisible: 123 as any },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // AUTHENTICATION
  // ============================================

  describe('Authentication', () => {
    it('should require authentication for createWord', async () => {
      await expect(
        controller.createWord(
          { word: 'test', createdBy: 'user' },
          { user: null },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require authentication for updateWord', async () => {
      await expect(
        controller.updateWord('test', {}, { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require authentication for deleteWord', async () => {
      await expect(
        controller.deleteWord('test', { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require authentication for voting', async () => {
      await expect(
        controller.voteInclusion('test', { isPositive: true }, { user: null }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.getVoteStatus('test', { user: null }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.removeVote('test', { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require authentication for visibility preferences', async () => {
      await expect(
        controller.setVisibilityPreference(
          'test',
          { isVisible: false },
          { user: null },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow anonymous access for getWord', async () => {
      wordService.getWordWithVisibility.mockResolvedValue(
        mockWordWithVisibility,
      );

      const result = await controller.getWord('test', { user: null });

      expect(result).toEqual(mockWordWithVisibility);
    });

    it('should allow anonymous access for getVisibility', async () => {
      wordService.getVisibilityForUser.mockResolvedValue(true);

      const result = await controller.getVisibility('test', { user: null });

      expect(result).toEqual({ isVisible: true });
    });

    it('should allow anonymous access for getAllWords', async () => {
      wordService.getAllWords.mockResolvedValue([mockWordData]);

      const result = await controller.getAllWords();

      expect(result).toEqual([mockWordData]);
    });
  });

  // ============================================
  // ERROR HANDLING
  // ============================================

  describe('Error Handling', () => {
    it('should re-throw BadRequestException from service', async () => {
      wordService.createWord.mockRejectedValue(
        new BadRequestException('Invalid input'),
      );

      await expect(
        controller.createWord({ word: 'test', createdBy: 'user' }, mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('should re-throw NotFoundException from service', async () => {
      wordService.getWordWithVisibility.mockResolvedValue(null);

      await expect(controller.getWord('nonexistent', mockReq)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate all service errors', async () => {
      const serviceError = new Error('Service error');
      wordService.createWord.mockRejectedValue(serviceError);

      await expect(
        controller.createWord({ word: 'test', createdBy: 'user' }, mockReq),
      ).rejects.toThrow(serviceError);
    });

    it('should handle validation errors before calling service', async () => {
      // Empty word should be caught by controller
      await expect(
        controller.createWord({ word: '', createdBy: 'user' }, mockReq),
      ).rejects.toThrow(BadRequestException);

      // Service should not be called
      expect(wordService.createWord).not.toHaveBeenCalled();
    });
  });
});
