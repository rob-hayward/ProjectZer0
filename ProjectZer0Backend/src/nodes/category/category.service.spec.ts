// src/nodes/category/category.service.spec.ts - CORRECTED TEST SUITE

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import {
  CategorySchema,
  type CategoryData,
} from '../../neo4j/schemas/category.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

describe('CategoryService', () => {
  let service: CategoryService;
  let categorySchema: jest.Mocked<CategorySchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  let userSchema: jest.Mocked<UserSchema>;

  // Mock category data with auto-generated name
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
    discussionId: 'discussion-cat-123',
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

  beforeEach(async () => {
    // Mock CategorySchema
    const mockCategorySchema = {
      createCategory: jest.fn(),
      getCategory: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      voteInclusion: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
      getCategoryHierarchy: jest.fn(),
      getCategoriesForNode: jest.fn(),
      getAllCategories: jest.fn(),
      getApprovedCategories: jest.fn(),
    };

    // Mock DiscussionSchema (CRITICAL - not DiscussionService!)
    const mockDiscussionSchema = {
      createDiscussionForNode: jest.fn(),
      getDiscussionIdForNode: jest.fn(),
      hasDiscussion: jest.fn(),
    };

    // Mock UserSchema
    const mockUserSchema = {
      addCreatedNode: jest.fn(),
      getUserCreatedNodes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: CategorySchema,
          useValue: mockCategorySchema,
        },
        {
          provide: DiscussionSchema,
          useValue: mockDiscussionSchema,
        },
        {
          provide: UserSchema,
          useValue: mockUserSchema,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    categorySchema = module.get(CategorySchema);
    discussionSchema = module.get(DiscussionSchema);
    userSchema = module.get(UserSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // SERVICE INITIALIZATION
  // ============================================

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should inject CategorySchema', () => {
    expect(categorySchema).toBeDefined();
  });

  it('should inject DiscussionSchema directly (not DiscussionService)', () => {
    expect(discussionSchema).toBeDefined();
    expect(discussionSchema.createDiscussionForNode).toBeDefined();
  });

  it('should inject UserSchema', () => {
    expect(userSchema).toBeDefined();
  });

  // ============================================
  // CREATE CATEGORY TESTS
  // ============================================

  describe('createCategory', () => {
    // Note: name and description removed from input
    const createCategoryData = {
      createdBy: 'user-123',
      publicCredit: true,
      wordIds: ['word-1', 'word-2', 'word-3'],
      parentCategoryId: 'parent-cat',
      initialComment: 'Initial comment',
    };

    it('should create category successfully', async () => {
      categorySchema.createCategory.mockResolvedValue(mockCategoryData);

      const result = await service.createCategory(createCategoryData);

      // Verify schema called with UUID and correct fields (no name/description)
      expect(categorySchema.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          createdBy: 'user-123',
          publicCredit: true,
          wordIds: ['word-1', 'word-2', 'word-3'],
          parentCategoryId: 'parent-cat',
          initialComment: 'Initial comment',
        }),
      );
      expect(result).toEqual(mockCategoryData);
    });

    it('should validate wordIds array exists', async () => {
      const noWordsData = { ...createCategoryData, wordIds: [] };

      await expect(service.createCategory(noWordsData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createCategory(noWordsData)).rejects.toThrow(
        'At least one word is required',
      );

      expect(categorySchema.createCategory).not.toHaveBeenCalled();
    });

    it('should validate minimum 1 word', async () => {
      const noWordsData = { ...createCategoryData, wordIds: [] };

      await expect(service.createCategory(noWordsData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createCategory(noWordsData)).rejects.toThrow(
        'At least one word is required',
      );
    });

    it('should validate maximum 5 words', async () => {
      const tooManyWords = {
        ...createCategoryData,
        wordIds: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'],
      };

      await expect(service.createCategory(tooManyWords)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createCategory(tooManyWords)).rejects.toThrow(
        'Maximum 5 words allowed',
      );
    });

    it('should default publicCredit to true', async () => {
      const dataWithoutCredit = { ...createCategoryData };
      delete dataWithoutCredit.publicCredit;

      categorySchema.createCategory.mockResolvedValue(mockCategoryData);

      await service.createCategory(dataWithoutCredit);

      expect(categorySchema.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          publicCredit: true,
        }),
      );
    });

    it('should preserve BadRequestException from schema', async () => {
      categorySchema.createCategory.mockRejectedValue(
        new BadRequestException('Invalid words'),
      );

      await expect(service.createCategory(createCategoryData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createCategory(createCategoryData)).rejects.toThrow(
        'Invalid words',
      );
    });

    it('should preserve NotFoundException from schema', async () => {
      categorySchema.createCategory.mockRejectedValue(
        new NotFoundException('Parent category not found'),
      );

      await expect(service.createCategory(createCategoryData)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      categorySchema.createCategory.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.createCategory(createCategoryData)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.createCategory(createCategoryData)).rejects.toThrow(
        'Failed to create category',
      );
    });

    it('should validate createdBy field', async () => {
      const invalidData = { ...createCategoryData, createdBy: '' };

      await expect(service.createCategory(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createCategory(invalidData)).rejects.toThrow(
        'Creator ID is required',
      );

      expect(categorySchema.createCategory).not.toHaveBeenCalled();
    });

    it('should validate wordIds are not empty strings', async () => {
      const invalidWords = { ...createCategoryData, wordIds: ['', 'word-2'] };

      await expect(service.createCategory(invalidWords)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createCategory(invalidWords)).rejects.toThrow(
        'Word IDs cannot be empty',
      );

      expect(categorySchema.createCategory).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // READ CATEGORY TESTS
  // ============================================

  describe('getCategory', () => {
    it('should get category by ID', async () => {
      categorySchema.getCategory.mockResolvedValue(mockCategoryData);

      const result = await service.getCategory('cat-123');

      expect(categorySchema.getCategory).toHaveBeenCalledWith('cat-123');
      expect(result).toEqual(mockCategoryData);
    });

    it('should return null when category not found', async () => {
      categorySchema.getCategory.mockResolvedValue(null);

      const result = await service.getCategory('nonexistent');

      expect(result).toBeNull();
    });

    it('should validate ID parameter', async () => {
      await expect(service.getCategory('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getCategory('')).rejects.toThrow(
        'Category ID is required',
      );

      expect(categorySchema.getCategory).not.toHaveBeenCalled();
    });

    it('should wrap schema errors', async () => {
      categorySchema.getCategory.mockRejectedValue(new Error('Database error'));

      await expect(service.getCategory('cat-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // UPDATE CATEGORY TESTS
  // ============================================

  describe('updateCategory', () => {
    // Note: Only publicCredit can be updated
    const updateData = {
      publicCredit: false,
    };

    it('should update category successfully', async () => {
      const updatedCategory = { ...mockCategoryData, publicCredit: false };
      categorySchema.update.mockResolvedValue(updatedCategory);

      const result = await service.updateCategory('cat-123', updateData);

      expect(categorySchema.update).toHaveBeenCalledWith('cat-123', updateData);
      expect(result).toEqual(updatedCategory);
    });

    it('should validate ID parameter', async () => {
      await expect(service.updateCategory('', updateData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateCategory('', updateData)).rejects.toThrow(
        'Category ID is required',
      );

      expect(categorySchema.update).not.toHaveBeenCalled();
    });

    it('should validate update data is not empty', async () => {
      await expect(service.updateCategory('cat-123', {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateCategory('cat-123', {})).rejects.toThrow(
        'No fields provided for update',
      );

      expect(categorySchema.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when category not found', async () => {
      categorySchema.update.mockResolvedValue(null);

      await expect(
        service.updateCategory('nonexistent', updateData),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateCategory('nonexistent', updateData),
      ).rejects.toThrow('Category with ID nonexistent not found');
    });

    it('should wrap unknown errors', async () => {
      categorySchema.update.mockRejectedValue(new Error('Database error'));

      await expect(
        service.updateCategory('cat-123', updateData),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ============================================
  // DELETE CATEGORY TESTS
  // ============================================

  describe('deleteCategory', () => {
    it('should delete category successfully', async () => {
      categorySchema.delete.mockResolvedValue(undefined);

      await service.deleteCategory('cat-123');

      expect(categorySchema.delete).toHaveBeenCalledWith('cat-123');
    });

    it('should validate ID parameter', async () => {
      await expect(service.deleteCategory('')).rejects.toThrow(
        BadRequestException,
      );

      expect(categorySchema.delete).not.toHaveBeenCalled();
    });

    it('should preserve NotFoundException from schema', async () => {
      categorySchema.delete.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await expect(service.deleteCategory('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should wrap unknown errors', async () => {
      categorySchema.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.deleteCategory('cat-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // VOTING OPERATIONS TESTS
  // ============================================

  describe('voteInclusion', () => {
    it('should vote positive on category inclusion', async () => {
      categorySchema.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await service.voteInclusion('cat-123', 'user-456', true);

      expect(categorySchema.voteInclusion).toHaveBeenCalledWith(
        'cat-123',
        'user-456',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should vote negative on category inclusion', async () => {
      categorySchema.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await service.voteInclusion('cat-123', 'user-456', false);

      expect(categorySchema.voteInclusion).toHaveBeenCalledWith(
        'cat-123',
        'user-456',
        false,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should validate category ID', async () => {
      await expect(service.voteInclusion('', 'user-456', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate user ID', async () => {
      await expect(service.voteInclusion('cat-123', '', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors', async () => {
      categorySchema.voteInclusion.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.voteInclusion('cat-123', 'user-456', true),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getVoteStatus', () => {
    it('should get vote status for user', async () => {
      categorySchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await service.getVoteStatus('cat-123', 'user-456');

      expect(categorySchema.getVoteStatus).toHaveBeenCalledWith(
        'cat-123',
        'user-456',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should validate category ID', async () => {
      await expect(service.getVoteStatus('', 'user-456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate user ID', async () => {
      await expect(service.getVoteStatus('cat-123', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors', async () => {
      categorySchema.getVoteStatus.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.getVoteStatus('cat-123', 'user-456'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('removeVote', () => {
    it('should remove vote successfully', async () => {
      categorySchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await service.removeVote('cat-123', 'user-456');

      expect(categorySchema.removeVote).toHaveBeenCalledWith(
        'cat-123',
        'user-456',
        'INCLUSION',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should validate category ID', async () => {
      await expect(service.removeVote('', 'user-456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate user ID', async () => {
      await expect(service.removeVote('cat-123', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors', async () => {
      categorySchema.removeVote.mockRejectedValue(new Error('Database error'));

      await expect(service.removeVote('cat-123', 'user-456')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getVotes', () => {
    it('should get vote counts', async () => {
      categorySchema.getVotes.mockResolvedValue(mockVoteResult);

      const result = await service.getVotes('cat-123');

      expect(categorySchema.getVotes).toHaveBeenCalledWith('cat-123');
      expect(result).toEqual(mockVoteResult);
    });

    it('should validate category ID', async () => {
      await expect(service.getVotes('')).rejects.toThrow(BadRequestException);
    });

    it('should wrap schema errors', async () => {
      categorySchema.getVotes.mockRejectedValue(new Error('Database error'));

      await expect(service.getVotes('cat-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // HIERARCHY OPERATIONS TESTS
  // ============================================

  describe('getCategoryHierarchy', () => {
    const mockHierarchy = [
      {
        id: 'cat-1',
        name: 'Technology',
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
      } as CategoryData,
    ];

    it('should get full hierarchy when no rootId', async () => {
      categorySchema.getCategoryHierarchy.mockResolvedValue(mockHierarchy);

      const result = await service.getCategoryHierarchy();

      expect(categorySchema.getCategoryHierarchy).toHaveBeenCalledWith(
        undefined,
      );
      expect(result).toEqual(mockHierarchy);
    });

    it('should get hierarchy from specific root', async () => {
      categorySchema.getCategoryHierarchy.mockResolvedValue(mockHierarchy);

      const result = await service.getCategoryHierarchy('root-cat');

      expect(categorySchema.getCategoryHierarchy).toHaveBeenCalledWith(
        'root-cat',
      );
      expect(result).toEqual(mockHierarchy);
    });

    it('should wrap schema errors', async () => {
      categorySchema.getCategoryHierarchy.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getCategoryHierarchy()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getCategoriesForNode', () => {
    const mockCategories = [
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
      } as CategoryData,
    ];

    it('should get categories for a node', async () => {
      categorySchema.getCategoriesForNode.mockResolvedValue(mockCategories);

      const result = await service.getCategoriesForNode('node-123');

      expect(categorySchema.getCategoriesForNode).toHaveBeenCalledWith(
        'node-123',
      );
      expect(result).toEqual(mockCategories);
    });

    it('should validate node ID', async () => {
      await expect(service.getCategoriesForNode('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors', async () => {
      categorySchema.getCategoriesForNode.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getCategoriesForNode('node-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // QUERY OPERATIONS TESTS
  // ============================================

  describe('getAllCategories', () => {
    const mockCategories = [mockCategoryData];

    it('should get all categories', async () => {
      categorySchema.getAllCategories.mockResolvedValue(mockCategories);

      const result = await service.getAllCategories();

      expect(categorySchema.getAllCategories).toHaveBeenCalled();
      expect(result).toEqual(mockCategories);
    });

    it('should wrap schema errors', async () => {
      categorySchema.getAllCategories.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getAllCategories()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getApprovedCategories', () => {
    const mockApprovedCategories = [mockCategoryData];

    it('should get approved categories', async () => {
      categorySchema.getApprovedCategories.mockResolvedValue(
        mockApprovedCategories,
      );

      const result = await service.getApprovedCategories();

      expect(categorySchema.getApprovedCategories).toHaveBeenCalled();
      expect(result).toEqual(mockApprovedCategories);
    });

    it('should wrap schema errors', async () => {
      categorySchema.getApprovedCategories.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getApprovedCategories()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
