// src/nodes/statement/statement.service.spec.ts - COMPLETE FIXED VERSION FOR BaseNodeSchema Integration

import { Test, TestingModule } from '@nestjs/testing';
import { StatementService } from './statement.service';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { CategoryService } from '../category/category.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

describe('StatementService with BaseNodeSchema Integration', () => {
  let service: StatementService;
  let statementSchema: jest.Mocked<StatementSchema>;
  let categoryService: jest.Mocked<CategoryService>;
  let keywordExtractionService: jest.Mocked<KeywordExtractionService>;
  let wordService: jest.Mocked<WordService>;
  let discussionService: jest.Mocked<DiscussionService>;

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
    // ✅ FIXED: Mock only methods that actually exist after BaseNodeSchema integration
    const mockStatementSchema = {
      // ✅ Enhanced domain methods (preserved)
      createStatement: jest.fn(),
      getStatement: jest.fn(),
      updateStatement: jest.fn(), // Enhanced version for complex updates
      setVisibilityStatus: jest.fn(),
      getVisibilityStatus: jest.fn(),
      getStatementNetwork: jest.fn(),
      createDirectRelationship: jest.fn(),
      removeDirectRelationship: jest.fn(),
      getDirectlyRelatedStatements: jest.fn(),
      checkStatements: jest.fn(),

      // ✅ BaseNodeSchema inherited methods
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      voteInclusion: jest.fn(),
      voteContent: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
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

    const mockDiscussionService = {
      createDiscussion: jest.fn(),
      getDiscussion: jest.fn(),
    };

    const mockCommentService = {
      createComment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatementService,
        {
          provide: StatementSchema,
          useValue: mockStatementSchema,
        },
        {
          provide: CategoryService,
          useValue: mockCategoryService,
        },
        {
          provide: KeywordExtractionService,
          useValue: mockKeywordExtractionService,
        },
        {
          provide: WordService,
          useValue: mockWordService,
        },
        {
          provide: DiscussionService,
          useValue: mockDiscussionService,
        },
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
      ],
    }).compile();

    service = module.get<StatementService>(StatementService);
    statementSchema = module.get(StatementSchema);
    categoryService = module.get(CategoryService);
    keywordExtractionService = module.get(KeywordExtractionService);
    wordService = module.get(WordService);
    discussionService = module.get(DiscussionService);
    // ✅ REMOVED: commentService is not used in tests
    // commentService = module.get(CommentService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // CRUD OPERATIONS TESTS
  describe('createStatement', () => {
    it('should create statement with keyword extraction and word node creation', async () => {
      const mockKeywords = [
        { word: 'test', frequency: 1, source: 'ai' as const },
        { word: 'keyword', frequency: 2, source: 'user' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      // Mock word existence checks (test: exists, keyword: doesn't exist)
      wordService.checkWordExistence.mockImplementation((word) => {
        return Promise.resolve(word === 'test');
      });

      wordService.createWord.mockResolvedValue({
        id: 'keyword',
        word: 'keyword',
      });

      const mockCreatedStatement = {
        id: 'test-id',
        statement: 'Test statement',
        keywords: mockKeywords,
      };

      // ✅ Mock the enhanced domain method
      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);

      discussionService.createDiscussion.mockResolvedValue({
        id: 'discussion-id',
        createdBy: 'test-user',
        associatedNodeId: expect.any(String),
        associatedNodeType: 'StatementNode',
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      });

      const statementData = {
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Test statement',
        initialComment: 'Initial comment',
      };

      const result = await service.createStatement(statementData);

      // Verify keyword extraction was called
      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: statementData.statement,
        userKeywords: undefined,
      });

      // Verify word existence checks
      expect(wordService.checkWordExistence).toHaveBeenCalledWith('test');
      expect(wordService.checkWordExistence).toHaveBeenCalledWith('keyword');

      // Verify word creation for missing word
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'keyword',
        createdBy: 'test-user',
        publicCredit: true,
      });

      // Verify statement creation with enhanced method
      expect(statementSchema.createStatement).toHaveBeenCalledWith({
        id: expect.any(String),
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Test statement',
        keywords: mockKeywords,
        categoryIds: [],
        initialComment: 'Initial comment',
        parentStatementId: undefined,
      });

      // Verify discussion creation
      expect(discussionService.createDiscussion).toHaveBeenCalledWith({
        createdBy: 'test-user',
        associatedNodeId: expect.any(String),
        associatedNodeType: 'StatementNode',
        initialComment: 'Initial comment',
      });

      expect(result).toEqual(mockCreatedStatement);
    });

    it('should create statement with user-provided keywords', async () => {
      const userKeywords = ['user', 'provided'];
      wordService.checkWordExistence.mockResolvedValue(true);

      const mockCreatedStatement = {
        id: 'test-id',
        statement: 'Test statement',
      };

      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);

      const statementData = {
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Test statement',
        userKeywords: userKeywords,
        initialComment: 'Initial comment',
      };

      const result = await service.createStatement(statementData);

      // Verify extraction was NOT called (user provided keywords)
      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();

      // Verify statement was created with user keywords
      expect(statementSchema.createStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: [
            { word: 'user', frequency: 1, source: 'user' },
            { word: 'provided', frequency: 1, source: 'user' },
          ],
        }),
      );

      expect(result).toEqual(mockCreatedStatement);
    });

    it('should validate categories if provided', async () => {
      const categoryIds = ['cat-1', 'cat-2'];
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      // Mock category validation
      categoryService.getCategory.mockResolvedValue({
        id: 'cat-1',
        name: 'Category 1',
        createdBy: 'user-123',
        publicCredit: true,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 1,
        inclusionNetVotes: 4,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      });

      statementSchema.createStatement.mockResolvedValue({ id: 'test-id' });

      const statementData = {
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Test statement',
        categoryIds: categoryIds,
        initialComment: 'Initial comment',
      };

      await service.createStatement(statementData);

      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-1');
      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-2');
    });

    it('should throw BadRequestException for invalid input', async () => {
      // Test empty statement
      await expect(
        service.createStatement({
          createdBy: 'test-user',
          publicCredit: true,
          statement: '',
          initialComment: 'comment',
        }),
      ).rejects.toThrow(BadRequestException);

      // Test missing creator
      await expect(
        service.createStatement({
          createdBy: '',
          publicCredit: true,
          statement: 'Test statement',
          initialComment: 'comment',
        }),
      ).rejects.toThrow(BadRequestException);

      // Test missing initial comment
      await expect(
        service.createStatement({
          createdBy: 'test-user',
          publicCredit: true,
          statement: 'Test statement',
          initialComment: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should still create statement if discussion creation fails', async () => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      const mockCreatedStatement = {
        id: 'test-id',
        statement: 'Test statement',
      };
      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);

      // Mock discussion creation failure
      discussionService.createDiscussion.mockRejectedValue(
        new Error('Discussion failed'),
      );

      const statementData = {
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Test statement',
        initialComment: 'Initial comment',
      };

      // Should not throw despite discussion creation failure
      const result = await service.createStatement(statementData);

      expect(statementSchema.createStatement).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedStatement);
    });
  });

  describe('getStatement', () => {
    it('should get statement using enhanced domain method', async () => {
      const mockStatement = {
        id: 'test-id',
        statement: 'Test statement',
        keywords: [],
        categories: [],
      };

      // ✅ Mock the enhanced domain method
      statementSchema.getStatement.mockResolvedValue(mockStatement);

      const result = await service.getStatement('test-id');

      expect(statementSchema.getStatement).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockStatement);
    });

    it('should throw NotFoundException when statement does not exist', async () => {
      statementSchema.getStatement.mockResolvedValue(null);

      await expect(service.getStatement('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(service.getStatement('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateStatement', () => {
    it('should use BaseNodeSchema method for simple updates', async () => {
      const mockUpdatedStatement = {
        id: 'test-id',
        createdBy: 'test-user',
        publicCredit: false,
        statement: 'Test statement',
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      // ✅ Mock BaseNodeSchema inherited method
      statementSchema.update.mockResolvedValue(mockUpdatedStatement);

      const updateData = { publicCredit: false };
      const result = await service.updateStatement('test-id', updateData);

      // Verify BaseNodeSchema method was used
      expect(statementSchema.update).toHaveBeenCalledWith(
        'test-id',
        updateData,
      );
      expect(result).toEqual(mockUpdatedStatement);

      // Verify enhanced method was NOT called
      expect(statementSchema.updateStatement).not.toHaveBeenCalled();
    });

    it('should use enhanced method for complex updates (statement text)', async () => {
      const originalStatement = {
        id: 'test-id',
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Original statement',
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      const mockKeywords = [
        { word: 'updated', frequency: 1, source: 'ai' as const },
      ];

      // ✅ Mock BaseNodeSchema method for existence check
      statementSchema.findById.mockResolvedValue(originalStatement);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(true);

      const mockUpdatedStatement = {
        id: 'test-id',
        statement: 'Updated statement',
      };

      // ✅ Mock enhanced domain method for complex update
      statementSchema.updateStatement.mockResolvedValue(mockUpdatedStatement);

      const updateData = { statement: 'Updated statement' };
      const result = await service.updateStatement('test-id', updateData);

      // Verify enhanced method was used
      expect(statementSchema.updateStatement).toHaveBeenCalledWith('test-id', {
        ...updateData,
        keywords: mockKeywords,
      });
      expect(result).toEqual(mockUpdatedStatement);

      // Verify BaseNodeSchema method was NOT called for this complex update
      expect(statementSchema.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when statement does not exist', async () => {
      statementSchema.update.mockResolvedValue(null);

      await expect(
        service.updateStatement('nonexistent-id', { publicCredit: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid input', async () => {
      await expect(service.updateStatement('test-id', {})).rejects.toThrow(
        BadRequestException,
      );

      await expect(
        service.updateStatement('test-id', { statement: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteStatement', () => {
    it('should delete statement using BaseNodeSchema method', async () => {
      const mockStatement = { id: 'test-id' };

      // ✅ Mock enhanced method for existence check
      statementSchema.getStatement.mockResolvedValue(mockStatement);

      // ✅ Mock BaseNodeSchema delete method
      statementSchema.delete.mockResolvedValue(undefined);

      const result = await service.deleteStatement('test-id');

      expect(statementSchema.getStatement).toHaveBeenCalledWith('test-id');
      expect(statementSchema.delete).toHaveBeenCalledWith('test-id');
      expect(result).toEqual({
        success: true,
        message: 'Statement deleted successfully',
      });
    });

    it('should throw NotFoundException when statement does not exist', async () => {
      statementSchema.getStatement.mockResolvedValue(null);

      await expect(service.deleteStatement('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // NETWORK TESTS
  describe('getStatementNetwork', () => {
    it('should use enhanced domain method with correct parameters', async () => {
      const mockNetwork = [{ id: 'statement-1', statement: 'Test' }];
      statementSchema.getStatementNetwork.mockResolvedValue(mockNetwork);

      const options = {
        limit: 10,
        offset: 5,
        keywords: ['test'],
        userId: 'user-123',
      };

      const result = await service.getStatementNetwork(options);

      // ✅ Verify enhanced method called with correct parameter structure
      expect(statementSchema.getStatementNetwork).toHaveBeenCalledWith(
        10, // limit
        5, // offset
        ['test'], // keywords
        undefined, // categories (not used in current schema)
        'user-123', // userId
      );
      expect(result).toEqual(mockNetwork);
    });

    it('should use default values when no options provided', async () => {
      const mockNetwork = [];
      statementSchema.getStatementNetwork.mockResolvedValue(mockNetwork);

      const result = await service.getStatementNetwork();

      expect(statementSchema.getStatementNetwork).toHaveBeenCalledWith(
        20, // default limit
        0, // default offset
        [], // default keywords
        undefined, // categories
        undefined, // userId
      );
      expect(result).toEqual(mockNetwork);
    });
  });

  // VOTING TESTS - Using BaseNodeSchema methods
  describe('Voting Methods', () => {
    describe('voteStatementInclusion', () => {
      it('should use BaseNodeSchema voteInclusion method', async () => {
        statementSchema.voteInclusion.mockResolvedValue(mockVoteResult);

        const result = await service.voteStatementInclusion(
          'test-id',
          'user-123',
          true,
        );

        expect(statementSchema.voteInclusion).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          true,
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('voteStatementContent', () => {
      it('should use BaseNodeSchema voteContent method', async () => {
        statementSchema.voteContent.mockResolvedValue(mockVoteResult);

        const result = await service.voteStatementContent(
          'test-id',
          'user-123',
          false,
        );

        expect(statementSchema.voteContent).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          false,
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('getStatementVoteStatus', () => {
      it('should use BaseNodeSchema getVoteStatus method', async () => {
        statementSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await service.getStatementVoteStatus(
          'test-id',
          'user-123',
        );

        expect(statementSchema.getVoteStatus).toHaveBeenCalledWith(
          'test-id',
          'user-123',
        );
        expect(result).toEqual(mockVoteStatus);
      });
    });

    describe('removeStatementVote', () => {
      it('should use BaseNodeSchema removeVote method', async () => {
        statementSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await service.removeStatementVote(
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
    });

    describe('getStatementVotes', () => {
      it('should use BaseNodeSchema getVotes method', async () => {
        statementSchema.getVotes.mockResolvedValue(mockVoteResult);

        const result = await service.getStatementVotes('test-id');

        expect(statementSchema.getVotes).toHaveBeenCalledWith('test-id');
        expect(result).toEqual(mockVoteResult);
      });
    });
  });

  // RELATIONSHIP TESTS - Using enhanced domain methods
  describe('Relationship Methods', () => {
    describe('createDirectRelationship', () => {
      it('should verify statements exist then create relationship', async () => {
        const mockStatement1 = {
          id: 'id1',
          createdBy: 'user1',
          publicCredit: true,
          statement: 'Statement 1',
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        };

        const mockStatement2 = {
          id: 'id2',
          createdBy: 'user2',
          publicCredit: true,
          statement: 'Statement 2',
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        };

        statementSchema.findById
          .mockResolvedValueOnce(mockStatement1)
          .mockResolvedValueOnce(mockStatement2);

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

      it('should throw NotFoundException if statement does not exist', async () => {
        const mockStatement1 = {
          id: 'id1',
          createdBy: 'user1',
          publicCredit: true,
          statement: 'Statement 1',
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        };

        statementSchema.findById
          .mockResolvedValueOnce(mockStatement1)
          .mockResolvedValueOnce(null);

        await expect(
          service.createDirectRelationship('id1', 'id2'),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('removeDirectRelationship', () => {
      it('should use enhanced domain method', async () => {
        statementSchema.removeDirectRelationship.mockResolvedValue({
          success: true,
        });

        const result = await service.removeDirectRelationship('id1', 'id2');

        expect(statementSchema.removeDirectRelationship).toHaveBeenCalledWith(
          'id1',
          'id2',
        );
        expect(result).toEqual({ success: true });
      });
    });

    describe('getDirectlyRelatedStatements', () => {
      it('should use enhanced domain method', async () => {
        const mockRelated = [{ id: 'related-1' }];
        statementSchema.getDirectlyRelatedStatements.mockResolvedValue(
          mockRelated,
        );

        const result = await service.getDirectlyRelatedStatements('test-id');

        expect(
          statementSchema.getDirectlyRelatedStatements,
        ).toHaveBeenCalledWith('test-id');
        expect(result).toEqual(mockRelated);
      });
    });

    describe('createRelatedStatement', () => {
      it('should verify existing statement then create related statement', async () => {
        const mockExistingStatement = {
          id: 'existing-id',
          createdBy: 'user1',
          publicCredit: true,
          statement: 'Existing statement',
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        };

        statementSchema.findById.mockResolvedValue(mockExistingStatement);

        const newStatementData = {
          createdBy: 'user1',
          publicCredit: true,
          statement: 'New statement',
          initialComment: 'Initial comment',
        };

        const mockNewStatement = { id: 'new-id', statement: 'New statement' };

        // Mock the createStatement call chain
        keywordExtractionService.extractKeywords.mockResolvedValue({
          keywords: [],
        });
        statementSchema.createStatement.mockResolvedValue(mockNewStatement);
        statementSchema.createDirectRelationship.mockResolvedValue({
          success: true,
        });

        const result = await service.createRelatedStatement(
          'existing-id',
          newStatementData,
        );

        expect(statementSchema.findById).toHaveBeenCalledWith('existing-id');
        expect(statementSchema.createStatement).toHaveBeenCalled();
        expect(statementSchema.createDirectRelationship).toHaveBeenCalledWith(
          'existing-id',
          mockNewStatement.id,
        );
        expect(result).toEqual(mockNewStatement);
      });
    });
  });

  // UTILITY TESTS
  describe('Utility Methods', () => {
    describe('checkStatements', () => {
      it('should use enhanced domain method', async () => {
        const mockCount = { count: 42 };
        statementSchema.checkStatements.mockResolvedValue(mockCount);

        const result = await service.checkStatements();

        expect(statementSchema.checkStatements).toHaveBeenCalled();
        expect(result).toEqual(mockCount);
      });
    });

    describe('setVisibilityStatus', () => {
      it('should use enhanced domain method', async () => {
        const mockUpdatedStatement = { id: 'test-id', visibilityStatus: true };
        statementSchema.setVisibilityStatus.mockResolvedValue(
          mockUpdatedStatement,
        );

        const result = await service.setVisibilityStatus('test-id', true);

        expect(statementSchema.setVisibilityStatus).toHaveBeenCalledWith(
          'test-id',
          true,
        );
        expect(result).toEqual(mockUpdatedStatement);
      });
    });

    describe('getVisibilityStatus', () => {
      it('should use enhanced domain method', async () => {
        const mockStatus = true;
        statementSchema.getVisibilityStatus.mockResolvedValue(mockStatus);

        const result = await service.getVisibilityStatus('test-id');

        expect(statementSchema.getVisibilityStatus).toHaveBeenCalledWith(
          'test-id',
        );
        expect(result).toEqual({ isVisible: mockStatus });
      });
    });

    describe('isContentVotingAvailable', () => {
      it('should check inclusion threshold', async () => {
        const mockStatement = {
          id: 'test-id',
          createdBy: 'user1',
          publicCredit: true,
          statement: 'Test statement',
          inclusionNetVotes: 5, // Above threshold
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
          inclusionPositiveVotes: 6,
          inclusionNegativeVotes: 1,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        };
        statementSchema.findById.mockResolvedValue(mockStatement);

        const result = await service.isContentVotingAvailable('test-id');

        expect(statementSchema.findById).toHaveBeenCalledWith('test-id');
        expect(result).toBe(true);
      });

      it('should return false when below threshold', async () => {
        const mockStatement = {
          id: 'test-id',
          createdBy: 'user1',
          publicCredit: true,
          statement: 'Test statement',
          inclusionNetVotes: 1, // Below threshold
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
          inclusionPositiveVotes: 2,
          inclusionNegativeVotes: 1,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        };
        statementSchema.findById.mockResolvedValue(mockStatement);

        const result = await service.isContentVotingAvailable('test-id');

        expect(result).toBe(false);
      });
    });

    describe('getStatementStats', () => {
      it('should return comprehensive statistics', async () => {
        const mockStatement = {
          id: 'test-id',
          inclusionPositiveVotes: 10,
          inclusionNegativeVotes: 3,
          inclusionNetVotes: 7,
          contentPositiveVotes: 5,
          contentNegativeVotes: 1,
          contentNetVotes: 4,
          keywords: ['test', 'keyword'],
          categories: ['cat1'],
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-02'),
        };

        statementSchema.getStatement.mockResolvedValue(mockStatement);

        const result = await service.getStatementStats('test-id');

        expect(result).toEqual({
          id: 'test-id',
          inclusionVotes: {
            positive: 10,
            negative: 3,
            net: 7,
          },
          contentVotes: {
            positive: 5,
            negative: 1,
            net: 4,
          },
          keywordCount: 2,
          categoryCount: 1,
          createdAt: mockStatement.createdAt,
          updatedAt: mockStatement.updatedAt,
        });
      });
    });
  });

  // VALIDATION TESTS
  describe('Validation', () => {
    it('should throw BadRequestException for empty IDs', async () => {
      await expect(service.getStatement('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateStatement('', {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteStatement('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.voteStatementInclusion('', 'user', true),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.voteStatementInclusion('id', '', true),
      ).rejects.toThrow(BadRequestException);
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
    });
  });

  // LEGACY METHOD REMOVAL TESTS
  describe('Removed Legacy Methods', () => {
    it('should not have legacy method signatures in the service', () => {
      // These methods should not exist anymore
      expect((service as any).voteStatement).toBeUndefined();
      expect((service as any).getStatementVoteStatus).toBeDefined(); // This exists but with new implementation
      expect((service as any).removeStatementVote).toBeDefined(); // This exists but with new implementation
      expect((service as any).getStatementVotes).toBeDefined(); // This exists but with new implementation
    });

    it('should use the correct method signatures for voting', () => {
      // Verify the new method signatures work correctly
      expect(typeof service.voteStatementInclusion).toBe('function');
      expect(typeof service.voteStatementContent).toBe('function');
      expect(typeof service.getStatementVoteStatus).toBe('function');
      expect(typeof service.removeStatementVote).toBe('function');
      expect(typeof service.getStatementVotes).toBe('function');
    });
  });

  // ERROR HANDLING TESTS
  describe('Error Handling', () => {
    it('should handle schema errors consistently', async () => {
      statementSchema.getStatement.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getStatement('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should preserve HttpExceptions from dependencies', async () => {
      const badRequestError = new BadRequestException('Invalid input');
      statementSchema.getStatement.mockRejectedValue(badRequestError);

      await expect(service.getStatement('test-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
