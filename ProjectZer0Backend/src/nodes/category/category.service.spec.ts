// src/nodes/category/category.service.spec.ts - COMPLETE TEST SUITE

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategorySchema } from '../../neo4j/schemas/category.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

describe('CategoryService', () => {
  let service: CategoryService;
  let categorySchema: jest.Mocked<CategorySchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  let userSchema: jest.Mocked<UserSchema>;

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
      findById: jest.fn(),
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
          provide: DiscussionSchema, // ← Direct injection, not DiscussionService!
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
    const createCategoryData = {
      name: 'Technology',
      description: 'Technology related content',
      createdBy: 'user-123',
      publicCredit: true,
      wordIds: ['word-1', 'word-2', 'word-3'],
      parentCategoryId: 'parent-cat',
      initialComment: 'Initial comment',
    };

    it('should create category successfully', async () => {
      categorySchema.createCategory.mockResolvedValue(mockCategoryData);

      const result = await service.createCategory(createCategoryData);

      // Verify schema called with UUID (any string)
      expect(categorySchema.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          name: 'Technology',
          description: 'Technology related content',
          createdBy: 'user-123',
          publicCredit: true,
          wordIds: ['word-1', 'word-2', 'word-3'],
          parentCategoryId: 'parent-cat',
        }),
      );
      expect(result).toEqual(mockCategoryData);
    });

    it('should create discussion if initialComment provided', async () => {
      categorySchema.createCategory.mockResolvedValue(mockCategoryData);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-cat-123',
      });

      await service.createCategory(createCategoryData);

      // Verify DiscussionSchema called directly
      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: mockCategoryData.id,
        nodeType: 'CategoryNode',
        nodeIdField: 'id', // ← Standard 'id' for CategoryNode
        createdBy: 'user-123',
        initialComment: 'Initial comment',
      });
    });

    it('should use correct nodeIdField for CategoryNode', async () => {
      categorySchema.createCategory.mockResolvedValue(mockCategoryData);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-cat-123',
      });

      await service.createCategory(createCategoryData);

      // Verify nodeIdField is 'id' (standard, unlike WordNode's 'word')
      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeIdField: 'id', // ← Must be 'id' for CategoryNode
        }),
      );
    });

    it('should continue if discussion creation fails', async () => {
      categorySchema.createCategory.mockResolvedValue(mockCategoryData);
      discussionSchema.createDiscussionForNode.mockRejectedValue(
        new Error('Discussion creation failed'),
      );

      // Should not throw - category creation succeeded
      const result = await service.createCategory(createCategoryData);

      expect(categorySchema.createCategory).toHaveBeenCalled();
      expect(result).toEqual(mockCategoryData);
    });

    it('should not create discussion if no initialComment', async () => {
      const dataWithoutComment = { ...createCategoryData };
      delete dataWithoutComment.initialComment;

      categorySchema.createCategory.mockResolvedValue(mockCategoryData);

      await service.createCategory(dataWithoutComment);

      expect(categorySchema.createCategory).toHaveBeenCalled();
      expect(discussionSchema.createDiscussionForNode).not.toHaveBeenCalled();
    });

    it('should validate required name field', async () => {
      const invalidData = { ...createCategoryData, name: '' };

      await expect(service.createCategory(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createCategory(invalidData)).rejects.toThrow(
        'Category name is required',
      );

      expect(categorySchema.createCategory).not.toHaveBeenCalled();
    });

    it('should validate wordIds array exists', async () => {
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

    it('should trim name and description', async () => {
      categorySchema.createCategory.mockResolvedValue(mockCategoryData);

      const dataWithSpaces = {
        ...createCategoryData,
        name: '  Technology  ',
        description: '  Tech description  ',
      };

      await service.createCategory(dataWithSpaces);

      expect(categorySchema.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Technology',
          description: 'Tech description',
        }),
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
  });

  // ============================================
  // READ CATEGORY TESTS
  // ============================================

  describe('getCategory', () => {
    it('should get category by ID', async () => {
      categorySchema.findById.mockResolvedValue(mockCategoryData);

      const result = await service.getCategory('cat-123');

      expect(categorySchema.findById).toHaveBeenCalledWith('cat-123');
      expect(result).toEqual(mockCategoryData);
    });

    it('should return null when category not found', async () => {
      categorySchema.findById.mockResolvedValue(null);

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

      expect(categorySchema.findById).not.toHaveBeenCalled();
    });

    it('should wrap schema errors', async () => {
      categorySchema.findById.mockRejectedValue(new Error('Database error'));

      await expect(service.getCategory('cat-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // UPDATE CATEGORY TESTS
  // ============================================

  describe('updateCategory', () => {
    const updateData = {
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
      categorySchema.update.mockResolvedValue(updatedCategory);

      const result = await service.updateCategory('cat-123', updateData);

      expect(categorySchema.update).toHaveBeenCalledWith('cat-123', updateData);
      expect(result).toEqual(updatedCategory);
    });

    it('should return null when category not found', async () => {
      categorySchema.update.mockResolvedValue(null);

      const result = await service.updateCategory('nonexistent', updateData);

      expect(result).toBeNull();
    });

    it('should validate ID parameter', async () => {
      await expect(service.updateCategory('', updateData)).rejects.toThrow(
        BadRequestException,
      );

      expect(categorySchema.update).not.toHaveBeenCalled();
    });

    it('should validate at least one field provided', async () => {
      await expect(service.updateCategory('cat-123', {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateCategory('cat-123', {})).rejects.toThrow(
        'At least one field must be provided',
      );
    });

    it('should validate name is not empty if provided', async () => {
      await expect(
        service.updateCategory('cat-123', { name: '' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateCategory('cat-123', { name: '   ' }),
      ).rejects.toThrow('Category name cannot be empty');
    });

    it('should allow updating only description', async () => {
      const descriptionOnly = { description: 'New description' };
      const updated = {
        ...mockCategoryData,
        description: 'New description',
      };
      categorySchema.update.mockResolvedValue(updated);

      await service.updateCategory('cat-123', descriptionOnly);

      expect(categorySchema.update).toHaveBeenCalledWith(
        'cat-123',
        descriptionOnly,
      );
    });

    it('should allow updating only publicCredit', async () => {
      const creditOnly = { publicCredit: false };
      const updated = {
        ...mockCategoryData,
        publicCredit: false,
      };
      categorySchema.update.mockResolvedValue(updated);

      await service.updateCategory('cat-123', creditOnly);

      expect(categorySchema.update).toHaveBeenCalledWith('cat-123', creditOnly);
    });

    it('should preserve errors from schema', async () => {
      categorySchema.update.mockRejectedValue(
        new BadRequestException('Invalid update'),
      );

      await expect(
        service.updateCategory('cat-123', updateData),
      ).rejects.toThrow(BadRequestException);
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
  // VOTING TESTS
  // ============================================

  describe('voteInclusion', () => {
    it('should vote on category inclusion', async () => {
      categorySchema.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await service.voteInclusion('cat-123', 'user-456', true);

      expect(categorySchema.voteInclusion).toHaveBeenCalledWith(
        'cat-123',
        'user-456',
        true,
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

    it('should preserve errors from schema', async () => {
      categorySchema.voteInclusion.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await expect(
        service.voteInclusion('cat-123', 'user-456', true),
      ).rejects.toThrow(NotFoundException);
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

    it('should validate parameters', async () => {
      await expect(service.getVoteStatus('', 'user-456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getVoteStatus('cat-123', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeVote', () => {
    it('should remove vote', async () => {
      categorySchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await service.removeVote('cat-123', 'user-456');

      expect(categorySchema.removeVote).toHaveBeenCalledWith(
        'cat-123',
        'user-456',
        'INCLUSION',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should validate parameters', async () => {
      await expect(service.removeVote('', 'user-456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.removeVote('cat-123', '')).rejects.toThrow(
        BadRequestException,
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

    it('should validate ID', async () => {
      await expect(service.getVotes('')).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // HIERARCHICAL OPERATIONS TESTS
  // ============================================

  describe('getCategoryHierarchy', () => {
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
      categorySchema.getCategoryHierarchy.mockResolvedValue(mockHierarchy);

      const result = await service.getCategoryHierarchy();

      expect(categorySchema.getCategoryHierarchy).toHaveBeenCalledWith(
        undefined,
      );
      expect(result).toEqual(mockHierarchy);
    });

    it('should get hierarchy from specific root', async () => {
      const mockHierarchy = [
        {
          id: 'cat-1',
          name: 'Parent',
          description: 'Parent category',
          inclusionNetVotes: 5,
          children: [],
        },
      ];
      categorySchema.getCategoryHierarchy.mockResolvedValue(mockHierarchy);

      const result = await service.getCategoryHierarchy('cat-1');

      expect(categorySchema.getCategoryHierarchy).toHaveBeenCalledWith('cat-1');
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
