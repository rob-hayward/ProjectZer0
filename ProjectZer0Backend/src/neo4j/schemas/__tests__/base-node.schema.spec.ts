// src/neo4j/schemas/__tests__/base-node.schema.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BaseNodeSchema, BaseNodeData } from '../base-node.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';

// Test implementation of BaseNodeSchema
interface TestNodeData extends BaseNodeData {
  name: string;
  description?: string;
}

class TestNodeSchema extends BaseNodeSchema<TestNodeData> {
  protected readonly nodeLabel = 'TestNode';
  protected readonly idField = 'id';

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, 'TestNodeSchema');
  }

  protected supportsContentVoting(): boolean {
    return true; // Test with content voting enabled
  }

  protected mapNodeFromRecord(record: Record): TestNodeData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      name: props.name,
      description: props.description,
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

// Test implementation without content voting (like WordSchema)
class TestWordLikeSchema extends BaseNodeSchema<TestNodeData> {
  protected readonly nodeLabel = 'TestWordNode';
  protected readonly idField = 'word'; // Like WordSchema

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, 'TestWordLikeSchema');
  }

  protected supportsContentVoting(): boolean {
    return false; // Like WordSchema
  }

  protected mapNodeFromRecord(record: Record): TestNodeData {
    const props = record.get('n').properties;
    return {
      id: props.word, // Using 'word' field as id
      name: props.name,
      description: props.description,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      contentPositiveVotes: 0, // Always 0 for word-like nodes
      contentNegativeVotes: 0,
      contentNetVotes: 0,
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<TestNodeData>) {
    return {
      cypher: `
        MATCH (n:TestWordNode {word: $id})
        SET n += $updateData, n.updatedAt = datetime()
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
        {
          provide: Neo4jService,
          useValue: neo4jService,
        },
        {
          provide: VoteSchema,
          useValue: voteSchema,
        },
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

  // INPUT VALIDATION TESTS
  describe('Input Validation', () => {
    describe('validateId', () => {
      it('should pass for valid IDs', () => {
        expect(() => (testSchema as any).validateId('valid-id')).not.toThrow();
        expect(() => (testSchema as any).validateId('test-123')).not.toThrow();
        expect(() =>
          (testSchema as any).validateId('uuid-like-string'),
        ).not.toThrow();
      });

      it('should throw BadRequestException for invalid IDs', () => {
        expect(() => (testSchema as any).validateId('')).toThrow(
          BadRequestException,
        );
        expect(() => (testSchema as any).validateId('   ')).toThrow(
          BadRequestException,
        );
        expect(() => (testSchema as any).validateId('\t\n')).toThrow(
          BadRequestException,
        );
        expect(() => (testSchema as any).validateId(null)).toThrow(
          BadRequestException,
        );
        expect(() => (testSchema as any).validateId(undefined)).toThrow(
          BadRequestException,
        );
      });

      it('should use custom field name in error message', () => {
        expect(() => (testSchema as any).validateId('', 'Node ID')).toThrow(
          'Node ID is required',
        );
      });
    });

    describe('validateUserId', () => {
      it('should pass for valid user IDs', () => {
        expect(() =>
          (testSchema as any).validateUserId('user-123'),
        ).not.toThrow();
        expect(() =>
          (testSchema as any).validateUserId('auth0|123456'),
        ).not.toThrow();
      });

      it('should throw BadRequestException for invalid user IDs', () => {
        expect(() => (testSchema as any).validateUserId('')).toThrow(
          'User ID is required',
        );
        expect(() => (testSchema as any).validateUserId('   ')).toThrow(
          'User ID is required',
        );
        expect(() => (testSchema as any).validateUserId(null)).toThrow(
          BadRequestException,
        );
        expect(() => (testSchema as any).validateUserId(undefined)).toThrow(
          BadRequestException,
        );
      });
    });
  });

  // CRUD OPERATIONS TESTS
  describe('CRUD Operations', () => {
    describe('findById', () => {
      it('should find node by ID successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockTestNodeData }),
        } as unknown as Record;
        const mockResult = { records: [mockRecord] } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await testSchema.findById('test-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (n:TestNode {id: $id}) RETURN n',
          { id: 'test-123' },
        );
        expect(result).toEqual(mockTestNodeData);
      });

      it('should return null when node not found', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await testSchema.findById('nonexistent');

        expect(result).toBeNull();
      });

      it('should validate ID before querying', async () => {
        await expect(testSchema.findById('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });

      it('should work with different identifier fields', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { word: 'test', name: 'Test Word' },
          }),
        } as unknown as Record;
        const mockResult = { records: [mockRecord] } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        await wordLikeSchema.findById('test');

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (n:TestWordNode {word: $id}) RETURN n',
          { id: 'test' },
        );
      });

      it('should handle database errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Database error'));

        await expect(testSchema.findById('test-123')).rejects.toThrow(
          'Failed to find testnode: Database error',
        );
      });
    });

    describe('update', () => {
      it('should update node successfully', async () => {
        const updateData = {
          name: 'Updated Name',
          description: 'Updated description',
        };
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockTestNodeData, ...updateData },
          }),
        } as unknown as Record;
        const mockResult = { records: [mockRecord] } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await testSchema.update('test-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:TestNode {id: $id})'),
          expect.objectContaining({ id: 'test-123', updateData }),
        );
        expect(result).toEqual(expect.objectContaining(updateData));
      });

      it('should throw NotFoundException when node not found', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.write.mockResolvedValue(mockResult);

        await expect(
          testSchema.update('nonexistent', { name: 'Updated' }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should validate ID before updating', async () => {
        await expect(
          testSchema.update('', { name: 'Updated' }),
        ).rejects.toThrow(BadRequestException);
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });

    describe('delete', () => {
      it('should delete node successfully', async () => {
        // Mock existence check
        const existsResult = {
          records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(1)) }],
        } as unknown as Result;
        neo4jService.read.mockResolvedValue(existsResult);

        // Mock deletion
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await testSchema.delete('test-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (n:TestNode {id: $id}) RETURN COUNT(n) as count',
          { id: 'test-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          'MATCH (n:TestNode {id: $id}) DETACH DELETE n',
          { id: 'test-123' },
        );
        expect(result).toEqual({ success: true });
      });

      it('should throw NotFoundException when node does not exist', async () => {
        const existsResult = {
          records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(0)) }],
        } as unknown as Result;
        neo4jService.read.mockResolvedValue(existsResult);

        await expect(testSchema.delete('nonexistent')).rejects.toThrow(
          "Testnode with id 'nonexistent' not found",
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should validate ID before deleting', async () => {
        await expect(testSchema.delete('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });
  });

  // VOTING OPERATIONS TESTS
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

      it('should validate inputs before voting', async () => {
        await expect(
          testSchema.voteInclusion('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(
          testSchema.voteInclusion('test-123', '', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should work with different identifier fields', async () => {
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

      it('should handle voting errors gracefully', async () => {
        voteSchema.vote.mockRejectedValue(new Error('Voting failed'));

        await expect(
          testSchema.voteInclusion('test-123', 'user-456', true),
        ).rejects.toThrow('Failed to vote on testnode: Voting failed');
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

      it('should throw BadRequestException when content voting not supported', async () => {
        await expect(
          wordLikeSchema.voteContent('test-word', 'user-456', true),
        ).rejects.toThrow('Testwordnode does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should validate inputs before content voting', async () => {
        await expect(
          testSchema.voteContent('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(
          testSchema.voteContent('test-123', '', true),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getVoteStatus', () => {
      it('should get vote status successfully', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await testSchema.getVoteStatus('test-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when no vote status exists', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await testSchema.getVoteStatus('test-123', 'user-456');

        expect(result).toBeNull();
      });

      it('should validate inputs', async () => {
        await expect(testSchema.getVoteStatus('', 'user-456')).rejects.toThrow(
          BadRequestException,
        );
        await expect(testSchema.getVoteStatus('test-123', '')).rejects.toThrow(
          BadRequestException,
        );
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

  // UTILITY METHODS TESTS
  describe('Utility Methods', () => {
    describe('toNumber', () => {
      it('should convert regular numbers', () => {
        expect((testSchema as any).toNumber(42)).toBe(42);
        expect((testSchema as any).toNumber(0)).toBe(0);
        expect((testSchema as any).toNumber(-5)).toBe(-5);
      });

      it('should convert Neo4j Integer objects', () => {
        const neo4jInt = Integer.fromNumber(123);
        expect((testSchema as any).toNumber(neo4jInt)).toBe(123);

        const largeInt = Integer.fromNumber(999999);
        expect((testSchema as any).toNumber(largeInt)).toBe(999999);
      });

      it('should handle null and undefined', () => {
        expect((testSchema as any).toNumber(null)).toBe(0);
        expect((testSchema as any).toNumber(undefined)).toBe(0);
      });

      it('should handle objects with valueOf method', () => {
        const objWithValueOf = { valueOf: () => 456 };
        expect((testSchema as any).toNumber(objWithValueOf)).toBe(456);
      });

      it('should convert string numbers', () => {
        expect((testSchema as any).toNumber('789')).toBe(789);
        expect((testSchema as any).toNumber('0')).toBe(0);
      });
    });

    describe('standardError', () => {
      it('should create standard error messages', () => {
        const error = (testSchema as any).standardError(
          'find',
          new Error('DB error'),
        );
        expect(error.message).toBe('Failed to find Test: DB error');
      });

      it('should handle different node types', () => {
        const error = (wordLikeSchema as any).standardError(
          'vote on',
          new Error('Vote error'),
        );
        expect(error.message).toBe('Failed to vote on TestWord: Vote error');
      });
    });

    describe('getNodeTypeName', () => {
      it('should convert node labels to readable names', () => {
        expect((testSchema as any).getNodeTypeName()).toBe('testnode');
        expect((wordLikeSchema as any).getNodeTypeName()).toBe('testwordnode');
      });
    });
  });

  // INTEGRATION TESTS
  describe('Integration Tests', () => {
    it('should handle complete CRUD lifecycle', async () => {
      // Create - handled by subclass
      // Find
      const findRecord = {
        get: jest.fn().mockReturnValue({ properties: mockTestNodeData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [findRecord],
      } as unknown as Result);

      const foundNode = await testSchema.findById('test-123');
      expect(foundNode).toEqual(mockTestNodeData);

      // Update
      const updateRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockTestNodeData, name: 'Updated' },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [updateRecord],
      } as unknown as Result);

      const updatedNode = await testSchema.update('test-123', {
        name: 'Updated',
      });
      expect(updatedNode?.name).toBe('Updated');

      // Delete
      const existsResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(1)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(existsResult);
      neo4jService.write.mockResolvedValueOnce({
        records: [],
      } as unknown as Result);

      const deleteResult = await testSchema.delete('test-123');
      expect(deleteResult.success).toBe(true);
    });

    it('should handle complete voting lifecycle', async () => {
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);
      voteSchema.removeVote.mockResolvedValue(mockVoteResult);

      // Vote inclusion
      await testSchema.voteInclusion('test-123', 'user-456', true);

      // Vote content
      await testSchema.voteContent('test-123', 'user-456', true);

      // Get vote status
      const status = await testSchema.getVoteStatus('test-123', 'user-456');
      expect(status).toEqual(mockVoteStatus);

      // Get aggregate votes
      const votes = await testSchema.getVotes('test-123');
      expect(votes?.inclusionNetVotes).toBe(4);
      expect(votes?.contentNetVotes).toBe(8);

      // Remove votes
      await testSchema.removeVote('test-123', 'user-456', 'INCLUSION');
      await testSchema.removeVote('test-123', 'user-456', 'CONTENT');

      expect(voteSchema.vote).toHaveBeenCalledTimes(2);
      expect(voteSchema.removeVote).toHaveBeenCalledTimes(2);
    });

    it('should work correctly with different identifier fields', async () => {
      // Test with word-like schema using 'word' as identifier
      const wordRecord = {
        get: jest
          .fn()
          .mockReturnValue({ properties: { word: 'test', name: 'Test Word' } }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [wordRecord],
      } as unknown as Result);

      await wordLikeSchema.findById('test');

      expect(neo4jService.read).toHaveBeenCalledWith(
        'MATCH (n:TestWordNode {word: $id}) RETURN n',
        { id: 'test' },
      );

      // Voting should also use correct identifier
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      await wordLikeSchema.voteInclusion('test', 'user-456', true);

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'TestWordNode',
        { word: 'test' },
        'user-456',
        true,
        'INCLUSION',
      );
    });
  });
});
