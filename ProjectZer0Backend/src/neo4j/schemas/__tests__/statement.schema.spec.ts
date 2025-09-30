// src/neo4j/schemas/__tests__/statement.schema.spec.ts - UPDATED

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StatementSchema, StatementData } from '../statement.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { DiscussionSchema } from '../discussion.schema';
import { UserSchema } from '../user.schema';
import { Record, Result, Integer } from 'neo4j-driver';

describe('StatementSchema', () => {
  let schema: StatementSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  let userSchema: jest.Mocked<UserSchema>;

  const mockStatementData: StatementData = {
    id: 'statement-123',
    createdBy: 'user-456',
    publicCredit: true,
    statement: 'This is a test statement',
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
    inclusionPositiveVotes: 10,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 8,
    contentPositiveVotes: 15,
    contentNegativeVotes: 3,
    contentNetVotes: 12,
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 10,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 8,
    contentPositiveVotes: 15,
    contentNegativeVotes: 3,
    contentNetVotes: 12,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 10,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 8,
    contentStatus: 'agree',
    contentPositiveVotes: 15,
    contentNegativeVotes: 3,
    contentNetVotes: 12,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatementSchema,
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
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
        {
          provide: UserSchema,
          useValue: {
            addCreatedNode: jest.fn(),
          },
        },
      ],
    }).compile();

    schema = module.get<StatementSchema>(StatementSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
    discussionSchema = module.get(DiscussionSchema);
    userSchema = module.get(UserSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Inherited Methods', () => {
    describe('findById', () => {
      it('should find a statement by id', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockStatementData }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.findById('statement-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:StatementNode {id: $id})'),
          { id: 'statement-123' },
        );
        expect(result).toEqual(mockStatementData);
      });

      it('should return null when statement not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.findById('nonexistent');

        expect(result).toBeNull();
      });

      it('should validate input', async () => {
        await expect(schema.findById('')).rejects.toThrow(BadRequestException);
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('update', () => {
      it('should update statement using inherited method', async () => {
        const updateData = { publicCredit: false };
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockStatementData, ...updateData },
          }),
        } as unknown as Record;

        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.update('statement-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:StatementNode {id: $id})'),
          expect.objectContaining({
            id: 'statement-123',
            updateData,
          }),
        );
        expect(result?.publicCredit).toBe(false);
      });

      it('should validate input', async () => {
        await expect(schema.update('', {})).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });

    describe('delete', () => {
      it('should detach and delete a statement', async () => {
        // Mock the existence check
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

        // Mock the delete operation
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.delete('statement-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:StatementNode {id: $id})'),
          { id: 'statement-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE n'),
          { id: 'statement-123' },
        );
        expect(result).toEqual({ success: true });
      });

      it('should throw NotFoundException when statement not found', async () => {
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(0)),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

        await expect(schema.delete('nonexistent')).rejects.toThrow(
          NotFoundException,
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should validate input', async () => {
        await expect(schema.delete('')).rejects.toThrow(BadRequestException);
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });
  });

  describe('Voting Methods', () => {
    describe('voteInclusion', () => {
      it('should vote on statement inclusion', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteInclusion(
          'statement-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'StatementNode',
          { id: 'statement-123' },
          'user-456',
          true,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('voteContent', () => {
      it('should allow content voting when inclusion threshold passed', async () => {
        const mockStatement = { ...mockStatementData, inclusionNetVotes: 5 };
        jest.spyOn(schema, 'findById').mockResolvedValue(mockStatement);
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteContent(
          'statement-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'StatementNode',
          { id: 'statement-123' },
          'user-456',
          true,
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should reject content voting when inclusion threshold not passed', async () => {
        const mockStatement = { ...mockStatementData, inclusionNetVotes: 0 };
        jest.spyOn(schema, 'findById').mockResolvedValue(mockStatement);

        await expect(
          schema.voteContent('statement-123', 'user-456', true),
        ).rejects.toThrow(
          'Statement must pass inclusion threshold before content voting is allowed',
        );
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus', () => {
      it('should get vote status', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('statement-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'StatementNode',
          { id: 'statement-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });
    });

    describe('removeVote', () => {
      it('should remove a vote', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeVote(
          'statement-123',
          'user-456',
          'INCLUSION',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'StatementNode',
          { id: 'statement-123' },
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('getVotes', () => {
      it('should get vote counts', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('statement-123');

        expect(result).toEqual({
          inclusionPositiveVotes: 10,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 8,
          contentPositiveVotes: 15,
          contentNegativeVotes: 3,
          contentNetVotes: 12,
        });
      });
    });
  });

  describe('createStatement', () => {
    it('should create a statement with keywords and categories', async () => {
      const createData = {
        createdBy: 'user-456',
        publicCredit: true,
        statement: 'Test statement',
        keywords: [{ word: 'test', frequency: 1, source: 'user' as const }],
        categoryIds: ['cat1'],
        initialComment: 'Initial comment',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockStatementData }),
      } as unknown as Record;

      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });

      userSchema.addCreatedNode.mockResolvedValue(undefined);

      const result = await schema.createStatement(createData);

      expect(neo4jService.write).toHaveBeenCalled();
      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalled();
      expect(userSchema.addCreatedNode).toHaveBeenCalled();
      expect(result).toEqual({
        ...mockStatementData,
        discussionId: 'discussion-123',
        parentStatementId: undefined,
      });
    });

    it('should reject empty statement text', async () => {
      await expect(
        schema.createStatement({
          createdBy: 'user-456',
          publicCredit: true,
          statement: '',
          keywords: [],
        }),
      ).rejects.toThrow('Statement text cannot be empty');
    });

    it('should reject too many categories', async () => {
      await expect(
        schema.createStatement({
          createdBy: 'user-456',
          publicCredit: true,
          statement: 'Test',
          keywords: [],
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        }),
      ).rejects.toThrow('Statement can have maximum 3 categories');
    });
  });

  describe('getStatement', () => {
    it('should retrieve statement with relationships', async () => {
      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 's' || key === 'n') {
            return { properties: mockStatementData };
          }
          if (key === 'discussionId') return 'discussion-123';
          if (key === 'keywords')
            return [{ word: 'test', frequency: 1, source: 'user' }];
          if (key === 'categories') return [{ id: 'cat1', name: 'Category 1' }];
          if (key === 'relatedStatements') return [];
          if (key === 'directlyRelatedStatements') return [];
          return null;
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getStatement('statement-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('statement-123');
      expect(result?.discussionId).toBe('discussion-123');
    });

    it('should return null when statement not found', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as unknown as Result);

      const result = await schema.getStatement('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle null values from DB gracefully', async () => {
      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 's' || key === 'n') {
            return { properties: mockStatementData };
          }
          if (key === 'discussionId') return null;
          // Return empty arrays for collections, not arrays with null
          if (key === 'keywords') return [];
          if (key === 'categories') return [];
          if (key === 'relatedStatements') return [];
          if (key === 'directlyRelatedStatements') return [];
          return null;
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getStatement('statement-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('statement-123');
      // These should not be set since arrays are empty
      expect(result?.keywords).toBeUndefined();
      expect(result?.categories).toBeUndefined();
    });

    it('should validate input', async () => {
      await expect(schema.getStatement('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateStatement', () => {
    it('should handle simple updates', async () => {
      const updateData = { publicCredit: false };

      jest.spyOn(schema, 'update').mockResolvedValue({
        ...mockStatementData,
        ...updateData,
      });

      const result = await schema.updateStatement('statement-123', updateData);

      expect(result?.publicCredit).toBe(false);
    });

    it('should handle complex updates with keywords', async () => {
      const updateData = {
        keywords: [{ word: 'updated', frequency: 1, source: 'user' as const }],
      };

      jest.spyOn(schema, 'updateKeywords').mockResolvedValue(undefined);
      jest.spyOn(schema, 'getStatement').mockResolvedValue({
        ...mockStatementData,
        keywords: updateData.keywords,
      });

      const result = await schema.updateStatement('statement-123', updateData);

      expect(result).toBeDefined();
    });

    it('should return null if the inherited update returns null', async () => {
      jest.spyOn(schema, 'update').mockResolvedValue(null);

      const result = await schema.updateStatement('nonexistent', {
        publicCredit: false,
      });

      expect(result).toBeNull();
    });

    it('should validate input', async () => {
      await expect(schema.updateStatement('', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Direct Relationships', () => {
    it('should create direct relationship between statements', async () => {
      neo4jService.write.mockResolvedValue({} as Result);

      const result = await schema.createDirectRelationship(
        'statement-1',
        'statement-2',
      );

      expect(neo4jService.write).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should remove direct relationship', async () => {
      neo4jService.write.mockResolvedValue({} as Result);

      const result = await schema.removeDirectRelationship(
        'statement-1',
        'statement-2',
      );

      expect(result).toEqual({ success: true });
    });

    it('should get directly related statements', async () => {
      const mockRecords = [
        {
          get: jest.fn().mockReturnValue({ properties: mockStatementData }),
        },
      ] as unknown as Record[];

      neo4jService.read.mockResolvedValue({
        records: mockRecords,
      } as unknown as Result);

      const result = await schema.getDirectlyRelatedStatements('statement-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('getStatementNetwork', () => {
    it('should get statement network with filters', async () => {
      const mockNodes = [
        {
          properties: mockStatementData,
        },
      ];

      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'nodes') return mockNodes;
          if (key === 'tagEdges') return [];
          if (key === 'categoryEdges') return [];
          return null;
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getStatementNetwork({
        limit: 10,
        keywords: ['test'],
        categories: ['cat1'],
      });

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
    });
  });

  describe('checkStatements', () => {
    it('should return statement count', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(42)),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.checkStatements();

      expect(result).toEqual({ count: 42 });
    });
  });

  describe('Input Validation', () => {
    it('should reject null/undefined IDs', async () => {
      await expect(schema.findById(null as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(schema.findById(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject whitespace-only statement text', async () => {
      await expect(
        schema.createStatement({
          createdBy: 'user-456',
          publicCredit: true,
          statement: '   ',
          keywords: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Neo4j Integer Conversion', () => {
    it('should convert Neo4j Integer objects to numbers', async () => {
      const mockDataWithIntegers = {
        ...mockStatementData,
        inclusionPositiveVotes: Integer.fromNumber(999),
        inclusionNetVotes: Integer.fromNumber(899),
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDataWithIntegers }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.findById('statement-123');

      expect(result?.inclusionPositiveVotes).toBe(999);
      expect(typeof result?.inclusionPositiveVotes).toBe('number');
    });
  });
});
