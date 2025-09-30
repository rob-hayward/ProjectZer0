// src/neo4j/schemas/__tests__/answer.schema.spec.ts - UPDATED

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnswerSchema, AnswerData } from '../answer.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { DiscussionSchema } from '../discussion.schema';
import { UserSchema } from '../user.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';
import { VotingUtils } from '../../../config/voting.config';

describe('AnswerSchema with BaseNodeSchema Integration', () => {
  let schema: AnswerSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  let userSchema: jest.Mocked<UserSchema>;

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

  const mockCreateAnswerData = {
    id: 'answer-123',
    answerText: 'This is a comprehensive answer to the open question.',
    createdBy: 'user-456',
    publicCredit: true,
    parentQuestionId: 'question-789',
    categoryIds: ['tech-category', 'ai-category'],
    keywords: [
      { word: 'artificial', frequency: 8, source: 'ai' as const },
      { word: 'intelligence', frequency: 6, source: 'user' as const },
    ] as KeywordWithFrequency[],
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

    discussionSchema = {
      createDiscussionForNode: jest.fn(),
    } as any;

    userSchema = {
      addCreatedNode: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnswerSchema,
        { provide: Neo4jService, useValue: neo4jService },
        { provide: VoteSchema, useValue: voteSchema },
        { provide: DiscussionSchema, useValue: discussionSchema },
        { provide: UserSchema, useValue: userSchema },
      ],
    }).compile();

    schema = module.get<AnswerSchema>(AnswerSchema);
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
        expect(result.inclusionPositiveVotes).toBe(12);
        expect(typeof result.contentPositiveVotes).toBe('number');
        expect(result.contentPositiveVotes).toBe(18);
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

      it('should not allow changing parent question', () => {
        const updateData = {
          answerText: 'Updated text',
          parentQuestionId: 'different-question',
        };
        const result = (schema as any).buildUpdateQuery(
          'answer-123',
          updateData,
        );

        expect(result.cypher).not.toContain('parentQuestionId');
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

  describe('Inherited CRUD Operations', () => {
    describe('findById', () => {
      it('should find answer by id using inherited method', async () => {
        // findById uses mapNodeFromRecord which only returns basic AnswerData
        // without the enhanced fields (keywords, categories, relatedAnswers)
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

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.findById('answer-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (n:AnswerNode {id: $id}) RETURN n',
          { id: 'answer-123' },
        );
        expect(result).toEqual(baseAnswerData);
      });

      it('should return null when answer not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.findById('nonexistent');
        expect(result).toBeNull();
      });
    });

    describe('update', () => {
      it('should update answer using inherited method', async () => {
        const updateData = {
          answerText: 'Updated answer text',
          publicCredit: false,
        };
        const updatedAnswer = { ...mockAnswerData, ...updateData };
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedAnswer }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.update('answer-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:AnswerNode {id: $id})'),
          expect.objectContaining({
            id: 'answer-123',
            updateData,
          }),
        );
        expect(result?.answerText).toBe('Updated answer text');
        expect(result?.publicCredit).toBe(false);
      });
    });

    describe('delete', () => {
      it('should delete answer using inherited method', async () => {
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);
        neo4jService.write.mockResolvedValue({} as Result);

        const result = await schema.delete('answer-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('COUNT(n) as count'),
          { id: 'answer-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE n'),
          { id: 'answer-123' },
        );
        expect(result).toEqual({ success: true });
      });
    });
  });

  describe('CategorizedNodeSchema Integration', () => {
    describe('inherited category methods', () => {
      it('should have category methods from CategorizedNodeSchema', () => {
        expect(typeof schema.getCategories).toBe('function');
        expect(typeof schema.findRelatedByCategories).toBe('function');
        expect(typeof schema.findRelatedByCombined).toBe('function');
        expect(typeof schema.updateCategories).toBe('function');
      });

      it('should get categories for an answer', async () => {
        const mockRecords = [
          {
            get: jest.fn((field: string) => {
              if (field === 'id') return 'tech-category';
              if (field === 'name') return 'Technology';
              if (field === 'description') return 'Tech topics';
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getCategories('answer-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:AnswerNode {id: $nodeId})'),
          { nodeId: 'answer-123' },
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          id: 'tech-category',
          name: 'Technology',
          description: 'Tech topics',
        });
      });
    });

    describe('inherited keyword methods', () => {
      it('should have keyword methods from TaggedNodeSchema', () => {
        expect(typeof schema.getKeywords).toBe('function');
        expect(typeof schema.updateKeywords).toBe('function');
        expect(typeof schema.findRelatedByTags).toBe('function');
      });

      it('should get keywords for an answer', async () => {
        const mockRecords = mockCreateAnswerData.keywords.map((keyword) => ({
          get: jest.fn((field: string) => {
            if (field === 'word') return keyword.word;
            if (field === 'frequency')
              return Integer.fromNumber(keyword.frequency);
            if (field === 'source') return keyword.source;
            return null;
          }),
        })) as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getKeywords('answer-123');

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          word: 'artificial',
          frequency: 8,
          source: 'ai',
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

        // Mock discussion creation
        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-abc',
        });

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

        expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
          nodeId: 'answer-123',
          nodeType: 'AnswerNode',
          nodeIdField: 'id',
          createdBy: 'user-456',
          initialComment: 'This answer addresses the core question thoroughly.',
        });

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

        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-def',
        });

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

      it('should generate id if not provided', async () => {
        const dataWithoutId = {
          ...mockCreateAnswerData,
          id: undefined,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-abc',
        });

        await schema.createAnswer(dataWithoutId);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            id: expect.stringMatching(/^[a-f0-9-]{36}$/), // UUID pattern
          }),
        );
      });

      it('should track user participation', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-abc',
        });
        userSchema.addCreatedNode.mockResolvedValue(undefined);

        await schema.createAnswer(mockCreateAnswerData);

        expect(userSchema.addCreatedNode).toHaveBeenCalledWith(
          'user-456',
          'answer-123',
          'answer',
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
        const updatedAnswer = { ...mockAnswerData, ...updateData };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedAnswer }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        // Mock the getAnswer call that updateAnswer makes internally
        // Since updateAnswer with no keywords/categories calls update() which returns the updated data
        const result = await schema.updateAnswer('answer-123', updateData);

        // updateAnswer without keywords/categories uses inherited update()
        // which returns basic data via mapNodeFromRecord (no enhanced fields)
        const expectedResult = {
          id: updatedAnswer.id,
          createdBy: updatedAnswer.createdBy,
          publicCredit: updatedAnswer.publicCredit,
          answerText: updatedAnswer.answerText,
          parentQuestionId: updatedAnswer.parentQuestionId,
          discussionId: updatedAnswer.discussionId,
          createdAt: updatedAnswer.createdAt,
          updatedAt: updatedAnswer.updatedAt,
          inclusionPositiveVotes: updatedAnswer.inclusionPositiveVotes,
          inclusionNegativeVotes: updatedAnswer.inclusionNegativeVotes,
          inclusionNetVotes: updatedAnswer.inclusionNetVotes,
          contentPositiveVotes: updatedAnswer.contentPositiveVotes,
          contentNegativeVotes: updatedAnswer.contentNegativeVotes,
          contentNetVotes: updatedAnswer.contentNetVotes,
        };

        expect(result).toEqual(expectedResult);
      });

      it('should update with keywords and categories', async () => {
        const updateData = {
          answerText: 'Updated with new metadata',
          categoryIds: ['new-category'],
          keywords: [
            { word: 'machine', frequency: 5, source: 'user' as const },
          ],
        };

        // Mock updateCategories
        jest.spyOn(schema, 'updateCategories').mockResolvedValue();
        // Mock updateKeywords
        jest.spyOn(schema, 'updateKeywords').mockResolvedValue();
        // Mock update for basic fields
        jest.spyOn(schema, 'update').mockResolvedValue(mockAnswerData);
        // Mock getAnswer to return updated data
        jest.spyOn(schema, 'getAnswer').mockResolvedValue({
          ...mockAnswerData,
          ...updateData,
        });

        const result = await schema.updateAnswer('answer-123', updateData);

        expect(schema.updateCategories).toHaveBeenCalledWith(
          'answer-123',
          updateData.categoryIds,
        );
        expect(schema.updateKeywords).toHaveBeenCalledWith(
          'answer-123',
          updateData.keywords,
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

    describe('getAnswersByQuestion', () => {
      it('should get answers for a question', async () => {
        const mockRecords = [
          {
            get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getAnswersByQuestion('question-789');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (a:AnswerNode {parentQuestionId: $questionId})',
          ),
          expect.objectContaining({ questionId: 'question-789' }),
        );
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('answer-123');
      });

      it('should filter unapproved answers by default', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getAnswersByQuestion('question-789');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('AND a.inclusionNetVotes > 0'),
          expect.any(Object),
        );
      });

      it('should include unapproved answers when specified', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getAnswersByQuestion('question-789', true);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.not.stringContaining('AND a.inclusionNetVotes > 0'),
          expect.any(Object),
        );
      });

      it('should validate question ID', async () => {
        await expect(schema.getAnswersByQuestion('')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('getTopAnswerForQuestion', () => {
      it('should return the highest quality answer', async () => {
        const topAnswer = {
          ...mockAnswerData,
          contentNetVotes: 25,
        };
        const otherAnswer = {
          ...mockAnswerData,
          id: 'answer-456',
          contentNetVotes: 10,
        };

        const mockRecords = [
          {
            get: jest.fn().mockReturnValue({ properties: topAnswer }),
          },
          {
            get: jest.fn().mockReturnValue({ properties: otherAnswer }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getTopAnswerForQuestion('question-789');

        expect(result?.id).toBe('answer-123');
        expect(result?.contentNetVotes).toBe(25);
      });

      it('should return null when no approved answers exist', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getTopAnswerForQuestion('question-789');

        expect(result).toBeNull();
      });
    });

    describe('getRelatedAnswers', () => {
      it('should get answers related by tags and categories', async () => {
        // Mock findRelatedByCombined (inherited method)
        jest.spyOn(schema, 'findRelatedByCombined').mockResolvedValue([
          {
            nodeId: 'answer-2',
            tagStrength: 5,
            categoryStrength: 10,
            combinedStrength: 25,
          },
          {
            nodeId: 'answer-3',
            tagStrength: 3,
            categoryStrength: 8,
            combinedStrength: 19,
          },
        ]);

        // Mock getAnswer for each related answer
        jest
          .spyOn(schema, 'getAnswer')
          .mockResolvedValueOnce({
            ...mockAnswerData,
            id: 'answer-2',
            answerText: 'Related answer 2',
          })
          .mockResolvedValueOnce({
            ...mockAnswerData,
            id: 'answer-3',
            answerText: 'Related answer 3',
          });

        const result = await schema.getRelatedAnswers('answer-123', 10);

        expect(schema.findRelatedByCombined).toHaveBeenCalledWith(
          'answer-123',
          10,
        );
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('answer-2');
        expect(result[1].id).toBe('answer-3');
      });

      it('should filter out null results', async () => {
        jest.spyOn(schema, 'findRelatedByCombined').mockResolvedValue([
          {
            nodeId: 'answer-2',
            tagStrength: 5,
            categoryStrength: 10,
            combinedStrength: 25,
          },
        ]);

        jest.spyOn(schema, 'getAnswer').mockResolvedValueOnce(null);

        const result = await schema.getRelatedAnswers('answer-123');

        expect(result).toHaveLength(0);
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

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

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
        ...baseAnswerData,
        answerText: 'Updated answer text',
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

    it('should enforce business rules across operations', async () => {
      // Test category limit enforcement
      const invalidCategoryData = {
        ...mockCreateAnswerData,
        categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'], // Too many categories
      };

      await expect(schema.createAnswer(invalidCategoryData)).rejects.toThrow(
        'Answer can have maximum 3 categories',
      );

      // Test parent question must exist
      neo4jService.write.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await expect(schema.createAnswer(mockCreateAnswerData)).rejects.toThrow(
        'Parent OpenQuestion must exist and have passed inclusion threshold',
      );

      // Test content voting requires inclusion threshold
      const answerBelowThreshold = {
        ...mockAnswerData,
        inclusionNetVotes: 0,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: answerBelowThreshold }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await expect(
        schema.voteContent('answer-123', 'user-456', true),
      ).rejects.toThrow(
        'Answer must pass inclusion threshold before content voting is allowed',
      );
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

    it('should handle creation errors properly', async () => {
      neo4jService.write.mockRejectedValue(new Error('Constraint violation'));

      await expect(schema.createAnswer(mockCreateAnswerData)).rejects.toThrow(
        Error,
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
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      await schema.createAnswer(mockCreateAnswerData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('SHARED_TAG'),
        expect.any(Object),
      );
    });

    it('should require parent question ID', async () => {
      const invalidData = {
        ...mockCreateAnswerData,
        parentQuestionId: undefined as any,
      };

      await expect(schema.createAnswer(invalidData)).rejects.toThrow(
        'Parent question ID is required',
      );
    });

    it('should handle VotingUtils threshold checks', () => {
      // Test that VotingUtils.hasPassedInclusion is used correctly
      expect(VotingUtils.hasPassedInclusion(1)).toBe(true);
      expect(VotingUtils.hasPassedInclusion(0)).toBe(false);
      expect(VotingUtils.hasPassedInclusion(-1)).toBe(false);
    });
  });

  describe('Relationship Creation', () => {
    it('should create ANSWERS relationship to parent question', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      await schema.createAnswer(mockCreateAnswerData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (a)-[:ANSWERS]->(oq)'),
        expect.any(Object),
      );
    });

    it('should create CATEGORIZED_AS relationships', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      await schema.createAnswer(mockCreateAnswerData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (a)-[:CATEGORIZED_AS'),
        expect.objectContaining({
          categoryIds: mockCreateAnswerData.categoryIds,
        }),
      );
    });

    it('should create TAGGED relationships', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      await schema.createAnswer(mockCreateAnswerData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (a)-[:TAGGED'),
        expect.objectContaining({
          keywords: mockCreateAnswerData.keywords,
        }),
      );
    });

    it('should create user CREATED relationship', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      await schema.createAnswer(mockCreateAnswerData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (u)-[:CREATED'),
        expect.objectContaining({
          createdBy: 'user-456',
        }),
      );
    });

    it('should create SHARED_CATEGORY relationships for discovery', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      await schema.createAnswer(mockCreateAnswerData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (a)-[sc:SHARED_CATEGORY'),
        expect.any(Object),
      );
    });
  });

  describe('Input Validation', () => {
    it('should validate answer text is required', async () => {
      await expect(
        schema.createAnswer({
          ...mockCreateAnswerData,
          answerText: '',
        }),
      ).rejects.toThrow('Answer text cannot be empty');
    });

    it('should validate answer text is not just whitespace', async () => {
      await expect(
        schema.createAnswer({
          ...mockCreateAnswerData,
          answerText: '   \t\n  ',
        }),
      ).rejects.toThrow('Answer text cannot be empty');
    });

    it('should validate parent question ID is required', async () => {
      await expect(
        schema.createAnswer({
          ...mockCreateAnswerData,
          parentQuestionId: '',
        }),
      ).rejects.toThrow('Parent question ID is required');
    });

    it('should validate category limit on creation', async () => {
      await expect(
        schema.createAnswer({
          ...mockCreateAnswerData,
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        }),
      ).rejects.toThrow('Answer can have maximum 3 categories');
    });

    it('should validate category limit on update', async () => {
      await expect(
        schema.updateAnswer('answer-123', {
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        }),
      ).rejects.toThrow('Answer can have maximum 3 categories');
    });

    it('should validate ID parameters', async () => {
      await expect(schema.getAnswer('')).rejects.toThrow(BadRequestException);
      await expect(schema.getAnswersByQuestion('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        schema.updateAnswer('', { answerText: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Neo4j Integer Conversion', () => {
    it('should handle Neo4j Integer objects correctly', () => {
      const mockData = {
        ...mockAnswerData,
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
      expect(typeof result.contentPositiveVotes).toBe('number');
    });
  });

  describe('Discussion Integration', () => {
    it('should create discussion when creating answer', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      await schema.createAnswer(mockCreateAnswerData);

      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: 'answer-123',
        nodeType: 'AnswerNode',
        nodeIdField: 'id',
        createdBy: 'user-456',
        initialComment: 'This answer addresses the core question thoroughly.',
      });
    });

    it('should handle discussion creation without initial comment', async () => {
      const dataNoComment = {
        ...mockCreateAnswerData,
        initialComment: undefined,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      await schema.createAnswer(dataNoComment);

      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: 'answer-123',
        nodeType: 'AnswerNode',
        nodeIdField: 'id',
        createdBy: 'user-456',
        initialComment: undefined,
      });
    });
  });

  describe('Query Patterns', () => {
    it('should use correct query for finding answers by question', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await schema.getAnswersByQuestion('question-789');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('parentQuestionId: $questionId'),
        expect.objectContaining({ questionId: 'question-789' }),
      );
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY a.contentNetVotes DESC'),
        expect.any(Object),
      );
    });

    it('should retrieve enhanced answer data with proper query structure', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await schema.getAnswer('answer-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'OPTIONAL MATCH (a)-[:ANSWERS]->(oq:OpenQuestionNode)',
        ),
        expect.any(Object),
      );
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'OPTIONAL MATCH (a)-[:CATEGORIZED_AS]->(cat:CategoryNode)',
        ),
        expect.any(Object),
      );
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('OPTIONAL MATCH (a)-[t:TAGGED]->(w:WordNode)'),
        expect.any(Object),
      );
    });
  });

  describe('Performance Optimizations', () => {
    it('should order answers by quality metrics', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await schema.getAnswersByQuestion('question-789');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'ORDER BY a.contentNetVotes DESC, a.inclusionNetVotes DESC',
        ),
        expect.any(Object),
      );
    });

    it('should limit related answers query results', async () => {
      jest.spyOn(schema, 'findRelatedByCombined').mockResolvedValue([]);

      await schema.getRelatedAnswers('answer-123', 5);

      expect(schema.findRelatedByCombined).toHaveBeenCalledWith(
        'answer-123',
        5,
      );
    });
  });
});
