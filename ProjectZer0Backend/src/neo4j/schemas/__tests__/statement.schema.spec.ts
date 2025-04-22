import { Test, TestingModule } from '@nestjs/testing';
import { StatementSchema } from '../statement.schema';
import { Neo4jService } from '../../../neo4j/neo4j.service';
import { VoteSchema } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';
import { NotFoundException } from '@nestjs/common';

describe('StatementSchema', () => {
  let schema: StatementSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

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
      ],
    }).compile();

    schema = module.get<StatementSchema>(StatementSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
  });

  it('should be defined', () => {
    expect(schema).toBeDefined();
  });

  describe('getStatementNetwork', () => {
    it('should retrieve statement network with default options', async () => {
      // Mock count query
      const mockCountResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(5)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockCountResult);

      const mockStatements = [
        { id: 'id1', statement: 'Test 1' },
        { id: 'id2', statement: 'Test 2' },
      ];

      const mockRecords = mockStatements.map((statement) => ({
        get: jest.fn().mockReturnValue(statement),
      })) as unknown as Record[];

      const mockResult = {
        records: mockRecords,
      } as unknown as Result;

      neo4jService.read.mockResolvedValueOnce(mockResult);

      const result = await schema.getStatementNetwork({});

      expect(neo4jService.read).toHaveBeenCalled();
      expect(result).toEqual(mockStatements);
    });

    it('should return empty array when no statements exist', async () => {
      // Mock count returns zero
      const mockCountResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(0)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockCountResult);

      const result = await schema.getStatementNetwork({});

      expect(result).toEqual([]);
    });

    it('should apply filters correctly', async () => {
      // Mock count query
      const mockCountResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(5)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockCountResult);

      // Mock empty result
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockResult);

      await schema.getStatementNetwork({
        limit: 10,
        offset: 5,
        sortBy: 'netPositive',
        sortDirection: 'desc',
        keywords: ['test', 'keyword'],
        userId: 'user1',
      });

      // Verify that the query contains the parameters
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          limit: 10,
          offset: 5,
          keywords: ['test', 'keyword'],
          userId: 'user1',
        }),
      );
    });

    it('should handle error when counting statements', async () => {
      // Mock error in count query
      neo4jService.read.mockRejectedValueOnce(new Error('Database error'));

      // Should still try to get statements
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockResult);

      await schema.getStatementNetwork({});

      // Second read should still be called
      expect(neo4jService.read).toHaveBeenCalledTimes(2);
    });
  });

  describe('createStatement', () => {
    it('should create a statement with keywords', async () => {
      const statementData = {
        id: 'statement-id',
        createdBy: 'user-id',
        publicCredit: true,
        statement: 'Test statement',
        keywords: [
          { word: 'test', frequency: 1, source: 'ai' as const },
          { word: 'keyword', frequency: 2, source: 'user' as const },
        ] as KeywordWithFrequency[],
        initialComment: 'Initial comment',
      };

      const mockStatement = {
        id: statementData.id,
        statement: statementData.statement,
      };
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockStatement }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.createStatement(statementData);

      expect(neo4jService.write).toHaveBeenCalled();
      expect(result).toEqual(mockStatement);
    });

    it('should throw error when a word node is not found', async () => {
      const statementData = {
        id: 'statement-id',
        createdBy: 'user-id',
        publicCredit: true,
        statement: 'Test statement',
        keywords: [
          { word: 'nonexistent', frequency: 1, source: 'ai' as const },
        ] as KeywordWithFrequency[],
        initialComment: 'Initial comment',
      };

      // Mock error for missing word node
      neo4jService.write.mockRejectedValue(new Error('not found'));

      await expect(schema.createStatement(statementData)).rejects.toThrow();
    });
  });

  describe('getStatement', () => {
    it('should retrieve a statement by id', async () => {
      const mockStatement = {
        id: 'statement-id',
        statement: 'Test statement',
      };
      const mockKeywords = [{ word: 'test', frequency: 1, source: 'ai' }];
      const mockRelatedStatements = [
        { nodeId: 'related-id', statement: 'Related', sharedWord: 'test' },
      ];
      const mockDirectRelations = [
        {
          nodeId: 'direct-id',
          statement: 'Direct',
          relationshipType: 'direct',
        },
      ];

      const mockRecord = {
        get: jest
          .fn()
          .mockReturnValueOnce({ properties: mockStatement })
          .mockReturnValueOnce(mockKeywords)
          .mockReturnValueOnce(mockRelatedStatements)
          .mockReturnValueOnce(mockDirectRelations),
      } as unknown as Record;

      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getStatement('statement-id');

      expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
        id: 'statement-id',
      });
      expect(result).toEqual({
        ...mockStatement,
        keywords: mockKeywords,
        relatedStatements: mockRelatedStatements,
        directlyRelatedStatements: mockDirectRelations,
      });
    });

    it('should return null when statement is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getStatement('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateStatement', () => {
    it('should update a statement with keywords', async () => {
      const updateData = {
        statement: 'Updated statement',
        keywords: [
          { word: 'updated', frequency: 1, source: 'ai' as const },
          { word: 'keyword', frequency: 2, source: 'user' as const },
        ] as KeywordWithFrequency[],
      };

      const mockUpdatedStatement = {
        id: 'statement-id',
        statement: updateData.statement,
      };
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUpdatedStatement }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.updateStatement('statement-id', updateData);

      expect(neo4jService.write).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedStatement);
    });

    it('should update a statement without keywords', async () => {
      const updateData = {
        publicCredit: false,
      };

      const mockUpdatedStatement = {
        id: 'statement-id',
        publicCredit: false,
      };
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUpdatedStatement }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.updateStatement('statement-id', updateData);

      expect(neo4jService.write).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedStatement);
    });
  });

  describe('deleteStatement', () => {
    it('should delete a statement', async () => {
      // Mock the statement check first
      const mockCheckResult = {
        records: [
          {
            get: jest
              .fn()
              .mockReturnValue({ properties: { id: 'statement-id' } }),
          },
        ],
      } as unknown as Result;

      neo4jService.read.mockResolvedValueOnce(mockCheckResult);

      // Mock the delete operation
      neo4jService.write.mockResolvedValueOnce({} as unknown as Result);

      const result = await schema.deleteStatement('statement-id');

      expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
        id: 'statement-id',
      });

      expect(neo4jService.write).toHaveBeenCalledWith(expect.any(String), {
        id: 'statement-id',
      });

      expect(result).toEqual({
        success: true,
        message: expect.stringContaining('statement-id'),
      });
    });

    it('should throw NotFoundException when statement does not exist', async () => {
      // Mock statement not found
      const mockCheckResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockCheckResult);

      await expect(schema.deleteStatement('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );

      // The write method should not be called when statement doesn't exist
      expect(neo4jService.write).not.toHaveBeenCalled();
    });
  });

  describe('visibility methods', () => {
    it('should set visibility status', async () => {
      const mockUpdatedStatement = {
        id: 'statement-id',
        visibilityStatus: false,
      };
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUpdatedStatement }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.setVisibilityStatus('statement-id', false);

      expect(neo4jService.write).toHaveBeenCalledWith(expect.any(String), {
        id: 'statement-id',
        isVisible: false,
      });
      expect(result).toEqual(mockUpdatedStatement);
    });

    it('should get visibility status', async () => {
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(true) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getVisibilityStatus('statement-id');

      expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
        id: 'statement-id',
      });
      expect(result).toBe(true);
    });

    it('should default to true when visibility status not found', async () => {
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(null) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getVisibilityStatus('statement-id');

      expect(result).toBe(true);
    });
  });

  describe('vote methods', () => {
    it('should call voteSchema.vote for voteStatement', async () => {
      const mockVoteResult = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await schema.voteStatement(
        'statement-id',
        'user-id',
        true,
      );

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'StatementNode',
        { id: 'statement-id' },
        'user-id',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should call voteSchema.getVoteStatus for getStatementVoteStatus', async () => {
      const mockVoteStatus = {
        status: 'agree' as const,
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };
      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await schema.getStatementVoteStatus(
        'statement-id',
        'user-id',
      );

      expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
        'StatementNode',
        { id: 'statement-id' },
        'user-id',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should call voteSchema.removeVote for removeStatementVote', async () => {
      const mockVoteResult = {
        positiveVotes: 4,
        negativeVotes: 2,
        netVotes: 2,
      };
      voteSchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await schema.removeStatementVote(
        'statement-id',
        'user-id',
      );

      expect(voteSchema.removeVote).toHaveBeenCalledWith(
        'StatementNode',
        { id: 'statement-id' },
        'user-id',
      );
      expect(result).toEqual(mockVoteResult);
    });
  });

  describe('relationship methods', () => {
    it('should create a direct relationship between statements', async () => {
      const mockResult = {
        records: [],
        summary: { counters: { relationshipsCreated: 1 } },
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.createDirectRelationship(
        'statement1',
        'statement2',
      );

      expect(neo4jService.write).toHaveBeenCalledWith(expect.any(String), {
        statementId1: 'statement1',
        statementId2: 'statement2',
      });
      expect(result).toEqual({ success: true });
    });

    it('should remove a direct relationship between statements', async () => {
      const mockResult = {
        records: [],
        summary: { counters: { relationshipsDeleted: 1 } },
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.removeDirectRelationship(
        'statement1',
        'statement2',
      );

      expect(neo4jService.write).toHaveBeenCalledWith(expect.any(String), {
        statementId1: 'statement1',
        statementId2: 'statement2',
      });
      expect(result).toEqual({ success: true });
    });

    it('should get directly related statements', async () => {
      const mockRelatedStatements = [
        { id: 'related1', statement: 'Related 1' },
        { id: 'related2', statement: 'Related 2' },
      ];
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(mockRelatedStatements) }],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getDirectlyRelatedStatements('statement-id');

      expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
        statementId: 'statement-id',
      });
      expect(result).toEqual(mockRelatedStatements);
    });
  });

  describe('checkStatements', () => {
    it('should return statement count', async () => {
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(42)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.checkStatements();

      expect(neo4jService.read).toHaveBeenCalled();
      expect(result).toEqual({ count: 42 });
    });
  });
});
