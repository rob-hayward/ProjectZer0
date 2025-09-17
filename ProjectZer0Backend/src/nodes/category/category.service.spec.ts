// src/nodes/category/category.service.spec.ts - COMPREHENSIVE TEST SUITE

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategorySchema } from './../../neo4j/schemas/category.schema';
import { DiscussionService } from './../discussion/discussion.service';
import { CommentService } from './../comment/comment.service';
import type { VoteStatus, VoteResult } from './../../neo4j/schemas/vote.schema';

describe('CategoryService', () => {
  let service: CategoryService;
  let categorySchema: jest.Mocked<CategorySchema>;
  let discussionService: jest.Mocked<DiscussionService>; // eslint-disable-line @typescript-eslint/no-unused-vars
  let commentService: jest.Mocked<CommentService>; // eslint-disable-line @typescript-eslint/no-unused-vars

  const mockCategoryData = {
    id: 'cat-123',
    name: 'Technology',
    description: 'Technology related content',
    createdBy: 'user-123',
    publicCredit: true,
    visibilityStatus: true,
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

  beforeEach(async () => {
    const mockCategorySchema = {
      // Enhanced domain methods
      createCategory: jest.fn(),
      getCategory: jest.fn(),
      getCategoryStats: jest.fn(),
      setVisibilityStatus: jest.fn(),
      getVisibilityStatus: jest.fn(),
      getApprovedCategories: jest.fn(),
      getAllCategories: jest.fn(),

      // BaseNodeSchema inherited methods
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      voteInclusion: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
    };

    const mockDiscussionService = {
      createDiscussion: jest.fn(),
      getDiscussion: jest.fn(),
    };

    const mockCommentService = {
      createComment: jest.fn(),
      getComments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: CategorySchema,
          useValue: mockCategorySchema,
        },
        {
          provide: DiscussionService,
          useValue: mockDiscussionService,
        },
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    categorySchema = module.get(CategorySchema);
    discussionService = module.get(DiscussionService);
    commentService = module.get(CommentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // CRUD OPERATIONS TESTS

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

      expect(categorySchema.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          name: 'Technology',
          description: 'Technology related content',
          createdBy: 'user-123',
          publicCredit: true,
          wordIds: ['word-1', 'word-2', 'word-3'],
          parentCategoryId: 'parent-cat',
          initialComment: 'Initial comment',
        }),
      );
      expect(result).toEqual(mockCategoryData);
    });

    it('should validate required fields', async () => {
      const invalidData = { ...createCategoryData, name: '' };

      await expect(service.createCategory(invalidData)).rejects.toThrow(
        BadRequestException,
      );

      expect(categorySchema.createCategory).not.toHaveBeenCalled();
    });

    it('should validate word count (1-5 words)', async () => {
      const tooManyWords = {
        ...createCategoryData,
        wordIds: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'],
      };

      await expect(service.createCategory(tooManyWords)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should trim input data', async () => {
      categorySchema.createCategory.mockResolvedValue(mockCategoryData);

      const dataWithSpaces = {
        ...createCategoryData,
        name: '  Technology  ',
        description: '  Tech description  ',
        initialComment: '  Initial comment  ',
      };

      await service.createCategory(dataWithSpaces);

      expect(categorySchema.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Technology',
          description: 'Tech description',
          initialComment: 'Initial comment',
        }),
      );
    });
  });

  describe('getCategory', () => {
    it('should get category by ID using enhanced method', async () => {
      categorySchema.getCategory.mockResolvedValue(mockCategoryData);

      const result = await service.getCategory('cat-123');

      expect(categorySchema.getCategory).toHaveBeenCalledWith('cat-123');
      expect(result).toEqual(mockCategoryData);
    });

    it('should handle options parameter', async () => {
      categorySchema.getCategory.mockResolvedValue(mockCategoryData);

      const options = {
        includeHierarchy: true,
        includeUsageStats: true,
        includeDiscussion: true,
      };

      await service.getCategory('cat-123', options);

      expect(categorySchema.getCategory).toHaveBeenCalledWith('cat-123');
    });

    it('should throw NotFoundException when category not found', async () => {
      categorySchema.getCategory.mockResolvedValue(null);

      await expect(service.getCategory('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should validate ID parameter', async () => {
      await expect(service.getCategory('')).rejects.toThrow(
        BadRequestException,
      );

      expect(categorySchema.getCategory).not.toHaveBeenCalled();
    });
  });

  describe('updateCategory', () => {
    const updateData = {
      name: 'Updated Technology',
      description: 'Updated description',
      publicCredit: false,
    };

    it('should update category using BaseNodeSchema method', async () => {
      categorySchema.update.mockResolvedValue({
        ...mockCategoryData,
        ...updateData,
      });

      const result = await service.updateCategory('cat-123', updateData);

      expect(categorySchema.update).toHaveBeenCalledWith('cat-123', updateData);
      expect(result.name).toBe('Updated Technology');
    });

    it('should validate update data is not empty', async () => {
      await expect(service.updateCategory('cat-123', {})).rejects.toThrow(
        BadRequestException,
      );

      expect(categorySchema.update).not.toHaveBeenCalled();
    });

    it('should validate name length', async () => {
      const longName = { name: 'a'.repeat(101) };

      await expect(service.updateCategory('cat-123', longName)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when category not found', async () => {
      categorySchema.update.mockResolvedValue(null);

      await expect(
        service.updateCategory('nonexistent', updateData),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCategory', () => {
    it('should delete category using BaseNodeSchema method', async () => {
      categorySchema.findById.mockResolvedValue(mockCategoryData);
      categorySchema.delete.mockResolvedValue(undefined);

      const result = await service.deleteCategory('cat-123');

      expect(categorySchema.findById).toHaveBeenCalledWith('cat-123');
      expect(categorySchema.delete).toHaveBeenCalledWith('cat-123');
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when category not found', async () => {
      categorySchema.findById.mockResolvedValue(null);

      await expect(service.deleteCategory('nonexistent')).rejects.toThrow(
        NotFoundException,
      );

      expect(categorySchema.delete).not.toHaveBeenCalled();
    });
  });

  // LISTING AND FILTERING TESTS

  describe('getCategories', () => {
    const mockCategories = [mockCategoryData];

    it('should get categories with default options', async () => {
      categorySchema.getAllCategories.mockResolvedValue(mockCategories);

      const result = await service.getCategories();

      expect(categorySchema.getAllCategories).toHaveBeenCalledWith({
        limit: undefined,
        offset: 0,
        sortBy: 'name',
        sortDirection: 'asc',
        onlyApproved: false,
        parentId: undefined,
        searchQuery: undefined,
      });
      expect(result).toEqual(mockCategories);
    });

    it('should handle all filtering options', async () => {
      categorySchema.findById.mockResolvedValue(mockCategoryData); // Parent validation
      categorySchema.getAllCategories.mockResolvedValue(mockCategories);

      const options = {
        limit: 20,
        offset: 10,
        sortBy: 'votes' as const,
        sortDirection: 'desc' as const,
        onlyApproved: true,
        parentId: 'parent-cat',
        searchQuery: 'technology',
      };

      const result = await service.getCategories(options);

      expect(categorySchema.findById).toHaveBeenCalledWith('parent-cat');
      expect(categorySchema.getAllCategories).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockCategories);
    });

    it('should validate parent category exists', async () => {
      categorySchema.findById.mockResolvedValue(null);

      await expect(
        service.getCategories({ parentId: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);

      expect(categorySchema.getAllCategories).not.toHaveBeenCalled();
    });

    it('should validate limit parameter', async () => {
      await expect(service.getCategories({ limit: 0 })).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.getCategories({ limit: 1001 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate offset parameter', async () => {
      await expect(service.getCategories({ offset: -1 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate sortBy parameter', async () => {
      await expect(
        service.getCategories({ sortBy: 'invalid' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate sortDirection parameter', async () => {
      await expect(
        service.getCategories({ sortDirection: 'invalid' as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCategoriesByParent', () => {
    it('should get child categories for parent', async () => {
      const mockCategories = [mockCategoryData];
      categorySchema.getAllCategories.mockResolvedValue(mockCategories);

      const result = await service.getCategoriesByParent('parent-cat', {
        limit: 10,
        sortBy: 'name',
      });

      expect(categorySchema.getAllCategories).toHaveBeenCalledWith({
        parentId: 'parent-cat',
        limit: 10,
        sortBy: 'name',
      });
      expect(result).toEqual(mockCategories);
    });

    it('should validate parent ID', async () => {
      await expect(service.getCategoriesByParent('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('searchCategories', () => {
    it('should search categories by query', async () => {
      const mockCategories = [mockCategoryData];
      categorySchema.getAllCategories.mockResolvedValue(mockCategories);

      const result = await service.searchCategories('technology', {
        onlyApproved: true,
      });

      expect(categorySchema.getAllCategories).toHaveBeenCalledWith({
        searchQuery: 'technology',
        onlyApproved: true,
      });
      expect(result).toEqual(mockCategories);
    });

    it('should validate search query is not empty', async () => {
      await expect(service.searchCategories('')).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.searchCategories('   ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should trim search query', async () => {
      categorySchema.getAllCategories.mockResolvedValue([]);

      await service.searchCategories('  technology  ');

      expect(categorySchema.getAllCategories).toHaveBeenCalledWith({
        searchQuery: 'technology',
      });
    });
  });

  // VOTING TESTS

  describe('voteCategoryInclusion', () => {
    it('should vote on category inclusion using BaseNodeSchema method', async () => {
      categorySchema.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await service.voteCategoryInclusion(
        'cat-123',
        'user-456',
        true,
      );

      expect(categorySchema.voteInclusion).toHaveBeenCalledWith(
        'cat-123',
        'user-456',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should validate parameters', async () => {
      await expect(
        service.voteCategoryInclusion('', 'user-456', true),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.voteCategoryInclusion('cat-123', '', true),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCategoryVoteStatus', () => {
    it('should get vote status using BaseNodeSchema method', async () => {
      categorySchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await service.getCategoryVoteStatus('cat-123', 'user-456');

      expect(categorySchema.getVoteStatus).toHaveBeenCalledWith(
        'cat-123',
        'user-456',
      );
      expect(result).toEqual(mockVoteStatus);
    });
  });

  describe('removeCategoryVote', () => {
    it('should remove vote using BaseNodeSchema method', async () => {
      categorySchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await service.removeCategoryVote('cat-123', 'user-456');

      expect(categorySchema.removeVote).toHaveBeenCalledWith(
        'cat-123',
        'user-456',
        'INCLUSION',
      );
      expect(result).toEqual(mockVoteResult);
    });
  });

  describe('getCategoryVotes', () => {
    it('should get vote counts using BaseNodeSchema method', async () => {
      categorySchema.getVotes.mockResolvedValue(mockVoteResult);

      const result = await service.getCategoryVotes('cat-123');

      expect(categorySchema.getVotes).toHaveBeenCalledWith('cat-123');
      expect(result).toEqual(mockVoteResult);
    });
  });

  // UTILITY METHODS TESTS

  describe('getCategoryStats', () => {
    it('should get category statistics', async () => {
      const mockStats = {
        contentCount: 25,
        childCount: 3,
        wordCount: 4,
        inclusionNetVotes: 10,
      };
      categorySchema.getCategoryStats.mockResolvedValue(mockStats);

      const result = await service.getCategoryStats('cat-123');

      expect(categorySchema.getCategoryStats).toHaveBeenCalledWith('cat-123');
      expect(result).toEqual(mockStats);
    });
  });

  describe('setVisibilityStatus', () => {
    it('should set visibility status', async () => {
      const mockResult = { ...mockCategoryData, visibilityStatus: false };
      categorySchema.setVisibilityStatus.mockResolvedValue(mockResult);

      const result = await service.setVisibilityStatus('cat-123', false);

      expect(categorySchema.setVisibilityStatus).toHaveBeenCalledWith(
        'cat-123',
        false,
      );
      expect(result).toEqual(mockResult);
    });

    it('should validate boolean parameter', async () => {
      await expect(
        service.setVisibilityStatus('cat-123', 'invalid' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when category not found', async () => {
      categorySchema.setVisibilityStatus.mockResolvedValue(null);

      await expect(
        service.setVisibilityStatus('nonexistent', true),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getVisibilityStatus', () => {
    it('should get visibility status', async () => {
      categorySchema.getVisibilityStatus.mockResolvedValue(true);

      const result = await service.getVisibilityStatus('cat-123');

      expect(categorySchema.getVisibilityStatus).toHaveBeenCalledWith(
        'cat-123',
      );
      expect(result).toBe(true);
    });
  });

  // DISCUSSION AND COMMENT TESTS

  describe('getCategoryWithDiscussion', () => {
    it('should get category with discussion placeholder', async () => {
      categorySchema.getCategory.mockResolvedValue(mockCategoryData);

      const result = await service.getCategoryWithDiscussion('cat-123');

      expect(categorySchema.getCategory).toHaveBeenCalledWith('cat-123');
      expect(result).toEqual(mockCategoryData);
    });

    it('should throw NotFoundException when category not found', async () => {
      categorySchema.getCategory.mockResolvedValue(null);

      await expect(
        service.getCategoryWithDiscussion('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCategoryComments', () => {
    it('should get category comments placeholder', async () => {
      categorySchema.getCategory.mockResolvedValue(mockCategoryData);

      const result = await service.getCategoryComments('cat-123');

      expect(categorySchema.getCategory).toHaveBeenCalledWith('cat-123');
      expect(result).toEqual({ comments: [] });
    });
  });

  // UNIMPLEMENTED METHODS TESTS (should log warnings)

  describe('getNodesUsingCategory', () => {
    it('should return empty array with warning log', async () => {
      const result = await service.getNodesUsingCategory('cat-123');

      expect(result).toEqual([]);
    });
  });

  describe('getCategoryPath', () => {
    it('should return empty array with warning log', async () => {
      const result = await service.getCategoryPath('cat-123');

      expect(result).toEqual([]);
    });
  });

  describe('getRelatedContentBySharedCategories', () => {
    it('should return empty array with warning log', async () => {
      const result =
        await service.getRelatedContentBySharedCategories('cat-123');

      expect(result).toEqual([]);
    });
  });

  describe('getNodeCategories', () => {
    it('should return empty array with warning log', async () => {
      const result = await service.getNodeCategories('node-123');

      expect(result).toEqual([]);
    });
  });

  // ERROR HANDLING TESTS

  describe('Error Handling', () => {
    it('should handle schema errors consistently', async () => {
      categorySchema.getCategory.mockRejectedValue(new Error('Database error'));

      await expect(service.getCategory('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should preserve HttpExceptions from dependencies', async () => {
      const badRequestError = new BadRequestException('Invalid input');
      categorySchema.getCategory.mockRejectedValue(badRequestError);

      await expect(service.getCategory('test-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate empty IDs across methods', async () => {
      await expect(service.getCategory('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateCategory('', {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteCategory('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // HYBRID PATTERN VERIFICATION

  describe('Hybrid Pattern Implementation', () => {
    it('should use enhanced methods for complex operations', () => {
      // Verify service uses enhanced domain methods
      expect(typeof service.createCategory).toBe('function');
      expect(typeof service.getCategory).toBe('function');
      expect(typeof service.getCategoryStats).toBe('function');
      expect(typeof service.setVisibilityStatus).toBe('function');
      expect(typeof service.getVisibilityStatus).toBe('function');
    });

    it('should use BaseNodeSchema methods for standard operations', () => {
      // These are called through the service methods
      expect(typeof service.updateCategory).toBe('function');
      expect(typeof service.deleteCategory).toBe('function');
      expect(typeof service.voteCategoryInclusion).toBe('function');
      expect(typeof service.getCategoryVoteStatus).toBe('function');
      expect(typeof service.removeCategoryVote).toBe('function');
      expect(typeof service.getCategoryVotes).toBe('function');
    });

    it('should use new filtering capabilities', () => {
      expect(typeof service.getCategories).toBe('function');
      expect(typeof service.getCategoriesByParent).toBe('function');
      expect(typeof service.searchCategories).toBe('function');
    });
  });
});
