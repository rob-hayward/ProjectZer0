// src/nodes/answer/answer.service.spec.ts - COMPREHENSIVE TEST SUITE - FIXED

import { Test, TestingModule } from '@nestjs/testing';
import { AnswerService } from './answer.service';
import { AnswerSchema } from '../../neo4j/schemas/answer.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { CategoryService } from '../category/category.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { OpenQuestionService } from '../openquestion/openquestion.service';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

describe('AnswerService - Comprehensive Tests', () => {
  let service: AnswerService;
  let answerSchema: jest.Mocked<AnswerSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let userSchema: jest.Mocked<UserSchema>;
  let categoryService: jest.Mocked<CategoryService>;
  let keywordExtractionService: jest.Mocked<KeywordExtractionService>;
  let wordService: jest.Mocked<WordService>;
  let openQuestionService: jest.Mocked<OpenQuestionService>;

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 6,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 4,
    contentPositiveVotes: 3,
    contentNegativeVotes: 1,
    contentNetVotes: 2,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree' as const,
    inclusionPositiveVotes: 6,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 4,
    contentStatus: 'agree' as const,
    contentPositiveVotes: 3,
    contentNegativeVotes: 1,
    contentNetVotes: 2,
  };

  beforeEach(async () => {
    const mockAnswerSchema = {
      createAnswer: jest.fn(),
      getAnswer: jest.fn(),
      updateAnswer: jest.fn(),
      delete: jest.fn(),
      voteInclusion: jest.fn(),
      voteContent: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
      getAnswersByQuestion: jest.fn(),
      getTopAnswerForQuestion: jest.fn(),
      findById: jest.fn(),
    };

    const mockDiscussionSchema = {
      createDiscussionForNode: jest.fn(),
      getDiscussionIdForNode: jest.fn(),
    };

    const mockUserSchema = {
      addCreatedNode: jest.fn(),
    };

    const mockCategoryService = {
      getCategory: jest.fn(),
    };

    const mockKeywordExtractionService = {
      extractKeywords: jest.fn(),
    };

    const mockWordService = {
      checkWordExistence: jest.fn(),
      createWord: jest.fn(),
    };

    const mockOpenQuestionService = {
      getOpenQuestion: jest.fn(),
      updateOpenQuestion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnswerService,
        { provide: AnswerSchema, useValue: mockAnswerSchema },
        { provide: DiscussionSchema, useValue: mockDiscussionSchema },
        { provide: UserSchema, useValue: mockUserSchema },
        { provide: CategoryService, useValue: mockCategoryService },
        {
          provide: KeywordExtractionService,
          useValue: mockKeywordExtractionService,
        },
        { provide: WordService, useValue: mockWordService },
        { provide: OpenQuestionService, useValue: mockOpenQuestionService },
      ],
    }).compile();

    service = module.get<AnswerService>(AnswerService);
    answerSchema = module.get(AnswerSchema);
    discussionSchema = module.get(DiscussionSchema);
    userSchema = module.get(UserSchema);
    categoryService = module.get(CategoryService);
    keywordExtractionService = module.get(KeywordExtractionService);
    wordService = module.get(WordService);
    openQuestionService = module.get(OpenQuestionService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // CREATE ANSWER TESTS
  // ============================================
  describe('createAnswer', () => {
    const validAnswerData = {
      createdBy: 'test-user',
      publicCredit: true,
      answerText: 'This is a comprehensive answer to the question.',
      parentQuestionId: 'question-123',
      initialComment: 'Initial comment',
    };

    const mockParentQuestion = {
      id: 'question-123',
      questionText: 'What is the question?',
      inclusionNetVotes: 5,
    };

    it('should validate and reject empty createdBy', async () => {
      await expect(
        service.createAnswer({
          ...validAnswerData,
          createdBy: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject empty answer text', async () => {
      await expect(
        service.createAnswer({
          ...validAnswerData,
          answerText: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject empty parent question ID', async () => {
      await expect(
        service.createAnswer({
          ...validAnswerData,
          parentQuestionId: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject answer text that is too long', async () => {
      await expect(
        service.createAnswer({
          ...validAnswerData,
          answerText: 'a'.repeat(281), // Over 280 char limit
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject non-boolean publicCredit', async () => {
      await expect(
        service.createAnswer({
          ...validAnswerData,
          publicCredit: 'yes' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject too many categories', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

      // ✅ FIXED: Mock keyword extraction (runs before category validation)
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      await expect(
        service.createAnswer({
          ...validAnswerData,
          categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'], // Max is 3
        }),
      ).rejects.toThrow('Answer can have maximum 3 categories');
    });

    it('should validate parent question exists', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(null);

      await expect(service.createAnswer(validAnswerData)).rejects.toThrow(
        'Parent question question-123 not found',
      );
    });

    it('should validate parent question has passed inclusion', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue({
        id: 'question-123',
        inclusionNetVotes: -1, // Not approved
      } as any);

      await expect(service.createAnswer(validAnswerData)).rejects.toThrow(
        'Parent question must pass inclusion threshold',
      );
    });

    it('should create answer with AI-extracted keywords', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

      const mockKeywords = [
        { word: 'test', frequency: 1, source: 'ai' as const },
        { word: 'keyword', frequency: 2, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      const mockCreatedAnswer = {
        id: 'answer-123',
        answerText: validAnswerData.answerText,
        createdBy: validAnswerData.createdBy,
        publicCredit: true,
        parentQuestionId: validAnswerData.parentQuestionId,
      } as any;

      answerSchema.createAnswer.mockResolvedValue(mockCreatedAnswer);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      const result = await service.createAnswer(validAnswerData);

      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: validAnswerData.answerText,
      });

      expect(answerSchema.createAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          answerText: validAnswerData.answerText,
          keywords: mockKeywords,
          parentQuestionId: validAnswerData.parentQuestionId,
        }),
      );

      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: expect.any(String),
        nodeType: 'AnswerNode',
        nodeIdField: 'id',
        createdBy: validAnswerData.createdBy,
        initialComment: validAnswerData.initialComment,
      });

      expect(result).toEqual(mockCreatedAnswer);
    });

    it('should use user-provided keywords instead of AI extraction', async () => {
      const userKeywords = ['custom', 'keywords'];

      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

      const answerData = {
        ...validAnswerData,
        userKeywords,
      };

      wordService.checkWordExistence.mockResolvedValue(true);

      const mockCreatedAnswer = {
        id: 'answer-123',
        answerText: validAnswerData.answerText,
      } as any;

      answerSchema.createAnswer.mockResolvedValue(mockCreatedAnswer);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createAnswer(answerData);

      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();

      expect(answerSchema.createAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: [
            { word: 'custom', frequency: 1, source: 'user' },
            { word: 'keywords', frequency: 1, source: 'user' },
          ],
        }),
      );
    });

    it('should create missing word nodes from extracted keywords', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

      const mockKeywords = [
        { word: 'newword', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      const mockCreatedAnswer = {
        id: 'answer-123',
        answerText: validAnswerData.answerText,
      } as any;

      answerSchema.createAnswer.mockResolvedValue(mockCreatedAnswer);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createAnswer(validAnswerData);

      expect(wordService.checkWordExistence).toHaveBeenCalledWith('newword');
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'newword',
        createdBy: validAnswerData.createdBy,
        publicCredit: true,
        isAICreated: true,
      });
    });

    it('should not create word nodes that already exist', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

      const mockKeywords = [
        { word: 'existing', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(true);

      const mockCreatedAnswer = {
        id: 'answer-123',
        answerText: validAnswerData.answerText,
      } as any;

      answerSchema.createAnswer.mockResolvedValue(mockCreatedAnswer);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createAnswer(validAnswerData);

      expect(wordService.checkWordExistence).toHaveBeenCalledWith('existing');
      expect(wordService.createWord).not.toHaveBeenCalled();
    });

    it('should continue if word creation fails', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

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

      const mockCreatedAnswer = {
        id: 'answer-123',
        answerText: validAnswerData.answerText,
      } as any;

      answerSchema.createAnswer.mockResolvedValue(mockCreatedAnswer);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      // Should not throw despite word creation failure
      const result = await service.createAnswer(validAnswerData);

      expect(answerSchema.createAnswer).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedAnswer);
    });

    it('should validate categories exist and are approved', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      const mockCategory = {
        id: 'cat-1',
        inclusionNetVotes: 5,
      } as any;

      categoryService.getCategory.mockResolvedValue(mockCategory);

      const mockCreatedAnswer = {
        id: 'answer-123',
        answerText: validAnswerData.answerText,
      } as any;

      answerSchema.createAnswer.mockResolvedValue(mockCreatedAnswer);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createAnswer({
        ...validAnswerData,
        categoryIds: ['cat-1'],
      });

      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-1');
      expect(answerSchema.createAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryIds: ['cat-1'],
        }),
      );
    });

    it('should reject unapproved categories', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

      // ✅ FIXED: Mock keyword extraction (runs before category validation)
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-1',
        inclusionNetVotes: -1,
      } as any);

      await expect(
        service.createAnswer({
          createdBy: 'test-user',
          publicCredit: true,
          answerText: 'Test answer',
          parentQuestionId: 'question-123',
          categoryIds: ['cat-1'],
        }),
      ).rejects.toThrow('Category cat-1 must pass inclusion threshold');
    });

    it('should reject non-existent categories', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

      // ✅ FIXED: Mock keyword extraction (runs before category validation)
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      categoryService.getCategory.mockResolvedValue(null);

      await expect(
        service.createAnswer({
          createdBy: 'test-user',
          publicCredit: true,
          answerText: 'Test answer',
          parentQuestionId: 'question-123',
          categoryIds: ['nonexistent'],
        }),
      ).rejects.toThrow('Category with ID nonexistent not found');
    });

    it('should continue if discussion creation fails', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      const mockCreatedAnswer = {
        id: 'answer-123',
        answerText: validAnswerData.answerText,
      } as any;

      answerSchema.createAnswer.mockResolvedValue(mockCreatedAnswer);

      discussionSchema.createDiscussionForNode.mockRejectedValue(
        new Error('Discussion creation failed'),
      );

      // Should not throw despite discussion creation failure
      const result = await service.createAnswer(validAnswerData);

      expect(answerSchema.createAnswer).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedAnswer);
    });

    it('should throw InternalServerErrorException if keyword extraction fails', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

      keywordExtractionService.extractKeywords.mockRejectedValue(
        new Error('Extraction failed'),
      );

      await expect(service.createAnswer(validAnswerData)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(answerSchema.createAnswer).not.toHaveBeenCalled();
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      answerSchema.createAnswer.mockRejectedValue(new Error('Database error'));

      await expect(service.createAnswer(validAnswerData)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should preserve BadRequestException from dependencies', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockParentQuestion as any,
      );

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      answerSchema.createAnswer.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(service.createAnswer(validAnswerData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // GET ANSWER TESTS
  // ============================================
  describe('getAnswer', () => {
    it('should retrieve an answer by ID', async () => {
      const mockAnswer = {
        id: 'test-id',
        answerText: 'Test answer',
        createdBy: 'user-123',
        publicCredit: true,
      } as any;

      answerSchema.getAnswer.mockResolvedValue(mockAnswer);

      const result = await service.getAnswer('test-id');

      expect(answerSchema.getAnswer).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockAnswer);
    });

    it('should throw NotFoundException when answer does not exist', async () => {
      answerSchema.getAnswer.mockResolvedValue(null);

      await expect(service.getAnswer('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.getAnswer('')).rejects.toThrow(BadRequestException);
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      answerSchema.getAnswer.mockRejectedValue(new Error('Database error'));

      await expect(service.getAnswer('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // UPDATE ANSWER TESTS
  // ============================================
  describe('updateAnswer', () => {
    it('should throw BadRequestException for empty update data', async () => {
      await expect(service.updateAnswer('test-id', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update answer without keywords when text does not change', async () => {
      const mockUpdatedAnswer = {
        id: 'test-id',
        publicCredit: false,
        answerText: 'Original',
        createdBy: 'user',
      } as any;

      answerSchema.updateAnswer.mockResolvedValue(mockUpdatedAnswer);

      const result = await service.updateAnswer('test-id', {
        publicCredit: false,
      });

      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();
      expect(answerSchema.updateAnswer).toHaveBeenCalledWith('test-id', {
        publicCredit: false,
      });
      expect(result).toEqual(mockUpdatedAnswer);
    });

    it('should extract and update keywords when answer text changes', async () => {
      const mockKeywords = [
        { word: 'updated', frequency: 1, source: 'ai' as const },
      ];

      // Get original answer
      answerSchema.getAnswer.mockResolvedValue({
        id: 'test-id',
        answerText: 'Original',
        createdBy: 'user',
        publicCredit: true,
      } as any);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(true);

      const mockUpdatedAnswer = {
        id: 'test-id',
        answerText: 'Updated answer',
      } as any;

      answerSchema.updateAnswer.mockResolvedValue(mockUpdatedAnswer);

      const result = await service.updateAnswer('test-id', {
        answerText: 'Updated answer',
      });

      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: 'Updated answer',
      });

      expect(answerSchema.updateAnswer).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          answerText: 'Updated answer',
          keywords: mockKeywords,
        }),
      );

      expect(result).toEqual(mockUpdatedAnswer);
    });

    it('should use user keywords when provided during update', async () => {
      answerSchema.getAnswer.mockResolvedValue({
        id: 'test-id',
        answerText: 'Original',
        createdBy: 'user',
        publicCredit: true,
      } as any);

      wordService.checkWordExistence.mockResolvedValue(true);

      answerSchema.updateAnswer.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.updateAnswer('test-id', {
        answerText: 'Updated',
        userKeywords: ['custom'],
      });

      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();

      expect(answerSchema.updateAnswer).toHaveBeenCalledWith(
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

      answerSchema.getAnswer.mockResolvedValue({
        id: 'test-id',
        answerText: 'Original',
        createdBy: 'user',
        publicCredit: true,
      } as any);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      answerSchema.updateAnswer.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.updateAnswer('test-id', {
        answerText: 'Updated',
      });

      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'newword',
        createdBy: 'user',
        publicCredit: true,
        isAICreated: true,
      });
    });

    it('should continue if keyword extraction fails during update', async () => {
      answerSchema.getAnswer.mockResolvedValue({
        id: 'test-id',
        answerText: 'Original',
        createdBy: 'user',
        publicCredit: true,
      } as any);

      keywordExtractionService.extractKeywords.mockRejectedValue(
        new Error('Extraction failed'),
      );

      answerSchema.updateAnswer.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.updateAnswer('test-id', {
        answerText: 'Updated',
      });

      // Should continue with empty keywords
      expect(answerSchema.updateAnswer).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          keywords: [],
        }),
      );
    });

    it('should validate updated text length', async () => {
      await expect(
        service.updateAnswer('test-id', {
          answerText: 'a'.repeat(281), // Over 280 char limit
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate updated category count', async () => {
      await expect(
        service.updateAnswer('test-id', {
          categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'], // Max is 3
        }),
      ).rejects.toThrow('Answer can have maximum 3 categories');
    });

    it('should validate categories during update', async () => {
      const mockCategory = {
        id: 'cat-1',
        inclusionNetVotes: 5,
      } as any;

      categoryService.getCategory.mockResolvedValue(mockCategory);

      answerSchema.updateAnswer.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.updateAnswer('test-id', {
        categoryIds: ['cat-1'],
      });

      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-1');
    });

    it('should throw NotFoundException when updating non-existent answer', async () => {
      answerSchema.updateAnswer.mockResolvedValue(null);

      await expect(
        service.updateAnswer('nonexistent-id', {
          publicCredit: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      answerSchema.updateAnswer.mockRejectedValue(new Error('Database error'));

      await expect(
        service.updateAnswer('test-id', { publicCredit: false }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ============================================
  // DELETE ANSWER TESTS
  // ============================================
  describe('deleteAnswer', () => {
    it('should delete an answer', async () => {
      answerSchema.getAnswer.mockResolvedValue({
        id: 'test-id',
        answerText: 'Test',
      } as any);

      answerSchema.delete.mockResolvedValue(undefined);

      const result = await service.deleteAnswer('test-id');

      expect(answerSchema.getAnswer).toHaveBeenCalledWith('test-id');
      expect(answerSchema.delete).toHaveBeenCalledWith('test-id');
      expect(result).toEqual({ success: true });
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.deleteAnswer('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when deleting non-existent answer', async () => {
      answerSchema.getAnswer.mockResolvedValue(null);

      await expect(service.deleteAnswer('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      answerSchema.getAnswer.mockResolvedValue({
        id: 'test-id',
      } as any);

      answerSchema.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.deleteAnswer('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // GET ANSWERS FOR QUESTION TESTS
  // ============================================
  describe('getAnswersForQuestion', () => {
    it('should get answers for a question', async () => {
      const mockAnswers = [
        { id: 'answer-1', answerText: 'Answer 1' },
        { id: 'answer-2', answerText: 'Answer 2' },
      ] as any[];

      answerSchema.getAnswersByQuestion.mockResolvedValue(mockAnswers);

      const result = await service.getAnswersForQuestion('question-123');

      expect(answerSchema.getAnswersByQuestion).toHaveBeenCalledWith(
        'question-123',
        false,
      );
      expect(result).toEqual(mockAnswers);
    });

    it('should apply limit and offset to results', async () => {
      const mockAnswers = [
        { id: 'answer-1' },
        { id: 'answer-2' },
        { id: 'answer-3' },
        { id: 'answer-4' },
      ] as any[];

      answerSchema.getAnswersByQuestion.mockResolvedValue(mockAnswers);

      const result = await service.getAnswersForQuestion('question-123', {
        limit: 2,
        offset: 1,
      });

      // Should skip first answer (offset: 1) and return next 2 (limit: 2)
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('answer-2');
      expect(result[1].id).toBe('answer-3');
    });

    it('should get only approved answers when onlyApproved is true', async () => {
      const mockAnswers = [{ id: 'answer-1', inclusionNetVotes: 5 }] as any[];

      answerSchema.getAnswersByQuestion.mockResolvedValue(mockAnswers);

      await service.getAnswersForQuestion('question-123', {
        onlyApproved: true,
      });

      expect(answerSchema.getAnswersByQuestion).toHaveBeenCalledWith(
        'question-123',
        true,
      );
    });

    it('should throw BadRequestException for empty question ID', async () => {
      await expect(service.getAnswersForQuestion('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      answerSchema.getAnswersByQuestion.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.getAnswersForQuestion('question-123'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ============================================
  // GET TOP ANSWER TESTS
  // ============================================
  describe('getTopAnswerForQuestion', () => {
    it('should get top answer for a question', async () => {
      const mockTopAnswer = {
        id: 'answer-1',
        answerText: 'Best answer',
        contentNetVotes: 10,
      } as any;

      answerSchema.getTopAnswerForQuestion.mockResolvedValue(mockTopAnswer);

      const result = await service.getTopAnswerForQuestion('question-123');

      expect(answerSchema.getTopAnswerForQuestion).toHaveBeenCalledWith(
        'question-123',
      );
      expect(result).toEqual(mockTopAnswer);
    });

    it('should return null when no answers exist', async () => {
      answerSchema.getTopAnswerForQuestion.mockResolvedValue(null);

      const result = await service.getTopAnswerForQuestion('question-123');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty question ID', async () => {
      await expect(service.getTopAnswerForQuestion('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      answerSchema.getTopAnswerForQuestion.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.getTopAnswerForQuestion('question-123'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ============================================
  // VOTING TESTS - DUAL VOTING
  // ============================================
  describe('voteInclusion', () => {
    it('should vote on answer inclusion', async () => {
      answerSchema.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await service.voteInclusion('test-id', 'user-123', true);

      expect(answerSchema.voteInclusion).toHaveBeenCalledWith(
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

      answerSchema.voteInclusion.mockResolvedValue(negativeVoteResult);

      const result = await service.voteInclusion('test-id', 'user-123', false);

      expect(answerSchema.voteInclusion).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        false,
      );
      expect(result).toEqual(negativeVoteResult);
    });

    it('should throw BadRequestException for empty answer ID', async () => {
      await expect(service.voteInclusion('', 'user-123', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.voteInclusion('test-id', '', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      answerSchema.voteInclusion.mockRejectedValue(new Error('Database error'));

      await expect(
        service.voteInclusion('test-id', 'user-123', true),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('voteContent', () => {
    it('should vote on answer content when inclusion passed', async () => {
      const approvedAnswer = {
        id: 'test-id',
        inclusionNetVotes: 5,
      } as any;

      answerSchema.findById.mockResolvedValue(approvedAnswer);
      answerSchema.voteContent.mockResolvedValue(mockVoteResult);

      const result = await service.voteContent('test-id', 'user-123', true);

      expect(answerSchema.voteContent).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException when inclusion not passed', async () => {
      const unapprovedAnswer = {
        id: 'test-id',
        inclusionNetVotes: -1,
      } as any;

      answerSchema.findById.mockResolvedValue(unapprovedAnswer);

      answerSchema.voteContent.mockRejectedValue(
        new BadRequestException(
          'Answer must pass inclusion threshold before content voting is allowed',
        ),
      );

      await expect(
        service.voteContent('test-id', 'user-123', true),
      ).rejects.toThrow(
        'Answer must pass inclusion threshold before content voting is allowed',
      );
    });

    it('should vote negatively on content', async () => {
      const approvedAnswer = {
        id: 'test-id',
        inclusionNetVotes: 5,
      } as any;

      answerSchema.findById.mockResolvedValue(approvedAnswer);

      const negativeVoteResult = {
        ...mockVoteResult,
        contentNegativeVotes: 2,
      };

      answerSchema.voteContent.mockResolvedValue(negativeVoteResult);

      const result = await service.voteContent('test-id', 'user-123', false);

      expect(answerSchema.voteContent).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        false,
      );
      expect(result).toEqual(negativeVoteResult);
    });

    it('should throw BadRequestException for empty answer ID', async () => {
      await expect(service.voteContent('', 'user-123', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.voteContent('test-id', '', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      const approvedAnswer = {
        id: 'test-id',
        inclusionNetVotes: 5,
      } as any;

      answerSchema.findById.mockResolvedValue(approvedAnswer);
      answerSchema.voteContent.mockRejectedValue(new Error('Database error'));

      await expect(
        service.voteContent('test-id', 'user-123', true),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getVoteStatus', () => {
    it('should get vote status for a user', async () => {
      answerSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await service.getVoteStatus('test-id', 'user-123');

      expect(answerSchema.getVoteStatus).toHaveBeenCalledWith(
        'test-id',
        'user-123',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should return null when user has no vote', async () => {
      answerSchema.getVoteStatus.mockResolvedValue(null);

      const result = await service.getVoteStatus('test-id', 'user-123');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty answer ID', async () => {
      await expect(service.getVoteStatus('', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.getVoteStatus('test-id', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      answerSchema.getVoteStatus.mockRejectedValue(new Error('Database error'));

      await expect(
        service.getVoteStatus('test-id', 'user-123'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('removeVote', () => {
    it('should remove inclusion vote from an answer', async () => {
      const voteResult = {
        ...mockVoteResult,
        inclusionPositiveVotes: 5,
        inclusionNetVotes: 3,
      };

      answerSchema.removeVote.mockResolvedValue(voteResult);

      const result = await service.removeVote(
        'test-id',
        'user-123',
        'INCLUSION',
      );

      expect(answerSchema.removeVote).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        'INCLUSION',
      );
      expect(result).toEqual(voteResult);
    });

    it('should remove content vote from an answer', async () => {
      const voteResult = {
        ...mockVoteResult,
        contentPositiveVotes: 2,
        contentNetVotes: 1,
      };

      answerSchema.removeVote.mockResolvedValue(voteResult);

      const result = await service.removeVote('test-id', 'user-123', 'CONTENT');

      expect(answerSchema.removeVote).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        'CONTENT',
      );
      expect(result).toEqual(voteResult);
    });

    it('should throw BadRequestException for empty answer ID', async () => {
      await expect(
        service.removeVote('', 'user-123', 'INCLUSION'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(
        service.removeVote('test-id', '', 'INCLUSION'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      answerSchema.removeVote.mockRejectedValue(new Error('Database error'));

      await expect(
        service.removeVote('test-id', 'user-123', 'INCLUSION'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getVotes', () => {
    it('should get vote totals for an answer', async () => {
      answerSchema.getVotes.mockResolvedValue(mockVoteResult);

      const result = await service.getVotes('test-id');

      expect(answerSchema.getVotes).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockVoteResult);
    });

    it('should return null when answer has no votes', async () => {
      answerSchema.getVotes.mockResolvedValue(null);

      const result = await service.getVotes('test-id');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.getVotes('')).rejects.toThrow(BadRequestException);
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      answerSchema.getVotes.mockRejectedValue(new Error('Database error'));

      await expect(service.getVotes('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // UTILITY METHODS TESTS
  // ============================================
  describe('isAnswerApproved', () => {
    it('should return true when answer has positive net inclusion votes', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: 5,
      };

      answerSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isAnswerApproved('test-id');

      expect(answerSchema.getVotes).toHaveBeenCalledWith('test-id');
      expect(result).toBe(true);
    });

    it('should return false when answer has negative net inclusion votes', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: -3,
      };

      answerSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isAnswerApproved('test-id');

      expect(result).toBe(false);
    });

    it('should return false when answer has exactly zero net inclusion votes', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: 0,
      };

      answerSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isAnswerApproved('test-id');

      expect(result).toBe(false);
    });

    it('should return false when votes are null', async () => {
      answerSchema.getVotes.mockResolvedValue(null);

      const result = await service.isAnswerApproved('test-id');

      expect(result).toBe(false);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.isAnswerApproved('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return false on error', async () => {
      answerSchema.getVotes.mockRejectedValue(new Error('Database error'));

      const result = await service.isAnswerApproved('test-id');

      expect(result).toBe(false);
    });
  });

  describe('isContentVotingAvailable', () => {
    it('should return true when answer is approved', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: 5,
      };

      answerSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isContentVotingAvailable('test-id');

      expect(result).toBe(true);
    });

    it('should return false when answer is not approved', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: -1,
      };

      answerSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isContentVotingAvailable('test-id');

      expect(result).toBe(false);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.isContentVotingAvailable('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return false on error', async () => {
      answerSchema.getVotes.mockRejectedValue(new Error('Database error'));

      const result = await service.isContentVotingAvailable('test-id');

      expect(result).toBe(false);
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  describe('Error Handling', () => {
    it('should handle schema errors consistently', async () => {
      answerSchema.getAnswer.mockRejectedValue(new Error('Database error'));

      await expect(service.getAnswer('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should preserve NotFoundException when answer not found', async () => {
      answerSchema.getAnswer.mockResolvedValue(null);

      await expect(service.getAnswer('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve BadRequestException from validation', async () => {
      await expect(
        service.createAnswer({
          createdBy: '',
          publicCredit: true,
          answerText: 'Test',
          parentQuestionId: 'q-123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // INTEGRATION TESTS
  // ============================================
  describe('Integration - Full Create Flow', () => {
    it('should handle complete answer creation with all features', async () => {
      const answerData = {
        createdBy: 'test-user',
        publicCredit: true,
        answerText:
          'This is a comprehensive answer about artificial intelligence.',
        parentQuestionId: 'question-123',
        categoryIds: ['cat-1', 'cat-2'],
        initialComment: 'Hope this helps!',
      };

      // Mock parent question validation
      openQuestionService.getOpenQuestion.mockResolvedValue({
        id: 'question-123',
        inclusionNetVotes: 10,
      } as any);

      // Mock keyword extraction
      const mockKeywords = [
        { word: 'artificial', frequency: 1, source: 'ai' as const },
        { word: 'intelligence', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      // Mock word creation (words don't exist)
      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      // Mock category validation
      categoryService.getCategory.mockResolvedValue({
        id: 'cat-1',
        inclusionNetVotes: 5,
      } as any);

      // Mock answer creation
      const mockCreatedAnswer = {
        id: 'answer-123',
        answerText: answerData.answerText,
        createdBy: answerData.createdBy,
      } as any;

      answerSchema.createAnswer.mockResolvedValue(mockCreatedAnswer);

      // Mock discussion creation
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
        commentId: 'comment-123',
      });

      const result = await service.createAnswer(answerData);

      // Verify parent question validation
      expect(openQuestionService.getOpenQuestion).toHaveBeenCalledWith(
        answerData.parentQuestionId,
      );

      // Verify keyword extraction
      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: answerData.answerText,
      });

      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'artificial',
        createdBy: answerData.createdBy,
        publicCredit: true,
        isAICreated: true,
      });

      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'intelligence',
        createdBy: answerData.createdBy,
        publicCredit: true,
        isAICreated: true,
      });

      // Verify category validation
      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-1');
      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-2');

      // Verify answer creation
      expect(answerSchema.createAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          answerText: answerData.answerText,
          createdBy: answerData.createdBy,
          keywords: mockKeywords,
          categoryIds: answerData.categoryIds,
        }),
      );

      // Verify discussion creation
      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: expect.any(String),
        nodeType: 'AnswerNode',
        nodeIdField: 'id',
        createdBy: answerData.createdBy,
        initialComment: answerData.initialComment,
      });

      expect(result).toEqual(mockCreatedAnswer);
    });
  });

  describe('Integration - Full Update Flow', () => {
    it('should handle complete answer update with text change', async () => {
      const originalAnswer = {
        id: 'test-id',
        answerText: 'Original answer text',
        createdBy: 'test-user',
        publicCredit: true,
        inclusionNetVotes: 5,
        contentNetVotes: 3,
      };

      const updateData = {
        answerText: 'Updated answer with machine learning concepts',
        categoryIds: ['cat-1'],
      };

      // Mock original answer retrieval
      answerSchema.getAnswer.mockResolvedValue(originalAnswer as any);

      // Mock keyword extraction
      const mockKeywords = [
        { word: 'machine', frequency: 1, source: 'ai' as const },
        { word: 'learning', frequency: 1, source: 'ai' as const },
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

      const mockUpdatedAnswer = {
        ...originalAnswer,
        ...updateData,
      } as any;

      answerSchema.updateAnswer.mockResolvedValue(mockUpdatedAnswer);

      const result = await service.updateAnswer('test-id', updateData);

      // Verify keyword extraction
      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: updateData.answerText,
      });

      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'machine',
        createdBy: originalAnswer.createdBy,
        publicCredit: originalAnswer.publicCredit,
        isAICreated: true,
      });

      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'learning',
        createdBy: originalAnswer.createdBy,
        publicCredit: originalAnswer.publicCredit,
        isAICreated: true,
      });

      // Verify category validation
      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-1');

      // Verify update
      expect(answerSchema.updateAnswer).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          answerText: updateData.answerText,
          keywords: mockKeywords,
          categoryIds: updateData.categoryIds,
        }),
      );

      expect(result).toEqual(mockUpdatedAnswer);
    });
  });
});
