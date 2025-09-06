// src/neo4j/schemas/__tests__/statement.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { StatementSchema } from '../statement.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from '../vote.schema';

describe('StatementSchema', () => {
  let schema: StatementSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  // Mock data constants
  const mockStatementData = {
    id: 'statement-123',
    createdBy: 'user-456',
    publicCredit: true,
    statement: 'This is a test statement about artificial intelligence.',
    categoryIds: ['tech-category', 'ai-category'],
    keywords: [
      { word: 'artificial', frequency: 8, source: 'ai' as const },
      { word: 'intelligence', frequency: 6, source: 'ai' as const },
      { word: 'test', frequency: 4, source: 'user' as const },
    ] as KeywordWithFrequency[],
    initialComment: 'This is my initial comment about the statement',
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 15,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 12,
    contentPositiveVotes: 20,
    contentNegativeVotes: 5,
    contentNetVotes: 15,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 15,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 12,
    contentStatus: 'agree',
    contentPositiveVotes: 20,
    contentNegativeVotes: 5,
    contentNetVotes: 15,
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
      ],
    }).compile();

    schema = module.get<StatementSchema>(StatementSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      // Mock count query returning 0
      const mockCountResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(0)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockCountResult);

      const result = await schema.getStatementNetwork({});

      expect(result).toEqual([]);
    });

    it('should handle filtering by keywords', async () => {
      const mockCountResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(1)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockCountResult);

      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockResult);

      await schema.getStatementNetwork({
        keywords: ['artificial', 'intelligence'],
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('w.word IN $keywords'),
        expect.objectContaining({
          keywords: ['artificial', 'intelligence'],
        }),
      );
    });
  });

  describe('createStatement', () => {
    const mockRecord = {
      get: jest.fn().mockReturnValue({ properties: mockStatementData }),
    } as unknown as Record;
    const mockResult = {
      records: [mockRecord],
    } as unknown as Result;

    beforeEach(() => {
      neo4jService.write.mockResolvedValue(mockResult);
    });

    it('should create a statement successfully', async () => {
      const result = await schema.createStatement(mockStatementData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (s:StatementNode'),
        expect.objectContaining({
          id: mockStatementData.id,
          statement: mockStatementData.statement,
          createdBy: mockStatementData.createdBy,
          publicCredit: mockStatementData.publicCredit,
          categoryIds: mockStatementData.categoryIds,
          keywords: mockStatementData.keywords,
        }),
      );
      expect(result).toEqual(mockStatementData);
    });

    it('should create a statement without categories', async () => {
      const statementDataNoCategories = {
        ...mockStatementData,
        categoryIds: undefined,
      };

      const result = await schema.createStatement(statementDataNoCategories);

      expect(neo4jService.write).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when statement text is empty', async () => {
      const invalidData = { ...mockStatementData, statement: '' };

      await expect(schema.createStatement(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when more than 3 categories provided', async () => {
      const invalidData = {
        ...mockStatementData,
        categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
      };

      await expect(schema.createStatement(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle Neo4j errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.createStatement(mockStatementData)).rejects.toThrow(
        'Failed to create statement: Database connection failed',
      );
    });
  });

  describe('getStatement', () => {
    it('should retrieve a statement by id', async () => {
      const mockStatement = {
        id: 'statement-123',
        statement: 'Test statement',
        inclusionPositiveVotes: Integer.fromNumber(15),
        inclusionNegativeVotes: Integer.fromNumber(3),
        inclusionNetVotes: Integer.fromNumber(12),
        contentPositiveVotes: Integer.fromNumber(20),
        contentNegativeVotes: Integer.fromNumber(5),
        contentNetVotes: Integer.fromNumber(15),
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

      const result = await schema.getStatement('statement-123');

      expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
        id: 'statement-123',
      });
      expect(result).toEqual({
        ...mockStatement,
        // Verify Neo4j Integer conversion
        inclusionPositiveVotes: 15,
        inclusionNegativeVotes: 3,
        inclusionNetVotes: 12,
        contentPositiveVotes: 20,
        contentNegativeVotes: 5,
        contentNetVotes: 15,
        keywords: mockKeywords,
        relatedStatements: mockRelatedStatements,
        directlyRelatedStatements: mockDirectRelations,
      });
    });

    it('should return null when statement is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getStatement('non-existent');
      expect(result).toBeNull();
    });

    it('should handle Neo4j errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Database error'));

      await expect(schema.getStatement('statement-123')).rejects.toThrow(
        'Failed to get statement: Database error',
      );
    });
  });

  describe('updateStatement', () => {
    const updateData = {
      statement: 'Updated statement text',
      publicCredit: false,
    };

    it('should update a statement successfully', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockStatementData, ...updateData },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.updateStatement('statement-123', updateData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (s:StatementNode {id: $id})'),
        expect.objectContaining({
          id: 'statement-123',
          updateProperties: expect.objectContaining({
            statement: updateData.statement,
            publicCredit: updateData.publicCredit,
          }),
        }),
      );
      expect(result).toEqual({ ...mockStatementData, ...updateData });
    });

    it('should throw NotFoundException when statement does not exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.updateStatement('nonexistent-id', updateData),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle Neo4j errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Update failed'));

      await expect(
        schema.updateStatement('statement-123', updateData),
      ).rejects.toThrow('Failed to update statement: Update failed');
    });
  });

  describe('deleteStatement', () => {
    it('should delete a statement successfully', async () => {
      // Mock existence check
      const checkResult = {
        records: [{ get: jest.fn().mockReturnValue(mockStatementData) }],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(checkResult);
      neo4jService.write.mockResolvedValue({} as Result);

      const result = await schema.deleteStatement('statement-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (s:StatementNode {id: $id}) RETURN s'),
        { id: 'statement-123' },
      );
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('DETACH DELETE s, d, c'),
        { id: 'statement-123' },
      );
      expect(result).toEqual({
        success: true,
        message: 'Statement with ID statement-123 successfully deleted',
      });
    });

    it('should throw NotFoundException when statement does not exist', async () => {
      const checkResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(checkResult);

      await expect(schema.deleteStatement('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle Neo4j errors gracefully', async () => {
      const checkResult = {
        records: [{ get: jest.fn().mockReturnValue(mockStatementData) }],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(checkResult);
      neo4jService.write.mockRejectedValue(new Error('Delete failed'));

      await expect(schema.deleteStatement('statement-123')).rejects.toThrow(
        'Failed to delete statement: Delete failed',
      );
    });
  });

  describe('createDirectRelationship', () => {
    it('should create a direct relationship between two statements', async () => {
      neo4jService.write.mockResolvedValue({} as Result);

      const result = await schema.createDirectRelationship(
        'statement-1',
        'statement-2',
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (s1)-[:RELATED_TO]->(s2)'),
        { fromId: 'statement-1', toId: 'statement-2' },
      );
      expect(result).toEqual({
        success: true,
        message: 'Direct relationship created successfully',
      });
    });

    it('should handle relationship creation errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Relationship failed'));

      await expect(
        schema.createDirectRelationship('statement-1', 'statement-2'),
      ).rejects.toThrow(
        'Failed to create direct relationship: Relationship failed',
      );
    });
  });

  describe('removeDirectRelationship', () => {
    it('should remove a direct relationship between two statements', async () => {
      neo4jService.write.mockResolvedValue({} as Result);

      const result = await schema.removeDirectRelationship(
        'statement-1',
        'statement-2',
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('DELETE rel'),
        { fromId: 'statement-1', toId: 'statement-2' },
      );
      expect(result).toEqual({
        success: true,
        message: 'Direct relationship removed successfully',
      });
    });

    it('should handle relationship removal errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Removal failed'));

      await expect(
        schema.removeDirectRelationship('statement-1', 'statement-2'),
      ).rejects.toThrow('Failed to remove direct relationship: Removal failed');
    });
  });

  describe('getDirectlyRelatedStatements', () => {
    const mockRelatedStatements = [
      {
        id: 'related-1',
        statement: 'Related statement 1',
        createdBy: 'user-789',
        createdAt: '2024-01-01T00:00:00Z',
        publicCredit: true,
      },
      {
        id: 'related-2',
        statement: 'Related statement 2',
        createdBy: 'user-456',
        createdAt: '2024-01-02T00:00:00Z',
        publicCredit: false,
      },
    ];

    it('should get directly related statements', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(mockRelatedStatements),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getDirectlyRelatedStatements('statement-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'MATCH (s:StatementNode {id: $statementId})-[:RELATED_TO]-(r:StatementNode)',
        ),
        { statementId: 'statement-123' },
      );
      expect(result).toEqual(mockRelatedStatements);
    });

    it('should return empty array when no related statements exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getDirectlyRelatedStatements('statement-123');

      expect(result).toEqual([]);
    });

    it('should handle query errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query failed'));

      await expect(
        schema.getDirectlyRelatedStatements('statement-123'),
      ).rejects.toThrow(
        'Failed to get directly related statements: Query failed',
      );
    });
  });

  describe('checkStatements', () => {
    it('should return statement count', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(42)),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.checkStatements();

      expect(neo4jService.read).toHaveBeenCalledWith(
        'MATCH (s:StatementNode) RETURN count(s) as count',
      );
      expect(result).toEqual({ count: 42 });
    });

    it('should handle count errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Count failed'));

      await expect(schema.checkStatements()).rejects.toThrow(
        'Failed to check statements: Count failed',
      );
    });
  });

  // DUAL VOTING SYSTEM TESTS
  describe('Dual Voting System', () => {
    describe('voteStatementInclusion', () => {
      it('should vote positively on statement inclusion', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteStatementInclusion(
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

      it('should vote negatively on statement inclusion', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteStatementInclusion(
          'statement-123',
          'user-456',
          false,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'StatementNode',
          { id: 'statement-123' },
          'user-456',
          false,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException when statement ID is empty', async () => {
        await expect(
          schema.voteStatementInclusion('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when user ID is empty', async () => {
        await expect(
          schema.voteStatementInclusion('statement-123', '', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should handle voting errors gracefully', async () => {
        voteSchema.vote.mockRejectedValue(new Error('Vote failed'));

        await expect(
          schema.voteStatementInclusion('statement-123', 'user-456', true),
        ).rejects.toThrow('Failed to vote on statement: Vote failed');
      });
    });

    describe('voteStatementContent', () => {
      it('should vote positively on statement content when inclusion passed', async () => {
        // Mock statement with passed inclusion
        const mockStatement = {
          id: 'statement-123',
          inclusionNetVotes: 5, // > 0, passed inclusion
        };
        jest.spyOn(schema, 'getStatement').mockResolvedValue(mockStatement);
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteStatementContent(
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

      it('should vote negatively on statement content when inclusion passed', async () => {
        const mockStatement = {
          id: 'statement-123',
          inclusionNetVotes: 3, // > 0, passed inclusion
        };
        jest.spyOn(schema, 'getStatement').mockResolvedValue(mockStatement);
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteStatementContent(
          'statement-123',
          'user-456',
          false,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'StatementNode',
          { id: 'statement-123' },
          'user-456',
          false,
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException when statement has not passed inclusion threshold', async () => {
        const mockStatement = {
          id: 'statement-123',
          inclusionNetVotes: 0, // = 0, pending
        };
        jest.spyOn(schema, 'getStatement').mockResolvedValue(mockStatement);

        await expect(
          schema.voteStatementContent('statement-123', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when statement is rejected (negative inclusion)', async () => {
        const mockStatement = {
          id: 'statement-123',
          inclusionNetVotes: -2, // < 0, rejected
        };
        jest.spyOn(schema, 'getStatement').mockResolvedValue(mockStatement);

        await expect(
          schema.voteStatementContent('statement-123', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when statement does not exist', async () => {
        jest.spyOn(schema, 'getStatement').mockResolvedValue(null);

        await expect(
          schema.voteStatementContent('statement-123', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should handle content voting errors gracefully', async () => {
        const mockStatement = {
          id: 'statement-123',
          inclusionNetVotes: 5, // Passed inclusion
        };
        jest.spyOn(schema, 'getStatement').mockResolvedValue(mockStatement);
        voteSchema.vote.mockRejectedValue(new Error('Content vote failed'));

        await expect(
          schema.voteStatementContent('statement-123', 'user-456', true),
        ).rejects.toThrow(
          'Failed to vote on statement content: Content vote failed',
        );
      });
    });

    describe('getStatementVoteStatus', () => {
      it('should get vote status for a statement', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getStatementVoteStatus(
          'statement-123',
          'user-456',
        );

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'StatementNode',
          { id: 'statement-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when no vote status exists', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await schema.getStatementVoteStatus(
          'statement-123',
          'user-456',
        );

        expect(result).toBeNull();
      });

      it('should throw BadRequestException when statement ID is empty', async () => {
        await expect(
          schema.getStatementVoteStatus('', 'user-456'),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.getVoteStatus).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when user ID is empty', async () => {
        await expect(
          schema.getStatementVoteStatus('statement-123', ''),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.getVoteStatus).not.toHaveBeenCalled();
      });

      it('should handle vote status errors gracefully', async () => {
        voteSchema.getVoteStatus.mockRejectedValue(
          new Error('Vote status failed'),
        );

        await expect(
          schema.getStatementVoteStatus('statement-123', 'user-456'),
        ).rejects.toThrow(
          'Failed to get statement vote status: Vote status failed',
        );
      });
    });

    describe('removeStatementVote', () => {
      it('should remove inclusion vote', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeStatementVote(
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

      it('should remove content vote', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeStatementVote(
          'statement-123',
          'user-456',
          'CONTENT',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'StatementNode',
          { id: 'statement-123' },
          'user-456',
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException when statement ID is empty', async () => {
        await expect(
          schema.removeStatementVote('', 'user-456', 'INCLUSION'),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.removeVote).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when user ID is empty', async () => {
        await expect(
          schema.removeStatementVote('statement-123', '', 'CONTENT'),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.removeVote).not.toHaveBeenCalled();
      });

      it('should handle remove vote errors gracefully', async () => {
        voteSchema.removeVote.mockRejectedValue(
          new Error('Remove vote failed'),
        );

        await expect(
          schema.removeStatementVote('statement-123', 'user-456', 'INCLUSION'),
        ).rejects.toThrow(
          'Failed to remove statement vote: Remove vote failed',
        );
      });
    });

    describe('getStatementVotes', () => {
      it('should get votes for a statement', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getStatementVotes('statement-123');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'StatementNode',
          { id: 'statement-123' },
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

      it('should return null when no vote status exists', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await schema.getStatementVotes('statement-123');

        expect(result).toBeNull();
      });

      it('should throw BadRequestException when statement ID is empty', async () => {
        await expect(schema.getStatementVotes('')).rejects.toThrow(
          BadRequestException,
        );
        expect(voteSchema.getVoteStatus).not.toHaveBeenCalled();
      });

      it('should handle get votes errors gracefully', async () => {
        voteSchema.getVoteStatus.mockRejectedValue(
          new Error('Get votes failed'),
        );

        await expect(schema.getStatementVotes('statement-123')).rejects.toThrow(
          'Failed to get statement votes: Get votes failed',
        );
      });
    });

    describe('isContentVotingAvailable', () => {
      it('should return true when statement has passed inclusion threshold', async () => {
        const mockStatement = {
          id: 'statement-123',
          inclusionNetVotes: 5, // > 0, passed
        };
        jest.spyOn(schema, 'getStatement').mockResolvedValue(mockStatement);

        const result = await schema.isContentVotingAvailable('statement-123');

        expect(result).toBe(true);
      });

      it('should return false when statement has not passed inclusion threshold', async () => {
        const mockStatement = {
          id: 'statement-123',
          inclusionNetVotes: 0, // = 0, pending
        };
        jest.spyOn(schema, 'getStatement').mockResolvedValue(mockStatement);

        const result = await schema.isContentVotingAvailable('statement-123');

        expect(result).toBe(false);
      });

      it('should return false when statement does not exist', async () => {
        jest.spyOn(schema, 'getStatement').mockResolvedValue(null);

        const result = await schema.isContentVotingAvailable('nonexistent-id');

        expect(result).toBe(false);
      });

      it('should return false on errors', async () => {
        jest
          .spyOn(schema, 'getStatement')
          .mockRejectedValue(new Error('Database error'));

        const result = await schema.isContentVotingAvailable('statement-123');

        expect(result).toBe(false);
      });
    });
  });

  // DISCOVERY METHODS TESTS
  describe('Discovery Methods', () => {
    describe('getRelatedContentBySharedCategories', () => {
      const mockRelatedContent = [
        { id: 'answer-1', type: 'answer', categoryOverlap: 2 },
        { id: 'openquestion-1', type: 'openquestion', categoryOverlap: 1 },
        { id: 'quantity-1', type: 'quantity', categoryOverlap: 2 },
      ];

      it('should get related content with default parameters', async () => {
        const mockRecords = mockRelatedContent.map((content) => ({
          get: jest.fn().mockReturnValue(content),
        })) as unknown as Record[];
        const mockResult = {
          records: mockRecords,
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result =
          await schema.getRelatedContentBySharedCategories('statement-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (current:StatementNode {id: $statementId})',
          ),
          expect.objectContaining({
            statementId: 'statement-123',
            offset: 0,
            limit: 10,
            minCategoryOverlap: 1,
          }),
        );
        expect(result).toEqual(mockRelatedContent);
      });

      it('should get related content with custom options', async () => {
        const mockResult = {
          records: [],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        await schema.getRelatedContentBySharedCategories('statement-123', {
          nodeTypes: ['answer', 'openquestion'],
          limit: 5,
          offset: 5,
          sortBy: 'category_overlap',
          sortDirection: 'desc',
          excludeSelf: true,
          minCategoryOverlap: 2,
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY categoryOverlap DESC'),
          expect.objectContaining({
            statementId: 'statement-123',
            offset: 5,
            limit: 5,
            minCategoryOverlap: 2,
          }),
        );
      });

      it('should handle filtering by specific node types', async () => {
        const mockResult = {
          records: [],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        await schema.getRelatedContentBySharedCategories('statement-123', {
          nodeTypes: ['answer'],
          excludeSelf: false,
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('AND (related:AnswerNode)'),
          expect.not.stringContaining('AND related.id <> $statementId'),
        );
      });

      it('should handle related content errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(
          new Error('Related content query failed'),
        );

        await expect(
          schema.getRelatedContentBySharedCategories('statement-123'),
        ).rejects.toThrow(
          'Failed to get related content: Related content query failed',
        );
      });
    });

    describe('getNodeCategories', () => {
      const mockCategories = [
        {
          id: 'category-1',
          name: 'Technology',
          inclusionPositiveVotes: Integer.fromNumber(15),
          inclusionNegativeVotes: Integer.fromNumber(2),
          inclusionNetVotes: Integer.fromNumber(13),
        },
        {
          id: 'category-2',
          name: 'Science',
          inclusionPositiveVotes: Integer.fromNumber(20),
          inclusionNegativeVotes: Integer.fromNumber(1),
          inclusionNetVotes: Integer.fromNumber(19),
        },
      ];

      it('should get categories for a statement', async () => {
        const mockRecords = mockCategories.map((category) => ({
          get: jest.fn().mockReturnValue(category),
        })) as unknown as Record[];
        const mockResult = {
          records: mockRecords,
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getNodeCategories('statement-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (s:StatementNode {id: $statementId})-[:CATEGORIZED_AS]->(c:CategoryNode)',
          ),
          { statementId: 'statement-123' },
        );

        // Verify Neo4j Integer conversion
        expect(result).toEqual([
          expect.objectContaining({
            id: 'category-1',
            name: 'Technology',
            inclusionPositiveVotes: 15,
            inclusionNegativeVotes: 2,
            inclusionNetVotes: 13,
          }),
          expect.objectContaining({
            id: 'category-2',
            name: 'Science',
            inclusionPositiveVotes: 20,
            inclusionNegativeVotes: 1,
            inclusionNetVotes: 19,
          }),
        ]);
      });

      it('should return empty array when statement has no categories', async () => {
        const mockResult = {
          records: [],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getNodeCategories('statement-123');

        expect(result).toEqual([]);
      });

      it('should handle get categories errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(
          new Error('Categories query failed'),
        );

        await expect(schema.getNodeCategories('statement-123')).rejects.toThrow(
          'Failed to get statement categories: Categories query failed',
        );
      });
    });
  });

  // VISIBILITY METHODS TESTS
  describe('Visibility Methods', () => {
    describe('setVisibilityStatus', () => {
      it('should set visibility status to true', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockStatementData, visibilityStatus: true },
          }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.setVisibilityStatus('statement-123', true);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('SET s.visibilityStatus = $isVisible'),
          { id: 'statement-123', isVisible: true },
        );
        expect(result).toEqual({
          ...mockStatementData,
          visibilityStatus: true,
        });
      });

      it('should set visibility status to false', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockStatementData, visibilityStatus: false },
          }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.setVisibilityStatus('statement-123', false);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('SET s.visibilityStatus = $isVisible'),
          { id: 'statement-123', isVisible: false },
        );
        expect(result).toEqual({
          ...mockStatementData,
          visibilityStatus: false,
        });
      });

      it('should throw NotFoundException when statement does not exist', async () => {
        const mockResult = {
          records: [],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        await expect(
          schema.setVisibilityStatus('nonexistent-id', true),
        ).rejects.toThrow(NotFoundException);
      });

      it('should handle visibility errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(
          new Error('Visibility update failed'),
        );

        await expect(
          schema.setVisibilityStatus('statement-123', true),
        ).rejects.toThrow(
          'Failed to set statement visibility: Visibility update failed',
        );
      });
    });

    describe('getVisibilityStatus', () => {
      it('should get visibility status for a statement', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(true),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getVisibilityStatus('statement-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (s:StatementNode {id: $id})'),
          { id: 'statement-123' },
        );
        expect(result).toBe(true);
      });

      it('should default to true when visibility status is null', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(null),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getVisibilityStatus('statement-123');

        expect(result).toBe(true); // Should default to true
      });

      it('should throw NotFoundException when statement does not exist', async () => {
        const mockResult = {
          records: [],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        await expect(
          schema.getVisibilityStatus('nonexistent-id'),
        ).rejects.toThrow(NotFoundException);
      });

      it('should handle get visibility errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Get visibility failed'));

        await expect(
          schema.getVisibilityStatus('statement-123'),
        ).rejects.toThrow(
          'Failed to get statement visibility: Get visibility failed',
        );
      });
    });
  });

  // EDGE CASES AND INTEGRATION TESTS
  describe('Edge Cases and Integration', () => {
    describe('Neo4j Integer Conversion', () => {
      it('should properly convert Neo4j integers in vote counts', async () => {
        const mockRecord = {
          get: jest.fn().mockImplementation((key: string) => {
            if (key === 's') {
              return {
                properties: {
                  id: 'statement-123',
                  statement: 'Test statement',
                  inclusionPositiveVotes: Integer.fromNumber(999999),
                  inclusionNegativeVotes: Integer.fromNumber(100000),
                  inclusionNetVotes: Integer.fromNumber(899999),
                  contentPositiveVotes: Integer.fromNumber(888888),
                  contentNegativeVotes: Integer.fromNumber(111111),
                  contentNetVotes: Integer.fromNumber(777777),
                },
              };
            }
            return []; // Empty arrays for other properties
          }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getStatement('statement-123');

        expect(result).toEqual(
          expect.objectContaining({
            inclusionPositiveVotes: 999999,
            inclusionNegativeVotes: 100000,
            inclusionNetVotes: 899999,
            contentPositiveVotes: 888888,
            contentNegativeVotes: 111111,
            contentNetVotes: 777777,
          }),
        );
      });
    });

    describe('Input Validation Edge Cases', () => {
      it('should handle null and undefined inputs gracefully', async () => {
        await expect(schema.getStatement(null as any)).rejects.toThrow(
          BadRequestException,
        );
        await expect(schema.getStatement(undefined as any)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should handle whitespace-only statement text', async () => {
        const invalidData = {
          ...mockStatementData,
          statement: '   \t\n  ',
        };

        await expect(schema.createStatement(invalidData)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should handle exactly 3 categories (boundary condition)', async () => {
        const dataWithMaxCategories = {
          ...mockStatementData,
          categoryIds: ['cat1', 'cat2', 'cat3'],
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: dataWithMaxCategories }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        await expect(
          schema.createStatement(dataWithMaxCategories),
        ).resolves.toBeDefined();
      });
    });

    describe('Complete Statement Lifecycle', () => {
      it('should handle complete statement lifecycle with dual voting', async () => {
        // Create
        const createRecord = {
          get: jest.fn().mockReturnValue({ properties: mockStatementData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [createRecord],
        } as unknown as Result);

        await schema.createStatement(mockStatementData);

        // Vote inclusion
        voteSchema.vote.mockResolvedValueOnce(mockVoteResult);
        await schema.voteStatementInclusion('statement-123', 'user-456', true);

        // Vote content (after inclusion passed)
        const mockStatement = { id: 'statement-123', inclusionNetVotes: 5 };
        jest.spyOn(schema, 'getStatement').mockResolvedValue(mockStatement);
        voteSchema.vote.mockResolvedValueOnce(mockVoteResult);
        await schema.voteStatementContent('statement-123', 'user-456', true);

        // Update
        const updateData = { statement: 'Updated statement text' };
        const updateRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockStatementData, ...updateData },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [updateRecord],
        } as unknown as Result);

        await schema.updateStatement('statement-123', updateData);

        // Set visibility
        const visibilityRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockStatementData, visibilityStatus: false },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [visibilityRecord],
        } as unknown as Result);

        await schema.setVisibilityStatus('statement-123', false);

        // Delete
        const checkRecord = {
          get: jest.fn().mockReturnValue(mockStatementData),
        } as unknown as Record;
        neo4jService.read.mockResolvedValueOnce({
          records: [checkRecord],
        } as unknown as Result);
        neo4jService.write.mockResolvedValueOnce({} as Result);

        const deleteResult = await schema.deleteStatement('statement-123');

        expect(deleteResult.success).toBe(true);
        expect(neo4jService.write).toHaveBeenCalledTimes(4); // create, update, visibility, delete
        expect(voteSchema.vote).toHaveBeenCalledTimes(2); // inclusion, content
      });

      it('should handle statement creation with full workflow', async () => {
        const fullWorkflowData = {
          ...mockStatementData,
          keywords: [
            { word: 'artificial', frequency: 10, source: 'ai' as const },
            { word: 'intelligence', frequency: 8, source: 'ai' as const },
            { word: 'machine', frequency: 6, source: 'user' as const },
            { word: 'learning', frequency: 4, source: 'user' as const },
          ] as KeywordWithFrequency[],
          categoryIds: ['tech-category', 'ai-category', 'research-category'],
          initialComment: 'This is a comprehensive statement about AI and ML.',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: fullWorkflowData }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.createStatement(fullWorkflowData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (s:StatementNode'),
          expect.objectContaining({
            id: fullWorkflowData.id,
            statement: fullWorkflowData.statement,
            createdBy: fullWorkflowData.createdBy,
            categoryIds: fullWorkflowData.categoryIds,
            keywords: fullWorkflowData.keywords,
          }),
        );
        expect(result).toEqual(fullWorkflowData);
      });
    });

    describe('Performance and Large Data Handling', () => {
      it('should handle large keyword arrays', async () => {
        const largeKeywordSet = Array.from({ length: 100 }, (_, i) => ({
          word: `keyword${i}`,
          frequency: i + 1,
          source: 'ai' as const,
        }));

        const dataWithManyKeywords = {
          ...mockStatementData,
          keywords: largeKeywordSet,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: dataWithManyKeywords }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        await expect(
          schema.createStatement(dataWithManyKeywords),
        ).resolves.toBeDefined();

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('UNWIND $keywords as keyword'),
          expect.objectContaining({
            keywords: largeKeywordSet,
          }),
        );
      });

      it('should handle pagination in network queries', async () => {
        const mockCountResult = {
          records: [
            { get: jest.fn().mockReturnValue(Integer.fromNumber(1000)) },
          ],
        } as unknown as Result;
        neo4jService.read.mockResolvedValueOnce(mockCountResult);

        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValueOnce(mockResult);

        await schema.getStatementNetwork({
          limit: 50,
          offset: 100,
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('SKIP $offset LIMIT $limit'),
          expect.objectContaining({
            limit: 50,
            offset: 100,
          }),
        );
      });
    });
  });
});
