import { Test, TestingModule } from '@nestjs/testing';
import { StatementService } from './statement.service';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';

describe('StatementService', () => {
  let service: StatementService;
  let statementSchema: StatementSchema;
  let keywordExtractionService: KeywordExtractionService;

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
      ],
    }).compile();

    service = module.get<StatementService>(StatementService);
    statementSchema = module.get<StatementSchema>(StatementSchema);
    keywordExtractionService = module.get<KeywordExtractionService>(
      KeywordExtractionService,
    );
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
      // Mock the keyword extraction
      const mockKeywords = [
        { word: 'updated', frequency: 1, source: 'ai' },
        { word: 'keyword', frequency: 2, source: 'user' },
      ];

      mockKeywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

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
