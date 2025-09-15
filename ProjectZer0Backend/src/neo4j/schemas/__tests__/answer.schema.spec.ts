// src/neo4j/schemas/__tests__/answer.schema.spec.ts - UPDATED FOR BaseNodeSchema

import { Test, TestingModule } from '@nestjs/testing';
import { AnswerSchema } from '../answer.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from '../vote.schema';

describe('AnswerSchema', () => {
  let schema: AnswerSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  // Mock data constants
  const mockAnswerData = {
    id: 'answer-123',
    answerText: 'This is a test answer to an open question.',
    createdBy: 'user-456',
    publicCredit: true,
    parentQuestionId: 'question-789',
    categoryIds: ['category-1', 'category-2'],
    keywords: [
      { word: 'test', frequency: 5, source: 'ai' as const },
      { word: 'answer', frequency: 3, source: 'ai' as const },
    ] as KeywordWithFrequency[],
    initialComment: 'This is my initial comment',
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
        AnswerSchema,
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

    schema = module.get<AnswerSchema>(AnswerSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(schema).toBeDefined();
  });

  // INHERITED FROM BaseNodeSchema TESTS
  describe('Inherited BaseNodeSchema Methods', () => {
    describe('findById (inherited)', () => {
      it('should find answer by id using inherited method', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.findById('answer-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:AnswerNode {id: $id})'),
          { id: 'answer-123' },
        );
        expect(result).toBeDefined();
        expect(result?.id).toBe('answer-123');
      });

      it('should return null when answer not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.findById('nonexistent');
        expect(result).toBeNull();
      });
    });

    describe('update (inherited)', () => {
      it('should update answer using inherited method for simple updates', async () => {
        const updateData = { answerText: 'Updated answer text' };
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockAnswerData, ...updateData },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.update('answer-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:AnswerNode {id: $id})'),
          expect.objectContaining({ id: 'answer-123' }),
        );
        expect(result.answerText).toBe('Updated answer text');
      });
    });

    describe('delete (inherited)', () => {
      it('should delete answer using inherited method', async () => {
        const existsRecord = {
          get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);
        neo4jService.write.mockResolvedValue({} as unknown as Result);

        const result = await schema.delete('answer-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:AnswerNode {id: $id})'),
          { id: 'answer-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:AnswerNode {id: $id})'),
          expect.objectContaining({ id: 'answer-123' }),
        );
        expect(result).toEqual({ success: true });
      });
    });

    describe('voteInclusion (inherited)', () => {
      it('should vote positively on answer inclusion using inherited method', async () => {
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

      it('should vote negatively on answer inclusion using inherited method', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteInclusion(
          'answer-123',
          'user-456',
          false,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'AnswerNode',
          { id: 'answer-123' },
          'user-456',
          false,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('voteContent (inherited)', () => {
      it('should vote positively on answer content using inherited method', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteContent('answer-123', 'user-456', true);

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'AnswerNode',
          { id: 'answer-123' },
          'user-456',
          true,
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should vote negatively on answer content using inherited method', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteContent(
          'answer-123',
          'user-456',
          false,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'AnswerNode',
          { id: 'answer-123' },
          'user-456',
          false,
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should support both voting types (inclusion and content)', async () => {
        // Test that AnswerNode supports both voting types
        expect(schema['supportsContentVoting']()).toBe(true);

        // Both voting methods should work
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        await schema.voteInclusion('answer-123', 'user-456', true);
        await schema.voteContent('answer-123', 'user-456', true);

        expect(voteSchema.vote).toHaveBeenCalledTimes(2);
      });
    });

    describe('getVoteStatus (inherited)', () => {
      it('should get vote status using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('answer-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'AnswerNode',
          { id: 'answer-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
        expect(result?.inclusionStatus).toBe('agree');
        expect(result?.contentStatus).toBe('agree'); // Content voting is supported
      });
    });

    describe('removeVote (inherited)', () => {
      it('should remove inclusion vote using inherited method', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeVote(
          'answer-123',
          'user-456',
          'INCLUSION',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'AnswerNode',
          { id: 'answer-123' },
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should remove content vote using inherited method', async () => {
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

    describe('getVotes (inherited)', () => {
      it('should get vote counts using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('answer-123');

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

  // ANSWER-SPECIFIC METHODS TESTS
  describe('Answer-Specific Methods', () => {
    describe('createAnswer', () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      beforeEach(() => {
        neo4jService.write.mockResolvedValue(mockResult);
      });

      it('should create an answer successfully', async () => {
        const result = await schema.createAnswer(mockAnswerData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (a:AnswerNode'),
          expect.objectContaining({
            id: mockAnswerData.id,
            answerText: mockAnswerData.answerText,
            createdBy: mockAnswerData.createdBy,
            publicCredit: mockAnswerData.publicCredit,
            parentQuestionId: mockAnswerData.parentQuestionId,
            categoryIds: mockAnswerData.categoryIds,
          }),
        );
        expect(result).toEqual(mockAnswerData);
      });

      it('should validate answer text is not empty', async () => {
        const invalidData = { ...mockAnswerData, answerText: '' };

        await expect(schema.createAnswer(invalidData)).rejects.toThrow(
          'Answer text cannot be empty',
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should validate maximum 3 categories', async () => {
        const invalidData = {
          ...mockAnswerData,
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        };

        await expect(schema.createAnswer(invalidData)).rejects.toThrow(
          'Answer can have maximum 3 categories',
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should handle creation with categories and keywords', async () => {
        const fullWorkflowData = {
          ...mockAnswerData,
          categoryIds: ['category-1', 'category-2'],
          keywords: [
            { word: 'test', frequency: 5, source: 'ai' as const },
            { word: 'answer', frequency: 3, source: 'ai' as const },
          ] as KeywordWithFrequency[],
          initialComment: 'This is my initial comment',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: fullWorkflowData }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.createAnswer(fullWorkflowData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (a:AnswerNode'),
          expect.objectContaining({
            id: fullWorkflowData.id,
            answerText: fullWorkflowData.answerText,
            createdBy: fullWorkflowData.createdBy,
            parentQuestionId: fullWorkflowData.parentQuestionId,
            categoryIds: fullWorkflowData.categoryIds,
          }),
        );
        expect(result).toEqual(fullWorkflowData);
      });

      it('should handle creation errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(new Error('Creation failed'));

        await expect(schema.createAnswer(mockAnswerData)).rejects.toThrow(
          'Failed to create answer: Creation failed',
        );
      });

      it('should handle parent question validation error', async () => {
        neo4jService.write.mockRejectedValue(
          new Error('parent question may not exist'),
        );

        await expect(schema.createAnswer(mockAnswerData)).rejects.toThrow(
          'Parent OpenQuestion must exist and have passed inclusion threshold before answers can be created',
        );
      });
    });

    describe('getAnswer', () => {
      it('should retrieve answer with all related data', async () => {
        const mockAnswerRecord = {
          get: jest.fn((field) => {
            switch (field) {
              case 'a':
                return { properties: mockAnswerData };
              case 'parentQuestionId':
                return 'question-789';
              case 'parentQuestionText':
                return 'What is the best approach?';
              case 'categories':
                return [{ id: 'cat-1', name: 'Test Category' }];
              case 'keywords':
                return [{ word: 'test', frequency: 5, source: 'ai' }];
              case 'relatedAnswers':
                return [];
              case 'discussionId':
                return 'discussion-123';
              default:
                return null;
            }
          }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockAnswerRecord],
        } as unknown as Result);

        const result = await schema.getAnswer('answer-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (a:AnswerNode {id: $id})'),
          { id: 'answer-123' },
        );
        expect(result).toBeDefined();
        expect(result.parentQuestionId).toBe('question-789');
        expect(result.categories).toHaveLength(1);
        expect(result.keywords).toHaveLength(1);
      });

      it('should throw NotFoundException when answer not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(schema.getAnswer('nonexistent')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should validate answer ID', async () => {
        await expect(schema.getAnswer('')).rejects.toThrow(
          'Answer ID cannot be empty',
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('updateAnswer', () => {
      it('should use inherited update for simple updates', async () => {
        const updateData = { answerText: 'Updated answer text' };
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockAnswerData, ...updateData },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.updateAnswer('answer-123', updateData);

        expect(result.answerText).toBe('Updated answer text');
      });

      it('should handle complex updates with categories and keywords', async () => {
        const updateData = {
          answerText: 'Updated text',
          categoryIds: ['new-category'],
          keywords: [{ word: 'updated', frequency: 4, source: 'ai' as const }],
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
            categoryIds: ['new-category'],
            keywords: updateData.keywords,
          }),
        );
        expect(result).toBeDefined();
      });

      it('should validate maximum 3 categories in updates', async () => {
        const updateData = {
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        };

        await expect(
          schema.updateAnswer('answer-123', updateData),
        ).rejects.toThrow('Answer can have maximum 3 categories');
      });

      it('should handle update errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(new Error('Update failed'));

        await expect(
          schema.updateAnswer('answer-123', { answerText: 'test' }),
        ).rejects.toThrow('Failed to update Answer: Update failed');
      });

      it('should prevent double error wrapping', async () => {
        neo4jService.write.mockRejectedValue(
          new Error('Failed to update Answer: Already wrapped error'),
        );

        await expect(
          schema.updateAnswer('answer-123', { answerText: 'test' }),
        ).rejects.toThrow('Failed to update Answer: Already wrapped error');
        // Should not be double-wrapped
      });
    });

    describe('deleteAnswer', () => {
      it('should delete answer and related nodes', async () => {
        const checkRecord = {
          get: jest.fn().mockReturnValue(mockAnswerData),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [checkRecord],
        } as unknown as Result);
        neo4jService.write.mockResolvedValue({} as unknown as Result);

        const result = await schema.deleteAnswer('answer-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (a:AnswerNode {id: $id})'),
          { id: 'answer-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE a, d, c'),
          { id: 'answer-123' },
        );
        expect(result.success).toBe(true);
      });

      it('should throw NotFoundException when answer not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(schema.deleteAnswer('nonexistent')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should validate answer ID', async () => {
        await expect(schema.deleteAnswer('')).rejects.toThrow(
          'Answer ID cannot be empty',
        );
      });

      it('should handle delete errors gracefully', async () => {
        const checkRecord = {
          get: jest.fn().mockReturnValue(mockAnswerData),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [checkRecord],
        } as unknown as Result);
        neo4jService.write.mockRejectedValue(new Error('Delete failed'));

        await expect(schema.deleteAnswer('answer-123')).rejects.toThrow(
          'Failed to delete answer: Delete failed',
        );
      });
    });

    describe('getAnswersForQuestion', () => {
      it('should get answers for a specific question with sorting', async () => {
        const mockAnswers = [
          {
            properties: {
              id: 'answer-1',
              contentNetVotes: Integer.fromNumber(10),
            },
          },
          {
            properties: {
              id: 'answer-2',
              contentNetVotes: Integer.fromNumber(5),
            },
          },
        ];
        const mockRecords = mockAnswers.map((answer) => ({
          get: jest.fn().mockReturnValue(answer),
        }));
        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getAnswersForQuestion('question-123', {
          sortBy: 'content_votes',
          sortDirection: 'desc',
          limit: 10,
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY a.contentNetVotes DESC'),
          expect.objectContaining({ questionId: 'question-123', limit: 10 }),
        );
        expect(result).toHaveLength(2);
        expect(result[0].contentNetVotes).toBe(10);
      });

      it('should filter only approved answers when requested', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getAnswersForQuestion('question-123', {
          onlyApproved: true,
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('AND a.inclusionNetVotes > 0'),
          expect.any(Object),
        );
      });
    });

    describe('getAnswerCategories', () => {
      it('should get categories for an answer', async () => {
        const mockCategories = [
          {
            id: 'cat-1',
            name: 'Technology',
            inclusionNetVotes: Integer.fromNumber(5),
          },
          {
            id: 'cat-2',
            name: 'Science',
            inclusionNetVotes: Integer.fromNumber(8),
          },
        ];
        const mockRecord = {
          get: jest.fn().mockReturnValue(mockCategories),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getAnswerCategories('answer-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (a:AnswerNode {id: $answerId})'),
          { answerId: 'answer-123' },
        );
        expect(result).toHaveLength(2);
        expect(result[0].inclusionNetVotes).toBe(5);
        expect(result[1].inclusionNetVotes).toBe(8);
      });

      it('should return empty array when no categories found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getAnswerCategories('answer-123');
        expect(result).toEqual([]);
      });
    });

    describe('setVisibilityStatus', () => {
      it('should set visibility status', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockAnswerData, visibilityStatus: false },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.setVisibilityStatus('answer-123', false);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('SET a.visibilityStatus = $isVisible'),
          { id: 'answer-123', isVisible: false },
        );
        expect(result.visibilityStatus).toBe(false);
      });

      it('should throw NotFoundException when answer not found', async () => {
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(
          schema.setVisibilityStatus('nonexistent', true),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('getVisibilityStatus', () => {
      it('should get visibility status', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(true),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getVisibilityStatus('answer-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('RETURN a.visibilityStatus'),
          { id: 'answer-123' },
        );
        expect(result).toBe(true);
      });

      it('should return true as default when visibility not set', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(null),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getVisibilityStatus('answer-123');
        expect(result).toBe(true);
      });
    });
  });

  // INTEGRATION LIFECYCLE TESTS
  describe('Integration Lifecycle Tests', () => {
    it('should handle complete answer lifecycle with inherited and enhanced methods', async () => {
      // 1. Create answer (enhanced method)
      const createRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [createRecord],
      } as unknown as Result);

      await schema.createAnswer(mockAnswerData);

      // 2. Find by ID (inherited method)
      const findRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [findRecord],
      } as unknown as Result);

      const foundAnswer = await schema.findById('answer-123');
      expect(foundAnswer?.id).toBe('answer-123');

      // 3. Vote inclusion (inherited method)
      voteSchema.vote.mockResolvedValueOnce(mockVoteResult);
      await schema.voteInclusion('answer-123', 'user-456', true);

      // 4. Vote content (inherited method)
      voteSchema.vote.mockResolvedValueOnce(mockVoteResult);
      await schema.voteContent('answer-123', 'user-456', true);

      // 5. Get enhanced answer data (enhanced method)
      const getAnswerRecord = {
        get: jest.fn((field) => {
          switch (field) {
            case 'a':
              return { properties: mockAnswerData };
            case 'parentQuestionId':
              return 'question-789';
            case 'categories':
              return [];
            case 'keywords':
              return [];
            case 'relatedAnswers':
              return [];
            case 'discussionId':
              return null;
            default:
              return null;
          }
        }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [getAnswerRecord],
      } as unknown as Result);

      const enhancedAnswer = await schema.getAnswer('answer-123');
      expect(enhancedAnswer).toBeDefined();

      // 6. Update (enhanced method for complex updates)
      const updateData = {
        answerText: 'Updated text',
        categoryIds: ['new-category'],
      };
      const updateRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockAnswerData, ...updateData },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [updateRecord],
      } as unknown as Result);

      await schema.updateAnswer('answer-123', updateData);

      // 7. Set visibility (enhanced method)
      const visibilityRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockAnswerData, visibilityStatus: false },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [visibilityRecord],
      } as unknown as Result);

      await schema.setVisibilityStatus('answer-123', false);

      // 8. Delete (enhanced method)
      const checkRecord = {
        get: jest.fn().mockReturnValue(mockAnswerData),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [checkRecord],
      } as unknown as Result);
      neo4jService.write.mockResolvedValueOnce({} as unknown as Result);

      const deleteResult = await schema.deleteAnswer('answer-123');

      expect(deleteResult.success).toBe(true);
      expect(neo4jService.write).toHaveBeenCalledTimes(4); // create, update, visibility, delete
      expect(voteSchema.vote).toHaveBeenCalledTimes(2); // inclusion, content
    });

    it('should demonstrate both voting pattern functionality', async () => {
      // Test that AnswerNode supports both inclusion and content voting
      expect(schema['supportsContentVoting']()).toBe(true);

      // Test inclusion voting
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const inclusionResult = await schema.voteInclusion(
        'answer-123',
        'user-456',
        true,
      );
      expect(inclusionResult).toEqual(mockVoteResult);

      // Test content voting
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const contentResult = await schema.voteContent(
        'answer-123',
        'user-456',
        true,
      );
      expect(contentResult).toEqual(mockVoteResult);

      // Test vote status includes both types
      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);
      const voteStatus = await schema.getVoteStatus('answer-123', 'user-456');
      expect(voteStatus?.inclusionStatus).toBe('agree');
      expect(voteStatus?.contentStatus).toBe('agree'); // Content voting is supported

      // Test remove vote for both types
      voteSchema.removeVote.mockResolvedValue(mockVoteResult);
      const removeInclusionResult = await schema.removeVote(
        'answer-123',
        'user-456',
        'INCLUSION',
      );
      expect(removeInclusionResult).toEqual(mockVoteResult);

      voteSchema.removeVote.mockResolvedValue(mockVoteResult);
      const removeContentResult = await schema.removeVote(
        'answer-123',
        'user-456',
        'CONTENT',
      );
      expect(removeContentResult).toEqual(mockVoteResult);

      expect(voteSchema.vote).toHaveBeenCalledTimes(2);
      expect(voteSchema.removeVote).toHaveBeenCalledTimes(2);
    });
  });

  // ERROR HANDLING CONSISTENCY TESTS
  describe('Error Handling Consistency', () => {
    it('should use standardized error messages from BaseNodeSchema', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.findById('test')).rejects.toThrow(
        'Failed to find Answer: Database connection failed',
      );
    });

    it('should use standardized error format for answer-specific methods', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query timeout'));

      await expect(schema.getAnswer('test')).rejects.toThrow(
        'Failed to retrieve answer Answer: Query timeout',
      );
    });

    it('should handle validation errors appropriately', async () => {
      // Test input validation
      await expect(
        schema.createAnswer({
          ...mockAnswerData,
          answerText: '',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(schema.updateAnswer('', {})).rejects.toThrow(
        BadRequestException,
      );

      await expect(schema.getAnswer('')).rejects.toThrow(BadRequestException);
    });

    it('should prevent double error wrapping in complex updates', async () => {
      const alreadyWrappedError = new Error(
        'Failed to update Answer: Original error',
      );
      neo4jService.write.mockRejectedValue(alreadyWrappedError);

      await expect(
        schema.updateAnswer('answer-123', { answerText: 'test' }),
      ).rejects.toThrow('Failed to update Answer: Original error');
      // Should not be double-wrapped as "Failed to update answer: Failed to update Answer: Original error"
    });
  });

  // LEGACY METHOD REMOVAL TESTS
  describe('Legacy Method Removal', () => {
    it('should not have legacy voting methods (now inherited)', () => {
      expect((schema as any).voteAnswerInclusion).toBeUndefined();
      expect((schema as any).voteAnswerContent).toBeUndefined();
      expect((schema as any).getAnswerVoteStatus).toBeUndefined();
      expect((schema as any).removeAnswerVote).toBeUndefined();
      expect((schema as any).getAnswerVotes).toBeUndefined();
    });

    it('should use inherited voting methods instead', async () => {
      // Verify inherited methods exist and work
      expect(schema.voteInclusion).toBeDefined();
      expect(schema.voteContent).toBeDefined();
      expect(schema.getVoteStatus).toBeDefined();
      expect(schema.removeVote).toBeDefined();
      expect(schema.getVotes).toBeDefined();

      // Test that they work as expected
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const result = await schema.voteInclusion('answer-123', 'user-456', true);
      expect(result).toEqual(mockVoteResult);
    });
  });

  // FIELD MAPPING TESTS
  describe('Field Mapping and Data Conversion', () => {
    it('should handle Neo4j Integer conversion in mapNodeFromRecord', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: {
            ...mockAnswerData,
            inclusionPositiveVotes: Integer.fromNumber(10),
            contentNetVotes: Integer.fromNumber(5),
          },
        }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.findById('answer-123');

      expect(result?.inclusionPositiveVotes).toBe(10);
      expect(result?.contentNetVotes).toBe(5);
      expect(typeof result?.inclusionPositiveVotes).toBe('number');
    });

    it('should handle field adapter for getAnswer compatibility', async () => {
      // Mock a record that uses 'a' field instead of 'n' field
      const mockRecord = {
        get: jest.fn((field) => {
          switch (field) {
            case 'a':
              return { properties: mockAnswerData };
            case 'parentQuestionId':
              return 'question-789';
            case 'categories':
              return [];
            case 'keywords':
              return [];
            case 'relatedAnswers':
              return [];
            case 'discussionId':
              return null;
            default:
              return null;
          }
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getAnswer('answer-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('answer-123');
      // Field adapter should have handled the 'a' to 'n' mapping
    });

    it('should handle both inherited and enhanced query patterns', async () => {
      // Test inherited findById (uses 'n' field)
      const inheritedRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [inheritedRecord],
      } as unknown as Result);

      const inheritedResult = await schema.findById('answer-123');
      expect(inheritedResult?.id).toBe('answer-123');

      // Test enhanced getAnswer (uses 'a' field)
      const enhancedRecord = {
        get: jest.fn((field) => {
          if (field === 'a') return { properties: mockAnswerData };
          return null;
        }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [enhancedRecord],
      } as unknown as Result);

      const enhancedResult = await schema.getAnswer('answer-123');
      expect(enhancedResult?.id).toBe('answer-123');
    });
  });

  // BUSINESS LOGIC VALIDATION TESTS
  describe('Business Logic Validation', () => {
    it('should enforce parent question inclusion threshold in createAnswer', async () => {
      neo4jService.write.mockRejectedValue(
        new Error(
          'parent question may not exist or have not passed inclusion threshold',
        ),
      );

      await expect(schema.createAnswer(mockAnswerData)).rejects.toThrow(
        'Parent OpenQuestion must exist and have passed inclusion threshold before answers can be created',
      );
    });

    it('should validate category existence and inclusion threshold in updates', async () => {
      neo4jService.write.mockRejectedValue(new Error('not found'));

      await expect(
        schema.updateAnswer('answer-123', {
          categoryIds: ['nonexistent-category'],
        }),
      ).rejects.toThrow(
        "Some categories or keywords don't exist or haven't passed inclusion threshold",
      );
    });

    it('should handle complex relationship management in updates', async () => {
      const updateData = {
        categoryIds: ['new-cat-1', 'new-cat-2'],
        keywords: [
          { word: 'new-keyword', frequency: 3, source: 'ai' as const },
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

      // Should use complex update query path
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('DELETE catRel'), // Category relationship removal
        expect.objectContaining({
          id: 'answer-123',
          categoryIds: updateData.categoryIds,
          keywords: updateData.keywords,
        }),
      );
      expect(result).toBeDefined();
    });

    it('should create discussion and initial comment during answer creation', async () => {
      const answerWithComment = {
        ...mockAnswerData,
        initialComment: 'This is my initial comment',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: answerWithComment }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.createAnswer(answerWithComment);

      // Check that the query contains discussion creation
      const [calledQuery, calledParams] = neo4jService.write.mock.calls[0];
      expect(calledQuery).toContain('CREATE (d:DiscussionNode');
      expect(calledQuery).toContain('CREATE (c:CommentNode');

      // Check that the parameters include the initial comment
      expect(calledParams).toEqual(
        expect.objectContaining({
          id: answerWithComment.id,
          answerText: answerWithComment.answerText,
          createdBy: answerWithComment.createdBy,
          parentQuestionId: answerWithComment.parentQuestionId,
          initialComment: 'This is my initial comment',
        }),
      );
    });
  });
});
