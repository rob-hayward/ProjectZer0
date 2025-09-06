// src/neo4j/schemas/__tests__/category.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { CategorySchema } from '../category.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { VoteStatus, VoteResult } from '../vote.schema';

describe('CategorySchema', () => {
  let schema: CategorySchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

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

  it('should be defined', () => {
    expect(schema).toBeDefined();
  });

  describe('createCategory', () => {
    const mockCategoryData = {
      id: 'cat-123',
      name: 'Technology',
      description: 'Technology related content',
      createdBy: 'user-123',
      publicCredit: true,
      wordIds: ['word-1', 'word-2'],
      parentCategoryId: 'parent-cat',
      initialComment: 'Initial comment',
    };

    it('should create a category successfully', async () => {
      const mockResult = {
        records: [
          {
            get: jest.fn().mockReturnValue({
              properties: {
                id: mockCategoryData.id,
                name: mockCategoryData.name,
                description: mockCategoryData.description,
                createdBy: mockCategoryData.createdBy,
                publicCredit: mockCategoryData.publicCredit,
                inclusionPositiveVotes: Integer.fromNumber(0),
                inclusionNegativeVotes: Integer.fromNumber(0),
                inclusionNetVotes: Integer.fromNumber(0),
              },
            }),
          },
        ],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.createCategory(mockCategoryData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (c:CategoryNode'),
        expect.objectContaining({
          id: mockCategoryData.id,
          name: mockCategoryData.name,
          description: mockCategoryData.description,
          createdBy: mockCategoryData.createdBy,
          publicCredit: mockCategoryData.publicCredit,
        }),
      );
      expect(result).toHaveProperty('id', mockCategoryData.id);
      expect(result).toHaveProperty('name', mockCategoryData.name);
    });

    it('should throw BadRequestException for empty category name', async () => {
      const invalidData = { ...mockCategoryData, name: '' };

      await expect(schema.createCategory(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid word count (0 words)', async () => {
      const invalidData = { ...mockCategoryData, wordIds: [] };

      await expect(schema.createCategory(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid word count (>5 words)', async () => {
      const invalidData = {
        ...mockCategoryData,
        wordIds: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'],
      };

      await expect(schema.createCategory(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle creation failure when words do not exist', async () => {
      neo4jService.write.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await expect(schema.createCategory(mockCategoryData)).rejects.toThrow(
        'Failed to create category',
      );
    });
  });

  describe('getCategory', () => {
    const mockCategoryId = 'cat-123';

    it('should retrieve a category with all related data', async () => {
      const mockCategory = {
        id: mockCategoryId,
        name: 'Technology',
        description: 'Tech category',
        createdBy: 'user-123',
        publicCredit: true,
        inclusionPositiveVotes: Integer.fromNumber(5),
        inclusionNegativeVotes: Integer.fromNumber(1),
        inclusionNetVotes: Integer.fromNumber(4),
      };

      const mockComposedWords = [
        {
          id: 'word-1',
          word: 'tech',
          inclusionNetVotes: Integer.fromNumber(3),
        },
        {
          id: 'word-2',
          word: 'innovation',
          inclusionNetVotes: Integer.fromNumber(2),
        },
      ];

      const mockParentCategory = {
        id: 'parent-cat',
        name: 'Parent Category',
        inclusionNetVotes: Integer.fromNumber(5),
      };

      const mockChildCategories = [
        {
          id: 'child-1',
          name: 'Child 1',
          inclusionNetVotes: Integer.fromNumber(2),
        },
      ];

      const mockRecord = {
        get: jest
          .fn()
          .mockReturnValueOnce({ properties: mockCategory })
          .mockReturnValueOnce(mockComposedWords)
          .mockReturnValueOnce(mockParentCategory)
          .mockReturnValueOnce(mockChildCategories)
          .mockReturnValueOnce('discussion-123')
          .mockReturnValueOnce(Integer.fromNumber(10)),
      } as unknown as Record;

      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getCategory(mockCategoryId);

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (c:CategoryNode {id: $id})'),
        { id: mockCategoryId },
      );
      expect(result).toHaveProperty('id', mockCategoryId);
      expect(result).toHaveProperty('name', 'Technology');
      expect(result).toHaveProperty('composedWords');
      expect(result.composedWords).toHaveLength(2);
      expect(result).toHaveProperty('parentCategory');
      expect(result).toHaveProperty('childCategories');
      expect(result).toHaveProperty('discussionId', 'discussion-123');
      expect(result).toHaveProperty('usageCount', 10);
      expect(result.inclusionNetVotes).toBe(4);
    });

    it('should return null when category is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getCategory('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty category ID', async () => {
      await expect(schema.getCategory('')).rejects.toThrow(BadRequestException);
      expect(neo4jService.read).not.toHaveBeenCalled();
    });
  });

  describe('updateCategory', () => {
    const mockCategoryId = 'cat-123';
    const mockUpdateData = {
      name: 'Updated Technology',
      description: 'Updated description',
      publicCredit: false,
    };

    it('should update category successfully', async () => {
      const mockUpdatedCategory = {
        id: mockCategoryId,
        name: mockUpdateData.name,
        description: mockUpdateData.description,
        publicCredit: mockUpdateData.publicCredit,
        inclusionPositiveVotes: Integer.fromNumber(5),
        inclusionNegativeVotes: Integer.fromNumber(1),
        inclusionNetVotes: Integer.fromNumber(4),
      };

      const mockResult = {
        records: [
          {
            get: jest.fn().mockReturnValue({ properties: mockUpdatedCategory }),
          },
        ],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.updateCategory(
        mockCategoryId,
        mockUpdateData,
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('SET'),
        expect.objectContaining({
          id: mockCategoryId,
          name: mockUpdateData.name,
          description: mockUpdateData.description,
          publicCredit: mockUpdateData.publicCredit,
        }),
      );
      expect(result).toHaveProperty('name', mockUpdateData.name);
      expect(result.inclusionNetVotes).toBe(4);
    });

    it('should throw NotFoundException when category does not exist', async () => {
      neo4jService.write.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await expect(
        schema.updateCategory(mockCategoryId, mockUpdateData),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for empty update data', async () => {
      await expect(schema.updateCategory(mockCategoryId, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });
  });

  describe('deleteCategory', () => {
    const mockCategoryId = 'cat-123';

    it('should delete category successfully', async () => {
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(1)) }],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.deleteCategory(mockCategoryId);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('DETACH DELETE'),
        { id: mockCategoryId },
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when category does not exist', async () => {
      neo4jService.write.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await expect(schema.deleteCategory(mockCategoryId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getApprovedCategories', () => {
    it('should retrieve approved categories with default options', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Technology',
          inclusionNetVotes: Integer.fromNumber(5),
          composedWords: [{ id: 'word-1', word: 'tech' }],
          usageCount: Integer.fromNumber(10),
        },
        {
          id: 'cat-2',
          name: 'Science',
          inclusionNetVotes: Integer.fromNumber(3),
          composedWords: [{ id: 'word-2', word: 'science' }],
          usageCount: Integer.fromNumber(5),
        },
      ];

      const mockRecords = mockCategories.map((category) => ({
        get: jest.fn().mockReturnValue(category),
      })) as unknown as Record[];

      const mockResult = { records: mockRecords } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getApprovedCategories();

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('WHERE c.inclusionNetVotes > 0'),
        expect.objectContaining({ offset: 0 }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'cat-1');
      expect(result[0].inclusionNetVotes).toBe(5);
      expect(result[0].usageCount).toBe(10);
    });

    it('should handle pagination and sorting options', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      await schema.getApprovedCategories({
        limit: 10,
        offset: 20,
        sortBy: 'usage',
        sortDirection: 'desc',
        parentId: 'parent-cat',
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY usageCount DESC'),
        expect.objectContaining({
          offset: 20,
          limit: 10,
          parentId: 'parent-cat',
        }),
      );
    });
  });

  describe('getNodesUsingCategory', () => {
    const mockCategoryId = 'cat-123';

    it('should retrieve nodes categorized under the category', async () => {
      const mockNodes = [
        {
          id: 'node-1',
          type: 'StatementNode',
          content: 'Test statement',
          createdBy: 'user-1',
          inclusionNetVotes: Integer.fromNumber(5),
          contentNetVotes: Integer.fromNumber(3),
        },
        {
          id: 'node-2',
          type: 'AnswerNode',
          content: 'Test answer',
          createdBy: 'user-2',
          inclusionNetVotes: Integer.fromNumber(4),
          contentNetVotes: Integer.fromNumber(2),
        },
      ];

      const mockRecords = mockNodes.map((node) => ({
        get: jest.fn().mockReturnValue(node),
      })) as unknown as Record[];

      const mockResult = { records: mockRecords } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getNodesUsingCategory(mockCategoryId);

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n)-[:CATEGORIZED_AS]->(c)'),
        expect.objectContaining({
          categoryId: mockCategoryId,
          offset: 0,
          limit: 10,
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'node-1');
      expect(result[0].inclusionNetVotes).toBe(5);
      expect(result[1].contentNetVotes).toBe(2);
    });

    it('should filter by node types when specified', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      await schema.getNodesUsingCategory(mockCategoryId, {
        nodeTypes: ['statement', 'answer'],
        limit: 5,
        sortBy: 'votes',
        sortDirection: 'asc',
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('(n:StatementNode OR n:AnswerNode)'),
        expect.objectContaining({
          categoryId: mockCategoryId,
          offset: 0,
          limit: 5,
        }),
      );
    });
  });

  describe('getCategoryPath', () => {
    const mockCategoryId = 'cat-123';

    it('should return hierarchical path for category', async () => {
      const mockPath = [
        { id: 'root-cat', name: 'Root', inclusionNetVotes: 10 },
        { id: 'parent-cat', name: 'Parent', inclusionNetVotes: 8 },
        { id: mockCategoryId, name: 'Current', inclusionNetVotes: 5 },
      ];

      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(mockPath) }],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getCategoryPath(mockCategoryId);

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'OPTIONAL MATCH path = (root:CategoryNode)-[:PARENT_OF*]->(c)',
        ),
        { categoryId: mockCategoryId },
      );
      expect(result).toEqual(mockPath);
      expect(result).toHaveLength(3);
    });

    it('should return empty array when category not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getCategoryPath('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getCategoryStats', () => {
    const mockCategoryId = 'cat-123';

    it('should return category statistics', async () => {
      const mockStats = {
        contentCount: Integer.fromNumber(25),
        childCount: Integer.fromNumber(3),
        wordCount: Integer.fromNumber(2),
        inclusionNetVotes: Integer.fromNumber(8),
      };

      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(mockStats) }],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getCategoryStats(mockCategoryId);

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(DISTINCT content)'),
        { categoryId: mockCategoryId },
      );
      expect(result).toEqual({
        contentCount: 25,
        childCount: 3,
        wordCount: 2,
        inclusionNetVotes: 8,
      });
    });

    it('should return zero stats when no records found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getCategoryStats(mockCategoryId);

      expect(result).toEqual({
        contentCount: 0,
        childCount: 0,
        wordCount: 0,
        inclusionNetVotes: 0,
      });
    });
  });

  describe('voting methods', () => {
    const mockCategoryId = 'cat-123';
    const mockUserId = 'user-123';

    describe('voteCategoryInclusion', () => {
      it('should vote on category inclusion', async () => {
        const mockVoteResult: VoteResult = {
          inclusionPositiveVotes: 6,
          inclusionNegativeVotes: 1,
          inclusionNetVotes: 5,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        };

        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteCategoryInclusion(
          mockCategoryId,
          mockUserId,
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'CategoryNode',
          { id: mockCategoryId },
          mockUserId,
          true,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('getCategoryVoteStatus', () => {
      it('should get vote status for category', async () => {
        const mockVoteStatus: VoteStatus = {
          inclusionStatus: 'agree',
          inclusionPositiveVotes: 5,
          inclusionNegativeVotes: 1,
          inclusionNetVotes: 4,
          contentStatus: null,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        };

        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getCategoryVoteStatus(
          mockCategoryId,
          mockUserId,
        );

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'CategoryNode',
          { id: mockCategoryId },
          mockUserId,
        );
        expect(result).toEqual(mockVoteStatus);
      });
    });

    describe('removeCategoryVote', () => {
      it('should remove vote from category', async () => {
        voteSchema.removeVote.mockResolvedValue(undefined);

        await schema.removeCategoryVote(mockCategoryId, mockUserId);

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'CategoryNode',
          { id: mockCategoryId },
          mockUserId,
          'INCLUSION',
        );
      });
    });

    describe('getCategoryVotes', () => {
      it('should get vote counts for category', async () => {
        const mockVoteStatus: VoteStatus = {
          inclusionStatus: 'agree',
          inclusionPositiveVotes: 5,
          inclusionNegativeVotes: 1,
          inclusionNetVotes: 4,
          contentStatus: null,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        };

        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getCategoryVotes(mockCategoryId);

        expect(result).toEqual({
          inclusionPositiveVotes: 5,
          inclusionNegativeVotes: 1,
          inclusionNetVotes: 4,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });

      it('should return null when no vote status found', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await schema.getCategoryVotes(mockCategoryId);

        expect(result).toBeNull();
      });
    });
  });

  describe('visibility methods', () => {
    const mockCategoryId = 'cat-123';

    describe('setVisibilityStatus', () => {
      it('should set visibility status successfully', async () => {
        const mockResult = {
          records: [{ get: jest.fn().mockReturnValue({ properties: {} }) }],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.setVisibilityStatus(mockCategoryId, false);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('SET c.visibilityStatus = $isVisible'),
          { id: mockCategoryId, isVisible: false },
        );
        expect(result).toEqual({ success: true });
      });

      it('should throw NotFoundException when category not found', async () => {
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(
          schema.setVisibilityStatus('nonexistent', true),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('getVisibilityStatus', () => {
      it('should return true when visibility status is true', async () => {
        const mockResult = {
          records: [{ get: jest.fn().mockReturnValue(true) }],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getVisibilityStatus(mockCategoryId);

        expect(result).toBe(true);
      });

      it('should return true when visibility status is null (default)', async () => {
        const mockResult = {
          records: [{ get: jest.fn().mockReturnValue(null) }],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getVisibilityStatus(mockCategoryId);

        expect(result).toBe(true);
      });

      it('should return false when visibility status is false', async () => {
        const mockResult = {
          records: [{ get: jest.fn().mockReturnValue(false) }],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getVisibilityStatus(mockCategoryId);

        expect(result).toBe(false);
      });
    });
  });

  describe('discovery methods', () => {
    const mockCategoryId = 'cat-123';

    describe('getRelatedContentBySharedCategories', () => {
      it('should find related content categorized under this category', async () => {
        const mockRelatedNodes = [
          {
            id: 'node-1',
            type: 'StatementNode',
            content: 'Related statement',
            createdBy: 'user-1',
            inclusionNetVotes: Integer.fromNumber(5),
            contentNetVotes: Integer.fromNumber(3),
            categoryOverlap: Integer.fromNumber(2),
            sharedCategories: ['Technology', 'Science'],
          },
          {
            id: 'node-2',
            type: 'AnswerNode',
            content: 'Related answer',
            createdBy: 'user-2',
            inclusionNetVotes: Integer.fromNumber(4),
            contentNetVotes: Integer.fromNumber(2),
            categoryOverlap: Integer.fromNumber(1),
            sharedCategories: ['Technology'],
          },
        ];

        const mockRecords = mockRelatedNodes.map((node) => ({
          get: jest.fn().mockReturnValue(node),
        })) as unknown as Record[];

        const mockResult = { records: mockRecords } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getRelatedContentBySharedCategories(
          mockCategoryId,
          {
            nodeTypes: ['statement', 'answer'],
            limit: 5,
            sortBy: 'category_overlap',
            sortDirection: 'desc',
            minCategoryOverlap: 1,
          },
        );

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (current:CategoryNode {id: $categoryId})',
          ),
          expect.objectContaining({
            categoryId: mockCategoryId,
            offset: 0,
            limit: 5,
            minCategoryOverlap: 1,
          }),
        );
        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty('id', 'node-1');
        expect(result[0].categoryOverlap).toBe(2);
        expect(result[0].sharedCategories).toEqual(['Technology', 'Science']);
        expect(result[1].categoryOverlap).toBe(1);
      });

      it('should handle empty results', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result =
          await schema.getRelatedContentBySharedCategories(mockCategoryId);

        expect(result).toEqual([]);
      });

      it('should use default options when none provided', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        await schema.getRelatedContentBySharedCategories(mockCategoryId);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            categoryId: mockCategoryId,
            offset: 0,
            limit: 10,
            minCategoryOverlap: 1,
          }),
        );
      });

      it('should filter by node types when specified', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        await schema.getRelatedContentBySharedCategories(mockCategoryId, {
          nodeTypes: ['statement', 'quantity'],
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            '(related:StatementNode OR related:QuantityNode)',
          ),
          expect.any(Object),
        );
      });

      it('should apply different sorting options', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        await schema.getRelatedContentBySharedCategories(mockCategoryId, {
          sortBy: 'inclusion_votes',
          sortDirection: 'asc',
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'ORDER BY finalRelated.inclusionNetVotes ASC',
          ),
          expect.any(Object),
        );
      });
    });

    describe('getNodeCategories', () => {
      const mockNodeId = 'node-123';

      it('should return categories for a given node', async () => {
        const mockCategories = [
          {
            id: 'cat-1',
            name: 'Technology',
            description: 'Tech category',
            inclusionNetVotes: Integer.fromNumber(5),
            path: [
              { id: 'root-cat', name: 'Root' },
              { id: 'cat-1', name: 'Technology' },
            ],
          },
          {
            id: 'cat-2',
            name: 'Science',
            description: 'Science category',
            inclusionNetVotes: Integer.fromNumber(3),
            path: [{ id: 'cat-2', name: 'Science' }],
          },
        ];

        const mockResult = {
          records: [{ get: jest.fn().mockReturnValue(mockCategories) }],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getNodeCategories(mockNodeId);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (node)-[:CATEGORIZED_AS]->(c:CategoryNode)',
          ),
          { nodeId: mockNodeId },
        );
        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty('id', 'cat-1');
        expect(result[0]).toHaveProperty('name', 'Technology');
        expect(result[0].inclusionNetVotes).toBe(5);
        expect(result[0].path).toHaveLength(2);
        expect(result[1]).toHaveProperty('id', 'cat-2');
        expect(result[1].inclusionNetVotes).toBe(3);
      });

      it('should return empty array when node has no categories', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getNodeCategories(mockNodeId);

        expect(result).toEqual([]);
      });

      it('should return empty array when no records found', async () => {
        const mockResult = {
          records: [{ get: jest.fn().mockReturnValue([]) }],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getNodeCategories(mockNodeId);

        expect(result).toEqual([]);
      });

      it('should handle categories with no parent hierarchy', async () => {
        const mockCategories = [
          {
            id: 'cat-1',
            name: 'Standalone Category',
            description: 'No parent',
            inclusionNetVotes: Integer.fromNumber(3),
            path: [{ id: 'cat-1', name: 'Standalone Category' }],
          },
        ];

        const mockResult = {
          records: [{ get: jest.fn().mockReturnValue(mockCategories) }],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getNodeCategories(mockNodeId);

        expect(result).toHaveLength(1);
        expect(result[0].path).toHaveLength(1);
        expect(result[0].path[0]).toEqual({
          id: 'cat-1',
          name: 'Standalone Category',
        });
      });
    });
  });

  describe('getAllCategories', () => {
    it('should retrieve all categories with default options', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Technology',
          inclusionPositiveVotes: Integer.fromNumber(5),
          inclusionNegativeVotes: Integer.fromNumber(1),
          inclusionNetVotes: Integer.fromNumber(4),
          composedWords: [{ id: 'word-1', word: 'tech' }],
        },
        {
          id: 'cat-2',
          name: 'Science',
          inclusionPositiveVotes: Integer.fromNumber(3),
          inclusionNegativeVotes: Integer.fromNumber(0),
          inclusionNetVotes: Integer.fromNumber(3),
          composedWords: [{ id: 'word-2', word: 'science' }],
        },
      ];

      const mockRecords = mockCategories.map((category) => ({
        get: jest.fn().mockReturnValue(category),
      })) as unknown as Record[];

      const mockResult = { records: mockRecords } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getAllCategories();

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (c:CategoryNode)'),
        expect.objectContaining({ offset: 0 }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'cat-1');
      expect(result[0].inclusionNetVotes).toBe(4);
      expect(result[1].inclusionNetVotes).toBe(3);
    });

    it('should filter by approved categories when onlyApproved is true', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      await schema.getAllCategories({ onlyApproved: true });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('AND c.inclusionNetVotes > 0'),
        expect.any(Object),
      );
    });

    it('should apply sorting and pagination options', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      await schema.getAllCategories({
        limit: 5,
        offset: 10,
        sortBy: 'votes',
        sortDirection: 'desc',
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY c.inclusionNetVotes DESC'),
        expect.objectContaining({
          offset: 10,
          limit: 5,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should handle Neo4j service errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Neo4j connection failed'));

      await expect(schema.getCategory('cat-123')).rejects.toThrow(
        'Failed to get category',
      );
    });

    it('should handle voting errors gracefully', async () => {
      voteSchema.vote.mockRejectedValue(new Error('Vote failed'));

      await expect(
        schema.voteCategoryInclusion('cat-123', 'user-123', true),
      ).rejects.toThrow('Failed to vote on category');
    });

    it('should validate input parameters consistently', async () => {
      // Test empty category ID
      await expect(schema.getCategory('')).rejects.toThrow(BadRequestException);
      await expect(schema.updateCategory('', {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(schema.deleteCategory('')).rejects.toThrow(
        BadRequestException,
      );

      // Test empty node ID for discovery
      await expect(schema.getNodeCategories('')).rejects.toThrow(Error);

      // Verify no Neo4j calls made for invalid input
      expect(neo4jService.read).not.toHaveBeenCalled();
      expect(neo4jService.write).not.toHaveBeenCalled();
    });
  });

  describe('toNumber utility method', () => {
    it('should convert Neo4j integers correctly', async () => {
      // This tests the private toNumber method indirectly through getCategory
      const mockCategory = {
        id: 'cat-123',
        name: 'Test',
        inclusionPositiveVotes: Integer.fromNumber(5),
        inclusionNegativeVotes: Integer.fromNumber(1),
        inclusionNetVotes: Integer.fromNumber(4),
      };

      const mockRecord = {
        get: jest
          .fn()
          .mockReturnValueOnce({ properties: mockCategory })
          .mockReturnValueOnce([]) // composedWords
          .mockReturnValueOnce({ id: null }) // parentCategory
          .mockReturnValueOnce([]) // childCategories
          .mockReturnValueOnce(null) // discussionId
          .mockReturnValueOnce(Integer.fromNumber(10)), // usageCount
      } as unknown as Record;

      const mockResult = { records: [mockRecord] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getCategory('cat-123');

      // Verify that Neo4j integers are converted to JavaScript numbers
      expect(typeof result.inclusionPositiveVotes).toBe('number');
      expect(typeof result.inclusionNegativeVotes).toBe('number');
      expect(typeof result.inclusionNetVotes).toBe('number');
      expect(typeof result.usageCount).toBe('number');
      expect(result.inclusionNetVotes).toBe(4);
      expect(result.usageCount).toBe(10);
    });

    it('should handle null and undefined values in toNumber', async () => {
      const mockCategory = {
        id: 'cat-123',
        name: 'Test',
        inclusionPositiveVotes: null,
        inclusionNegativeVotes: undefined,
        inclusionNetVotes: Integer.fromNumber(0),
      };

      const mockRecord = {
        get: jest
          .fn()
          .mockReturnValueOnce({ properties: mockCategory })
          .mockReturnValueOnce([])
          .mockReturnValueOnce({ id: null })
          .mockReturnValueOnce([])
          .mockReturnValueOnce(null)
          .mockReturnValueOnce(Integer.fromNumber(0)),
      } as unknown as Record;

      const mockResult = { records: [mockRecord] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getCategory('cat-123');

      // Verify null/undefined are handled correctly (should become 0)
      expect(result.inclusionPositiveVotes).toBe(0);
      expect(result.inclusionNegativeVotes).toBe(0);
      expect(result.inclusionNetVotes).toBe(0);
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle maximum word count (5 words)', async () => {
      const validData = {
        id: 'cat-123',
        name: 'Technology',
        createdBy: 'user-123',
        publicCredit: true,
        wordIds: ['w1', 'w2', 'w3', 'w4', 'w5'], // exactly 5 words
      };

      const mockResult = {
        records: [
          { get: jest.fn().mockReturnValue({ properties: validData }) },
        ],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(schema.createCategory(validData)).resolves.toBeDefined();
    });

    it('should handle minimum word count (1 word)', async () => {
      const validData = {
        id: 'cat-123',
        name: 'Technology',
        createdBy: 'user-123',
        publicCredit: true,
        wordIds: ['w1'], // exactly 1 word
      };

      const mockResult = {
        records: [
          { get: jest.fn().mockReturnValue({ properties: validData }) },
        ],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(schema.createCategory(validData)).resolves.toBeDefined();
    });

    it('should handle category with no parent', async () => {
      const dataWithoutParent = {
        id: 'cat-123',
        name: 'Root Category',
        createdBy: 'user-123',
        publicCredit: true,
        wordIds: ['w1', 'w2'],
        // no parentCategoryId
      };

      const mockResult = {
        records: [
          { get: jest.fn().mockReturnValue({ properties: dataWithoutParent }) },
        ],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.createCategory(dataWithoutParent),
      ).resolves.toBeDefined();

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          parentCategoryId: null,
        }),
      );
    });

    it('should handle discovery with all node types', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      await schema.getRelatedContentBySharedCategories('cat-123', {
        nodeTypes: ['statement', 'answer', 'openquestion', 'quantity'],
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          '(related:StatementNode OR related:AnswerNode OR related:OpenQuestionNode OR related:QuantityNode)',
        ),
        expect.any(Object),
      );
    });

    it('should handle discovery with no node type filter (default to all)', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      await schema.getRelatedContentBySharedCategories('cat-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          '(related:StatementNode OR related:AnswerNode OR related:OpenQuestionNode OR related:QuantityNode)',
        ),
        expect.any(Object),
      );
    });
  });
});
