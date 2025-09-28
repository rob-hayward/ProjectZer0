// src/neo4j/schemas/__tests__/tagged.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TaggedNodeSchema, TaggedNodeData } from '../base/tagged-node.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';

// Test implementation of TaggedNodeSchema
interface TestTaggedNodeData extends TaggedNodeData {
  title: string;
  content: string;
}

class TestTaggedNodeSchema extends TaggedNodeSchema<TestTaggedNodeData> {
  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super('TestTaggedNode', 'id', neo4jService, voteSchema);
  }

  protected supportsContentVoting(): boolean {
    return true;
  }

  protected mapNodeFromRecord(record: Record): TestTaggedNodeData {
    const node = record.get('n') as Node;
    const props = node.properties;
    const keywords = record.get('keywords') || [];

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
    updateData: Partial<TestTaggedNodeData>,
  ): { cypher: string; params: any } {
    return {
      cypher: `
        MATCH (n:TestTaggedNode {id: $id})
        SET n += $updateData, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData },
    };
  }

  // Expose protected methods for testing
  public async testCreateKeywordRelationships(
    nodeId: string,
    keywords: KeywordWithFrequency[],
  ): Promise<void> {
    return this.createKeywordRelationships(nodeId, keywords);
  }

  public async testUpdateKeywordRelationships(
    nodeId: string,
    keywords: KeywordWithFrequency[],
  ): Promise<void> {
    return this.updateKeywordRelationships(nodeId, keywords);
  }
}

describe('TaggedNodeSchema', () => {
  let testSchema: TestTaggedNodeSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  const mockKeywords: KeywordWithFrequency[] = [
    { word: 'test', frequency: 2, source: 'ai' },
    { word: 'node', frequency: 1, source: 'user' },
    { word: 'schema', frequency: 1, source: 'ai' },
  ];

  const mockTaggedNodeData: TestTaggedNodeData = {
    id: 'tagged-123',
    title: 'Test Tagged Node',
    content: 'This is a test node with keywords',
    createdBy: 'user-456',
    publicCredit: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    keywords: mockKeywords,
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

    testSchema = new TestTaggedNodeSchema(neo4jService, voteSchema);
  });

  describe('Tagging Operations', () => {
    describe('createKeywordRelationships', () => {
      it('should create TAGGED and SHARED_TAG relationships', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.testCreateKeywordRelationships(
          'tagged-123',
          mockKeywords,
        );

        // Should create TAGGED relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('UNWIND $keywords AS keyword'),
          expect.objectContaining({
            nodeId: 'tagged-123',
            keywords: mockKeywords,
          }),
        );

        // Should create SHARED_TAG relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('SHARED_TAG'),
          expect.objectContaining({
            nodeId: 'tagged-123',
            nodeType: 'TestTaggedNode',
          }),
        );
      });

      it('should handle empty keywords array', async () => {
        await testSchema.testCreateKeywordRelationships('tagged-123', []);

        // Should still be called but with empty keywords
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            nodeId: 'tagged-123',
            keywords: [],
          }),
        );
      });

      it('should validate keywords', async () => {
        const invalidKeywords = [
          { word: '', frequency: 1, source: 'ai' },
        ] as KeywordWithFrequency[];

        await expect(
          testSchema.testCreateKeywordRelationships(
            'tagged-123',
            invalidKeywords,
          ),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('updateKeywordRelationships', () => {
      it('should delete old and create new keyword relationships', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.testUpdateKeywordRelationships(
          'tagged-123',
          mockKeywords,
        );

        // Should delete old relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE r'),
          expect.objectContaining({ nodeId: 'tagged-123' }),
        );

        // Should create new relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('UNWIND $keywords AS keyword'),
          expect.objectContaining({
            nodeId: 'tagged-123',
            keywords: mockKeywords,
          }),
        );
      });
    });

    describe('findByKeyword', () => {
      it('should find nodes by keyword', async () => {
        const mockNode: Node = {
          identity: Integer.fromNumber(1),
          labels: ['TestTaggedNode'],
          properties: mockTaggedNodeData,
          elementId: 'test-element-id',
        } as Node;

        const mockRecords = [
          {
            get: jest.fn().mockImplementation((field) => {
              if (field === 'n') return mockNode;
              if (field === 'keywords') return mockKeywords;
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await testSchema.findByKeyword('test');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (n:TestTaggedNode)-[:TAGGED]->(w:WordNode {word: $keyword})',
          ),
          expect.objectContaining({
            keyword: 'test',
            skip: 0,
            limit: 50,
          }),
        );
        expect(result).toHaveLength(1);
        expect(result[0].keywords).toEqual(mockKeywords);
      });

      it('should handle pagination', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await testSchema.findByKeyword('test', 10, 20);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            keyword: 'test',
            skip: 10,
            limit: 20,
          }),
        );
      });

      it('should validate keyword input', async () => {
        await expect(testSchema.findByKeyword('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('findBySharedTags', () => {
      it('should find nodes that share tags with given node', async () => {
        const mockNode: Node = {
          identity: Integer.fromNumber(1),
          labels: ['TestTaggedNode'],
          properties: mockTaggedNodeData,
          elementId: 'test-element-id',
        } as Node;

        const mockRecords = [
          {
            get: jest.fn().mockImplementation((field) => {
              if (field === 'related') return mockNode;
              if (field === 'sharedTags') return ['test', 'node'];
              if (field === 'tagCount') return Integer.fromNumber(2);
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await testSchema.findBySharedTags('tagged-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:TestTaggedNode {id: $nodeId})'),
          expect.objectContaining({
            nodeId: 'tagged-123',
            limit: 10,
          }),
        );
        expect(result).toHaveLength(1);
        expect(result[0].sharedTags).toEqual(['test', 'node']);
        expect(result[0].tagCount).toBe(2);
      });

      it('should limit results', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await testSchema.findBySharedTags('tagged-123', 5);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            nodeId: 'tagged-123',
            limit: 5,
          }),
        );
      });
    });

    describe('getPopularKeywords', () => {
      it('should get popular keywords for the node type', async () => {
        const mockRecords = [
          {
            get: jest.fn().mockImplementation((field) => {
              if (field === 'keyword') return 'test';
              if (field === 'count') return Integer.fromNumber(10);
              return null;
            }),
          },
          {
            get: jest.fn().mockImplementation((field) => {
              if (field === 'keyword') return 'node';
              if (field === 'count') return Integer.fromNumber(8);
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await testSchema.getPopularKeywords();

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (n:TestTaggedNode)-[:TAGGED]->(w:WordNode)',
          ),
          expect.objectContaining({ limit: 20 }),
        );
        expect(result).toEqual([
          { keyword: 'test', count: 10 },
          { keyword: 'node', count: 8 },
        ]);
      });

      it('should limit results', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await testSchema.getPopularKeywords(5);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ limit: 5 }),
        );
      });
    });
  });

  describe('Inherited CRUD Operations', () => {
    it('should inherit findById from BaseNodeSchema', async () => {
      const mockNode: Node = {
        identity: Integer.fromNumber(1),
        labels: ['TestTaggedNode'],
        properties: mockTaggedNodeData,
        elementId: 'test-element-id',
      } as Node;

      const mockRecord = {
        get: jest.fn().mockImplementation((field) => {
          if (field === 'n') return mockNode;
          if (field === 'keywords') return mockKeywords;
          return null;
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await testSchema.findById('tagged-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n:TestTaggedNode {id: $id})'),
        { id: 'tagged-123' },
      );
      expect(result).toEqual(mockTaggedNodeData);
    });

    it('should inherit voting operations from BaseNodeSchema', async () => {
      const mockVoteResult: VoteResult = {
        positiveVotes: 10,
        negativeVotes: 3,
        netVotes: 7,
        userVote: 'positive',
        voteStatus: 'completed',
      };

      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await testSchema.voteInclusion(
        'tagged-123',
        'user-456',
        true,
      );

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'TestTaggedNode',
        { id: 'tagged-123' },
        'user-456',
        true,
        'INCLUSION',
      );
      expect(result).toEqual(mockVoteResult);
    });
  });

  describe('TaggedNodeData Interface Compliance', () => {
    it('should include all required fields', () => {
      const requiredFields = [
        'id',
        'createdBy',
        'publicCredit',
        'createdAt',
        'updatedAt',
        'keywords',
        'inclusionPositiveVotes',
        'inclusionNegativeVotes',
        'inclusionNetVotes',
        'contentPositiveVotes',
        'contentNegativeVotes',
        'contentNetVotes',
        'discussionId',
      ];

      requiredFields.forEach((field) => {
        expect(mockTaggedNodeData).toHaveProperty(field);
      });
    });

    it('should properly structure keywords', () => {
      expect(Array.isArray(mockTaggedNodeData.keywords)).toBe(true);
      mockTaggedNodeData.keywords.forEach((keyword) => {
        expect(keyword).toHaveProperty('word');
        expect(keyword).toHaveProperty('frequency');
        expect(keyword).toHaveProperty('source');
        expect(['ai', 'user']).toContain(keyword.source);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in keyword operations', async () => {
      neo4jService.write.mockRejectedValue(new Error('Connection failed'));

      await expect(
        testSchema.testCreateKeywordRelationships('tagged-123', mockKeywords),
      ).rejects.toThrow(
        'Failed to create keyword relationships TestTaggedNode: Connection failed',
      );
    });

    it('should validate node ID in keyword operations', async () => {
      await expect(
        testSchema.testCreateKeywordRelationships('', mockKeywords),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle errors in finding by keyword', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query failed'));

      await expect(testSchema.findByKeyword('test')).rejects.toThrow(
        'Failed to find by keyword TestTaggedNode: Query failed',
      );
    });

    it('should handle errors in finding shared tags', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query failed'));

      await expect(testSchema.findBySharedTags('tagged-123')).rejects.toThrow(
        'Failed to find by shared tags TestTaggedNode: Query failed',
      );
    });
  });

  describe('Integration with BaseNodeSchema', () => {
    it('should properly extend BaseNodeSchema functionality', () => {
      // Check that the schema is an instance of TaggedNodeSchema
      expect(testSchema).toBeInstanceOf(TestTaggedNodeSchema);

      // Check that inherited methods are available
      expect(typeof testSchema.findById).toBe('function');
      expect(typeof testSchema.findAll).toBe('function');
      expect(typeof testSchema.delete).toBe('function');
      expect(typeof testSchema.voteInclusion).toBe('function');
      expect(typeof testSchema.voteContent).toBe('function');

      // Check that new methods are available
      expect(typeof testSchema.findByKeyword).toBe('function');
      expect(typeof testSchema.findBySharedTags).toBe('function');
      expect(typeof testSchema.getPopularKeywords).toBe('function');
    });

    it('should use correct node label in all operations', async () => {
      // Test findById
      neo4jService.read.mockResolvedValue({ records: [] } as unknown as Result);
      await testSchema.findById('test-id');
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('TestTaggedNode'),
        expect.any(Object),
      );

      // Test findByKeyword
      neo4jService.read.mockResolvedValue({ records: [] } as unknown as Result);
      await testSchema.findByKeyword('test');
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('TestTaggedNode'),
        expect.any(Object),
      );

      // Test voting
      voteSchema.vote.mockResolvedValue({} as VoteResult);
      await testSchema.voteInclusion('test-id', 'user-id', true);
      expect(voteSchema.vote).toHaveBeenCalledWith(
        'TestTaggedNode',
        expect.any(Object),
        expect.any(String),
        expect.any(Boolean),
        expect.any(String),
      );
    });
  });
});
