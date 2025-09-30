// src/neo4j/schemas/__tests__/category.schema.spec.ts - UPDATED

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

describe('CategorySchema', () => {
  let schema: CategorySchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  const mockCategoryData: CategoryData = {
    id: 'cat-123',
    createdBy: 'user-456',
    publicCredit: true,
    name: 'Technology',
    description: 'Technology related content',
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

  const mockCategoryNodeData: CategoryNodeData = {
    id: 'cat-123',
    name: 'Technology',
    description: 'Technology related content',
    createdBy: 'user-456',
    publicCredit: true,
    wordIds: ['word-1', 'word-2', 'word-3'],
    parentCategoryId: 'parent-cat',
    initialComment: 'Initial category comment',
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 9,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 7,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 9,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 7,
    contentStatus: null,
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
        expect((schema as any).supportsContentVoting()).toBe(false);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should map Neo4j record to CategoryData with inclusion voting only', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(result).toEqual(mockCategoryData);
        expect(result.inclusionNetVotes).toBe(6);
        expect(result.contentNetVotes).toBe(0);
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

        const result = (schema as any).mapNodeFromRecord(mockRecord);

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

        const result = (schema as any).mapNodeFromRecord(mockRecord);

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
        };

        const queryInfo = (schema as any).buildUpdateQuery(
          'cat-123',
          updateData,
        );

        expect(queryInfo.cypher).toContain('SET');
        expect(queryInfo.cypher).toContain('n.name = $updateData.name');
        expect(queryInfo.cypher).toContain(
          'n.description = $updateData.description',
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
    describe('findById', () => {
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

    describe('update', () => {
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

    describe('delete', () => {
      it('should delete category using inherited method', async () => {
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

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
    describe('voteInclusion', () => {
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

    describe('voteContent - Should Reject', () => {
      it('should throw BadRequestException when trying to vote on content', async () => {
        await expect(
          schema.voteContent('cat-123', 'user-456', true),
        ).rejects.toThrow('Category does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus', () => {
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
        expect(result?.contentStatus).toBeNull();
      });
    });

    describe('removeVote', () => {
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

    describe('getVotes', () => {
      it('should get vote counts with content votes zero for categories', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('cat-123');

        expect(result).toEqual({
          inclusionPositiveVotes: mockVoteStatus.inclusionPositiveVotes,
          inclusionNegativeVotes: mockVoteStatus.inclusionNegativeVotes,
          inclusionNetVotes: mockVoteStatus.inclusionNetVotes,
          contentPositiveVotes: 0,
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
          wordIds: [],
        };

        await expect(schema.createCategory(invalidData)).rejects.toThrow(
          'Category must be composed of 1-5 words',
        );

        const tooManyWords = {
          ...mockCategoryNodeData,
          wordIds: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'],
        };

        await expect(schema.createCategory(tooManyWords)).rejects.toThrow(
          'Category must be composed of 1-5 words',
        );
      });

      it('should validate category name', async () => {
        const invalidData = {
          ...mockCategoryNodeData,
          name: '',
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
          get: jest.fn().mockImplementation((key) => {
            if (key === 'c' || key === 'n') {
              return { properties: mockCategoryData };
            }
            if (key === 'words') return extendedCategoryData.words;
            if (key === 'parentCategory')
              return extendedCategoryData.parentCategory;
            if (key === 'childCategories')
              return extendedCategoryData.childCategories;
            if (key === 'contentCount')
              return extendedCategoryData.contentCount;
            if (key === 'discussionId') return 'discussion-123';
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
        expect(result?.words).toEqual(extendedCategoryData.words);
        expect(result?.parentCategory).toEqual(
          extendedCategoryData.parentCategory,
        );
        expect(result?.childCategories).toEqual(
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
          contentCount: Integer.fromNumber(25),
          childCount: Integer.fromNumber(3),
          wordCount: Integer.fromNumber(4),
          inclusionNetVotes: Integer.fromNumber(10),
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
        expect(result.contentCount).toBe(25);
        expect(result.childCount).toBe(3);
        expect(result.wordCount).toBe(4);
        expect(result.inclusionNetVotes).toBe(10);
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
        })) as unknown as Record[];

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
        expect(result[0]).toEqual({
          id: mockCategoryData.id,
          name: mockCategoryData.name,
          description: mockCategoryData.description,
          createdBy: mockCategoryData.createdBy,
          publicCredit: mockCategoryData.publicCredit,
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
        });
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
      expect(result[0]).toEqual({
        id: mockCategoryData.id,
        name: mockCategoryData.name,
        description: mockCategoryData.description,
        createdBy: mockCategoryData.createdBy,
        publicCredit: mockCategoryData.publicCredit,
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
      });
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

      expect(query).toContain(
        'MATCH (parent:CategoryNode {id: $parentId})-[:PARENT_OF]->(c:CategoryNode)',
      );
      expect(query).toContain('toLower(c.name) CONTAINS toLower($searchQuery)');
      expect(query).toContain('c.inclusionNetVotes > 0');
      expect(query).toContain('ORDER BY c.inclusionNetVotes DESC');
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

      await schema.getAllCategories({ sortBy: 'name', sortDirection: 'asc' });
      expect(neo4jService.read).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY c.name ASC'),
        expect.any(Object),
      );

      await schema.getAllCategories({
        sortBy: 'created',
        sortDirection: 'desc',
      });
      expect(neo4jService.read).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY c.createdAt DESC'),
        expect.any(Object),
      );

      await schema.getAllCategories({ sortBy: 'usage', sortDirection: 'asc' });
      expect(neo4jService.read).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY c.contentCount ASC'),
        expect.any(Object),
      );

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

      await schema.getAllCategories({ onlyApproved: true });
      let query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).toContain('c.inclusionNetVotes > 0');

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

      await schema.getAllCategories({ limit: 25, offset: 50 });
      let query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).toContain('SKIP $offset LIMIT $limit');

      await schema.getAllCategories({ offset: 10 });
      query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).toContain('SKIP $offset');
      expect(query).not.toContain('LIMIT');

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

      expect(query).toContain('toLower(c.name) CONTAINS toLower($searchQuery)');
      expect(query).toContain(
        'toLower(c.description) CONTAINS toLower($searchQuery)',
      );
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
      const getSortField = (schema as any).getSortFieldForQuery;

      expect(getSortField('name')).toBe('c.name');
      expect(getSortField('votes')).toBe('c.inclusionNetVotes');
      expect(getSortField('created')).toBe('c.createdAt');
      expect(getSortField('usage')).toBe('c.contentCount');
      expect(getSortField('unknown')).toBe('c.name');
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
      await expect(schema.getCategoriesForNode('')).rejects.toThrow(
        BadRequestException,
      );

      expect(neo4jService.read).not.toHaveBeenCalled();
      expect(neo4jService.write).not.toHaveBeenCalled();
    });
  });

  describe('Input Validation', () => {
    it('should reject null/undefined IDs', async () => {
      await expect(schema.findById(null as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(schema.findById(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject empty category name', async () => {
      await expect(
        schema.createCategory({
          ...mockCategoryNodeData,
          name: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject whitespace-only category name', async () => {
      await expect(
        schema.createCategory({
          ...mockCategoryNodeData,
          name: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Neo4j Integer Conversion', () => {
    it('should convert Neo4j Integer objects to numbers', async () => {
      const mockDataWithIntegers = {
        ...mockCategoryData,
        inclusionPositiveVotes: Integer.fromNumber(999),
        wordCount: Integer.fromNumber(5),
        contentCount: Integer.fromNumber(100),
        childCount: Integer.fromNumber(10),
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDataWithIntegers }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.findById('cat-123');

      expect(result?.inclusionPositiveVotes).toBe(999);
      expect(result?.wordCount).toBe(5);
      expect(result?.contentCount).toBe(100);
      expect(result?.childCount).toBe(10);
      expect(typeof result?.inclusionPositiveVotes).toBe('number');
      expect(typeof result?.wordCount).toBe('number');
    });
  });

  describe('Business Rules Enforcement', () => {
    it('should enforce word count limits (1-5)', async () => {
      await expect(
        schema.createCategory({
          ...mockCategoryNodeData,
          wordIds: [],
        }),
      ).rejects.toThrow('Category must be composed of 1-5 words');

      await expect(
        schema.createCategory({
          ...mockCategoryNodeData,
          wordIds: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'],
        }),
      ).rejects.toThrow('Category must be composed of 1-5 words');
    });

    it('should validate words exist and have passed inclusion threshold', async () => {
      neo4jService.write.mockRejectedValue(
        new Error(
          'some words may not exist or have not passed inclusion threshold',
        ),
      );

      await expect(schema.createCategory(mockCategoryNodeData)).rejects.toThrow(
        'All words must exist and have passed inclusion threshold',
      );
    });

    it('should prevent circular parent-child relationships', async () => {
      neo4jService.write.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await expect(
        schema.createCategory({
          ...mockCategoryNodeData,
          parentCategoryId: 'circular-parent',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete category lifecycle', async () => {
      // Create
      const createRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;

      neo4jService.write.mockResolvedValueOnce({
        records: [createRecord],
      } as unknown as Result);

      const created = await schema.createCategory(mockCategoryNodeData);
      expect(created).toBeDefined();

      // Vote inclusion
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const voteResult = await schema.voteInclusion(
        'cat-123',
        'user-456',
        true,
      );
      expect(voteResult).toEqual(mockVoteResult);

      // Update
      const updateData = { name: 'Updated Technology' };
      const updatedCategory = { ...mockCategoryData, ...updateData };
      const mockUpdateRecord = {
        get: jest.fn().mockReturnValue({ properties: updatedCategory }),
      } as unknown as Record;

      neo4jService.write.mockResolvedValueOnce({
        records: [mockUpdateRecord],
      } as unknown as Result);

      const updated = await schema.update('cat-123', updateData);
      expect(updated).toEqual(updatedCategory);

      // Delete
      const existsRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
      } as unknown as Record;

      neo4jService.read.mockResolvedValueOnce({
        records: [existsRecord],
      } as unknown as Result);

      neo4jService.write.mockResolvedValueOnce({} as Result);

      const deleteResult = await schema.delete('cat-123');
      expect(deleteResult).toEqual({ success: true });
    });

    it('should handle category hierarchy operations', async () => {
      // Create parent category
      const parentRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockCategoryData, id: 'parent-cat' },
        }),
      } as unknown as Record;

      neo4jService.write.mockResolvedValueOnce({
        records: [parentRecord],
      } as unknown as Result);

      const parent = await schema.createCategory({
        ...mockCategoryNodeData,
        id: 'parent-cat',
        name: 'Parent Category',
        parentCategoryId: undefined,
      });

      expect(parent).toBeDefined();

      // Create child category
      const childRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockCategoryData, id: 'child-cat' },
        }),
      } as unknown as Record;

      neo4jService.write.mockResolvedValueOnce({
        records: [childRecord],
      } as unknown as Result);

      const child = await schema.createCategory({
        ...mockCategoryNodeData,
        id: 'child-cat',
        name: 'Child Category',
        parentCategoryId: 'parent-cat',
      });

      expect(child).toBeDefined();

      // Get hierarchy
      const hierarchyRecords = [
        {
          get: jest.fn().mockReturnValue({
            id: 'parent-cat',
            name: 'Parent Category',
            children: [{ id: 'child-cat', name: 'Child Category' }],
          }),
        },
      ] as unknown as Record[];

      neo4jService.read.mockResolvedValueOnce({
        records: hierarchyRecords,
      } as unknown as Result);

      const hierarchy = await schema.getCategoryHierarchy();
      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].id).toBe('parent-cat');
    });
  });

  describe('Schema Characteristics', () => {
    it('should not support content voting', () => {
      expect((schema as any).supportsContentVoting()).toBe(false);
    });

    it('should have standard id field', () => {
      expect((schema as any).idField).toBe('id');
    });

    it('should have correct node label', () => {
      expect((schema as any).nodeLabel).toBe('CategoryNode');
    });

    it('should not support tagging (categories use COMPOSED_OF)', () => {
      expect(typeof (schema as any).getKeywords).toBe('undefined');
      expect(typeof (schema as any).updateKeywords).toBe('undefined');
    });

    it('should not use categorization system (categories are the taxonomy)', () => {
      expect(typeof (schema as any).getCategories).toBe('undefined');
      expect(typeof (schema as any).updateCategories).toBe('undefined');
    });
  });

  describe('Category Composition', () => {
    it('should validate all words exist before category creation', async () => {
      neo4jService.write.mockRejectedValue(
        new Error(
          'some words may not exist or have not passed inclusion threshold',
        ),
      );

      await expect(
        schema.createCategory({
          ...mockCategoryNodeData,
          wordIds: ['nonexistent-word'],
        }),
      ).rejects.toThrow(
        'All words must exist and have passed inclusion threshold',
      );
    });

    it('should track word count correctly', async () => {
      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'c' || key === 'n') {
            return { properties: mockCategoryData };
          }
          if (key === 'words') {
            return [
              { id: 'word-1', word: 'tech' },
              { id: 'word-2', word: 'AI' },
              { id: 'word-3', word: 'future' },
            ];
          }
          return null;
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getCategory('cat-123');
      expect(result?.words).toHaveLength(3);
    });
  });

  describe('Visibility Status', () => {
    it('should handle categories without visibility status field', () => {
      // CategorySchema doesn't have visibility status methods
      expect(typeof (schema as any).setVisibilityStatus).toBe('undefined');
      expect(typeof (schema as any).getVisibilityStatus).toBe('undefined');
    });
  });
});
