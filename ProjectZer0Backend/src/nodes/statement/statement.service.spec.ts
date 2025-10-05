// src/nodes/statement/statement.service.spec.ts - FIXED VERSION

import { Test, TestingModule } from '@nestjs/testing';
import { StatementService } from './statement.service';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
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

describe('StatementService - Comprehensive Tests', () => {
  let service: StatementService;
  let statementSchema: jest.Mocked<StatementSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let userSchema: jest.Mocked<UserSchema>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let categoryService: jest.Mocked<CategoryService>;
  let keywordExtractionService: jest.Mocked<KeywordExtractionService>;
  let wordService: jest.Mocked<WordService>;

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
    const mockStatementSchema = {
      // Domain methods
      createStatement: jest.fn(),
      getStatement: jest.fn(),
      updateStatement: jest.fn(),
      getStatementNetwork: jest.fn(),
      checkStatements: jest.fn(),
      createDirectRelationship: jest.fn(),
      removeDirectRelationship: jest.fn(),
      getDirectlyRelatedStatements: jest.fn(),

      // BaseNodeSchema methods
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      voteInclusion: jest.fn(),
      voteContent: jest.fn(),
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
        StatementService,
        { provide: StatementSchema, useValue: mockStatementSchema },
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

    service = module.get<StatementService>(StatementService);
    statementSchema = module.get(StatementSchema);
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
  // CREATE STATEMENT TESTS
  // ============================================
  describe('createStatement', () => {
    const validStatementData = {
      createdBy: 'test-user',
      publicCredit: true,
      statement: 'Test statement about technology',
      initialComment: 'Initial comment',
    };

    it('should validate and reject empty createdBy', async () => {
      await expect(
        service.createStatement({
          ...validStatementData,
          createdBy: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject empty statement text', async () => {
      await expect(
        service.createStatement({
          ...validStatementData,
          statement: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject empty initialComment', async () => {
      await expect(
        service.createStatement({
          ...validStatementData,
          initialComment: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject statement text that is too long', async () => {
      const longStatement = 'a'.repeat(2001);
      await expect(
        service.createStatement({
          ...validStatementData,
          statement: longStatement,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create a statement with extracted keywords', async () => {
      const mockKeywords = [
        { word: 'test', frequency: 1, source: 'ai' as const },
        { word: 'technology', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(true);

      const mockCreatedStatement = {
        id: 'test-id',
        statement: validStatementData.statement,
        createdBy: validStatementData.createdBy,
        publicCredit: validStatementData.publicCredit,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      } as any;

      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      const result = await service.createStatement(validStatementData);

      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: validStatementData.statement,
      });

      expect(wordService.checkWordExistence).toHaveBeenCalledTimes(
        mockKeywords.length,
      );

      expect(statementSchema.createStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          statement: validStatementData.statement.trim(),
          createdBy: validStatementData.createdBy,
          publicCredit: validStatementData.publicCredit,
          keywords: mockKeywords,
        }),
      );

      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: mockCreatedStatement.id,
        nodeType: 'StatementNode',
        nodeIdField: 'id',
        createdBy: validStatementData.createdBy,
        initialComment: validStatementData.initialComment,
      });

      expect(result).toEqual(mockCreatedStatement);
    });

    it('should create missing words before creating the statement', async () => {
      const mockKeywords = [
        { word: 'existing', frequency: 1, source: 'ai' as const },
        { word: 'newword', frequency: 1, source: 'user' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockImplementation((word) => {
        return Promise.resolve(word === 'existing');
      });

      wordService.createWord.mockResolvedValue({
        id: 'newword',
        word: 'newword',
        createdBy: validStatementData.createdBy,
        publicCredit: true,
      } as any);

      const mockCreatedStatement = {
        id: 'test-id',
        statement: validStatementData.statement,
      } as any;

      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createStatement({
        ...validStatementData,
        userKeywords: ['newword'],
      });

      expect(wordService.checkWordExistence).toHaveBeenCalledTimes(1);
      expect(wordService.createWord).toHaveBeenCalledTimes(1);
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'newword',
        createdBy: validStatementData.createdBy,
        publicCredit: validStatementData.publicCredit,
      });
    });

    it('should use user keywords when provided instead of extracting', async () => {
      const mockUserKeywords = ['custom', 'keywords'];

      wordService.checkWordExistence.mockResolvedValue(true);

      const mockCreatedStatement = {
        id: 'test-id',
        statement: validStatementData.statement,
      } as any;

      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createStatement({
        ...validStatementData,
        userKeywords: mockUserKeywords,
      });

      // Should NOT call extraction service
      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();

      // Should call with user keywords
      expect(statementSchema.createStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: [
            { word: 'custom', frequency: 1, source: 'user' },
            { word: 'keywords', frequency: 1, source: 'user' },
          ],
        }),
      );
    });

    it('should continue if discussion creation fails', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      const mockCreatedStatement = {
        id: 'test-id',
        statement: validStatementData.statement,
      } as any;

      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);
      discussionSchema.createDiscussionForNode.mockRejectedValue(
        new Error('Discussion creation failed'),
      );

      // Should not throw despite discussion creation failure
      const result = await service.createStatement(validStatementData);

      expect(statementSchema.createStatement).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedStatement);
    });

    it('should throw InternalServerErrorException if keyword extraction fails', async () => {
      keywordExtractionService.extractKeywords.mockRejectedValue(
        new Error('Extraction failed'),
      );

      await expect(service.createStatement(validStatementData)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(statementSchema.createStatement).not.toHaveBeenCalled();
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      statementSchema.createStatement.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.createStatement(validStatementData)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should preserve BadRequestException from dependencies', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      statementSchema.createStatement.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(service.createStatement(validStatementData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate and reject too many categories', async () => {
      // Mock keyword extraction to prevent it from failing first
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      await expect(
        service.createStatement({
          ...validStatementData,
          categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'], // Max is 3
        }),
      ).rejects.toThrow('Maximum 3 categories allowed');
    });
  });

  // ============================================
  // GET STATEMENT TESTS
  // ============================================
  describe('getStatement', () => {
    it('should retrieve a statement by ID', async () => {
      const mockStatement = {
        id: 'test-id',
        statement: 'Test statement',
        createdBy: 'user-123',
        publicCredit: true,
      } as any;

      statementSchema.findById.mockResolvedValue(mockStatement);

      const result = await service.getStatement('test-id');

      expect(statementSchema.findById).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockStatement);
    });

    it('should throw NotFoundException when statement does not exist', async () => {
      statementSchema.findById.mockResolvedValue(null);

      await expect(service.getStatement('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.getStatement('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      statementSchema.findById.mockRejectedValue(new Error('Database error'));

      await expect(service.getStatement('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // UPDATE STATEMENT TESTS
  // ============================================
  describe('updateStatement', () => {
    it('should throw BadRequestException for empty update data', async () => {
      await expect(service.updateStatement('test-id', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update statement without keywords when text does not change', async () => {
      const mockUpdatedStatement = {
        id: 'test-id',
        publicCredit: false,
        statement: 'Original',
        createdBy: 'user',
      } as any;

      statementSchema.update.mockResolvedValue(mockUpdatedStatement);

      const result = await service.updateStatement('test-id', {
        publicCredit: false,
      });

      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();
      expect(statementSchema.update).toHaveBeenCalledWith('test-id', {
        publicCredit: false,
        keywords: undefined,
      });
      expect(result).toEqual(mockUpdatedStatement);
    });

    it('should extract and update keywords when statement text changes', async () => {
      const mockKeywords = [
        { word: 'updated', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(true);

      const mockUpdatedStatement = {
        id: 'test-id',
        statement: 'Updated statement',
      } as any;

      statementSchema.update.mockResolvedValue(mockUpdatedStatement);

      const result = await service.updateStatement('test-id', {
        statement: 'Updated statement',
      });

      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: 'Updated statement',
      });

      expect(statementSchema.update).toHaveBeenCalledWith('test-id', {
        statement: 'Updated statement',
        keywords: mockKeywords,
      });

      expect(result).toEqual(mockUpdatedStatement);
    });

    it('should create missing words when updating statement text', async () => {
      const mockKeywords = [
        { word: 'existing', frequency: 1, source: 'ai' as const },
        { word: 'newword', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockImplementation((word) => {
        return Promise.resolve(word === 'existing');
      });

      const originalStatement = {
        id: 'test-id',
        createdBy: 'user-123',
        statement: 'Original',
      } as any;

      statementSchema.findById.mockResolvedValue(originalStatement);

      wordService.createWord.mockResolvedValue({
        id: 'newword',
        word: 'newword',
      } as any);

      const mockUpdatedStatement = {
        id: 'test-id',
        statement: 'Updated statement',
      } as any;

      statementSchema.update.mockResolvedValue(mockUpdatedStatement);

      await service.updateStatement('test-id', {
        statement: 'Updated statement',
      });

      expect(wordService.checkWordExistence).toHaveBeenCalledTimes(2);
      expect(wordService.createWord).toHaveBeenCalledTimes(1);
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'newword',
        createdBy: 'user-123',
        publicCredit: true,
      });
    });

    it('should continue updating if keyword extraction fails', async () => {
      keywordExtractionService.extractKeywords.mockRejectedValue(
        new Error('Extraction failed'),
      );

      const mockUpdatedStatement = {
        id: 'test-id',
        statement: 'Updated statement',
      } as any;

      statementSchema.update.mockResolvedValue(mockUpdatedStatement);

      // Should not throw, should continue without new keywords
      const result = await service.updateStatement('test-id', {
        statement: 'Updated statement',
      });

      expect(statementSchema.update).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedStatement);
    });

    it('should throw NotFoundException when updateStatement returns null', async () => {
      statementSchema.update.mockResolvedValue(null);

      await expect(
        service.updateStatement('nonexistent-id', { publicCredit: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate and reject empty statement text', async () => {
      await expect(
        service.updateStatement('test-id', { statement: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject statement text that is too long', async () => {
      const longStatement = 'a'.repeat(2001);
      await expect(
        service.updateStatement('test-id', { statement: longStatement }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject too many categories', async () => {
      await expect(
        service.updateStatement('test-id', {
          categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'],
        }),
      ).rejects.toThrow('Maximum 3 categories allowed');
    });
  });

  // ============================================
  // DELETE STATEMENT TESTS
  // ============================================
  describe('deleteStatement', () => {
    it('should delete a statement using BaseNodeSchema delete method', async () => {
      statementSchema.delete.mockResolvedValue({ success: true });

      await service.deleteStatement('test-id');

      expect(statementSchema.delete).toHaveBeenCalledWith('test-id');
    });

    it('should throw NotFoundException when delete throws NotFoundException', async () => {
      statementSchema.delete.mockRejectedValue(
        new NotFoundException('Statement not found'),
      );

      await expect(service.deleteStatement('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.deleteStatement('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap unknown delete errors in InternalServerErrorException', async () => {
      statementSchema.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(service.deleteStatement('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // VOTING TESTS
  // ============================================
  describe('Voting Operations', () => {
    describe('voteInclusion', () => {
      it('should delegate to schema voteInclusion method', async () => {
        statementSchema.voteInclusion.mockResolvedValue(mockVoteResult);

        const result = await service.voteInclusion('test-id', 'user-123', true);

        expect(statementSchema.voteInclusion).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          true,
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for empty statement ID', async () => {
        await expect(
          service.voteInclusion('', 'user-123', true),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for empty user ID', async () => {
        await expect(
          service.voteInclusion('test-id', '', true),
        ).rejects.toThrow(BadRequestException);
      });

      it('should preserve NotFoundException from schema', async () => {
        statementSchema.voteInclusion.mockRejectedValue(
          new NotFoundException('Statement not found'),
        );

        await expect(
          service.voteInclusion('test-id', 'user-123', true),
        ).rejects.toThrow(NotFoundException);
      });

      it('should wrap unknown errors in InternalServerErrorException', async () => {
        statementSchema.voteInclusion.mockRejectedValue(
          new Error('Database error'),
        );

        await expect(
          service.voteInclusion('test-id', 'user-123', true),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('voteContent', () => {
      it('should delegate to schema voteContent method', async () => {
        statementSchema.voteContent.mockResolvedValue(mockVoteResult);

        const result = await service.voteContent('test-id', 'user-123', false);

        expect(statementSchema.voteContent).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          false,
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for empty IDs', async () => {
        await expect(
          service.voteContent('', 'user-123', false),
        ).rejects.toThrow(BadRequestException);

        await expect(service.voteContent('test-id', '', false)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should preserve BadRequestException from schema (inclusion threshold)', async () => {
        statementSchema.voteContent.mockRejectedValue(
          new BadRequestException('Statement must pass inclusion threshold'),
        );

        await expect(
          service.voteContent('test-id', 'user-123', true),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getVoteStatus', () => {
      it('should retrieve vote status for a user', async () => {
        statementSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await service.getVoteStatus('test-id', 'user-123');

        expect(statementSchema.getVoteStatus).toHaveBeenCalledWith(
          'test-id',
          'user-123',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when no votes exist', async () => {
        statementSchema.getVoteStatus.mockResolvedValue(null);

        const result = await service.getVoteStatus('test-id', 'user-123');

        expect(result).toBeNull();
      });

      it('should throw BadRequestException for empty IDs', async () => {
        await expect(service.getVoteStatus('', 'user-123')).rejects.toThrow(
          BadRequestException,
        );

        await expect(service.getVoteStatus('test-id', '')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('removeVote', () => {
      it('should remove inclusion vote', async () => {
        statementSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await service.removeVote(
          'test-id',
          'user-123',
          'INCLUSION',
        );

        expect(statementSchema.removeVote).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should remove content vote', async () => {
        statementSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await service.removeVote(
          'test-id',
          'user-123',
          'CONTENT',
        );

        expect(statementSchema.removeVote).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for empty IDs', async () => {
        await expect(
          service.removeVote('', 'user-123', 'INCLUSION'),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.removeVote('test-id', '', 'INCLUSION'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getVotes', () => {
      it('should retrieve vote counts for a statement', async () => {
        statementSchema.getVotes.mockResolvedValue(mockVoteResult);

        const result = await service.getVotes('test-id');

        expect(statementSchema.getVotes).toHaveBeenCalledWith('test-id');
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(service.getVotes('')).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ============================================
  // RELATIONSHIP TESTS
  // ============================================
  describe('Relationship Operations', () => {
    describe('createDirectRelationship', () => {
      it('should create a relationship between two statements', async () => {
        const statement1 = {
          id: 'id1',
          statement: 'Test 1',
          createdBy: 'user',
          publicCredit: true,
        } as any;
        const statement2 = {
          id: 'id2',
          statement: 'Test 2',
          createdBy: 'user',
          publicCredit: true,
        } as any;

        statementSchema.findById.mockImplementation((id) => {
          if (id === 'id1') return Promise.resolve(statement1);
          if (id === 'id2') return Promise.resolve(statement2);
          return Promise.resolve(null);
        });

        statementSchema.createDirectRelationship.mockResolvedValue({
          success: true,
        });

        const result = await service.createDirectRelationship('id1', 'id2');

        expect(statementSchema.findById).toHaveBeenCalledWith('id1');
        expect(statementSchema.findById).toHaveBeenCalledWith('id2');
        expect(statementSchema.createDirectRelationship).toHaveBeenCalledWith(
          'id1',
          'id2',
        );
        expect(result).toEqual({ success: true });
      });

      it('should throw NotFoundException when first statement does not exist', async () => {
        statementSchema.findById.mockResolvedValue(null);

        await expect(
          service.createDirectRelationship('nonexistent', 'id2'),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw NotFoundException when second statement does not exist', async () => {
        const statement1 = { id: 'id1' } as any;
        statementSchema.findById.mockResolvedValueOnce(statement1);
        statementSchema.findById.mockResolvedValueOnce(null);

        await expect(
          service.createDirectRelationship('id1', 'nonexistent'),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException for empty IDs', async () => {
        await expect(
          service.createDirectRelationship('', 'id2'),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.createDirectRelationship('id1', ''),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('removeDirectRelationship', () => {
      it('should remove a relationship between two statements', async () => {
        statementSchema.removeDirectRelationship.mockResolvedValue(undefined);

        await service.removeDirectRelationship('id1', 'id2');

        expect(statementSchema.removeDirectRelationship).toHaveBeenCalledWith(
          'id1',
          'id2',
        );
      });

      it('should throw BadRequestException for empty IDs', async () => {
        await expect(
          service.removeDirectRelationship('', 'id2'),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.removeDirectRelationship('id1', ''),
        ).rejects.toThrow(BadRequestException);
      });

      it('should wrap unknown errors in InternalServerErrorException', async () => {
        statementSchema.removeDirectRelationship.mockRejectedValue(
          new Error('Database error'),
        );

        await expect(
          service.removeDirectRelationship('id1', 'id2'),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('getDirectlyRelatedStatements', () => {
      it('should retrieve directly related statements', async () => {
        const mockStatement = {
          id: 'test-id',
          statement: 'Test',
          createdBy: 'user',
          publicCredit: true,
        } as any;

        statementSchema.findById.mockResolvedValue(mockStatement);

        const mockRelatedStatements = [
          {
            id: 'related1',
            statement: 'Related 1',
            createdBy: 'user',
            publicCredit: true,
          },
          {
            id: 'related2',
            statement: 'Related 2',
            createdBy: 'user',
            publicCredit: true,
          },
        ] as any[];

        statementSchema.getDirectlyRelatedStatements.mockResolvedValue(
          mockRelatedStatements,
        );

        const result = await service.getDirectlyRelatedStatements('test-id');

        expect(statementSchema.findById).toHaveBeenCalledWith('test-id');
        expect(
          statementSchema.getDirectlyRelatedStatements,
        ).toHaveBeenCalledWith('test-id');
        expect(result).toEqual(mockRelatedStatements);
      });

      it('should throw NotFoundException when statement does not exist', async () => {
        statementSchema.findById.mockResolvedValue(null);

        await expect(
          service.getDirectlyRelatedStatements('nonexistent-id'),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(service.getDirectlyRelatedStatements('')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('createRelatedStatement', () => {
      it('should create a related statement', async () => {
        const parentStatement = {
          id: 'parent-id',
          statement: 'Parent',
          createdBy: 'user',
          publicCredit: true,
        } as any;

        statementSchema.findById.mockResolvedValue(parentStatement);

        const mockKeywords = [
          { word: 'test', frequency: 1, source: 'ai' as const },
        ];

        keywordExtractionService.extractKeywords.mockResolvedValue({
          keywords: mockKeywords,
        });

        wordService.checkWordExistence.mockResolvedValue(true);

        const mockCreatedStatement = {
          id: 'child-id',
          statement: 'Child statement',
          parentStatementId: 'parent-id',
        } as any;

        statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);
        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-123',
        });

        const result = await service.createRelatedStatement('parent-id', {
          statement: 'Child statement',
          createdBy: 'user-123',
          publicCredit: true,
          initialComment: 'Comment',
        });

        expect(statementSchema.findById).toHaveBeenCalledWith('parent-id');
        expect(statementSchema.createStatement).toHaveBeenCalledWith(
          expect.objectContaining({
            parentStatementId: 'parent-id',
          }),
        );
        expect(result).toEqual(mockCreatedStatement);
      });

      it('should throw NotFoundException when parent does not exist', async () => {
        statementSchema.findById.mockResolvedValue(null);

        await expect(
          service.createRelatedStatement('nonexistent', {
            statement: 'Child',
            createdBy: 'user',
            publicCredit: true,
            initialComment: 'Comment',
          }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException for empty parent ID', async () => {
        await expect(
          service.createRelatedStatement('', {
            statement: 'Child',
            createdBy: 'user',
            publicCredit: true,
            initialComment: 'Comment',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ============================================
  // QUERY OPERATIONS TESTS
  // ============================================
  describe('getStatementNetwork', () => {
    it('should delegate to schema getStatementNetwork', async () => {
      const options = {
        limit: 10,
        offset: 5,
        keywords: ['test'],
        userId: 'user-123',
      };

      const mockNetwork = [
        {
          id: 'id1',
          statement: 'test statement',
          createdBy: 'user',
          publicCredit: true,
          inclusionPositiveVotes: 5,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 3,
        },
      ] as any[];

      statementSchema.getStatementNetwork.mockResolvedValue(mockNetwork);

      const result = await service.getStatementNetwork(options);

      expect(statementSchema.getStatementNetwork).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockNetwork);
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      statementSchema.getStatementNetwork.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getStatementNetwork({})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('checkStatements', () => {
    it('should return statement count from schema', async () => {
      statementSchema.checkStatements.mockResolvedValue({ count: 42 });

      const result = await service.checkStatements();

      expect(statementSchema.checkStatements).toHaveBeenCalled();
      expect(result).toEqual({ count: 42 });
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      statementSchema.checkStatements.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.checkStatements()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // UTILITY METHODS TESTS
  // ============================================
  describe('isStatementApproved', () => {
    it('should return true when statement has positive net inclusion votes', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: 5,
      };
      statementSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isStatementApproved('test-id');

      expect(statementSchema.getVotes).toHaveBeenCalledWith('test-id');
      expect(result).toBe(true);
    });

    it('should return false when statement has negative net inclusion votes', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: -3,
      };
      statementSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isStatementApproved('test-id');

      expect(result).toBe(false);
    });

    it('should return false when statement has exactly zero net inclusion votes', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: 0,
      };
      statementSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isStatementApproved('test-id');

      expect(result).toBe(false);
    });

    it('should return false when votes are null', async () => {
      statementSchema.getVotes.mockResolvedValue(null);

      const result = await service.isStatementApproved('test-id');

      expect(result).toBe(false);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.isStatementApproved('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      statementSchema.getVotes.mockRejectedValue(new Error('Database error'));

      await expect(service.isStatementApproved('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('isContentVotingAvailable', () => {
    it('should return true when statement is approved', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: 5,
      };
      statementSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isContentVotingAvailable('test-id');

      expect(result).toBe(true);
    });

    it('should return false when statement is not approved', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: -1,
      };
      statementSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isContentVotingAvailable('test-id');

      expect(result).toBe(false);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.isContentVotingAvailable('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  describe('Error Handling', () => {
    it('should handle schema errors consistently', async () => {
      statementSchema.findById.mockRejectedValue(new Error('Database error'));

      await expect(service.getStatement('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should wrap BadRequestException in InternalServerErrorException', async () => {
      const badRequestError = new BadRequestException('Invalid input');
      statementSchema.findById.mockRejectedValue(badRequestError);

      // getStatement wraps all exceptions except NotFoundException
      await expect(service.getStatement('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.getStatement('test-id')).rejects.toThrow(
        'Failed to get statement: Invalid input',
      );
    });

    it('should preserve NotFoundException from dependencies', async () => {
      const notFoundError = new NotFoundException('Statement not found');
      statementSchema.findById.mockRejectedValue(notFoundError);

      await expect(service.getStatement('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should wrap generic errors with descriptive messages', async () => {
      statementSchema.findById.mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect(service.getStatement('test-id')).rejects.toThrow(
        'Failed to get statement: Connection timeout',
      );
    });
  });

  // ============================================
  // VALIDATION TESTS
  // ============================================
  describe('Input Validation', () => {
    it('should throw BadRequestException for empty IDs across all methods', async () => {
      await expect(service.getStatement('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateStatement('', {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteStatement('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.voteInclusion('', 'user', true)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.voteInclusion('id', '', true)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.voteContent('', 'user', true)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.voteContent('id', '', true)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getVoteStatus('', 'user')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getVoteStatus('id', '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getVotes('')).rejects.toThrow(BadRequestException);
      await expect(service.removeVote('', 'user', 'INCLUSION')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.removeVote('id', '', 'INCLUSION')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate statement text length', async () => {
      const longStatement = 'a'.repeat(2001);

      await expect(
        service.createStatement({
          createdBy: 'user',
          publicCredit: true,
          statement: longStatement,
          initialComment: 'comment',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateStatement('test-id', { statement: longStatement }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate required fields for createStatement', async () => {
      await expect(
        service.createStatement({
          createdBy: '',
          publicCredit: true,
          statement: 'Test',
          initialComment: 'comment',
        }),
      ).rejects.toThrow('Creator ID is required');

      await expect(
        service.createStatement({
          createdBy: 'user',
          publicCredit: true,
          statement: '',
          initialComment: 'comment',
        }),
      ).rejects.toThrow('Statement text is required');

      await expect(
        service.createStatement({
          createdBy: 'user',
          publicCredit: true,
          statement: 'Test',
          initialComment: '',
        }),
      ).rejects.toThrow('Initial comment is required');
    });
  });

  // ============================================
  // INTEGRATION TESTS
  // ============================================
  describe('Integration Scenarios', () => {
    it('should handle complete statement lifecycle', async () => {
      // Create
      const mockKeywords = [
        { word: 'test', frequency: 1, source: 'ai' as const },
      ];
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });
      wordService.checkWordExistence.mockResolvedValue(true);

      const createdStatement = {
        id: 'test-id',
        statement: 'Test statement',
        createdBy: 'user-123',
        publicCredit: true,
      } as any;

      statementSchema.createStatement.mockResolvedValue(createdStatement);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      const createResult = await service.createStatement({
        createdBy: 'user-123',
        publicCredit: true,
        statement: 'Test statement',
        initialComment: 'Initial comment',
      });

      expect(createResult).toEqual(createdStatement);

      // Read
      statementSchema.findById.mockResolvedValue(createdStatement);
      const getResult = await service.getStatement('test-id');
      expect(getResult).toEqual(createdStatement);

      // Update
      const updatedStatement = {
        ...createdStatement,
        publicCredit: false,
      } as any;
      statementSchema.update.mockResolvedValue(updatedStatement);

      const updateResult = await service.updateStatement('test-id', {
        publicCredit: false,
      });
      expect(updateResult.publicCredit).toBe(false);

      // Vote
      statementSchema.voteInclusion.mockResolvedValue(mockVoteResult);
      const voteResult = await service.voteInclusion(
        'test-id',
        'user-456',
        true,
      );
      expect(voteResult).toEqual(mockVoteResult);

      // Delete
      statementSchema.delete.mockResolvedValue({ success: true });

      await service.deleteStatement('test-id');
      expect(statementSchema.delete).toHaveBeenCalledWith('test-id');
    });

    it('should handle keyword extraction and word creation flow', async () => {
      const mockKeywords = [
        { word: 'existing', frequency: 2, source: 'ai' as const },
        { word: 'newword', frequency: 1, source: 'user' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockImplementation((word) => {
        return Promise.resolve(word === 'existing');
      });

      wordService.createWord.mockResolvedValue({
        id: 'newword',
        word: 'newword',
      } as any);

      const mockCreatedStatement = {
        id: 'test-id',
        statement: 'Test with existing and newword',
      } as any;

      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      await service.createStatement({
        createdBy: 'user-123',
        publicCredit: true,
        statement: 'Test with existing and newword',
        userKeywords: ['newword'],
        initialComment: 'comment',
      });

      expect(wordService.checkWordExistence).toHaveBeenCalledTimes(1);
      expect(wordService.createWord).toHaveBeenCalledTimes(1);
      expect(statementSchema.createStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: [{ word: 'newword', frequency: 1, source: 'user' }],
        }),
      );
    });

    it('should handle voting workflow with approval check', async () => {
      // Vote on inclusion
      statementSchema.voteInclusion.mockResolvedValue({
        ...mockVoteResult,
        inclusionNetVotes: 1,
      });

      await service.voteInclusion('test-id', 'user-123', true);

      // Check if approved
      statementSchema.getVotes.mockResolvedValue({
        ...mockVoteResult,
        inclusionNetVotes: 1,
      });

      const isApproved = await service.isStatementApproved('test-id');
      expect(isApproved).toBe(true);

      // Check if content voting is available
      const isAvailable = await service.isContentVotingAvailable('test-id');
      expect(isAvailable).toBe(true);

      // Vote on content
      statementSchema.voteContent.mockResolvedValue(mockVoteResult);

      const contentVoteResult = await service.voteContent(
        'test-id',
        'user-123',
        true,
      );
      expect(contentVoteResult).toEqual(mockVoteResult);
    });
  });
});
