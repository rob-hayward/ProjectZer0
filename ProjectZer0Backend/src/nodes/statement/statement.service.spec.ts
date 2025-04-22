import { Test, TestingModule } from '@nestjs/testing';
import { StatementService } from './statement.service';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('StatementService', () => {
  let service: StatementService;
  let statementSchema: jest.Mocked<StatementSchema>;
  let keywordExtractionService: jest.Mocked<KeywordExtractionService>;
  let wordService: jest.Mocked<WordService>;

  // Mock implementations
  const mockStatementSchema = {
    createStatement: jest.fn(),
    getStatement: jest.fn(),
    updateStatement: jest.fn(),
    deleteStatement: jest.fn(),
    setVisibilityStatus: jest.fn(),
    getVisibilityStatus: jest.fn(),
    getStatementNetwork: jest.fn(),
    voteStatement: jest.fn(),
    getStatementVoteStatus: jest.fn(),
    removeStatementVote: jest.fn(),
    getStatementVotes: jest.fn(),
    createDirectRelationship: jest.fn(),
    removeDirectRelationship: jest.fn(),
    getDirectlyRelatedStatements: jest.fn(),
    checkStatements: jest.fn(),
  };

  const mockKeywordExtractionService = {
    extractKeywords: jest.fn(),
  };

  const mockWordService = {
    checkWordExistence: jest.fn(),
    createWord: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatementService,
        {
          provide: StatementSchema,
          useValue: mockStatementSchema,
        },
        {
          provide: KeywordExtractionService,
          useValue: mockKeywordExtractionService,
        },
        {
          provide: WordService,
          useValue: mockWordService,
        },
      ],
    }).compile();

    service = module.get<StatementService>(StatementService);
    statementSchema = module.get(StatementSchema);
    keywordExtractionService = module.get(KeywordExtractionService);
    wordService = module.get(WordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatementNetwork', () => {
    it('should call schema.getStatementNetwork with correct parameters', async () => {
      const options = {
        limit: 10,
        offset: 0,
        sortBy: 'netPositive',
        sortDirection: 'desc',
      };

      const mockStatements = [
        {
          id: 'id1',
          statement: 'test statement',
          positiveVotes: 5,
          negativeVotes: 2,
          netVotes: 3,
        },
      ];

      statementSchema.getStatementNetwork.mockResolvedValue(mockStatements);

      const result = await service.getStatementNetwork(options);

      expect(statementSchema.getStatementNetwork).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockStatements);
    });

    it('should handle Neo4j integer objects for vote counts', async () => {
      const mockStatements = [
        {
          id: 'id1',
          statement: 'test statement',
          positiveVotes: { low: 5, high: 0 },
          negativeVotes: { low: 2, high: 0 },
          netVotes: { low: 3, high: 0 },
        },
      ];

      statementSchema.getStatementNetwork.mockResolvedValue(mockStatements);

      const result = await service.getStatementNetwork({});

      expect(result[0].positiveVotes).toBe(5);
      expect(result[0].negativeVotes).toBe(2);
      expect(result[0].netVotes).toBe(3);
    });

    it('should throw InternalServerErrorException when schema throws error', async () => {
      statementSchema.getStatementNetwork.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getStatementNetwork({})).rejects.toThrow(
        InternalServerErrorException,
      );
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

    it('should create a statement with extracted keywords', async () => {
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
      };
      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);

      // Create a statement
      const statementData = {
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Test statement',
        userKeywords: ['keyword'],
        initialComment: 'Initial comment',
      };

      const result = await service.createStatement(statementData);

      // Verify extraction was called
      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: statementData.statement,
        userKeywords: statementData.userKeywords,
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

      // Verify the result
      expect(result).toEqual(mockCreatedStatement);
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
      };
      statementSchema.createStatement.mockResolvedValue(mockCreatedStatement);

      // Create a statement
      const statementData = {
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Test statement',
        userKeywords: ['new'],
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

      // Verify the result
      expect(result).toEqual(mockCreatedStatement);
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
      const mockStatement = { id: 'test-id', statement: 'Test statement' };
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
    it('should update statement without keywords if text does not change', async () => {
      // Mock statement update
      const mockUpdatedStatement = {
        id: 'test-id',
        publicCredit: false,
      };
      statementSchema.updateStatement.mockResolvedValue(mockUpdatedStatement);

      // Update only publicCredit
      const updateData = {
        publicCredit: false,
      };

      const result = await service.updateStatement('test-id', updateData);

      // Verify extraction was NOT called
      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();
      expect(wordService.checkWordExistence).not.toHaveBeenCalled();
      expect(wordService.createWord).not.toHaveBeenCalled();

      // Verify statement was updated
      expect(statementSchema.updateStatement).toHaveBeenCalledWith(
        'test-id',
        updateData,
      );

      // Verify the result
      expect(result).toEqual(mockUpdatedStatement);
    });

    it('should update statement with new keywords if text changes', async () => {
      // Original statement data
      const originalStatement = {
        id: 'test-id',
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Original statement',
      };
      statementSchema.getStatement.mockResolvedValue(originalStatement);

      // Mock the keyword extraction
      const mockKeywords = [
        { word: 'updated', frequency: 1, source: 'ai' as const },
        { word: 'keyword', frequency: 2, source: 'user' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      // Mock word existence checks
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

    it('should throw NotFoundException when statement does not exist', async () => {
      // Test for statement text update which triggers getStatement
      statementSchema.getStatement.mockResolvedValue(null);

      await expect(
        service.updateStatement('nonexistent-id', { statement: 'New text' }),
      ).rejects.toThrow(NotFoundException);

      // Test for other updates when updateStatement returns null
      statementSchema.updateStatement.mockResolvedValue(null);

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

      // Test too long statement
      const longStatement = 'a'.repeat(2001);
      await expect(
        service.updateStatement('test-id', { statement: longStatement }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteStatement', () => {
    it('should delete a statement by id', async () => {
      // Mock statement existence check
      statementSchema.getStatement.mockResolvedValue({ id: 'test-id' });

      const result = await service.deleteStatement('test-id');

      expect(statementSchema.deleteStatement).toHaveBeenCalledWith('test-id');
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

    it('should throw BadRequestException when id is empty', async () => {
      await expect(service.deleteStatement('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setVisibilityStatus', () => {
    it('should set visibility status for a statement', async () => {
      const mockUpdatedStatement = { id: 'test-id', visibilityStatus: false };
      statementSchema.setVisibilityStatus.mockResolvedValue(
        mockUpdatedStatement,
      );

      const result = await service.setVisibilityStatus('test-id', false);

      expect(statementSchema.setVisibilityStatus).toHaveBeenCalledWith(
        'test-id',
        false,
      );
      expect(result).toEqual(mockUpdatedStatement);
    });

    it('should throw NotFoundException when statement does not exist', async () => {
      statementSchema.setVisibilityStatus.mockResolvedValue(null);

      await expect(
        service.setVisibilityStatus('nonexistent-id', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(service.setVisibilityStatus('', true)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('voteStatement', () => {
    it('should vote on a statement', async () => {
      const mockVoteResult = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };
      statementSchema.voteStatement.mockResolvedValue(mockVoteResult);

      const result = await service.voteStatement('test-id', 'user1', true);

      expect(statementSchema.voteStatement).toHaveBeenCalledWith(
        'test-id',
        'user1',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(service.voteStatement('', 'user1', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when user is not provided', async () => {
      await expect(service.voteStatement('test-id', '', true)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createDirectRelationship', () => {
    it('should create a direct relationship between two statements', async () => {
      // Mock statements exist
      statementSchema.getStatement.mockResolvedValueOnce({ id: 'id1' });
      statementSchema.getStatement.mockResolvedValueOnce({ id: 'id2' });
      statementSchema.createDirectRelationship.mockResolvedValue({
        success: true,
      });

      const result = await service.createDirectRelationship('id1', 'id2');

      expect(statementSchema.getStatement).toHaveBeenCalledWith('id1');
      expect(statementSchema.getStatement).toHaveBeenCalledWith('id2');
      expect(statementSchema.createDirectRelationship).toHaveBeenCalledWith(
        'id1',
        'id2',
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when a statement does not exist', async () => {
      statementSchema.getStatement.mockResolvedValueOnce({ id: 'id1' });
      statementSchema.getStatement.mockResolvedValueOnce(null);

      await expect(
        service.createDirectRelationship('id1', 'id2'),
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
    it('should remove a direct relationship between two statements', async () => {
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
      // Mock existing statement
      statementSchema.getStatement.mockResolvedValue({ id: 'existing-id' });

      // Mock keyword extraction
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [{ word: 'test', frequency: 1, source: 'ai' as const }],
      });

      // Mock word existence check
      wordService.checkWordExistence.mockResolvedValue(true);

      // Mock statement creation
      const newStatement = { id: 'new-id', statement: 'New statement' };
      statementSchema.createStatement.mockResolvedValue(newStatement);

      // Mock relationship creation
      statementSchema.createDirectRelationship.mockResolvedValue({
        success: true,
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

      // Verify result is the new statement
      expect(result).toEqual(newStatement);
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
});
