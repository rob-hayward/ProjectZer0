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

  describe('getVoteStatus', () => {
    it('should return vote status for a node', async () => {
      const mockStatus = {
        status: 'agree',
        positiveVotes: 10,
        negativeVotes: 5,
        netVotes: 5,
      };

      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'status') return 'agree';
          if (key === 'positiveVotes') return 10;
          if (key === 'negativeVotes') return 5;
          if (key === 'netVotes') return 5;
          if (key === 'userExists') return true;
          return null;
        }),
      } as unknown as Record;

      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await voteSchema.getVoteStatus(
        'BeliefNode',
        { id: 'belief1' },
        'user1',
      );

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n:BeliefNode {id: $nodeValue})'),
        expect.objectContaining({ nodeValue: 'belief1', sub: 'user1' }),
      );
      expect(result).toEqual(mockStatus);
    });

    it('should return null when node is not found', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await voteSchema.getVoteStatus(
        'BeliefNode',
        { id: 'nonexistent' },
        'user1',
      );

      expect(result).toBeNull();
    });
  });

  describe('vote', () => {
    it('should create a positive vote', async () => {
      const mockVoteResult = {
        positiveVotes: 11,
        negativeVotes: 5,
        netVotes: 6,
      };

      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'positiveVotes') return 11;
          if (key === 'negativeVotes') return 5;
          if (key === 'netVotes') return 6;
          return null;
        }),
      } as unknown as Record;

      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await voteSchema.vote(
        'BeliefNode',
        { id: 'belief1' },
        'user1',
        true, // positive vote
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n:BeliefNode {id: $nodeValue})'),
        expect.objectContaining({
          nodeValue: 'belief1',
          sub: 'user1',
          isPositive: true,
          status: 'agree',
        }),
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should create a negative vote', async () => {
      const mockVoteResult = {
        positiveVotes: 10,
        negativeVotes: 6,
        netVotes: 4,
      };

      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'positiveVotes') return 10;
          if (key === 'negativeVotes') return 6;
          if (key === 'netVotes') return 4;
          return null;
        }),
      } as unknown as Record;

      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await voteSchema.vote(
        'BeliefNode',
        { id: 'belief1' },
        'user1',
        false, // negative vote
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n:BeliefNode {id: $nodeValue})'),
        expect.objectContaining({
          nodeValue: 'belief1',
          sub: 'user1',
          isPositive: false,
          status: 'disagree',
        }),
      );
      expect(result).toEqual(mockVoteResult);
    });
  });

  describe('removeVote', () => {
    it('should remove a vote', async () => {
      const mockVoteResult = {
        positiveVotes: 9,
        negativeVotes: 5,
        netVotes: 4,
      };

      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'positiveVotes') return 9;
          if (key === 'negativeVotes') return 5;
          if (key === 'netVotes') return 4;
          return null;
        }),
      } as unknown as Record;

      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await voteSchema.removeVote(
        'BeliefNode',
        { id: 'belief1' },
        'user1',
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n:BeliefNode {id: $nodeValue})'),
        expect.objectContaining({
          nodeValue: 'belief1',
          sub: 'user1',
        }),
      );
      expect(result).toEqual(mockVoteResult);
    });
  });
});
