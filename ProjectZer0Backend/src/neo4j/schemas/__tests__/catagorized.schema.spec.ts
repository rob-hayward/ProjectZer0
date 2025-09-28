// src/neo4j/schemas/__tests__/categorized.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  CategorizedNodeSchema,
  CategorizedNodeData,
} from '../base/categorized.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult } from '../vote.schema';
import { Record, Result, Integer, Node } from 'neo4j-driver';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';

// Test implementation of CategorizedNodeSchema
interface TestCategorizedNodeData extends CategorizedNodeData {
  title: string;
  content: string;
}

class TestCategorizedNodeSchema extends CategorizedNodeSchema<TestCategorizedNodeData> {
  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super('TestCategorizedNode', 'id', neo4jService, voteSchema);
  }

  protected supportsContentVoting(): boolean {
    return true;
  }

  protected mapNodeFromRecord(record: Record): TestCategorizedNodeData {
    const node = record.get('n') as Node;
    const props = node.properties;
    const keywords = record.get('keywords') || [];
    const categories = record.get('categories') || [];

    return {
      id: props.id,
      title: props.title,
      content: props.content,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      keywords: keywords.map((k: any) => ({
        word: k.word,
        frequency: k.frequency,
        source: k.source,
      })),
      categories: categories.map((c: any) => c.name || c),
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
    return {
      cypher: `
        MATCH (n:TestCategorizedNode {id: $id})
        SET n += $updateData, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData },
    };
  }

  // Expose protected methods for testing
  public async testCreateCategoryRelationships(
    nodeId: string,
    categories: string[],
  ): Promise<void> {
    return this.createCategoryRelationships(nodeId, categories);
  }

  public async testUpdateCategoryRelationships(
    nodeId: string,
    categories: string[],
  ): Promise<void> {
    return this.updateCategoryRelationships(nodeId, categories);
  }

  public async testValidateCategories(categories: string[]): Promise<void> {
    return this.validateCategories(categories);
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

  const mockCategories = ['technology', 'programming', 'testing'];

  const mockCategorizedNodeData: TestCategorizedNodeData = {
    id: 'categorized-123',
    title: 'Test Categorized Node',
    content: 'This is a test node with categories and keywords',
    createdBy: 'user-456',
    publicCredit: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
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
    // Create mocks
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

  describe('Categorization Operations', () => {
    describe('validateCategories', () => {
      it('should validate categories exist and pass inclusion threshold', async () => {
        // Mock successful category validation
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(3)),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        await expect(
          testSchema.testValidateCategories(mockCategories),
        ).resolves.not.toThrow();

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (c:CategoryNode)'),
          expect.objectContaining({
            categories: mockCategories,
          }),
        );
      });

      it('should throw when category does not exist or fails threshold', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(2)), // Only 2 of 3 found
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        await expect(
          testSchema.testValidateCategories(mockCategories),
        ).rejects.toThrow(
          'Some categories do not exist or have not passed inclusion threshold',
        );
      });

      it('should handle empty categories array', async () => {
        await expect(
          testSchema.testValidateCategories([]),
        ).resolves.not.toThrow();

        expect(neo4jService.read).not.toHaveBeenCalled();
      });

      it('should enforce maximum category limit', async () => {
        const tooManyCategories = ['cat1', 'cat2', 'cat3', 'cat4'];

        await expect(
          testSchema.testValidateCategories(tooManyCategories),
        ).rejects.toThrow('Maximum 3 categories allowed');
      });
    });

    describe('createCategoryRelationships', () => {
      it('should create CATEGORIZED_AS and SHARED_CATEGORY relationships', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.testCreateCategoryRelationships(
          'categorized-123',
          mockCategories,
        );

        // Should validate categories first
        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (c:CategoryNode)'),
          expect.objectContaining({
            categories: mockCategories,
          }),
        );

        // Should create CATEGORIZED_AS relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('UNWIND $categories AS catName'),
          expect.objectContaining({
            nodeId: 'categorized-123',
            categories: mockCategories,
          }),
        );

        // Should create SHARED_CATEGORY relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('SHARED_CATEGORY'),
          expect.objectContaining({
            nodeId: 'categorized-123',
            nodeType: 'TestCategorizedNode',
          }),
        );
      });

      it('should handle empty categories', async () => {
        await testSchema.testCreateCategoryRelationships('categorized-123', []);

        expect(neo4jService.read).not.toHaveBeenCalled();
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });

    describe('updateCategoryRelationships', () => {
      it('should delete old and create new category relationships', async () => {
        // Mock category validation
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(3)),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.testUpdateCategoryRelationships(
          'categorized-123',
          mockCategories,
        );

        // Should delete old relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE r'),
          expect.objectContaining({ nodeId: 'categorized-123' }),
        );

        // Should create new relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('UNWIND $categories AS catName'),
          expect.objectContaining({
            nodeId: 'categorized-123',
            categories: mockCategories,
          }),
        );
      });
    });

    describe('findByCategory', () => {
      it('should find nodes by category', async () => {
        const mockNode: Node = {
          identity: Integer.fromNumber(1),
          labels: ['TestCategorizedNode'],
          properties: mockCategorizedNodeData,
          elementId: 'test-element-id',
        } as Node;

        const mockRecords = [
          {
            get: jest.fn().mockImplementation((field) => {
              if (field === 'n') return mockNode;
              if (field === 'keywords') return mockKeywords;
              if (field === 'categories') return mockCategories;
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await testSchema.findByCategory('technology');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (n:TestCategorizedNode)-[:CATEGORIZED_AS]->(c:CategoryNode {name: $category})',
          ),
          expect.objectContaining({
            category: 'technology',
            skip: 0,
            limit: 50,
          }),
        );
        expect(result).toHaveLength(1);
        expect(result[0].categories).toEqual(mockCategories);
      });

      it('should handle pagination', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await testSchema.findByCategory('technology', 10, 20);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            category: 'technology',
            skip: 10,
            limit: 20,
          }),
        );
      });

      it('should validate category input', async () => {
        await expect(testSchema.findByCategory('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('findBySharedCategories', () => {
      it('should find nodes that share categories', async () => {
        const mockNode: Node = {
          identity: Integer.fromNumber(1),
          labels: ['TestCategorizedNode'],
          properties: mockCategorizedNodeData,
          elementId: 'test-element-id',
        } as Node;

        const mockRecords = [
          {
            get: jest.fn().mockImplementation((field) => {
              if (field === 'related') return mockNode;
              if (field === 'sharedCategories')
                return ['technology', 'programming'];
              if (field === 'categoryCount') return Integer.fromNumber(2);
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result =
          await testSchema.findBySharedCategories('categorized-123');

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
        expect(result[0].sharedCategories).toEqual([
          'technology',
          'programming',
        ]);
        expect(result[0].categoryCount).toBe(2);
      });
    });

    describe('getPopularCategories', () => {
      it('should get popular categories for the node type', async () => {
        const mockRecords = [
          {
            get: jest.fn().mockImplementation((field) => {
              if (field === 'category') return 'technology';
              if (field === 'count') return Integer.fromNumber(15);
              return null;
            }),
          },
          {
            get: jest.fn().mockImplementation((field) => {
              if (field === 'category') return 'programming';
              if (field === 'count') return Integer.fromNumber(12);
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await testSchema.getPopularCategories();

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (n:TestCategorizedNode)-[:CATEGORIZED_AS]->(c:CategoryNode)',
          ),
          expect.objectContaining({ limit: 10 }),
        );
        expect(result).toEqual([
          { category: 'technology', count: 15 },
          { category: 'programming', count: 12 },
        ]);
      });
    });
  });

  describe('Inherited Operations', () => {
    it('should inherit all TaggedNodeSchema operations', async () => {
      // Check methods are available
      expect(typeof testSchema.findByKeyword).toBe('function');
      expect(typeof testSchema.findBySharedTags).toBe('function');
      expect(typeof testSchema.getPopularKeywords).toBe('function');
    });

    it('should inherit all BaseNodeSchema operations', async () => {
      // Check methods are available
      expect(typeof testSchema.findById).toBe('function');
      expect(typeof testSchema.findAll).toBe('function');
      expect(typeof testSchema.delete).toBe('function');
      expect(typeof testSchema.voteInclusion).toBe('function');
      expect(typeof testSchema.voteContent).toBe('function');
    });
  });

  describe('CategorizedNodeData Interface Compliance', () => {
    it('should include all required fields', () => {
      const requiredFields = [
        'id',
        'createdBy',
        'publicCredit',
        'createdAt',
        'updatedAt',
        'keywords',
        'categories',
        'inclusionPositiveVotes',
        'inclusionNegativeVotes',
        'inclusionNetVotes',
        'contentPositiveVotes',
        'contentNegativeVotes',
        'contentNetVotes',
        'discussionId',
      ];

      requiredFields.forEach((field) => {
        expect(mockCategorizedNodeData).toHaveProperty(field);
      });
    });

    it('should properly structure categories', () => {
      expect(Array.isArray(mockCategorizedNodeData.categories)).toBe(true);
      expect(mockCategorizedNodeData.categories).toHaveLength(3);
      mockCategorizedNodeData.categories.forEach((category) => {
        expect(typeof category).toBe('string');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in category operations', async () => {
      neo4jService.write.mockRejectedValue(new Error('Connection failed'));

      await expect(
        testSchema.testCreateCategoryRelationships(
          'categorized-123',
          mockCategories,
        ),
      ).rejects.toThrow();
    });

    it('should validate node ID in category operations', async () => {
      await expect(
        testSchema.testCreateCategoryRelationships('', mockCategories),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
