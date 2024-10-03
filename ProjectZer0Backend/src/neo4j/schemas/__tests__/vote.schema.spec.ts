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

  describe('createSingleChoiceVote', () => {
    it('should create a single choice vote', async () => {
      const mockVote = {
        userId: 'user1',
        targetId: 'target1',
        targetType: 'DefinitionNode',
        voteType: 'singleChoice',
        value: 1,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockVote }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await voteSchema.createSingleChoiceVote(
        mockVote.userId,
        mockVote.targetId,
        mockVote.targetType,
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (u)-[v:VOTED_ON]->(t)'),
        expect.objectContaining(mockVote),
      );
      expect(result).toEqual(mockVote);
    });
  });

  describe('createBooleanVote', () => {
    it('should create a boolean vote', async () => {
      const mockVote = {
        userId: 'user1',
        targetId: 'target1',
        targetType: 'BeliefNode',
        voteType: 'boolean',
        value: 1,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockVote }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await voteSchema.createBooleanVote(
        mockVote.userId,
        mockVote.targetId,
        mockVote.targetType,
        true,
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (u)-[v:VOTED_ON]->(t)'),
        expect.objectContaining(mockVote),
      );
      expect(result).toEqual(mockVote);
    });
  });

  describe('createQuantityChoiceVote', () => {
    it('should create a quantity choice vote', async () => {
      const mockVote = {
        userId: 'user1',
        targetId: 'target1',
        targetType: 'CommentNode',
        voteType: 'quantityChoice',
        value: 5,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockVote }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await voteSchema.createQuantityChoiceVote(
        mockVote.userId,
        mockVote.targetId,
        mockVote.targetType,
        5,
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (u)-[v:VOTED_ON]->(t)'),
        expect.objectContaining(mockVote),
      );
      expect(result).toEqual(mockVote);
    });
  });

  describe('getVoteTally', () => {
    it('should return vote tally', async () => {
      const mockTally = {
        totalVotes: 10,
        voteSum: 8,
        voteAverage: 0.8,
        allVotes: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
      };

      const mockRecord = {
        toObject: jest.fn().mockReturnValue(mockTally),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await voteSchema.getVoteTally('target1', 'boolean');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'MATCH (t {id: $targetId})<-[v:VOTED_ON {voteType: $voteType}]-()',
        ),
        { targetId: 'target1', voteType: 'boolean' },
      );
      expect(result).toEqual(mockTally);
    });
  });
});
