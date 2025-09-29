// src/neo4j/schemas/__tests__/definition.schema.spec.ts - UPDATED

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DefinitionSchema, DefinitionData } from '../definition.schema';
import { Neo4jService } from '../../neo4j.service';
import { UserSchema } from '../user.schema';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { DiscussionSchema } from '../discussion.schema';
import { Record, Result, Integer } from 'neo4j-driver';

describe('DefinitionSchema with BaseNodeSchema Integration', () => {
  let schema: DefinitionSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let userSchema: jest.Mocked<UserSchema>;
  let voteSchema: jest.Mocked<VoteSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;

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
          provide: DiscussionSchema,
          useValue: {
            createDiscussionForNode: jest.fn(),
          },
        },
      ],
    }).compile();

    schema = module.get<DefinitionSchema>(DefinitionSchema);
    neo4jService = module.get(Neo4jService);
    userSchema = module.get(UserSchema);
    voteSchema = module.get(VoteSchema);
    discussionSchema = module.get(DiscussionSchema);
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
      it('should build correct update query excluding id and word', () => {
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
        expect(result.cypher).not.toContain('n.id =');
        expect(result.cypher).not.toContain('n.word =');
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

  describe('Inherited CRUD Operations', () => {
    describe('findById (inherited)', () => {
      it('should find a definition by id', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.findById('definition-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:DefinitionNode {id: $id})'),
          { id: 'definition-123' },
        );
        expect(result).toEqual(mockDefinitionData);
      });

      it('should return null when definition not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.findById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('update (inherited)', () => {
      it('should update definition', async () => {
        const updateData = {
          definitionText: 'Updated definition text',
          publicCredit: false,
        };
        const updatedDefinition = { ...mockDefinitionData, ...updateData };
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedDefinition }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.update('definition-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:DefinitionNode {id: $id})'),
          expect.objectContaining({
            id: 'definition-123',
            updateData,
          }),
        );
        expect(result?.definitionText).toBe('Updated definition text');
      });
    });

    describe('delete (inherited)', () => {
      it('should delete definition', async () => {
        // Mock existence check
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);
        neo4jService.write.mockResolvedValue({} as Result);

        const result = await schema.delete('definition-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('COUNT(n) as count'),
          { id: 'definition-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE n'),
          { id: 'definition-123' },
        );
        expect(result).toEqual({ success: true });
      });
    });
  });

  describe('TaggedNodeSchema Integration', () => {
    describe('inherited keyword methods', () => {
      it('should have keyword methods from TaggedNodeSchema', () => {
        expect(typeof schema.getKeywords).toBe('function');
        expect(typeof schema.updateKeywords).toBe('function');
        expect(typeof schema.findRelatedByTags).toBe('function');
      });

      it('should get keywords for a definition', async () => {
        const mockRecords = [
          {
            get: jest.fn((field: string) => {
              if (field === 'word') return 'test';
              if (field === 'frequency') return Integer.fromNumber(1);
              if (field === 'source') return 'definition';
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getKeywords('definition-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:DefinitionNode {id: $nodeId})'),
          { nodeId: 'definition-123' },
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          word: 'test',
          frequency: 1,
          source: 'definition',
        });
      });

      it('should find related definitions by tags', async () => {
        const mockRecords = [
          {
            get: jest.fn((field: string) => {
              if (field === 'nodeId') return 'related-def-1';
              if (field === 'sharedWords') return ['test'];
              if (field === 'strength') return Integer.fromNumber(5);
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.findRelatedByTags('definition-123');

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          nodeId: 'related-def-1',
          sharedWords: ['test'],
          strength: 5,
        });
      });
    });
  });

  describe('Definition-Specific Methods', () => {
    describe('createDefinition', () => {
      it('should create definition successfully for approved word', async () => {
        const createData = {
          id: 'definition-123',
          word: 'test',
          createdBy: 'user-456',
          definitionText: 'This is a test definition.',
          initialComment: 'Initial comment',
        };

        // Mock the write operation
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        // Mock discussion creation
        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-789',
        });

        // Mock user tracking
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
            isApiDefinition: false,
            isAICreated: false,
          }),
        );

        expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
          nodeId: 'definition-123',
          nodeType: 'DefinitionNode',
          nodeIdField: 'id',
          createdBy: 'user-456',
          initialComment: 'Initial comment',
        });

        expect(userSchema.addCreatedNode).toHaveBeenCalledWith(
          'user-456',
          'definition-123',
          'definition',
        );

        expect(result.discussionId).toBe('discussion-789');
      });

      it('should validate definition text length', async () => {
        const invalidData = {
          id: 'definition-123',
          word: 'test',
          createdBy: 'user-456',
          definitionText: 'x'.repeat(281), // Exceeds TEXT_LIMITS.MAX_DEFINITION_LENGTH (280)
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
          "Word 'nonexistent' does not exist or has not passed inclusion threshold",
        );
      });

      it('should not create user relationship for API definitions', async () => {
        const apiDefinitionData = {
          id: 'definition-123',
          word: 'test',
          createdBy: 'FreeDictionaryAPI',
          definitionText: 'API-generated definition',
          isApiDefinition: true,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-789',
        });

        await schema.createDefinition(apiDefinitionData);

        expect(userSchema.addCreatedNode).not.toHaveBeenCalled();
      });

      it('should not create user relationship for AI definitions', async () => {
        const aiDefinitionData = {
          id: 'definition-123',
          word: 'test',
          createdBy: 'ProjectZeroAI',
          definitionText: 'AI-generated definition',
          isAICreated: true,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-789',
        });

        await schema.createDefinition(aiDefinitionData);

        expect(userSchema.addCreatedNode).not.toHaveBeenCalled();
      });

      it('should generate id if not provided', async () => {
        const createData = {
          word: 'test',
          createdBy: 'user-456',
          definitionText: 'Test definition',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-789',
        });

        await schema.createDefinition(createData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            id: expect.stringMatching(/^[a-f0-9-]{36}$/), // UUID pattern
          }),
        );
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

      it('should standardize word to lowercase', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getDefinitionsByWord('TeSt');

        expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
          word: 'test',
        });
      });
    });

    describe('getTopDefinitionForWord', () => {
      it('should return top-voted definition for a word', async () => {
        const mockDefinitions = [
          {
            ...mockDefinitionData,
            id: 'def-1',
            inclusionNetVotes: 10,
            contentNetVotes: 15,
          },
          {
            ...mockDefinitionData,
            id: 'def-2',
            inclusionNetVotes: 8,
            contentNetVotes: 20, // Higher content score
          },
        ];

        jest
          .spyOn(schema, 'getDefinitionsByWord')
          .mockResolvedValue(mockDefinitions);

        const result = await schema.getTopDefinitionForWord('test');

        expect(result).toBeDefined();
        expect(result?.id).toBe('def-2'); // Higher content votes wins
      });

      it('should return null when no approved definitions', async () => {
        const unapprovedDefinitions = [
          {
            ...mockDefinitionData,
            inclusionNetVotes: 0, // Not approved
          },
        ];

        jest
          .spyOn(schema, 'getDefinitionsByWord')
          .mockResolvedValue(unapprovedDefinitions);

        const result = await schema.getTopDefinitionForWord('test');

        expect(result).toBeNull();
      });

      it('should return null when no definitions exist', async () => {
        jest.spyOn(schema, 'getDefinitionsByWord').mockResolvedValue([]);

        const result = await schema.getTopDefinitionForWord('test');

        expect(result).toBeNull();
      });
    });

    describe('getDefinitionsByUser', () => {
      it('should get all definitions created by a user', async () => {
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

        const result = await schema.getDefinitionsByUser('user-456');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (d:DefinitionNode {createdBy: $userId})',
          ),
          { userId: 'user-456' },
        );
        expect(result).toHaveLength(1);
        expect(result[0].createdBy).toBe('user-456');
      });

      it('should validate user ID', async () => {
        await expect(schema.getDefinitionsByUser('')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should return empty array when user has no definitions', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getDefinitionsByUser('user-without-defs');

        expect(result).toEqual([]);
      });
    });

    describe('canCreateDefinitionForWord', () => {
      it('should return true when word exists and passed inclusion', async () => {
        neo4jService.read.mockResolvedValue({
          records: [
            {
              get: jest.fn().mockReturnValue(true),
            } as unknown as Record,
          ],
        } as unknown as Result);

        const result = await schema.canCreateDefinitionForWord('test');

        expect(result).toBe(true);
      });

      it('should return false when word has not passed inclusion', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.canCreateDefinitionForWord('unapproved');

        expect(result).toBe(false);
      });

      it('should standardize word to lowercase', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.canCreateDefinitionForWord('TeSt');

        expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
          word: 'test',
        });
      });
    });

    describe('getDefinitionStats', () => {
      it('should return definition statistics', async () => {
        const mockRecord = {
          get: jest.fn((field) => {
            if (field === 'totalDefinitions') return Integer.fromNumber(100);
            if (field === 'approvedDefinitions') return Integer.fromNumber(75);
            if (field === 'apiDefinitions') return Integer.fromNumber(30);
            if (field === 'userDefinitions') return Integer.fromNumber(70);
            return 0;
          }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getDefinitionStats();

        expect(result).toEqual({
          totalDefinitions: 100,
          approvedDefinitions: 75,
          apiDefinitions: 30,
          userDefinitions: 70,
        });
      });

      it('should handle database errors', async () => {
        neo4jService.read.mockRejectedValue(new Error('Database error'));

        await expect(schema.getDefinitionStats()).rejects.toThrow(
          'Failed to get definition stats Definition: Database error',
        );
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete definition lifecycle', async () => {
      // Step 1: Create definition
      const createRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [createRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      const created = await schema.createDefinition({
        id: mockDefinitionData.id,
        word: mockDefinitionData.word,
        createdBy: mockDefinitionData.createdBy,
        definitionText: mockDefinitionData.definitionText,
      });
      expect(created.id).toBe(mockDefinitionData.id);

      // Step 2: Read definition
      const readRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [readRecord],
      } as unknown as Result);

      const found = await schema.findById(mockDefinitionData.id);
      expect(found).toEqual(mockDefinitionData);

      // Step 3: Vote on inclusion
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const inclusionVote = await schema.voteInclusion(
        mockDefinitionData.id,
        'user-456',
        true,
      );
      expect(inclusionVote).toEqual(mockVoteResult);

      // Step 4: Vote on content (after inclusion passed)
      const approvedDefRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockDefinitionData, inclusionNetVotes: 5 },
        }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [approvedDefRecord],
      } as unknown as Result);

      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const contentVote = await schema.voteContent(
        mockDefinitionData.id,
        'user-456',
        true,
      );
      expect(contentVote).toEqual(mockVoteResult);

      // Step 5: Update definition
      const updateData = { definitionText: 'Updated definition' };
      const updatedDefinition = { ...mockDefinitionData, ...updateData };
      const updateRecord = {
        get: jest.fn().mockReturnValue({ properties: updatedDefinition }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [updateRecord],
      } as unknown as Result);

      const updated = await schema.update(mockDefinitionData.id, updateData);
      expect(updated).toEqual(updatedDefinition);

      // Step 6: Delete definition
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

    it('should handle API definition creation differently', async () => {
      const apiDefinition = {
        word: 'api-word',
        createdBy: 'FreeDictionaryAPI',
        definitionText: 'API definition',
        isApiDefinition: true,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockDefinitionData, ...apiDefinition },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-api',
      });

      await schema.createDefinition(apiDefinition);

      // Should not track user creation for API definitions
      expect(userSchema.addCreatedNode).not.toHaveBeenCalled();
    });

    it('should handle AI definition creation differently', async () => {
      const aiDefinition = {
        word: 'ai-word',
        createdBy: 'ProjectZeroAI',
        definitionText: 'AI definition',
        isAICreated: true,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockDefinitionData, ...aiDefinition },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-ai',
      });

      await schema.createDefinition(aiDefinition);

      // Should not track user creation for AI definitions
      expect(userSchema.addCreatedNode).not.toHaveBeenCalled();
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
        'Failed to get definitions by word Definition: Query timeout',
      );
    });

    it('should handle creation errors with proper messages', async () => {
      neo4jService.write.mockRejectedValue(
        new Error('Word not found or not approved'),
      );

      await expect(
        schema.createDefinition({
          word: 'unapproved',
          createdBy: 'user-456',
          definitionText: 'Test',
        }),
      ).rejects.toThrow(
        'Failed to create definition Definition: Word not found or not approved',
      );
    });
  });

  describe('Business Rules', () => {
    it('should enforce parent word must be approved', async () => {
      neo4jService.write.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await expect(
        schema.createDefinition({
          word: 'unapproved-word',
          createdBy: 'user-456',
          definitionText: 'Definition for unapproved word',
        }),
      ).rejects.toThrow(
        "Word 'unapproved-word' does not exist or has not passed inclusion threshold",
      );
    });

    it('should enforce content voting only after inclusion threshold', async () => {
      const unapprovedDef = {
        ...mockDefinitionData,
        inclusionNetVotes: 0,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: unapprovedDef }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await expect(
        schema.voteContent('definition-123', 'user-456', true),
      ).rejects.toThrow(
        'Definition must pass inclusion threshold before content voting is allowed',
      );
    });

    it('should create TAGGED relationship to parent word', async () => {
      const createData = {
        word: 'test',
        createdBy: 'user-456',
        definitionText: 'Test definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createDefinition(createData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (d)-[:TAGGED'),
        expect.any(Object),
      );
    });

    it('should standardize word to lowercase', async () => {
      const createData = {
        word: 'TeSt',
        createdBy: 'user-456',
        definitionText: 'Test definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createDefinition(createData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          word: 'test', // Should be lowercase
        }),
      );
    });
  });

  describe('Input Validation', () => {
    it('should validate word is required', async () => {
      await expect(
        schema.createDefinition({
          word: '',
          createdBy: 'user-456',
          definitionText: 'Test',
        }),
      ).rejects.toThrow('Word is required');
    });

    it('should validate definition text is required', async () => {
      await expect(
        schema.createDefinition({
          word: 'test',
          createdBy: 'user-456',
          definitionText: '',
        }),
      ).rejects.toThrow('Definition text cannot be empty');
    });

    it('should validate definition text length', async () => {
      await expect(
        schema.createDefinition({
          word: 'test',
          createdBy: 'user-456',
          definitionText: 'x'.repeat(281), // TEXT_LIMITS.MAX_DEFINITION_LENGTH is 280
        }),
      ).rejects.toThrow('Definition text cannot exceed 280 characters');
    });

    it('should trim whitespace from definition text', async () => {
      const createData = {
        word: 'test',
        createdBy: 'user-456',
        definitionText: '  Test definition  ',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createDefinition(createData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          definitionText: 'Test definition',
        }),
      );
    });
  });

  describe('Neo4j Integer Conversion', () => {
    it('should handle Neo4j Integer objects correctly', () => {
      const mockData = {
        ...mockDefinitionData,
        inclusionPositiveVotes: { low: 42, high: 0 },
        inclusionNegativeVotes: { low: 7, high: 0 },
        inclusionNetVotes: { low: 35, high: 0 },
        contentPositiveVotes: { low: 20, high: 0 },
        contentNegativeVotes: { low: 5, high: 0 },
        contentNetVotes: { low: 15, high: 0 },
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockData }),
      } as unknown as Record;

      const result = (schema as any).mapNodeFromRecord(mockRecord);

      expect(result.inclusionPositiveVotes).toBe(42);
      expect(result.inclusionNegativeVotes).toBe(7);
      expect(result.inclusionNetVotes).toBe(35);
      expect(result.contentPositiveVotes).toBe(20);
      expect(result.contentNegativeVotes).toBe(5);
      expect(result.contentNetVotes).toBe(15);
      expect(typeof result.inclusionPositiveVotes).toBe('number');
    });
  });

  describe('Special Properties', () => {
    it('should handle isApiDefinition flag', () => {
      const apiDef = {
        ...mockDefinitionData,
        isApiDefinition: true,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: apiDef }),
      } as unknown as Record;

      const result = (schema as any).mapNodeFromRecord(mockRecord);

      expect(result.isApiDefinition).toBe(true);
    });

    it('should handle isAICreated flag', () => {
      const aiDef = {
        ...mockDefinitionData,
        isAICreated: true,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: aiDef }),
      } as unknown as Record;

      const result = (schema as any).mapNodeFromRecord(mockRecord);

      expect(result.isAICreated).toBe(true);
    });

    it('should detect API definition by createdBy field', async () => {
      const apiDef = {
        word: 'test',
        createdBy: 'FreeDictionaryAPI',
        definitionText: 'API definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createDefinition(apiDef);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          isApiDefinition: true,
        }),
      );
    });

    it('should detect AI definition by createdBy field', async () => {
      const aiDef = {
        word: 'test',
        createdBy: 'ProjectZeroAI',
        definitionText: 'AI definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createDefinition(aiDef);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          isAICreated: true,
        }),
      );
    });
  });
});
