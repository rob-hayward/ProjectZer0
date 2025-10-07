// src/nodes/evidence/evidence.service.spec.ts - COMPREHENSIVE TEST SUITE

import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceService } from './evidence.service';
import { EvidenceSchema } from '../../neo4j/schemas/evidence.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { CategoryService } from '../category/category.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

describe('EvidenceService - Comprehensive Tests', () => {
  let service: EvidenceService;
  let evidenceSchema: jest.Mocked<EvidenceSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  let userSchema: jest.Mocked<UserSchema>;
  let categoryService: jest.Mocked<CategoryService>;
  let keywordExtractionService: jest.Mocked<KeywordExtractionService>;
  let wordService: jest.Mocked<WordService>;

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 6,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 4,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree' as const,
    inclusionPositiveVotes: 6,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 4,
    contentStatus: null,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  beforeEach(async () => {
    const mockEvidenceSchema = {
      createEvidence: jest.fn(),
      getEvidence: jest.fn(),
      updateEvidence: jest.fn(),
      delete: jest.fn(),
      voteInclusion: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
      submitPeerReview: jest.fn(),
      getPeerReviewStats: jest.fn(),
      getUserPeerReview: jest.fn(),
      isPeerReviewAllowed: jest.fn(),
      getEvidenceForNode: jest.fn(),
    };

    const mockDiscussionSchema = {
      createDiscussionForNode: jest.fn(),
    };

    const mockUserSchema = {
      addCreatedNode: jest.fn(),
    };

    const mockCategoryService = {
      getCategory: jest.fn(),
    };

    const mockKeywordExtractionService = {
      extractKeywords: jest.fn(),
    };

    const mockWordService = {
      checkWordExistence: jest.fn(),
      createWord: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService,
        { provide: EvidenceSchema, useValue: mockEvidenceSchema },
        { provide: DiscussionSchema, useValue: mockDiscussionSchema },
        { provide: UserSchema, useValue: mockUserSchema },
        { provide: CategoryService, useValue: mockCategoryService },
        {
          provide: KeywordExtractionService,
          useValue: mockKeywordExtractionService,
        },
        { provide: WordService, useValue: mockWordService },
      ],
    }).compile();

    service = module.get<EvidenceService>(EvidenceService);
    evidenceSchema = module.get(EvidenceSchema);
    discussionSchema = module.get(DiscussionSchema);
    userSchema = module.get(UserSchema);
    categoryService = module.get(CategoryService);
    keywordExtractionService = module.get(KeywordExtractionService);
    wordService = module.get(WordService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // CREATE EVIDENCE TESTS
  // ============================================
  describe('createEvidence', () => {
    const validEvidenceData = {
      title: 'Climate Study 2024',
      url: 'https://journal.org/study',
      evidenceType: 'academic_paper' as const,
      parentNodeId: 'statement-123',
      parentNodeType: 'StatementNode' as const,
      authors: ['Smith, J.', 'Doe, A.'],
      publicationDate: new Date('2024-01-15'),
      description: 'Important climate findings',
      createdBy: 'user-123',
      publicCredit: true,
      categoryIds: ['cat-science'],
      userKeywords: ['climate', 'environment'],
      initialComment: 'Significant research',
    };

    beforeEach(() => {
      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: [],
      });
    });

    it('should create evidence with user-provided keywords', async () => {
      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      const mockCreatedEvidence = {
        id: expect.any(String),
        ...validEvidenceData,
      };

      evidenceSchema.createEvidence.mockResolvedValue(
        mockCreatedEvidence as any,
      );
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      const result = await service.createEvidence(validEvidenceData);

      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();
      expect(evidenceSchema.createEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: expect.arrayContaining([
            { word: 'climate', frequency: 1, source: 'user' },
            { word: 'environment', frequency: 1, source: 'user' },
          ]),
        }),
      );
      expect(result).toEqual(mockCreatedEvidence);
    });

    it('should create evidence with AI-extracted keywords', async () => {
      const dataWithoutKeywords = {
        ...validEvidenceData,
        userKeywords: undefined,
      };

      const mockKeywords = [
        { word: 'climate', frequency: 1, source: 'ai' as const },
        { word: 'study', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      const mockCreatedEvidence = {
        id: expect.any(String),
        ...dataWithoutKeywords,
      };

      evidenceSchema.createEvidence.mockResolvedValue(
        mockCreatedEvidence as any,
      );
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      const result = await service.createEvidence(dataWithoutKeywords);

      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: expect.stringContaining('Climate Study 2024'),
      });
      expect(evidenceSchema.createEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: mockKeywords,
        }),
      );
      expect(result).toEqual(mockCreatedEvidence);
    });

    it('should create missing word nodes', async () => {
      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      evidenceSchema.createEvidence.mockResolvedValue({
        id: 'evidence-123',
      } as any);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      await service.createEvidence(validEvidenceData);

      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'climate',
        createdBy: 'user-123',
        publicCredit: true,
      });
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'environment',
        createdBy: 'user-123',
        publicCredit: true,
      });
    });

    it('should not create existing word nodes', async () => {
      wordService.checkWordExistence.mockResolvedValue(true);

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      evidenceSchema.createEvidence.mockResolvedValue({
        id: 'evidence-123',
      } as any);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      await service.createEvidence(validEvidenceData);

      expect(wordService.createWord).not.toHaveBeenCalled();
    });

    it('should continue if word creation fails', async () => {
      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockRejectedValue(
        new Error('Word creation failed'),
      );

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      evidenceSchema.createEvidence.mockResolvedValue({
        id: 'evidence-123',
      } as any);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      const result = await service.createEvidence(validEvidenceData);

      expect(result).toBeDefined();
    });

    it('should validate categories exist and are approved', async () => {
      wordService.checkWordExistence.mockResolvedValue(true);

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      evidenceSchema.createEvidence.mockResolvedValue({
        id: 'evidence-123',
      } as any);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      await service.createEvidence(validEvidenceData);

      expect(categoryService.getCategory).toHaveBeenCalledWith('cat-science');
    });

    it('should reject unapproved categories', async () => {
      wordService.checkWordExistence.mockResolvedValue(true);

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: -1,
      } as any);

      await expect(service.createEvidence(validEvidenceData)).rejects.toThrow(
        'must have passed inclusion threshold',
      );
    });

    it('should reject non-existent categories', async () => {
      wordService.checkWordExistence.mockResolvedValue(true);

      categoryService.getCategory.mockResolvedValue(null);

      await expect(service.createEvidence(validEvidenceData)).rejects.toThrow(
        'does not exist',
      );
    });

    it('should create discussion with correct nodeIdField', async () => {
      wordService.checkWordExistence.mockResolvedValue(true);

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      evidenceSchema.createEvidence.mockResolvedValue({
        id: 'evidence-123',
      } as any);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      await service.createEvidence(validEvidenceData);

      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: expect.any(String),
        nodeType: 'EvidenceNode',
        nodeIdField: 'id',
        createdBy: 'user-123',
        initialComment: 'Significant research',
      });
    });

    it('should continue if discussion creation fails', async () => {
      wordService.checkWordExistence.mockResolvedValue(true);

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      evidenceSchema.createEvidence.mockResolvedValue({
        id: 'evidence-123',
      } as any);
      discussionSchema.createDiscussionForNode.mockRejectedValue(
        new Error('Discussion failed'),
      );

      const result = await service.createEvidence(validEvidenceData);

      expect(result).toBeDefined();
    });

    it('should continue if UserSchema tracking fails', async () => {
      wordService.checkWordExistence.mockResolvedValue(true);

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      evidenceSchema.createEvidence.mockResolvedValue({
        id: 'evidence-123',
      } as any);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);
      userSchema.addCreatedNode.mockRejectedValue(
        new Error('UserSchema failed'),
      );

      const result = await service.createEvidence(validEvidenceData);

      expect(result).toBeDefined();
    });

    it('should handle keyword extraction failure gracefully', async () => {
      const dataWithoutKeywords = {
        ...validEvidenceData,
        userKeywords: undefined,
      };

      keywordExtractionService.extractKeywords.mockRejectedValue(
        new Error('Extraction failed'),
      );

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      evidenceSchema.createEvidence.mockResolvedValue({
        id: 'evidence-123',
      } as any);
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      const result = await service.createEvidence(dataWithoutKeywords);

      expect(evidenceSchema.createEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: [],
        }),
      );
      expect(result).toBeDefined();
    });

    it('should validate required fields', async () => {
      await expect(
        service.createEvidence({
          ...validEvidenceData,
          createdBy: '',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEvidence({
          ...validEvidenceData,
          title: '',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEvidence({
          ...validEvidenceData,
          url: '',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEvidence({
          ...validEvidenceData,
          url: 'not-a-url',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEvidence({
          ...validEvidenceData,
          parentNodeId: '',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEvidence({
          ...validEvidenceData,
          parentNodeType: 'InvalidNode' as any,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEvidence({
          ...validEvidenceData,
          categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'],
        }),
      ).rejects.toThrow('Evidence can have maximum 3 categories');
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      wordService.checkWordExistence.mockResolvedValue(true);

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      evidenceSchema.createEvidence.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.createEvidence(validEvidenceData)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should preserve BadRequestException from dependencies', async () => {
      wordService.checkWordExistence.mockResolvedValue(true);

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      evidenceSchema.createEvidence.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(service.createEvidence(validEvidenceData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // GET EVIDENCE TESTS
  // ============================================
  describe('getEvidence', () => {
    it('should retrieve evidence by ID', async () => {
      const mockEvidence = {
        id: 'test-id',
        title: 'Test Evidence',
        url: 'https://example.com',
      };

      evidenceSchema.getEvidence.mockResolvedValue(mockEvidence as any);

      const result = await service.getEvidence('test-id');

      expect(evidenceSchema.getEvidence).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockEvidence);
    });

    it('should throw NotFoundException when evidence not found', async () => {
      evidenceSchema.getEvidence.mockResolvedValue(null);

      await expect(service.getEvidence('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.getEvidence('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      evidenceSchema.getEvidence.mockRejectedValue(new Error('Database error'));

      await expect(service.getEvidence('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // UPDATE EVIDENCE TESTS
  // ============================================
  describe('updateEvidence', () => {
    it('should update evidence basic properties', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      evidenceSchema.getEvidence.mockResolvedValue({
        id: 'test-id',
        title: 'Original Title',
        description: 'Original description',
        createdBy: 'user-123',
        publicCredit: true,
      } as any);

      evidenceSchema.updateEvidence.mockResolvedValue({
        id: 'test-id',
        ...updateData,
      } as any);

      const result = await service.updateEvidence('test-id', updateData);

      expect(evidenceSchema.updateEvidence).toHaveBeenCalledWith(
        'test-id',
        updateData,
      );
      expect(result).toEqual({ id: 'test-id', ...updateData });
    });

    it('should re-extract keywords when title or description changes', async () => {
      evidenceSchema.getEvidence.mockResolvedValue({
        id: 'test-id',
        title: 'Original',
        createdBy: 'user-123',
        publicCredit: true,
      } as any);

      const mockKeywords = [
        { word: 'updated', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      wordService.checkWordExistence.mockResolvedValue(false);
      wordService.createWord.mockResolvedValue({} as any);

      evidenceSchema.updateEvidence.mockResolvedValue({
        id: 'test-id',
      } as any);

      await service.updateEvidence('test-id', { title: 'Updated Title' });

      expect(keywordExtractionService.extractKeywords).toHaveBeenCalled();
      expect(evidenceSchema.updateEvidence).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          title: 'Updated Title',
          keywords: mockKeywords,
        }),
      );
    });

    it('should validate URL format when updating', async () => {
      await expect(
        service.updateEvidence('test-id', { url: 'not-a-url' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate category count when updating', async () => {
      await expect(
        service.updateEvidence('test-id', {
          categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'],
        }),
      ).rejects.toThrow('Evidence can have maximum 3 categories');
    });

    it('should throw NotFoundException when updating non-existent evidence', async () => {
      evidenceSchema.updateEvidence.mockResolvedValue(null);

      await expect(
        service.updateEvidence('nonexistent-id', { title: 'New Title' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        service.updateEvidence('', { title: 'New Title' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      evidenceSchema.getEvidence.mockRejectedValue(new Error('Database error'));

      await expect(
        service.updateEvidence('test-id', { title: 'New Title' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ============================================
  // DELETE EVIDENCE TESTS
  // ============================================
  describe('deleteEvidence', () => {
    it('should delete evidence when user is creator', async () => {
      evidenceSchema.getEvidence.mockResolvedValue({
        id: 'test-id',
        createdBy: 'user-123',
      } as any);
      evidenceSchema.delete.mockResolvedValue(undefined);

      await service.deleteEvidence('test-id', 'user-123');

      expect(evidenceSchema.delete).toHaveBeenCalledWith('test-id');
    });

    it('should throw BadRequestException when user is not creator', async () => {
      evidenceSchema.getEvidence.mockResolvedValue({
        id: 'test-id',
        createdBy: 'user-123',
      } as any);

      await expect(
        service.deleteEvidence('test-id', 'different-user'),
      ).rejects.toThrow('Only the creator can delete this evidence');
    });

    it('should throw NotFoundException when evidence does not exist', async () => {
      evidenceSchema.getEvidence.mockResolvedValue(null);

      await expect(
        service.deleteEvidence('nonexistent-id', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.deleteEvidence('', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.deleteEvidence('test-id', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // VOTING TESTS - INCLUSION ONLY
  // ============================================
  describe('voteInclusion', () => {
    it('should vote on evidence inclusion', async () => {
      evidenceSchema.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await service.voteInclusion('test-id', 'user-123', true);

      expect(evidenceSchema.voteInclusion).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should handle negative votes', async () => {
      evidenceSchema.voteInclusion.mockResolvedValue(mockVoteResult);

      await service.voteInclusion('test-id', 'user-123', false);

      expect(evidenceSchema.voteInclusion).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        false,
      );
    });

    it('should throw BadRequestException for empty evidence ID', async () => {
      await expect(service.voteInclusion('', 'user-123', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.voteInclusion('test-id', '', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      evidenceSchema.voteInclusion.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.voteInclusion('test-id', 'user-123', true),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getVoteStatus', () => {
    it('should get vote status for a user', async () => {
      evidenceSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await service.getVoteStatus('test-id', 'user-123');

      expect(evidenceSchema.getVoteStatus).toHaveBeenCalledWith(
        'test-id',
        'user-123',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should return null when user has not voted', async () => {
      evidenceSchema.getVoteStatus.mockResolvedValue(null);

      const result = await service.getVoteStatus('test-id', 'user-123');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty evidence ID', async () => {
      await expect(service.getVoteStatus('', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.getVoteStatus('test-id', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      evidenceSchema.getVoteStatus.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.getVoteStatus('test-id', 'user-123'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('removeVote', () => {
    it('should remove an inclusion vote', async () => {
      evidenceSchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await service.removeVote('test-id', 'user-123');

      expect(evidenceSchema.removeVote).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        'INCLUSION',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException for empty evidence ID', async () => {
      await expect(service.removeVote('', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.removeVote('test-id', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      evidenceSchema.removeVote.mockRejectedValue(new Error('Database error'));

      await expect(service.removeVote('test-id', 'user-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getVotes', () => {
    it('should get vote totals for evidence', async () => {
      evidenceSchema.getVotes.mockResolvedValue(mockVoteResult);

      const result = await service.getVotes('test-id');

      expect(evidenceSchema.getVotes).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockVoteResult);
    });

    it('should return null when evidence has no votes', async () => {
      evidenceSchema.getVotes.mockResolvedValue(null);

      const result = await service.getVotes('test-id');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.getVotes('')).rejects.toThrow(BadRequestException);
    });

    it('should wrap schema errors in InternalServerErrorException', async () => {
      evidenceSchema.getVotes.mockRejectedValue(new Error('Database error'));

      await expect(service.getVotes('test-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ============================================
  // PEER REVIEW TESTS
  // ============================================
  describe('submitPeerReview', () => {
    const validReviewData = {
      evidenceId: 'evidence-123',
      userId: 'user-456',
      qualityScore: 5,
      independenceScore: 4,
      relevanceScore: 5,
      comments: 'Excellent methodology',
    };

    it('should submit peer review', async () => {
      const mockReview = {
        id: 'review-123',
        ...validReviewData,
        createdAt: new Date(),
      };

      evidenceSchema.submitPeerReview.mockResolvedValue(mockReview as any);

      const result = await service.submitPeerReview(validReviewData);

      expect(evidenceSchema.submitPeerReview).toHaveBeenCalledWith(
        validReviewData,
      );
      expect(result).toEqual(mockReview);
    });

    it('should validate score ranges', async () => {
      await expect(
        service.submitPeerReview({
          ...validReviewData,
          qualityScore: 0,
        }),
      ).rejects.toThrow('Quality score must be between 1 and 5');

      await expect(
        service.submitPeerReview({
          ...validReviewData,
          qualityScore: 6,
        }),
      ).rejects.toThrow('Quality score must be between 1 and 5');

      await expect(
        service.submitPeerReview({
          ...validReviewData,
          independenceScore: 0,
        }),
      ).rejects.toThrow('Independence score must be between 1 and 5');

      await expect(
        service.submitPeerReview({
          ...validReviewData,
          relevanceScore: 6,
        }),
      ).rejects.toThrow('Relevance score must be between 1 and 5');
    });

    it('should throw BadRequestException for empty evidence ID', async () => {
      await expect(
        service.submitPeerReview({
          ...validReviewData,
          evidenceId: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(
        service.submitPeerReview({
          ...validReviewData,
          userId: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate BadRequestException from schema', async () => {
      evidenceSchema.submitPeerReview.mockRejectedValue(
        new BadRequestException('Evidence must pass inclusion threshold'),
      );

      await expect(service.submitPeerReview(validReviewData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      evidenceSchema.submitPeerReview.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.submitPeerReview(validReviewData)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getPeerReviewStats', () => {
    it('should get peer review statistics', async () => {
      const mockStats = {
        reviewCount: 5,
        avgQualityScore: 4.2,
        avgIndependenceScore: 3.8,
        avgRelevanceScore: 4.5,
        overallScore: 4.17,
        scoreDistribution: {
          quality: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 2 },
          independence: { 1: 0, 2: 1, 3: 1, 4: 2, 5: 1 },
          relevance: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 3 },
        },
      };

      evidenceSchema.getPeerReviewStats.mockResolvedValue(mockStats);

      const result = await service.getPeerReviewStats('evidence-123');

      expect(evidenceSchema.getPeerReviewStats).toHaveBeenCalledWith(
        'evidence-123',
      );
      expect(result).toEqual(mockStats);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(service.getPeerReviewStats('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      evidenceSchema.getPeerReviewStats.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getPeerReviewStats('evidence-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getUserPeerReview', () => {
    it('should get user peer review', async () => {
      const mockReview = {
        id: 'review-123',
        evidenceId: 'evidence-123',
        userId: 'user-456',
        qualityScore: 5,
        independenceScore: 4,
        relevanceScore: 5,
      };

      evidenceSchema.getUserPeerReview.mockResolvedValue(mockReview as any);

      const result = await service.getUserPeerReview(
        'evidence-123',
        'user-456',
      );

      expect(evidenceSchema.getUserPeerReview).toHaveBeenCalledWith(
        'evidence-123',
        'user-456',
      );
      expect(result).toEqual(mockReview);
    });

    it('should return null when user has not reviewed', async () => {
      evidenceSchema.getUserPeerReview.mockResolvedValue(null);

      const result = await service.getUserPeerReview(
        'evidence-123',
        'user-456',
      );

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty evidence ID', async () => {
      await expect(service.getUserPeerReview('', 'user-456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(
        service.getUserPeerReview('evidence-123', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      evidenceSchema.getUserPeerReview.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.getUserPeerReview('evidence-123', 'user-456'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ============================================
  // UTILITY METHODS TESTS
  // ============================================
  describe('isEvidenceApproved', () => {
    it('should return true when evidence has positive net inclusion votes', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: 5,
      };
      evidenceSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isEvidenceApproved('test-id');

      expect(evidenceSchema.getVotes).toHaveBeenCalledWith('test-id');
      expect(result).toBe(true);
    });

    it('should return false when evidence has negative net inclusion votes', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: -3,
      };
      evidenceSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isEvidenceApproved('test-id');

      expect(result).toBe(false);
    });

    it('should return false when evidence has exactly zero net inclusion votes', async () => {
      const mockVotes = {
        ...mockVoteResult,
        inclusionNetVotes: 0,
      };
      evidenceSchema.getVotes.mockResolvedValue(mockVotes);

      const result = await service.isEvidenceApproved('test-id');

      expect(result).toBe(false);
    });

    it('should return false when votes are null', async () => {
      evidenceSchema.getVotes.mockResolvedValue(null);

      const result = await service.isEvidenceApproved('test-id');

      expect(result).toBe(false);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.isEvidenceApproved('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return false on error', async () => {
      evidenceSchema.getVotes.mockRejectedValue(new Error('Database error'));

      const result = await service.isEvidenceApproved('test-id');

      expect(result).toBe(false);
    });
  });

  describe('isPeerReviewAllowed', () => {
    it('should return true when peer review is allowed', async () => {
      evidenceSchema.isPeerReviewAllowed.mockResolvedValue(true);

      const result = await service.isPeerReviewAllowed('test-id');

      expect(evidenceSchema.isPeerReviewAllowed).toHaveBeenCalledWith(
        'test-id',
      );
      expect(result).toBe(true);
    });

    it('should return false when peer review is not allowed', async () => {
      evidenceSchema.isPeerReviewAllowed.mockResolvedValue(false);

      const result = await service.isPeerReviewAllowed('test-id');

      expect(result).toBe(false);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.isPeerReviewAllowed('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return false on error', async () => {
      evidenceSchema.isPeerReviewAllowed.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.isPeerReviewAllowed('test-id');

      expect(result).toBe(false);
    });
  });

  describe('getEvidenceForNode', () => {
    it('should get evidence for a parent node', async () => {
      const mockEvidence = [
        { id: 'evidence-1', title: 'Study 1' },
        { id: 'evidence-2', title: 'Study 2' },
      ];

      evidenceSchema.getEvidenceForNode.mockResolvedValue(mockEvidence as any);

      const result = await service.getEvidenceForNode(
        'statement-123',
        'StatementNode',
      );

      expect(evidenceSchema.getEvidenceForNode).toHaveBeenCalledWith(
        'statement-123',
        'StatementNode',
      );
      expect(result).toEqual(mockEvidence);
    });

    it('should throw BadRequestException for empty parent node ID', async () => {
      await expect(
        service.getEvidenceForNode('', 'StatementNode'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should wrap unknown errors in InternalServerErrorException', async () => {
      evidenceSchema.getEvidenceForNode.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.getEvidenceForNode('statement-123', 'StatementNode'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ============================================
  // INTEGRATION TESTS
  // ============================================
  describe('Integration - Full Create Flow', () => {
    it('should handle complete evidence creation with all features', async () => {
      const evidenceData = {
        title: 'Comprehensive Climate Study 2024',
        url: 'https://journal.org/comprehensive-study',
        evidenceType: 'academic_paper' as const,
        parentNodeId: 'statement-456',
        parentNodeType: 'StatementNode' as const,
        authors: ['Smith, J.', 'Doe, A.', 'Johnson, B.'],
        publicationDate: new Date('2024-03-15'),
        description: 'A comprehensive study on climate patterns',
        createdBy: 'user-789',
        publicCredit: true,
        categoryIds: ['cat-1', 'cat-2'],
        initialComment: 'This is groundbreaking research',
      };

      // Mock keyword extraction
      const mockKeywords = [
        { word: 'comprehensive', frequency: 1, source: 'ai' as const },
        { word: 'climate', frequency: 1, source: 'ai' as const },
        { word: 'study', frequency: 1, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockKeywords,
      });

      // Mock word checks
      wordService.checkWordExistence.mockImplementation(
        async (word: string) => {
          return word === 'climate'; // Only 'climate' exists
        },
      );

      wordService.createWord.mockResolvedValue({} as any);

      // Mock category validation
      categoryService.getCategory.mockResolvedValue({
        id: 'cat-1',
        inclusionNetVotes: 5,
      } as any);

      // Mock evidence creation
      const mockCreatedEvidence = {
        id: expect.any(String),
        ...evidenceData,
      };

      evidenceSchema.createEvidence.mockResolvedValue(
        mockCreatedEvidence as any,
      );

      // Mock user tracking
      userSchema.addCreatedNode.mockResolvedValue(undefined);

      // Mock discussion creation
      discussionSchema.createDiscussionForNode.mockResolvedValue({} as any);

      const result = await service.createEvidence(evidenceData);

      // Verify keyword extraction
      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: expect.stringContaining('Comprehensive Climate Study'),
      });

      // Verify word creation for missing words
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'comprehensive',
        createdBy: 'user-789',
        publicCredit: true,
      });
      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'study',
        createdBy: 'user-789',
        publicCredit: true,
      });
      // 'climate' should not be created (already exists)
      expect(wordService.createWord).not.toHaveBeenCalledWith({
        word: 'climate',
        createdBy: 'user-789',
        publicCredit: true,
      });

      // Verify category validation for both categories
      expect(categoryService.getCategory).toHaveBeenCalledTimes(2);

      // Verify discussion creation
      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: expect.any(String),
        nodeType: 'EvidenceNode',
        nodeIdField: 'id',
        createdBy: 'user-789',
        initialComment: 'This is groundbreaking research',
      });

      // Verify user tracking
      expect(userSchema.addCreatedNode).toHaveBeenCalledWith(
        'user-789',
        expect.any(String),
        'evidence',
      );

      // Verify final result
      expect(result).toEqual(mockCreatedEvidence);
    });
  });
});
