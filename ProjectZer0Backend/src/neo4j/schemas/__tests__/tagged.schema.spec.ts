// src/neo4j/schemas/__tests__/tagged.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TaggedNodeSchema, TaggedNodeData } from '../base/tagged.schema';
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
  protected nodeLabel = 'TestTaggedNode';
  protected idField = 'id';

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, 'TestTaggedNodeSchema');
  }

  protected supportsContentVoting(): boolean {
    return true;
  }

  protected mapNodeFromRecord(record: Record): TestTaggedNodeData {
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
    // Remove keywords from node updates as they're handled separately
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { keywords, ...nodeUpdates } = updateData;

    return {
      cypher: `
        MATCH (n:TestTaggedNode {id: $id})
        SET n += $updateData, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: nodeUpdates },
    };
  }

  // Expose protected methods for testing
  public async testAttachKeywords(
    nodeId: string,
    keywords: KeywordWithFrequency[],
  ): Promise<void> {
    return this.attachKeywords(nodeId, keywords);
  }

  public async testCreateSharedTagRelationships(
    nodeId: string,
    nodeLabel?: string,
  ): Promise<void> {
    return this.createSharedTagRelationships(nodeId, nodeLabel);
  }

  public testBuildTaggedCreateQuery(data: any) {
    return this.buildTaggedCreateQuery(data);
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
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
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

  describe('Keyword Operations', () => {
    describe('attachKeywords', () => {
      it('should create TAGGED relationships', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.testAttachKeywords('tagged-123', mockKeywords);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('UNWIND $keywords as keyword'),
          expect.objectContaining({
            nodeId: 'tagged-123',
            keywords: mockKeywords,
          }),
        );

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('WHERE w.inclusionNetVotes > 0'),
          expect.any(Object),
        );
      });

      it('should handle empty keywords array', async () => {
        await testSchema.testAttachKeywords('tagged-123', []);

        // Should not call write for empty keywords
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should validate keyword existence and inclusion threshold', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.testAttachKeywords('tagged-123', mockKeywords);

        // Should only create relationships for WordNodes that passed inclusion
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (w:WordNode {word: keyword.word})'),
          expect.any(Object),
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('WHERE w.inclusionNetVotes > 0'),
          expect.any(Object),
        );
      });
    });

    describe('createSharedTagRelationships', () => {
      it('should create SHARED_TAG relationships', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.testCreateSharedTagRelationships('tagged-123');

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('SHARED_TAG'),
          expect.objectContaining({
            nodeId: 'tagged-123',
          }),
        );
      });

      it('should optionally filter by node label', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.testCreateSharedTagRelationships(
          'tagged-123',
          'TestTaggedNode',
        );

        expect(neo4jService.write).toHaveBeenCalled();
      });
    });

    describe('getKeywords', () => {
      it('should retrieve keywords for a node', async () => {
        const mockRecords = mockKeywords.map((keyword) => ({
          get: jest.fn((field: string) => {
            if (field === 'word') return keyword.word;
            if (field === 'frequency')
              return Integer.fromNumber(keyword.frequency);
            if (field === 'source') return keyword.source;
            return null;
          }),
        })) as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await testSchema.getKeywords('tagged-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:TestTaggedNode {id: $nodeId})'),
          expect.objectContaining({ nodeId: 'tagged-123' }),
        );

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({
          word: 'test',
          frequency: 2,
          source: 'ai',
        });
      });

      it('should validate node ID', async () => {
        await expect(testSchema.getKeywords('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });

      it('should return empty array when node has no keywords', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await testSchema.getKeywords('tagged-123');

        expect(result).toEqual([]);
      });
    });

    describe('findRelatedByTags', () => {
      it('should find nodes that share tags', async () => {
        const mockRecords = [
          {
            get: jest.fn((field: string) => {
              if (field === 'nodeId') return 'related-1';
              if (field === 'sharedWords') return ['test', 'node'];
              if (field === 'strength') return Integer.fromNumber(10);
              return null;
            }),
          },
          {
            get: jest.fn((field: string) => {
              if (field === 'nodeId') return 'related-2';
              if (field === 'sharedWords') return ['test'];
              if (field === 'strength') return Integer.fromNumber(5);
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await testSchema.findRelatedByTags('tagged-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:TestTaggedNode {id: $nodeId})'),
          expect.objectContaining({
            nodeId: 'tagged-123',
            limit: 10,
          }),
        );

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          nodeId: 'related-1',
          sharedWords: ['test', 'node'],
          strength: 10,
        });
        expect(result[1]).toEqual({
          nodeId: 'related-2',
          sharedWords: ['test'],
          strength: 5,
        });
      });

      it('should respect limit parameter', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await testSchema.findRelatedByTags('tagged-123', 5);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            nodeId: 'tagged-123',
            limit: 5,
          }),
        );
      });

      it('should validate node ID', async () => {
        await expect(testSchema.findRelatedByTags('')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should return empty array when no related nodes found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await testSchema.findRelatedByTags('tagged-123');

        expect(result).toEqual([]);
      });
    });

    describe('updateKeywords', () => {
      it('should delete old and create new keyword relationships', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.updateKeywords('tagged-123', mockKeywords);

        // Should delete old TAGGED relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n)-[t:TAGGED]->()'),
          expect.objectContaining({ nodeId: 'tagged-123' }),
        );

        // Should delete old SHARED_TAG relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n)-[st:SHARED_TAG]-()'),
          expect.objectContaining({ nodeId: 'tagged-123' }),
        );

        // Should create new relationships
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('UNWIND $keywords as keyword'),
          expect.objectContaining({
            nodeId: 'tagged-123',
            keywords: mockKeywords,
          }),
        );
      });

      it('should handle empty keywords array', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await testSchema.updateKeywords('tagged-123', []);

        // Should still delete old relationships
        expect(neo4jService.write).toHaveBeenCalledTimes(2); // Delete TAGGED and SHARED_TAG
      });

      it('should validate node ID', async () => {
        await expect(
          testSchema.updateKeywords('', mockKeywords),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('Query Building', () => {
    describe('buildTaggedCreateQuery', () => {
      it('should build query with keywords', () => {
        const createData = {
          id: 'new-123',
          createdBy: 'user-456',
          publicCredit: true,
          keywords: mockKeywords,
          nodeProperties: {
            title: 'Test Title',
            content: 'Test Content',
          },
        };

        const result = testSchema.testBuildTaggedCreateQuery(createData);

        expect(result.cypher).toContain('TestTaggedNode');
        expect(result.cypher).toContain('UNWIND $keywords');
        expect(result.cypher).toContain('SHARED_TAG');
        expect(result.params).toEqual(
          expect.objectContaining({
            id: 'new-123',
            createdBy: 'user-456',
            publicCredit: true,
            keywords: mockKeywords,
            title: 'Test Title',
            content: 'Test Content',
          }),
        );
      });

      it('should build query without keywords', () => {
        const createData = {
          id: 'new-123',
          createdBy: 'user-456',
          publicCredit: true,
          nodeProperties: {
            title: 'Test Title',
            content: 'Test Content',
          },
        };

        const result = testSchema.testBuildTaggedCreateQuery(createData);

        expect(result.cypher).toContain('TestTaggedNode');
        expect(result.cypher).not.toContain('UNWIND $keywords');
        expect(result.params.keywords).toBeUndefined();
      });

      it('should handle parent relationships', () => {
        const createData = {
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

        const result = testSchema.testBuildTaggedCreateQuery(createData);

        expect(result.cypher).toContain('MATCH (parent:ParentNode');
        expect(result.cypher).toContain('CREATE (n)-[:CHILD_OF]->(parent)');
        expect(result.params.parentId).toBe('parent-456');
      });
    });
  });

  describe('Inherited Functionality from BaseNodeSchema', () => {
    it('should inherit findById', async () => {
      const mockNode = {
        properties: mockTaggedNodeData,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue(mockNode),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await testSchema.findById('tagged-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n:TestTaggedNode {id: $id})'),
        { id: 'tagged-123' },
      );
      expect(result).toBeDefined();
      expect(result?.id).toBe('tagged-123');
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

    it('should inherit delete operation', async () => {
      const countRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [countRecord],
      } as unknown as Result);
      neo4jService.write.mockResolvedValue({} as any);

      const result = await testSchema.delete('tagged-123');

      expect(result).toEqual({ success: true });
    });
  });

  describe('TaggedNodeData Interface Compliance', () => {
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
        expect(mockTaggedNodeData).toHaveProperty(field);
      });
    });

    it('should include keywords field', () => {
      expect(mockTaggedNodeData).toHaveProperty('keywords');
      expect(Array.isArray(mockTaggedNodeData.keywords)).toBe(true);
    });

    it('should properly structure keywords', () => {
      mockTaggedNodeData.keywords?.forEach((keyword) => {
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
        testSchema.testAttachKeywords('tagged-123', mockKeywords),
      ).rejects.toThrow('Connection failed');
    });

    it('should validate node ID in all operations', async () => {
      await expect(testSchema.getKeywords('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(testSchema.findRelatedByTags('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(testSchema.updateKeywords('', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle errors in findRelatedByTags', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query failed'));

      await expect(testSchema.findRelatedByTags('tagged-123')).rejects.toThrow(
        'Query failed',
      );
    });
  });

  describe('Integration with Inheritance Chain', () => {
    it('should properly extend BaseNodeSchema', () => {
      expect(testSchema).toBeInstanceOf(TestTaggedNodeSchema);

      // Check BaseNodeSchema methods are available
      expect(typeof testSchema.findById).toBe('function');
      expect(typeof testSchema.update).toBe('function');
      expect(typeof testSchema.delete).toBe('function');
      expect(typeof testSchema.voteInclusion).toBe('function');
      expect(typeof testSchema.voteContent).toBe('function');
    });

    it('should add TaggedNodeSchema methods', () => {
      // Check TaggedNodeSchema methods are available
      expect(typeof testSchema.getKeywords).toBe('function');
      expect(typeof testSchema.findRelatedByTags).toBe('function');
      expect(typeof testSchema.updateKeywords).toBe('function');
    });

    it('should use correct node label in all operations', async () => {
      neo4jService.read.mockResolvedValue({ records: [] } as unknown as Result);

      await testSchema.findById('test-id');
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('TestTaggedNode'),
        expect.any(Object),
      );

      await testSchema.getKeywords('test-id').catch(() => {});
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('TestTaggedNode'),
        expect.any(Object),
      );
    });
  });
});
