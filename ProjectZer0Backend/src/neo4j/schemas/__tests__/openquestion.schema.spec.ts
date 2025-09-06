// src/neo4j/schemas/__tests__/openquestion.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { OpenQuestionSchema } from '../openquestion.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from '../vote.schema';

describe('OpenQuestionSchema', () => {
  let schema: OpenQuestionSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  // Mock data constants
  const mockQuestionData = {
    id: 'question-123',
    questionText: 'What is artificial intelligence',
    createdBy: 'user-456',
    publicCredit: true,
    categoryIds: ['tech-category', 'science-category'],
    keywords: [
      { word: 'artificial', frequency: 8, source: 'ai' as const },
      { word: 'intelligence', frequency: 6, source: 'ai' as const },
      { word: 'technology', frequency: 4, source: 'user' as const },
    ] as KeywordWithFrequency[],
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

  describe('createOpenQuestion', () => {
    const mockRecord = {
      get: jest.fn().mockReturnValue({
        properties: {
          ...mockQuestionData,
          questionText: 'What is artificial intelligence?', // Auto-normalized
        },
      }),
    } as unknown as Record;
    const mockResult = {
      records: [mockRecord],
    } as unknown as Result;

    beforeEach(() => {
      neo4jService.write.mockResolvedValue(mockResult);
    });

    it('should create an open question successfully', async () => {
      const result = await schema.createOpenQuestion(mockQuestionData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (oq:OpenQuestionNode'),
        expect.objectContaining({
          id: mockQuestionData.id,
          questionText: 'What is artificial intelligence?', // Should auto-add ?
          createdBy: mockQuestionData.createdBy,
          publicCredit: mockQuestionData.publicCredit,
          categoryIds: mockQuestionData.categoryIds,
          keywords: mockQuestionData.keywords,
        }),
      );
      expect(result.questionText).toBe('What is artificial intelligence?');
    });

    it('should auto-normalize question text by adding question mark', async () => {
      const dataWithoutQuestionMark = {
        ...mockQuestionData,
        questionText: 'What is machine learning',
      };

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
        ...mockQuestionData,
        questionText: 'What is deep learning?',
      };

      await schema.createOpenQuestion(dataWithQuestionMark);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          questionText: 'What is deep learning?',
        }),
      );
    });

    it('should create an open question without categories', async () => {
      const questionDataNoCategories = {
        ...mockQuestionData,
        categoryIds: undefined,
      };

      const result = await schema.createOpenQuestion(questionDataNoCategories);

      expect(neo4jService.write).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should create an open question without keywords', async () => {
      const questionDataNoKeywords = {
        ...mockQuestionData,
        keywords: undefined,
      };

      await schema.createOpenQuestion(questionDataNoKeywords);

      expect(neo4jService.write).toHaveBeenCalled();
    });

    it('should throw BadRequestException when questionText is empty', async () => {
      const invalidData = { ...mockQuestionData, questionText: '' };

      await expect(schema.createOpenQuestion(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when questionText is only whitespace', async () => {
      const invalidData = { ...mockQuestionData, questionText: '   ' };

      await expect(schema.createOpenQuestion(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when more than 3 categories provided', async () => {
      const invalidData = {
        ...mockQuestionData,
        categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
      };

      await expect(schema.createOpenQuestion(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle keyword/category validation errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Category not found'));

      await expect(schema.createOpenQuestion(mockQuestionData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle Neo4j errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.createOpenQuestion(mockQuestionData)).rejects.toThrow(
        'Failed to create open question: Database connection failed',
      );
    });
  });

  describe('getOpenQuestion', () => {
    const mockQuestionRecord = {
      get: jest.fn().mockImplementation((key: string) => {
        const mockData = {
          oq: {
            properties: {
              ...mockQuestionData,
              questionText: 'What is artificial intelligence?',
              inclusionPositiveVotes: Integer.fromNumber(15),
              inclusionNegativeVotes: Integer.fromNumber(3),
              inclusionNetVotes: Integer.fromNumber(12),
            },
          },
          keywords: [
            { word: 'artificial', frequency: 8, source: 'ai' },
            { word: 'intelligence', frequency: 6, source: 'ai' },
          ],
          categories: [
            { id: 'tech-category', name: 'Technology', inclusionNetVotes: 5 },
          ],
          relatedQuestions: [],
          directlyRelatedQuestions: [],
          discussionId: 'discussion-123',
          answers: [],
        };
        return mockData[key];
      }),
    } as unknown as Record;

    const mockResult = {
      records: [mockQuestionRecord],
    } as unknown as Result;

    it('should get an open question successfully', async () => {
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getOpenQuestion('question-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (oq:OpenQuestionNode {id: $id})'),
        { id: 'question-123' },
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: mockQuestionData.id,
          questionText: 'What is artificial intelligence?',
          inclusionPositiveVotes: 15,
          inclusionNegativeVotes: 3,
          inclusionNetVotes: 12,
          keywords: expect.arrayContaining([
            expect.objectContaining({ word: 'artificial' }),
            expect.objectContaining({ word: 'intelligence' }),
          ]),
          categories: expect.arrayContaining([
            expect.objectContaining({ id: 'tech-category' }),
          ]),
        }),
      );
    });

    it('should throw NotFoundException when question does not exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

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
        'Failed to retrieve open question: Database error',
      );
    });
  });

  describe('updateOpenQuestion', () => {
    const updateData = {
      questionText: 'What is machine learning',
      publicCredit: false,
      categoryIds: ['new-category'],
    };

    it('should update an open question successfully', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: {
            ...mockQuestionData,
            ...updateData,
            questionText: 'What is machine learning?', // Should auto-normalize
          },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.updateOpenQuestion(
        'question-123',
        updateData,
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (oq:OpenQuestionNode {id: $id})'),
        expect.objectContaining({
          id: 'question-123',
          updateProperties: expect.objectContaining({
            questionText: 'What is machine learning?', // Should auto-add ?
            publicCredit: false,
          }),
          categoryIds: ['new-category'],
        }),
      );
      expect(result.questionText).toBe('What is machine learning?');
    });

    it('should handle simple updates without keywords or categories', async () => {
      const simpleUpdate = {
        questionText: 'What is natural language processing?',
        publicCredit: true,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockQuestionData, ...simpleUpdate },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await schema.updateOpenQuestion('question-123', simpleUpdate);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('SET oq += $updateProperties'),
        expect.objectContaining({
          id: 'question-123',
          updateProperties: expect.objectContaining({
            questionText: 'What is natural language processing?',
            publicCredit: true,
          }),
        }),
      );
    });

    it('should throw NotFoundException when question does not exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.updateOpenQuestion('nonexistent-id', updateData),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(schema.updateOpenQuestion('', updateData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when more than 3 categories provided', async () => {
      const invalidUpdate = {
        categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
      };

      await expect(
        schema.updateOpenQuestion('question-123', invalidUpdate),
      ).rejects.toThrow(BadRequestException);
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle keyword and category updates', async () => {
      const complexUpdate = {
        questionText: 'What is deep learning?',
        keywords: [
          { word: 'deep', frequency: 5, source: 'ai' as const },
          { word: 'learning', frequency: 7, source: 'user' as const },
        ],
        categoryIds: ['ai-category', 'learning-category'],
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockQuestionData, ...complexUpdate },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await schema.updateOpenQuestion('question-123', complexUpdate);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('UNWIND categoryIds as categoryId'),
        expect.objectContaining({
          keywords: complexUpdate.keywords,
          categoryIds: complexUpdate.categoryIds,
        }),
      );
    });

    it('should handle Neo4j errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Update failed'));

      await expect(
        schema.updateOpenQuestion('question-123', updateData),
      ).rejects.toThrow('Failed to update open question: Update failed');
    });
  });

  describe('deleteOpenQuestion', () => {
    it('should delete an open question successfully', async () => {
      // Mock existence check
      const checkResult = {
        records: [{ get: jest.fn().mockReturnValue(mockQuestionData) }],
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

      await expect(schema.deleteOpenQuestion('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(schema.deleteOpenQuestion('')).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.read).not.toHaveBeenCalled();
    });

    it('should handle Neo4j errors gracefully', async () => {
      const checkResult = {
        records: [{ get: jest.fn().mockReturnValue(mockQuestionData) }],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(checkResult);
      neo4jService.write.mockRejectedValue(new Error('Delete failed'));

      await expect(schema.deleteOpenQuestion('question-123')).rejects.toThrow(
        'Failed to delete open question: Delete failed',
      );
    });
  });

  describe('voteOpenQuestionInclusion', () => {
    it('should vote positively on question inclusion', async () => {
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await schema.voteOpenQuestionInclusion(
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

    it('should vote negatively on question inclusion', async () => {
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await schema.voteOpenQuestionInclusion(
        'question-123',
        'user-456',
        false,
      );

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'OpenQuestionNode',
        { id: 'question-123' },
        'user-456',
        false,
        'INCLUSION',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException when question ID is empty', async () => {
      await expect(
        schema.voteOpenQuestionInclusion('', 'user-456', true),
      ).rejects.toThrow(BadRequestException);
      expect(voteSchema.vote).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user ID is empty', async () => {
      await expect(
        schema.voteOpenQuestionInclusion('question-123', '', true),
      ).rejects.toThrow(BadRequestException);
      expect(voteSchema.vote).not.toHaveBeenCalled();
    });

    it('should handle voting errors gracefully', async () => {
      voteSchema.vote.mockRejectedValue(new Error('Vote failed'));

      await expect(
        schema.voteOpenQuestionInclusion('question-123', 'user-456', true),
      ).rejects.toThrow('Failed to vote on open question: Vote failed');
    });
  });

  describe('getOpenQuestionVoteStatus', () => {
    it('should get vote status for an open question', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await schema.getOpenQuestionVoteStatus(
        'question-123',
        'user-456',
      );

      expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
        'OpenQuestionNode',
        { id: 'question-123' },
        'user-456',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should return null when no vote status exists', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(null);

      const result = await schema.getOpenQuestionVoteStatus(
        'question-123',
        'user-456',
      );

      expect(result).toBeNull();
    });

    it('should throw BadRequestException when question ID is empty', async () => {
      await expect(
        schema.getOpenQuestionVoteStatus('', 'user-456'),
      ).rejects.toThrow(BadRequestException);
      expect(voteSchema.getVoteStatus).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user ID is empty', async () => {
      await expect(
        schema.getOpenQuestionVoteStatus('question-123', ''),
      ).rejects.toThrow(BadRequestException);
      expect(voteSchema.getVoteStatus).not.toHaveBeenCalled();
    });

    it('should handle vote status errors gracefully', async () => {
      voteSchema.getVoteStatus.mockRejectedValue(
        new Error('Vote status failed'),
      );

      await expect(
        schema.getOpenQuestionVoteStatus('question-123', 'user-456'),
      ).rejects.toThrow(
        'Failed to get open question vote status: Vote status failed',
      );
    });
  });

  describe('removeOpenQuestionVote', () => {
    it('should remove inclusion vote', async () => {
      voteSchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await schema.removeOpenQuestionVote(
        'question-123',
        'user-456',
      );

      expect(voteSchema.removeVote).toHaveBeenCalledWith(
        'OpenQuestionNode',
        { id: 'question-123' },
        'user-456',
        'INCLUSION',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException when question ID is empty', async () => {
      await expect(
        schema.removeOpenQuestionVote('', 'user-456'),
      ).rejects.toThrow(BadRequestException);
      expect(voteSchema.removeVote).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user ID is empty', async () => {
      await expect(
        schema.removeOpenQuestionVote('question-123', ''),
      ).rejects.toThrow(BadRequestException);
      expect(voteSchema.removeVote).not.toHaveBeenCalled();
    });

    it('should handle remove vote errors gracefully', async () => {
      voteSchema.removeVote.mockRejectedValue(new Error('Remove vote failed'));

      await expect(
        schema.removeOpenQuestionVote('question-123', 'user-456'),
      ).rejects.toThrow(
        'Failed to remove open question vote: Remove vote failed',
      );
    });
  });

  describe('getOpenQuestionVotes', () => {
    it('should get votes for an open question', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await schema.getOpenQuestionVotes('question-123');

      expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
        'OpenQuestionNode',
        { id: 'question-123' },
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

      const result = await schema.getOpenQuestionVotes('question-123');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException when question ID is empty', async () => {
      await expect(schema.getOpenQuestionVotes('')).rejects.toThrow(
        BadRequestException,
      );
      expect(voteSchema.getVoteStatus).not.toHaveBeenCalled();
    });

    it('should handle get votes errors gracefully', async () => {
      voteSchema.getVoteStatus.mockRejectedValue(new Error('Get votes failed'));

      await expect(schema.getOpenQuestionVotes('question-123')).rejects.toThrow(
        'Failed to get open question vote status: Get votes failed',
      );
    });
  });

  describe('setVisibilityStatus', () => {
    it('should set visibility status to true', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockQuestionData, visibilityStatus: true },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.setVisibilityStatus('question-123', true);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('SET oq.visibilityStatus = $isVisible'),
        { id: 'question-123', isVisible: true },
      );
      expect(result).toEqual({ ...mockQuestionData, visibilityStatus: true });
    });

    it('should set visibility status to false', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockQuestionData, visibilityStatus: false },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.setVisibilityStatus('question-123', false);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('SET oq.visibilityStatus = $isVisible'),
        { id: 'question-123', isVisible: false },
      );
      expect(result).toEqual({ ...mockQuestionData, visibilityStatus: false });
    });

    it('should throw NotFoundException when question does not exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.setVisibilityStatus('nonexistent-id', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(schema.setVisibilityStatus('', true)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle visibility errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(
        new Error('Visibility update failed'),
      );

      await expect(
        schema.setVisibilityStatus('question-123', true),
      ).rejects.toThrow(
        'Failed to set visibility status: Visibility update failed',
      );
    });
  });

  describe('getVisibilityStatus', () => {
    it('should get visibility status for an open question', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(true),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getVisibilityStatus('question-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (oq:OpenQuestionNode {id: $id})'),
        { id: 'question-123' },
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

      const result = await schema.getVisibilityStatus('question-123');

      expect(result).toBe(true); // Should default to true
    });

    it('should throw NotFoundException when question does not exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      await expect(
        schema.getVisibilityStatus('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(schema.getVisibilityStatus('')).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.read).not.toHaveBeenCalled();
    });

    it('should handle get visibility errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Get visibility failed'));

      await expect(schema.getVisibilityStatus('question-123')).rejects.toThrow(
        'Failed to get visibility status: Get visibility failed',
      );
    });
  });

  describe('getOpenQuestionNetwork', () => {
    const mockQuestions = [
      {
        id: 'question-1',
        questionText: 'What is AI?',
        inclusionPositiveVotes: Integer.fromNumber(10),
        inclusionNegativeVotes: Integer.fromNumber(2),
        inclusionNetVotes: Integer.fromNumber(8),
      },
      {
        id: 'question-2',
        questionText: 'How does machine learning work?',
        inclusionPositiveVotes: Integer.fromNumber(15),
        inclusionNegativeVotes: Integer.fromNumber(3),
        inclusionNetVotes: Integer.fromNumber(12),
      },
    ];

    it('should get question network with default parameters', async () => {
      // Mock count query
      const mockCountResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(2)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockCountResult);

      // Mock network query
      const mockRecords = mockQuestions.map((question) => ({
        get: jest.fn().mockReturnValue(question),
      })) as unknown as Record[];
      const mockResult = {
        records: mockRecords,
      } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockResult);

      const result = await schema.getOpenQuestionNetwork({});

      expect(neo4jService.read).toHaveBeenCalledTimes(2); // count + network query
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no questions exist', async () => {
      const mockCountResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(0)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockCountResult);

      const result = await schema.getOpenQuestionNetwork({});

      expect(result).toEqual([]);
      expect(neo4jService.read).toHaveBeenCalledTimes(1); // Only count query
    });

    it('should handle filtering by keywords', async () => {
      const mockCountResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(1)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockCountResult);

      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockResult);

      await schema.getOpenQuestionNetwork({
        keywords: ['artificial', 'intelligence'],
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('w.word IN $keywords'),
        expect.objectContaining({
          keywords: ['artificial', 'intelligence'],
        }),
      );
    });

    it('should handle filtering by categories', async () => {
      const mockCountResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(1)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockCountResult);

      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockResult);

      await schema.getOpenQuestionNetwork({
        categories: ['tech-category', 'science-category'],
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('cat.id IN $categories'),
        expect.objectContaining({
          categories: ['tech-category', 'science-category'],
        }),
      );
    });

    it('should handle filtering by user', async () => {
      const mockCountResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(1)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockCountResult);

      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockResult);

      await schema.getOpenQuestionNetwork({
        userId: 'user-123',
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('oq.createdBy = $userId'),
        expect.objectContaining({
          userId: 'user-123',
        }),
      );
    });

    it('should handle sorting and pagination', async () => {
      const mockCountResult = {
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(10)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockCountResult);

      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockResult);

      await schema.getOpenQuestionNetwork({
        sortBy: 'netPositive',
        sortDirection: 'asc',
        limit: 5,
        offset: 10,
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY inclusionNetVotes ASC'),
        expect.objectContaining({
          limit: 5,
          offset: 10,
        }),
      );
    });

    it('should handle network errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Network query failed'));

      await expect(schema.getOpenQuestionNetwork({})).rejects.toThrow(
        'Failed to get open question network: Network query failed',
      );
    });
  });

  describe('getRelatedContentBySharedCategories', () => {
    const mockRelatedContent = [
      { id: 'statement-1', type: 'statement', categoryOverlap: 2 },
      { id: 'answer-1', type: 'answer', categoryOverlap: 1 },
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
        await schema.getRelatedContentBySharedCategories('question-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (oq:OpenQuestionNode {id: $nodeId})'),
        expect.objectContaining({
          nodeId: 'question-123',
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

      await schema.getRelatedContentBySharedCategories('question-123', {
        nodeTypes: ['statement', 'answer'],
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
          nodeId: 'question-123',
          nodeTypes: ['statement', 'answer'],
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
        schema.getRelatedContentBySharedCategories('question-123'),
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

    it('should get categories for an open question', async () => {
      const mockRecords = mockCategories.map((category) => ({
        get: jest.fn().mockReturnValue(category),
      })) as unknown as Record[];
      const mockResult = {
        records: mockRecords,
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getNodeCategories('question-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'MATCH (oq:OpenQuestionNode {id: $nodeId})-[:CATEGORIZED_AS]->(cat:CategoryNode)',
        ),
        { nodeId: 'question-123' },
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

    it('should return empty array when question has no categories', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getNodeCategories('question-123');

      expect(result).toEqual([]);
    });

    it('should handle get categories errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Categories query failed'));

      await expect(schema.getNodeCategories('question-123')).rejects.toThrow(
        'Failed to get open question categories: Categories query failed',
      );
    });
  });

  describe('getDirectlyRelatedQuestions', () => {
    const mockRelatedQuestions = [
      {
        id: 'related-1',
        questionText: 'What is machine learning?',
        createdBy: 'user-789',
        createdAt: '2024-01-01T00:00:00Z',
        publicCredit: true,
      },
      {
        id: 'related-2',
        questionText: 'How does neural networks work?',
        createdBy: 'user-456',
        createdAt: '2024-01-02T00:00:00Z',
        publicCredit: false,
      },
    ];

    it('should get directly related questions', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(mockRelatedQuestions),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getDirectlyRelatedQuestions('question-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'MATCH (oq:OpenQuestionNode {id: $questionId})-[:RELATED_TO]-(r:OpenQuestionNode)',
        ),
        { questionId: 'question-123' },
      );
      expect(result).toEqual(mockRelatedQuestions);
    });

    it('should return empty array when no related questions exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getDirectlyRelatedQuestions('question-123');

      expect(result).toEqual([]);
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(schema.getDirectlyRelatedQuestions('')).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.read).not.toHaveBeenCalled();
    });

    it('should handle query errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query failed'));

      await expect(
        schema.getDirectlyRelatedQuestions('question-123'),
      ).rejects.toThrow(
        'Failed to get directly related questions: Query failed',
      );
    });
  });

  describe('isOpenQuestionAvailableForAnswers', () => {
    it('should return true when question has passed inclusion threshold', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: {
            ...mockQuestionData,
            inclusionNetVotes: Integer.fromNumber(5), // > 0
          },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result =
        await schema.isOpenQuestionAvailableForAnswers('question-123');

      expect(result).toBe(true);
    });

    it('should return false when question has not passed inclusion threshold', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: {
            ...mockQuestionData,
            inclusionNetVotes: Integer.fromNumber(-1), // <= 0
          },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result =
        await schema.isOpenQuestionAvailableForAnswers('question-123');

      expect(result).toBe(false);
    });

    it('should return false when question does not exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result =
        await schema.isOpenQuestionAvailableForAnswers('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should return false on errors', async () => {
      neo4jService.read.mockRejectedValue(new Error('Database error'));

      const result =
        await schema.isOpenQuestionAvailableForAnswers('question-123');

      expect(result).toBe(false);
    });
  });

  describe('checkOpenQuestions', () => {
    it('should return question count', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(42)),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.checkOpenQuestions();

      expect(neo4jService.read).toHaveBeenCalledWith(
        'MATCH (oq:OpenQuestionNode) RETURN count(oq) as count',
      );
      expect(result).toEqual({ count: 42 });
    });

    it('should handle count errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Count failed'));

      await expect(schema.checkOpenQuestions()).rejects.toThrow(
        'Failed to check open questions: Count failed',
      );
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    describe('Question Text Normalization', () => {
      it('should handle question text with trailing whitespace', async () => {
        const dataWithWhitespace = {
          ...mockQuestionData,
          questionText: '  What is AI   ',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...dataWithWhitespace, questionText: 'What is AI?' },
          }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        await schema.createOpenQuestion(dataWithWhitespace);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            questionText: 'What is AI?',
          }),
        );
      });

      it('should handle question text with multiple question marks', async () => {
        const dataWithMultipleMarks = {
          ...mockQuestionData,
          questionText: 'What is AI???',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: dataWithMultipleMarks }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        await schema.createOpenQuestion(dataWithMultipleMarks);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            questionText: 'What is AI???', // Should not modify existing ?
          }),
        );
      });

      it('should handle very long question text', async () => {
        const longQuestionText =
          'What is artificial intelligence and how does it work in modern computing systems and what are its applications in various fields like healthcare, finance, education, and transportation and what are the ethical considerations';

        const dataWithLongText = {
          ...mockQuestionData,
          questionText: longQuestionText,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              ...dataWithLongText,
              questionText: longQuestionText + '?',
            },
          }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.createOpenQuestion(dataWithLongText);

        expect(result.questionText).toBe(longQuestionText + '?');
      });
    });

    describe('Neo4j Integer Conversion', () => {
      it('should properly convert Neo4j integers in vote counts', async () => {
        const mockRecord = {
          get: jest.fn().mockImplementation((key: string) => {
            if (key === 'oq') {
              return {
                properties: {
                  id: 'question-123',
                  questionText: 'What is AI?',
                  inclusionPositiveVotes: Integer.fromNumber(999999),
                  inclusionNegativeVotes: Integer.fromNumber(100000),
                  inclusionNetVotes: Integer.fromNumber(899999),
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

        const result = await schema.getOpenQuestion('question-123');

        expect(result).toEqual(
          expect.objectContaining({
            inclusionPositiveVotes: 999999,
            inclusionNegativeVotes: 100000,
            inclusionNetVotes: 899999,
          }),
        );
      });
    });

    describe('Input Validation Edge Cases', () => {
      it('should handle null and undefined inputs gracefully', async () => {
        await expect(schema.getOpenQuestion(null as any)).rejects.toThrow(
          BadRequestException,
        );
        await expect(schema.getOpenQuestion(undefined as any)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should handle whitespace-only question text', async () => {
        const invalidData = {
          ...mockQuestionData,
          questionText: '   \t\n  ',
        };

        await expect(schema.createOpenQuestion(invalidData)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should handle empty category arrays', async () => {
        const dataWithEmptyCategories = {
          ...mockQuestionData,
          categoryIds: [],
        };

        const mockRecord = {
          get: jest
            .fn()
            .mockReturnValue({ properties: dataWithEmptyCategories }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        await expect(
          schema.createOpenQuestion(dataWithEmptyCategories),
        ).resolves.toBeDefined();
      });

      it('should handle exactly 3 categories (boundary condition)', async () => {
        const dataWithMaxCategories = {
          ...mockQuestionData,
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
          schema.createOpenQuestion(dataWithMaxCategories),
        ).resolves.toBeDefined();
      });
    });

    describe('Error Propagation', () => {
      it('should preserve BadRequestException from underlying operations', async () => {
        neo4jService.write.mockRejectedValue(
          new BadRequestException('Invalid data'),
        );

        await expect(
          schema.createOpenQuestion(mockQuestionData),
        ).rejects.toThrow(BadRequestException);
      });

      it('should preserve NotFoundException from underlying operations', async () => {
        neo4jService.read.mockRejectedValue(
          new NotFoundException('Question not found'),
        );

        await expect(schema.getOpenQuestion('question-123')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should wrap generic errors with descriptive messages', async () => {
        neo4jService.write.mockRejectedValue(new Error('Network timeout'));

        await expect(
          schema.createOpenQuestion(mockQuestionData),
        ).rejects.toThrow('Failed to create open question: Network timeout');
      });
    });

    describe('Answer Integration Workflow', () => {
      it('should validate Answer creation workflow', async () => {
        // Mock question with positive inclusion votes (passed threshold)
        const approvedQuestion = {
          properties: {
            ...mockQuestionData,
            inclusionNetVotes: Integer.fromNumber(5), // > 0, passed threshold
          },
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue(approvedQuestion),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const canAcceptAnswers =
          await schema.isOpenQuestionAvailableForAnswers('question-123');

        expect(canAcceptAnswers).toBe(true);
      });

      it('should reject Answer creation for pending questions', async () => {
        // Mock question with zero inclusion votes (pending)
        const pendingQuestion = {
          properties: {
            ...mockQuestionData,
            inclusionNetVotes: Integer.fromNumber(0), // = 0, pending
          },
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue(pendingQuestion),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const canAcceptAnswers =
          await schema.isOpenQuestionAvailableForAnswers('question-123');

        expect(canAcceptAnswers).toBe(false);
      });

      it('should reject Answer creation for rejected questions', async () => {
        // Mock question with negative inclusion votes (rejected)
        const rejectedQuestion = {
          properties: {
            ...mockQuestionData,
            inclusionNetVotes: Integer.fromNumber(-3), // < 0, rejected
          },
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue(rejectedQuestion),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const canAcceptAnswers =
          await schema.isOpenQuestionAvailableForAnswers('question-123');

        expect(canAcceptAnswers).toBe(false);
      });
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
        ...mockQuestionData,
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
        schema.createOpenQuestion(dataWithManyKeywords),
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
        records: [{ get: jest.fn().mockReturnValue(Integer.fromNumber(1000)) }],
      } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockCountResult);

      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValueOnce(mockResult);

      await schema.getOpenQuestionNetwork({
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

  describe('Integration Scenarios', () => {
    it('should handle complete question lifecycle', async () => {
      // Create
      const createRecord = {
        get: jest.fn().mockReturnValue({ properties: mockQuestionData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [createRecord],
      } as unknown as Result);

      await schema.createOpenQuestion(mockQuestionData);

      // Vote inclusion
      voteSchema.vote.mockResolvedValueOnce(mockVoteResult);
      await schema.voteOpenQuestionInclusion('question-123', 'user-456', true);

      // Update
      const updateData = { questionText: 'What is machine learning' };
      const updateRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockQuestionData, ...updateData },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [updateRecord],
      } as unknown as Result);

      await schema.updateOpenQuestion('question-123', updateData);

      // Set visibility
      const visibilityRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockQuestionData, visibilityStatus: false },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [visibilityRecord],
      } as unknown as Result);

      await schema.setVisibilityStatus('question-123', false);

      // Delete
      const checkRecord = {
        get: jest.fn().mockReturnValue(mockQuestionData),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [checkRecord],
      } as unknown as Result);
      neo4jService.write.mockResolvedValueOnce({} as Result);

      const deleteResult = await schema.deleteOpenQuestion('question-123');

      expect(deleteResult.success).toBe(true);
      expect(neo4jService.write).toHaveBeenCalledTimes(4); // create, update, visibility, delete
      expect(voteSchema.vote).toHaveBeenCalledTimes(1); // inclusion only
    });

    it('should handle question creation with full workflow', async () => {
      const fullWorkflowData = {
        ...mockQuestionData,
        keywords: [
          { word: 'artificial', frequency: 10, source: 'ai' as const },
          { word: 'intelligence', frequency: 8, source: 'ai' as const },
          { word: 'machine', frequency: 6, source: 'user' as const },
          { word: 'learning', frequency: 4, source: 'user' as const },
        ] as KeywordWithFrequency[],
        categoryIds: ['tech-category', 'science-category', 'research-category'],
        initialComment: 'This is a comprehensive question about AI and ML.',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: fullWorkflowData }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.createOpenQuestion(fullWorkflowData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (oq:OpenQuestionNode'),
        expect.objectContaining({
          id: fullWorkflowData.id,
          questionText: fullWorkflowData.questionText + '?',
          createdBy: fullWorkflowData.createdBy,
          categoryIds: fullWorkflowData.categoryIds,
          keywords: fullWorkflowData.keywords,
        }),
      );
      expect(result).toEqual(fullWorkflowData);
    });
  });
});
