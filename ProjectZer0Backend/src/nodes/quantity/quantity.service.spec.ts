// src/nodes/quantity/quantity.service.spec.ts - COMPREHENSIVE TEST SUITE - FIXED

import { Test, TestingModule } from '@nestjs/testing';
import { QuantityService } from './quantity.service';
import { QuantitySchema } from '../../neo4j/schemas/quantity.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { CategoryService } from '../category/category.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { UnitService } from '../../units/unit.service';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

describe('QuantityService - Comprehensive Tests', () => {
  let service: QuantityService;
  let quantitySchema: jest.Mocked<QuantitySchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let userSchema: jest.Mocked<UserSchema>;
  let categoryService: jest.Mocked<CategoryService>;
  let keywordExtractionService: jest.Mocked<KeywordExtractionService>;
  let wordService: jest.Mocked<WordService>;
  let unitService: jest.Mocked<UnitService>;

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
    const mockQuantitySchema = {
      // Domain methods
      createQuantityNode: jest.fn(),
      submitResponse: jest.fn(),
      getUserResponse: jest.fn(),
      deleteUserResponse: jest.fn(),
      getStatistics: jest.fn(),

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

    // ✅ FIXED: validateUnitInCategory returns boolean synchronously, not Promise<boolean>
    const mockUnitService = {
      validateUnitInCategory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuantityService,
        { provide: QuantitySchema, useValue: mockQuantitySchema },
        { provide: DiscussionSchema, useValue: mockDiscussionSchema },
        { provide: UserSchema, useValue: mockUserSchema },
        { provide: CategoryService, useValue: mockCategoryService },
        {
          provide: KeywordExtractionService,
          useValue: mockKeywordExtractionService,
        },
        { provide: WordService, useValue: mockWordService },
        { provide: UnitService, useValue: mockUnitService },
      ],
    }).compile();

    service = module.get<QuantityService>(QuantityService);
    quantitySchema = module.get(QuantitySchema);
    discussionSchema = module.get(DiscussionSchema);
    userSchema = module.get(UserSchema);
    categoryService = module.get(CategoryService);
    keywordExtractionService = module.get(KeywordExtractionService);
    wordService = module.get(WordService);
    unitService = module.get(UnitService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // CREATE QUANTITY NODE TESTS
  // ============================================
  describe('createQuantityNode', () => {
    const validQuantityData = {
      createdBy: 'test-user',
      publicCredit: true,
      question: 'What is the average price of a gallon of milk?',
      unitCategoryId: 'currency',
      defaultUnitId: 'usd',
      initialComment: 'Initial comment',
    };

    beforeEach(() => {
      // ✅ FIXED: Use mockReturnValue (sync) instead of mockResolvedValue (async)
      unitService.validateUnitInCategory.mockReturnValue(true);
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });
    });

    it('should validate and reject empty createdBy', async () => {
      await expect(
        service.createQuantityNode({
          ...validQuantityData,
          createdBy: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject empty question', async () => {
      await expect(
        service.createQuantityNode({
          ...validQuantityData,
          question: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject empty unitCategoryId', async () => {
      await expect(
        service.createQuantityNode({
          ...validQuantityData,
          unitCategoryId: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject empty defaultUnitId', async () => {
      await expect(
        service.createQuantityNode({
          ...validQuantityData,
          defaultUnitId: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject question text that is too long', async () => {
      await expect(
        service.createQuantityNode({
          ...validQuantityData,
          question: 'a'.repeat(281), // Over 280 char limit
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject non-boolean publicCredit', async () => {
      await expect(
        service.createQuantityNode({
          ...validQuantityData,
          publicCredit: 'yes' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and reject too many categories', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      await expect(
        service.createQuantityNode({
          ...validQuantityData,
          categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'], // Max is 3
        }),
      ).rejects.toThrow('Quantity node can have maximum 3 categories');
    });

    it('should validate unit is valid for category', async () => {
      unitService.validateUnitInCategory.mockReturnValue(false);

      await expect(
        service.createQuantityNode(validQuantityData),
      ).rejects.toThrow('is not valid for category');
    });

    it('should create quantity node with AI-extracted keywords', async () => {
      const mockKeywords = [
        { word: 'average', frequency: 1, source: 'ai' as const },
        { word: 'price', frequency: 1, source: 'ai' as const },
      ];

      unitService.validateUnitInCategory.mockReturnValue(true);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      const mockCreatedQuantity = {
        id: expect.any(String),
        question: validQuantityData.question,
        createdBy: validQuantityData.createdBy,
        publicCredit: true,
        unitCategoryId: validQuantityData.unitCategoryId,
        defaultUnitId: validQuantityData.defaultUnitId,
      } as any;

      quantitySchema.createQuantityNode.mockResolvedValue(mockCreatedQuantity);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      const result = await service.createQuantityNode(validQuantityData);

      expect(unitService.validateUnitInCategory).toHaveBeenCalledWith(
        'currency',
        'usd',
      );

      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: validQuantityData.question,
      });

      expect(quantitySchema.createQuantityNode).toHaveBeenCalledWith(
        expect.objectContaining({
          question: validQuantityData.question,
          keywords: mockKeywords,
          unitCategoryId: validQuantityData.unitCategoryId,
          defaultUnitId: validQuantityData.defaultUnitId,
        }),
      );

      expect(result).toEqual(mockCreatedQuantity);
    });

    it('should use user-provided keywords instead of AI extraction', async () => {
      const userKeywords = ['price', 'milk'];

      unitService.validateUnitInCategory.mockReturnValue(true);

      const quantityData = {
        ...validQuantityData,
        userKeywords,
      };

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      const mockCreatedQuantity = {
        id: expect.any(String),
        question: quantityData.question,
      } as any;

      quantitySchema.createQuantityNode.mockResolvedValue(mockCreatedQuantity);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      await service.createQuantityNode(quantityData);

      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();
      expect(quantitySchema.createQuantityNode).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: expect.arrayContaining([
            { word: 'price', frequency: 1, source: 'user' },
            { word: 'milk', frequency: 1, source: 'user' },
          ]),
        }),
      );
    });

    it('should create missing words for extracted keywords', async () => {
      const mockKeywords = [
        { word: 'average', frequency: 1, source: 'ai' as const },
        { word: 'price', frequency: 1, source: 'ai' as const },
      ];

      unitService.validateUnitInCategory.mockReturnValue(true);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      const mockCreatedQuantity = {
        id: expect.any(String),
        question: validQuantityData.question,
      } as any;

      quantitySchema.createQuantityNode.mockResolvedValue(mockCreatedQuantity);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      await service.createQuantityNode(validQuantityData);

      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'average',
        createdBy: validQuantityData.createdBy,
        publicCredit: true,
      });
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'price',
        createdBy: validQuantityData.createdBy,
        publicCredit: true,
      });
    });

    it('should not create word nodes for existing words', async () => {
      const mockKeywords = [
        { word: 'existing', frequency: 1, source: 'ai' as const },
      ];

      unitService.validateUnitInCategory.mockReturnValue(true);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(true);

      const mockCreatedQuantity = {
        id: expect.any(String),
        question: validQuantityData.question,
      } as any;

      quantitySchema.createQuantityNode.mockResolvedValue(mockCreatedQuantity);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      await service.createQuantityNode(validQuantityData);

      expect(wordService.checkWordExistence).toHaveBeenCalledWith('existing');
      expect(wordService.createWord).not.toHaveBeenCalled();
    });

    it('should continue if word creation fails', async () => {
      const mockKeywords = [
        { word: 'newword', frequency: 1, source: 'ai' as const },
      ];

      unitService.validateUnitInCategory.mockReturnValue(true);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockRejectedValue(
        new Error('Word creation failed'),
      );

      const mockCreatedQuantity = {
        id: expect.any(String),
        question: validQuantityData.question,
      } as any;

      quantitySchema.createQuantityNode.mockResolvedValue(mockCreatedQuantity);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      // Should not throw despite word creation failure
      const result = await service.createQuantityNode(validQuantityData);

      expect(quantitySchema.createQuantityNode).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedQuantity);
    });

    it('should validate categories exist and are approved', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      const mockCategory = {
        id: 'cat-1',
        inclusionNetVotes: 5,
      } as any;

      categoryService.getCategory.mockResolvedValue(mockCategory);

      const mockCreatedQuantity = {
        id: expect.any(String),
        question: validQuantityData.question,
      } as any;

      quantitySchema.createQuantityNode.mockResolvedValue(mockCreatedQuantity);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      await service.createQuantityNode({
        ...validQuantityData,
        categoryIds: ['cat-1'],
      });

      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-1');
      expect(quantitySchema.createQuantityNode).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryIds: ['cat-1'],
        }),
      );
    });

    it('should reject unapproved categories', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      const mockCategory = {
        id: 'cat-1',
        inclusionNetVotes: -1, // Not approved
      } as any;

      categoryService.getCategory.mockResolvedValue(mockCategory);

      await expect(
        service.createQuantityNode({
          ...validQuantityData,
          categoryIds: ['cat-1'],
        }),
      ).rejects.toThrow('must have passed inclusion threshold');
    });

    it('should reject non-existent categories', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      categoryService.getCategory.mockResolvedValue(null);

      await expect(
        service.createQuantityNode({
          ...validQuantityData,
          categoryIds: ['nonexistent'],
        }),
      ).rejects.toThrow('does not exist');
    });

    it('should create discussion with correct nodeIdField', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      const mockCreatedQuantity = {
        id: 'quantity-123',
        question: validQuantityData.question,
      } as any;

      quantitySchema.createQuantityNode.mockResolvedValue(mockCreatedQuantity);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      await service.createQuantityNode(validQuantityData);

      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: 'quantity-123',
        nodeType: 'QuantityNode',
        nodeIdField: 'id', // ← Standard ID field
        createdBy: validQuantityData.createdBy,
        initialComment: validQuantityData.initialComment,
      });
    });

    it('should continue if discussion creation fails', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      const mockCreatedQuantity = {
        id: expect.any(String),
        question: validQuantityData.question,
      } as any;

      quantitySchema.createQuantityNode.mockResolvedValue(mockCreatedQuantity);

      discussionSchema.createDiscussionForNode.mockRejectedValue(
        new Error('Discussion creation failed'),
      );

      // Should not throw despite discussion creation failure
      const result = await service.createQuantityNode(validQuantityData);

      expect(quantitySchema.createQuantityNode).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedQuantity);
    });

    it('should throw InternalServerErrorException if keyword extraction fails', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);

      keywordExtractionService.extractKeywords.mockRejectedValue(
        new Error('Extraction failed'),
      );

      await expect(
        service.createQuantityNode(validQuantityData),
      ).rejects.toThrow(InternalServerErrorException);

      expect(quantitySchema.createQuantityNode).not.toHaveBeenCalled();
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      quantitySchema.createQuantityNode.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.createQuantityNode(validQuantityData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should preserve BadRequestException from dependencies', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });

      quantitySchema.createQuantityNode.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(
        service.createQuantityNode(validQuantityData),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // INTEGRATION TESTS
  // ============================================
  describe('Integration - Full Create Flow', () => {
    it('should handle complete quantity node creation with all features', async () => {
      const quantityData = {
        createdBy: 'test-user',
        publicCredit: true,
        question: 'What is the average price of gasoline per gallon?',
        unitCategoryId: 'currency',
        defaultUnitId: 'usd',
        categoryIds: ['cat-1', 'cat-2'],
        initialComment: 'Interested in gas prices',
      };

      // Mock unit validation
      unitService.validateUnitInCategory.mockReturnValue(true);

      // Mock keyword extraction
      const mockKeywords = [
        { word: 'average', frequency: 1, source: 'ai' as const },
        { word: 'price', frequency: 1, source: 'ai' as const },
        { word: 'gasoline', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      // Mock word checks
      wordService.checkWordExistence.mockImplementation(
        async (word: string) => {
          return word === 'average';
        },
      );

      wordService.createWord.mockResolvedValue({} as any);

      // Mock category validation
      const mockCategory = {
        id: 'cat-1',
        inclusionNetVotes: 5,
      } as any;

      categoryService.getCategory.mockResolvedValue(mockCategory);

      // Mock quantity creation
      const mockCreatedQuantity = {
        id: expect.any(String),
        question: quantityData.question,
        createdBy: quantityData.createdBy,
        publicCredit: true,
        unitCategoryId: quantityData.unitCategoryId,
        defaultUnitId: quantityData.defaultUnitId,
        categoryIds: quantityData.categoryIds,
      } as any;

      quantitySchema.createQuantityNode.mockResolvedValue(mockCreatedQuantity);

      // Mock discussion creation
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      const result = await service.createQuantityNode(quantityData);

      // Verify unit validation
      expect(unitService.validateUnitInCategory).toHaveBeenCalledWith(
        'currency',
        'usd',
      );

      // Verify keyword extraction
      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: quantityData.question,
      });

      // Verify word creation for missing words
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'price',
        createdBy: quantityData.createdBy,
        publicCredit: true,
      });
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'gasoline',
        createdBy: quantityData.createdBy,
        publicCredit: true,
      });

      // Verify category validation for both categories
      expect(categoryService.getCategory).toHaveBeenCalledTimes(2);

      // Verify final result
      expect(result).toEqual(mockCreatedQuantity);
    });
  });

  // ============================================
  // GET QUANTITY NODE TESTS
  // ============================================
  describe('getQuantityNode', () => {
    it('should retrieve a quantity node by ID', async () => {
      const mockQuantity = {
        id: 'test-id',
        question: 'Test question?',
        createdBy: 'user-123',
        publicCredit: true,
      } as any;

      quantitySchema.findById.mockResolvedValue(mockQuantity);

      const result = await service.getQuantityNode('test-id');

      expect(quantitySchema.findById).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockQuantity);
    });

    it('should throw NotFoundException when quantity node not found', async () => {
      quantitySchema.findById.mockResolvedValue(null);

      await expect(service.getQuantityNode('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.getQuantityNode('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      quantitySchema.findById.mockRejectedValue(new Error('Database error'));

      await expect(service.getQuantityNode('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // UPDATE QUANTITY NODE TESTS
  // ============================================
  describe('updateQuantityNode', () => {
    it('should update quantity node basic properties', async () => {
      const updateData = {
        publicCredit: false,
      };

      const mockUpdatedQuantity = {
        id: 'test-id',
        publicCredit: false,
      } as any;

      quantitySchema.update.mockResolvedValue(mockUpdatedQuantity);

      const result = await service.updateQuantityNode('test-id', updateData);

      expect(quantitySchema.update).toHaveBeenCalledWith('test-id', updateData);
      expect(result).toEqual(mockUpdatedQuantity);
    });

    it('should update question and extract new keywords', async () => {
      const updateData = {
        question: 'Updated question?',
      };

      quantitySchema.findById.mockResolvedValue({
        id: 'test-id',
        question: 'Original?',
        createdBy: 'user',
        publicCredit: true,
      } as any);

      const mockKeywords = [
        { word: 'updated', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      quantitySchema.update.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.updateQuantityNode('test-id', updateData);

      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: 'Updated question?',
      });

      expect(quantitySchema.update).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          question: 'Updated question?',
          keywords: mockKeywords,
        }),
      );
    });

    it('should create missing words during update', async () => {
      const updateData = {
        question: 'Updated?',
      };

      quantitySchema.findById.mockResolvedValue({
        id: 'test-id',
        question: 'Original?',
        createdBy: 'user',
        publicCredit: true,
      } as any);

      const mockKeywords = [
        { word: 'newword', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      quantitySchema.update.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.updateQuantityNode('test-id', updateData);

      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'newword',
        createdBy: 'user',
        publicCredit: true,
      });
    });

    it('should continue if keyword extraction fails during update', async () => {
      quantitySchema.findById.mockResolvedValue({
        id: 'test-id',
        question: 'Original?',
        createdBy: 'user',
        publicCredit: true,
      } as any);

      keywordExtractionService.extractKeywords.mockRejectedValue(
        new Error('Extraction failed'),
      );

      quantitySchema.update.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.updateQuantityNode('test-id', {
        question: 'Updated?',
      });

      // Should continue with empty keywords
      expect(quantitySchema.update).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          keywords: [],
        }),
      );
    });

    it('should validate updated question length', async () => {
      await expect(
        service.updateQuantityNode('test-id', {
          question: 'a'.repeat(281), // Over 280 char limit
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate updated category count', async () => {
      await expect(
        service.updateQuantityNode('test-id', {
          categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'], // Max is 3
        }),
      ).rejects.toThrow('Quantity node can have maximum 3 categories');
    });

    it('should validate categories during update', async () => {
      const mockCategory = {
        id: 'cat-1',
        inclusionNetVotes: 5,
      } as any;

      categoryService.getCategory.mockResolvedValue(mockCategory);

      quantitySchema.update.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.updateQuantityNode('test-id', {
        categoryIds: ['cat-1'],
      });

      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-1');
    });

    it('should throw NotFoundException when updating non-existent quantity node', async () => {
      quantitySchema.update.mockResolvedValue(null);

      await expect(
        service.updateQuantityNode('nonexistent-id', {
          publicCredit: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      quantitySchema.update.mockRejectedValue(new Error('Database error'));

      await expect(
        service.updateQuantityNode('test-id', { publicCredit: false }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ============================================
  // DELETE QUANTITY NODE TESTS
  // ============================================
  describe('deleteQuantityNode', () => {
    it('should delete a quantity node', async () => {
      quantitySchema.findById.mockResolvedValue({
        id: 'test-id',
        question: 'Test?',
      } as any);

      quantitySchema.delete.mockResolvedValue(undefined); // ✅ Schema returns void/undefined

      const result = await service.deleteQuantityNode('test-id');

      expect(quantitySchema.findById).toHaveBeenCalledWith('test-id');
      expect(quantitySchema.delete).toHaveBeenCalledWith('test-id');
      expect(result).toEqual({ success: true }); // ✅ Service wraps it in an object
    });

    it('should throw NotFoundException when deleting non-existent quantity node', async () => {
      quantitySchema.findById.mockResolvedValue(null);

      await expect(
        service.deleteQuantityNode('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.deleteQuantityNode('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      quantitySchema.findById.mockResolvedValue({
        id: 'test-id',
      } as any);

      quantitySchema.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.deleteQuantityNode('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // VOTING TESTS - INCLUSION ONLY
  // ============================================
  describe('voteInclusion', () => {
    it('should vote on quantity node inclusion', async () => {
      quantitySchema.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await service.voteInclusion('test-id', 'user-123', true);

      expect(quantitySchema.voteInclusion).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should handle negative votes', async () => {
      quantitySchema.voteInclusion.mockResolvedValue(mockVoteResult);

      await service.voteInclusion('test-id', 'user-123', false);

      expect(quantitySchema.voteInclusion).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        false,
      );
    });

    it('should throw BadRequestException for empty quantity node ID', async () => {
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
      quantitySchema.voteInclusion.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.voteInclusion('test-id', 'user-123', true),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getVoteStatus', () => {
    it('should get vote status for a user', async () => {
      quantitySchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await service.getVoteStatus('test-id', 'user-123');

      expect(quantitySchema.getVoteStatus).toHaveBeenCalledWith(
        'test-id',
        'user-123',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should return null when user has not voted', async () => {
      quantitySchema.getVoteStatus.mockResolvedValue(null);

      const result = await service.getVoteStatus('test-id', 'user-123');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty quantity node ID', async () => {
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
      quantitySchema.getVoteStatus.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.getVoteStatus('test-id', 'user-123'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('removeVote', () => {
    it('should remove an inclusion vote', async () => {
      const voteResult = {
        ...mockVoteResult,
        inclusionPositiveVotes: 5,
        inclusionNetVotes: 3,
      };

      quantitySchema.removeVote.mockResolvedValue(voteResult);

      const result = await service.removeVote('test-id', 'user-123');

      expect(quantitySchema.removeVote).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        'INCLUSION',
      );
      expect(result).toEqual(voteResult);
    });

    it('should throw BadRequestException for empty quantity node ID', async () => {
      await expect(service.removeVote('', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.removeVote('test-id', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      quantitySchema.removeVote.mockRejectedValue(new Error('Database error'));

      await expect(service.removeVote('test-id', 'user-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getVotes', () => {
    it('should get vote totals for a quantity node', async () => {
      quantitySchema.getVotes.mockResolvedValue(mockVoteResult);

      const result = await service.getVotes('test-id');

      expect(quantitySchema.getVotes).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockVoteResult);
    });

    it('should return null when quantity node has no votes', async () => {
      quantitySchema.getVotes.mockResolvedValue(null);

      const result = await service.getVotes('test-id');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.getVotes('')).rejects.toThrow(BadRequestException);
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      quantitySchema.getVotes.mockRejectedValue(new Error('Database error'));

      await expect(service.getVotes('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // NUMERIC RESPONSE TESTS
  // ============================================
  describe('submitResponse', () => {
    const validResponseData = {
      userId: 'user-123',
      quantityNodeId: 'quantity-123',
      value: 3.5,
      unitId: 'usd',
    };

    it('should submit a numeric response successfully', async () => {
      const mockResponse = {
        id: 'response-123',
        userId: 'user-123',
        quantityNodeId: 'quantity-123',
        value: 3.5,
        unitId: 'usd',
        categoryId: 'currency',
        normalizedValue: 3.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      quantitySchema.getVotes.mockResolvedValue({
        ...mockVoteResult,
        inclusionNetVotes: 5,
      });

      quantitySchema.findById.mockResolvedValue({
        id: 'quantity-123',
        unitCategoryId: 'currency',
      } as any);

      unitService.validateUnitInCategory.mockReturnValue(true);
      quantitySchema.submitResponse.mockResolvedValue(mockResponse);

      const result = await service.submitResponse(validResponseData);

      expect(quantitySchema.getVotes).toHaveBeenCalledWith('quantity-123');
      expect(unitService.validateUnitInCategory).toHaveBeenCalledWith(
        'currency',
        'usd',
      );
      expect(quantitySchema.submitResponse).toHaveBeenCalledWith(
        validResponseData,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException when quantity node not approved', async () => {
      quantitySchema.getVotes.mockResolvedValue({
        ...mockVoteResult,
        inclusionNetVotes: -1,
      });

      await expect(service.submitResponse(validResponseData)).rejects.toThrow(
        'Quantity node must pass inclusion threshold before responses can be submitted',
      );

      expect(quantitySchema.submitResponse).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid unit', async () => {
      quantitySchema.getVotes.mockResolvedValue({
        ...mockVoteResult,
        inclusionNetVotes: 5,
      });

      quantitySchema.findById.mockResolvedValue({
        id: 'quantity-123',
        unitCategoryId: 'currency',
      } as any);

      unitService.validateUnitInCategory.mockReturnValue(false);

      await expect(service.submitResponse(validResponseData)).rejects.toThrow(
        'is not valid for category',
      );
    });

    it('should validate user ID', async () => {
      await expect(
        service.submitResponse({
          ...validResponseData,
          userId: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate quantity node ID', async () => {
      await expect(
        service.submitResponse({
          ...validResponseData,
          quantityNodeId: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate numeric value', async () => {
      await expect(
        service.submitResponse({
          ...validResponseData,
          value: NaN,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate unit ID', async () => {
      await expect(
        service.submitResponse({
          ...validResponseData,
          unitId: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      quantitySchema.getVotes.mockResolvedValue({
        ...mockVoteResult,
        inclusionNetVotes: 5,
      });

      quantitySchema.findById.mockResolvedValue({
        id: 'quantity-123',
        unitCategoryId: 'currency',
      } as any);

      unitService.validateUnitInCategory.mockReturnValue(true);

      quantitySchema.submitResponse.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.submitResponse(validResponseData)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getUserResponse', () => {
    it('should get user response for a quantity node', async () => {
      const mockResponse = {
        id: 'response-123',
        userId: 'user-123',
        quantityNodeId: 'quantity-123',
        value: 3.5,
        unitId: 'usd',
        categoryId: 'currency',
        normalizedValue: 3.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      quantitySchema.getUserResponse.mockResolvedValue(mockResponse);

      const result = await service.getUserResponse('user-123', 'quantity-123');

      expect(quantitySchema.getUserResponse).toHaveBeenCalledWith(
        'user-123',
        'quantity-123',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return null when user has not responded', async () => {
      quantitySchema.getUserResponse.mockResolvedValue(null);

      const result = await service.getUserResponse('user-123', 'quantity-123');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.getUserResponse('', 'quantity-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty quantity node ID', async () => {
      await expect(service.getUserResponse('user-123', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      quantitySchema.getUserResponse.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.getUserResponse('user-123', 'quantity-123'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deleteUserResponse', () => {
    it('should delete user response successfully when it exists', async () => {
      quantitySchema.deleteUserResponse.mockResolvedValue(true);

      const result = await service.deleteUserResponse(
        'user-123',
        'quantity-123',
      );

      expect(quantitySchema.deleteUserResponse).toHaveBeenCalledWith(
        'user-123',
        'quantity-123',
      );
      expect(result).toEqual({
        success: true,
        message: 'Response successfully deleted',
      });
    });

    it('should return appropriate message when no response exists to delete', async () => {
      quantitySchema.deleteUserResponse.mockResolvedValue(false);

      const result = await service.deleteUserResponse(
        'user-123',
        'quantity-123',
      );

      expect(result).toEqual({
        success: false,
        message: 'No response found to delete',
      });
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(
        service.deleteUserResponse('', 'quantity-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty quantity node ID', async () => {
      await expect(service.deleteUserResponse('user-123', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      quantitySchema.deleteUserResponse.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.deleteUserResponse('user-123', 'quantity-123'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ============================================
  // STATISTICS TESTS
  // ============================================
  describe('getStatistics', () => {
    it('should get statistics for a quantity node', async () => {
      const mockStats = {
        responseCount: 5,
        min: 1.0,
        max: 10.0,
        mean: 5.5,
        median: 5.0,
        standardDeviation: 2.5,
        percentiles: { 25: 3.0, 50: 5.0, 75: 7.5 },
        distributionCurve: [
          [1, 2],
          [5, 3],
          [10, 1],
        ],
      };

      // ✅ ADD: Mock findById so getQuantityNode succeeds
      quantitySchema.findById.mockResolvedValue({
        id: 'quantity-123',
        question: 'Test question?',
      } as any);

      quantitySchema.getStatistics.mockResolvedValue(mockStats);

      const result = await service.getStatistics('quantity-123');

      expect(quantitySchema.getStatistics).toHaveBeenCalledWith('quantity-123');
      expect(result).toEqual(mockStats);
    });

    it('should handle quantity node with no responses', async () => {
      // ✅ Mock findById so getQuantityNode succeeds
      quantitySchema.findById.mockResolvedValue({
        id: 'quantity-123',
        question: 'Test question?',
      } as any);

      // When no responses, schema returns an empty stats object
      const emptyStats = {
        responseCount: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        standardDeviation: 0,
        percentiles: {},
        distributionCurve: [],
      };

      quantitySchema.getStatistics.mockResolvedValue(emptyStats);

      const result = await service.getStatistics('quantity-123');

      expect(result).toEqual(emptyStats);
      expect(result.responseCount).toBe(0);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.getStatistics('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      // ✅ ADD: Mock findById so getQuantityNode succeeds
      quantitySchema.findById.mockResolvedValue({
        id: 'quantity-123',
        question: 'Test question?',
      } as any);

      quantitySchema.getStatistics.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getStatistics('quantity-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('isQuantityNodeApproved', () => {
    it('should return true when quantity node has positive net inclusion votes', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: 5,
      };
      quantitySchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isQuantityNodeApproved('test-id');

      expect(result).toBe(true);
    });

    it('should return false when quantity node has negative net inclusion votes', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: -3,
      };
      quantitySchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isQuantityNodeApproved('test-id');

      expect(result).toBe(false);
    });

    it('should return false when quantity node has exactly zero net inclusion votes', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: 0,
      };
      quantitySchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isQuantityNodeApproved('test-id');

      expect(result).toBe(false);
    });

    it('should return false when votes are null', async () => {
      quantitySchema.getVotes.mockResolvedValue(null);

      const result = await service.isQuantityNodeApproved('test-id');

      expect(result).toBe(false);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.isQuantityNodeApproved('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('isNumericResponseAllowed', () => {
    it('should return true when quantity node is approved', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: 5,
      };
      quantitySchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isNumericResponseAllowed('test-id');

      expect(result).toBe(true);
    });

    it('should return false when quantity node is not approved', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: -1,
      };
      quantitySchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isNumericResponseAllowed('test-id');

      expect(result).toBe(false);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.isNumericResponseAllowed('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
