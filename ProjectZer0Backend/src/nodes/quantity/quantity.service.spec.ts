// src/nodes/quantity/__tests__/quantity.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { QuantityService } from './quantity.service';
import { QuantitySchema } from '../../neo4j/schemas/quantity.schema';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { UnitService } from '../../units/unit.service';
import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';

describe('QuantityService', () => {
  let service: QuantityService;
  let quantitySchema: jest.Mocked<QuantitySchema>;
  let keywordExtractionService: jest.Mocked<KeywordExtractionService>;
  let wordService: jest.Mocked<WordService>;
  let unitService: jest.Mocked<UnitService>;

  beforeEach(async () => {
    // Create mock implementations
    const mockQuantitySchema = {
      createQuantityNode: jest.fn(),
      getQuantityNode: jest.fn(),
      updateQuantityNode: jest.fn(),
      deleteQuantityNode: jest.fn(),
      submitResponse: jest.fn(),
      getUserResponse: jest.fn(),
      deleteUserResponse: jest.fn(),
      getStatistics: jest.fn(),
      setVisibilityStatus: jest.fn(),
      getVisibilityStatus: jest.fn(),
    };

    const mockKeywordExtractionService = {
      extractKeywords: jest.fn(),
    };

    const mockWordService = {
      checkWordExistence: jest.fn(),
      createWord: jest.fn(),
    };

    const mockUnitService = {
      validateUnitInCategory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuantityService,
        {
          provide: QuantitySchema,
          useValue: mockQuantitySchema,
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
          provide: UnitService,
          useValue: mockUnitService,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QuantityService>(QuantityService);
    quantitySchema = module.get(QuantitySchema);
    keywordExtractionService = module.get(KeywordExtractionService);
    wordService = module.get(WordService);
    unitService = module.get(UnitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createQuantityNode', () => {
    const validNodeData = {
      createdBy: 'user1',
      publicCredit: true,
      question:
        'What do you believe is the maximum annual income for a single individual without being excessive?',
      unitCategoryId: 'currency',
      defaultUnitId: 'usd',
      userKeywords: ['income', 'excessive'],
      initialComment: 'This is an important ethical question',
    };

    it('should create a quantity node with valid data', async () => {
      // Mock unit validation
      unitService.validateUnitInCategory.mockReturnValue(true);

      // Mock keyword extraction
      const extractedKeywords = [
        { word: 'income', frequency: 2, source: 'user' as const },
        { word: 'excessive', frequency: 1, source: 'user' as const },
        { word: 'maximum', frequency: 1, source: 'ai' as const },
      ] as KeywordWithFrequency[];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: extractedKeywords,
      });

      // Mock word existence check
      wordService.checkWordExistence.mockResolvedValue(true);

      // Mock schema create method
      const expectedResult = {
        id: 'test-id',
        ...validNodeData,
        keywords: extractedKeywords,
      };
      quantitySchema.createQuantityNode.mockResolvedValue(expectedResult);

      // Execute
      const result = await service.createQuantityNode(validNodeData);

      // Verify
      expect(unitService.validateUnitInCategory).toHaveBeenCalledWith(
        'currency',
        'usd',
      );
      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: validNodeData.question,
        userKeywords: validNodeData.userKeywords,
      });
      expect(quantitySchema.createQuantityNode).toHaveBeenCalledWith(
        expect.objectContaining({
          ...validNodeData,
          id: expect.any(String),
          keywords: extractedKeywords,
        }),
      );
      expect(result).toEqual(expectedResult);
    });

    it('should create missing word nodes if needed', async () => {
      // Mock unit validation
      unitService.validateUnitInCategory.mockReturnValue(true);

      // Mock keyword extraction
      const extractedKeywords = [
        { word: 'income', frequency: 2, source: 'user' as const },
        { word: 'excessive', frequency: 1, source: 'user' as const },
        { word: 'maximum', frequency: 1, source: 'ai' as const },
      ] as KeywordWithFrequency[];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: extractedKeywords,
      });

      // Mock word existence - first word exists, second doesn't
      wordService.checkWordExistence.mockImplementation((word) =>
        Promise.resolve(word === 'income'),
      );

      // Mock schema create method
      const expectedResult = {
        id: 'test-id',
        ...validNodeData,
        keywords: extractedKeywords,
      };
      quantitySchema.createQuantityNode.mockResolvedValue(expectedResult);

      // Execute
      await service.createQuantityNode(validNodeData);

      // Verify word creation was called for missing words
      expect(wordService.createWord).toHaveBeenCalledTimes(2); // for 'excessive' and 'maximum'
      expect(wordService.createWord).toHaveBeenCalledWith(
        expect.objectContaining({
          word: 'excessive',
          createdBy: 'user1',
          publicCredit: true,
        }),
      );
    });

    it('should throw BadRequestException for empty question', async () => {
      await expect(
        service.createQuantityNode({
          ...validNodeData,
          question: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(quantitySchema.createQuantityNode).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing unitCategoryId', async () => {
      // Create a copy of the data without unitCategoryId
      const invalidData = { ...validNodeData };
      delete invalidData.unitCategoryId;

      await expect(
        service.createQuantityNode(invalidData as any),
      ).rejects.toThrow(BadRequestException);
      expect(quantitySchema.createQuantityNode).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid unit', async () => {
      // Mock unit validation to fail
      unitService.validateUnitInCategory.mockReturnValue(false);

      await expect(service.createQuantityNode(validNodeData)).rejects.toThrow(
        BadRequestException,
      );
      expect(quantitySchema.createQuantityNode).not.toHaveBeenCalled();
    });
  });

  describe('getQuantityNode', () => {
    it('should return a quantity node when found', async () => {
      const mockQuantityNode = {
        id: 'test-id',
        question: 'Test question?',
        unitCategoryId: 'currency',
        defaultUnitId: 'usd',
      };

      quantitySchema.getQuantityNode.mockResolvedValue(mockQuantityNode);

      const result = await service.getQuantityNode('test-id');

      expect(quantitySchema.getQuantityNode).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockQuantityNode);
    });

    it('should throw NotFoundException when node is not found', async () => {
      quantitySchema.getQuantityNode.mockResolvedValue(null);

      await expect(service.getQuantityNode('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(service.getQuantityNode('')).rejects.toThrow(
        BadRequestException,
      );
      expect(quantitySchema.getQuantityNode).not.toHaveBeenCalled();
    });
  });

  describe('updateQuantityNode', () => {
    it('should update a quantity node without changing question', async () => {
      const updateData = {
        publicCredit: false,
        unitCategoryId: 'currency',
        defaultUnitId: 'eur',
      };

      const mockUpdatedNode = {
        id: 'test-id',
        question: 'Existing question?',
        ...updateData,
      };

      quantitySchema.updateQuantityNode.mockResolvedValue(mockUpdatedNode);

      const result = await service.updateQuantityNode('test-id', updateData);

      expect(quantitySchema.updateQuantityNode).toHaveBeenCalledWith(
        'test-id',
        updateData,
      );
      expect(result).toEqual(mockUpdatedNode);
    });

    it('should update a quantity node with new question and re-extract keywords', async () => {
      // First get the existing node to determine creator
      const existingNode = {
        id: 'test-id',
        question: 'Original question?',
        createdBy: 'user1',
        publicCredit: true,
        unitCategoryId: 'currency',
        defaultUnitId: 'usd',
      };
      quantitySchema.getQuantityNode.mockResolvedValue(existingNode);

      // Then extract keywords from updated question
      const updateData = {
        question: 'Updated question?',
        userKeywords: ['new', 'keywords'],
      };

      const extractedKeywords = [
        { word: 'updated', frequency: 1, source: 'ai' as const },
        { word: 'new', frequency: 1, source: 'user' as const },
        { word: 'keywords', frequency: 1, source: 'user' as const },
      ] as KeywordWithFrequency[];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: extractedKeywords,
      });

      // Mock word existence - assume all words exist
      wordService.checkWordExistence.mockResolvedValue(true);

      // Mock update with keywords
      const mockUpdatedNode = {
        id: 'test-id',
        ...existingNode,
        ...updateData,
      };
      quantitySchema.updateQuantityNode.mockResolvedValue(mockUpdatedNode);

      // Execute
      const result = await service.updateQuantityNode('test-id', updateData);

      // Verify
      expect(quantitySchema.getQuantityNode).toHaveBeenCalledWith('test-id');
      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: updateData.question,
        userKeywords: updateData.userKeywords,
      });
      expect(quantitySchema.updateQuantityNode).toHaveBeenCalledWith(
        'test-id',
        {
          ...updateData,
          keywords: extractedKeywords,
        },
      );
      expect(result).toEqual(mockUpdatedNode);
    });

    it('should throw BadRequestException for empty update data', async () => {
      await expect(service.updateQuantityNode('test-id', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(quantitySchema.updateQuantityNode).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when node to update is not found', async () => {
      // Mock node not found for question update path
      quantitySchema.getQuantityNode.mockResolvedValue(null);

      await expect(
        service.updateQuantityNode('nonexistent-id', {
          question: 'New question?',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteQuantityNode', () => {
    it('should delete a quantity node', async () => {
      const mockResult = {
        success: true,
        message: 'Quantity node deleted successfully',
      };
      quantitySchema.deleteQuantityNode.mockResolvedValue(mockResult);

      const result = await service.deleteQuantityNode('test-id');

      expect(quantitySchema.deleteQuantityNode).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty id', async () => {
      await expect(service.deleteQuantityNode('')).rejects.toThrow(
        BadRequestException,
      );
      expect(quantitySchema.deleteQuantityNode).not.toHaveBeenCalled();
    });
  });

  describe('submitResponse', () => {
    const validResponseData = {
      userId: 'user1',
      quantityNodeId: 'quantity-id',
      value: 100000,
      unitId: 'usd',
    };

    it('should submit a valid response', async () => {
      const mockResponseResult = {
        id: 'response-id',
        userId: 'user1',
        quantityNodeId: 'quantity-id',
        value: 100000,
        unitId: 'usd',
        categoryId: 'currency',
        createdAt: new Date(),
        updatedAt: new Date(),
        normalizedValue: 100000,
      };
      quantitySchema.submitResponse.mockResolvedValue(mockResponseResult);

      const result = await service.submitResponse(validResponseData);

      expect(quantitySchema.submitResponse).toHaveBeenCalledWith(
        validResponseData,
      );
      expect(result).toEqual(mockResponseResult);
    });

    it('should throw BadRequestException for missing user ID', async () => {
      // Create a new object without userId
      const invalidData = { ...validResponseData };
      delete invalidData.userId;

      await expect(service.submitResponse(invalidData as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(quantitySchema.submitResponse).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing quantity node ID', async () => {
      // Create a new object without quantityNodeId
      const invalidData = { ...validResponseData };
      delete invalidData.quantityNodeId;

      await expect(service.submitResponse(invalidData as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(quantitySchema.submitResponse).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid value', async () => {
      await expect(
        service.submitResponse({
          ...validResponseData,
          value: NaN,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(quantitySchema.submitResponse).not.toHaveBeenCalled();
    });
  });

  describe('getUserResponse', () => {
    it('should get a user response when it exists', async () => {
      const mockResponse = {
        id: 'response-id',
        userId: 'user1',
        quantityNodeId: 'quantity-id',
        value: 100000,
        unitId: 'usd',
        categoryId: 'currency',
        createdAt: new Date(),
        updatedAt: new Date(),
        normalizedValue: 100000,
      };
      quantitySchema.getUserResponse.mockResolvedValue(mockResponse);

      const result = await service.getUserResponse('user1', 'quantity-id');

      expect(quantitySchema.getUserResponse).toHaveBeenCalledWith(
        'user1',
        'quantity-id',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.getUserResponse('', 'quantity-id')).rejects.toThrow(
        BadRequestException,
      );
      expect(quantitySchema.getUserResponse).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty quantity node ID', async () => {
      await expect(service.getUserResponse('user1', '')).rejects.toThrow(
        BadRequestException,
      );
      expect(quantitySchema.getUserResponse).not.toHaveBeenCalled();
    });
  });

  describe('deleteUserResponse', () => {
    it('should delete a user response when it exists', async () => {
      const mockResult = {
        success: true,
        message: 'Response successfully deleted',
      };
      quantitySchema.deleteUserResponse.mockResolvedValue(true);

      const result = await service.deleteUserResponse('user1', 'quantity-id');

      expect(quantitySchema.deleteUserResponse).toHaveBeenCalledWith(
        'user1',
        'quantity-id',
      );
      expect(result).toEqual(mockResult);
    });

    it('should return appropriate message when no response exists to delete', async () => {
      quantitySchema.deleteUserResponse.mockResolvedValue(false);

      const result = await service.deleteUserResponse('user1', 'quantity-id');

      expect(result).toEqual({
        success: false,
        message: 'No response found to delete',
      });
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(
        service.deleteUserResponse('', 'quantity-id'),
      ).rejects.toThrow(BadRequestException);
      expect(quantitySchema.deleteUserResponse).not.toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should get statistics for a quantity node', async () => {
      // Mock node existence check
      quantitySchema.getQuantityNode.mockResolvedValue({
        id: 'quantity-id',
        question: 'Test question?',
      });

      // Mock statistics
      const mockStats = {
        responseCount: 3,
        min: 10000,
        max: 90000,
        mean: 50000,
        median: 50000,
        standardDeviation: 32660,
        percentiles: { 25: 30000, 50: 50000, 75: 70000 },
        distributionCurve: [
          [10000, 0.1],
          [50000, 0.3],
          [90000, 0.1],
        ],
      };
      quantitySchema.getStatistics.mockResolvedValue(mockStats);

      const result = await service.getStatistics('quantity-id');

      expect(quantitySchema.getQuantityNode).toHaveBeenCalledWith(
        'quantity-id',
      );
      expect(quantitySchema.getStatistics).toHaveBeenCalledWith('quantity-id');
      expect(result).toEqual(mockStats);
    });

    it('should throw NotFoundException when node does not exist', async () => {
      quantitySchema.getQuantityNode.mockResolvedValue(null);

      await expect(service.getStatistics('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(quantitySchema.getStatistics).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.getStatistics('')).rejects.toThrow(
        BadRequestException,
      );
      expect(quantitySchema.getStatistics).not.toHaveBeenCalled();
    });
  });

  describe('visibility methods', () => {
    it('should set visibility status for a quantity node', async () => {
      const mockUpdatedNode = {
        id: 'quantity-id',
        visibilityStatus: false,
      };
      quantitySchema.setVisibilityStatus.mockResolvedValue(mockUpdatedNode);

      const result = await service.setVisibilityStatus('quantity-id', false);

      expect(quantitySchema.setVisibilityStatus).toHaveBeenCalledWith(
        'quantity-id',
        false,
      );
      expect(result).toEqual(mockUpdatedNode);
    });

    it('should get visibility status for a quantity node', async () => {
      quantitySchema.getVisibilityStatus.mockResolvedValue(true);

      const result = await service.getVisibilityStatus('quantity-id');

      expect(quantitySchema.getVisibilityStatus).toHaveBeenCalledWith(
        'quantity-id',
      );
      expect(result).toEqual({ isVisible: true });
    });

    it('should throw BadRequestException for empty ID when setting visibility', async () => {
      await expect(service.setVisibilityStatus('', true)).rejects.toThrow(
        BadRequestException,
      );
      expect(quantitySchema.setVisibilityStatus).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for non-boolean value when setting visibility', async () => {
      await expect(
        // @ts-expect-error: Testing with invalid type
        service.setVisibilityStatus('quantity-id', 'not-a-boolean'),
      ).rejects.toThrow(BadRequestException);
      expect(quantitySchema.setVisibilityStatus).not.toHaveBeenCalled();
    });
  });
});
