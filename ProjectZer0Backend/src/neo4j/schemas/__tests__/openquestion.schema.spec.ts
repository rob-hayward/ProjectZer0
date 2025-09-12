// src/neo4j/schemas/__tests__/openquestion.schema.spec.ts - CONVERTED TO BaseNodeSchema

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OpenQuestionSchema, OpenQuestionData } from '../openquestion.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';

describe('OpenQuestionSchema with BaseNodeSchema Integration', () => {
  let schema: OpenQuestionSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  // Mock data constants
  const mockOpenQuestionData: OpenQuestionData = {
    id: 'question-123',
    questionText: 'What is artificial intelligence?',
    createdBy: 'user-456',
    publicCredit: true,
    visibilityStatus: true,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
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
      ],
    }).compile();

    schema = module.get<OpenQuestionSchema>(OpenQuestionSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(schema).toBeDefined();
  });

  // INHERITED BASENODESSCHEMA METHODS TESTS
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
            properties: {
              id: 'question-123',
              questionText: 'What is AI?',
              createdBy: 'user-456',
              publicCredit: true,
              visibilityStatus: true,
              createdAt: new Date('2023-01-01T00:00:00Z'),
              updatedAt: new Date('2023-01-01T00:00:00Z'),
              inclusionPositiveVotes: 10,
              inclusionNegativeVotes: 2,
              inclusionNetVotes: 8,
              // Content voting should be 0
              contentPositiveVotes: 0,
              contentNegativeVotes: 0,
              contentNetVotes: 0,
            },
          }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(result).toEqual(
          expect.objectContaining({
            id: 'question-123',
            questionText: 'What is AI?',
            createdBy: 'user-456',
            publicCredit: true,
            inclusionPositiveVotes: 10,
            inclusionNegativeVotes: 2,
            inclusionNetVotes: 8,
            // Content voting should be 0
            contentPositiveVotes: 0,
            contentNegativeVotes: 0,
            contentNetVotes: 0,
          }),
        );
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build correct update query', () => {
        const updateData = {
          questionText: 'Updated question?',
          publicCredit: false,
        };
        const result = (schema as any).buildUpdateQuery(
          'question-123',
          updateData,
        );

        expect(result.cypher).toContain('MATCH (n:OpenQuestionNode {id: $id})');
        expect(result.cypher).toContain(
          'n.questionText = $updateData.questionText',
        );
        expect(result.cypher).toContain(
          'n.publicCredit = $updateData.publicCredit',
        );
        expect(result.cypher).toContain('n.updatedAt = datetime()');
        expect(result.params).toEqual({
          id: 'question-123',
          updateData,
        });
      });

      it('should exclude id field and complex fields from updates', () => {
        const updateData = {
          id: 'new-id',
          questionText: 'Updated question',
          keywords: [{ word: 'test', frequency: 1, source: 'ai' as const }],
          categoryIds: ['cat1'],
        };
        const result = (schema as any).buildUpdateQuery(
          'question-123',
          updateData,
        );

        expect(result.cypher).not.toContain('n.id = $updateData.id');
        expect(result.cypher).not.toContain(
          'n.keywords = $updateData.keywords',
        );
        expect(result.cypher).not.toContain(
          'n.categoryIds = $updateData.categoryIds',
        );
        expect(result.cypher).toContain(
          'n.questionText = $updateData.questionText',
        );
      });
    });

    describe('findById (inherited)', () => {
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
        expect(result).toEqual(expect.objectContaining({ id: 'question-123' }));
      });

      it('should throw NotFoundException when question not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(schema.findById('nonexistent')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('voteInclusion (inherited)', () => {
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

      it('should handle voting errors gracefully', async () => {
        voteSchema.vote.mockRejectedValue(new Error('Vote failed'));

        await expect(
          schema.voteInclusion('question-123', 'user-456', true),
        ).rejects.toThrow('Failed to vote on OpenQuestionSchema: Vote failed');
      });
    });

    describe('voteContent (inherited)', () => {
      it('should throw error when trying to vote on content', async () => {
        await expect(
          schema.voteContent('question-123', 'user-456', true),
        ).rejects.toThrow('Openquestion does not support content voting');

        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus (inherited)', () => {
      it('should get vote status for an open question', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('question-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'OpenQuestionNode',
          { id: 'question-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when no vote status exists', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await schema.getVoteStatus('question-123', 'user-456');

        expect(result).toBeNull();
      });

      it('should validate inputs', async () => {
        await expect(schema.getVoteStatus('', 'user-456')).rejects.toThrow(
          BadRequestException,
        );

        await expect(schema.getVoteStatus('question-123', '')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('removeVote (inherited)', () => {
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

      it('should throw error when trying to remove content vote', async () => {
        voteSchema.removeVote.mockRejectedValue(
          new Error('OpenQuestionNode does not support content voting'),
        );

        await expect(
          schema.removeVote('question-123', 'user-456', 'CONTENT'),
        ).rejects.toThrow('OpenQuestionNode does not support content voting');
      });
    });

    describe('update (inherited)', () => {
      it('should update open question basic properties', async () => {
        const updateData = {
          questionText: 'Updated question?',
          publicCredit: false,
        };
        const updatedNode = { ...mockOpenQuestionData, ...updateData };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedNode }),
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
        expect(result.questionText).toBe('Updated question?');
        expect(result.publicCredit).toBe(false);
      });
    });

    describe('delete (inherited)', () => {
      it('should delete an open question', async () => {
        // Mock existence check (step 1 of BaseNodeSchema delete)
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

        // Mock the actual delete operation (step 2)
        neo4jService.write.mockResolvedValue({} as Result);

        const result = await schema.delete('question-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (n:OpenQuestionNode {id: $id}) RETURN COUNT(n) as count',
          { id: 'question-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          'MATCH (n:OpenQuestionNode {id: $id}) DETACH DELETE n',
          { id: 'question-123' },
        );
        expect(result).toEqual({ success: true });
      });
    });
  });

  // OPENQUESTION-SPECIFIC METHODS TESTS
  describe('OpenQuestion-Specific Methods', () => {
    describe('createOpenQuestion', () => {
      it('should create a new open question successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.createOpenQuestion(mockCreateQuestionData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (oq:OpenQuestionNode'),
          expect.objectContaining({
            id: 'question-123',
            createdBy: 'user-456',
            questionText: 'What is artificial intelligence?', // Should auto-add ?
            publicCredit: true,
            initialComment: 'This is an important question about AI',
            keywords: mockCreateQuestionData.keywords,
            categoryIds: mockCreateQuestionData.categoryIds,
          }),
        );
        expect(result).toEqual(
          expect.objectContaining({
            id: 'question-123',
            questionText: 'What is artificial intelligence?',
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

        await schema.createOpenQuestion(dataWithQuestionMark);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            questionText: 'What is deep learning?',
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

        const result = await schema.createOpenQuestion(
          questionDataNoCategories,
        );

        expect(neo4jService.write).toHaveBeenCalled();
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

        await schema.createOpenQuestion(questionDataNoKeywords);

        expect(neo4jService.write).toHaveBeenCalled();
      });

      it('should throw BadRequestException when questionText is empty', async () => {
        const invalidData = { ...mockCreateQuestionData, questionText: '' };

        await expect(schema.createOpenQuestion(invalidData)).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when questionText is only whitespace', async () => {
        const invalidData = { ...mockCreateQuestionData, questionText: '   ' };

        await expect(schema.createOpenQuestion(invalidData)).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when more than 3 categories provided', async () => {
        const invalidData = {
          ...mockCreateQuestionData,
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        };

        await expect(schema.createOpenQuestion(invalidData)).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should handle keyword/category validation errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(new Error('Category not found'));

        await expect(
          schema.createOpenQuestion(mockCreateQuestionData),
        ).rejects.toThrow(BadRequestException);
      });

      it('should handle Neo4j errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(
          new Error('Database connection failed'),
        );

        await expect(
          schema.createOpenQuestion(mockCreateQuestionData),
        ).rejects.toThrow(
          'Failed to create open question: Database connection failed',
        );
      });
    });

    describe('updateOpenQuestion', () => {
      it('should update open question with simple properties using inherited method', async () => {
        const simpleUpdateData = {
          questionText: 'What is natural language processing?',
          publicCredit: false,
        };

        // Mock the inherited update method
        const updatedNode = { ...mockOpenQuestionData, ...simpleUpdateData };
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

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:OpenQuestionNode {id: $id})'),
          expect.objectContaining({
            id: 'question-123',
            updateData: expect.objectContaining({
              questionText: 'What is natural language processing?',
            }),
          }),
        );
        expect(result.questionText).toBe(
          'What is natural language processing?',
        );
      });

      it('should update open question with complex properties', async () => {
        const complexUpdate = {
          questionText: 'What is deep learning',
          keywords: [
            { word: 'deep', frequency: 5, source: 'ai' as const },
            { word: 'learning', frequency: 7, source: 'user' as const },
          ],
          categoryIds: ['ai-category', 'learning-category'],
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockOpenQuestionData, ...complexUpdate },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        await schema.updateOpenQuestion('question-123', complexUpdate);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('UNWIND categoryIds as categoryId'),
          expect.objectContaining({
            keywords: complexUpdate.keywords,
            categoryIds: complexUpdate.categoryIds,
          }),
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

        expect(result.questionText).toBe('What is neural network?');
      });

      it('should throw BadRequestException when more than 3 categories provided', async () => {
        const invalidUpdate = {
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        };

        await expect(
          schema.updateOpenQuestion('question-123', invalidUpdate),
        ).rejects.toThrow(BadRequestException);
      });

      it('should handle Neo4j errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(new Error('Update failed'));

        await expect(
          schema.updateOpenQuestion('question-123', { questionText: 'test' }),
        ).rejects.toThrow('Failed to update OpenQuestion: Update failed');
      });
    });

    describe('getOpenQuestion', () => {
      it('should get open question with all related data', async () => {
        const mockQuestionRecord = {
          get: jest.fn().mockImplementation((key: string) => {
            const mockData = {
              oq: { properties: mockOpenQuestionData },
              inclusionPositiveVotes: 15,
              inclusionNegativeVotes: 3,
              keywords: [
                { word: 'artificial', frequency: 8, source: 'ai' },
                { word: 'intelligence', frequency: 6, source: 'ai' },
              ],
              categories: [
                { id: 'tech-category', name: 'Technology' },
                { id: 'science-category', name: 'Science' },
              ],
              discussionId: 'discussion-456',
            };
            return mockData[key];
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
              expect.objectContaining({ word: 'intelligence' }),
            ]),
            categories: expect.arrayContaining([
              expect.objectContaining({ id: 'tech-category' }),
            ]),
            discussionId: 'discussion-456',
          }),
        );
      });

      it('should throw NotFoundException when question does not exist', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(schema.getOpenQuestion('nonexistent-id')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should throw BadRequestException when ID is empty', async () => {
        await expect(schema.getOpenQuestion('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });

      it('should handle Neo4j errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Database error'));

        await expect(schema.getOpenQuestion('question-123')).rejects.toThrow(
          'Failed to retrieve OpenQuestion Openquestion: Database error',
        );
      });
    });

    describe('deleteOpenQuestion', () => {
      it('should delete an open question with related data successfully', async () => {
        // Mock existence check
        const checkResult = {
          records: [{ get: jest.fn().mockReturnValue(mockOpenQuestionData) }],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(checkResult);
        neo4jService.write.mockResolvedValue({} as Result);

        const result = await schema.deleteOpenQuestion('question-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (oq:OpenQuestionNode {id: $id}) RETURN oq',
          ),
          { id: 'question-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE oq, d, c'),
          { id: 'question-123' },
        );
        expect(result).toEqual({
          success: true,
          message: 'Open question with ID question-123 successfully deleted',
        });
      });

      it('should throw NotFoundException when question does not exist', async () => {
        const checkResult = {
          records: [],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(checkResult);

        await expect(
          schema.deleteOpenQuestion('nonexistent-id'),
        ).rejects.toThrow(NotFoundException);
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when ID is empty', async () => {
        await expect(schema.deleteOpenQuestion('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });

      it('should handle Neo4j errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Delete failed'));

        await expect(schema.deleteOpenQuestion('question-123')).rejects.toThrow(
          'Failed to delete OpenQuestion Openquestion: Delete failed',
        );
      });
    });

    describe('setVisibilityStatus', () => {
      it('should set visibility status successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockOpenQuestionData, visibilityStatus: false },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.setVisibilityStatus('question-123', false);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('SET oq.visibilityStatus = $isVisible'),
          { id: 'question-123', isVisible: false },
        );
        expect(result.visibilityStatus).toBe(false);
      });

      it('should throw NotFoundException when question does not exist', async () => {
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(
          schema.setVisibilityStatus('nonexistent-id', true),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('getVisibilityStatus', () => {
      it('should get visibility status successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(true),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getVisibilityStatus('question-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (oq:OpenQuestionNode {id: $id})'),
          { id: 'question-123' },
        );
        expect(result).toBe(true);
      });

      it('should return default visibility status when not set', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(null),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getVisibilityStatus('question-123');

        expect(result).toBe(true); // Default visibility is true
      });

      it('should throw NotFoundException when question does not exist', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(
          schema.getVisibilityStatus('nonexistent-id'),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('getOpenQuestionsByUser', () => {
      it('should get open questions for a user', async () => {
        const mockQuestions = [
          { properties: { ...mockOpenQuestionData, id: 'question-1' } },
          { properties: { ...mockOpenQuestionData, id: 'question-2' } },
        ];

        neo4jService.read.mockResolvedValue({
          records: mockQuestions.map((q) => ({
            get: jest.fn().mockReturnValue(q),
          })),
        } as unknown as Result);

        const result = await schema.getOpenQuestionsByUser('user-456', 10, 0);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (oq:OpenQuestionNode {createdBy: $userId})',
          ),
          { userId: 'user-456', limit: 10, offset: 0 },
        );
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('question-1');
        expect(result[1].id).toBe('question-2');
      });

      it('should throw BadRequestException when user ID is empty', async () => {
        await expect(schema.getOpenQuestionsByUser('', 10, 0)).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });

      it('should handle errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Database error'));

        await expect(schema.getOpenQuestionsByUser('user-456')).rejects.toThrow(
          'Failed to get open questions by user Openquestion: Database error',
        );
      });
    });

    describe('getTopOpenQuestions', () => {
      it('should get top open questions sorted by net positive votes', async () => {
        const mockQuestions = [
          {
            properties: {
              ...mockOpenQuestionData,
              id: 'question-1',
              inclusionNetVotes: 20,
            },
          },
          {
            properties: {
              ...mockOpenQuestionData,
              id: 'question-2',
              inclusionNetVotes: 15,
            },
          },
        ];

        neo4jService.read.mockResolvedValue({
          records: mockQuestions.map((q) => ({
            get: jest.fn().mockReturnValue(q),
          })),
        } as unknown as Result);

        const result = await schema.getTopOpenQuestions(
          10,
          'netPositive',
          'desc',
        );

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY oq.inclusionNetVotes DESC'),
          { limit: 10 },
        );
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('question-1');
        expect(result[1].id).toBe('question-2');
      });

      it('should get top open questions sorted by total votes', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getTopOpenQuestions(5, 'totalVotes', 'asc');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'ORDER BY (oq.inclusionPositiveVotes + oq.inclusionNegativeVotes) ASC',
          ),
          { limit: 5 },
        );
      });

      it('should get top open questions sorted chronologically', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getTopOpenQuestions(20, 'chronological', 'desc');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY oq.createdAt DESC'),
          { limit: 20 },
        );
      });

      it('should handle errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Database error'));

        await expect(schema.getTopOpenQuestions()).rejects.toThrow(
          'Failed to get top open questions Openquestion: Database error',
        );
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

      const created = await schema.createOpenQuestion(mockCreateQuestionData);
      expect(created.id).toBe('question-123');

      // Find using inherited method
      const mockFindRecord = {
        get: jest.fn().mockReturnValue({ properties: mockOpenQuestionData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [mockFindRecord],
      } as unknown as Result);

      const found = await schema.findById('question-123');
      expect(found).toEqual(expect.objectContaining({ id: 'question-123' }));

      // Vote on inclusion using inherited method
      voteSchema.vote.mockResolvedValueOnce(mockVoteResult);
      const voteResult = await schema.voteInclusion(
        'question-123',
        'user-789',
        true,
      );
      expect(voteResult.inclusionNetVotes).toBe(12);

      // Update using enhanced method
      const updateData = {
        questionText: 'Updated question',
        publicCredit: false,
      };
      const mockUpdateRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockOpenQuestionData, ...updateData },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockUpdateRecord],
      } as unknown as Result);

      const updated = await schema.updateOpenQuestion(
        'question-123',
        updateData,
      );
      expect(updated.questionText).toBe('Updated question');

      // Delete using inherited method
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

      await schema.createOpenQuestion(questionWithoutMark);
      // The question mark should be automatically added
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

    it('should handle inclusion-only voting pattern correctly', async () => {
      // Test inclusion voting works
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const inclusionResult = await schema.voteInclusion(
        'question-123',
        'user-456',
        true,
      );
      expect(inclusionResult).toEqual(mockVoteResult);

      // Test content voting is disabled
      await expect(
        schema.voteContent('question-123', 'user-456', true),
      ).rejects.toThrow('Openquestion does not support content voting');

      // Test vote status works
      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);
      const voteStatus = await schema.getVoteStatus('question-123', 'user-456');
      expect(voteStatus?.contentStatus).toBeNull(); // Content status should be null

      // Test remove vote works for inclusion only
      voteSchema.removeVote.mockResolvedValue(mockVoteResult);
      const removeResult = await schema.removeVote(
        'question-123',
        'user-456',
        'INCLUSION',
      );
      expect(removeResult).toEqual(mockVoteResult);
    });
  });
});
