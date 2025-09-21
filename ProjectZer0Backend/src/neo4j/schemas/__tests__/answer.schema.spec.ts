// src/neo4j/schemas/__tests__/answer.schema.spec.ts - UPDATED

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnswerSchema, AnswerData, AnswerNodeData } from '../answer.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';

describe('AnswerSchema with BaseNodeSchema Integration', () => {
  let schema: AnswerSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  const mockAnswerData: AnswerData = {
    id: 'answer-123',
    createdBy: 'user-456',
    publicCredit: true,
    answerText: 'This is a comprehensive answer to the open question.',
    parentQuestionId: 'question-789',
    discussionId: 'discussion-abc',
    createdAt: new Date('2023-06-20T10:00:00Z'),
    updatedAt: new Date('2023-06-20T10:00:00Z'),
    // Dual voting (both inclusion and content)
    inclusionPositiveVotes: 12,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 9,
    contentPositiveVotes: 18,
    contentNegativeVotes: 2,
    contentNetVotes: 16,
    keywords: [
      { word: 'artificial', frequency: 8, source: 'ai' as const },
      { word: 'intelligence', frequency: 6, source: 'user' as const },
    ],
    categories: [
      { id: 'tech-category', name: 'Technology', inclusionNetVotes: 10 },
      {
        id: 'ai-category',
        name: 'Artificial Intelligence',
        inclusionNetVotes: 8,
      },
    ],
    relatedAnswers: [
      {
        id: 'related-456',
        answerText: 'Another related answer',
        sharedWord: 'artificial',
        strength: 48,
      },
    ],
  };

  const mockCreateAnswerData: AnswerNodeData = {
    id: 'answer-123',
    answerText: 'This is a comprehensive answer to the open question.',
    createdBy: 'user-456',
    publicCredit: true,
    parentQuestionId: 'question-789',
    categoryIds: ['tech-category', 'ai-category'],
    keywords: [
      { word: 'artificial', frequency: 8, source: 'ai' as const },
      { word: 'intelligence', frequency: 6, source: 'user' as const },
    ],
    initialComment: 'This answer addresses the core question thoroughly.',
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 13,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 10,
    contentPositiveVotes: 19,
    contentNegativeVotes: 2,
    contentNetVotes: 17,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 13,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 10,
    contentStatus: 'agree',
    contentPositiveVotes: 19,
    contentNegativeVotes: 2,
    contentNetVotes: 17,
  };

  beforeEach(async () => {
    neo4jService = {
      read: jest.fn(),
      write: jest.fn(),
    } as any;

    voteSchema = {
      vote: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnswerSchema,
        { provide: Neo4jService, useValue: neo4jService },
        { provide: VoteSchema, useValue: voteSchema },
      ],
    }).compile();

    schema = module.get<AnswerSchema>(AnswerSchema);
    neo4jService = module.get(Neo4jService);
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
      it('should map Neo4j record to AnswerData with all BaseNodeData fields', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(result.createdBy).toBe('user-456');
        expect(result.publicCredit).toBe(true);
        expect(result.discussionId).toBe('discussion-abc');
        expect(result.answerText).toBe(
          'This is a comprehensive answer to the open question.',
        );
        expect(result.parentQuestionId).toBe('question-789');
      });

      it('should convert Neo4j integers correctly', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              ...mockAnswerData,
              inclusionPositiveVotes: Integer.fromNumber(12),
              inclusionNegativeVotes: Integer.fromNumber(3),
              inclusionNetVotes: Integer.fromNumber(9),
              contentPositiveVotes: Integer.fromNumber(18),
              contentNegativeVotes: Integer.fromNumber(2),
              contentNetVotes: Integer.fromNumber(16),
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
          answerText: 'Updated answer text',
          publicCredit: false,
        };
        const result = (schema as any).buildUpdateQuery(
          'answer-123',
          updateData,
        );

        expect(result.cypher).toContain('MATCH (n:AnswerNode {id: $id})');
        expect(result.cypher).toContain('SET');
        expect(result.cypher).toContain('n.updatedAt = datetime()');
        expect(result.params).toEqual({
          id: 'answer-123',
          updateData,
        });
      });

      it('should exclude complex fields from simple updates', () => {
        const updateData = {
          answerText: 'Updated text',
          keywords: [],
          categoryIds: ['new-cat'],
        };
        const result = (schema as any).buildUpdateQuery(
          'answer-123',
          updateData,
        );

        expect(result.cypher).not.toContain('keywords');
        expect(result.cypher).not.toContain('categoryIds');
      });
    });
  });

  describe('Inherited Voting Methods', () => {
    describe('voteInclusion', () => {
      it('should vote on inclusion using inherited method', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteInclusion(
          'answer-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'AnswerNode',
          { id: 'answer-123' },
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
          schema.voteInclusion('answer-123', '', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('voteContent with business logic', () => {
      it('should vote on content when answer has passed inclusion threshold', async () => {
        // Mock findById to return answer with positive inclusion votes
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteContent('answer-123', 'user-456', true);

        expect(result).toEqual(mockVoteResult);
      });

      it('should reject content voting when answer has not passed inclusion threshold', async () => {
        const answerWithNegativeVotes = {
          ...mockAnswerData,
          inclusionNetVotes: -3, // Failed inclusion threshold
        };

        const mockRecord = {
          get: jest
            .fn()
            .mockReturnValue({ properties: answerWithNegativeVotes }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        await expect(
          schema.voteContent('answer-123', 'user-456', true),
        ).rejects.toThrow(
          'Answer must pass inclusion threshold before content voting is allowed',
        );
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should reject content voting when answer not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(
          schema.voteContent('nonexistent', 'user-456', true),
        ).rejects.toThrow(
          'Answer must pass inclusion threshold before content voting is allowed',
        );
      });
    });

    describe('getVoteStatus', () => {
      it('should get vote status using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('answer-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'AnswerNode',
          { id: 'answer-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });
    });

    describe('removeVote', () => {
      it('should remove vote using inherited method', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeVote(
          'answer-123',
          'user-456',
          'CONTENT',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'AnswerNode',
          { id: 'answer-123' },
          'user-456',
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('getVotes', () => {
      it('should get vote counts using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('answer-123');

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

  describe('Answer-Specific Methods', () => {
    describe('createAnswer', () => {
      it('should create answer successfully with keywords and categories', async () => {
        // Mock answer creation first
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        // Mock discussion creation second
        neo4jService.write.mockResolvedValueOnce({
          records: [{ get: jest.fn().mockReturnValue('discussion-abc') }],
        } as unknown as Result);

        const result = await schema.createAnswer(mockCreateAnswerData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (a:AnswerNode'),
          expect.objectContaining({
            id: mockCreateAnswerData.id,
            answerText: mockCreateAnswerData.answerText,
            createdBy: mockCreateAnswerData.createdBy,
            publicCredit: mockCreateAnswerData.publicCredit,
            parentQuestionId: mockCreateAnswerData.parentQuestionId,
            categoryIds: mockCreateAnswerData.categoryIds,
            keywords: mockCreateAnswerData.keywords,
          }),
        );
        expect(result.discussionId).toBe('discussion-abc');
      });

      it('should create answer without keywords and categories', async () => {
        const simpleAnswerData = {
          id: 'answer-456',
          answerText: 'Simple answer without extras',
          createdBy: 'user-789',
          publicCredit: true,
          parentQuestionId: 'question-123',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: simpleAnswerData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        neo4jService.write.mockResolvedValueOnce({
          records: [{ get: jest.fn().mockReturnValue('discussion-def') }],
        } as unknown as Result);

        const result = await schema.createAnswer(simpleAnswerData);

        expect(result.id).toBe('answer-456');
        expect(result.discussionId).toBe('discussion-def');
      });

      it('should validate answer text', async () => {
        const invalidData = {
          ...mockCreateAnswerData,
          answerText: '',
        };

        await expect(schema.createAnswer(invalidData)).rejects.toThrow(
          'Answer text cannot be empty',
        );

        const whitespaceData = {
          ...mockCreateAnswerData,
          answerText: '   \t\n  ',
        };

        await expect(schema.createAnswer(whitespaceData)).rejects.toThrow(
          'Answer text cannot be empty',
        );
      });

      it('should validate category count limit', async () => {
        const tooManyCategoriesData = {
          ...mockCreateAnswerData,
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'], // More than 3 categories
        };

        await expect(
          schema.createAnswer(tooManyCategoriesData),
        ).rejects.toThrow('Answer can have maximum 3 categories');
      });

      it('should handle parent question validation failure', async () => {
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(schema.createAnswer(mockCreateAnswerData)).rejects.toThrow(
          'Parent OpenQuestion must exist and have passed inclusion threshold before answers can be created',
        );
      });

      it('should handle dependency validation errors', async () => {
        neo4jService.write.mockRejectedValue(new Error('not found'));

        await expect(schema.createAnswer(mockCreateAnswerData)).rejects.toThrow(
          "Some categories or keywords don't exist or haven't passed inclusion threshold",
        );
      });
    });

    describe('getAnswer', () => {
      it('should retrieve answer with enhanced data', async () => {
        const mockRecord = {
          get: jest.fn((field) => {
            if (field === 'n') return { properties: mockAnswerData };
            if (field === 'parentQuestionId') return 'question-789';
            if (field === 'parentQuestionText')
              return 'What is the future of AI?';
            if (field === 'categories') return mockAnswerData.categories;
            if (field === 'keywords') return mockAnswerData.keywords;
            if (field === 'relatedAnswers')
              return mockAnswerData.relatedAnswers;
            if (field === 'discussionId') return 'discussion-abc';
            return null;
          }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getAnswer('answer-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (a:AnswerNode {id: $id})'),
          { id: 'answer-123' },
        );
        expect(result?.id).toBe('answer-123');
        expect((result as any).parentQuestionText).toBe(
          'What is the future of AI?',
        );
        expect(result?.categories).toBeDefined();
        expect(result?.keywords).toBeDefined();
        expect(result?.relatedAnswers).toBeDefined();
      });

      it('should return null when answer not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getAnswer('nonexistent');

        expect(result).toBeNull();
      });

      it('should validate answer ID', async () => {
        await expect(schema.getAnswer('')).rejects.toThrow(BadRequestException);
        await expect(schema.getAnswer('   ')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('updateAnswer', () => {
      it('should update simple fields without keywords/categories', async () => {
        const updateData = {
          answerText: 'Updated answer text',
          publicCredit: false,
        };
        const baseAnswerData = {
          id: mockAnswerData.id,
          createdBy: mockAnswerData.createdBy,
          publicCredit: false, // Updated value
          answerText: 'Updated answer text', // Updated value
          parentQuestionId: mockAnswerData.parentQuestionId,
          discussionId: mockAnswerData.discussionId,
          createdAt: mockAnswerData.createdAt,
          updatedAt: mockAnswerData.updatedAt,
          inclusionPositiveVotes: mockAnswerData.inclusionPositiveVotes,
          inclusionNegativeVotes: mockAnswerData.inclusionNegativeVotes,
          inclusionNetVotes: mockAnswerData.inclusionNetVotes,
          contentPositiveVotes: mockAnswerData.contentPositiveVotes,
          contentNegativeVotes: mockAnswerData.contentNegativeVotes,
          contentNetVotes: mockAnswerData.contentNetVotes,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: baseAnswerData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.updateAnswer('answer-123', updateData);

        expect(result).toEqual(baseAnswerData);
      });

      it('should update with keywords and categories', async () => {
        const updateData = {
          answerText: 'Updated with new metadata',
          categoryIds: ['new-category'],
          keywords: [
            { word: 'machine', frequency: 5, source: 'user' as const },
          ],
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockAnswerData, ...updateData },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.updateAnswer('answer-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (a:AnswerNode {id: $id})'),
          expect.objectContaining({
            id: 'answer-123',
            categoryIds: updateData.categoryIds,
            keywords: updateData.keywords,
          }),
        );
        expect(result).toBeDefined();
      });

      it('should validate category count on update', async () => {
        const updateData = {
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'], // Too many
        };

        await expect(
          schema.updateAnswer('answer-123', updateData),
        ).rejects.toThrow('Answer can have maximum 3 categories');
      });

      it('should handle answer not found on update', async () => {
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(
          schema.updateAnswer('nonexistent', { answerText: 'New text' }),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('getAnswersForQuestion', () => {
      it('should get answers for question with default parameters', async () => {
        const mockRecords = [
          {
            get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getAnswersForQuestion('question-789');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (oq:OpenQuestionNode {id: $questionId})',
          ),
          expect.objectContaining({ questionId: 'question-789', offset: 0 }),
        );
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('answer-123');
      });

      it('should handle custom sorting and filtering options', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getAnswersForQuestion('question-789', {
          sortBy: 'newest',
          sortDirection: 'desc',
          limit: 5,
          offset: 10,
          onlyApproved: true,
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('WHERE a.inclusionNetVotes > 0'),
          expect.objectContaining({
            questionId: 'question-789',
            offset: 10,
            limit: 5,
          }),
        );
      });

      it('should handle different sorting options', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        // Test inclusion votes sorting
        await schema.getAnswersForQuestion('question-789', {
          sortBy: 'inclusion_votes',
          sortDirection: 'asc',
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY a.inclusionNetVotes ASC'),
          expect.any(Object),
        );

        // Test content votes sorting (default)
        jest.clearAllMocks();
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getAnswersForQuestion('question-789', {
          sortBy: 'content_votes',
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY a.contentNetVotes DESC'),
          expect.any(Object),
        );
      });
    });

    describe('getCategoriesForAnswer', () => {
      it('should get categories with hierarchical paths', async () => {
        const mockCategories = [
          {
            id: 'tech-category',
            name: 'Technology',
            description: 'Technology topics',
            inclusionNetVotes: 10,
            path: [
              { id: 'root-category', name: 'Root' },
              { id: 'tech-category', name: 'Technology' },
            ],
          },
        ];

        const mockRecord = {
          get: jest.fn().mockReturnValue(mockCategories),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getCategoriesForAnswer('answer-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (a:AnswerNode {id: $answerId})'),
          { answerId: 'answer-123' },
        );
        expect(result).toEqual(mockCategories);
      });

      it('should handle no categories found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getCategoriesForAnswer('answer-123');

        expect(result).toEqual([]);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete answer lifecycle', async () => {
      // Create
      const mockCreateRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockCreateRecord],
      } as unknown as Result);

      // Mock discussion creation
      neo4jService.write.mockResolvedValueOnce({
        records: [{ get: jest.fn().mockReturnValue('discussion-abc') }],
      } as unknown as Result);

      const created = await schema.createAnswer(mockCreateAnswerData);
      expect(created.id).toBe('answer-123');

      // Read - using findById returns basic mapped data without enhanced fields
      const baseAnswerData = {
        id: mockAnswerData.id,
        createdBy: mockAnswerData.createdBy,
        publicCredit: mockAnswerData.publicCredit,
        answerText: mockAnswerData.answerText,
        parentQuestionId: mockAnswerData.parentQuestionId,
        discussionId: mockAnswerData.discussionId,
        createdAt: mockAnswerData.createdAt,
        updatedAt: mockAnswerData.updatedAt,
        inclusionPositiveVotes: mockAnswerData.inclusionPositiveVotes,
        inclusionNegativeVotes: mockAnswerData.inclusionNegativeVotes,
        inclusionNetVotes: mockAnswerData.inclusionNetVotes,
        contentPositiveVotes: mockAnswerData.contentPositiveVotes,
        contentNegativeVotes: mockAnswerData.contentNegativeVotes,
        contentNetVotes: mockAnswerData.contentNetVotes,
      };

      const mockReadRecord = {
        get: jest.fn().mockReturnValue({ properties: baseAnswerData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [mockReadRecord],
      } as unknown as Result);

      const found = await schema.findById('answer-123');
      expect(found).toEqual(baseAnswerData);

      // Vote inclusion
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const voteResult = await schema.voteInclusion(
        'answer-123',
        'user-456',
        true,
      );
      expect(voteResult).toEqual(mockVoteResult);

      // Vote content (requires inclusion threshold)
      neo4jService.read.mockResolvedValueOnce({
        records: [mockReadRecord],
      } as unknown as Result);
      const contentVoteResult = await schema.voteContent(
        'answer-123',
        'user-456',
        true,
      );
      expect(contentVoteResult).toEqual(mockVoteResult);

      // Update - using inherited update returns basic mapped data
      const updateData = { answerText: 'Updated answer text' };
      const basicUpdatedAnswer = {
        id: mockAnswerData.id,
        createdBy: mockAnswerData.createdBy,
        publicCredit: mockAnswerData.publicCredit,
        answerText: 'Updated answer text', // Updated value
        parentQuestionId: mockAnswerData.parentQuestionId,
        discussionId: mockAnswerData.discussionId,
        createdAt: mockAnswerData.createdAt,
        updatedAt: mockAnswerData.updatedAt,
        inclusionPositiveVotes: mockAnswerData.inclusionPositiveVotes,
        inclusionNegativeVotes: mockAnswerData.inclusionNegativeVotes,
        inclusionNetVotes: mockAnswerData.inclusionNetVotes,
        contentPositiveVotes: mockAnswerData.contentPositiveVotes,
        contentNegativeVotes: mockAnswerData.contentNegativeVotes,
        contentNetVotes: mockAnswerData.contentNetVotes,
      };

      const mockUpdateRecord = {
        get: jest.fn().mockReturnValue({ properties: basicUpdatedAnswer }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockUpdateRecord],
      } as unknown as Result);

      const updated = await schema.update('answer-123', updateData);
      expect(updated).toEqual(basicUpdatedAnswer);

      // Delete
      const existsRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [existsRecord],
      } as unknown as Result);
      neo4jService.write.mockResolvedValueOnce({} as Result);

      const deleteResult = await schema.delete('answer-123');
      expect(deleteResult).toEqual({ success: true });
    });
  });

  describe('Error Handling', () => {
    it('should use standardized error messages from BaseNodeSchema', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.findById('test')).rejects.toThrow(
        'Failed to find Answer: Database connection failed',
      );
    });

    it('should handle answer-specific errors consistently', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query timeout'));

      await expect(schema.getAnswer('test')).rejects.toThrow(
        'Failed to retrieve answer Answer: Query timeout',
      );
    });
  });

  describe('Business Logic Validation', () => {
    it('should enforce OpenQuestion inclusion threshold for answer creation', async () => {
      // This is handled by the Cypher query validation in createAnswer
      neo4jService.write.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await expect(schema.createAnswer(mockCreateAnswerData)).rejects.toThrow(
        'Parent OpenQuestion must exist and have passed inclusion threshold',
      );
    });

    it('should enforce category and keyword validation', async () => {
      neo4jService.write.mockRejectedValue(new Error('not found'));

      await expect(schema.createAnswer(mockCreateAnswerData)).rejects.toThrow(
        "Some categories or keywords don't exist or haven't passed inclusion threshold",
      );
    });

    it('should create shared tag relationships between answers', async () => {
      // This is tested implicitly in the createAnswer test through the keywords parameter
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockRecord],
      } as unknown as Result);

      neo4jService.write.mockResolvedValueOnce({
        records: [{ get: jest.fn().mockReturnValue('discussion-abc') }],
      } as unknown as Result);

      await schema.createAnswer(mockCreateAnswerData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('SHARED_TAG'),
        expect.any(Object),
      );
    });
  });
});
