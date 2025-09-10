// src/neo4j/schemas/__tests__/definition.schema.spec.ts - CONVERTED TO BaseNodeSchema

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DefinitionSchema, DefinitionData } from '../definition.schema';
import { Neo4jService } from '../../neo4j.service';
import { UserSchema } from '../user.schema';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';

describe('DefinitionSchema with BaseNodeSchema Integration', () => {
  let schema: DefinitionSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let userSchema: jest.Mocked<UserSchema>;
  let voteSchema: jest.Mocked<VoteSchema>;

  // Mock data constants
  const mockDefinitionData: DefinitionData = {
    id: 'definition-123',
    word: 'test',
    createdBy: 'user-456',
    definitionText: 'This is a test definition of the word test.',
    discussion: 'discussion-789',
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentPositiveVotes: 8,
    contentNegativeVotes: 1,
    contentNetVotes: 7,
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentPositiveVotes: 8,
    contentNegativeVotes: 1,
    contentNetVotes: 7,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentStatus: 'agree',
    contentPositiveVotes: 8,
    contentNegativeVotes: 1,
    contentNetVotes: 7,
  };

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
      ],
    }).compile();

    schema = module.get<DefinitionSchema>(DefinitionSchema);
    neo4jService = module.get(Neo4jService);
    userSchema = module.get(UserSchema);
    voteSchema = module.get(VoteSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Inherited BaseNodeSchema Methods', () => {
    describe('findById (inherited)', () => {
      it('should find a definition by id', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.findById('definition-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:DefinitionNode {id: $id})'),
          { id: 'definition-123' },
        );
        expect(result).toEqual(mockDefinitionData);
      });

      it('should return null when definition is not found', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.findById('non-existent');
        expect(result).toBeNull();
      });

      it('should validate input', async () => {
        await expect(schema.findById('')).rejects.toThrow(BadRequestException);
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('update (inherited)', () => {
      it('should update a definition', async () => {
        const updateData = { definitionText: 'Updated definition text' };
        const updatedDefinition = { ...mockDefinitionData, ...updateData };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedDefinition }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.update('definition-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:DefinitionNode {id: $id})'),
          expect.objectContaining({
            id: 'definition-123',
            updateData,
          }),
        );
        expect(result).toEqual(updatedDefinition);
      });

      it('should validate input', async () => {
        await expect(
          schema.update('', { definitionText: 'Updated' }),
        ).rejects.toThrow(BadRequestException);
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });

    describe('delete (inherited)', () => {
      it('should delete a definition', async () => {
        // Mock the existence check that happens in BaseNodeSchema.delete()
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;
        const existsResult = {
          records: [existsRecord],
        } as unknown as Result;
        neo4jService.read.mockResolvedValue(existsResult);

        // Mock the actual delete operation
        const deleteResult = {} as unknown as Result;
        neo4jService.write.mockResolvedValue(deleteResult);

        const result = await schema.delete('definition-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:DefinitionNode {id: $id})'),
          { id: 'definition-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:DefinitionNode {id: $id})'),
          expect.objectContaining({ id: 'definition-123' }),
        );
        expect(result).toEqual({ success: true });
      });

      it('should validate input', async () => {
        await expect(schema.delete('')).rejects.toThrow(BadRequestException);
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });
  });

  describe('Voting Integration with BaseNodeSchema', () => {
    describe('voteInclusion (inherited)', () => {
      it('should vote on definition inclusion', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteInclusion(
          'definition-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
          true,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate inputs before inclusion voting', async () => {
        await expect(
          schema.voteInclusion('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(
          schema.voteInclusion('definition-123', '', true),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('voteContent (overridden with business logic)', () => {
      it('should vote on definition content when inclusion threshold passed', async () => {
        // Mock definition with passed inclusion threshold
        const mockDefinition = {
          ...mockDefinitionData,
          inclusionNetVotes: 5, // Passed inclusion threshold
        };
        jest.spyOn(schema, 'findById').mockResolvedValue(mockDefinition);
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteContent(
          'definition-123',
          'user-456',
          true,
        );

        expect(schema.findById).toHaveBeenCalledWith('definition-123');
        expect(voteSchema.vote).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
          true,
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException when inclusion threshold not passed', async () => {
        const mockDefinition = {
          ...mockDefinitionData,
          inclusionNetVotes: -5, // Below threshold
        };
        jest.spyOn(schema, 'findById').mockResolvedValue(mockDefinition);

        await expect(
          schema.voteContent('definition-123', 'user-456', true),
        ).rejects.toThrow(
          'Definition must pass inclusion threshold before content voting is allowed',
        );
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when definition does not exist', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue(null);

        await expect(
          schema.voteContent('definition-123', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should validate inputs before content voting', async () => {
        await expect(schema.voteContent('', 'user-456', true)).rejects.toThrow(
          BadRequestException,
        );
        await expect(
          schema.voteContent('definition-123', '', true),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getVoteStatus (inherited)', () => {
      it('should get vote status successfully', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('definition-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when no vote status exists', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await schema.getVoteStatus('definition-123', 'user-456');
        expect(result).toBeNull();
      });

      it('should validate inputs', async () => {
        await expect(schema.getVoteStatus('', 'user-456')).rejects.toThrow(
          BadRequestException,
        );
        await expect(
          schema.getVoteStatus('definition-123', ''),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('removeVote (inherited)', () => {
      it('should remove inclusion vote successfully', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeVote(
          'definition-123',
          'user-456',
          'INCLUSION',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should remove content vote successfully', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeVote(
          'definition-123',
          'user-456',
          'CONTENT',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate inputs', async () => {
        await expect(
          schema.removeVote('', 'user-456', 'INCLUSION'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          schema.removeVote('definition-123', '', 'CONTENT'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getVotes (inherited)', () => {
      it('should get votes for a definition', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('definition-123');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          '',
        );
        expect(result).toEqual({
          inclusionPositiveVotes: mockVoteStatus.inclusionPositiveVotes,
          inclusionNegativeVotes: mockVoteStatus.inclusionNegativeVotes,
          inclusionNetVotes: mockVoteStatus.inclusionNetVotes,
          contentPositiveVotes: mockVoteStatus.contentPositiveVotes,
          contentNegativeVotes: mockVoteStatus.contentNegativeVotes,
          contentNetVotes: mockVoteStatus.contentNetVotes,
        });
      });

      it('should return null when no votes exist', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await schema.getVotes('definition-123');
        expect(result).toBeNull();
      });

      it('should validate input', async () => {
        await expect(schema.getVotes('')).rejects.toThrow(BadRequestException);
        expect(voteSchema.getVoteStatus).not.toHaveBeenCalled();
      });
    });
  });

  describe('Definition-Specific Methods', () => {
    describe('createDefinition', () => {
      it('should create a definition with all required fields', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);
        userSchema.addCreatedNode.mockResolvedValue(undefined);

        const result = await schema.createDefinition({
          id: mockDefinitionData.id,
          word: mockDefinitionData.word,
          createdBy: mockDefinitionData.createdBy,
          definitionText: mockDefinitionData.definitionText,
          discussion: mockDefinitionData.discussion,
        });

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (w:WordNode {word: $word})'),
          expect.objectContaining({
            id: mockDefinitionData.id,
            word: mockDefinitionData.word,
            createdBy: mockDefinitionData.createdBy,
            definitionText: mockDefinitionData.definitionText,
            discussion: mockDefinitionData.discussion,
          }),
        );
        expect(result).toEqual(mockDefinitionData);
      });

      it('should create an API definition without user relationship', async () => {
        const apiDefinitionData = {
          ...mockDefinitionData,
          createdBy: 'FreeDictionaryAPI',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: apiDefinitionData }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.createDefinition({
          id: apiDefinitionData.id,
          word: apiDefinitionData.word,
          createdBy: apiDefinitionData.createdBy,
          definitionText: apiDefinitionData.definitionText,
        });

        expect(result).toEqual(apiDefinitionData);
        // Should not create user tracking for API definitions
        expect(userSchema.addCreatedNode).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException for definition text too long', async () => {
        const longDefinitionData = {
          ...mockDefinitionData,
          definitionText: 'a'.repeat(10001), // Exceed TEXT_LIMITS.MAX_DEFINITION_LENGTH
        };

        await expect(
          schema.createDefinition({
            id: longDefinitionData.id,
            word: longDefinitionData.word,
            createdBy: longDefinitionData.createdBy,
            definitionText: longDefinitionData.definitionText,
          }),
        ).rejects.toThrow(BadRequestException);
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException for empty definition text', async () => {
        await expect(
          schema.createDefinition({
            id: mockDefinitionData.id,
            word: mockDefinitionData.word,
            createdBy: mockDefinitionData.createdBy,
            definitionText: '',
          }),
        ).rejects.toThrow('Definition text cannot be empty');
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should throw error when parent word does not exist or has not passed inclusion', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.write.mockResolvedValue(mockResult);

        await expect(
          schema.createDefinition({
            id: mockDefinitionData.id,
            word: mockDefinitionData.word,
            createdBy: mockDefinitionData.createdBy,
            definitionText: mockDefinitionData.definitionText,
          }),
        ).rejects.toThrow('Failed to create definition');
      });

      it('should handle creation errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(new Error('Database error'));

        await expect(
          schema.createDefinition({
            id: mockDefinitionData.id,
            word: mockDefinitionData.word,
            createdBy: mockDefinitionData.createdBy,
            definitionText: mockDefinitionData.definitionText,
          }),
        ).rejects.toThrow('Failed to create definition');
      });
    });

    describe('getDefinitionsByWord', () => {
      it('should get definitions for a word', async () => {
        const mockDefinitions = [mockDefinitionData];
        const mockRecords = mockDefinitions.map((definition) => ({
          get: jest.fn().mockReturnValue({ properties: definition }),
        }));
        const mockResult = {
          records: mockRecords,
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getDefinitionsByWord('test');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (d:DefinitionNode {word: $word})'),
          { word: 'test' },
        );
        expect(result).toEqual(mockDefinitions);
      });

      it('should validate word input', async () => {
        await expect(schema.getDefinitionsByWord('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('getApprovedDefinitions', () => {
      it('should get approved definitions for a word', async () => {
        const approvedDefinition = {
          ...mockDefinitionData,
          inclusionNetVotes: 5, // Approved
        };
        const mockRecords = [
          {
            get: jest.fn().mockReturnValue({ properties: approvedDefinition }),
          },
        ];
        const mockResult = {
          records: mockRecords,
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getApprovedDefinitions('test');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('WHERE d.inclusionNetVotes > 0'),
          { word: 'test' },
        );
        expect(result).toEqual([approvedDefinition]);
      });

      it('should validate word input', async () => {
        await expect(schema.getApprovedDefinitions('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });
  });

  describe('Protected Method Testing', () => {
    describe('supportsContentVoting', () => {
      it('should return true (definitions support content voting)', () => {
        // Access protected method for testing
        const supportsContent = (schema as any).supportsContentVoting();
        expect(supportsContent).toBe(true);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should map node properties correctly', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              id: 'definition-123',
              word: 'test',
              createdBy: 'user-456',
              definitionText: 'Test definition',
              discussion: 'Test discussion',
              createdAt: new Date('2023-01-01T00:00:00Z'),
              updatedAt: new Date('2023-01-01T00:00:00Z'),
              inclusionPositiveVotes: 5,
              inclusionNegativeVotes: 2,
              inclusionNetVotes: 3,
              contentPositiveVotes: 8,
              contentNegativeVotes: 1,
              contentNetVotes: 7,
            },
          }),
        } as unknown as Record;

        // Access protected method for testing
        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(result).toEqual({
          id: 'definition-123',
          word: 'test',
          createdBy: 'user-456',
          definitionText: 'Test definition',
          discussion: 'Test discussion',
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
          inclusionPositiveVotes: 5,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 3,
          contentPositiveVotes: 8,
          contentNegativeVotes: 1,
          contentNetVotes: 7,
        });
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build correct update query', () => {
        const updateData = { definitionText: 'Updated definition' };

        // Access protected method for testing
        const result = (schema as any).buildUpdateQuery(
          'definition-123',
          updateData,
        );

        expect(result.cypher).toContain('MATCH (n:DefinitionNode {id: $id})');
        expect(result.cypher).toContain('SET');
        expect(result.cypher).toContain('n.updatedAt = datetime()');
        expect(result.params).toEqual({
          id: 'definition-123',
          updateData,
        });
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete definition lifecycle', async () => {
      // Create
      const mockCreateRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockCreateRecord],
      } as unknown as Result);

      const created = await schema.createDefinition({
        id: mockDefinitionData.id,
        word: mockDefinitionData.word,
        createdBy: mockDefinitionData.createdBy,
        definitionText: mockDefinitionData.definitionText,
      });
      expect(created).toEqual(mockDefinitionData);

      // Read
      const mockReadRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [mockReadRecord],
      } as unknown as Result);

      const found = await schema.findById(mockDefinitionData.id);
      expect(found).toEqual(mockDefinitionData);

      // Vote
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const voteResult = await schema.voteInclusion(
        mockDefinitionData.id,
        'user-456',
        true,
      );
      expect(voteResult).toEqual(mockVoteResult);

      // Update
      const updateData = { definitionText: 'Updated definition' };
      const updatedDefinition = { ...mockDefinitionData, ...updateData };
      const mockUpdateRecord = {
        get: jest.fn().mockReturnValue({ properties: updatedDefinition }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockUpdateRecord],
      } as unknown as Result);

      const updated = await schema.update(mockDefinitionData.id, updateData);
      expect(updated).toEqual(updatedDefinition);

      // Delete
      const existsRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [existsRecord],
      } as unknown as Result);
      neo4jService.write.mockResolvedValueOnce({} as Result);

      const deleteResult = await schema.delete(mockDefinitionData.id);
      expect(deleteResult).toEqual({ success: true });
    });
  });
});
