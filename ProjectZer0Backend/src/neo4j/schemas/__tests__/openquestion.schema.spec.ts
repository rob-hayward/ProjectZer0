// src/neo4j/schemas/__tests__/openquestion.schema.spec.ts - UPDATED

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OpenQuestionSchema, OpenQuestionData } from '../openquestion.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { DiscussionSchema } from '../discussion.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';

describe('OpenQuestionSchema with BaseNodeSchema Integration', () => {
  let schema: OpenQuestionSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;

  const mockOpenQuestionData: OpenQuestionData = {
    id: 'question-123',
    questionText: 'What is artificial intelligence?',
    createdBy: 'user-456',
    publicCredit: true,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
    discussionId: 'discussion-789',
    // Only inclusion voting (no content voting for open questions)
    inclusionPositiveVotes: 15,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 12,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockCreateQuestionData = {
    id: 'question-123',
    createdBy: 'user-456',
    publicCredit: true,
    questionText: 'What is artificial intelligence',
    keywords: [
      { word: 'artificial', frequency: 8, source: 'ai' as const },
      { word: 'intelligence', frequency: 6, source: 'ai' as const },
      { word: 'technology', frequency: 4, source: 'user' as const },
    ] as KeywordWithFrequency[],
    categoryIds: ['tech-category', 'science-category'],
    initialComment: 'This is an important question about AI',
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 15,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 12,
    contentPositiveVotes: 0, // OpenQuestions don't have content voting
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 15,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 12,
    contentStatus: null, // OpenQuestions don't have content voting
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenQuestionSchema,
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
      ],
    }).compile();

    schema = module.get<OpenQuestionSchema>(OpenQuestionSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
    discussionSchema = module.get(DiscussionSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BaseNodeSchema Integration', () => {
    describe('supportsContentVoting', () => {
      it('should return false for open questions', () => {
        expect((schema as any).supportsContentVoting()).toBe(false);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should correctly map node properties from record', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: mockOpenQuestionData,
          }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(result).toEqual(mockOpenQuestionData);
        expect(result.contentPositiveVotes).toBe(0);
        expect(result.contentNegativeVotes).toBe(0);
        expect(result.contentNetVotes).toBe(0);
      });

      it('should handle Neo4j Integer conversion', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              ...mockOpenQuestionData,
              inclusionPositiveVotes: Integer.fromNumber(15),
              inclusionNegativeVotes: Integer.fromNumber(3),
              inclusionNetVotes: Integer.fromNumber(12),
            },
          }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(typeof result.inclusionPositiveVotes).toBe('number');
        expect(result.inclusionPositiveVotes).toBe(15);
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build correct update query excluding complex fields', () => {
        const updateData = {
          questionText: 'Updated question?',
          publicCredit: false,
        };
        const result = (schema as any).buildUpdateQuery(
          'question-123',
          updateData,
        );

        expect(result.cypher).toContain('MATCH (n:OpenQuestionNode {id: $id})');
        expect(result.cypher).toContain('SET');
        expect(result.cypher).toContain('n.updatedAt = datetime()');
        expect(result.cypher).not.toContain('n.id =');
        expect(result.cypher).not.toContain('n.keywords =');
        expect(result.cypher).not.toContain('n.categoryIds =');
        expect(result.params).toEqual({
          id: 'question-123',
          updateData,
        });
      });
    });
  });

  describe('Inherited Voting Methods', () => {
    describe('voteInclusion', () => {
      it('should vote on inclusion successfully', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteInclusion(
          'question-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'OpenQuestionNode',
          { id: 'question-123' },
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
          schema.voteInclusion('question-123', '', true),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('voteContent - Should Reject', () => {
      it('should throw error when trying to vote on content', async () => {
        await expect(
          schema.voteContent('question-123', 'user-456', true),
        ).rejects.toThrow('Openquestion does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus', () => {
      it('should get vote status', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('question-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'OpenQuestionNode',
          { id: 'question-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
        expect(result?.contentStatus).toBeNull();
      });
    });

    describe('removeVote', () => {
      it('should remove inclusion vote', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeVote(
          'question-123',
          'user-456',
          'INCLUSION',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'OpenQuestionNode',
          { id: 'question-123' },
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('getVotes', () => {
      it('should get vote counts with content votes always 0', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('question-123');

        expect(result).toEqual({
          inclusionPositiveVotes: 15,
          inclusionNegativeVotes: 3,
          inclusionNetVotes: 12,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });
    });
  });

  describe('Inherited CRUD Operations', () => {
    describe('findById', () => {
      it('should find open question by id', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.findById('question-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:OpenQuestionNode {id: $id})'),
          { id: 'question-123' },
        );
        expect(result).toEqual(mockOpenQuestionData);
      });

      it('should return null when question not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.findById('nonexistent');
        expect(result).toBeNull();
      });
    });

    describe('update', () => {
      it('should update open question', async () => {
        const updateData = {
          questionText: 'Updated question?',
          publicCredit: false,
        };
        const updatedQuestion = { ...mockOpenQuestionData, ...updateData };
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedQuestion }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.update('question-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:OpenQuestionNode {id: $id})'),
          expect.objectContaining({
            id: 'question-123',
            updateData,
          }),
        );
        expect(result?.questionText).toBe('Updated question?');
      });
    });

    describe('delete', () => {
      it('should delete an open question', async () => {
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);
        neo4jService.write.mockResolvedValue({} as Result);

        const result = await schema.delete('question-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('COUNT(n) as count'),
          { id: 'question-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE n'),
          { id: 'question-123' },
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

      it('should get categories for a question', async () => {
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

        const result = await schema.getCategories('question-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:OpenQuestionNode {id: $nodeId})'),
          { nodeId: 'question-123' },
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

      it('should get keywords for a question', async () => {
        const mockRecords = mockCreateQuestionData.keywords.map((keyword) => ({
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

        const result = await schema.getKeywords('question-123');

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({
          word: 'artificial',
          frequency: 8,
          source: 'ai',
        });
      });
    });
  });

  describe('OpenQuestion-Specific Methods', () => {
    describe('createOpenQuestion', () => {
      it('should create a new open question successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-789',
        });

        const result = await schema.createOpenQuestion(mockCreateQuestionData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (oq:OpenQuestionNode'),
          expect.objectContaining({
            id: 'question-123',
            createdBy: 'user-456',
            questionText: 'What is artificial intelligence?', // Should auto-add ?
            publicCredit: true,
            keywords: mockCreateQuestionData.keywords,
            categoryIds: mockCreateQuestionData.categoryIds,
          }),
        );

        expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
          nodeId: 'question-123',
          nodeType: 'OpenQuestionNode',
          nodeIdField: 'id',
          createdBy: 'user-456',
          initialComment: 'This is an important question about AI',
        });

        expect(result).toEqual(
          expect.objectContaining({
            id: 'question-123',
            questionText: 'What is artificial intelligence?',
            discussionId: 'discussion-789',
          }),
        );
      });

      it('should automatically add question mark if missing', async () => {
        const dataWithoutQuestionMark = {
          ...mockCreateQuestionData,
          questionText: 'What is machine learning',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              ...mockOpenQuestionData,
              questionText: 'What is machine learning?',
            },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-789',
        });

        await schema.createOpenQuestion(dataWithoutQuestionMark);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            questionText: 'What is machine learning?',
          }),
        );
      });

      it('should not double-add question mark if already present', async () => {
        const dataWithQuestionMark = {
          ...mockCreateQuestionData,
          questionText: 'What is deep learning?',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-789',
        });

        await schema.createOpenQuestion(dataWithQuestionMark);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            questionText: 'What is deep learning?',
          }),
        );
      });

      it('should generate id if not provided', async () => {
        const dataWithoutId = {
          ...mockCreateQuestionData,
          id: undefined,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-789',
        });

        await schema.createOpenQuestion(dataWithoutId);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            id: expect.stringMatching(/^[a-f0-9-]{36}$/), // UUID pattern
          }),
        );
      });

      it('should create question without categories', async () => {
        const questionDataNoCategories = {
          ...mockCreateQuestionData,
          categoryIds: undefined,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-789',
        });

        const result = await schema.createOpenQuestion(
          questionDataNoCategories,
        );

        expect(result).toBeDefined();
      });

      it('should create question without keywords', async () => {
        const questionDataNoKeywords = {
          ...mockCreateQuestionData,
          keywords: undefined,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-789',
        });

        await schema.createOpenQuestion(questionDataNoKeywords);

        expect(neo4jService.write).toHaveBeenCalled();
      });

      it('should throw BadRequestException when questionText is empty', async () => {
        const invalidData = { ...mockCreateQuestionData, questionText: '' };

        await expect(schema.createOpenQuestion(invalidData)).rejects.toThrow(
          'Question text cannot be empty',
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when more than 3 categories provided', async () => {
        const invalidData = {
          ...mockCreateQuestionData,
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        };

        await expect(schema.createOpenQuestion(invalidData)).rejects.toThrow(
          'OpenQuestion can have maximum 3 categories',
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should handle keyword/category validation errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(new Error('Category not found'));

        await expect(
          schema.createOpenQuestion(mockCreateQuestionData),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('updateOpenQuestion', () => {
      it('should update open question with simple properties', async () => {
        const simpleUpdateData = {
          questionText: 'What is natural language processing',
          publicCredit: false,
        };

        const updatedNode = {
          ...mockOpenQuestionData,
          ...simpleUpdateData,
          questionText: 'What is natural language processing?', // With added ?
        };
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedNode }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.updateOpenQuestion(
          'question-123',
          simpleUpdateData,
        );

        expect(result?.questionText).toBe(
          'What is natural language processing?',
        );
        expect(result?.publicCredit).toBe(false);
      });

      it('should update categories and keywords', async () => {
        const complexUpdate = {
          keywords: [
            { word: 'deep', frequency: 5, source: 'ai' as const },
            { word: 'learning', frequency: 7, source: 'user' as const },
          ],
          categoryIds: ['ai-category', 'learning-category'],
        };

        // Mock updateCategories and updateKeywords (inherited methods)
        jest.spyOn(schema, 'updateCategories').mockResolvedValue();
        jest.spyOn(schema, 'updateKeywords').mockResolvedValue();

        // Mock getOpenQuestion to return updated data
        jest.spyOn(schema, 'getOpenQuestion').mockResolvedValue({
          ...mockOpenQuestionData,
          keywords: complexUpdate.keywords,
          categories: [
            { id: 'ai-category', name: 'AI' },
            { id: 'learning-category', name: 'Learning' },
          ],
        } as any);

        await schema.updateOpenQuestion('question-123', complexUpdate);

        expect(schema.updateCategories).toHaveBeenCalledWith(
          'question-123',
          complexUpdate.categoryIds,
        );
        expect(schema.updateKeywords).toHaveBeenCalledWith(
          'question-123',
          complexUpdate.keywords,
        );
      });

      it('should automatically add question mark during update', async () => {
        const updateDataNoMark = {
          questionText: 'What is neural network',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              ...mockOpenQuestionData,
              questionText: 'What is neural network?',
            },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.updateOpenQuestion(
          'question-123',
          updateDataNoMark,
        );

        expect(result?.questionText).toBe('What is neural network?');
      });

      it('should throw BadRequestException when more than 3 categories provided', async () => {
        const invalidUpdate = {
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        };

        await expect(
          schema.updateOpenQuestion('question-123', invalidUpdate),
        ).rejects.toThrow('OpenQuestion can have maximum 3 categories');
      });
    });

    describe('getOpenQuestion', () => {
      it('should get open question with all related data', async () => {
        const mockQuestionRecord = {
          get: jest.fn((key: string) => {
            if (key === 'n') return { properties: mockOpenQuestionData };
            if (key === 'keywords')
              return [
                { word: 'artificial', frequency: 8, source: 'ai' },
                { word: 'intelligence', frequency: 6, source: 'ai' },
              ];
            if (key === 'categories')
              return [
                {
                  id: 'tech-category',
                  name: 'Technology',
                  description: 'Tech topics',
                  inclusionNetVotes: 10,
                },
              ];
            if (key === 'discussionId') return 'discussion-456';
            if (key === 'answers')
              return [
                {
                  id: 'answer-1',
                  answerText: 'AI is...',
                  createdBy: 'user-789',
                  inclusionNetVotes: 5,
                  contentNetVotes: 8,
                },
              ];
            return null;
          }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockQuestionRecord],
        } as unknown as Result);

        const result = await schema.getOpenQuestion('question-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (oq:OpenQuestionNode {id: $id})'),
          { id: 'question-123' },
        );
        expect(result).toEqual(
          expect.objectContaining({
            id: 'question-123',
            questionText: 'What is artificial intelligence?',
            keywords: expect.arrayContaining([
              expect.objectContaining({ word: 'artificial' }),
            ]),
            categories: expect.arrayContaining([
              expect.objectContaining({ id: 'tech-category' }),
            ]),
            answers: expect.arrayContaining([
              expect.objectContaining({ id: 'answer-1' }),
            ]),
            discussionId: 'discussion-456',
          }),
        );
      });

      it('should return null when question not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getOpenQuestion('nonexistent');
        expect(result).toBeNull();
      });
    });

    describe('getOpenQuestions', () => {
      it('should get all approved open questions by default', async () => {
        const mockRecords = [
          {
            get: jest
              .fn()
              .mockReturnValue({ properties: mockOpenQuestionData }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getOpenQuestions();

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('WHERE oq.inclusionNetVotes > 0'),
          expect.objectContaining({ limit: 50, offset: 0 }),
        );
        expect(result).toHaveLength(1);
      });

      it('should include unapproved questions when specified', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getOpenQuestions({ includeUnapproved: true });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.not.stringContaining('WHERE oq.inclusionNetVotes > 0'),
          expect.any(Object),
        );
      });

      it('should filter by category', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getOpenQuestions({ categoryId: 'tech-category' });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'EXISTS((oq)-[:CATEGORIZED_AS]->(:CategoryNode {id: $categoryId}))',
          ),
          expect.objectContaining({ categoryId: 'tech-category' }),
        );
      });
    });

    describe('canReceiveAnswers', () => {
      it('should return true when question has passed inclusion threshold', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue(mockOpenQuestionData);

        const result = await schema.canReceiveAnswers('question-123');
        expect(result).toBe(true);
      });

      it('should return false when question has not passed inclusion threshold', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue({
          ...mockOpenQuestionData,
          inclusionNetVotes: 0,
        });

        const result = await schema.canReceiveAnswers('question-123');
        expect(result).toBe(false);
      });

      it('should return false when question does not exist', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue(null);

        const result = await schema.canReceiveAnswers('nonexistent');
        expect(result).toBe(false);
      });
    });

    describe('getRelatedQuestions', () => {
      it('should get questions related by tags and categories', async () => {
        // Mock findRelatedByCombined (inherited method)
        jest.spyOn(schema, 'findRelatedByCombined').mockResolvedValue([
          {
            nodeId: 'question-2',
            tagStrength: 5,
            categoryStrength: 10,
            combinedStrength: 25,
          },
          {
            nodeId: 'question-3',
            tagStrength: 3,
            categoryStrength: 8,
            combinedStrength: 19,
          },
        ]);

        // Mock getOpenQuestion for each related question
        jest
          .spyOn(schema, 'getOpenQuestion')
          .mockResolvedValueOnce({
            ...mockOpenQuestionData,
            id: 'question-2',
            questionText: 'What is machine learning?',
          })
          .mockResolvedValueOnce({
            ...mockOpenQuestionData,
            id: 'question-3',
            questionText: 'What is deep learning?',
          });

        const result = await schema.getRelatedQuestions('question-123', 10);

        expect(schema.findRelatedByCombined).toHaveBeenCalledWith(
          'question-123',
          10,
        );
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('question-2');
        expect(result[1].id).toBe('question-3');
      });

      it('should filter out null results', async () => {
        jest.spyOn(schema, 'findRelatedByCombined').mockResolvedValue([
          {
            nodeId: 'question-2',
            tagStrength: 5,
            categoryStrength: 10,
            combinedStrength: 25,
          },
        ]);

        jest.spyOn(schema, 'getOpenQuestion').mockResolvedValueOnce(null);

        const result = await schema.getRelatedQuestions('question-123');

        expect(result).toHaveLength(0);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete open question lifecycle', async () => {
      // Create
      const mockCreatedRecord = {
        get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockCreatedRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      const created = await schema.createOpenQuestion(mockCreateQuestionData);
      expect(created.id).toBe('question-123');

      // Read
      const mockFindRecord = {
        get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [mockFindRecord],
      } as unknown as Result);

      const found = await schema.findById('question-123');
      expect(found).toEqual(mockOpenQuestionData);

      // Vote on inclusion
      voteSchema.vote.mockResolvedValueOnce(mockVoteResult);
      const voteResult = await schema.voteInclusion(
        'question-123',
        'user-789',
        true,
      );
      expect(voteResult.inclusionNetVotes).toBe(12);

      // Update
      const updateData = {
        questionText: 'Updated question',
        publicCredit: false,
      };
      const mockUpdateRecord = {
        get: jest.fn().mockReturnValue({
          properties: {
            ...mockOpenQuestionData,
            ...updateData,
            questionText: 'Updated question?',
          },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockUpdateRecord],
      } as unknown as Result);

      const updated = await schema.updateOpenQuestion(
        'question-123',
        updateData,
      );
      expect(updated?.questionText).toBe('Updated question?');

      // Delete
      const deleteExistsRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [deleteExistsRecord],
      } as unknown as Result);
      neo4jService.write.mockResolvedValueOnce({} as Result);

      const deleted = await schema.delete('question-123');
      expect(deleted).toEqual({ success: true });
    });

    it('should enforce business rules across operations', async () => {
      // Test category limit enforcement
      const invalidCategoryData = {
        ...mockCreateQuestionData,
        categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'], // Too many categories
      };

      await expect(
        schema.createOpenQuestion(invalidCategoryData),
      ).rejects.toThrow('OpenQuestion can have maximum 3 categories');

      // Test question text normalization
      const questionWithoutMark = {
        ...mockCreateQuestionData,
        questionText: 'What is AI',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockOpenQuestionData, questionText: 'What is AI?' },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createOpenQuestion(questionWithoutMark);
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          questionText: 'What is AI?',
        }),
      );

      // Test content voting is not allowed
      await expect(
        schema.voteContent('question-123', 'user-456', true),
      ).rejects.toThrow('Openquestion does not support content voting');
    });
  });

  describe('Error Handling', () => {
    it('should use standardized error messages from BaseNodeSchema', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.findById('test')).rejects.toThrow(
        'Failed to find Openquestion: Database connection failed',
      );
    });

    it('should handle question-specific errors consistently', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query timeout'));

      await expect(schema.getOpenQuestion('question-123')).rejects.toThrow(
        'Failed to get open question Openquestion: Query timeout',
      );
    });

    it('should handle creation errors properly', async () => {
      neo4jService.write.mockRejectedValue(new Error('Keyword not found'));

      await expect(
        schema.createOpenQuestion(mockCreateQuestionData),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Business Rules', () => {
    it('should enforce no content voting for questions', async () => {
      await expect(
        schema.voteContent('question-123', 'user-456', true),
      ).rejects.toThrow('Openquestion does not support content voting');
    });

    it('should enforce maximum 3 categories', async () => {
      const tooManyCategories = {
        ...mockCreateQuestionData,
        categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
      };

      await expect(
        schema.createOpenQuestion(tooManyCategories),
      ).rejects.toThrow('OpenQuestion can have maximum 3 categories');
    });

    it('should require inclusion threshold for answers', async () => {
      jest.spyOn(schema, 'findById').mockResolvedValue({
        ...mockOpenQuestionData,
        inclusionNetVotes: -2,
      });

      const canReceive = await schema.canReceiveAnswers('question-123');
      expect(canReceive).toBe(false);
    });

    it('should normalize question text', async () => {
      const questions = [
        { input: 'What is AI', expected: 'What is AI?' },
        { input: 'What is AI?', expected: 'What is AI?' },
        { input: 'What is AI??', expected: 'What is AI??' }, // Don't remove existing ?
        { input: '  What is AI  ', expected: 'What is AI?' },
      ];

      for (const q of questions) {
        const normalized = (schema as any).normalizeQuestionText(q.input);
        expect(normalized).toBe(q.expected);
      }
    });
  });

  describe('Input Validation', () => {
    it('should validate question text is required', async () => {
      await expect(
        schema.createOpenQuestion({
          ...mockCreateQuestionData,
          questionText: '',
        }),
      ).rejects.toThrow('Question text cannot be empty');
    });

    it('should validate question text is not just whitespace', async () => {
      await expect(
        schema.createOpenQuestion({
          ...mockCreateQuestionData,
          questionText: '   ',
        }),
      ).rejects.toThrow('Question text cannot be empty');
    });

    it('should validate category limit on creation', async () => {
      await expect(
        schema.createOpenQuestion({
          ...mockCreateQuestionData,
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        }),
      ).rejects.toThrow('OpenQuestion can have maximum 3 categories');
    });

    it('should validate category limit on update', async () => {
      await expect(
        schema.updateOpenQuestion('question-123', {
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        }),
      ).rejects.toThrow('OpenQuestion can have maximum 3 categories');
    });
  });

  describe('Neo4j Integer Conversion', () => {
    it('should handle Neo4j Integer objects correctly', () => {
      const mockData = {
        ...mockOpenQuestionData,
        inclusionPositiveVotes: { low: 42, high: 0 },
        inclusionNegativeVotes: { low: 7, high: 0 },
        inclusionNetVotes: { low: 35, high: 0 },
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockData }),
      } as unknown as Record;

      const result = (schema as any).mapNodeFromRecord(mockRecord);

      expect(result.inclusionPositiveVotes).toBe(42);
      expect(result.inclusionNegativeVotes).toBe(7);
      expect(result.inclusionNetVotes).toBe(35);
      expect(typeof result.inclusionPositiveVotes).toBe('number');
    });
  });

  describe('Relationship Creation', () => {
    it('should create CATEGORIZED_AS relationships', async () => {
      const dataWithCategories = {
        ...mockCreateQuestionData,
        categoryIds: ['cat1', 'cat2'],
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createOpenQuestion(dataWithCategories);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (oq)-[:CATEGORIZED_AS'),
        expect.objectContaining({
          categoryIds: ['cat1', 'cat2'],
        }),
      );
    });

    it('should create TAGGED relationships', async () => {
      const dataWithKeywords = {
        ...mockCreateQuestionData,
        keywords: [{ word: 'test', frequency: 3, source: 'ai' as const }],
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createOpenQuestion(dataWithKeywords);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (oq)-[:TAGGED'),
        expect.objectContaining({
          keywords: dataWithKeywords.keywords,
        }),
      );
    });

    it('should create SHARED_CATEGORY relationships', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createOpenQuestion(mockCreateQuestionData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (oq)-[sc:SHARED_CATEGORY'),
        expect.any(Object),
      );
    });

    it('should create SHARED_TAG relationships', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createOpenQuestion(mockCreateQuestionData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (oq)-[st:SHARED_TAG'),
        expect.any(Object),
      );
    });

    it('should create user CREATED relationship', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createOpenQuestion(mockCreateQuestionData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (u)-[:CREATED'),
        expect.objectContaining({
          createdBy: 'user-456',
        }),
      );
    });
  });

  describe('Discussion Integration', () => {
    it('should create discussion when creating question', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createOpenQuestion(mockCreateQuestionData);

      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: 'question-123',
        nodeType: 'OpenQuestionNode',
        nodeIdField: 'id',
        createdBy: 'user-456',
        initialComment: 'This is an important question about AI',
      });
    });

    it('should handle discussion creation without initial comment', async () => {
      const dataNoComment = {
        ...mockCreateQuestionData,
        initialComment: undefined,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-789',
      });

      await schema.createOpenQuestion(dataNoComment);

      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: 'question-123',
        nodeType: 'OpenQuestionNode',
        nodeIdField: 'id',
        createdBy: 'user-456',
        initialComment: undefined,
      });
    });
  });
});
