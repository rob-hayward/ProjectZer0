// src/neo4j/schemas/__tests__/category.schema.spec.ts - FIXED FOR BaseNodeSchema

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CategorySchema,
  CategoryData,
  CategoryNodeData,
} from '../category.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';

describe('CategorySchema with BaseNodeSchema Integration', () => {
  let schema: CategorySchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  const mockCategoryData: CategoryData = {
    id: 'cat-123',
    name: 'Technology',
    description: 'Technology related content',
    createdBy: 'user-123',
    publicCredit: true,
    visibilityStatus: true,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
    // Only inclusion voting (no content voting)
    inclusionPositiveVotes: 8,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 6,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
    // Additional category fields
    wordCount: 3,
    contentCount: 15,
    childCount: 2,
  };

  const mockCategoryNodeData: CategoryNodeData = {
    id: 'cat-123',
    name: 'Technology',
    description: 'Technology related content',
    createdBy: 'user-123',
    publicCredit: true,
    wordIds: ['word-1', 'word-2', 'word-3'],
    parentCategoryId: 'parent-cat',
    initialComment: 'Initial category comment',
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
    contentStatus: null, // No content voting for categories
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategorySchema,
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
          },
        },
        {
          provide: VoteSchema,
          useValue: {
            vote: jest.fn(),
            getVoteStatus: jest.fn(),
            removeVote: jest.fn(),
          },
        },
      ],
    }).compile();

    schema = module.get<CategorySchema>(CategorySchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BaseNodeSchema Integration', () => {
    describe('supportsContentVoting', () => {
      it('should only support inclusion voting', () => {
        expect(schema['supportsContentVoting']()).toBe(false);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should map Neo4j record to CategoryData with inclusion voting only', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;

        const result = schema['mapNodeFromRecord'](mockRecord);

        expect(result).toEqual(mockCategoryData);
        expect(result.inclusionNetVotes).toBe(6);
        expect(result.contentNetVotes).toBe(0); // No content voting
      });

      it('should handle Neo4j Integer conversion correctly', () => {
        const mockPropsWithIntegers = {
          ...mockCategoryData,
          inclusionPositiveVotes: Integer.fromNumber(999999),
          inclusionNegativeVotes: Integer.fromNumber(100000),
          inclusionNetVotes: Integer.fromNumber(899999),
          wordCount: Integer.fromNumber(5),
          contentCount: Integer.fromNumber(50),
          childCount: Integer.fromNumber(3),
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockPropsWithIntegers }),
        } as unknown as Record;

        const result = schema['mapNodeFromRecord'](mockRecord);

        expect(result.inclusionPositiveVotes).toBe(999999);
        expect(result.inclusionNegativeVotes).toBe(100000);
        expect(result.inclusionNetVotes).toBe(899999);
        expect(result.wordCount).toBe(5);
        expect(result.contentCount).toBe(50);
        expect(result.childCount).toBe(3);
      });

      it('should handle null and undefined values in toNumber', () => {
        const mockPropsWithNulls = {
          ...mockCategoryData,
          inclusionPositiveVotes: null,
          inclusionNegativeVotes: undefined,
          inclusionNetVotes: 0,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockPropsWithNulls }),
        } as unknown as Record;

        const result = schema['mapNodeFromRecord'](mockRecord);

        // Verify null/undefined are handled correctly (should become 0)
        expect(result.inclusionPositiveVotes).toBe(0);
        expect(result.inclusionNegativeVotes).toBe(0);
        expect(result.inclusionNetVotes).toBe(0);
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build update query excluding id field', () => {
        const updateData = {
          name: 'Updated Technology',
          description: 'Updated description',
          visibilityStatus: false,
        };

        const queryInfo = schema['buildUpdateQuery']('cat-123', updateData);

        expect(queryInfo.cypher).toContain('SET');
        expect(queryInfo.cypher).toContain('n.name = $updateData.name');
        expect(queryInfo.cypher).toContain(
          'n.description = $updateData.description',
        );
        expect(queryInfo.cypher).toContain(
          'n.visibilityStatus = $updateData.visibilityStatus',
        );
        expect(queryInfo.cypher).not.toContain('n.id =');
        expect(queryInfo.params).toEqual({
          id: 'cat-123',
          updateData,
        });
      });
    });
  });

  describe('Inherited BaseNodeSchema Methods', () => {
    describe('findById (inherited)', () => {
      it('should find a category by id using inherited method', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.findById('cat-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:CategoryNode {id: $id})'),
          { id: 'cat-123' },
        );
        expect(result).toEqual(mockCategoryData);
      });

      it('should return null when category not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.findById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('update (inherited)', () => {
      it('should update category using inherited method', async () => {
        const updateData = {
          name: 'Updated Tech',
          description: 'Updated desc',
        };
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockCategoryData, ...updateData },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.update('cat-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:CategoryNode {id: $id})'),
          expect.objectContaining({
            id: 'cat-123',
            updateData,
          }),
        );
        expect(result?.name).toBe('Updated Tech');
        expect(result?.description).toBe('Updated desc');
      });
    });

    describe('delete (inherited)', () => {
      it('should delete category using inherited method', async () => {
        // Mock findById for existence check
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        // Mock the actual delete operation
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.delete('cat-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:CategoryNode {id: $id})'),
          { id: 'cat-123' },
        );
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Voting Integration with BaseNodeSchema', () => {
    describe('voteInclusion (inherited)', () => {
      it('should vote on category inclusion using inherited method', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteInclusion('cat-123', 'user-456', true);

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'CategoryNode',
          { id: 'cat-123' },
          'user-456',
          true,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate inputs using inherited validation', async () => {
        await expect(
          schema.voteInclusion('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(schema.voteInclusion('cat-123', '', true)).rejects.toThrow(
          BadRequestException,
        );
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('voteContent (inherited) - Should Reject', () => {
      it('should throw BadRequestException when trying to vote on content', async () => {
        await expect(
          schema.voteContent('cat-123', 'user-456', true),
        ).rejects.toThrow('Category does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus (inherited)', () => {
      it('should get vote status using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('cat-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'CategoryNode',
          { id: 'cat-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
        expect(result?.inclusionStatus).toBe('agree');
        expect(result?.contentStatus).toBeNull(); // No content voting
      });
    });

    describe('removeVote (inherited)', () => {
      it('should remove inclusion vote using inherited method', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeVote(
          'cat-123',
          'user-456',
          'INCLUSION',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'CategoryNode',
          { id: 'cat-123' },
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('getVotes (inherited)', () => {
      it('should get vote counts with content votes zero for categories', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('cat-123');

        expect(result).toEqual({
          inclusionPositiveVotes: mockVoteStatus.inclusionPositiveVotes,
          inclusionNegativeVotes: mockVoteStatus.inclusionNegativeVotes,
          inclusionNetVotes: mockVoteStatus.inclusionNetVotes,
          contentPositiveVotes: 0, // Always 0 for categories
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });
    });
  });

  describe('Enhanced Category-Specific Methods', () => {
    describe('createCategory', () => {
      it('should create category successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.createCategory(mockCategoryNodeData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (c:CategoryNode'),
          expect.objectContaining({
            id: mockCategoryNodeData.id,
            name: mockCategoryNodeData.name,
            description: mockCategoryNodeData.description,
            createdBy: mockCategoryNodeData.createdBy,
            publicCredit: mockCategoryNodeData.publicCredit,
            wordIds: mockCategoryNodeData.wordIds,
            parentCategoryId: mockCategoryNodeData.parentCategoryId,
          }),
        );
        expect(result).toBeDefined();
      });

      it('should handle creation failure when words do not exist', async () => {
        neo4jService.write.mockRejectedValue(
          new Error(
            'some words may not exist or have not passed inclusion threshold',
          ),
        );

        await expect(
          schema.createCategory(mockCategoryNodeData),
        ).rejects.toThrow(
          'All words must exist and have passed inclusion threshold before being used in a category',
        );
      });

      it('should validate word count (1-5 words)', async () => {
        const invalidData = {
          ...mockCategoryNodeData,
          wordIds: [], // Empty array
        };

        await expect(schema.createCategory(invalidData)).rejects.toThrow(
          'Category must be composed of 1-5 words',
        );

        const tooManyWords = {
          ...mockCategoryNodeData,
          wordIds: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'], // 6 words
        };

        await expect(schema.createCategory(tooManyWords)).rejects.toThrow(
          'Category must be composed of 1-5 words',
        );
      });

      it('should validate category name', async () => {
        const invalidData = {
          ...mockCategoryNodeData,
          name: '', // Empty name
        };

        await expect(schema.createCategory(invalidData)).rejects.toThrow(
          'Category name cannot be empty',
        );
      });
    });

    describe('getCategory', () => {
      it('should retrieve category with enhanced data', async () => {
        const extendedCategoryData = {
          ...mockCategoryData,
          words: [
            { id: 'word-1', word: 'technology', inclusionNetVotes: 10 },
            { id: 'word-2', word: 'computer', inclusionNetVotes: 8 },
            { id: 'word-3', word: 'digital', inclusionNetVotes: 6 },
          ],
          parentCategory: { id: 'parent-cat', name: 'Parent Category' },
          childCategories: [
            { id: 'child-1', name: 'Child Category 1', inclusionNetVotes: 5 },
            { id: 'child-2', name: 'Child Category 2', inclusionNetVotes: 3 },
          ],
          contentCount: 15,
        };

        const mockRecord = {
          get: jest.fn((field) => {
            if (field === 'c') return { properties: mockCategoryData };
            if (field === 'words') return extendedCategoryData.words;
            if (field === 'parentCategory')
              return extendedCategoryData.parentCategory;
            if (field === 'childCategories')
              return extendedCategoryData.childCategories;
            if (field === 'contentCount')
              return extendedCategoryData.contentCount;
            return [];
          }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getCategory('cat-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (c:CategoryNode {id: $id})'),
          { id: 'cat-123' },
        );
        expect(result).toBeDefined();
        expect(result.words).toEqual(extendedCategoryData.words);
        expect(result.parentCategory).toEqual(
          extendedCategoryData.parentCategory,
        );
        expect(result.childCategories).toEqual(
          extendedCategoryData.childCategories,
        );
      });

      it('should return null when category not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getCategory('nonexistent');

        expect(result).toBeNull();
      });

      it('should validate input', async () => {
        await expect(schema.getCategory('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('getCategoryStats', () => {
      it('should return category statistics', async () => {
        const mockStats = {
          contentCount: 25,
          childCount: 3,
          wordCount: 4,
          inclusionNetVotes: 10,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue(mockStats),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getCategoryStats('cat-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('count(DISTINCT content)'),
          { categoryId: 'cat-123' },
        );
        expect(result).toEqual(mockStats);
      });

      it('should throw NotFoundException when category not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(schema.getCategoryStats('nonexistent')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('getCategoriesForNode', () => {
      it('should get categories for a node', async () => {
        const mockCategories = [
          {
            id: 'cat-1',
            name: 'Category 1',
            description: 'Description 1',
            inclusionNetVotes: 10,
            path: [{ id: 'cat-1', name: 'Category 1' }],
          },
        ];

        const mockRecord = {
          get: jest.fn().mockReturnValue(mockCategories),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getCategoriesForNode('node-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('WHERE node.id = $nodeId'),
          { nodeId: 'node-123' },
        );
        expect(result).toEqual(mockCategories);
      });

      it('should return empty array when no categories found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getCategoriesForNode('node-123');

        expect(result).toEqual([]);
      });
    });

    describe('setVisibilityStatus', () => {
      it('should set visibility status', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockCategoryData, visibilityStatus: false },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.setVisibilityStatus('cat-123', false);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('SET c.visibilityStatus = $isVisible'),
          { id: 'cat-123', isVisible: false },
        );
        expect(result).toBeDefined();
      });
    });

    describe('getVisibilityStatus', () => {
      it('should get visibility status', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(false),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getVisibilityStatus('cat-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('RETURN c.visibilityStatus'),
          { id: 'cat-123' },
        );
        expect(result).toBe(false);
      });
    });

    describe('getCategoryHierarchy', () => {
      it('should get category hierarchy', async () => {
        const mockHierarchy = [
          {
            id: 'root-1',
            name: 'Root Category',
            description: 'Root description',
            inclusionNetVotes: 15,
            children: [
              { id: 'child-1', name: 'Child 1', inclusionNetVotes: 10 },
            ],
          },
        ];

        const mockRecords = mockHierarchy.map((h) => ({
          get: jest.fn().mockReturnValue(h),
        }));

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getCategoryHierarchy();

        expect(neo4jService.read).toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'root-1',
          name: 'Root Category',
        });
      });
    });

    describe('getApprovedCategories', () => {
      it('should get approved categories', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getApprovedCategories();

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('WHERE c.inclusionNetVotes > 0'),
          {},
        );
        expect(result).toHaveLength(1);

        // getApprovedCategories uses mapNodeFromRecord, so only expect basic CategoryData
        // not the enhanced fields (words, parentCategory, childCategories) that getCategory() adds
        const expectedBasicData = {
          id: mockCategoryData.id,
          name: mockCategoryData.name,
          description: mockCategoryData.description,
          createdBy: mockCategoryData.createdBy,
          publicCredit: mockCategoryData.publicCredit,
          visibilityStatus: mockCategoryData.visibilityStatus,
          createdAt: mockCategoryData.createdAt,
          updatedAt: mockCategoryData.updatedAt,
          inclusionPositiveVotes: mockCategoryData.inclusionPositiveVotes,
          inclusionNegativeVotes: mockCategoryData.inclusionNegativeVotes,
          inclusionNetVotes: mockCategoryData.inclusionNetVotes,
          contentPositiveVotes: mockCategoryData.contentPositiveVotes,
          contentNegativeVotes: mockCategoryData.contentNegativeVotes,
          contentNetVotes: mockCategoryData.contentNetVotes,
          wordCount: mockCategoryData.wordCount,
          contentCount: mockCategoryData.contentCount,
          childCount: mockCategoryData.childCount,
        };
        expect(result[0]).toEqual(expectedBasicData);
      });
    });

    describe('checkCategories', () => {
      it('should return category count', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(25)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.checkCategories();

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (c:CategoryNode) RETURN count(c) as count',
          {},
        );
        expect(result.count).toBe(25);
      });
    });
  });

  describe('getAllCategories', () => {
    it('should get all categories with default options', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getAllCategories();

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (c:CategoryNode)'),
        expect.objectContaining({
          offset: 0,
          limit: 1000,
        }),
      );
      expect(result).toHaveLength(1);

      // getAllCategories uses mapNodeFromRecord, so only expect basic CategoryData
      // not the enhanced fields (words, parentCategory, childCategories) that getCategory() adds
      const expectedBasicData = {
        id: mockCategoryData.id,
        name: mockCategoryData.name,
        description: mockCategoryData.description,
        createdBy: mockCategoryData.createdBy,
        publicCredit: mockCategoryData.publicCredit,
        visibilityStatus: mockCategoryData.visibilityStatus,
        createdAt: mockCategoryData.createdAt,
        updatedAt: mockCategoryData.updatedAt,
        inclusionPositiveVotes: mockCategoryData.inclusionPositiveVotes,
        inclusionNegativeVotes: mockCategoryData.inclusionNegativeVotes,
        inclusionNetVotes: mockCategoryData.inclusionNetVotes,
        contentPositiveVotes: mockCategoryData.contentPositiveVotes,
        contentNegativeVotes: mockCategoryData.contentNegativeVotes,
        contentNetVotes: mockCategoryData.contentNetVotes,
        wordCount: mockCategoryData.wordCount,
        contentCount: mockCategoryData.contentCount,
        childCount: mockCategoryData.childCount,
      };
      expect(result[0]).toEqual(expectedBasicData);
    });

    it('should filter by parent category', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getAllCategories({
        parentId: 'parent-cat-123',
        limit: 10,
        offset: 5,
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'MATCH (parent:CategoryNode {id: $parentId})-[:PARENT_OF]->(c:CategoryNode)',
        ),
        expect.objectContaining({
          parentId: 'parent-cat-123',
          offset: 5,
          limit: 10,
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockCategoryData.id);
      expect(result[0].name).toBe(mockCategoryData.name);
    });

    it('should filter by search query', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getAllCategories({
        searchQuery: 'technology',
        onlyApproved: true,
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'toLower(c.name) CONTAINS toLower($searchQuery)',
        ),
        expect.objectContaining({
          searchQuery: 'technology',
          offset: 0,
          limit: 1000,
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockCategoryData.id);
    });

    it('should combine parent filtering and search query', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getAllCategories({
        parentId: 'parent-cat-123',
        searchQuery: 'tech',
        onlyApproved: true,
        sortBy: 'votes',
        sortDirection: 'desc',
        limit: 20,
        offset: 10,
      });

      const query = neo4jService.read.mock.calls[0][0];
      const params = neo4jService.read.mock.calls[0][1];

      // Verify query contains parent filtering
      expect(query).toContain(
        'MATCH (parent:CategoryNode {id: $parentId})-[:PARENT_OF]->(c:CategoryNode)',
      );
      // Verify query contains search filtering
      expect(query).toContain('toLower(c.name) CONTAINS toLower($searchQuery)');
      // Verify query contains approval filtering
      expect(query).toContain('c.inclusionNetVotes > 0');
      // Verify query contains sorting
      expect(query).toContain('ORDER BY c.inclusionNetVotes DESC');
      // Verify query contains pagination
      expect(query).toContain('SKIP $offset LIMIT $limit');

      expect(params).toEqual({
        parentId: 'parent-cat-123',
        searchQuery: 'tech',
        offset: 10,
        limit: 20,
      });
      expect(result).toHaveLength(1);
    });

    it('should apply different sort options correctly', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      // Test sorting by name
      await schema.getAllCategories({ sortBy: 'name', sortDirection: 'asc' });
      expect(neo4jService.read).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY c.name ASC'),
        expect.any(Object),
      );

      // Test sorting by created date
      await schema.getAllCategories({
        sortBy: 'created',
        sortDirection: 'desc',
      });
      expect(neo4jService.read).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY c.createdAt DESC'),
        expect.any(Object),
      );

      // Test sorting by usage
      await schema.getAllCategories({ sortBy: 'usage', sortDirection: 'asc' });
      expect(neo4jService.read).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY c.contentCount ASC'),
        expect.any(Object),
      );

      // Test sorting by votes
      await schema.getAllCategories({ sortBy: 'votes', sortDirection: 'desc' });
      expect(neo4jService.read).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY c.inclusionNetVotes DESC'),
        expect.any(Object),
      );
    });

    it('should handle onlyApproved filter', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      // Test with onlyApproved: true
      await schema.getAllCategories({ onlyApproved: true });
      let query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).toContain('c.inclusionNetVotes > 0');

      // Test with onlyApproved: false (should not have the filter)
      await schema.getAllCategories({ onlyApproved: false });
      query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).not.toContain('c.inclusionNetVotes > 0');
    });

    it('should handle pagination correctly', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      // Test with both limit and offset
      await schema.getAllCategories({ limit: 25, offset: 50 });
      let query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).toContain('SKIP $offset LIMIT $limit');

      // Test with only offset (no limit)
      await schema.getAllCategories({ offset: 10 });
      query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).toContain('SKIP $offset');
      expect(query).not.toContain('LIMIT');

      // Test with no pagination
      await schema.getAllCategories({});
      query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).not.toContain('SKIP');
      expect(query).not.toContain('LIMIT');
    });

    it('should search in category name, description, and composed words', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.getAllCategories({ searchQuery: 'AI' });

      const query = neo4jService.read.mock.calls[0][0];

      // Verify search looks in category name
      expect(query).toContain('toLower(c.name) CONTAINS toLower($searchQuery)');
      // Verify search looks in category description
      expect(query).toContain(
        'toLower(c.description) CONTAINS toLower($searchQuery)',
      );
      // Verify search looks in composed words
      expect(query).toContain('MATCH (c)-[:COMPOSED_OF]->(w:WordNode)');
      expect(query).toContain('toLower(w.word) CONTAINS toLower($searchQuery)');
    });

    it('should handle empty results', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as unknown as Result);

      const result = await schema.getAllCategories({ parentId: 'nonexistent' });

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.getAllCategories()).rejects.toThrow(
        'Failed to get all categories Category: Database connection failed',
      );
    });

    it('should use correct default values', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.getAllCategories({});

      const params = neo4jService.read.mock.calls[0][1];
      expect(params.offset).toBe(0);
      expect(params.limit).toBe(1000);
    });
  });

  describe('getSortFieldForQuery (private helper)', () => {
    it('should map sort fields correctly', () => {
      // Access private method for testing
      const getSortField = (schema as any).getSortFieldForQuery;

      expect(getSortField('name')).toBe('c.name');
      expect(getSortField('votes')).toBe('c.inclusionNetVotes');
      expect(getSortField('created')).toBe('c.createdAt');
      expect(getSortField('usage')).toBe('c.contentCount');
      expect(getSortField('unknown')).toBe('c.name'); // default
    });
  });

  describe('Error Handling Consistency', () => {
    it('should use standardized error messages from BaseNodeSchema', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.findById('test')).rejects.toThrow(
        'Failed to find Category: Database connection failed',
      );
    });

    it('should use standardized error format for category-specific methods', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query timeout'));

      await expect(schema.getCategory('test')).rejects.toThrow(
        'Failed to retrieve category Category: Query timeout',
      );
    });

    it('should validate input parameters consistently', async () => {
      // Test empty string validation - should prevent database calls
      await expect(schema.getCategoriesForNode('')).rejects.toThrow(
        BadRequestException,
      );

      // Verify no Neo4j calls made for invalid input
      expect(neo4jService.read).not.toHaveBeenCalled();
      expect(neo4jService.write).not.toHaveBeenCalled();
    });
  });

  describe('Legacy Method Removal', () => {
    it('should not have legacy voting methods (now inherited)', () => {
      expect((schema as any).voteCategoryInclusion).toBeUndefined();
      expect((schema as any).getCategoryVoteStatus).toBeUndefined();
      expect((schema as any).removeCategoryVote).toBeUndefined();
      expect((schema as any).getCategoryVotes).toBeUndefined();
    });

    it('should have inherited voting methods available', () => {
      expect(schema.voteInclusion).toBeDefined();
      expect(schema.getVoteStatus).toBeDefined();
      expect(schema.removeVote).toBeDefined();
      expect(schema.getVotes).toBeDefined();
    });

    it('should preserve enhanced category-specific methods', () => {
      expect(schema.createCategory).toBeDefined();
      expect(schema.getCategory).toBeDefined();
      expect(schema.getCategoryStats).toBeDefined();
      expect(schema.getCategoriesForNode).toBeDefined();
      expect(schema.setVisibilityStatus).toBeDefined();
      expect(schema.getVisibilityStatus).toBeDefined();
      expect(schema.getCategoryHierarchy).toBeDefined();
      expect(schema.getApprovedCategories).toBeDefined();
      expect(schema.checkCategories).toBeDefined();
    });
  });
});
