// src/nodes/category/category.controller.spec.ts - COMPLETE TEST SUITE

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

describe('CategoryController', () => {
  let controller: CategoryController;
  let categoryService: jest.Mocked<CategoryService>;

  const mockCategoryData = {
    id: 'cat-123',
    name: 'Technology',
    description: 'Technology related content',
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
    const createCategoryDto = {
      name: 'Technology',
      description: 'Technology related content',
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

    it('should validate required name field', async () => {
      const invalidDto = { ...createCategoryDto, name: '' };

      await expect(
        controller.createCategory(invalidDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createCategory(invalidDto, mockRequest),
      ).rejects.toThrow('Category name is required');

      expect(categoryService.createCategory).not.toHaveBeenCalled();
    });

    it('should validate wordIds is not empty', async () => {
      const noWordsDto = { ...createCategoryDto, wordIds: [] };

      await expect(
        controller.createCategory(noWordsDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createCategory(noWordsDto, mockRequest),
      ).rejects.toThrow('At least one word is required');

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
      ).rejects.toThrow('Maximum 5 words allowed');

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
    const updateDto = {
      name: 'Updated Technology',
      description: 'Updated description',
      publicCredit: false,
    };

    it('should update category successfully', async () => {
      const updatedCategory = {
        ...mockCategoryData,
        name: 'Updated Technology',
        description: 'Updated description',
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

    it('should validate at least one field provided', async () => {
      await expect(
        controller.updateCategory('cat-123', {}, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.updateCategory('cat-123', {}, mockRequest),
      ).rejects.toThrow('At least one field must be provided for update');

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

    it('should allow updating only name', async () => {
      const nameOnly = { name: 'New Name' };
      const updated = {
        ...mockCategoryData,
        name: 'New Name',
      };
      categoryService.updateCategory.mockResolvedValue(updated);

      await controller.updateCategory('cat-123', nameOnly, mockRequest);

      expect(categoryService.updateCategory).toHaveBeenCalledWith(
        'cat-123',
        nameOnly,
      );
    });

    it('should allow updating only description', async () => {
      const descOnly = { description: 'New description' };
      const updated = {
        ...mockCategoryData,
        description: 'New description',
      };
      categoryService.updateCategory.mockResolvedValue(updated);

      await controller.updateCategory('cat-123', descOnly, mockRequest);

      expect(categoryService.updateCategory).toHaveBeenCalledWith(
        'cat-123',
        descOnly,
      );
    });

    it('should allow updating only publicCredit', async () => {
      const creditOnly = { publicCredit: false };
      const updated = {
        ...mockCategoryData,
        publicCredit: false,
      };
      categoryService.updateCategory.mockResolvedValue(updated);

      await controller.updateCategory('cat-123', creditOnly, mockRequest);

      expect(categoryService.updateCategory).toHaveBeenCalledWith(
        'cat-123',
        creditOnly,
      );
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

    it('should return 204 NO_CONTENT status', async () => {
      categoryService.deleteCategory.mockResolvedValue(undefined);

      // HTTP status code is set via @HttpCode(HttpStatus.NO_CONTENT) decorator
      await controller.deleteCategory('cat-123', mockRequest);

      expect(categoryService.deleteCategory).toHaveBeenCalledWith('cat-123');
    });
  });

  // ============================================
  // VOTING ENDPOINT TESTS
  // ============================================

  describe('POST /categories/:id/vote-inclusion (voteInclusion)', () => {
    const voteDto = { isPositive: true };

    it('should vote on category inclusion', async () => {
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

    it('should validate ID parameter', async () => {
      await expect(
        controller.voteInclusion('', voteDto, mockRequest),
      ).rejects.toThrow(BadRequestException);

      expect(categoryService.voteInclusion).not.toHaveBeenCalled();
    });

    it('should validate isPositive is boolean', async () => {
      const invalidVote = { isPositive: 'true' as any };

      await expect(
        controller.voteInclusion('cat-123', invalidVote, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.voteInclusion('cat-123', invalidVote, mockRequest),
      ).rejects.toThrow('isPositive must be a boolean');

      expect(categoryService.voteInclusion).not.toHaveBeenCalled();
    });

    it('should require authenticated user', async () => {
      const requestWithoutUser = { user: {} };

      await expect(
        controller.voteInclusion('cat-123', voteDto, requestWithoutUser),
      ).rejects.toThrow(BadRequestException);

      expect(categoryService.voteInclusion).not.toHaveBeenCalled();
    });

    it('should handle negative vote', async () => {
      const negativeVote = { isPositive: false };
      categoryService.voteInclusion.mockResolvedValue(mockVoteResult);

      await controller.voteInclusion('cat-123', negativeVote, mockRequest);

      expect(categoryService.voteInclusion).toHaveBeenCalledWith(
        'cat-123',
        'user-123',
        false,
      );
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

    it('should validate ID parameter', async () => {
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

    it('should return null when user has not voted', async () => {
      categoryService.getVoteStatus.mockResolvedValue(null);

      const result = await controller.getVoteStatus('cat-123', mockRequest);

      expect(result).toBeNull();
    });
  });

  describe('DELETE /categories/:id/vote (removeVote)', () => {
    it('should remove vote', async () => {
      categoryService.removeVote.mockResolvedValue(mockVoteResult);

      const result = await controller.removeVote('cat-123', mockRequest);

      expect(categoryService.removeVote).toHaveBeenCalledWith(
        'cat-123',
        'user-123',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should validate ID parameter', async () => {
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

    it('should validate ID parameter', async () => {
      await expect(controller.getVotes('')).rejects.toThrow(
        BadRequestException,
      );

      expect(categoryService.getVotes).not.toHaveBeenCalled();
    });

    it('should return null when category has no votes', async () => {
      categoryService.getVotes.mockResolvedValue(null);

      const result = await controller.getVotes('cat-123');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // HIERARCHICAL ENDPOINT TESTS
  // ============================================

  describe('GET /categories/hierarchy/all (getCategoryHierarchy)', () => {
    const mockHierarchy = [
      {
        id: 'cat-1',
        name: 'Parent',
        description: 'Parent category',
        inclusionNetVotes: 5,
        children: [],
      },
      {
        id: 'cat-2',
        name: 'Child',
        description: 'Child category',
        inclusionNetVotes: 3,
        children: [],
      },
    ];

    it('should get full category hierarchy', async () => {
      categoryService.getCategoryHierarchy.mockResolvedValue(mockHierarchy);

      const result = await controller.getCategoryHierarchy();

      expect(categoryService.getCategoryHierarchy).toHaveBeenCalledWith();
      expect(result).toEqual(mockHierarchy);
    });
  });

  describe('GET /categories/hierarchy/:rootId (getCategoryHierarchyFrom)', () => {
    const mockHierarchy = [
      {
        id: 'cat-1',
        name: 'Parent',
        description: 'Parent category',
        inclusionNetVotes: 5,
        children: [],
      },
    ];

    it('should get hierarchy from specific root', async () => {
      categoryService.getCategoryHierarchy.mockResolvedValue(mockHierarchy);

      const result = await controller.getCategoryHierarchyFrom('cat-1');

      expect(categoryService.getCategoryHierarchy).toHaveBeenCalledWith(
        'cat-1',
      );
      expect(result).toEqual(mockHierarchy);
    });

    it('should validate root ID parameter', async () => {
      await expect(controller.getCategoryHierarchyFrom('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getCategoryHierarchyFrom('')).rejects.toThrow(
        'Root ID is required',
      );

      expect(categoryService.getCategoryHierarchy).not.toHaveBeenCalled();
    });
  });

  describe('GET /categories/node/:nodeId/categories (getCategoriesForNode)', () => {
    const mockCategories = [
      {
        id: 'cat-1',
        name: 'Technology',
        description: 'Tech category',
        inclusionNetVotes: 5,
        path: [
          { id: 'root-1', name: 'Root' },
          { id: 'cat-1', name: 'Technology' },
        ],
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
      // 1. Create
      categoryService.createCategory.mockResolvedValue(mockCategoryData);
      const created = await controller.createCategory(
        {
          name: 'Technology',
          description: 'Tech content',
          publicCredit: true,
          wordIds: ['word-1', 'word-2'],
        },
        mockRequest,
      );
      expect(created).toEqual(mockCategoryData);

      // 2. Read
      categoryService.getCategory.mockResolvedValue(mockCategoryData);
      const fetched = await controller.getCategory('cat-123');
      expect(fetched).toEqual(mockCategoryData);

      // 3. Update
      const updated = {
        ...mockCategoryData,
        name: 'Updated Tech',
      };
      categoryService.updateCategory.mockResolvedValue(updated);
      const result = await controller.updateCategory(
        'cat-123',
        { name: 'Updated Tech' },
        mockRequest,
      );
      expect(result.name).toBe('Updated Tech');

      // 4. Vote
      categoryService.voteInclusion.mockResolvedValue(mockVoteResult);
      const voteResult = await controller.voteInclusion(
        'cat-123',
        { isPositive: true },
        mockRequest,
      );
      expect(voteResult).toEqual(mockVoteResult);

      // 5. Delete
      categoryService.deleteCategory.mockResolvedValue(undefined);
      await controller.deleteCategory('cat-123', mockRequest);
      expect(categoryService.deleteCategory).toHaveBeenCalledWith('cat-123');
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      categoryService.createCategory.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(
        controller.createCategory(
          {
            name: 'Tech',
            wordIds: ['word-1'],
          },
          mockRequest,
        ),
      ).rejects.toThrow('Service error');
    });

    it('should preserve BadRequestException from service', async () => {
      categoryService.updateCategory.mockRejectedValue(
        new BadRequestException('Invalid update'),
      );

      await expect(
        controller.updateCategory('cat-123', { name: 'New Name' }, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should preserve NotFoundException from service', async () => {
      categoryService.deleteCategory.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await expect(
        controller.deleteCategory('nonexistent', mockRequest),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
