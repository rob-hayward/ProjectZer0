import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KeywordExtractionService } from './keyword-extraction.service';
import * as projectZeroAIClient from '../projectZeroAIClient';

// Mock the projectZeroAIClient
jest.mock('../projectZeroAIClient', () => ({
  processTextAsync: jest.fn(),
  getResult: jest.fn(),
}));

describe('KeywordExtractionService', () => {
  let service: KeywordExtractionService;

  const mockConfigService = {
    get: jest.fn((key) => {
      const configs = {
        'keyword-extraction.projectZeroAIUrl': 'http://test-url',
        'keyword-extraction.maxRetries': 3,
        'keyword-extraction.retryDelay': 10, // Use small delay for tests
        'keyword-extraction.defaultFrequency': 1,
        'keyword-extraction.userKeywordWeight': 2,
      };
      return configs[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeywordExtractionService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<KeywordExtractionService>(KeywordExtractionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractKeywords', () => {
    it('should extract keywords from text', async () => {
      // Mock the API responses
      const mockTaskId = 'mock-task-id';
      (projectZeroAIClient.processTextAsync as jest.Mock).mockResolvedValue({
        task_id: mockTaskId,
        status: 'processing',
      });

      (projectZeroAIClient.getResult as jest.Mock).mockResolvedValue({
        status: 'completed',
        processed_data: {
          id: '123',
          keyword_extraction: {
            keywords: ['ai', 'machine', 'learning'],
          },
        },
      });

      // Execute the method with sample text
      const result = await service.extractKeywords({
        text: 'This is a sample text about AI and machine learning.',
        userKeywords: ['user', 'keyword'],
      });

      // Verify the results
      expect(projectZeroAIClient.processTextAsync).toHaveBeenCalledWith(
        'This is a sample text about AI and machine learning.',
      );

      expect(projectZeroAIClient.getResult).toHaveBeenCalledWith(mockTaskId);

      // Check that the response includes both AI and user keywords
      expect(result.keywords).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ word: 'ai', source: 'ai' }),
          expect.objectContaining({ word: 'machine', source: 'ai' }),
          expect.objectContaining({ word: 'learning', source: 'ai' }),
          expect.objectContaining({ word: 'user', source: 'user' }),
          expect.objectContaining({ word: 'keyword', source: 'user' }),
        ]),
      );

      // Verify user keywords have higher weight
      const userKeyword = result.keywords.find((k) => k.word === 'user');
      expect(userKeyword.frequency).toBe(2);

      // Verify AI keywords have default weight
      const aiKeyword = result.keywords.find((k) => k.word === 'ai');
      expect(aiKeyword.frequency).toBe(1);
    });

    it('should merge duplicate keywords and combine frequencies', async () => {
      // Mock the API to return a keyword that's also in user keywords
      (projectZeroAIClient.processTextAsync as jest.Mock).mockResolvedValue({
        task_id: 'task-id',
        status: 'processing',
      });

      (projectZeroAIClient.getResult as jest.Mock).mockResolvedValue({
        status: 'completed',
        processed_data: {
          id: '123',
          keyword_extraction: {
            keywords: ['duplicate', 'unique'],
          },
        },
      });

      // Execute with duplicate keyword
      const result = await service.extractKeywords({
        text: 'Sample text with duplicate keyword',
        userKeywords: ['duplicate', 'other'],
      });

      // Verify duplicate is merged with combined frequency and user source
      const duplicateKeyword = result.keywords.find(
        (k) => k.word === 'duplicate',
      );
      expect(duplicateKeyword).toBeDefined();
      expect(duplicateKeyword.frequency).toBe(3); // 1 (AI) + 2 (user)
      expect(duplicateKeyword.source).toBe('user'); // User source takes precedence

      // Verify non-duplicates exist with correct source
      expect(result.keywords).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ word: 'unique', source: 'ai' }),
          expect.objectContaining({ word: 'other', source: 'user' }),
        ]),
      );
    });

    it('should handle API errors and retries', async () => {
      // Mock processTextAsync to succeed but getResult to fail twice then succeed
      (projectZeroAIClient.processTextAsync as jest.Mock).mockResolvedValue({
        task_id: 'task-id',
        status: 'processing',
      });

      const getResultMock = projectZeroAIClient.getResult as jest.Mock;
      // First two calls return "processing"
      getResultMock.mockResolvedValueOnce({ status: 'processing' });
      getResultMock.mockResolvedValueOnce({ status: 'processing' });
      // Third call returns completed data
      getResultMock.mockResolvedValueOnce({
        status: 'completed',
        processed_data: {
          id: '123',
          keyword_extraction: {
            keywords: ['test'],
          },
        },
      });

      const result = await service.extractKeywords({
        text: 'Test text for retries',
      });

      // Verify getResult was called multiple times (retries)
      expect(getResultMock).toHaveBeenCalledTimes(3);

      // Verify final result is correct
      expect(result.keywords).toHaveLength(1);
      expect(result.keywords[0]).toEqual(
        expect.objectContaining({ word: 'test', source: 'ai' }),
      );
    });

    it('should throw error after max retries', async () => {
      // Mock APIs to simulate persistent processing state
      (projectZeroAIClient.processTextAsync as jest.Mock).mockResolvedValue({
        task_id: 'task-id',
        status: 'processing',
      });

      // Always return "processing" status
      (projectZeroAIClient.getResult as jest.Mock).mockResolvedValue({
        status: 'processing',
      });

      // Expect the service to throw after max retries
      await expect(
        service.extractKeywords({
          text: 'Test text for error',
        }),
      ).rejects.toThrow('Failed to extract keywords after 3 retries');
    });
  });
});
