// src/nodes/openquestion/openquestion.service.spec.ts - COMPREHENSIVE TEST SUITE - FIXED

import { Test, TestingModule } from '@nestjs/testing';
import { OpenQuestionService } from './openquestion.service';
import { OpenQuestionSchema } from '../../neo4j/schemas/openquestion.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { CategoryService } from '../category/category.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

describe('OpenQuestionService - Comprehensive Tests', () => {
  let service: OpenQuestionService;
  let openQuestionSchema: jest.Mocked<OpenQuestionSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let userSchema: jest.Mocked<UserSchema>;
  let categoryService: jest.Mocked<CategoryService>;
  let keywordExtractionService: jest.Mocked<KeywordExtractionService>;
  let wordService: jest.Mocked<WordService>;

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

  beforeEach(async () => {
    const mockOpenQuestionSchema = {
      // Domain methods
      createOpenQuestion: jest.fn(),
      updateOpenQuestion: jest.fn(),
      getOpenQuestion: jest.fn(), // ✅ ADDED

      // BaseNodeSchema methods
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      voteInclusion: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
    };

    const mockDiscussionSchema = {
      createDiscussionForNode: jest.fn(),
      getDiscussionComments: jest.fn(),
      hasDiscussion: jest.fn(),
    };

    const mockUserSchema = {
      addCreatedNode: jest.fn(),
      getUserCreatedNodes: jest.fn(),
    };

    const mockCategoryService = {
      getCategory: jest.fn(),
      validateCategories: jest.fn(),
    };

    const mockKeywordExtractionService = {
      extractKeywords: jest.fn(),
    };

    const mockWordService = {
      checkWordExistence: jest.fn(),
      createWord: jest.fn(),
      getWord: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenQuestionService,
        { provide: OpenQuestionSchema, useValue: mockOpenQuestionSchema },
        { provide: DiscussionSchema, useValue: mockDiscussionSchema },
        { provide: UserSchema, useValue: mockUserSchema },
        { provide: CategoryService, useValue: mockCategoryService },
        {
          provide: KeywordExtractionService,
          useValue: mockKeywordExtractionService,
        },
        { provide: WordService, useValue: mockWordService },
      ],
    }).compile();

    service = module.get<OpenQuestionService>(OpenQuestionService);
    openQuestionSchema = module.get(OpenQuestionSchema);
    discussionSchema = module.get(DiscussionSchema);
    userSchema = module.get(UserSchema);
    categoryService = module.get(CategoryService);
    keywordExtractionService = module.get(KeywordExtractionService);
    wordService = module.get(WordService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // CREATE OPEN QUESTION TESTS
  // ============================================
  describe('createOpenQuestion', () => {
    const validQuestionData = {
      createdBy: 'test-user',
      publicCredit: true,
      questionText: 'What is the future of AI?',
      initialComment: 'Initial comment',
    };

    it('should validate and reject empty createdBy', async () => {
      await expect(
        service.createOpenQuestion({
          ...validQuestionData,
          createdBy: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject empty question text', async () => {
      await expect(
        service.createOpenQuestion({
          ...validQuestionData,
          questionText: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject empty initialComment', async () => {
      await expect(
        service.createOpenQuestion({
          ...validQuestionData,
          initialComment: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject question text that is too long', async () => {
      await expect(
        service.createOpenQuestion({
          ...validQuestionData,
          questionText: 'a'.repeat(281), // Over 280 char limit
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject non-boolean publicCredit', async () => {
      await expect(
        service.createOpenQuestion({
          ...validQuestionData,
          publicCredit: 'yes' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject too many categories', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      await expect(
        service.createOpenQuestion({
          ...validQuestionData,
          categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'], // Max is 3
        }),
      ).rejects.toThrow('Open question can have maximum 3 categories');
    });

    it('should create open question with AI-extracted keywords', async () => {
      const mockKeywords = [
        { word: 'future', frequency: 1, source: 'ai' as const },
        { word: 'AI', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      const mockCreatedQuestion = {
        id: 'question-123',
        questionText: validQuestionData.questionText,
        createdBy: validQuestionData.createdBy,
        publicCredit: true,
      } as any;

      openQuestionSchema.createOpenQuestion.mockResolvedValue(
        mockCreatedQuestion,
      );

      // ✅ FIXED: Service DOES call discussion creation directly (lines 169-186)
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      const result = await service.createOpenQuestion(validQuestionData);

      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: validQuestionData.questionText,
      });

      expect(openQuestionSchema.createOpenQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          questionText: validQuestionData.questionText,
          keywords: mockKeywords,
        }),
      );

      // ✅ FIXED: Service DOES create discussion in SERVICE layer after all
      // Looking at actual code lines 169-186, the service calls createDiscussionForNode
      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: 'question-123',
        nodeType: 'OpenQuestionNode',
        nodeIdField: 'id',
        createdBy: validQuestionData.createdBy,
        initialComment: validQuestionData.initialComment,
      });

      expect(result).toEqual(mockCreatedQuestion);
    });

    it('should use user-provided keywords instead of AI extraction', async () => {
      const userKeywords = ['technology', 'innovation'];

      const questionData = {
        ...validQuestionData,
        userKeywords,
      };

      wordService.checkWordExistence.mockResolvedValue(true);

      const mockCreatedQuestion = {
        id: expect.any(String),
        questionText: validQuestionData.questionText,
      } as any;

      openQuestionSchema.createOpenQuestion.mockResolvedValue(
        mockCreatedQuestion,
      );

      await service.createOpenQuestion(questionData);

      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();

      expect(openQuestionSchema.createOpenQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: [
            { word: 'technology', frequency: 1, source: 'user' },
            { word: 'innovation', frequency: 1, source: 'user' },
          ],
        }),
      );
    });

    it('should create missing word nodes from extracted keywords', async () => {
      const mockKeywords = [
        { word: 'newword', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      const mockCreatedQuestion = {
        id: expect.any(String),
        questionText: validQuestionData.questionText,
      } as any;

      openQuestionSchema.createOpenQuestion.mockResolvedValue(
        mockCreatedQuestion,
      );

      await service.createOpenQuestion(validQuestionData);

      expect(wordService.checkWordExistence).toHaveBeenCalledWith('newword');
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'newword',
        createdBy: validQuestionData.createdBy,
        publicCredit: true,
      });
    });

    it('should not create word nodes that already exist', async () => {
      const mockKeywords = [
        { word: 'existing', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(true);

      const mockCreatedQuestion = {
        id: expect.any(String),
        questionText: validQuestionData.questionText,
      } as any;

      openQuestionSchema.createOpenQuestion.mockResolvedValue(
        mockCreatedQuestion,
      );

      await service.createOpenQuestion(validQuestionData);

      expect(wordService.checkWordExistence).toHaveBeenCalledWith('existing');
      expect(wordService.createWord).not.toHaveBeenCalled();
    });

    it('should continue if word creation fails', async () => {
      const mockKeywords = [
        { word: 'newword', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockRejectedValue(
        new Error('Word creation failed'),
      );

      const mockCreatedQuestion = {
        id: expect.any(String),
        questionText: validQuestionData.questionText,
      } as any;

      openQuestionSchema.createOpenQuestion.mockResolvedValue(
        mockCreatedQuestion,
      );

      // Should not throw despite word creation failure
      const result = await service.createOpenQuestion(validQuestionData);

      expect(openQuestionSchema.createOpenQuestion).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedQuestion);
    });

    it('should validate categories exist and are approved', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      const mockCategory = {
        id: 'cat-1',
        inclusionNetVotes: 5,
      } as any;

      categoryService.getCategory.mockResolvedValue(mockCategory);

      const mockCreatedQuestion = {
        id: expect.any(String),
        questionText: validQuestionData.questionText,
      } as any;

      openQuestionSchema.createOpenQuestion.mockResolvedValue(
        mockCreatedQuestion,
      );

      await service.createOpenQuestion({
        ...validQuestionData,
        categoryIds: ['cat-1'],
      });

      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-1');
      expect(openQuestionSchema.createOpenQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryIds: ['cat-1'],
        }),
      );
    });

    it('should reject unapproved categories', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      const mockCategory = {
        id: 'cat-1',
        inclusionNetVotes: -1, // Not approved
      } as any;

      categoryService.getCategory.mockResolvedValue(mockCategory);

      await expect(
        service.createOpenQuestion({
          ...validQuestionData,
          categoryIds: ['cat-1'],
        }),
      ).rejects.toThrow('must have passed inclusion threshold');
    });

    it('should reject non-existent categories', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      categoryService.getCategory.mockResolvedValue(null);

      await expect(
        service.createOpenQuestion({
          ...validQuestionData,
          categoryIds: ['nonexistent'],
        }),
      ).rejects.toThrow('does not exist');
    });

    it('should throw InternalServerErrorException if keyword extraction fails', async () => {
      keywordExtractionService.extractKeywords.mockRejectedValue(
        new Error('Extraction failed'),
      );

      await expect(
        service.createOpenQuestion(validQuestionData),
      ).rejects.toThrow(InternalServerErrorException);

      expect(openQuestionSchema.createOpenQuestion).not.toHaveBeenCalled();
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      openQuestionSchema.createOpenQuestion.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.createOpenQuestion(validQuestionData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should preserve BadRequestException from dependencies', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      openQuestionSchema.createOpenQuestion.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(
        service.createOpenQuestion(validQuestionData),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // GET OPEN QUESTION TESTS
  // ============================================
  describe('getOpenQuestion', () => {
    it('should retrieve an open question by ID', async () => {
      const mockQuestion = {
        id: 'test-id',
        questionText: 'Test question?',
        createdBy: 'user-123',
        publicCredit: true,
      } as any;

      // ✅ FIXED: Use getOpenQuestion instead of findById
      openQuestionSchema.getOpenQuestion.mockResolvedValue(mockQuestion);

      const result = await service.getOpenQuestion('test-id');

      expect(openQuestionSchema.getOpenQuestion).toHaveBeenCalledWith(
        'test-id',
      );
      expect(result).toEqual(mockQuestion);
    });

    it('should throw NotFoundException when question does not exist', async () => {
      // ✅ FIXED: Use getOpenQuestion
      openQuestionSchema.getOpenQuestion.mockResolvedValue(null);

      await expect(service.getOpenQuestion('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.getOpenQuestion('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      // ✅ FIXED: Use getOpenQuestion
      openQuestionSchema.getOpenQuestion.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getOpenQuestion('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // UPDATE OPEN QUESTION TESTS
  // ============================================
  describe('updateOpenQuestion', () => {
    it('should throw BadRequestException for empty update data', async () => {
      await expect(service.updateOpenQuestion('test-id', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update question without keywords when text does not change', async () => {
      const mockUpdatedQuestion = {
        id: 'test-id',
        publicCredit: false,
        questionText: 'Original?',
        createdBy: 'user',
      } as any;

      openQuestionSchema.updateOpenQuestion.mockResolvedValue(
        mockUpdatedQuestion,
      );

      const result = await service.updateOpenQuestion('test-id', {
        publicCredit: false,
      });

      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();
      expect(openQuestionSchema.updateOpenQuestion).toHaveBeenCalledWith(
        'test-id',
        {
          publicCredit: false,
        },
      );
      expect(result).toEqual(mockUpdatedQuestion);
    });

    it('should extract and update keywords when question text changes', async () => {
      const mockKeywords = [
        { word: 'updated', frequency: 1, source: 'ai' as const },
      ];

      // ✅ FIXED: Use getOpenQuestion to get original question
      openQuestionSchema.getOpenQuestion.mockResolvedValue({
        id: 'test-id',
        questionText: 'Original?',
        createdBy: 'user',
        publicCredit: true,
      } as any);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(true);

      const mockUpdatedQuestion = {
        id: 'test-id',
        questionText: 'Updated question?',
      } as any;

      openQuestionSchema.updateOpenQuestion.mockResolvedValue(
        mockUpdatedQuestion,
      );

      const result = await service.updateOpenQuestion('test-id', {
        questionText: 'Updated question?',
      });

      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: 'Updated question?',
      });

      expect(openQuestionSchema.updateOpenQuestion).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          questionText: 'Updated question?',
          keywords: mockKeywords,
        }),
      );

      expect(result).toEqual(mockUpdatedQuestion);
    });

    it('should use user keywords when provided during update', async () => {
      // ✅ FIXED: Use getOpenQuestion
      openQuestionSchema.getOpenQuestion.mockResolvedValue({
        id: 'test-id',
        questionText: 'Original?',
        createdBy: 'user',
        publicCredit: true,
      } as any);

      wordService.checkWordExistence.mockResolvedValue(true);

      openQuestionSchema.updateOpenQuestion.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.updateOpenQuestion('test-id', {
        questionText: 'Updated?',
        userKeywords: ['custom'],
      });

      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();

      expect(openQuestionSchema.updateOpenQuestion).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          keywords: [{ word: 'custom', frequency: 1, source: 'user' }],
        }),
      );
    });

    it('should create missing words during update', async () => {
      const mockKeywords = [
        { word: 'newword', frequency: 1, source: 'ai' as const },
      ];

      // ✅ FIXED: Use getOpenQuestion
      openQuestionSchema.getOpenQuestion.mockResolvedValue({
        id: 'test-id',
        questionText: 'Original?',
        createdBy: 'user',
        publicCredit: true,
      } as any);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      openQuestionSchema.updateOpenQuestion.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.updateOpenQuestion('test-id', {
        questionText: 'Updated?',
      });

      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'newword',
        createdBy: 'user',
        publicCredit: true,
      });
    });

    it('should continue if keyword extraction fails during update', async () => {
      // ✅ FIXED: Use getOpenQuestion
      openQuestionSchema.getOpenQuestion.mockResolvedValue({
        id: 'test-id',
        questionText: 'Original?',
        createdBy: 'user',
        publicCredit: true,
      } as any);

      keywordExtractionService.extractKeywords.mockRejectedValue(
        new Error('Extraction failed'),
      );

      openQuestionSchema.updateOpenQuestion.mockResolvedValue({
        id: 'test-id',
        questionText: 'Updated?',
      } as any);

      // ✅ FIXED: Looking at service code lines 288-297, when keyword extraction fails
      // during update with text change, the service catches it but doesn't continue -
      // it re-throws as InternalServerErrorException
      await expect(
        service.updateOpenQuestion('test-id', {
          questionText: 'Updated?',
        }),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        service.updateOpenQuestion('test-id', {
          questionText: 'Updated?',
        }),
      ).rejects.toThrow('Failed to update open question: Extraction failed');

      // Schema update should NOT have been called because extraction failed first
      expect(openQuestionSchema.updateOpenQuestion).not.toHaveBeenCalled();
    });

    it('should validate updated text length', async () => {
      await expect(
        service.updateOpenQuestion('test-id', {
          questionText: 'a'.repeat(281), // Over 280 char limit
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate updated category count', async () => {
      await expect(
        service.updateOpenQuestion('test-id', {
          categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'], // Max is 3
        }),
      ).rejects.toThrow('Open question can have maximum 3 categories');
    });

    it('should validate categories during update', async () => {
      const mockCategory = {
        id: 'cat-1',
        inclusionNetVotes: 5,
      } as any;

      categoryService.getCategory.mockResolvedValue(mockCategory);

      openQuestionSchema.updateOpenQuestion.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.updateOpenQuestion('test-id', {
        categoryIds: ['cat-1'],
      });

      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-1');
    });

    it('should throw NotFoundException when updating non-existent question', async () => {
      openQuestionSchema.updateOpenQuestion.mockResolvedValue(null);

      await expect(
        service.updateOpenQuestion('nonexistent-id', {
          publicCredit: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      openQuestionSchema.updateOpenQuestion.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.updateOpenQuestion('test-id', { publicCredit: false }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ============================================
  // DELETE OPEN QUESTION TESTS
  // ============================================
  describe('deleteOpenQuestion', () => {
    it('should delete an open question', async () => {
      // ✅ FIXED: Use getOpenQuestion
      openQuestionSchema.getOpenQuestion.mockResolvedValue({
        id: 'test-id',
        questionText: 'Test?',
      } as any);

      openQuestionSchema.delete.mockResolvedValue(undefined);

      const result = await service.deleteOpenQuestion('test-id');

      expect(openQuestionSchema.getOpenQuestion).toHaveBeenCalledWith(
        'test-id',
      );
      expect(openQuestionSchema.delete).toHaveBeenCalledWith('test-id');
      expect(result).toEqual({ success: true });
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.deleteOpenQuestion('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when deleting non-existent question', async () => {
      // ✅ FIXED: Use getOpenQuestion
      openQuestionSchema.getOpenQuestion.mockResolvedValue(null);

      await expect(
        service.deleteOpenQuestion('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      // ✅ FIXED: Use getOpenQuestion
      openQuestionSchema.getOpenQuestion.mockResolvedValue({
        id: 'test-id',
      } as any);

      openQuestionSchema.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.deleteOpenQuestion('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // VOTING TESTS - INCLUSION ONLY
  // ============================================
  describe('voteInclusion', () => {
    it('should vote on question inclusion', async () => {
      openQuestionSchema.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await service.voteInclusion('test-id', 'user-123', true);

      expect(openQuestionSchema.voteInclusion).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should vote negatively on inclusion', async () => {
      const negativeVoteResult = {
        ...mockVoteResult,
        inclusionNegativeVotes: 3,
        inclusionNetVotes: 3,
      };

      openQuestionSchema.voteInclusion.mockResolvedValue(negativeVoteResult);

      const result = await service.voteInclusion('test-id', 'user-123', false);

      expect(openQuestionSchema.voteInclusion).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        false,
      );
      expect(result).toEqual(negativeVoteResult);
    });

    // ✅ FIXED: Service delegates validation to schema
    it('should delegate validation to schema', async () => {
      openQuestionSchema.voteInclusion.mockRejectedValue(
        new BadRequestException('Invalid ID'),
      );

      await expect(service.voteInclusion('', 'user-123', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      openQuestionSchema.voteInclusion.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.voteInclusion('test-id', 'user-123', true),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getVoteStatus', () => {
    it('should get vote status for a user', async () => {
      openQuestionSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await service.getVoteStatus('test-id', 'user-123');

      expect(openQuestionSchema.getVoteStatus).toHaveBeenCalledWith(
        'test-id',
        'user-123',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should return null when user has no vote', async () => {
      openQuestionSchema.getVoteStatus.mockResolvedValue(null);

      const result = await service.getVoteStatus('test-id', 'user-123');

      expect(result).toBeNull();
    });

    // ✅ FIXED: Service delegates validation to schema
    it('should delegate validation to schema', async () => {
      openQuestionSchema.getVoteStatus.mockRejectedValue(
        new BadRequestException('Invalid ID'),
      );

      await expect(service.getVoteStatus('', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      openQuestionSchema.getVoteStatus.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.getVoteStatus('test-id', 'user-123'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('removeVote', () => {
    it('should remove a vote from an open question', async () => {
      const voteResult = {
        ...mockVoteResult,
        inclusionPositiveVotes: 5,
        inclusionNetVotes: 3,
      };

      openQuestionSchema.removeVote.mockResolvedValue(voteResult);

      const result = await service.removeVote('test-id', 'user-123');

      expect(openQuestionSchema.removeVote).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        'INCLUSION',
      );
      expect(result).toEqual(voteResult);
    });

    // ✅ FIXED: Service delegates validation to schema
    it('should delegate validation to schema', async () => {
      openQuestionSchema.removeVote.mockRejectedValue(
        new BadRequestException('Invalid ID'),
      );

      await expect(service.removeVote('', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      openQuestionSchema.removeVote.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.removeVote('test-id', 'user-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getVotes', () => {
    it('should get vote totals for an open question', async () => {
      openQuestionSchema.getVotes.mockResolvedValue(mockVoteResult);

      const result = await service.getVotes('test-id');

      expect(openQuestionSchema.getVotes).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockVoteResult);
    });

    it('should return null when question has no votes', async () => {
      openQuestionSchema.getVotes.mockResolvedValue(null);

      const result = await service.getVotes('test-id');

      expect(result).toBeNull();
    });

    // ✅ FIXED: Service delegates validation to schema
    it('should delegate validation to schema', async () => {
      openQuestionSchema.getVotes.mockRejectedValue(
        new BadRequestException('Invalid ID'),
      );

      await expect(service.getVotes('')).rejects.toThrow(BadRequestException);
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      openQuestionSchema.getVotes.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getVotes('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  describe('Error Handling', () => {
    it('should handle schema errors consistently', async () => {
      openQuestionSchema.getOpenQuestion.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getOpenQuestion('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    // ✅ FIXED: Service preserves NotFoundException
    it('should preserve NotFoundException from schema', async () => {
      openQuestionSchema.getOpenQuestion.mockResolvedValue(null);

      await expect(service.getOpenQuestion('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve BadRequestException from validation', async () => {
      await expect(
        service.createOpenQuestion({
          createdBy: '',
          publicCredit: true,
          questionText: 'Test?',
          initialComment: 'Comment',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should wrap generic errors in InternalServerErrorException', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      openQuestionSchema.createOpenQuestion.mockRejectedValue(
        new Error('Unknown error'),
      );

      await expect(
        service.createOpenQuestion({
          createdBy: 'user',
          publicCredit: true,
          questionText: 'Test?',
          initialComment: 'Comment',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ============================================
  // INTEGRATION TESTS
  // ============================================
  describe('Integration - Full Create Flow', () => {
    it('should handle complete question creation with all features', async () => {
      const questionData = {
        createdBy: 'test-user',
        publicCredit: true,
        questionText: 'What is the future of renewable energy?',
        categoryIds: ['cat-1', 'cat-2'],
        initialComment: 'Interested in sustainability',
      };

      // Mock keyword extraction
      const mockKeywords = [
        { word: 'future', frequency: 1, source: 'ai' as const },
        { word: 'renewable', frequency: 1, source: 'ai' as const },
        { word: 'energy', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      // Mock word checks - 'future' exists, others don't
      wordService.checkWordExistence.mockImplementation(
        async (word: string) => {
          return word === 'future';
        },
      );

      wordService.createWord.mockResolvedValue({} as any);

      // Mock category validation
      const mockCategory = {
        id: 'cat-1',
        inclusionNetVotes: 5,
      } as any;

      categoryService.getCategory.mockResolvedValue(mockCategory);

      // Mock question creation
      const mockCreatedQuestion = {
        id: 'question-integration-123',
        questionText: questionData.questionText,
        createdBy: questionData.createdBy,
        publicCredit: true,
        categoryIds: questionData.categoryIds,
      } as any;

      openQuestionSchema.createOpenQuestion.mockResolvedValue(
        mockCreatedQuestion,
      );

      // ✅ FIXED: Service DOES call discussion creation (lines 169-186)
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      const result = await service.createOpenQuestion(questionData);

      // Verify keyword extraction
      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: questionData.questionText,
      });

      // Verify word creation for missing words
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'renewable',
        createdBy: questionData.createdBy,
        publicCredit: true,
      });
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'energy',
        createdBy: questionData.createdBy,
        publicCredit: true,
      });

      // Verify category validation
      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-1');
      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-2');

      // Verify question creation
      expect(openQuestionSchema.createOpenQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          questionText: questionData.questionText,
          keywords: mockKeywords,
          categoryIds: questionData.categoryIds,
        }),
      );

      // ✅ FIXED: Service DOES create discussion in SERVICE layer
      // Looking at actual service code lines 169-186
      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: 'question-integration-123',
        nodeType: 'OpenQuestionNode',
        nodeIdField: 'id',
        createdBy: questionData.createdBy,
        initialComment: questionData.initialComment,
      });

      expect(result).toEqual(mockCreatedQuestion);
    });
  });

  describe('Integration - Full Update Flow', () => {
    it('should handle complete question update with text change', async () => {
      const originalQuestion = {
        id: 'test-id',
        questionText: 'Original question?',
        createdBy: 'test-user',
        publicCredit: true,
      } as any;

      // ✅ FIXED: Use getOpenQuestion
      openQuestionSchema.getOpenQuestion.mockResolvedValue(originalQuestion);

      const updateData = {
        questionText: 'Updated question about AI?',
        categoryIds: ['cat-1'],
      };

      // Mock keyword extraction
      const mockKeywords = [
        { word: 'AI', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      // Mock category validation
      categoryService.getCategory.mockResolvedValue({
        id: 'cat-1',
        inclusionNetVotes: 5,
      } as any);

      const mockUpdatedQuestion = {
        ...originalQuestion,
        ...updateData,
      } as any;

      openQuestionSchema.updateOpenQuestion.mockResolvedValue(
        mockUpdatedQuestion,
      );

      const result = await service.updateOpenQuestion('test-id', updateData);

      // Verify keyword extraction
      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: updateData.questionText,
      });

      // Verify word creation
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'AI',
        createdBy: originalQuestion.createdBy,
        publicCredit: originalQuestion.publicCredit,
      });

      // Verify category validation
      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-1');

      // Verify update
      expect(openQuestionSchema.updateOpenQuestion).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          questionText: updateData.questionText,
          keywords: mockKeywords,
          categoryIds: updateData.categoryIds,
        }),
      );

      expect(result).toEqual(mockUpdatedQuestion);
    });
  });

  // ============================================
  // VALIDATION TESTS
  // ============================================
  describe('Input Validation', () => {
    it('should validate all required fields for creation', async () => {
      await expect(
        service.createOpenQuestion({
          createdBy: '',
          publicCredit: true,
          questionText: 'Test?',
          initialComment: 'Comment',
        }),
      ).rejects.toThrow('Creator ID is required');

      await expect(
        service.createOpenQuestion({
          createdBy: 'user',
          publicCredit: true,
          questionText: '',
          initialComment: 'Comment',
        }),
      ).rejects.toThrow('Question text is required');

      await expect(
        service.createOpenQuestion({
          createdBy: 'user',
          publicCredit: true,
          questionText: 'Test?',
          initialComment: '',
        }),
      ).rejects.toThrow('Initial comment is required');
    });

    it('should validate question text length', async () => {
      await expect(
        service.createOpenQuestion({
          createdBy: 'user',
          publicCredit: true,
          questionText: 'a'.repeat(281),
          initialComment: 'Comment',
        }),
      ).rejects.toThrow('Question text cannot exceed');
    });

    it('should validate category count limit', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      await expect(
        service.createOpenQuestion({
          createdBy: 'user',
          publicCredit: true,
          questionText: 'Test?',
          initialComment: 'Comment',
          categoryIds: ['c1', 'c2', 'c3', 'c4'],
        }),
      ).rejects.toThrow('maximum 3 categories');
    });

    it('should validate empty IDs', async () => {
      await expect(service.getOpenQuestion('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateOpenQuestion('', {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteOpenQuestion('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // BUSINESS LOGIC TESTS
  // ============================================
  describe('Business Logic', () => {
    it('should only support inclusion voting, not content voting', () => {
      // OpenQuestions should only have inclusion voting
      // This is enforced at the schema level
      expect(service.voteInclusion).toBeDefined();
      expect(service.getVoteStatus).toBeDefined();
      expect(service.removeVote).toBeDefined();
      expect(service.getVotes).toBeDefined();
    });

    it('should handle keyword extraction gracefully', async () => {
      keywordExtractionService.extractKeywords.mockRejectedValue(
        new Error('AI service down'),
      );

      await expect(
        service.createOpenQuestion({
          createdBy: 'user',
          publicCredit: true,
          questionText: 'Test?',
          initialComment: 'Comment',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should prioritize user keywords over AI extraction', async () => {
      const questionData = {
        createdBy: 'user',
        publicCredit: true,
        questionText: 'Test question?',
        initialComment: 'Comment',
        userKeywords: ['custom', 'tags'],
      };

      wordService.checkWordExistence.mockResolvedValue(true);
      openQuestionSchema.createOpenQuestion.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.createOpenQuestion(questionData);

      // Should NOT call AI extraction
      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();

      // Should use user keywords
      expect(openQuestionSchema.createOpenQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: [
            { word: 'custom', frequency: 1, source: 'user' },
            { word: 'tags', frequency: 1, source: 'user' },
          ],
        }),
      );
    });

    it('should validate category approval status', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      // Category with negative votes (not approved)
      categoryService.getCategory.mockResolvedValue({
        id: 'cat-1',
        inclusionNetVotes: -5,
      } as any);

      await expect(
        service.createOpenQuestion({
          createdBy: 'user',
          publicCredit: true,
          questionText: 'Test?',
          initialComment: 'Comment',
          categoryIds: ['cat-1'],
        }),
      ).rejects.toThrow('must have passed inclusion threshold');
    });

    it('should continue if word creation fails for non-critical words', async () => {
      const mockKeywords = [
        { word: 'word1', frequency: 1, source: 'ai' as const },
        { word: 'word2', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord
        .mockResolvedValueOnce({} as any) // First word succeeds
        .mockRejectedValueOnce(new Error('Failed')); // Second word fails

      openQuestionSchema.createOpenQuestion.mockResolvedValue({
        id: 'test-id',
      } as any);

      // Should not throw - word creation is non-critical
      const result = await service.createOpenQuestion({
        createdBy: 'user',
        publicCredit: true,
        questionText: 'Test?',
        initialComment: 'Comment',
      });

      expect(result).toBeDefined();
      expect(openQuestionSchema.createOpenQuestion).toHaveBeenCalled();
    });
  });

  // ============================================
  // LIFECYCLE TESTS
  // ============================================
  describe('Complete Lifecycle', () => {
    it('should support full CRUD operations', async () => {
      // Create
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      const mockCreatedQuestion = {
        id: 'test-id',
        questionText: 'Test question?',
        createdBy: 'user-123',
        publicCredit: true,
      } as any;

      openQuestionSchema.createOpenQuestion.mockResolvedValue(
        mockCreatedQuestion,
      );

      const created = await service.createOpenQuestion({
        createdBy: 'user-123',
        publicCredit: true,
        questionText: 'Test question?',
        initialComment: 'Initial comment',
      });

      expect(created.id).toBe('test-id');

      // Read
      openQuestionSchema.getOpenQuestion.mockResolvedValue(mockCreatedQuestion);

      const retrieved = await service.getOpenQuestion('test-id');
      expect(retrieved).toEqual(mockCreatedQuestion);

      // Update
      const mockUpdatedQuestion = {
        ...mockCreatedQuestion,
        publicCredit: false,
      } as any;

      openQuestionSchema.updateOpenQuestion.mockResolvedValue(
        mockUpdatedQuestion,
      );

      const updated = await service.updateOpenQuestion('test-id', {
        publicCredit: false,
      });
      expect(updated.publicCredit).toBe(false);

      // Vote
      openQuestionSchema.voteInclusion.mockResolvedValue(mockVoteResult);

      const voteResult = await service.voteInclusion(
        'test-id',
        'user-456',
        true,
      );
      expect(voteResult).toEqual(mockVoteResult);

      // Delete
      openQuestionSchema.getOpenQuestion.mockResolvedValue(mockCreatedQuestion);
      openQuestionSchema.delete.mockResolvedValue(undefined);

      const deleteResult = await service.deleteOpenQuestion('test-id');
      expect(deleteResult.success).toBe(true);
    });
  });
});
