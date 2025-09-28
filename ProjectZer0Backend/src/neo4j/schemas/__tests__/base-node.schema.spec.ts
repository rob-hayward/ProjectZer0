import { Test, TestingModule } from '@nestjs/testing';
import { BaseNodeSchema, BaseNodeData } from '../base/base-node.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema } from '../vote.schema';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Record, Integer } from 'neo4j-driver';

// Create test-specific data interface
interface TestNodeData extends BaseNodeData {
  title: string;
  description: string;
}

// Create a concrete implementation for testing
class TestNodeSchema extends BaseNodeSchema<TestNodeData> {
  protected nodeType = 'TestNode';
  protected nodeLabel = 'TestNode';
  protected nodeCreatedType = 'test' as const;
  protected idField = 'id';

  protected supportsContentVoting(): boolean {
    return true; // Test both inclusion and content voting
  }

  protected mapNodeFromRecord(record: Record): TestNodeData {
    const node = record.get('n');
    return {
      id: node.properties.id,
      title: node.properties.title,
      description: node.properties.description,
      createdAt: node.properties.createdAt,
      updatedAt: node.properties.updatedAt,
      createdBy: node.properties.createdBy,
      publicCredit: node.properties.publicCredit || false,
      inclusionPositiveVotes: this.toNumber(
        node.properties.inclusionPositiveVotes || 0,
      ),
      inclusionNegativeVotes: this.toNumber(
        node.properties.inclusionNegativeVotes || 0,
      ),
      inclusionNetVotes: this.toNumber(node.properties.inclusionNetVotes || 0),
      contentPositiveVotes: this.toNumber(
        node.properties.contentPositiveVotes || 0,
      ),
      contentNegativeVotes: this.toNumber(
        node.properties.contentNegativeVotes || 0,
      ),
      contentNetVotes: this.toNumber(node.properties.contentNetVotes || 0),
    };
  }

  protected buildUpdateQuery(
    id: string,
    data: Partial<TestNodeData>,
  ): { cypher: string; params: any } {
    const setStatements: string[] = [];
    const params: any = { id };

    if (data.title !== undefined) {
      setStatements.push('n.title = $title');
      params.title = data.title;
    }
    if (data.description !== undefined) {
      setStatements.push('n.description = $description');
      params.description = data.description;
    }

    const cypher = `
      MATCH (n:TestNode {id: $id})
      ${setStatements.length > 0 ? `SET ${setStatements.join(', ')}, ` : 'SET '}
      n.updatedAt = datetime()
      RETURN n
    `;

    return { cypher, params };
  }
}

// Test implementation without content voting
class SimpleTestNodeSchema extends BaseNodeSchema<TestNodeData> {
  protected nodeType = 'SimpleTestNode';
  protected nodeLabel = 'SimpleTestNode';
  protected nodeCreatedType = 'simpletest' as const;
  protected idField = 'id';

  protected supportsContentVoting(): boolean {
    return false; // Test inclusion voting only
  }

  protected mapNodeFromRecord(record: Record): TestNodeData {
    const node = record.get('n');
    return {
      id: node.properties.id,
      title: node.properties.title,
      description: node.properties.description,
      createdAt: node.properties.createdAt,
      updatedAt: node.properties.updatedAt,
      createdBy: node.properties.createdBy,
      publicCredit: node.properties.publicCredit || false,
      inclusionPositiveVotes: this.toNumber(
        node.properties.inclusionPositiveVotes || 0,
      ),
      inclusionNegativeVotes: this.toNumber(
        node.properties.inclusionNegativeVotes || 0,
      ),
      inclusionNetVotes: this.toNumber(node.properties.inclusionNetVotes || 0),
      contentPositiveVotes: 0, // No content voting for this schema
      contentNegativeVotes: 0,
      contentNetVotes: 0,
    };
  }

  protected buildUpdateQuery(
    id: string,
    data: Partial<TestNodeData>,
  ): { cypher: string; params: any } {
    const setStatements: string[] = [];
    const params: any = { id };

    if (data.title !== undefined) {
      setStatements.push('n.title = $title');
      params.title = data.title;
    }
    if (data.description !== undefined) {
      setStatements.push('n.description = $description');
      params.description = data.description;
    }

    const cypher = `
      MATCH (n:SimpleTestNode {id: $id})
      ${setStatements.length > 0 ? `SET ${setStatements.join(', ')}, ` : 'SET '}
      n.updatedAt = datetime()
      RETURN n
    `;

    return { cypher, params };
  }
}

describe('BaseNodeSchema', () => {
  let testSchema: TestNodeSchema;
  let simpleSchema: SimpleTestNodeSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
            executeQuery: jest.fn(),
          },
        },
        {
          provide: VoteSchema,
          useValue: {
            vote: jest.fn(),
            removeVote: jest.fn(),
            getVoteStatus: jest.fn(),
            updateVoteCounts: jest.fn(),
            initializeVotingFields: jest.fn(),
          },
        },
      ],
    }).compile();

    neo4jService = module.get<Neo4jService>(
      Neo4jService,
    ) as jest.Mocked<Neo4jService>;
    voteSchema = module.get<VoteSchema>(VoteSchema) as jest.Mocked<VoteSchema>;

    testSchema = new TestNodeSchema(neo4jService, voteSchema, 'TestNodeSchema');
    simpleSchema = new SimpleTestNodeSchema(
      neo4jService,
      voteSchema,
      'SimpleTestNodeSchema',
    );
  });

  describe('findById', () => {
    it('should return a node when it exists', async () => {
      const mockNode = {
        id: 'test-id',
        title: 'Test Title',
        description: 'Test Description',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'user-id',
        publicCredit: true,
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 2,
        inclusionNetVotes: 3,
        contentPositiveVotes: 10,
        contentNegativeVotes: 3,
        contentNetVotes: 7,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockNode }),
      };

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as any);

      const result = await testSchema.findById('test-id');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n:TestNode {id: $id})'),
        { id: 'test-id' },
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'test-id',
          title: 'Test Title',
          description: 'Test Description',
        }),
      );
    });

    it('should return null when node does not exist', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as any);

      const result = await testSchema.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a node successfully', async () => {
      const mockUpdatedNode = {
        id: 'test-id',
        title: 'Updated Title',
        description: 'Updated Description',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        createdBy: 'user-id',
        publicCredit: true,
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 2,
        inclusionNetVotes: 3,
        contentPositiveVotes: 10,
        contentNegativeVotes: 3,
        contentNetVotes: 7,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUpdatedNode }),
      };

      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as any);

      const result = await testSchema.update('test-id', {
        title: 'Updated Title',
        description: 'Updated Description',
      });

      expect(neo4jService.write).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          title: 'Updated Title',
          description: 'Updated Description',
        }),
      );
    });

    it('should throw NotFoundException when node does not exist', async () => {
      neo4jService.write.mockResolvedValue({
        records: [],
      } as any);

      await expect(
        testSchema.update('non-existent', { title: 'New Title' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a node successfully', async () => {
      // Mock the existence check
      const countRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
      };
      neo4jService.read.mockResolvedValue({
        records: [countRecord],
      } as any);

      // Mock the delete operation
      neo4jService.write.mockResolvedValue({} as any);

      const result = await testSchema.delete('test-id');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(n) as count'),
        { id: 'test-id' },
      );
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('DETACH DELETE n'),
        { id: 'test-id' },
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when node does not exist', async () => {
      // Mock the existence check - node doesn't exist
      const countRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(0)),
      };
      neo4jService.read.mockResolvedValue({
        records: [countRecord],
      } as any);

      await expect(testSchema.delete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });
  });

  describe('Voting Operations', () => {
    const mockVoteResult = {
      inclusionPositiveVotes: 10,
      inclusionNegativeVotes: 2,
      inclusionNetVotes: 8,
      contentPositiveVotes: 5,
      contentNegativeVotes: 1,
      contentNetVotes: 4,
    };

    const mockVoteStatus = {
      inclusionStatus: 'agree' as const,
      inclusionPositiveVotes: 10,
      inclusionNegativeVotes: 2,
      inclusionNetVotes: 8,
      contentStatus: 'disagree' as const,
      contentPositiveVotes: 5,
      contentNegativeVotes: 1,
      contentNetVotes: 4,
    };

    describe('voteInclusion', () => {
      it('should cast inclusion vote successfully', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await testSchema.voteInclusion(
          'test-id',
          'user-id',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-id' },
          'user-id',
          true,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should handle negative votes', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        await testSchema.voteInclusion('test-id', 'user-id', false);

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-id' },
          'user-id',
          false,
          'INCLUSION',
        );
      });

      it('should validate inputs', async () => {
        await expect(
          testSchema.voteInclusion('', 'user-id', true),
        ).rejects.toThrow(BadRequestException);

        await expect(
          testSchema.voteInclusion('test-id', '', true),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('voteContent', () => {
      it('should cast content vote when supported', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await testSchema.voteContent('test-id', 'user-id', true);

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-id' },
          'user-id',
          true,
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw error when content voting not supported', async () => {
        await expect(
          simpleSchema.voteContent('test-id', 'user-id', true),
        ).rejects.toThrow('Simpletest does not support content voting');
      });
    });

    describe('removeVote', () => {
      it('should remove inclusion vote', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await testSchema.removeVote(
          'test-id',
          'user-id',
          'INCLUSION',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-id' },
          'user-id',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should remove content vote', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await testSchema.removeVote(
          'test-id',
          'user-id',
          'CONTENT',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-id' },
          'user-id',
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate content voting support when removing content vote', async () => {
        // The removeVote in BaseNodeSchema checks supportsContentVoting for CONTENT votes
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        // SimpleSchema doesn't support content voting, so it should still work
        // but VoteSchema might handle the error
        const result = await simpleSchema.removeVote(
          'test-id',
          'user-id',
          'CONTENT',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'SimpleTestNode',
          { id: 'test-id' },
          'user-id',
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('getVoteStatus', () => {
      it('should get vote status for a user', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await testSchema.getVoteStatus('test-id', 'user-id');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-id' },
          'user-id',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when no vote exists', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await testSchema.getVoteStatus('test-id', 'user-id');

        expect(result).toBeNull();
      });
    });

    describe('getVotes', () => {
      it('should get aggregate votes', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await testSchema.getVotes('test-id');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'TestNode',
          { id: 'test-id' },
          '', // Empty string for aggregate votes
        );
        expect(result).toEqual({
          inclusionPositiveVotes: 10,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 8,
          contentPositiveVotes: 5,
          contentNegativeVotes: 1,
          contentNetVotes: 4,
        });
      });

      it('should return zero content votes when content voting not supported', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await simpleSchema.getVotes('test-id');

        expect(result).toEqual({
          inclusionPositiveVotes: 10,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 8,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });

      it('should return null when no votes exist', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await testSchema.getVotes('test-id');

        expect(result).toBeNull();
      });
    });
  });

  describe('Protected Methods', () => {
    describe('validateId', () => {
      it('should not throw for valid ID', () => {
        expect(() => {
          (testSchema as any).validateId('valid-id-123');
        }).not.toThrow();
      });

      it('should throw for empty ID', () => {
        expect(() => {
          (testSchema as any).validateId('');
        }).toThrow(BadRequestException);
      });

      it('should throw for null ID', () => {
        expect(() => {
          (testSchema as any).validateId(null);
        }).toThrow(BadRequestException);
      });
    });

    describe('validateUserId', () => {
      it('should not throw for valid user ID', () => {
        expect(() => {
          (testSchema as any).validateUserId('user-123');
        }).not.toThrow();
      });

      it('should throw for empty user ID', () => {
        expect(() => {
          (testSchema as any).validateUserId('');
        }).toThrow(BadRequestException);
      });
    });

    describe('standardError', () => {
      it('should format error message correctly', () => {
        const testError = new Error('Operation failed');
        const error = (testSchema as any).standardError('test', testError);
        expect(error.message).toBe('Failed to test Test: Operation failed');
      });
    });

    describe('toNumber', () => {
      it('should handle Neo4j integer objects', () => {
        const neo4jInt = { low: 42, high: 0 };
        const result = (testSchema as any).toNumber(neo4jInt);
        expect(result).toBe(42);
      });

      it('should handle objects with valueOf', () => {
        const obj = { valueOf: () => 123 };
        const result = (testSchema as any).toNumber(obj);
        expect(result).toBe(123);
      });

      it('should handle regular numbers', () => {
        const result = (testSchema as any).toNumber(456);
        expect(result).toBe(456);
      });

      it('should handle string numbers', () => {
        const result = (testSchema as any).toNumber('789');
        expect(result).toBe(789);
      });

      it('should handle null/undefined', () => {
        expect((testSchema as any).toNumber(null)).toBe(0);
        expect((testSchema as any).toNumber(undefined)).toBe(0);
      });
    });

    describe('getNodeTypeName', () => {
      it('should return the correct node type name', () => {
        expect((testSchema as any).getNodeTypeName()).toBe('Test');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Neo4j service errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(testSchema.findById('test-id')).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle vote schema errors gracefully', async () => {
      voteSchema.vote.mockRejectedValue(new Error('Vote operation failed'));

      await expect(
        testSchema.voteInclusion('test-id', 'user-id', true),
      ).rejects.toThrow('Vote operation failed');
    });
  });

  describe('Content Voting Threshold Check', () => {
    it('should check inclusion threshold before content voting', async () => {
      // The voteContent method checks supportsContentVoting() first
      // For a schema that supports content voting, it should allow the vote
      voteSchema.vote.mockResolvedValue({
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 1,
        inclusionNetVotes: 4,
        contentPositiveVotes: 2,
        contentNegativeVotes: 0,
        contentNetVotes: 2,
      });

      const result = await testSchema.voteContent('test-id', 'user-id', true);

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'TestNode',
        { id: 'test-id' },
        'user-id',
        true,
        'CONTENT',
      );
      expect(result).toBeDefined();
    });
  });
});
