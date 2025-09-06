// src/neo4j/schemas/__tests__/answer.schema.spec.ts

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

    it('should create an answer without categories', async () => {
      const answerDataNoCategories = {
        ...mockAnswerData,
        categoryIds: undefined,
      };

      const result = await schema.createAnswer(answerDataNoCategories);

      expect(neo4jService.write).toHaveBeenCalled();
      expect(result).toEqual(mockAnswerData);
    });

    it('should throw BadRequestException when answerText is empty', async () => {
      const invalidData = { ...mockAnswerData, answerText: '' };

      await expect(schema.createAnswer(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when answerText is only whitespace', async () => {
      const invalidData = { ...mockAnswerData, answerText: '   ' };

      await expect(schema.createAnswer(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when more than 3 categories provided', async () => {
      const invalidData = {
        ...mockAnswerData,
        categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
      };

      await expect(schema.createAnswer(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle Neo4j errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.createAnswer(mockAnswerData)).rejects.toThrow(
        'Failed to create answer: Database connection failed',
      );
    });
  });

  describe('getAnswer', () => {
    it('should get an answer successfully', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          ...mockAnswerData,
          inclusionPositiveVotes: Integer.fromNumber(10),
          inclusionNegativeVotes: Integer.fromNumber(2),
          inclusionNetVotes: Integer.fromNumber(8),
          contentPositiveVotes: Integer.fromNumber(15),
          contentNegativeVotes: Integer.fromNumber(3),
          contentNetVotes: Integer.fromNumber(12),
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getAnswer('answer-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (a:AnswerNode {id: $id})'),
        { id: 'answer-123' },
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: mockAnswerData.id,
          answerText: mockAnswerData.answerText,
          inclusionPositiveVotes: 10,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 8,
          contentPositiveVotes: 15,
          contentNegativeVotes: 3,
          contentNetVotes: 12,
        }),
      );
    });

    it('should throw NotFoundException when answer does not exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      await expect(schema.getAnswer('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(schema.getAnswer('')).rejects.toThrow(BadRequestException);
      expect(neo4jService.read).not.toHaveBeenCalled();
    });

    it('should handle Neo4j errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Database error'));

      await expect(schema.getAnswer('answer-123')).rejects.toThrow(
        'Failed to get answer: Database error',
      );
    });
  });

  describe('updateAnswer', () => {
    const updateData = {
      answerText: 'Updated answer text',
      publicCredit: false,
    };

    it('should update an answer successfully', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockAnswerData, ...updateData },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.updateAnswer('answer-123', updateData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (a:AnswerNode {id: $id})'),
        expect.objectContaining({
          id: 'answer-123',
          answerText: updateData.answerText,
          publicCredit: updateData.publicCredit,
        }),
      );
      expect(result).toEqual({ ...mockAnswerData, ...updateData });
    });

    it('should throw NotFoundException when answer does not exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.updateAnswer('nonexistent-id', updateData),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(schema.updateAnswer('', updateData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when answerText is empty', async () => {
      const invalidUpdate = { answerText: '' };

      await expect(
        schema.updateAnswer('answer-123', invalidUpdate),
      ).rejects.toThrow(BadRequestException);
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle Neo4j errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Update failed'));

      await expect(
        schema.updateAnswer('answer-123', updateData),
      ).rejects.toThrow('Failed to update answer: Update failed');
    });
  });

  describe('deleteAnswer', () => {
    it('should delete an answer successfully', async () => {
      // Mock existence check
      const checkResult = {
        records: [{ get: jest.fn().mockReturnValue(mockAnswerData) }],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(checkResult);
      neo4jService.write.mockResolvedValue({} as Result);

      const result = await schema.deleteAnswer('answer-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (a:AnswerNode {id: $id}) RETURN a'),
        { id: 'answer-123' },
      );
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('DETACH DELETE a, d, c'),
        { id: 'answer-123' },
      );
      expect(result).toEqual({
        success: true,
        message: 'Answer with ID answer-123 successfully deleted',
      });
    });

    it('should throw NotFoundException when answer does not exist', async () => {
      const checkResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(checkResult);

      await expect(schema.deleteAnswer('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(schema.deleteAnswer('')).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.read).not.toHaveBeenCalled();
    });

    it('should handle Neo4j errors gracefully', async () => {
      const checkResult = {
        records: [{ get: jest.fn().mockReturnValue(mockAnswerData) }],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(checkResult);
      neo4jService.write.mockRejectedValue(new Error('Delete failed'));

      await expect(schema.deleteAnswer('answer-123')).rejects.toThrow(
        'Failed to delete answer: Delete failed',
      );
    });
  });

  describe('voteAnswerInclusion', () => {
    it('should vote positively on answer inclusion', async () => {
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await schema.voteAnswerInclusion(
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

    it('should vote negatively on answer inclusion', async () => {
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await schema.voteAnswerInclusion(
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

    it('should handle voting errors gracefully', async () => {
      voteSchema.vote.mockRejectedValue(new Error('Vote failed'));

      await expect(
        schema.voteAnswerInclusion('answer-123', 'user-456', true),
      ).rejects.toThrow('Failed to vote on answer: Vote failed');
    });
  });

  describe('voteAnswerContent', () => {
    it('should vote positively on answer content', async () => {
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await schema.voteAnswerContent(
        'answer-123',
        'user-456',
        true,
      );

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'AnswerNode',
        { id: 'answer-123' },
        'user-456',
        true,
        'CONTENT',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should vote negatively on answer content', async () => {
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await schema.voteAnswerContent(
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

    it('should handle voting errors gracefully', async () => {
      voteSchema.vote.mockRejectedValue(new Error('Content vote failed'));

      await expect(
        schema.voteAnswerContent('answer-123', 'user-456', true),
      ).rejects.toThrow(
        'Failed to vote on answer content: Content vote failed',
      );
    });
  });

  describe('getAnswerVoteStatus', () => {
    it('should get vote status for an answer', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await schema.getAnswerVoteStatus('answer-123', 'user-456');

      expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
        'AnswerNode',
        { id: 'answer-123' },
        'user-456',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should return null when no vote status exists', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(null);

      const result = await schema.getAnswerVoteStatus('answer-123', 'user-456');

      expect(result).toBeNull();
    });

    it('should handle vote status errors gracefully', async () => {
      voteSchema.getVoteStatus.mockRejectedValue(
        new Error('Vote status failed'),
      );

      await expect(
        schema.getAnswerVoteStatus('answer-123', 'user-456'),
      ).rejects.toThrow('Failed to get answer vote status: Vote status failed');
    });
  });

  describe('removeAnswerVote', () => {
    it('should remove inclusion vote', async () => {
      voteSchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await schema.removeAnswerVote(
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

    it('should remove content vote', async () => {
      voteSchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await schema.removeAnswerVote(
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

    it('should handle remove vote errors gracefully', async () => {
      voteSchema.removeVote.mockRejectedValue(new Error('Remove vote failed'));

      await expect(
        schema.removeAnswerVote('answer-123', 'user-456', 'INCLUSION'),
      ).rejects.toThrow('Failed to remove answer vote: Remove vote failed');
    });
  });

  describe('getAnswerVotes', () => {
    it('should get votes for an answer', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await schema.getAnswerVotes('answer-123');

      expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
        'AnswerNode',
        { id: 'answer-123' },
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

      const result = await schema.getAnswerVotes('answer-123');

      expect(result).toBeNull();
    });

    it('should handle get votes errors gracefully', async () => {
      voteSchema.getVoteStatus.mockRejectedValue(new Error('Get votes failed'));

      await expect(schema.getAnswerVotes('answer-123')).rejects.toThrow(
        'Failed to get answer votes: Get votes failed',
      );
    });
  });

  describe('setVisibilityStatus', () => {
    it('should set visibility status to true', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockAnswerData, visibilityStatus: true },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.setVisibilityStatus('answer-123', true);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('SET a.visibilityStatus = $isVisible'),
        { id: 'answer-123', isVisible: true },
      );
      expect(result).toEqual({ ...mockAnswerData, visibilityStatus: true });
    });

    it('should set visibility status to false', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockAnswerData, visibilityStatus: false },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.setVisibilityStatus('answer-123', false);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('SET a.visibilityStatus = $isVisible'),
        { id: 'answer-123', isVisible: false },
      );
      expect(result).toEqual({ ...mockAnswerData, visibilityStatus: false });
    });

    it('should throw NotFoundException when answer does not exist', async () => {
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
        schema.setVisibilityStatus('answer-123', true),
      ).rejects.toThrow(
        'Failed to set answer visibility: Visibility update failed',
      );
    });
  });

  describe('getVisibilityStatus', () => {
    it('should get visibility status for an answer', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(true),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getVisibilityStatus('answer-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (a:AnswerNode {id: $id})'),
        { id: 'answer-123' },
      );
      expect(result).toBe(true);
    });

    it('should throw NotFoundException when answer does not exist', async () => {
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

      await expect(schema.getVisibilityStatus('answer-123')).rejects.toThrow(
        'Failed to get answer visibility: Get visibility failed',
      );
    });
  });

  describe('getAnswersForQuestion', () => {
    const mockAnswers = [
      {
        id: 'answer-1',
        answerText: 'First answer',
        inclusionPositiveVotes: Integer.fromNumber(5),
        inclusionNegativeVotes: Integer.fromNumber(1),
        inclusionNetVotes: Integer.fromNumber(4),
        contentPositiveVotes: Integer.fromNumber(8),
        contentNegativeVotes: Integer.fromNumber(2),
        contentNetVotes: Integer.fromNumber(6),
      },
      {
        id: 'answer-2',
        answerText: 'Second answer',
        inclusionPositiveVotes: Integer.fromNumber(3),
        inclusionNegativeVotes: Integer.fromNumber(0),
        inclusionNetVotes: Integer.fromNumber(3),
        contentPositiveVotes: Integer.fromNumber(5),
        contentNegativeVotes: Integer.fromNumber(1),
        contentNetVotes: Integer.fromNumber(4),
      },
    ];

    it('should get answers for a question with default parameters', async () => {
      const mockRecords = mockAnswers.map((answer) => ({
        get: jest.fn().mockReturnValue(answer),
      })) as unknown as Record[];
      const mockResult = {
        records: mockRecords,
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getAnswersForQuestion('question-789');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'MATCH (a:AnswerNode)-[:ANSWERS]->(oq:OpenQuestionNode {id: $questionId})',
        ),
        { questionId: 'question-789', offset: 0, limit: 20 },
      );

      // Verify Neo4j Integer conversion
      expect(result).toEqual([
        expect.objectContaining({
          id: 'answer-1',
          inclusionPositiveVotes: 5,
          inclusionNegativeVotes: 1,
          inclusionNetVotes: 4,
          contentPositiveVotes: 8,
          contentNegativeVotes: 2,
          contentNetVotes: 6,
        }),
        expect.objectContaining({
          id: 'answer-2',
          inclusionPositiveVotes: 3,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 3,
          contentPositiveVotes: 5,
          contentNegativeVotes: 1,
          contentNetVotes: 4,
        }),
      ]);
    });

    it('should get answers with custom pagination and sorting', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      await schema.getAnswersForQuestion('question-789', {
        offset: 10,
        limit: 5,
        sortBy: 'inclusion_votes',
        sortDirection: 'desc',
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY a.inclusionNetVotes DESC'),
        { questionId: 'question-789', offset: 10, limit: 5 },
      );
    });

    it('should handle get answers errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query failed'));

      await expect(
        schema.getAnswersForQuestion('question-789'),
      ).rejects.toThrow('Failed to get answers: Query failed');
    });
  });

  describe('getRelatedContentBySharedCategories', () => {
    it('should get related content with default parameters', async () => {
      const mockRelatedContent = [
        { id: 'statement-1', type: 'statement' },
        { id: 'answer-2', type: 'answer' },
      ];

      const mockRecords = mockRelatedContent.map((content) => ({
        get: jest.fn().mockReturnValue(content),
      })) as unknown as Record[];
      const mockResult = {
        records: mockRecords,
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result =
        await schema.getRelatedContentBySharedCategories('answer-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (a:AnswerNode {id: $answerId})'),
        expect.objectContaining({
          answerId: 'answer-123',
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

      await schema.getRelatedContentBySharedCategories('answer-123', {
        nodeTypes: ['statement', 'openquestion'],
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
          answerId: 'answer-123',
          nodeTypes: ['statement', 'openquestion'],
          offset: 5,
          limit: 5,
          minCategoryOverlap: 2,
        }),
      );
    });

    it('should handle related content errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Related content query failed'),
      );

      await expect(
        schema.getRelatedContentBySharedCategories('answer-123'),
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
        inclusionPositiveVotes: Integer.fromNumber(10),
        inclusionNegativeVotes: Integer.fromNumber(1),
        inclusionNetVotes: Integer.fromNumber(9),
      },
      {
        id: 'category-2',
        name: 'Science',
        inclusionPositiveVotes: Integer.fromNumber(15),
        inclusionNegativeVotes: Integer.fromNumber(2),
        inclusionNetVotes: Integer.fromNumber(13),
      },
    ];

    it('should get categories for an answer', async () => {
      const mockRecords = mockCategories.map((category) => ({
        get: jest.fn().mockReturnValue(category),
      })) as unknown as Record[];
      const mockResult = {
        records: mockRecords,
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getNodeCategories('answer-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'MATCH (a:AnswerNode {id: $nodeId})-[:CATEGORIZED_AS]->(cat:CategoryNode)',
        ),
        { nodeId: 'answer-123' },
      );

      // Verify Neo4j Integer conversion
      expect(result).toEqual([
        expect.objectContaining({
          id: 'category-1',
          name: 'Technology',
          inclusionPositiveVotes: 10,
          inclusionNegativeVotes: 1,
          inclusionNetVotes: 9,
        }),
        expect.objectContaining({
          id: 'category-2',
          name: 'Science',
          inclusionPositiveVotes: 15,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 13,
        }),
      ]);
    });

    it('should return empty array when answer has no categories', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getNodeCategories('answer-123');

      expect(result).toEqual([]);
    });

    it('should handle get categories errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Categories query failed'));

      await expect(schema.getNodeCategories('answer-123')).rejects.toThrow(
        'Failed to get answer categories: Categories query failed',
      );
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    describe('Neo4j Integer Conversion', () => {
      it('should properly convert Neo4j integers in vote counts', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            id: 'answer-123',
            answerText: 'Test answer',
            inclusionPositiveVotes: Integer.fromNumber(999999),
            inclusionNegativeVotes: Integer.fromNumber(0),
            inclusionNetVotes: Integer.fromNumber(999999),
            contentPositiveVotes: Integer.fromNumber(888888),
            contentNegativeVotes: Integer.fromNumber(111111),
            contentNetVotes: Integer.fromNumber(777777),
          }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getAnswer('answer-123');

        expect(result).toEqual(
          expect.objectContaining({
            inclusionPositiveVotes: 999999,
            inclusionNegativeVotes: 0,
            inclusionNetVotes: 999999,
            contentPositiveVotes: 888888,
            contentNegativeVotes: 111111,
            contentNetVotes: 777777,
          }),
        );
      });
    });

    describe('Input Validation Edge Cases', () => {
      it('should handle null and undefined inputs gracefully', async () => {
        await expect(schema.getAnswer(null as any)).rejects.toThrow(
          BadRequestException,
        );
        await expect(schema.getAnswer(undefined as any)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should handle whitespace-only category validation', async () => {
        const invalidData = {
          ...mockAnswerData,
          categoryIds: ['', '   ', '\t\n'],
        };

        // This should pass validation since empty strings in categoryIds are handled by the schema
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: invalidData }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        // The actual validation should happen in the Neo4j query, not in the schema method
        await expect(schema.createAnswer(invalidData)).resolves.toBeDefined();
      });

      it('should handle maximum length answerText', async () => {
        const maxLengthText = 'a'.repeat(5000); // Assuming some reasonable max length
        const dataWithMaxText = {
          ...mockAnswerData,
          answerText: maxLengthText,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: dataWithMaxText }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.createAnswer(dataWithMaxText);

        expect(result.answerText).toBe(maxLengthText);
      });
    });

    describe('Error Propagation', () => {
      it('should preserve BadRequestException from underlying operations', async () => {
        neo4jService.write.mockRejectedValue(
          new BadRequestException('Invalid data'),
        );

        await expect(schema.createAnswer(mockAnswerData)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should preserve NotFoundException from underlying operations', async () => {
        neo4jService.read.mockRejectedValue(
          new NotFoundException('Answer not found'),
        );

        await expect(schema.getAnswer('answer-123')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should wrap generic errors with descriptive messages', async () => {
        neo4jService.write.mockRejectedValue(new Error('Network timeout'));

        await expect(schema.createAnswer(mockAnswerData)).rejects.toThrow(
          'Failed to create answer: Network timeout',
        );
      });
    });

    describe('Concurrent Operations', () => {
      it('should handle concurrent vote operations', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        // Simulate concurrent voting
        const promises = [
          schema.voteAnswerInclusion('answer-123', 'user-1', true),
          schema.voteAnswerContent('answer-123', 'user-2', false),
          schema.voteAnswerInclusion('answer-123', 'user-3', true),
        ];

        const results = await Promise.all(promises);

        expect(results).toHaveLength(3);
        expect(voteSchema.vote).toHaveBeenCalledTimes(3);
        results.forEach((result) => {
          expect(result).toEqual(mockVoteResult);
        });
      });
    });

    describe('Data Consistency', () => {
      it('should maintain vote count consistency in getAnswerVotes', async () => {
        const consistentVoteStatus = {
          ...mockVoteStatus,
          inclusionPositiveVotes: 10,
          inclusionNegativeVotes: 3,
          inclusionNetVotes: 7, // 10 - 3 = 7
          contentPositiveVotes: 20,
          contentNegativeVotes: 5,
          contentNetVotes: 15, // 20 - 5 = 15
        };

        voteSchema.getVoteStatus.mockResolvedValue(consistentVoteStatus);

        const result = await schema.getAnswerVotes('answer-123');

        expect(result).toEqual({
          inclusionPositiveVotes: 10,
          inclusionNegativeVotes: 3,
          inclusionNetVotes: 7,
          contentPositiveVotes: 20,
          contentNegativeVotes: 5,
          contentNetVotes: 15,
        });
      });
    });
  });

  describe('Performance and Large Data Handling', () => {
    it('should handle large result sets in getAnswersForQuestion', async () => {
      const largeAnswerSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `answer-${i}`,
        answerText: `Answer number ${i}`,
        inclusionPositiveVotes: Integer.fromNumber(i * 2),
        inclusionNegativeVotes: Integer.fromNumber(i),
        inclusionNetVotes: Integer.fromNumber(i),
        contentPositiveVotes: Integer.fromNumber(i * 3),
        contentNegativeVotes: Integer.fromNumber(i),
        contentNetVotes: Integer.fromNumber(i * 2),
      }));

      const mockRecords = largeAnswerSet.map((answer) => ({
        get: jest.fn().mockReturnValue(answer),
      })) as unknown as Record[];
      const mockResult = {
        records: mockRecords,
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getAnswersForQuestion('question-789', {
        limit: null, // No limit
      });

      expect(result).toHaveLength(1000);
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.not.stringContaining('LIMIT'),
        expect.objectContaining({ questionId: 'question-789' }),
      );
    });

    it('should handle pagination correctly with large offsets', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      await schema.getAnswersForQuestion('question-789', {
        offset: 50000,
        limit: 20,
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('SKIP $offset LIMIT $limit'),
        expect.objectContaining({
          questionId: 'question-789',
          offset: 50000,
          limit: 20,
        }),
      );
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle answer creation with full workflow', async () => {
      const fullWorkflowData = {
        ...mockAnswerData,
        keywords: [
          { word: 'artificial', frequency: 10, source: 'ai' as const },
          { word: 'intelligence', frequency: 8, source: 'ai' as const },
          { word: 'machine', frequency: 6, source: 'user' as const },
        ] as KeywordWithFrequency[],
        categoryIds: ['tech-category', 'science-category'],
        initialComment: 'This is a comprehensive answer with multiple aspects.',
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

    it('should handle complete answer lifecycle', async () => {
      // Create
      const createRecord = {
        get: jest.fn().mockReturnValue({ properties: mockAnswerData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [createRecord],
      } as unknown as Result);

      await schema.createAnswer(mockAnswerData);

      // Vote inclusion
      voteSchema.vote.mockResolvedValueOnce(mockVoteResult);
      await schema.voteAnswerInclusion('answer-123', 'user-456', true);

      // Vote content
      voteSchema.vote.mockResolvedValueOnce(mockVoteResult);
      await schema.voteAnswerContent('answer-123', 'user-456', true);

      // Update
      const updateData = { answerText: 'Updated answer text' };
      const updateRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockAnswerData, ...updateData },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [updateRecord],
      } as unknown as Result);

      await schema.updateAnswer('answer-123', updateData);

      // Set visibility
      const visibilityRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockAnswerData, visibilityStatus: false },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [visibilityRecord],
      } as unknown as Result);

      await schema.setVisibilityStatus('answer-123', false);

      // Delete
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
  });
});
