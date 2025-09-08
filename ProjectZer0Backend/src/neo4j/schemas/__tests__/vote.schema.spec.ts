// src/neo4j/schemas/__tests__/vote.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { VoteSchema } from '../vote.schema';
import { Neo4jService } from '../../neo4j.service';
import { Record, Result } from 'neo4j-driver';

describe('VoteSchema', () => {
  let voteSchema: VoteSchema;
  let neo4jService: jest.Mocked<Neo4jService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoteSchema,
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
          },
        },
      ],
    }).compile();

    voteSchema = module.get<VoteSchema>(VoteSchema);
    neo4jService = module.get(Neo4jService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getVoteStatus', () => {
    it('should return vote status for a node', async () => {
      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          switch (key) {
            case 'inclusionStatus':
              return 'agree';
            case 'inclusionPositiveVotes':
              return 10;
            case 'inclusionNegativeVotes':
              return 5;
            case 'inclusionNetVotes':
              return 5;
            case 'contentStatus':
              return 'disagree';
            case 'contentPositiveVotes':
              return 3;
            case 'contentNegativeVotes':
              return 7;
            case 'contentNetVotes':
              return -4;
            case 'userExists':
              return true;
            default:
              return null;
          }
        }),
      } as unknown as Record;

      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await voteSchema.getVoteStatus(
        'StatementNode',
        { id: 'statement1' },
        'user1',
      );

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n:StatementNode {id: $nodeValue})'),
        expect.objectContaining({ nodeValue: 'statement1', sub: 'user1' }),
      );

      expect(result).toEqual({
        inclusionStatus: 'agree',
        inclusionPositiveVotes: 10,
        inclusionNegativeVotes: 5,
        inclusionNetVotes: 5,
        contentStatus: 'disagree',
        contentPositiveVotes: 3,
        contentNegativeVotes: 7,
        contentNetVotes: -4,
      });
    });

    it('should return null when no records are found', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await voteSchema.getVoteStatus(
        'StatementNode',
        { id: 'nonexistent' },
        'user1',
      );

      expect(result).toBeNull();
    });

    it('should create user if user does not exist', async () => {
      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          switch (key) {
            case 'userExists':
              return false;
            case 'inclusionPositiveVotes':
              return 0;
            case 'inclusionNegativeVotes':
              return 0;
            case 'inclusionNetVotes':
              return 0;
            case 'contentPositiveVotes':
              return 0;
            case 'contentNegativeVotes':
              return 0;
            case 'contentNetVotes':
              return 0;
            default:
              return null;
          }
        }),
      } as unknown as Record;

      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);
      neo4jService.write.mockResolvedValue({} as Result);

      await voteSchema.getVoteStatus(
        'StatementNode',
        { id: 'statement1' },
        'newuser',
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        'MERGE (u:User {sub: $sub})',
        { sub: 'newuser' },
      );
    });
  });

  describe('vote', () => {
    it('should create inclusion vote successfully', async () => {
      const mockResult = {
        records: [
          {
            get: jest.fn().mockImplementation((key) => {
              switch (key) {
                case 'inclusionPositiveVotes':
                  return 1;
                case 'inclusionNegativeVotes':
                  return 0;
                case 'inclusionNetVotes':
                  return 1;
                case 'contentPositiveVotes':
                  return 0;
                case 'contentNegativeVotes':
                  return 0;
                case 'contentNetVotes':
                  return 0;
                default:
                  return 0;
              }
            }),
          },
        ],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await voteSchema.vote(
        'StatementNode',
        { id: 'statement1' },
        'user1',
        true,
        'INCLUSION',
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n:StatementNode {id: $nodeValue})'),
        expect.objectContaining({
          nodeValue: 'statement1',
          sub: 'user1',
          isPositive: true,
          kind: 'INCLUSION',
          status: 'agree',
        }),
      );

      expect(result).toEqual({
        inclusionPositiveVotes: 1,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 1,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      });
    });

    it('should create content vote successfully', async () => {
      const mockResult = {
        records: [
          {
            get: jest.fn().mockImplementation((key) => {
              switch (key) {
                case 'inclusionPositiveVotes':
                  return 5;
                case 'inclusionNegativeVotes':
                  return 2;
                case 'inclusionNetVotes':
                  return 3;
                case 'contentPositiveVotes':
                  return 0;
                case 'contentNegativeVotes':
                  return 1;
                case 'contentNetVotes':
                  return -1;
                default:
                  return 0;
              }
            }),
          },
        ],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await voteSchema.vote(
        'StatementNode',
        { id: 'statement1' },
        'user1',
        false,
        'CONTENT',
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n:StatementNode {id: $nodeValue})'),
        expect.objectContaining({
          nodeValue: 'statement1',
          sub: 'user1',
          isPositive: false,
          kind: 'CONTENT',
          status: 'disagree',
        }),
      );

      expect(result).toEqual({
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 2,
        inclusionNetVotes: 3,
        contentPositiveVotes: 0,
        contentNegativeVotes: 1,
        contentNetVotes: -1,
      });
    });

    it('should throw error for unsupported vote kind', async () => {
      await expect(
        voteSchema.vote(
          'WordNode',
          { word: 'test' },
          'user1',
          true,
          'CONTENT', // WordNode doesn't support content voting
        ),
      ).rejects.toThrow('WordNode does not support content voting');

      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle voting errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Database error'));

      await expect(
        voteSchema.vote(
          'StatementNode',
          { id: 'statement1' },
          'user1',
          true,
          'INCLUSION',
        ),
      ).rejects.toThrow(
        'Failed to inclusion vote on StatementNode: Database error',
      );
    });
  });

  describe('removeVote', () => {
    it('should remove inclusion vote successfully', async () => {
      const mockResult = {
        records: [
          {
            get: jest.fn().mockImplementation((key) => {
              switch (key) {
                case 'inclusionPositiveVotes':
                  return 0; // After removal
                case 'inclusionNegativeVotes':
                  return 0;
                case 'inclusionNetVotes':
                  return 0;
                case 'contentPositiveVotes':
                  return 2;
                case 'contentNegativeVotes':
                  return 1;
                case 'contentNetVotes':
                  return 1;
                default:
                  return 0;
              }
            }),
          },
        ],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await voteSchema.removeVote(
        'StatementNode',
        { id: 'statement1' },
        'user1',
        'INCLUSION',
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining(
          'MATCH (u:User {sub: $sub})-[v:VOTED_ON {kind: $kind}]->(n)',
        ),
        expect.objectContaining({
          nodeValue: 'statement1',
          sub: 'user1',
          kind: 'INCLUSION',
        }),
      );

      expect(result).toEqual({
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 2,
        contentNegativeVotes: 1,
        contentNetVotes: 1,
      });
    });

    it('should remove content vote successfully', async () => {
      const mockResult = {
        records: [
          {
            get: jest.fn().mockImplementation((key) => {
              switch (key) {
                case 'inclusionPositiveVotes':
                  return 3;
                case 'inclusionNegativeVotes':
                  return 1;
                case 'inclusionNetVotes':
                  return 2;
                case 'contentPositiveVotes':
                  return 1; // After removal
                case 'contentNegativeVotes':
                  return 0;
                case 'contentNetVotes':
                  return 1;
                default:
                  return 0;
              }
            }),
          },
        ],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await voteSchema.removeVote(
        'StatementNode',
        { id: 'statement1' },
        'user1',
        'CONTENT',
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('DELETE v'),
        expect.objectContaining({
          nodeValue: 'statement1',
          sub: 'user1',
          kind: 'CONTENT',
        }),
      );

      expect(result).toEqual({
        inclusionPositiveVotes: 3,
        inclusionNegativeVotes: 1,
        inclusionNetVotes: 2,
        contentPositiveVotes: 1,
        contentNegativeVotes: 0,
        contentNetVotes: 1,
      });
    });

    it('should handle remove vote errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Remove failed'));

      await expect(
        voteSchema.removeVote(
          'StatementNode',
          { id: 'statement1' },
          'user1',
          'INCLUSION',
        ),
      ).rejects.toThrow(
        'Failed to remove inclusion vote from StatementNode: Remove failed',
      );
    });
  });

  describe('toNumber helper', () => {
    it('should convert various input types to numbers', () => {
      // Access private method for testing
      const toNumber = (voteSchema as any).toNumber;

      expect(toNumber(5)).toBe(5);
      expect(toNumber('10')).toBe(10);
      expect(toNumber(null)).toBe(0);
      expect(toNumber(undefined)).toBe(0);
      expect(toNumber({ low: 15 })).toBe(15); // Neo4j Integer object with 'low' property
      expect(toNumber({ valueOf: () => 25 })).toBe(25); // Neo4j Integer object with 'valueOf' method
    });
  });
});
