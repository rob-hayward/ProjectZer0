// src/neo4j/schemas/__tests__/base-node.schema.spec.ts - UPDATED

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BaseNodeSchema, BaseNodeData } from '../base-node.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';

// Test implementation of BaseNodeSchema
interface TestNodeData extends BaseNodeData {
  name: string;
  description?: string;
}

interface TestWordData extends BaseNodeData {
  word: string;
  definition?: string;
}

class TestNodeSchema extends BaseNodeSchema<TestNodeData> {
  protected readonly nodeLabel = 'TestNode';
  protected readonly idField = 'id';

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, 'TestNode');
  }

  protected supportsContentVoting(): boolean {
    return true; // Supports both inclusion and content voting
  }

  protected mapNodeFromRecord(record: Record): TestNodeData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      name: props.name,
      description: props.description,
      discussionId: props.discussionId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      contentPositiveVotes: this.toNumber(props.contentPositiveVotes),
      contentNegativeVotes: this.toNumber(props.contentNegativeVotes),
      contentNetVotes: this.toNumber(props.contentNetVotes),
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<TestNodeData>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'id')
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:TestNode {id: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: data },
    };
  }
}

class TestWordLikeSchema extends BaseNodeSchema<TestWordData> {
  protected readonly nodeLabel = 'TestWordNode';
  protected readonly idField = 'word'; // Uses word as identifier, not id

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, 'TestWordNode');
  }

  protected supportsContentVoting(): boolean {
    return false; // Inclusion voting only, like WordNode
  }

  protected mapNodeFromRecord(record: Record): TestWordData {
    const props = record.get('n').properties;
    return {
      id: props.word, // Use word as id
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      word: props.word,
      definition: props.definition,
      discussionId: props.discussionId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      contentPositiveVotes: 0, // Always 0 for inclusion-only nodes
      contentNegativeVotes: 0,
      contentNetVotes: 0,
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<TestWordData>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'word' && key !== 'id')
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:TestWordNode {word: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: data },
    };
  }
}

describe('BaseNodeSchema', () => {
  let testSchema: TestNodeSchema;
  let wordLikeSchema: TestWordLikeSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  const mockTestNodeData: TestNodeData = {
    id: 'test-123',
    createdBy: 'user-789',
    publicCredit: true,
    name: 'Test Node',
    description: 'A test node',
    createdAt: new Date(),
    updatedAt: new Date(),
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentPositiveVotes: 8,
    contentNegativeVotes: 1,
    contentNetVotes: 7,
    discussionId: 'discussion-456',
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 6,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 4,
    contentPositiveVotes: 9,
    contentNegativeVotes: 1,
    contentNetVotes: 8,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 6,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 4,
    contentStatus: 'agree',
    contentPositiveVotes: 9,
    contentNegativeVotes: 1,
    contentNetVotes: 8,
  };

  beforeEach(async () => {
    neo4jService = {
      read: jest.fn(),
      write: jest.fn(),
    } as any;

    voteSchema = {
      vote: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: Neo4jService, useValue: neo4jService },
        { provide: VoteSchema, useValue: voteSchema },
      ],
    }).compile();

    testSchema = new TestNodeSchema(
      module.get<Neo4jService>(Neo4jService),
      module.get<VoteSchema>(VoteSchema),
    );

    wordLikeSchema = new TestWordLikeSchema(
      module.get<Neo4jService>(Neo4jService),
      module.get<VoteSchema>(VoteSchema),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    describe('validateId', () => {
      it('should pass for valid IDs', () => {
        expect(() => (testSchema as any).validateId('test-123')).not.toThrow();
        expect(() => (testSchema as any).validateId('valid-id')).not.toThrow();
      });

      it('should throw BadRequestException for invalid IDs', () => {
        expect(() => (testSchema as any).validateId('')).toThrow(
          BadRequestException,
        );
        expect(() => (testSchema as any).validateId(null)).toThrow(
          BadRequestException,
        );
        expect(() => (testSchema as any).validateId(undefined)).toThrow(
          BadRequestException,
        );
        expect(() => (testSchema as any).validateId('   ')).toThrow(
          BadRequestException,
        );
      });
    });

    describe('validateUserId', () => {
      it('should pass for valid user IDs', () => {
        expect(() =>
          (testSchema as any).validateUserId('user-123'),
        ).not.toThrow();
      });

      it('should throw BadRequestException for invalid user IDs', () => {
        expect(() => (testSchema as any).validateUserId('')).toThrow(
          BadRequestException,
        );
        expect(() => (testSchema as any).validateUserId(null)).toThrow(
          BadRequestException,
        );
      });
    });
  });

  describe('CRUD Operations', () => {
    describe('findById', () => {
      it('should find node by ID for standard nodes', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockTestNodeData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await testSchema.findById('test-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (n:TestNode {id: $id}) RETURN n',
          { id: 'test-123' },
        );
        expect(result).toEqual(mockTestNodeData);
      });

      it('should find node by word field for word-like nodes', async () => {
        const mockWordData = {
          ...mockTestNodeData,
          word: 'test-word',
        };
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockWordData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        await wordLikeSchema.findById('test-word');

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (n:TestWordNode {word: $id}) RETURN n',
          { id: 'test-word' },
        );
      });

      it('should return null when node not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await testSchema.findById('nonexistent');

        expect(result).toBeNull();
      });

      it('should handle database errors', async () => {
        neo4jService.read.mockRejectedValue(new Error('Database error'));

        await expect(testSchema.findById('test-123')).rejects.toThrow(
          'Failed to find Test: Database error',
        );
      });
    });

    describe('update', () => {
      it('should update node successfully', async () => {
        const updateData = { name: 'Updated Name', publicCredit: false };
        const updatedNode = { ...mockTestNodeData, ...updateData };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedNode }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await testSchema.update('test-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:TestNode {id: $id})'),
          expect.objectContaining({ id: 'test-123', updateData }),
        );
        expect(result).toEqual(updatedNode);
      });

      it('should throw NotFoundException when node not found for update', async () => {
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(
          testSchema.update('nonexistent', { name: 'New Name' }),
        ).rejects.toThrow("Test with id 'nonexistent' not found");
      });
    });

    describe('delete', () => {
      it('should delete existing node', async () => {
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValueOnce({
          records: [existsRecord],
        } as unknown as Result);
        neo4jService.write.mockResolvedValue({} as Result);

        const result = await testSchema.delete('test-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (n:TestNode {id: $id}) RETURN COUNT(n) as count',
          { id: 'test-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:TestNode {id: $id})'),
          { id: 'test-123' },
        );
        expect(result).toEqual({ success: true });
      });

      it('should throw NotFoundException when deleting non-existent node', async () => {
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(0)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

        await expect(testSchema.delete('nonexistent')).rejects.toThrow(
          "Test with id 'nonexistent' not found",
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });
  });

  describe('Voting Operations', () => {
    describe('voteInclusion', () => {
      it('should vote on inclusion successfully', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await testSchema.voteInclusion(
          'test-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-123' },
          'user-456',
          true,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate inputs', async () => {
        await expect(
          testSchema.voteInclusion('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(
          testSchema.voteInclusion('test-123', '', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should work with word-like schemas', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        await wordLikeSchema.voteInclusion('test-word', 'user-456', false);

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'TestWordNode',
          { word: 'test-word' },
          'user-456',
          false,
          'INCLUSION',
        );
      });
    });

    describe('voteContent', () => {
      it('should vote on content when supported', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await testSchema.voteContent(
          'test-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-123' },
          'user-456',
          true,
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should reject content voting when not supported', async () => {
        await expect(
          wordLikeSchema.voteContent('test-word', 'user-456', true),
        ).rejects.toThrow('Testword does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should validate inputs', async () => {
        await expect(
          testSchema.voteContent('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(
          testSchema.voteContent('test-123', '', true),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('removeVote', () => {
      it('should remove inclusion vote successfully', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await testSchema.removeVote(
          'test-123',
          'user-456',
          'INCLUSION',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-123' },
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should remove content vote successfully', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await testSchema.removeVote(
          'test-123',
          'user-456',
          'CONTENT',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-123' },
          'user-456',
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate inputs', async () => {
        await expect(
          testSchema.removeVote('', 'user-456', 'INCLUSION'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          testSchema.removeVote('test-123', '', 'INCLUSION'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getVotes', () => {
      it('should get aggregated votes for content-supporting nodes', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await testSchema.getVotes('test-123');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-123' },
          '',
        );
        expect(result).toEqual({
          inclusionPositiveVotes: 6,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 4,
          contentPositiveVotes: 9,
          contentNegativeVotes: 1,
          contentNetVotes: 8,
        });
      });

      it('should return zero content votes for non-content-supporting nodes', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await wordLikeSchema.getVotes('test-word');

        expect(result).toEqual({
          inclusionPositiveVotes: 6,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 4,
          contentPositiveVotes: 0, // Always 0 for word-like nodes
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });

      it('should return null when no votes exist', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await testSchema.getVotes('test-123');

        expect(result).toBeNull();
      });

      it('should validate ID', async () => {
        await expect(testSchema.getVotes('')).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  describe('Discussion Management', () => {
    // Test discussion creation via a public wrapper method
    class TestSchemaWithPublicDiscussion extends TestNodeSchema {
      public async testCreateDiscussion(params: {
        nodeId: string;
        nodeType: string;
        createdBy: string;
        initialComment?: string;
      }) {
        return this.createDiscussion(params);
      }
    }

    let testSchemaWithDiscussion: TestSchemaWithPublicDiscussion;

    beforeEach(() => {
      testSchemaWithDiscussion = new TestSchemaWithPublicDiscussion(
        neo4jService,
        voteSchema,
      );
    });

    it('should create discussion with required parameters', async () => {
      neo4jService.write.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue('discussion-123') }],
      } as unknown as Result);

      const discussionId = await testSchemaWithDiscussion.testCreateDiscussion({
        nodeId: 'test-123',
        nodeType: 'TestNode',
        createdBy: 'user-456',
        initialComment: 'Initial comment',
      });

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (d:DiscussionNode'),
        expect.objectContaining({
          discussionId: expect.any(String),
          nodeId: 'test-123',
          nodeType: 'TestNode',
          createdBy: 'user-456',
          initialComment: 'Initial comment',
        }),
      );
      expect(discussionId).toBe('discussion-123');
    });

    it('should create discussion without initial comment', async () => {
      neo4jService.write.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue('discussion-456') }],
      } as unknown as Result);

      const discussionId = await testSchemaWithDiscussion.testCreateDiscussion({
        nodeId: 'test-123',
        nodeType: 'TestNode',
        createdBy: 'user-456',
      });

      expect(discussionId).toBe('discussion-456');
    });
  });

  describe('Utility Methods', () => {
    describe('toNumber', () => {
      it('should convert Neo4j integers', () => {
        expect((testSchema as any).toNumber(Integer.fromNumber(42))).toBe(42);
        expect((testSchema as any).toNumber(Integer.fromNumber(-15))).toBe(-15);
      });

      it('should handle regular numbers', () => {
        expect((testSchema as any).toNumber(123)).toBe(123);
        expect((testSchema as any).toNumber(-456)).toBe(-456);
      });

      it('should handle edge cases', () => {
        expect((testSchema as any).toNumber(0)).toBe(0);
        expect((testSchema as any).toNumber(null)).toBe(0);
        expect((testSchema as any).toNumber(undefined)).toBe(0);
      });
    });

    describe('standardError', () => {
      it('should format error messages consistently', () => {
        const originalError = new Error('Database connection failed');
        const formattedError = (testSchema as any).standardError(
          'test operation',
          originalError,
        );

        expect(formattedError.message).toBe(
          'Failed to test operation Test: Database connection failed',
        );
      });
    });
  });

  describe('Abstract Method Implementation', () => {
    it('should require supportsContentVoting implementation', () => {
      expect(testSchema['supportsContentVoting']()).toBe(true);
      expect(wordLikeSchema['supportsContentVoting']()).toBe(false);
    });

    it('should require mapNodeFromRecord implementation', () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockTestNodeData }),
      } as unknown as Record;

      const result = testSchema['mapNodeFromRecord'](mockRecord);

      expect(result).toEqual(mockTestNodeData);
      expect(result.createdBy).toBeDefined();
      expect(result.publicCredit).toBeDefined();
    });

    it('should require buildUpdateQuery implementation', () => {
      const updateData = { name: 'Updated Name' };
      const queryResult = testSchema['buildUpdateQuery'](
        'test-123',
        updateData,
      );

      expect(queryResult.cypher).toContain('MATCH (n:TestNode {id: $id})');
      expect(queryResult.cypher).toContain('SET');
      expect(queryResult.params).toEqual({
        id: 'test-123',
        updateData,
      });
    });
  });

  describe('BaseNodeData Interface Compliance', () => {
    it('should include all required BaseNodeData fields', () => {
      const requiredFields = [
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
        'discussionId',
      ];

      requiredFields.forEach((field) => {
        expect(mockTestNodeData).toHaveProperty(field);
      });
    });

    it('should properly handle voting field conversion', () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: {
            ...mockTestNodeData,
            inclusionPositiveVotes: Integer.fromNumber(5),
            inclusionNegativeVotes: Integer.fromNumber(2),
            inclusionNetVotes: Integer.fromNumber(3),
          },
        }),
      } as unknown as Record;

      const result = testSchema['mapNodeFromRecord'](mockRecord);

      expect(typeof result.inclusionPositiveVotes).toBe('number');
      expect(typeof result.inclusionNegativeVotes).toBe('number');
      expect(typeof result.inclusionNetVotes).toBe('number');
    });
  });
});
