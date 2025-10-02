// src/nodes/evidence/evidence.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceService } from './evidence.service';
import { EvidenceSchema } from '../../neo4j/schemas/evidence.schema';
import { CategoryService } from '../category/category.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('EvidenceService', () => {
  let service: EvidenceService;
  let evidenceSchema: jest.Mocked<EvidenceSchema>;
  let categoryService: jest.Mocked<CategoryService>;
  let commentService: jest.Mocked<CommentService>;
  let keywordExtractionService: jest.Mocked<KeywordExtractionService>;
  let wordService: jest.Mocked<WordService>;
  let userSchema: jest.Mocked<UserSchema>;

  const mockEvidenceSchema = {
    createEvidence: jest.fn(),
    getEvidence: jest.fn(),
    updateEvidence: jest.fn(),
    delete: jest.fn(),
    submitPeerReview: jest.fn(),
    getPeerReviewStats: jest.fn(),
    getUserPeerReview: jest.fn(),
    isPeerReviewAllowed: jest.fn(),
    getEvidenceForNode: jest.fn(),
    getTopRatedEvidence: jest.fn(),
    getAllEvidence: jest.fn(),
    getCategories: jest.fn(),
    getVotes: jest.fn(),
    checkEvidence: jest.fn(),
  };

  const mockCategoryService = {
    getCategory: jest.fn(),
  };

  const mockDiscussionService = {
    createDiscussion: jest.fn(),
    getDiscussion: jest.fn(),
  };

  const mockCommentService = {
    getCommentsByDiscussionId: jest.fn(),
    createComment: jest.fn(),
  };

  const mockKeywordExtractionService = {
    extractKeywords: jest.fn(),
  };

  const mockWordService = {
    getWord: jest.fn(),
    createWord: jest.fn(),
  };

  const mockUserSchema = {
    addCreatedNode: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService,
        {
          provide: EvidenceSchema,
          useValue: mockEvidenceSchema,
        },
        {
          provide: CategoryService,
          useValue: mockCategoryService,
        },
        {
          provide: DiscussionService,
          useValue: mockDiscussionService,
        },
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
        {
          provide: KeywordExtractionService,
          useValue: mockKeywordExtractionService,
        },
        {
          provide: WordService,
          useValue: mockWordService,
        },
        {
          provide: UserSchema,
          useValue: mockUserSchema,
        },
      ],
    }).compile();

    service = module.get<EvidenceService>(EvidenceService);
    evidenceSchema = module.get(EvidenceSchema);
    categoryService = module.get(CategoryService);
    commentService = module.get(CommentService);
    keywordExtractionService = module.get(KeywordExtractionService);
    wordService = module.get(WordService);
    userSchema = module.get(UserSchema);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

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
      publicCredit: true,
      createdBy: 'user-123',
      categoryIds: ['cat-science'],
      userKeywords: ['climate', 'temperature'],
      initialComment: 'Significant research',
    };

    it('should create evidence with user-provided keywords', async () => {
      const mockCategories = [{ id: 'cat-science', inclusionNetVotes: 5 }];
      categoryService.getCategory.mockResolvedValue(mockCategories[0] as any);

      wordService.getWord.mockResolvedValue({ word: 'climate' } as any);

      const mockCreatedEvidence = {
        id: 'evidence-123',
        ...validEvidenceData,
      };
      evidenceSchema.createEvidence.mockResolvedValue(
        mockCreatedEvidence as any,
      );

      userSchema.addCreatedNode.mockResolvedValue(undefined);

      const result = await service.createEvidence(validEvidenceData);

      expect(keywordExtractionService.extractKeywords).not.toHaveBeenCalled();
      expect(evidenceSchema.createEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          ...validEvidenceData,
          keywords: [
            { word: 'climate', frequency: 1, source: 'user' },
            { word: 'temperature', frequency: 1, source: 'user' },
          ],
        }),
      );
      expect(userSchema.addCreatedNode).toHaveBeenCalledWith(
        'user-123',
        expect.any(String),
        'evidence',
      );
      expect(result).toEqual(mockCreatedEvidence);
    });

    it('should extract keywords when not provided by user', async () => {
      const dataWithoutKeywords = {
        ...validEvidenceData,
        userKeywords: undefined,
      };

      const mockExtractedKeywords = [
        { word: 'climate', frequency: 0.9, source: 'ai' as const },
        { word: 'study', frequency: 0.7, source: 'ai' as const },
      ];

      keywordExtractionService.extractKeywords.mockResolvedValue({
        keywords: mockExtractedKeywords,
      } as any);

      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);
      wordService.getWord.mockResolvedValue({ word: 'climate' } as any);

      const mockCreatedEvidence = {
        id: 'evidence-123',
        ...dataWithoutKeywords,
      };
      evidenceSchema.createEvidence.mockResolvedValue(
        mockCreatedEvidence as any,
      );

      const result = await service.createEvidence(dataWithoutKeywords);

      expect(keywordExtractionService.extractKeywords).toHaveBeenCalledWith({
        text: expect.stringContaining('Climate Study 2024'),
        userKeywords: undefined,
      });
      expect(result).toEqual(mockCreatedEvidence);
    });

    it('should create missing word nodes', async () => {
      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);

      wordService.getWord.mockResolvedValue(null);
      wordService.createWord.mockResolvedValue({ word: 'climate' } as any);

      const mockCreatedEvidence = { id: 'evidence-123', ...validEvidenceData };
      evidenceSchema.createEvidence.mockResolvedValue(
        mockCreatedEvidence as any,
      );

      await service.createEvidence(validEvidenceData);

      expect(wordService.createWord).toHaveBeenCalledWith({
        word: 'climate',
        createdBy: 'user-123',
        publicCredit: false,
      });
    });

    it('should validate categories exist and have passed inclusion', async () => {
      categoryService.getCategory.mockResolvedValue(null);

      await expect(service.createEvidence(validEvidenceData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createEvidence(validEvidenceData)).rejects.toThrow(
        'Category with ID cat-science not found',
      );
    });

    it('should reject categories that have not passed inclusion', async () => {
      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: -1,
      } as any);

      await expect(service.createEvidence(validEvidenceData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createEvidence(validEvidenceData)).rejects.toThrow(
        'has not passed inclusion threshold',
      );
    });

    it('should throw BadRequestException for invalid input', async () => {
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

    it('should continue if UserSchema tracking fails', async () => {
      categoryService.getCategory.mockResolvedValue({
        id: 'cat-science',
        inclusionNetVotes: 5,
      } as any);
      wordService.getWord.mockResolvedValue({ word: 'climate' } as any);

      const mockCreatedEvidence = { id: 'evidence-123', ...validEvidenceData };
      evidenceSchema.createEvidence.mockResolvedValue(
        mockCreatedEvidence as any,
      );

      userSchema.addCreatedNode.mockRejectedValue(
        new Error('UserSchema failed'),
      );

      const result = await service.createEvidence(validEvidenceData);

      expect(result).toEqual(mockCreatedEvidence);
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

      const mockCreatedEvidence = {
        id: 'evidence-123',
        ...dataWithoutKeywords,
      };
      evidenceSchema.createEvidence.mockResolvedValue(
        mockCreatedEvidence as any,
      );

      const result = await service.createEvidence(dataWithoutKeywords);

      expect(evidenceSchema.createEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: [],
        }),
      );
      expect(result).toEqual(mockCreatedEvidence);
    });
  });

  describe('getEvidence', () => {
    it('should get evidence by id', async () => {
      const mockEvidence = {
        id: 'evidence-123',
        title: 'Climate Study',
        url: 'https://journal.org/study',
      };
      evidenceSchema.getEvidence.mockResolvedValue(mockEvidence as any);

      const result = await service.getEvidence('evidence-123');

      expect(evidenceSchema.getEvidence).toHaveBeenCalledWith('evidence-123');
      expect(result).toEqual(mockEvidence);
    });

    it('should throw NotFoundException when evidence does not exist', async () => {
      evidenceSchema.getEvidence.mockResolvedValue(null);

      await expect(service.getEvidence('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getEvidence('nonexistent-id')).rejects.toThrow(
        'Evidence with ID nonexistent-id not found',
      );
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(service.getEvidence('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateEvidence', () => {
    it('should update evidence', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
        publicCredit: false,
      };

      const mockUpdatedEvidence = {
        id: 'evidence-123',
        ...updateData,
      };
      evidenceSchema.updateEvidence.mockResolvedValue(
        mockUpdatedEvidence as any,
      );

      const result = await service.updateEvidence('evidence-123', updateData);

      expect(evidenceSchema.updateEvidence).toHaveBeenCalledWith(
        'evidence-123',
        updateData,
      );
      expect(result).toEqual(mockUpdatedEvidence);
    });

    it('should validate categories when updating', async () => {
      const updateData = {
        categoryIds: ['cat-1', 'cat-2'],
      };

      categoryService.getCategory.mockResolvedValueOnce({
        id: 'cat-1',
        inclusionNetVotes: 5,
      } as any);
      categoryService.getCategory.mockResolvedValueOnce({
        id: 'cat-2',
        inclusionNetVotes: 3,
      } as any);

      evidenceSchema.updateEvidence.mockResolvedValue({
        id: 'evidence-123',
      } as any);

      await service.updateEvidence('evidence-123', updateData);

      expect(categoryService.getCategory).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when evidence does not exist', async () => {
      evidenceSchema.updateEvidence.mockResolvedValue(null);

      await expect(
        service.updateEvidence('nonexistent-id', { title: 'New Title' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(
        service.updateEvidence('', { title: 'New Title' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteEvidence', () => {
    it('should delete evidence when user is creator', async () => {
      const mockEvidence = {
        id: 'evidence-123',
        createdBy: 'user-123',
      };
      evidenceSchema.getEvidence.mockResolvedValue(mockEvidence as any);
      evidenceSchema.delete.mockResolvedValue(undefined);

      await service.deleteEvidence('evidence-123', 'user-123');

      expect(evidenceSchema.delete).toHaveBeenCalledWith('evidence-123');
    });

    it('should throw BadRequestException when user is not creator', async () => {
      const mockEvidence = {
        id: 'evidence-123',
        createdBy: 'user-123',
      };
      evidenceSchema.getEvidence.mockResolvedValue(mockEvidence as any);

      await expect(
        service.deleteEvidence('evidence-123', 'different-user'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.deleteEvidence('evidence-123', 'different-user'),
      ).rejects.toThrow('Only the creator can delete this evidence');
    });

    it('should throw NotFoundException when evidence does not exist', async () => {
      evidenceSchema.getEvidence.mockResolvedValue(null);

      await expect(
        service.deleteEvidence('nonexistent-id', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

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

    it('should propagate BadRequestException from schema', async () => {
      evidenceSchema.submitPeerReview.mockRejectedValue(
        new BadRequestException('Evidence must pass inclusion threshold'),
      );

      await expect(service.submitPeerReview(validReviewData)).rejects.toThrow(
        BadRequestException,
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
  });

  describe('isPeerReviewAllowed', () => {
    it('should check if peer review is allowed', async () => {
      evidenceSchema.isPeerReviewAllowed.mockResolvedValue(true);

      const result = await service.isPeerReviewAllowed('evidence-123');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      evidenceSchema.isPeerReviewAllowed.mockRejectedValue(new Error('Failed'));

      const result = await service.isPeerReviewAllowed('evidence-123');

      expect(result).toBe(false);
    });
  });

  describe('getEvidenceForNode', () => {
    it('should get evidence for parent node', async () => {
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

    it('should throw BadRequestException when parentNodeId is empty', async () => {
      await expect(
        service.getEvidenceForNode('', 'StatementNode'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTopRatedEvidence', () => {
    it('should get top rated evidence', async () => {
      const mockEvidence = [
        { id: 'evidence-1', overallScore: 4.8 },
        { id: 'evidence-2', overallScore: 4.5 },
      ];
      evidenceSchema.getTopRatedEvidence.mockResolvedValue(mockEvidence as any);

      const result = await service.getTopRatedEvidence({ limit: 10 });

      expect(evidenceSchema.getTopRatedEvidence).toHaveBeenCalledWith(
        10,
        undefined,
      );
      expect(result).toEqual(mockEvidence);
    });

    it('should filter by evidence type', async () => {
      const mockEvidence = [
        { id: 'evidence-1', evidenceType: 'academic_paper' },
      ];
      evidenceSchema.getTopRatedEvidence.mockResolvedValue(mockEvidence as any);

      await service.getTopRatedEvidence({
        limit: 5,
        evidenceType: 'academic_paper',
      });

      expect(evidenceSchema.getTopRatedEvidence).toHaveBeenCalledWith(
        5,
        'academic_paper',
      );
    });
  });

  describe('searchEvidence', () => {
    it('should search evidence with filters', async () => {
      const mockEvidence = [{ id: 'evidence-1' }, { id: 'evidence-2' }];
      evidenceSchema.getAllEvidence.mockResolvedValue(mockEvidence as any);

      const result = await service.searchEvidence({
        evidenceType: 'academic_paper',
        minOverallScore: 4.0,
        limit: 10,
        offset: 0,
      });

      expect(evidenceSchema.getAllEvidence).toHaveBeenCalledWith({
        evidenceType: 'academic_paper',
        minReviewCount: 1,
        includeUnapproved: false,
        limit: 10,
        offset: 0,
      });
      expect(result).toEqual(mockEvidence);
    });
  });

  describe('getEvidenceCategories', () => {
    it('should get evidence categories', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Science' },
        { id: 'cat-2', name: 'Climate' },
      ];
      evidenceSchema.getCategories.mockResolvedValue(mockCategories as any);

      const result = await service.getEvidenceCategories('evidence-123');

      expect(evidenceSchema.getCategories).toHaveBeenCalledWith('evidence-123');
      expect(result).toEqual(mockCategories);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(service.getEvidenceCategories('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('discoverRelatedEvidence', () => {
    it('should return empty array with category ids', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Science' },
        { id: 'cat-2', name: 'Climate' },
      ];
      evidenceSchema.getCategories.mockResolvedValue(mockCategories as any);

      const result = await service.discoverRelatedEvidence('evidence-123');

      expect(result).toEqual({
        evidence: [],
        totalOverlap: 0,
        categoryIds: ['cat-1', 'cat-2'],
      });
    });

    it('should return empty when no categories', async () => {
      evidenceSchema.getCategories.mockResolvedValue([]);

      const result = await service.discoverRelatedEvidence('evidence-123');

      expect(result).toEqual({
        evidence: [],
        totalOverlap: 0,
      });
    });
  });

  describe('getEvidenceComments', () => {
    it('should get evidence comments', async () => {
      const mockEvidence = {
        id: 'evidence-123',
        discussionId: 'discussion-456',
      };
      evidenceSchema.getEvidence.mockResolvedValue(mockEvidence as any);

      const mockComments = [{ id: 'comment-1', commentText: 'Great study' }];
      commentService.getCommentsByDiscussionId.mockResolvedValue(
        mockComments as any,
      );

      const result = await service.getEvidenceComments('evidence-123');

      expect(commentService.getCommentsByDiscussionId).toHaveBeenCalledWith(
        'discussion-456',
      );
      expect(result).toEqual({ comments: mockComments });
    });

    it('should return empty array when no discussion', async () => {
      const mockEvidence = {
        id: 'evidence-123',
        discussionId: null,
      };
      evidenceSchema.getEvidence.mockResolvedValue(mockEvidence as any);

      const result = await service.getEvidenceComments('evidence-123');

      expect(result).toEqual({ comments: [] });
    });
  });

  describe('addEvidenceComment', () => {
    it('should add comment to evidence', async () => {
      const mockEvidence = {
        id: 'evidence-123',
        discussionId: 'discussion-456',
      };
      evidenceSchema.getEvidence.mockResolvedValue(mockEvidence as any);

      const mockComment = {
        id: 'comment-123',
        commentText: 'Great study',
      };
      commentService.createComment.mockResolvedValue(mockComment as any);

      const result = await service.addEvidenceComment(
        'evidence-123',
        { commentText: 'Great study' },
        'user-456',
      );

      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: 'user-456',
        discussionId: 'discussion-456',
        commentText: 'Great study',
        parentCommentId: undefined,
      });
      expect(result).toEqual(mockComment);
    });

    it('should throw error when discussion is missing', async () => {
      const mockEvidence = {
        id: 'evidence-123',
        discussionId: null,
      };
      evidenceSchema.getEvidence.mockResolvedValue(mockEvidence as any);

      await expect(
        service.addEvidenceComment(
          'evidence-123',
          { commentText: 'Comment' },
          'user-456',
        ),
      ).rejects.toThrow('Evidence evidence-123 is missing its discussion');
    });
  });

  describe('isEvidenceApproved', () => {
    it('should return true when evidence has passed inclusion', async () => {
      const mockEvidence = {
        id: 'evidence-123',
        inclusionNetVotes: 5,
      };
      evidenceSchema.getEvidence.mockResolvedValue(mockEvidence as any);

      const result = await service.isEvidenceApproved('evidence-123');

      expect(result).toBe(true);
    });

    it('should return false when evidence has not passed inclusion', async () => {
      const mockEvidence = {
        id: 'evidence-123',
        inclusionNetVotes: -1,
      };
      evidenceSchema.getEvidence.mockResolvedValue(mockEvidence as any);

      const result = await service.isEvidenceApproved('evidence-123');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      evidenceSchema.getEvidence.mockRejectedValue(new Error('Failed'));

      const result = await service.isEvidenceApproved('evidence-123');

      expect(result).toBe(false);
    });
  });

  describe('getEvidenceVotes', () => {
    it('should get evidence votes', async () => {
      const mockVotes = {
        inclusionPositiveVotes: 10,
        inclusionNegativeVotes: 2,
        inclusionNetVotes: 8,
      };
      evidenceSchema.getVotes.mockResolvedValue(mockVotes as any);

      const result = await service.getEvidenceVotes('evidence-123');

      expect(evidenceSchema.getVotes).toHaveBeenCalledWith('evidence-123');
      expect(result).toEqual(mockVotes);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(service.getEvidenceVotes('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('checkEvidenceStats', () => {
    it('should get evidence statistics', async () => {
      const mockStats = {
        count: 150,
        byType: {
          academic_paper: 50,
          news_article: 30,
          government_report: 20,
          dataset: 15,
          book: 10,
          website: 25,
        },
        withReviews: 100,
        wellReviewed: 75,
      };

      evidenceSchema.checkEvidence.mockResolvedValue(mockStats);

      const result = await service.checkEvidenceStats();

      expect(evidenceSchema.checkEvidence).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });

    it('should throw InternalServerErrorException on error', async () => {
      evidenceSchema.checkEvidence.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.checkEvidenceStats()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
