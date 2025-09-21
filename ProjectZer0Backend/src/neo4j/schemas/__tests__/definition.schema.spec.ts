// src/neo4j/schemas/__tests__/definition.schema.spec.ts - UPDATED

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

  const mockDefinitionData: DefinitionData = {
    id: 'definition-123',
    word: 'test',
    createdBy: 'user-456',
    publicCredit: true,
    definitionText: 'This is a test definition of the word test.',
    discussionId: 'discussion-789',
    createdAt: new Date('2023-06-20T10:00:00Z'),
    updatedAt: new Date('2023-06-20T10:00:00Z'),
    // Dual voting (both inclusion and content)
    inclusionPositiveVotes: 8,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 6,
    contentPositiveVotes: 12,
    contentNegativeVotes: 3,
    contentNetVotes: 9,
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 9,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 7,
    contentPositiveVotes: 13,
    contentNegativeVotes: 3,
    contentNetVotes: 10,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 9,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 7,
    contentStatus: 'agree',
    contentPositiveVotes: 13,
    contentNegativeVotes: 3,
    contentNetVotes: 10,
  };

  beforeEach(async () => {
    neo4jService = {
      read: jest.fn(),
      write: jest.fn(),
    } as any;

    userSchema = {
      addCreatedNode: jest.fn(),
    } as any;

    voteSchema = {
      vote: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DefinitionSchema,
        { provide: Neo4jService, useValue: neo4jService },
        { provide: UserSchema, useValue: userSchema },
        { provide: VoteSchema, useValue: voteSchema },
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

  describe('BaseNodeSchema Integration', () => {
    describe('supportsContentVoting', () => {
      it('should support both inclusion and content voting', () => {
        expect((schema as any).supportsContentVoting()).toBe(true);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should map Neo4j record to DefinitionData with all BaseNodeData fields', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(result).toEqual(mockDefinitionData);
        expect(result.createdBy).toBe('user-456');
        expect(result.publicCredit).toBe(true);
        expect(result.discussionId).toBe('discussion-789');
      });

      it('should convert Neo4j integers correctly', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              ...mockDefinitionData,
              inclusionPositiveVotes: Integer.fromNumber(8),
              inclusionNegativeVotes: Integer.fromNumber(2),
              inclusionNetVotes: Integer.fromNumber(6),
              contentPositiveVotes: Integer.fromNumber(12),
              contentNegativeVotes: Integer.fromNumber(3),
              contentNetVotes: Integer.fromNumber(9),
            },
          }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(typeof result.inclusionPositiveVotes).toBe('number');
        expect(typeof result.inclusionNegativeVotes).toBe('number');
        expect(typeof result.inclusionNetVotes).toBe('number');
        expect(typeof result.contentPositiveVotes).toBe('number');
        expect(typeof result.contentNegativeVotes).toBe('number');
        expect(typeof result.contentNetVotes).toBe('number');
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build correct update query', () => {
        const updateData = {
          definitionText: 'Updated definition',
          publicCredit: false,
        };
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

  describe('Inherited Voting Methods', () => {
    describe('voteInclusion', () => {
      it('should vote on inclusion using inherited method', async () => {
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

      it('should validate inputs', async () => {
        await expect(
          schema.voteInclusion('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(
          schema.voteInclusion('definition-123', '', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('voteContent with business logic', () => {
      it('should vote on content when definition has passed inclusion threshold', async () => {
        // Mock findById to return definition with positive inclusion votes
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteContent(
          'definition-123',
          'user-456',
          true,
        );

        expect(result).toEqual(mockVoteResult);
      });

      it('should reject content voting when definition has not passed inclusion threshold', async () => {
        const definitionWithNegativeVotes = {
          ...mockDefinitionData,
          inclusionNetVotes: -2, // Failed inclusion threshold
        };

        const mockRecord = {
          get: jest
            .fn()
            .mockReturnValue({ properties: definitionWithNegativeVotes }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        await expect(
          schema.voteContent('definition-123', 'user-456', true),
        ).rejects.toThrow(
          'Definition must pass inclusion threshold before content voting is allowed',
        );
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should reject content voting when definition not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(
          schema.voteContent('nonexistent', 'user-456', true),
        ).rejects.toThrow(
          'Definition must pass inclusion threshold before content voting is allowed',
        );
      });
    });

    describe('getVoteStatus', () => {
      it('should get vote status using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('definition-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });
    });

    describe('removeVote', () => {
      it('should remove vote using inherited method', async () => {
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
    });

    describe('getVotes', () => {
      it('should get vote counts using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('definition-123');

        expect(result).toEqual({
          inclusionPositiveVotes: mockVoteStatus.inclusionPositiveVotes,
          inclusionNegativeVotes: mockVoteStatus.inclusionNegativeVotes,
          inclusionNetVotes: mockVoteStatus.inclusionNetVotes,
          contentPositiveVotes: mockVoteStatus.contentPositiveVotes,
          contentNegativeVotes: mockVoteStatus.contentNegativeVotes,
          contentNetVotes: mockVoteStatus.contentNetVotes,
        });
      });
    });
  });

  describe('Definition-Specific Methods', () => {
    describe('createDefinition', () => {
      it('should create definition successfully', async () => {
        const createData = {
          id: 'definition-123',
          word: 'test',
          createdBy: 'user-456',
          definitionText: 'This is a test definition.',
          initialComment: 'Initial comment',
        };

        // Mock definition creation first
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        // Mock discussion creation second
        neo4jService.write.mockResolvedValueOnce({
          records: [{ get: jest.fn().mockReturnValue('discussion-789') }],
        } as unknown as Result);

        userSchema.addCreatedNode.mockResolvedValue(undefined);

        const result = await schema.createDefinition(createData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (d:DefinitionNode'),
          expect.objectContaining({
            id: createData.id,
            word: 'test', // Should be lowercase
            definitionText: createData.definitionText,
            createdBy: createData.createdBy,
            publicCredit: true, // Default
          }),
        );
        expect(result.discussionId).toBe('discussion-789');
      });

      it('should validate definition text length', async () => {
        const invalidData = {
          id: 'definition-123',
          word: 'test',
          createdBy: 'user-456',
          definitionText: 'x'.repeat(2001), // Exceeds TEXT_LIMITS.MAX_DEFINITION_LENGTH
        };

        await expect(schema.createDefinition(invalidData)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should validate definition text is not empty', async () => {
        const invalidData = {
          id: 'definition-123',
          word: 'test',
          createdBy: 'user-456',
          definitionText: '',
        };

        await expect(schema.createDefinition(invalidData)).rejects.toThrow(
          'Definition text cannot be empty',
        );

        const whitespaceData = {
          id: 'definition-123',
          word: 'test',
          createdBy: 'user-456',
          definitionText: '   \t\n  ',
        };

        await expect(schema.createDefinition(whitespaceData)).rejects.toThrow(
          'Definition text cannot be empty',
        );
      });

      it('should handle parent word validation failure', async () => {
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const createData = {
          id: 'definition-123',
          word: 'nonexistent',
          createdBy: 'user-456',
          definitionText: 'Definition for nonexistent word',
        };

        await expect(schema.createDefinition(createData)).rejects.toThrow(
          'Parent word not found or has not passed inclusion threshold',
        );
      });

      it('should not create user relationship for API definitions', async () => {
        const apiDefinitionData = {
          id: 'definition-123',
          word: 'test',
          createdBy: 'FreeDictionaryAPI',
          definitionText: 'API-generated definition',
        };

        // Mock definition creation first
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        // Mock discussion creation second
        neo4jService.write.mockResolvedValueOnce({
          records: [{ get: jest.fn().mockReturnValue('discussion-789') }],
        } as unknown as Result);

        await schema.createDefinition(apiDefinitionData);

        expect(userSchema.addCreatedNode).not.toHaveBeenCalled();
      });

      it('should not create user relationship for AI definitions', async () => {
        const aiDefinitionData = {
          id: 'definition-123',
          word: 'test',
          createdBy: 'ProjectZeroAI',
          definitionText: 'AI-generated definition',
        };

        // Mock definition creation first
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        // Mock discussion creation second
        neo4jService.write.mockResolvedValueOnce({
          records: [{ get: jest.fn().mockReturnValue('discussion-789') }],
        } as unknown as Result);

        await schema.createDefinition(aiDefinitionData);

        expect(userSchema.addCreatedNode).not.toHaveBeenCalled();
      });
    });

    describe('getDefinitionsByWord', () => {
      it('should get all definitions for a word', async () => {
        const mockRecords = [
          {
            get: jest.fn((field) => {
              if (field === 'n') return { properties: mockDefinitionData };
              if (field === 'discussionId') return 'discussion-789';
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getDefinitionsByWord('test');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (d:DefinitionNode {word: $word})'),
          { word: 'test' },
        );
        expect(result).toHaveLength(1);
        expect(result[0].word).toBe('test');
        expect(result[0].discussionId).toBe('discussion-789');
      });

      it('should validate word input', async () => {
        await expect(schema.getDefinitionsByWord('')).rejects.toThrow(
          'Word cannot be empty',
        );
        await expect(schema.getDefinitionsByWord('   ')).rejects.toThrow(
          'Word cannot be empty',
        );
      });

      it('should return empty array when no definitions found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getDefinitionsByWord('nonexistent');

        expect(result).toEqual([]);
      });
    });

    describe('getApprovedDefinitions', () => {
      it('should get only approved definitions (positive inclusion votes)', async () => {
        const approvedDefinition = {
          ...mockDefinitionData,
          inclusionNetVotes: 5, // Positive votes
        };

        const mockRecords = [
          {
            get: jest.fn((field) => {
              if (field === 'n') return { properties: approvedDefinition };
              if (field === 'discussionId') return 'discussion-789';
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getApprovedDefinitions('test');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('WHERE d.inclusionNetVotes > 0'),
          { word: 'test' },
        );
        expect(result).toHaveLength(1);
        expect(result[0].inclusionNetVotes).toBeGreaterThan(0);
      });

      it('should validate word input', async () => {
        await expect(schema.getApprovedDefinitions('')).rejects.toThrow(
          'Word cannot be empty',
        );
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

      // Mock discussion creation
      neo4jService.write.mockResolvedValueOnce({
        records: [{ get: jest.fn().mockReturnValue('discussion-789') }],
      } as unknown as Result);

      const created = await schema.createDefinition({
        id: mockDefinitionData.id,
        word: mockDefinitionData.word,
        createdBy: mockDefinitionData.createdBy,
        definitionText: mockDefinitionData.definitionText,
      });
      expect(created.id).toBe(mockDefinitionData.id);

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

      // Delete - should succeed when node exists
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

  describe('Error Handling', () => {
    it('should use standardized error messages from BaseNodeSchema', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.findById('test')).rejects.toThrow(
        'Failed to find Definition: Database connection failed',
      );
    });

    it('should handle definition-specific errors consistently', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query timeout'));

      await expect(schema.getDefinitionsByWord('test')).rejects.toThrow(
        'Failed to get definitions for word Definition: Query timeout',
      );
    });
  });
});
