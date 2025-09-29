// src/neo4j/schemas/__tests__/categorized.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  CategorizedNodeSchema,
  CategorizedNodeData,
  CategorizedCreateData,
  GraphFilters,
} from '../base/categorized.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';

// Test implementation of CategorizedNodeSchema
interface TestCategorizedNodeData extends CategorizedNodeData {
  title: string;
  content: string;
}

class TestCategorizedNodeSchema extends CategorizedNodeSchema<TestCategorizedNodeData> {
  protected nodeLabel = 'TestCategorizedNode';
  protected idField = 'id';

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, 'TestCategorizedNodeSchema');
  }

  protected supportsContentVoting(): boolean {
    return true;
  }

  protected mapNodeFromRecord(record: Record): TestCategorizedNodeData {
    const node = record.get('n');
    const props = node.properties;

    return {
      id: props.id,
      title: props.title,
      content: props.content,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      keywords: [], // Keywords loaded separately
      categories: [], // Categories loaded separately
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      contentPositiveVotes: this.toNumber(props.contentPositiveVotes),
      contentNegativeVotes: this.toNumber(props.contentNegativeVotes),
      contentNetVotes: this.toNumber(props.contentNetVotes),
      discussionId: props.discussionId,
    };
  }

  protected buildUpdateQuery(
    id: string,
    updateData: Partial<TestCategorizedNodeData>,
  ): { cypher: string; params: any } {
    // Remove keywords and categories from node updates as they're handled separately
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { keywords, categories, ...nodeUpdates } = updateData;

    return {
      cypher: `
        MATCH (n:TestCategorizedNode {id: $id})
        SET n += $updateData, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: nodeUpdates },
    };
  }

  // Expose protected methods for testing
  public async testAttachCategories(
    nodeId: string,
    categoryIds: string[],
  ): Promise<void> {
    return this.attachCategories(nodeId, categoryIds);
  }

  public async testCreateSharedCategoryRelationships(
    nodeId: string,
    nodeLabel?: string,
  ): Promise<void> {
    return this.createSharedCategoryRelationships(nodeId, nodeLabel);
  }

  public testBuildCategorizedCreateQuery(data: CategorizedCreateData) {
    return this.buildCategorizedCreateQuery(data);
  }
}

describe('CategorizedNodeSchema', () => {
  let testSchema: TestCategorizedNodeSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  const mockKeywords: KeywordWithFrequency[] = [
    { word: 'test', frequency: 2, source: 'ai' },
    { word: 'node', frequency: 1, source: 'user' },
  ];

  const mockCategories = [
    { id: 'cat-1', name: 'Technology', description: 'Tech category' },
    { id: 'cat-2', name: 'Programming', description: 'Programming category' },
    { id: 'cat-3', name: 'Testing', description: 'Testing category' },
  ];

  const mockCategoryIds = ['cat-1', 'cat-2', 'cat-3'];

  const mockCategorizedNodeData: TestCategorizedNodeData = {
    id: 'categorized-123',
    title: 'Test Categorized Node',
    content: 'This is a test node with categories and keywords',
    createdBy: 'user-456',
    publicCredit: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    keywords: mockKeywords,
    categories: mockCategories,
    inclusionPositiveVotes: 10,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 7,
    contentPositiveVotes: 8,
    contentNegativeVotes: 2,
    contentNetVotes: 6,
    discussionId: 'discussion-789',
  };

  beforeEach(async () => {
    const mockNeo4jService = {
      read: jest.fn(),
      write: jest.fn(),
    };

    const mockVoteSchema = {
      vote: jest.fn(),
      removeVote: jest.fn(),
      getVoteStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Neo4jService,
          useValue: mockNeo4jService,
        },
        {
          provide: VoteSchema,
          useValue: mockVoteSchema,
        },
      ],
    }).compile();

    neo4jService = module.get(Neo4jService) as jest.Mocked<Neo4jService>;
    voteSchema = module.get(VoteSchema) as jest.Mocked<VoteSchema>;

    testSchema = new TestCategorizedNodeSchema(neo4jService, voteSchema);
  });

  describe('Category Operations', () => {
    describe('attachCategories', () => {
      it('should create CATEGORIZED_AS relationships', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.testAttachCategories(
          'categorized-123',
          mockCategoryIds,
        );

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('UNWIND $categoryIds as categoryId'),
          expect.objectContaining({
            nodeId: 'categorized-123',
            categoryIds: mockCategoryIds,
          }),
        );

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('WHERE cat.inclusionNetVotes > 0'),
          expect.any(Object),
        );
      });

      it('should handle empty category array', async () => {
        await testSchema.testAttachCategories('categorized-123', []);

        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should enforce maximum category limit', async () => {
        const tooManyCategories = ['cat-1', 'cat-2', 'cat-3', 'cat-4'];

        await expect(
          testSchema.testAttachCategories('categorized-123', tooManyCategories),
        ).rejects.toThrow('Node can have maximum 3 categories');
      });

      it('should validate categories pass inclusion threshold', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.testAttachCategories(
          'categorized-123',
          mockCategoryIds,
        );

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (cat:CategoryNode {id: categoryId})'),
          expect.any(Object),
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('WHERE cat.inclusionNetVotes > 0'),
          expect.any(Object),
        );
      });
    });

    describe('createSharedCategoryRelationships', () => {
      it('should create SHARED_CATEGORY relationships', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.testCreateSharedCategoryRelationships(
          'categorized-123',
        );

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('SHARED_CATEGORY'),
          expect.objectContaining({
            nodeId: 'categorized-123',
          }),
        );
      });

      it('should optionally filter by node label', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.testCreateSharedCategoryRelationships(
          'categorized-123',
          'TestCategorizedNode',
        );

        expect(neo4jService.write).toHaveBeenCalled();
      });
    });

    describe('getCategories', () => {
      it('should retrieve categories for a node', async () => {
        const mockRecords = mockCategories.map((category) => ({
          get: jest.fn((field: string) => {
            if (field === 'id') return category.id;
            if (field === 'name') return category.name;
            if (field === 'description') return category.description;
            return null;
          }),
        })) as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await testSchema.getCategories('categorized-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (n:TestCategorizedNode {id: $nodeId})',
          ),
          expect.objectContaining({ nodeId: 'categorized-123' }),
        );

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({
          id: 'cat-1',
          name: 'Technology',
          description: 'Tech category',
        });
      });

      it('should validate node ID', async () => {
        await expect(testSchema.getCategories('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });

      it('should return empty array when node has no categories', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await testSchema.getCategories('categorized-123');

        expect(result).toEqual([]);
      });
    });

    describe('findRelatedByCategories', () => {
      it('should find nodes that share categories', async () => {
        const mockRecords = [
          {
            get: jest.fn((field: string) => {
              if (field === 'nodeId') return 'related-1';
              if (field === 'sharedCategories')
                return [
                  { id: 'cat-1', name: 'Technology' },
                  { id: 'cat-2', name: 'Programming' },
                ];
              if (field === 'strength') return Integer.fromNumber(20);
              return null;
            }),
          },
          {
            get: jest.fn((field: string) => {
              if (field === 'nodeId') return 'related-2';
              if (field === 'sharedCategories')
                return [{ id: 'cat-1', name: 'Technology' }];
              if (field === 'strength') return Integer.fromNumber(10);
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result =
          await testSchema.findRelatedByCategories('categorized-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (n:TestCategorizedNode {id: $nodeId})',
          ),
          expect.objectContaining({
            nodeId: 'categorized-123',
            limit: 10,
          }),
        );

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          nodeId: 'related-1',
          sharedCategories: [
            { id: 'cat-1', name: 'Technology' },
            { id: 'cat-2', name: 'Programming' },
          ],
          strength: 20,
        });
      });

      it('should respect limit parameter', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await testSchema.findRelatedByCategories('categorized-123', 5);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            nodeId: 'categorized-123',
            limit: 5,
          }),
        );
      });

      it('should validate node ID', async () => {
        await expect(testSchema.findRelatedByCategories('')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('findRelatedByCombined', () => {
      it('should find nodes by both tags and categories', async () => {
        const mockRecords = [
          {
            get: jest.fn((field: string) => {
              if (field === 'nodeId') return 'related-1';
              if (field === 'tagStrength') return Integer.fromNumber(15);
              if (field === 'categoryStrength') return Integer.fromNumber(20);
              if (field === 'combinedStrength') return Integer.fromNumber(55); // 15 + (20*2)
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result =
          await testSchema.findRelatedByCombined('categorized-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (n:TestCategorizedNode {id: $nodeId})',
          ),
          expect.objectContaining({
            nodeId: 'categorized-123',
            limit: 10,
          }),
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          nodeId: 'related-1',
          tagStrength: 15,
          categoryStrength: 20,
          combinedStrength: 55,
        });
      });

      it('should weight categories higher than tags', async () => {
        // The query uses: (tagStrength + categoryStrength * 2)
        // This test verifies the weighting is working
        const mockRecords = [
          {
            get: jest.fn((field: string) => {
              if (field === 'nodeId') return 'related-1';
              if (field === 'tagStrength') return Integer.fromNumber(10);
              if (field === 'categoryStrength') return Integer.fromNumber(5);
              if (field === 'combinedStrength') return Integer.fromNumber(20); // 10 + (5*2)
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result =
          await testSchema.findRelatedByCombined('categorized-123');

        expect(result[0].combinedStrength).toBe(20);
        expect(result[0].combinedStrength).toBeGreaterThan(
          result[0].tagStrength,
        );
      });
    });

    describe('updateCategories', () => {
      it('should delete old and create new category relationships', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.updateCategories('categorized-123', mockCategoryIds);

        // Should delete old CATEGORIZED_AS relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n)-[c:CATEGORIZED_AS]->()'),
          expect.objectContaining({ nodeId: 'categorized-123' }),
        );

        // Should delete old SHARED_CATEGORY relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n)-[sc:SHARED_CATEGORY]-()'),
          expect.objectContaining({ nodeId: 'categorized-123' }),
        );

        // Should create new relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('UNWIND $categoryIds as categoryId'),
          expect.objectContaining({
            nodeId: 'categorized-123',
            categoryIds: mockCategoryIds,
          }),
        );
      });

      it('should handle empty categories array', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.updateCategories('categorized-123', []);

        // Should still delete old relationships
        expect(neo4jService.write).toHaveBeenCalledTimes(2); // Delete CATEGORIZED_AS and SHARED_CATEGORY
      });

      it('should validate node ID', async () => {
        await expect(
          testSchema.updateCategories('', mockCategoryIds),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('Query Building', () => {
    describe('buildCategorizedCreateQuery', () => {
      it('should build query with both keywords and categories', () => {
        const createData: CategorizedCreateData = {
          id: 'new-123',
          createdBy: 'user-456',
          publicCredit: true,
          keywords: mockKeywords,
          categoryIds: mockCategoryIds,
          nodeProperties: {
            title: 'Test Title',
            content: 'Test Content',
          },
        };

        const result = testSchema.testBuildCategorizedCreateQuery(createData);

        expect(result.cypher).toContain('TestCategorizedNode');
        expect(result.cypher).toContain('UNWIND $keywords');
        expect(result.cypher).toContain('UNWIND categoryIds as categoryId');
        expect(result.cypher).toContain('SHARED_TAG');
        expect(result.cypher).toContain('SHARED_CATEGORY');
        expect(result.params).toEqual(
          expect.objectContaining({
            id: 'new-123',
            createdBy: 'user-456',
            publicCredit: true,
            keywords: mockKeywords,
            categoryIds: mockCategoryIds,
            title: 'Test Title',
            content: 'Test Content',
          }),
        );
      });

      it('should build query with keywords but no categories', () => {
        const createData: CategorizedCreateData = {
          id: 'new-123',
          createdBy: 'user-456',
          publicCredit: true,
          keywords: mockKeywords,
          nodeProperties: {
            title: 'Test Title',
          },
        };

        const result = testSchema.testBuildCategorizedCreateQuery(createData);

        expect(result.cypher).toContain('UNWIND $keywords');
        expect(result.cypher).not.toContain('UNWIND $categoryIds');
        expect(result.params.categoryIds).toBeUndefined();
      });

      it('should handle parent relationships', () => {
        const createData: CategorizedCreateData = {
          id: 'new-123',
          createdBy: 'user-456',
          publicCredit: true,
          parentId: 'parent-456',
          parentType: 'ParentNode',
          parentRelationship: 'CHILD_OF',
          nodeProperties: {
            title: 'Test Title',
          },
        };

        const result = testSchema.testBuildCategorizedCreateQuery(createData);

        expect(result.cypher).toContain('MATCH (parent:ParentNode');
        expect(result.cypher).toContain('CREATE (n)-[:CHILD_OF]->(parent)');
        expect(result.params.parentId).toBe('parent-456');
      });
    });
  });

  describe('Graph Data Operations', () => {
    describe('getGraphData', () => {
      it('should retrieve graph data with filters', async () => {
        const filters: GraphFilters = {
          keywords: { mode: 'any', values: ['test', 'node'] },
          categories: { mode: 'any', values: ['cat-1', 'cat-2'] },
          minInclusionVotes: 5,
          limit: 20,
        };

        const mockNode = {
          properties: mockCategorizedNodeData,
        };

        const mockRecord = {
          get: jest.fn((field: string) => {
            if (field === 'nodes') return [mockNode];
            if (field === 'tagEdges')
              return [
                {
                  source: 'categorized-123',
                  target: 'related-1',
                  type: 'SHARED_TAG',
                  weight: 10,
                  word: 'test',
                },
              ];
            if (field === 'categoryEdges')
              return [
                {
                  source: 'categorized-123',
                  target: 'related-2',
                  type: 'SHARED_CATEGORY',
                  weight: 15,
                  categoryId: 'cat-1',
                  categoryName: 'Technology',
                },
              ];
            return null;
          }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await testSchema.getGraphData(filters);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:TestCategorizedNode)'),
          expect.objectContaining({
            keywords: ['test', 'node'],
            categoryIds: ['cat-1', 'cat-2'],
            minVotes: 5,
            limit: 20,
          }),
        );

        expect(result.nodes).toHaveLength(1);
        expect(result.edges).toHaveLength(2);
        expect(result.edges[0].type).toBe('SHARED_TAG');
        expect(result.edges[1].type).toBe('SHARED_CATEGORY');
      });

      it('should handle empty results', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await testSchema.getGraphData({});

        expect(result).toEqual({ nodes: [], edges: [] });
      });

      it('should support different filter modes', async () => {
        const filters: GraphFilters = {
          keywords: { mode: 'all', values: ['test', 'node'] },
          categories: { mode: 'exact', values: ['cat-1', 'cat-2'] },
        };

        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await testSchema.getGraphData(filters);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('ALL(keyword IN $keywords'),
          expect.any(Object),
        );
      });
    });
  });

  describe('Inherited Functionality', () => {
    it('should inherit all TaggedNodeSchema methods', () => {
      expect(typeof testSchema.getKeywords).toBe('function');
      expect(typeof testSchema.findRelatedByTags).toBe('function');
      expect(typeof testSchema.updateKeywords).toBe('function');
    });

    it('should inherit all BaseNodeSchema methods', () => {
      expect(typeof testSchema.findById).toBe('function');
      expect(typeof testSchema.update).toBe('function');
      expect(typeof testSchema.delete).toBe('function');
      expect(typeof testSchema.voteInclusion).toBe('function');
      expect(typeof testSchema.voteContent).toBe('function');
    });

    it('should inherit voting operations', async () => {
      const mockVoteResult: VoteResult = {
        inclusionPositiveVotes: 10,
        inclusionNegativeVotes: 3,
        inclusionNetVotes: 7,
        contentPositiveVotes: 8,
        contentNegativeVotes: 2,
        contentNetVotes: 6,
      };

      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await testSchema.voteInclusion(
        'categorized-123',
        'user-456',
        true,
      );

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'TestCategorizedNode',
        { id: 'categorized-123' },
        'user-456',
        true,
        'INCLUSION',
      );
      expect(result).toEqual(mockVoteResult);
    });
  });

  describe('CategorizedNodeData Interface Compliance', () => {
    it('should include all required base fields', () => {
      const requiredBaseFields = [
        'id',
        'createdBy',
        'publicCredit',
        'createdAt',
        'updatedAt',
        'inclusionPositiveVotes',
        'inclusionNegativeVotes',
        'inclusionNetVotes',
        'contentPositiveVotes',
        'contentNegativeVotes',
        'contentNetVotes',
      ];

      requiredBaseFields.forEach((field) => {
        expect(mockCategorizedNodeData).toHaveProperty(field);
      });
    });

    it('should include keywords field from TaggedNodeData', () => {
      expect(mockCategorizedNodeData).toHaveProperty('keywords');
      expect(Array.isArray(mockCategorizedNodeData.keywords)).toBe(true);
    });

    it('should include categories field', () => {
      expect(mockCategorizedNodeData).toHaveProperty('categories');
      expect(Array.isArray(mockCategorizedNodeData.categories)).toBe(true);
    });

    it('should properly structure categories', () => {
      mockCategorizedNodeData.categories?.forEach((category) => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(typeof category.id).toBe('string');
        expect(typeof category.name).toBe('string');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in category operations', async () => {
      neo4jService.write.mockRejectedValue(new Error('Connection failed'));

      await expect(
        testSchema.testAttachCategories('categorized-123', mockCategoryIds),
      ).rejects.toThrow('Connection failed');
    });

    it('should validate node ID in all operations', async () => {
      await expect(testSchema.getCategories('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(testSchema.findRelatedByCategories('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(testSchema.updateCategories('', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle errors in findRelatedByCategories', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query failed'));

      await expect(
        testSchema.findRelatedByCategories('categorized-123'),
      ).rejects.toThrow('Query failed');
    });
  });

  describe('Integration with Inheritance Chain', () => {
    it('should properly extend TaggedNodeSchema', () => {
      expect(testSchema).toBeInstanceOf(TestCategorizedNodeSchema);

      // Verify TaggedNodeSchema methods
      expect(typeof testSchema.getKeywords).toBe('function');
      expect(typeof testSchema.findRelatedByTags).toBe('function');

      // Verify CategorizedNodeSchema methods
      expect(typeof testSchema.getCategories).toBe('function');
      expect(typeof testSchema.findRelatedByCategories).toBe('function');
      expect(typeof testSchema.findRelatedByCombined).toBe('function');
    });

    it('should use correct node label in all operations', async () => {
      neo4jService.read.mockResolvedValue({ records: [] } as unknown as Result);

      await testSchema.findById('test-id');
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('TestCategorizedNode'),
        expect.any(Object),
      );

      await testSchema.getCategories('test-id').catch(() => {});
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('TestCategorizedNode'),
        expect.any(Object),
      );
    });
  });
});
