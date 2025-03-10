import { Test, TestingModule } from '@nestjs/testing';
import { StatementService } from './statement.service';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service'; // Add this import

describe('StatementService', () => {
  let service: StatementService;
  let statementSchema: StatementSchema;
  let keywordExtractionService: KeywordExtractionService;
  let wordService: WordService; // Add this

  // Mock implementations
  const mockStatementSchema = {
    createStatement: jest.fn(),
    getStatement: jest.fn(),
    updateStatement: jest.fn(),
    deleteStatement: jest.fn(),
    setVisibilityStatus: jest.fn(),
    getVisibilityStatus: jest.fn(),
  };

  const mockKeywordExtractionService = {
    extractKeywords: jest.fn(),
  };

  // Add mock for WordService
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
          provide: WordService, // Add WordService provider
          useValue: mockWordService,
        },
      ],
    }).compile();

    service = module.get<StatementService>(StatementService);
    statementSchema = module.get<StatementSchema>(StatementSchema);
    keywordExtractionService = module.get<KeywordExtractionService>(
      KeywordExtractionService,
    );
    wordService = module.get<WordService>(WordService); // Get the mock WordService
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createStatement', () => {
    it('should create a statement with extracted keywords', async () => {
      // Mock the keyword extraction
      const mockKeywords = [
        { word: 'test', frequency: 1, source: 'ai' },
        { word: 'keyword', frequency: 2, source: 'user' },
      ];

      mockKeywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      // Mock word existence check (all words exist)
      mockWordService.checkWordExistence.mockResolvedValue(true);

      // Mock statement creation
      const mockCreatedStatement = {
        id: 'test-id',
        statement: 'Test statement',
      };
      mockStatementSchema.createStatement.mockResolvedValue(
        mockCreatedStatement,
      );

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
        { word: 'existing', frequency: 1, source: 'ai' },
        { word: 'new', frequency: 2, source: 'user' },
      ];

      mockKeywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      // Mock word existence check (only one word exists)
      mockWordService.checkWordExistence.mockImplementation((word) => {
        return Promise.resolve(word === 'existing');
      });

      // Mock word creation
      mockWordService.createWord.mockResolvedValue({
        id: 'new-word-id',
        word: 'new',
      });

      // Mock statement creation
      const mockCreatedStatement = {
        id: 'test-id',
        statement: 'Test statement',
      };
      mockStatementSchema.createStatement.mockResolvedValue(
        mockCreatedStatement,
      );

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
      mockKeywordExtractionService.extractKeywords.mockRejectedValue(
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
      ).rejects.toThrow('Statement creation failed: Extraction failed');

      // Verify schema.createStatement was not called
      expect(statementSchema.createStatement).not.toHaveBeenCalled();
    });
  });

  describe('updateStatement', () => {
    it('should update statement with new keywords if text changes', async () => {
      // Original statement data
      const originalStatement = {
        id: 'test-id',
        createdBy: 'test-user',
        publicCredit: true,
        statement: 'Original statement',
      };
      mockStatementSchema.getStatement.mockResolvedValue(originalStatement);

      // Mock the keyword extraction
      const mockKeywords = [
        { word: 'updated', frequency: 1, source: 'ai' },
        { word: 'keyword', frequency: 2, source: 'user' },
      ];

      mockKeywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      // Mock word existence checks
      mockWordService.checkWordExistence.mockResolvedValue(true);

      // Mock statement update
      const mockUpdatedStatement = {
        id: 'test-id',
        statement: 'Updated statement',
      };
      mockStatementSchema.updateStatement.mockResolvedValue(
        mockUpdatedStatement,
      );

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

      // Verify word existence was checked
      expect(wordService.checkWordExistence).toHaveBeenCalledTimes(
        mockKeywords.length,
      );

      // Verify statement was updated with extracted keywords
      expect(statementSchema.updateStatement).toHaveBeenCalledWith('test-id', {
        ...updateData,
        keywords: mockKeywords,
      });

      // Verify the result
      expect(result).toEqual(mockUpdatedStatement);
    });

    it('should update statement without keywords if text does not change', async () => {
      // Mock statement update
      const mockUpdatedStatement = {
        id: 'test-id',
        publicCredit: false,
      };
      mockStatementSchema.updateStatement.mockResolvedValue(
        mockUpdatedStatement,
      );

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
  });

  describe('getStatement', () => {
    it('should get a statement by id', async () => {
      const mockStatement = { id: 'test-id', statement: 'Test statement' };
      mockStatementSchema.getStatement.mockResolvedValue(mockStatement);

      const result = await service.getStatement('test-id');

      expect(statementSchema.getStatement).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockStatement);
    });
  });

  // Additional tests for other methods would follow the same pattern
});
