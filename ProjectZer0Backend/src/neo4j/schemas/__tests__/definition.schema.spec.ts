import { Test, TestingModule } from '@nestjs/testing';
import { DefinitionSchema } from '../definition.schema';
import { Neo4jService } from '../../neo4j.service';
import { UserSchema } from '../user.schema';
import { VoteSchema } from '../vote.schema';
import { Record, Result } from 'neo4j-driver';
import { Logger } from '@nestjs/common';

describe('DefinitionSchema', () => {
  let definitionSchema: DefinitionSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let userSchema: jest.Mocked<UserSchema>;
  let voteSchema: jest.Mocked<VoteSchema>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DefinitionSchema,
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
          },
        },
        {
          provide: UserSchema,
          useValue: {
            addCreatedNode: jest.fn(),
          },
        },
        {
          provide: VoteSchema,
          useValue: {
            vote: jest.fn(),
            getVoteStatus: jest.fn(),
            removeVote: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    definitionSchema = module.get<DefinitionSchema>(DefinitionSchema);
    neo4jService = module.get(Neo4jService);
    userSchema = module.get(UserSchema);
    voteSchema = module.get(VoteSchema);
  });

  describe('createDefinition', () => {
    it('should create a definition', async () => {
      const mockDefinition = {
        id: 'def-id',
        word: 'test',
        createdBy: 'user-id',
        definitionText: 'Test definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await definitionSchema.createDefinition(mockDefinition);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        expect.objectContaining(mockDefinition),
      );
      expect(result).toEqual(mockDefinition);

      // Verify userSchema is not used directly in this method
      expect(userSchema.addCreatedNode).not.toHaveBeenCalled();
    });
  });

  describe('getDefinition', () => {
    it('should return a definition when found', async () => {
      const mockDefinition = {
        id: 'def-id',
        definitionText: 'Test definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await definitionSchema.getDefinition('def-id');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DefinitionNode {id: $id})'),
        { id: 'def-id' },
      );
      expect(result).toEqual(mockDefinition);
    });

    it('should return null when definition is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await definitionSchema.getDefinition('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('updateDefinition', () => {
    it('should update a definition', async () => {
      const mockUpdatedDefinition = {
        id: 'def-id',
        definitionText: 'Updated definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUpdatedDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await definitionSchema.updateDefinition('def-id', {
        definitionText: 'Updated definition',
      });

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DefinitionNode {id: $id})'),
        expect.objectContaining({
          id: 'def-id',
          updateData: { definitionText: 'Updated definition' },
        }),
      );
      expect(result).toEqual(mockUpdatedDefinition);
    });
  });

  describe('deleteDefinition', () => {
    it('should delete a definition', async () => {
      // Mock the read query that checks if definition exists
      const mockCheckRecord = {
        get: jest.fn().mockReturnValue({ properties: { id: 'def-id' } }),
      } as unknown as Record;
      const mockCheckResult = {
        records: [mockCheckRecord],
      } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockCheckResult);

      // Mock the delete operation
      neo4jService.write.mockResolvedValue({
        records: [],
      } as unknown as Result);

      const result = await definitionSchema.deleteDefinition('def-id');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DefinitionNode {id: $id})'),
        { id: 'def-id' },
      );
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DefinitionNode {id: $id})'),
        { id: 'def-id' },
      );
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('deleted successfully'),
        }),
      );
    });
  });

  describe('voteDefinition', () => {
    it('should vote on a definition', async () => {
      const mockVoteResult = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };

      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await definitionSchema.voteDefinition(
        'def-id',
        'user-id',
        true,
      );

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'DefinitionNode',
        { id: 'def-id' },
        'user-id',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });
  });

  describe('getDefinitionVoteStatus', () => {
    it('should get vote status', async () => {
      const mockVoteStatus = {
        status: 'agree' as 'agree' | 'disagree',
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };

      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await definitionSchema.getDefinitionVoteStatus(
        'def-id',
        'user-id',
      );

      expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
        'DefinitionNode',
        { id: 'def-id' },
        'user-id',
      );
      expect(result).toEqual(mockVoteStatus);
    });
  });

  describe('removeDefinitionVote', () => {
    it('should remove a vote', async () => {
      const mockVoteResult = {
        positiveVotes: 4,
        negativeVotes: 2,
        netVotes: 2,
      };

      voteSchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await definitionSchema.removeDefinitionVote(
        'def-id',
        'user-id',
      );

      expect(voteSchema.removeVote).toHaveBeenCalledWith(
        'DefinitionNode',
        { id: 'def-id' },
        'user-id',
      );
      expect(result).toEqual(mockVoteResult);
    });
  });

  describe('getDefinitionVotes', () => {
    it('should get all votes for a definition', async () => {
      const mockVoteStatus = {
        status: null,
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };

      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await definitionSchema.getDefinitionVotes('def-id');

      expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
        'DefinitionNode',
        { id: 'def-id' },
        '',
      );
      expect(result).toEqual({
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      });
    });

    it('should return null when no votes exist', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(null);

      const result = await definitionSchema.getDefinitionVotes('def-id');

      expect(result).toBeNull();
    });
  });

  describe('setVisibilityStatus', () => {
    it('should set visibility status', async () => {
      const mockDefinition = {
        id: 'def-id',
        visibilityStatus: true,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await definitionSchema.setVisibilityStatus('def-id', true);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DefinitionNode {id: $definitionId})'),
        { definitionId: 'def-id', isVisible: true },
      );
      expect(result).toEqual(mockDefinition);
    });
  });

  describe('getVisibilityStatus', () => {
    it('should get visibility status', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(true),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await definitionSchema.getVisibilityStatus('def-id');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DefinitionNode {id: $definitionId})'),
        { definitionId: 'def-id' },
      );
      expect(result).toBe(true);
    });

    it('should default to true when visibility status is not found', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(null),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await definitionSchema.getVisibilityStatus('def-id');

      expect(result).toBe(true);
    });
  });
});
