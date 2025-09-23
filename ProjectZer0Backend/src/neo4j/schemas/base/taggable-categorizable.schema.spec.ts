// src/neo4j/schemas/base/taggable-categorizable.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { Neo4jService } from '../../neo4j.service';
import {
  TaggableCategorizableNodeSchema,
  GraphFilters,
  TaggableCreateData,
  TaggableUpdateData,
} from './taggable-categorizable.schema';

// Create a concrete implementation for testing
class TestTaggableSchema extends TaggableCategorizableNodeSchema {
  protected nodeLabel = 'TestNode';
  protected idField = 'id';

  protected getNodeTypeName(): string {
    return 'Test';
  }

  protected supportsContentVoting(): boolean {
    return true;
  }

  protected mapNodeFromRecord(record: any): any {
    const node = record.get('n');
    return {
      id: node.properties.id,
      text: node.properties.text,
      inclusionNetVotes: node.properties.inclusionNetVotes,
      contentNetVotes: node.properties.contentNetVotes,
      createdAt: node.properties.createdAt,
      updatedAt: node.properties.updatedAt,
    };
  }

  // Implement abstract methods from BaseNodeSchema
  async create(data: any): Promise<any> {
    const { query, params } = this.buildTaggableCreateQuery(data);
    const result = await this.neo4jService.write(query, params);
    return this.mapNodeFromRecord(result.records[0]);
  }

  async update(id: string, data: any): Promise<any> {
    const { query, params } = this.buildTaggableUpdateQuery(id, data);
    const result = await this.neo4jService.write(query, params);
    return this.mapNodeFromRecord(result.records[0]);
  }

  protected buildCreateQuery(data: any): { cypher: string; params: any } {
    const { query, params } = this.buildTaggableCreateQuery(data);
    return { cypher: query, params };
  }

  protected buildUpdateQuery(
    id: string,
    data: any,
  ): { cypher: string; params: any } {
    const { query, params } = this.buildTaggableUpdateQuery(id, data);
    return { cypher: query, params };
  }

  protected buildRetrievalQuery(id: string): { cypher: string; params: any } {
    const { query, params } = this.buildTaggableRetrievalQuery(id);
    return { cypher: query, params };
  }

  // Expose protected methods for testing
  public testBuildTaggableCreateQuery(data: TaggableCreateData) {
    return this.buildTaggableCreateQuery(data);
  }

  public testBuildTaggableUpdateQuery(id: string, data: TaggableUpdateData) {
    return this.buildTaggableUpdateQuery(id, data);
  }

  public testBuildGraphFilterQuery(filters: GraphFilters) {
    return this.buildGraphFilterQuery(filters);
  }
}

describe('TaggableCategorizableNodeSchema', () => {
  let schema: TestTaggableSchema;
  let neo4jService: jest.Mocked<Neo4jService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestTaggableSchema,
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
          },
        },
      ],
    }).compile();

    schema = module.get<TestTaggableSchema>(TestTaggableSchema);
    neo4jService = module.get(Neo4jService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Creation with Categories and Keywords', () => {
    it('should build creation query with categories and keywords', () => {
      const createData: TaggableCreateData = {
        id: 'test-1',
        createdBy: 'user-1',
        publicCredit: true,
        categoryIds: ['cat-1', 'cat-2'],
        keywords: [
          { word: 'test', frequency: 0.8, source: 'user' },
          { word: 'example', frequency: 0.6, source: 'user' },
        ],
        nodeProperties: {
          text: 'Test content',
          otherField: 'value',
        },
      };

      const { query, params } = schema.testBuildTaggableCreateQuery(createData);

      // Check that query includes category attachment
      expect(query).toContain('CATEGORIZED_AS');
      expect(query).toContain('SHARED_CATEGORY');

      // Check that query includes keyword attachment
      expect(query).toContain('TAGGED');
      expect(query).toContain('SHARED_TAG');

      // Check params
      expect(params.id).toBe('test-1');
      expect(params.createdBy).toBe('user-1');
      expect(params.categoryIds).toEqual(['cat-1', 'cat-2']);
      expect(params.keywords).toEqual(createData.keywords);
      expect(params.text).toBe('Test content');
    });

    it('should validate maximum categories during creation', () => {
      const createData: TaggableCreateData = {
        id: 'test-1',
        createdBy: 'user-1',
        publicCredit: true,
        categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'], // Exceeds default max of 3
        keywords: [],
        nodeProperties: { text: 'Test' },
      };

      const { query } = schema.testBuildTaggableCreateQuery(createData);

      // Query should include category limit validation
      expect(query).toContain('WHERE size(categoryIds) <= 3');
    });

    it('should handle creation without categories or keywords', () => {
      const createData: TaggableCreateData = {
        id: 'test-1',
        createdBy: 'user-1',
        publicCredit: true,
        nodeProperties: { text: 'Test content' },
      };

      const { query, params } = schema.testBuildTaggableCreateQuery(createData);

      // Should not include category or keyword logic
      expect(query).not.toContain('CATEGORIZED_AS');
      expect(query).not.toContain('TAGGED');
      expect(params.categoryIds).toBeUndefined();
      expect(params.keywords).toBeUndefined();
    });

    it('should include parent validation when parent is specified', () => {
      const createData: TaggableCreateData = {
        id: 'test-1',
        createdBy: 'user-1',
        publicCredit: true,
        parentId: 'parent-1',
        parentType: 'ParentNode',
        parentRelationship: 'BELONGS_TO',
        nodeProperties: { text: 'Test' },
      };

      const { query, params } = schema.testBuildTaggableCreateQuery(createData);

      expect(query).toContain('MATCH (parent:ParentNode {id: $parentId})');
      expect(query).toContain('WHERE parent.inclusionNetVotes > 0');
      expect(query).toContain('CREATE (n)-[:BELONGS_TO]->(parent)');
      expect(params.parentId).toBe('parent-1');
    });
  });

  describe('Update with Categories and Keywords', () => {
    it('should handle category updates correctly', () => {
      const updateData: TaggableUpdateData = {
        categoryIds: ['cat-3', 'cat-4'],
        text: 'Updated text',
      };

      const { query, params } = schema.testBuildTaggableUpdateQuery(
        'test-1',
        updateData,
      );

      // Should delete old relationships
      expect(query).toContain('DELETE rCATEGORIZED_AS');
      expect(query).toContain('DELETE rSHARED_CATEGORY');

      // Should create new relationships
      expect(query).toContain('CREATE (n)-[:CATEGORIZED_AS]->(cat)');
      expect(query).toContain('SHARED_CATEGORY');

      expect(params.categoryIds).toEqual(['cat-3', 'cat-4']);
      expect(params.updateProperties.text).toBe('Updated text');
    });

    it('should handle keyword updates correctly', () => {
      const updateData: TaggableUpdateData = {
        keywords: [{ word: 'new', frequency: 0.9, source: 'user' }],
      };

      const { query, params } = schema.testBuildTaggableUpdateQuery(
        'test-1',
        updateData,
      );

      // Should delete old relationships
      expect(query).toContain('DELETE rTAGGED');
      expect(query).toContain('DELETE rSHARED_TAG');

      // Should create new relationships
      expect(query).toContain('CREATE (n)-[:TAGGED');
      expect(query).toContain('SHARED_TAG');

      expect(params.keywords).toEqual(updateData.keywords);
    });

    it('should handle clearing categories and keywords', () => {
      const updateData: TaggableUpdateData = {
        categoryIds: [],
        keywords: [],
      };

      const { query } = schema.testBuildTaggableUpdateQuery(
        'test-1',
        updateData,
      );

      // Should delete relationships but not try to create new ones
      expect(query).toContain('DELETE rCATEGORIZED_AS');
      expect(query).toContain('DELETE rSHARED_CATEGORY');
      expect(query).toContain('DELETE rTAGGED');
      expect(query).toContain('DELETE rSHARED_TAG');

      // Should not contain CREATE for empty arrays
      const createCount = (query.match(/CREATE \(n\)-\[:CATEGORIZED_AS/g) || [])
        .length;
      expect(createCount).toBe(0);
    });
  });

  describe('Graph Filtering Queries', () => {
    it('should build query for keyword filtering - ANY mode', () => {
      const filters: GraphFilters = {
        keywords: {
          mode: 'any',
          values: ['keyword1', 'keyword2'],
        },
      };

      const { query, params } = schema.testBuildGraphFilterQuery(filters);

      expect(query).toContain('MATCH (n)-[:TAGGED]->(w:WordNode)');
      expect(query).toContain('WHERE w.word IN $keywords');
      expect(query).toContain('WHERE matchCount > 0');
      expect(params.keywords).toEqual(['keyword1', 'keyword2']);
    });

    it('should build query for keyword filtering - ALL mode', () => {
      const filters: GraphFilters = {
        keywords: {
          mode: 'all',
          values: ['keyword1', 'keyword2', 'keyword3'],
        },
      };

      const { query, params } = schema.testBuildGraphFilterQuery(filters);

      expect(query).toContain('WHERE SIZE(nodeKeywords) = SIZE($keywords)');
      expect(params.keywords).toEqual(['keyword1', 'keyword2', 'keyword3']);
    });

    it('should build query for keyword filtering - EXACT mode', () => {
      const filters: GraphFilters = {
        keywords: {
          mode: 'exact',
          values: ['keyword1', 'keyword2'],
        },
      };

      const { query } = schema.testBuildGraphFilterQuery(filters);

      expect(query).toContain('WHERE SIZE(allNodeKeywords) = SIZE($keywords)');
      expect(query).toContain(
        'AND ALL(kw IN allNodeKeywords WHERE kw IN $keywords)',
      );
    });

    it('should build query for category filtering - ANY mode', () => {
      const filters: GraphFilters = {
        categories: {
          mode: 'any',
          values: ['cat-1', 'cat-2'],
        },
      };

      const { query, params } = schema.testBuildGraphFilterQuery(filters);

      expect(query).toContain('MATCH (n)-[:CATEGORIZED_AS]->(c:CategoryNode)');
      expect(query).toContain('WHERE c.id IN $categoryIds');
      expect(params.categoryIds).toEqual(['cat-1', 'cat-2']);
    });

    it('should build query for category filtering - ALL mode', () => {
      const filters: GraphFilters = {
        categories: {
          mode: 'all',
          values: ['cat-1', 'cat-2'],
        },
      };

      const { query } = schema.testBuildGraphFilterQuery(filters);

      expect(query).toContain(
        'WHERE SIZE(nodeCategories) = SIZE($categoryIds)',
      );
    });

    it('should build query for user created filter', () => {
      const filters: GraphFilters = {
        user: {
          mode: 'created',
          userId: 'user-123',
        },
      };

      const { query, params } = schema.testBuildGraphFilterQuery(filters);

      expect(query).toContain('MATCH (u:User {sub: $userId})-[:CREATED]->(n)');
      expect(params.userId).toBe('user-123');
    });

    it('should handle sorting by total votes', () => {
      const filters: GraphFilters = {
        sortBy: 'totalVotes',
        sortDirection: 'DESC',
      };

      const { query } = schema.testBuildGraphFilterQuery(filters);

      expect(query).toContain(
        'ORDER BY (n.inclusionPositiveVotes + n.inclusionNegativeVotes) DESC',
      );
    });

    it('should handle sorting by inclusion votes', () => {
      const filters: GraphFilters = {
        sortBy: 'inclusionNetVotes',
        sortDirection: 'ASC',
      };

      const { query } = schema.testBuildGraphFilterQuery(filters);

      expect(query).toContain('ORDER BY n.inclusionNetVotes ASC');
    });

    it('should handle pagination', () => {
      const filters: GraphFilters = {
        limit: 20,
        offset: 10,
      };

      const { query, params } = schema.testBuildGraphFilterQuery(filters);

      expect(query).toContain('SKIP $offset');
      expect(query).toContain('LIMIT $limit');
      expect(params.offset).toBe(10);
      expect(params.limit).toBe(20);
    });

    it('should combine multiple filters', () => {
      const filters: GraphFilters = {
        keywords: {
          mode: 'any',
          values: ['test'],
        },
        categories: {
          mode: 'all',
          values: ['cat-1', 'cat-2'],
        },
        user: {
          mode: 'created',
          userId: 'user-1',
        },
        minInclusionVotes: 5,
        sortBy: 'createdAt',
        sortDirection: 'DESC',
        limit: 10,
      };

      const { query, params } = schema.testBuildGraphFilterQuery(filters);

      // Check all filters are included
      expect(query).toContain('MATCH (u:User {sub: $userId})-[:CREATED]->(n)');
      expect(query).toContain('n.inclusionNetVotes >= $minVotes');
      expect(query).toContain('WHERE w.word IN $keywords');
      expect(query).toContain('WHERE c.id IN $categoryIds');
      expect(query).toContain('ORDER BY n.createdAt DESC');
      expect(query).toContain('LIMIT $limit');

      expect(params.userId).toBe('user-1');
      expect(params.minVotes).toBe(5);
      expect(params.keywords).toEqual(['test']);
      expect(params.categoryIds).toEqual(['cat-1', 'cat-2']);
      expect(params.limit).toBe(10);
    });
  });

  describe('getNodesForGraphWithFilters', () => {
    it('should retrieve and process nodes with filters', async () => {
      const mockRecords = [
        {
          get: (key: string) => {
            const data: any = {
              n: {
                properties: {
                  id: 'node-1',
                  text: 'Test node 1',
                  inclusionNetVotes: 10,
                  inclusionPositiveVotes: 12,
                  inclusionNegativeVotes: 2,
                  createdAt: '2024-01-01',
                },
              },
              hasDiscussion: true,
              sharedTagNodes: [],
              sharedCategoryNodes: [],
              tagStrength: 1,
              categoryStrength: 1,
            };
            return data[key];
          },
        },
      ];

      neo4jService.read.mockResolvedValue({ records: mockRecords } as any);

      const filters: GraphFilters = {
        minInclusionVotes: 5,
        limit: 10,
      };

      const result = await schema.getNodesForGraphWithFilters(filters);

      expect(neo4jService.read).toHaveBeenCalledTimes(1);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('node-1');
      expect(result.nodes[0].type).toBe('TestNode');
      expect(result.nodes[0].metadata.inclusionVotes).toBe(10);
      expect(result.nodes[0].metadata.totalVotes).toBe(14);
      expect(result.edges).toEqual([]);
    });

    it('should build edges between nodes sharing tags', async () => {
      const mockRecords = [
        {
          get: (key: string) => {
            const data: any = {
              n: {
                properties: {
                  id: 'node-1',
                  inclusionNetVotes: 10,
                  inclusionPositiveVotes: 10,
                  inclusionNegativeVotes: 0,
                  createdAt: '2024-01-01',
                },
              },
              hasDiscussion: false,
              sharedTagNodes: [{ properties: { id: 'node-2' } }],
              sharedCategoryNodes: [],
              tagStrength: 5,
              categoryStrength: 1,
            };
            return data[key];
          },
        },
        {
          get: (key: string) => {
            const data: any = {
              n: {
                properties: {
                  id: 'node-2',
                  inclusionNetVotes: 8,
                  inclusionPositiveVotes: 8,
                  inclusionNegativeVotes: 0,
                  createdAt: '2024-01-02',
                },
              },
              hasDiscussion: false,
              sharedTagNodes: [{ properties: { id: 'node-1' } }],
              sharedCategoryNodes: [],
              tagStrength: 5,
              categoryStrength: 1,
            };
            return data[key];
          },
        },
      ];

      neo4jService.read.mockResolvedValue({ records: mockRecords } as any);

      const result = await schema.getNodesForGraphWithFilters({});

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({
        source: 'node-1',
        target: 'node-2',
        type: 'SHARED_TAG',
        weight: 5,
      });
    });
  });

  describe('getSpecialNodesForGraph', () => {
    it('should retrieve Word nodes when includeWordNodes is true', async () => {
      const mockWordRecords = [
        {
          get: (key: string) => {
            const data: any = {
              n: {
                properties: {
                  word: 'testword',
                  inclusionNetVotes: 15,
                  inclusionPositiveVotes: 18,
                  inclusionNegativeVotes: 3,
                  createdAt: '2024-01-01',
                },
              },
              hasDiscussion: true,
              nodeType: 'WordNode',
            };
            return data[key];
          },
        },
      ];

      neo4jService.read.mockResolvedValue({ records: mockWordRecords } as any);

      const filters: GraphFilters = {
        keywords: {
          mode: 'any',
          values: ['testword'],
        },
        includeWordNodes: true,
      };

      const result = await schema.getSpecialNodesForGraph(filters);

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode)'),
        expect.objectContaining({
          keywords: ['testword'],
          minVotes: 0,
        }),
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('testword');
      expect(result[0].type).toBe('WordNode');
      expect(result[0].metadata.inclusionVotes).toBe(15);
    });

    it('should retrieve Category nodes when includeCategoryNodes is true', async () => {
      const mockCategoryRecords = [
        {
          get: (key: string) => {
            const data: any = {
              n: {
                properties: {
                  id: 'cat-1',
                  name: 'Test Category',
                  inclusionNetVotes: 20,
                  inclusionPositiveVotes: 22,
                  inclusionNegativeVotes: 2,
                  createdAt: '2024-01-01',
                },
              },
              hasDiscussion: false,
              keywords: ['keyword1', 'keyword2'],
              nodeType: 'CategoryNode',
            };
            return data[key];
          },
        },
      ];

      neo4jService.read.mockResolvedValue({
        records: mockCategoryRecords,
      } as any);

      const filters: GraphFilters = {
        categories: {
          mode: 'any',
          values: ['cat-1'],
        },
        includeCategoryNodes: true,
        minInclusionVotes: 10,
      };

      const result = await schema.getSpecialNodesForGraph(filters);

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (c:CategoryNode)'),
        expect.objectContaining({
          categoryIds: ['cat-1'],
          minVotes: 10,
        }),
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cat-1');
      expect(result[0].type).toBe('CategoryNode');
      expect(result[0].data.keywords).toEqual(['keyword1', 'keyword2']);
    });

    it('should return empty array when include flags are false', async () => {
      const filters: GraphFilters = {
        keywords: {
          mode: 'any',
          values: ['test'],
        },
        categories: {
          mode: 'any',
          values: ['cat-1'],
        },
        includeWordNodes: false,
        includeCategoryNodes: false,
      };

      const result = await schema.getSpecialNodesForGraph(filters);

      expect(neo4jService.read).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('getBulkNodesWithRelationships', () => {
    it('should retrieve bulk nodes with relationships', async () => {
      const mockRecords = [
        {
          get: (key: string) => {
            const data: any = {
              n: {
                properties: {
                  id: 'node-1',
                  text: 'Test node',
                  inclusionNetVotes: 10,
                  inclusionPositiveVotes: 10,
                  inclusionNegativeVotes: 0,
                  createdAt: '2024-01-01',
                },
              },
              hasDiscussion: true,
              categories: ['Category 1', 'Category 2'],
              keywords: ['keyword1', 'keyword2'],
              sharedTagConnections: [
                { nodeId: 'node-2', strength: 5, word: 'shared' },
              ],
              sharedCategoryConnections: [
                { nodeId: 'node-3', strength: 3, categoryId: 'cat-1' },
              ],
            };
            return data[key];
          },
        },
      ];

      neo4jService.read.mockResolvedValue({ records: mockRecords } as any);

      const result = await schema.getBulkNodesWithRelationships(
        ['node-1'],
        true,
      );

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n:TestNode)'),
        { nodeIds: ['node-1'] },
      );

      expect(result.size).toBe(1);
      expect(result.has('node-1')).toBe(true);

      const node = result.get('node-1')!;
      expect(node.id).toBe('node-1');
      expect(node.metadata.hasDiscussion).toBe(true);
    });

    it('should return empty map for empty nodeIds array', async () => {
      const result = await schema.getBulkNodesWithRelationships([]);

      expect(neo4jService.read).not.toHaveBeenCalled();
      expect(result.size).toBe(0);
    });

    it('should handle nodes without relationships when includeRelationships is false', async () => {
      const mockRecords = [
        {
          get: (key: string) => {
            const data: any = {
              n: {
                properties: {
                  id: 'node-1',
                  inclusionNetVotes: 10,
                  inclusionPositiveVotes: 10,
                  inclusionNegativeVotes: 0,
                  createdAt: '2024-01-01',
                },
              },
              hasDiscussion: false,
            };
            return data[key];
          },
        },
      ];

      neo4jService.read.mockResolvedValue({ records: mockRecords } as any);

      const result = await schema.getBulkNodesWithRelationships(
        ['node-1'],
        false,
      );

      const query = (neo4jService.read as jest.Mock).mock.calls[0][0];
      expect(query).not.toContain('OPTIONAL MATCH (n)-[:CATEGORIZED_AS]');
      expect(query).not.toContain('OPTIONAL MATCH (n)-[t:TAGGED]');

      expect(result.size).toBe(1);
    });
  });

  describe('getRelatedNodesByCategories', () => {
    it('should find nodes sharing categories', async () => {
      const mockRecords = [
        {
          get: (key: string) => {
            const data: any = {
              n: {
                properties: {
                  id: 'related-1',
                  text: 'Related node',
                  inclusionNetVotes: 15,
                },
              },
              sharedCategoryCount: 2,
            };
            return data[key];
          },
        },
      ];

      neo4jService.read.mockResolvedValue({ records: mockRecords } as any);

      const result = await schema.getRelatedNodesByCategories('node-1', 5);

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('CATEGORIZED_AS'),
        { nodeId: 'node-1', limit: 5 },
      );

      expect(result).toHaveLength(1);
      expect(result[0].node.id).toBe('related-1');
      expect(result[0].sharedCategoryCount).toBe(2);
    });
  });

  describe('getRelatedNodesByKeywords', () => {
    it('should find nodes sharing keywords', async () => {
      const mockRecords = [
        {
          get: (key: string) => {
            const data: any = {
              n: {
                properties: {
                  id: 'related-1',
                  text: 'Related node',
                  inclusionNetVotes: 12,
                },
              },
              sharedKeywords: ['keyword1', 'keyword2'],
              totalStrength: 8.5,
            };
            return data[key];
          },
        },
      ];

      neo4jService.read.mockResolvedValue({ records: mockRecords } as any);

      const result = await schema.getRelatedNodesByKeywords('node-1', 10);

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('SHARED_TAG'),
        { nodeId: 'node-1', limit: 10 },
      );

      expect(result).toHaveLength(1);
      expect(result[0].node.id).toBe('related-1');
      expect(result[0].sharedKeywords).toEqual(['keyword1', 'keyword2']);
      expect(result[0].totalStrength).toBe(8.5);
    });
  });
});
