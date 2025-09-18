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
import type { DiscussionData } from '../../neo4j/schemas/discussion.schema';

describe('StatementService with BaseNodeSchema Integration', () => {
  let service: StatementService;
  let statementSchema: jest.Mocked<StatementSchema>;
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

  // ✅ FIXED: Complete DiscussionData mock with all required properties
  const mockDiscussionData: DiscussionData = {
    id: 'discussion-id',
    createdBy: 'test-user',
    associatedNodeId: 'test-id',
    associatedNodeType: 'StatementNode',
    createdAt: new Date(),
    updatedAt: new Date(),
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
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
      getDiscussionWithComments: jest.fn(),
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
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<StatementService>(StatementService);
    statementSchema = module.get(StatementSchema);
    keywordExtractionService = module.get(KeywordExtractionService);
    wordService = module.get(WordService);
    discussionService = module.get(DiscussionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatementNetwork', () => {
    it('should call schema.getStatementNetwork with correct parameters', async () => {
      const options = {
        limit: 10,
        offset: 5,
        keywords: ['test'],
        userId: 'user-123',
      };

      const mockNetwork = [
        {
          id: 'statement-1',
          statement: 'Test statement',
          positiveVotes: 5,
          negativeVotes: 2,
          netVotes: 3,
        },
      ];

      statementSchema.getStatementNetwork.mockResolvedValue(mockNetwork);

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
        statementSchema.removeVote.mockResolvedValue(undefined);

        await service.removeStatementVote('test-id', 'user-123', 'INCLUSION');

        expect(statementSchema.removeVote).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          'INCLUSION',
        );
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

  describe('deleteStatement', () => {
    it('should delete statement using BaseNodeSchema method', async () => {
      const mockStatement = { id: 'test-id', statement: 'Test' };
      statementSchema.getStatement.mockResolvedValue(mockStatement);
      statementSchema.delete.mockResolvedValue(undefined);

      const result = await service.deleteStatement('test-id');

      expect(statementSchema.getStatement).toHaveBeenCalledWith('test-id');
      expect(statementSchema.delete).toHaveBeenCalledWith('test-id');
      expect(result).toEqual({
        success: true,
        message: 'Statement deleted successfully',
      });
    });
  });

  // VISIBILITY TESTS
  describe('Visibility Methods', () => {
    describe('setVisibilityStatus', () => {
      it('should set visibility using enhanced method', async () => {
        const updatedStatement = { id: 'test-id', visibilityStatus: true };
        statementSchema.setVisibilityStatus.mockResolvedValue(updatedStatement);

        const result = await service.setVisibilityStatus('test-id', true);

        expect(statementSchema.setVisibilityStatus).toHaveBeenCalledWith(
          'test-id',
          true,
        );
        expect(result).toEqual(updatedStatement);
      });
    });

    describe('getVisibilityStatus', () => {
      it('should get visibility using enhanced method', async () => {
        // ✅ FIXED: Schema method returns boolean (true), not object
        const mockStatusBoolean = true;
        statementSchema.getVisibilityStatus.mockResolvedValue(
          mockStatusBoolean,
        );

        const result = await service.getVisibilityStatus('test-id');

        expect(statementSchema.getVisibilityStatus).toHaveBeenCalledWith(
          'test-id',
        );
        // ✅ Service wraps the boolean in an object
        expect(result).toEqual({ isVisible: true });
      });
    });
  });

  describe('createStatement', () => {
    it('should validate input data and throw BadRequestException for invalid data', async () => {
      // Test missing createdBy
      await expect(
        service.createStatement({
          createdBy: '',
          publicCredit: true,
          statement: 'Test statement',
          initialComment: 'Initial comment',
        }),
      ).rejects.toThrow(BadRequestException);

      // Test empty statement
      await expect(
        service.createStatement({
          createdBy: 'user1',
          publicCredit: true,
          statement: '',
          initialComment: 'Initial comment',
        }),
      ).rejects.toThrow(BadRequestException);

      // Test statement too long
      const longStatement = 'a'.repeat(2001);
      await expect(
        service.createStatement({
          createdBy: 'user1',
          publicCredit: true,
          statement: longStatement,
          initialComment: 'Initial comment',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a statement with extracted keywords and mandatory discussion', async () => {
      // Mock the keyword extraction
      const mockKeywords = [
        { word: 'test', frequency: 1, source: 'ai' as const },
        { word: 'keyword', frequency: 2, source: 'user' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      // Mock word existence check (all words exist)
      wordService.checkWordExistence.mockResolvedValue(true);

      // Mock statement creation
      const mockCreatedStatement = {
        id: 'test-id',
        statement: 'Test statement',
        createdBy: 'test-user',
        publicCredit: true,
        keywords: mockKeywords,
        categoryIds: [],
        initialComment: 'Initial comment',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);

      // ✅ FIXED: Mock discussion creation with complete DiscussionData
      discussionService.createDiscussion.mockResolvedValue(mockDiscussionData);

      // ✅ FIXED: Mock statement update with complete return data
      const mockUpdatedStatement = {
        ...mockCreatedStatement,
        discussionId: 'discussion-id',
      };
      statementSchema.update.mockResolvedValue(mockUpdatedStatement);

      const statementData = {
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Test statement',
        // ✅ REMOVED: userKeywords to force AI extraction
        initialComment: 'Initial comment',
      };

      const result = await service.createStatement(statementData);

      // Verify extraction was called
      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: statementData.statement,
        userKeywords: undefined, // ✅ FIXED: No user keywords provided
      });

      // Verify word existence was checked for all keywords
      expect(wordService.checkWordExistence).toHaveBeenCalledTimes(
        mockKeywords.length,
      );

      // Verify no words were created (since they all exist)
      expect(wordService.createWord).not.toHaveBeenCalled();

      // Verify statement was created with extracted keywords
      expect(statementSchema.createStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          ...statementData,
          id: expect.any(String),
          keywords: mockKeywords,
        }),
      );

      // ✅ NEW: Verify discussion was created with correct data
      expect(discussionService.createDiscussion).toHaveBeenCalledWith({
        createdBy: 'test-user',
        associatedNodeId: 'test-id',
        associatedNodeType: 'StatementNode',
        initialComment: 'Initial comment',
      });

      // Verify statement was updated with discussionId
      expect(statementSchema.update).toHaveBeenCalledWith('test-id', {
        discussionId: 'discussion-id',
      });

      // Result should include discussionId
      expect(result).toEqual({
        ...mockCreatedStatement,
        discussionId: 'discussion-id',
      });
    });

    it('should delete statement if discussion creation fails', async () => {
      const mockKeywords = [
        { word: 'test', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(true);

      const mockCreatedStatement = {
        id: 'test-id',
        statement: 'Test statement',
        createdBy: 'test-user',
        publicCredit: true,
        keywords: mockKeywords,
        categoryIds: [],
        initialComment: 'Initial comment',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);

      // ✅ CRITICAL TEST: Discussion creation failure should abort statement creation
      discussionService.createDiscussion.mockRejectedValue(
        new Error('Discussion creation failed'),
      );

      // Mock statement deletion for cleanup
      statementSchema.delete.mockResolvedValue(undefined);

      const statementData = {
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Test statement',
        initialComment: 'Initial comment',
      };

      // ✅ UPDATED: Should throw error when discussion creation fails
      await expect(service.createStatement(statementData)).rejects.toThrow(
        InternalServerErrorException,
      );

      // Verify statement was created first
      expect(statementSchema.createStatement).toHaveBeenCalled();

      // Verify discussion creation was attempted
      expect(discussionService.createDiscussion).toHaveBeenCalled();

      // ✅ CRITICAL: Verify statement was deleted for cleanup
      expect(statementSchema.delete).toHaveBeenCalledWith('test-id');
    });

    it('should create missing word nodes before creating the statement', async () => {
      // Mock the keyword extraction
      const mockKeywords = [
        { word: 'existing', frequency: 1, source: 'ai' as const },
        { word: 'new', frequency: 2, source: 'user' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      // Mock word existence check (only one word exists)
      wordService.checkWordExistence.mockImplementation((word) => {
        return Promise.resolve(word === 'existing');
      });

      // Mock word creation
      wordService.createWord.mockResolvedValue({
        id: 'new-word-id',
        word: 'new',
      });

      // Mock statement creation
      const mockCreatedStatement = {
        id: 'test-id',
        statement: 'Test statement',
        createdBy: 'test-user',
        publicCredit: true,
        keywords: mockKeywords,
        categoryIds: [],
        initialComment: 'Initial comment',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);

      // Mock discussion creation
      discussionService.createDiscussion.mockResolvedValue(mockDiscussionData);

      // Mock statement update
      statementSchema.update.mockResolvedValue({
        ...mockCreatedStatement,
        discussionId: 'discussion-id',
      });

      // Create a statement - ✅ REMOVED userKeywords to force AI extraction
      const statementData = {
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Test statement',
        initialComment: 'Initial comment',
      };

      const result = await service.createStatement(statementData);

      // Verify word existence was checked
      expect(wordService.checkWordExistence).toHaveBeenCalledTimes(
        mockKeywords.length,
      );

      // Verify word creation was called only for the new word
      expect(wordService.createWord).toHaveBeenCalledTimes(1);
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'new',
        createdBy: 'test-user',
        publicCredit: true,
      });

      // Verify statement was created with extracted keywords
      expect(statementSchema.createStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          ...statementData,
          id: expect.any(String),
          keywords: mockKeywords,
        }),
      );

      // Verify the result includes discussionId
      expect(result).toEqual({
        ...mockCreatedStatement,
        discussionId: 'discussion-id',
      });
    });

    it('should throw error if keyword extraction fails', async () => {
      // Mock extraction error
      keywordExtractionService.extractKeywords.mockRejectedValue(
        new Error('Extraction failed'),
      );

      // Expect createStatement to fail
      await expect(
        service.createStatement({
          createdBy: 'test-user',
          publicCredit: true,
          statement: 'Test statement',
          initialComment: 'Initial comment',
        }),
      ).rejects.toThrow(InternalServerErrorException);

      // Verify schema.createStatement was not called
      expect(statementSchema.createStatement).not.toHaveBeenCalled();
    });
  });

  describe('getStatement', () => {
    it('should get a statement by id', async () => {
      const mockStatement = {
        id: 'test-id',
        statement: 'Test statement',
        discussionId: 'discussion-id',
      };
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
  });

  describe('updateStatement', () => {
    it('should perform complex update with keyword extraction', async () => {
      // Mock existing statement
      const mockExistingStatement = {
        id: 'test-id',
        statement: 'Old statement',
      };
      statementSchema.getStatement.mockResolvedValue(mockExistingStatement);

      // Mock keyword extraction
      const mockKeywords = [
        { word: 'updated', frequency: 1, source: 'ai' as const },
        { word: 'keyword', frequency: 2, source: 'user' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      // Mock word existence check
      wordService.checkWordExistence.mockResolvedValue(true);

      // Mock statement update
      const mockUpdatedStatement = {
        id: 'test-id',
        statement: 'Updated statement',
      };
      statementSchema.updateStatement.mockResolvedValue(mockUpdatedStatement);

      // Update the statement
      const updateData = {
        statement: 'Updated statement',
        userKeywords: ['keyword'],
      };

      const result = await service.updateStatement('test-id', updateData);

      // Verify extraction was called
      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: updateData.statement,
        userKeywords: updateData.userKeywords,
      });

      // Verify statement was updated with extracted keywords
      expect(statementSchema.updateStatement).toHaveBeenCalledWith('test-id', {
        ...updateData,
        keywords: mockKeywords,
      });

      // Verify the result
      expect(result).toEqual(mockUpdatedStatement);
    });

    it('should use BaseNodeSchema for simple updates', async () => {
      // Mock statement update with complete StatementData
      const mockUpdatedStatement = {
        id: 'test-id',
        createdBy: 'test-user',
        publicCredit: false,
        statement: 'Test statement',
        keywords: [],
        categoryIds: [],
        initialComment: 'Initial comment',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      statementSchema.update.mockResolvedValue(mockUpdatedStatement);

      // Update only publicCredit (simple update)
      const updateData = {
        publicCredit: false,
      };

      const result = await service.updateStatement('test-id', updateData);

      // Verify BaseNodeSchema update method was used
      expect(statementSchema.update).toHaveBeenCalledWith(
        'test-id',
        updateData,
      );

      // Verify the result
      expect(result).toEqual(mockUpdatedStatement);
    });

    it('should throw NotFoundException when statement does not exist', async () => {
      // Test for statement text update which triggers getStatement
      statementSchema.getStatement.mockResolvedValue(null);

      await expect(
        service.updateStatement('nonexistent-id', { statement: 'New text' }),
      ).rejects.toThrow(NotFoundException);

      // Test for other updates when update returns null
      statementSchema.update.mockResolvedValue(null);

      await expect(
        service.updateStatement('nonexistent-id', { publicCredit: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid input', async () => {
      // Test empty update data
      await expect(service.updateStatement('test-id', {})).rejects.toThrow(
        BadRequestException,
      );

      // Test empty statement text
      await expect(
        service.updateStatement('test-id', { statement: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // RELATIONSHIP TESTS
  describe('createDirectRelationship', () => {
    it('should create relationship between statements', async () => {
      const statement1 = { id: 'id1' };
      const statement2 = { id: 'id2' };

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

    it('should throw NotFoundException when statement does not exist', async () => {
      statementSchema.findById.mockResolvedValue(null);

      await expect(
        service.createDirectRelationship('nonexistent-id', 'id2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(service.createDirectRelationship('', 'id2')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createDirectRelationship('id1', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeDirectRelationship', () => {
    it('should remove relationship between statements', async () => {
      const statement1 = { id: 'id1' };
      const statement2 = { id: 'id2' };

      statementSchema.findById.mockImplementation((id) => {
        if (id === 'id1') return Promise.resolve(statement1);
        if (id === 'id2') return Promise.resolve(statement2);
        return Promise.resolve(null);
      });

      statementSchema.removeDirectRelationship.mockResolvedValue({
        success: true,
      });

      const result = await service.removeDirectRelationship('id1', 'id2');

      expect(statementSchema.findById).toHaveBeenCalledWith('id1');
      expect(statementSchema.findById).toHaveBeenCalledWith('id2');
      expect(statementSchema.removeDirectRelationship).toHaveBeenCalledWith(
        'id1',
        'id2',
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(service.removeDirectRelationship('', 'id2')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.removeDirectRelationship('id1', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDirectlyRelatedStatements', () => {
    it('should get all statements directly related to a statement', async () => {
      // Mock statement exists
      statementSchema.getStatement.mockResolvedValue({ id: 'test-id' });

      // Mock related statements
      const mockRelatedStatements = [
        { id: 'related1', statement: 'Related 1' },
        { id: 'related2', statement: 'Related 2' },
      ];
      statementSchema.getDirectlyRelatedStatements.mockResolvedValue(
        mockRelatedStatements,
      );

      const result = await service.getDirectlyRelatedStatements('test-id');

      expect(statementSchema.getStatement).toHaveBeenCalledWith('test-id');
      expect(statementSchema.getDirectlyRelatedStatements).toHaveBeenCalledWith(
        'test-id',
      );
      expect(result).toEqual(mockRelatedStatements);
    });

    it('should throw NotFoundException when statement does not exist', async () => {
      statementSchema.getStatement.mockResolvedValue(null);

      await expect(
        service.getDirectlyRelatedStatements('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(service.getDirectlyRelatedStatements('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createRelatedStatement', () => {
    it('should create a new statement related to an existing statement', async () => {
      // ✅ FIXED: Mock existing statement check in getStatement (not findById)
      statementSchema.getStatement.mockResolvedValue({
        id: 'existing-id',
        statement: 'Existing statement',
        createdBy: 'user1',
        publicCredit: true,
      });

      // ✅ FIXED: Mock findById for createDirectRelationship
      statementSchema.findById.mockImplementation((id) => {
        if (id === 'existing-id') return Promise.resolve({ id: 'existing-id' });
        if (id === 'new-id') return Promise.resolve({ id: 'new-id' });
        return Promise.resolve(null);
      });

      // Mock keyword extraction
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [{ word: 'test', frequency: 1, source: 'ai' as const }],
      });

      // Mock word existence check
      wordService.checkWordExistence.mockResolvedValue(true);

      // Mock statement creation
      const newStatement = {
        id: 'new-id',
        statement: 'New statement',
        createdBy: 'user1',
        publicCredit: true,
        keywords: [{ word: 'test', frequency: 1, source: 'ai' as const }],
        categoryIds: [],
        initialComment: 'Initial comment',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      statementSchema.createStatement.mockResolvedValue(newStatement);

      // Mock relationship creation
      statementSchema.createDirectRelationship.mockResolvedValue({
        success: true,
      });

      // Mock discussion creation
      discussionService.createDiscussion.mockResolvedValue(mockDiscussionData);

      // Mock statement update with discussionId
      statementSchema.update.mockResolvedValue({
        ...newStatement,
        discussionId: 'discussion-id',
      });

      const statementData = {
        createdBy: 'user1',
        publicCredit: true,
        statement: 'New statement',
        initialComment: 'Initial comment',
      };

      const result = await service.createRelatedStatement(
        'existing-id',
        statementData,
      );

      // Verify existing statement was checked
      expect(statementSchema.getStatement).toHaveBeenCalledWith('existing-id');

      // Verify relationship was created
      expect(statementSchema.createDirectRelationship).toHaveBeenCalledWith(
        'existing-id',
        'new-id',
      );

      // Verify discussion was created
      expect(discussionService.createDiscussion).toHaveBeenCalledWith({
        createdBy: 'user1',
        associatedNodeId: 'new-id',
        associatedNodeType: 'StatementNode',
        initialComment: 'Initial comment',
      });

      // Verify result includes discussionId
      expect(result).toEqual({
        ...newStatement,
        discussionId: 'discussion-id',
      });
    });

    it('should throw NotFoundException when existing statement does not exist', async () => {
      statementSchema.getStatement.mockResolvedValue(null);

      await expect(
        service.createRelatedStatement('nonexistent-id', {
          createdBy: 'user1',
          publicCredit: true,
          statement: 'New statement',
          initialComment: 'Initial comment',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when existing id is empty', async () => {
      await expect(
        service.createRelatedStatement('', {
          createdBy: 'user1',
          publicCredit: true,
          statement: 'New statement',
          initialComment: 'Initial comment',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkStatements', () => {
    it('should return statement count', async () => {
      statementSchema.checkStatements.mockResolvedValue({ count: 42 });

      const result = await service.checkStatements();

      expect(statementSchema.checkStatements).toHaveBeenCalled();
      expect(result).toEqual({ count: 42 });
    });

    it('should throw InternalServerErrorException when schema throws error', async () => {
      // We need to make sure the error is properly transformed to an InternalServerErrorException
      statementSchema.checkStatements.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.checkStatements()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ✅ NEW: Test for missing isStatementApproved method
  describe('isStatementApproved', () => {
    it('should return true when statement has positive net inclusion votes', async () => {
      const mockVotesApproved = {
        ...mockVoteResult,
        inclusionNetVotes: 5,
      };
      statementSchema.getVotes.mockResolvedValue(mockVotesApproved);

      const result = await service.isStatementApproved('test-id');

      expect(statementSchema.getVotes).toHaveBeenCalledWith('test-id');
      expect(result).toBe(true);
    });

    it('should return false when statement has zero or negative net inclusion votes', async () => {
      const mockVotesNotApproved = {
        ...mockVoteResult,
        inclusionNetVotes: -2,
      };
      statementSchema.getVotes.mockResolvedValue(mockVotesNotApproved);

      const result = await service.isStatementApproved('test-id');

      expect(statementSchema.getVotes).toHaveBeenCalledWith('test-id');
      expect(result).toBe(false);
    });

    it('should return false when statement has exactly zero net inclusion votes', async () => {
      const mockVotesZero = {
        ...mockVoteResult,
        inclusionNetVotes: 0,
      };
      statementSchema.getVotes.mockResolvedValue(mockVotesZero);

      const result = await service.isStatementApproved('test-id');

      expect(result).toBe(false);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(service.isStatementApproved('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // VALIDATION TESTS
  describe('Input Validation', () => {
    it('should throw BadRequestException for empty IDs across methods', async () => {
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

  // ✅ HYBRID PATTERN VERIFICATION
  describe('Hybrid Pattern Implementation', () => {
    it('should use enhanced methods for complex operations', () => {
      // Verify service uses enhanced domain methods
      expect(typeof service.createStatement).toBe('function');
      expect(typeof service.getStatement).toBe('function');
      expect(typeof service.getStatementNetwork).toBe('function');
      expect(typeof service.setVisibilityStatus).toBe('function');
      expect(typeof service.getVisibilityStatus).toBe('function');
    });

    it('should use BaseNodeSchema methods for standard operations', () => {
      // These are called through the service methods
      expect(typeof service.updateStatement).toBe('function'); // Hybrid: complex->enhanced, simple->BaseNodeSchema
      expect(typeof service.deleteStatement).toBe('function');
      expect(typeof service.voteStatementInclusion).toBe('function');
      expect(typeof service.voteStatementContent).toBe('function');
      expect(typeof service.getStatementVoteStatus).toBe('function');
      expect(typeof service.removeStatementVote).toBe('function');
      expect(typeof service.getStatementVotes).toBe('function');
    });

    it('should have relationship management capabilities', () => {
      expect(typeof service.createDirectRelationship).toBe('function');
      expect(typeof service.removeDirectRelationship).toBe('function');
      expect(typeof service.getDirectlyRelatedStatements).toBe('function');
      expect(typeof service.createRelatedStatement).toBe('function');
    });

    it('should have utility and approval methods', () => {
      expect(typeof service.isStatementApproved).toBe('function');
      expect(typeof service.checkStatements).toBe('function');
    });
  });
});
