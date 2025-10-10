// src/nodes/category/category.controller.spec.ts - CORRECTED TEST SUITE

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import type { CategoryData } from '../../neo4j/schemas/category.schema';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

describe('CategoryController', () => {
  let controller: CategoryController;
  let categoryService: jest.Mocked<CategoryService>;

  // Mock data with auto-generated name
  const mockCategoryData = {
    id: 'cat-123',
    name: 'word category', // ← Auto-generated from constituent words
    createdBy: 'user-123',
    publicCredit: true,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
    inclusionPositiveVotes: 8,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 6,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
    wordCount: 3,
    contentCount: 15,
    childCount: 2,
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 8,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 6,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 8,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 6,
    contentStatus: null,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockRequest = {
    user: {
      sub: 'user-123',
      username: 'testuser',
    },
  };

  beforeEach(async () => {
    const mockCategoryService = {
      createCategory: jest.fn(),
      getCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      voteInclusion: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
      getCategoryHierarchy: jest.fn(),
      getCategoriesForNode: jest.fn(),
      getAllCategories: jest.fn(),
      getApprovedCategories: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: mockCategoryService,
        },
      ],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
    categoryService = module.get(CategoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // CONTROLLER INITIALIZATION
  // ============================================

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should inject CategoryService', () => {
    expect(categoryService).toBeDefined();
  });

  // ============================================
  // CREATE CATEGORY TESTS
  // ============================================

  describe('POST /categories (createCategory)', () => {
    // Note: name and description removed - name is auto-generated
    const createCategoryDto = {
      publicCredit: true,
      wordIds: ['word-1', 'word-2', 'word-3'],
      parentCategoryId: 'parent-cat',
      initialComment: 'Initial comment',
    };

    it('should create category successfully', async () => {
      categoryService.createCategory.mockResolvedValue(mockCategoryData);

      const result = await controller.createCategory(
        createCategoryDto,
        mockRequest,
      );

      expect(categoryService.createCategory).toHaveBeenCalledWith({
        ...createCategoryDto,
        createdBy: 'user-123', // From req.user.sub
      });
      expect(result).toEqual(mockCategoryData);
    });

    it('should extract user ID from req.user.sub', async () => {
      categoryService.createCategory.mockResolvedValue(mockCategoryData);

      await controller.createCategory(createCategoryDto, mockRequest);

      expect(categoryService.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: 'user-123', // Extracted from JWT
        }),
      );
    });

    it('should validate wordIds is not empty', async () => {
      const noWordsDto = { ...createCategoryDto, wordIds: [] };

      await expect(
        controller.createCategory(noWordsDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createCategory(noWordsDto, mockRequest),
      ).rejects.toThrow('At least one word ID is required');

      expect(categoryService.createCategory).not.toHaveBeenCalled();
    });

    it('should validate wordIds is provided', async () => {
      const undefinedWordsDto = {
        ...createCategoryDto,
        wordIds: undefined as any,
      };

      await expect(
        controller.createCategory(undefinedWordsDto, mockRequest),
      ).rejects.toThrow(BadRequestException);

      expect(categoryService.createCategory).not.toHaveBeenCalled();
    });

    it('should validate maximum 5 words', async () => {
      const tooManyWordsDto = {
        ...createCategoryDto,
        wordIds: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'],
      };

      await expect(
        controller.createCategory(tooManyWordsDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createCategory(tooManyWordsDto, mockRequest),
      ).rejects.toThrow('Maximum 5 words allowed per category');

      expect(categoryService.createCategory).not.toHaveBeenCalled();
    });

    it('should require authenticated user', async () => {
      const requestWithoutUser = { user: {} };

      await expect(
        controller.createCategory(createCategoryDto, requestWithoutUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createCategory(createCategoryDto, requestWithoutUser),
      ).rejects.toThrow('User ID is required');

      expect(categoryService.createCategory).not.toHaveBeenCalled();
    });

    it('should return 201 CREATED status', async () => {
      categoryService.createCategory.mockResolvedValue(mockCategoryData);

      // HTTP status code is set via @HttpCode(HttpStatus.CREATED) decorator
      const result = await controller.createCategory(
        createCategoryDto,
        mockRequest,
      );

      expect(result).toEqual(mockCategoryData);
    });
  });

  // ============================================
  // READ CATEGORY TESTS
  // ============================================

  describe('GET /categories/:id (getCategory)', () => {
    it('should get category by ID', async () => {
      categoryService.getCategory.mockResolvedValue(mockCategoryData);

      const result = await controller.getCategory('cat-123');

      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-123');
      expect(result).toEqual(mockCategoryData);
    });

    it('should validate ID parameter', async () => {
      await expect(controller.getCategory('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getCategory('')).rejects.toThrow(
        'Category ID is required',
      );

      expect(categoryService.getCategory).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when category not found', async () => {
      categoryService.getCategory.mockResolvedValue(null);

      await expect(controller.getCategory('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getCategory('nonexistent')).rejects.toThrow(
        'Category with ID nonexistent not found',
      );
    });

    it('should return category data when found', async () => {
      categoryService.getCategory.mockResolvedValue(mockCategoryData);

      const result = await controller.getCategory('cat-123');

      expect(result).toEqual(mockCategoryData);
    });
  });

  // ============================================
  // UPDATE CATEGORY TESTS
  // ============================================

  describe('PUT /categories/:id (updateCategory)', () => {
    // Note: Only publicCredit can be updated
    const updateDto = {
      publicCredit: false,
    };

    it('should update category successfully', async () => {
      const updatedCategory = {
        ...mockCategoryData,
        publicCredit: false,
      };
      categoryService.updateCategory.mockResolvedValue(updatedCategory);

      const result = await controller.updateCategory(
        'cat-123',
        updateDto,
        mockRequest,
      );

      expect(categoryService.updateCategory).toHaveBeenCalledWith(
        'cat-123',
        updateDto,
      );
      expect(result).toEqual(updatedCategory);
    });

    it('should validate ID parameter', async () => {
      await expect(
        controller.updateCategory('', updateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.updateCategory('', updateDto, mockRequest),
      ).rejects.toThrow('Category ID is required');

      expect(categoryService.updateCategory).not.toHaveBeenCalled();
    });

    it('should validate publicCredit field is provided', async () => {
      await expect(
        controller.updateCategory('cat-123', {}, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.updateCategory('cat-123', {}, mockRequest),
      ).rejects.toThrow('publicCredit field is required for update');

      expect(categoryService.updateCategory).not.toHaveBeenCalled();
    });

    it('should require authenticated user', async () => {
      const requestWithoutUser = { user: {} };

      await expect(
        controller.updateCategory('cat-123', updateDto, requestWithoutUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.updateCategory('cat-123', updateDto, requestWithoutUser),
      ).rejects.toThrow('User ID is required');

      expect(categoryService.updateCategory).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when category not found', async () => {
      categoryService.updateCategory.mockResolvedValue(null);

      await expect(
        controller.updateCategory('nonexistent', updateDto, mockRequest),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.updateCategory('nonexistent', updateDto, mockRequest),
      ).rejects.toThrow('Category with ID nonexistent not found');
    });
  });

  // ============================================
  // DELETE CATEGORY TESTS
  // ============================================

  describe('DELETE /categories/:id (deleteCategory)', () => {
    it('should delete category successfully', async () => {
      categoryService.deleteCategory.mockResolvedValue(undefined);

      await controller.deleteCategory('cat-123', mockRequest);

      expect(categoryService.deleteCategory).toHaveBeenCalledWith('cat-123');
    });

    it('should validate ID parameter', async () => {
      await expect(controller.deleteCategory('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.deleteCategory('', mockRequest)).rejects.toThrow(
        'Category ID is required',
      );

      expect(categoryService.deleteCategory).not.toHaveBeenCalled();
    });

    it('should require authenticated user', async () => {
      const requestWithoutUser = { user: {} };

      await expect(
        controller.deleteCategory('cat-123', requestWithoutUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.deleteCategory('cat-123', requestWithoutUser),
      ).rejects.toThrow('User ID is required');

      expect(categoryService.deleteCategory).not.toHaveBeenCalled();
    });

    it('should return 204 NO CONTENT status', async () => {
      categoryService.deleteCategory.mockResolvedValue(undefined);

      // HTTP status code is set via @HttpCode(HttpStatus.NO_CONTENT) decorator
      // No content returned, just verify the call was made
      await controller.deleteCategory('cat-123', mockRequest);

      expect(categoryService.deleteCategory).toHaveBeenCalledWith('cat-123');
    });
  });

  // ============================================
  // VOTING ENDPOINTS TESTS
  // ============================================

  describe('POST /categories/:id/vote-inclusion (voteInclusion)', () => {
    const voteDto = { isPositive: true };

    it('should vote positive on category inclusion', async () => {
      categoryService.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await controller.voteInclusion(
        'cat-123',
        voteDto,
        mockRequest,
      );

      expect(categoryService.voteInclusion).toHaveBeenCalledWith(
        'cat-123',
        'user-123',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should vote negative on category inclusion', async () => {
      const negativeVoteDto = { isPositive: false };
      categoryService.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await controller.voteInclusion(
        'cat-123',
        negativeVoteDto,
        mockRequest,
      );

      expect(categoryService.voteInclusion).toHaveBeenCalledWith(
        'cat-123',
        'user-123',
        false,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should validate category ID', async () => {
      await expect(
        controller.voteInclusion('', voteDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.voteInclusion('', voteDto, mockRequest),
      ).rejects.toThrow('Category ID is required');

      expect(categoryService.voteInclusion).not.toHaveBeenCalled();
    });

    it('should validate vote status', async () => {
      const invalidVoteDto = { isPositive: undefined as any };

      await expect(
        controller.voteInclusion('cat-123', invalidVoteDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.voteInclusion('cat-123', invalidVoteDto, mockRequest),
      ).rejects.toThrow('Vote status (isPositive) is required');

      expect(categoryService.voteInclusion).not.toHaveBeenCalled();
    });

    it('should require authenticated user', async () => {
      const requestWithoutUser = { user: {} };

      await expect(
        controller.voteInclusion('cat-123', voteDto, requestWithoutUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.voteInclusion('cat-123', voteDto, requestWithoutUser),
      ).rejects.toThrow('User ID is required');

      expect(categoryService.voteInclusion).not.toHaveBeenCalled();
    });
  });

  describe('GET /categories/:id/vote-status (getVoteStatus)', () => {
    it('should get vote status for user', async () => {
      categoryService.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await controller.getVoteStatus('cat-123', mockRequest);

      expect(categoryService.getVoteStatus).toHaveBeenCalledWith(
        'cat-123',
        'user-123',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should validate category ID', async () => {
      await expect(controller.getVoteStatus('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );

      expect(categoryService.getVoteStatus).not.toHaveBeenCalled();
    });

    it('should require authenticated user', async () => {
      const requestWithoutUser = { user: {} };

      await expect(
        controller.getVoteStatus('cat-123', requestWithoutUser),
      ).rejects.toThrow(BadRequestException);

      expect(categoryService.getVoteStatus).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /categories/:id/vote (removeVote)', () => {
    it('should remove vote successfully', async () => {
      categoryService.removeVote.mockResolvedValue(mockVoteResult);

      const result = await controller.removeVote('cat-123', mockRequest);

      expect(categoryService.removeVote).toHaveBeenCalledWith(
        'cat-123',
        'user-123',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should validate category ID', async () => {
      await expect(controller.removeVote('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );

      expect(categoryService.removeVote).not.toHaveBeenCalled();
    });

    it('should require authenticated user', async () => {
      const requestWithoutUser = { user: {} };

      await expect(
        controller.removeVote('cat-123', requestWithoutUser),
      ).rejects.toThrow(BadRequestException);

      expect(categoryService.removeVote).not.toHaveBeenCalled();
    });
  });

  describe('GET /categories/:id/votes (getVotes)', () => {
    it('should get vote counts', async () => {
      categoryService.getVotes.mockResolvedValue(mockVoteResult);

      const result = await controller.getVotes('cat-123');

      expect(categoryService.getVotes).toHaveBeenCalledWith('cat-123');
      expect(result).toEqual(mockVoteResult);
    });

    it('should validate category ID', async () => {
      await expect(controller.getVotes('')).rejects.toThrow(
        BadRequestException,
      );

      expect(categoryService.getVotes).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // HIERARCHY ENDPOINTS TESTS
  // ============================================

  describe('GET /categories/hierarchy/tree (getCategoryHierarchy)', () => {
    const mockHierarchy: CategoryData[] = [
      {
        id: 'cat-1',
        name: 'word category',
        createdBy: 'user-123',
        publicCredit: true,
        inclusionNetVotes: 5,
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
      },
    ];

    it('should get full hierarchy when no rootId', async () => {
      categoryService.getCategoryHierarchy.mockResolvedValue(mockHierarchy);

      const result = await controller.getCategoryHierarchy({ query: {} });

      expect(categoryService.getCategoryHierarchy).toHaveBeenCalledWith(
        undefined,
      );
      expect(result).toEqual(mockHierarchy);
    });

    it('should get hierarchy from specific root', async () => {
      categoryService.getCategoryHierarchy.mockResolvedValue(mockHierarchy);

      const result = await controller.getCategoryHierarchy({
        query: { rootId: 'root-cat' },
      });

      expect(categoryService.getCategoryHierarchy).toHaveBeenCalledWith(
        'root-cat',
      );
      expect(result).toEqual(mockHierarchy);
    });
  });

  describe('GET /categories/node/:nodeId (getCategoriesForNode)', () => {
    const mockCategories: CategoryData[] = [
      {
        id: 'cat-1',
        name: 'word category',
        createdBy: 'user-123',
        publicCredit: true,
        inclusionNetVotes: 5,
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
      },
    ];

    it('should get categories for a node', async () => {
      categoryService.getCategoriesForNode.mockResolvedValue(mockCategories);

      const result = await controller.getCategoriesForNode('node-123');

      expect(categoryService.getCategoriesForNode).toHaveBeenCalledWith(
        'node-123',
      );
      expect(result).toEqual(mockCategories);
    });

    it('should validate node ID parameter', async () => {
      await expect(controller.getCategoriesForNode('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getCategoriesForNode('')).rejects.toThrow(
        'Node ID is required',
      );

      expect(categoryService.getCategoriesForNode).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // QUERY ENDPOINT TESTS
  // ============================================

  describe('GET /categories (getAllCategories)', () => {
    const mockCategories = [mockCategoryData];

    it('should get all categories', async () => {
      categoryService.getAllCategories.mockResolvedValue(mockCategories);

      const result = await controller.getAllCategories();

      expect(categoryService.getAllCategories).toHaveBeenCalled();
      expect(result).toEqual(mockCategories);
    });
  });

  describe('GET /categories/approved/list (getApprovedCategories)', () => {
    const mockApprovedCategories = [mockCategoryData];

    it('should get approved categories', async () => {
      categoryService.getApprovedCategories.mockResolvedValue(
        mockApprovedCategories,
      );

      const result = await controller.getApprovedCategories();

      expect(categoryService.getApprovedCategories).toHaveBeenCalled();
      expect(result).toEqual(mockApprovedCategories);
    });
  });

  // ============================================
  // INTEGRATION TESTS
  // ============================================

  describe('Integration - Full Category Lifecycle', () => {
    it('should handle full category lifecycle', async () => {
      // 1. Create category
      const createDto = {
        publicCredit: true,
        wordIds: ['word-1', 'word-2'],
        initialComment: 'Test category',
      };

      categoryService.createCategory.mockResolvedValue(mockCategoryData);

      const created = await controller.createCategory(createDto, mockRequest);
      expect(created).toEqual(mockCategoryData);

      // 2. Get category
      categoryService.getCategory.mockResolvedValue(mockCategoryData);
      const retrieved = await controller.getCategory('cat-123');
      expect(retrieved).toEqual(mockCategoryData);

      // 3. Vote on category
      categoryService.voteInclusion.mockResolvedValue(mockVoteResult);
      const voteResult = await controller.voteInclusion(
        'cat-123',
        { isPositive: true },
        mockRequest,
      );
      expect(voteResult).toEqual(mockVoteResult);

      // 4. Update category
      const updateDto = { publicCredit: false };
      const updatedCategory = { ...mockCategoryData, publicCredit: false };
      categoryService.updateCategory.mockResolvedValue(updatedCategory);

      const updated = await controller.updateCategory(
        'cat-123',
        updateDto,
        mockRequest,
      );
      expect(updated.publicCredit).toBe(false);

      // 5. Delete category
      categoryService.deleteCategory.mockResolvedValue(undefined);
      await controller.deleteCategory('cat-123', mockRequest);
      expect(categoryService.deleteCategory).toHaveBeenCalledWith('cat-123');
    });
  });
});
