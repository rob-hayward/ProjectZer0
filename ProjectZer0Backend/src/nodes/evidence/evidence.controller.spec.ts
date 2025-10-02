// src/nodes/evidence/evidence.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('EvidenceController', () => {
  let controller: EvidenceController;
  let service: jest.Mocked<EvidenceService>;

  const mockEvidenceService = {
    createEvidence: jest.fn(),
    getEvidence: jest.fn(),
    updateEvidence: jest.fn(),
    deleteEvidence: jest.fn(),
    submitPeerReview: jest.fn(),
    getPeerReviewStats: jest.fn(),
    getUserPeerReview: jest.fn(),
    isPeerReviewAllowed: jest.fn(),
    getEvidenceForNode: jest.fn(),
    getTopRatedEvidence: jest.fn(),
    searchEvidence: jest.fn(),
    getEvidenceCategories: jest.fn(),
    discoverRelatedEvidence: jest.fn(),
    getEvidenceWithDiscussion: jest.fn(),
    getEvidenceComments: jest.fn(),
    addEvidenceComment: jest.fn(),
    isEvidenceApproved: jest.fn(),
    getEvidenceVotes: jest.fn(),
    checkEvidenceStats: jest.fn(),
  };

  const mockRequest = {
    user: {
      sub: 'user-123',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceController],
      providers: [
        {
          provide: EvidenceService,
          useValue: mockEvidenceService,
        },
      ],
    }).compile();

    controller = module.get<EvidenceController>(EvidenceController);
    service = module.get(EvidenceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createEvidence', () => {
    const validEvidenceDto = {
      title: 'Climate Study 2024',
      url: 'https://journal.org/study',
      evidenceType: 'academic_paper' as const,
      parentNodeId: 'statement-123',
      parentNodeType: 'StatementNode' as const,
      authors: ['Smith, J.'],
      publicationDate: '2024-01-15',
      description: 'Important findings',
      publicCredit: true,
      categoryIds: ['cat-science'],
      userKeywords: ['climate'],
      initialComment: 'Significant research',
    };

    it('should create evidence', async () => {
      const mockCreatedEvidence = {
        id: 'evidence-123',
        ...validEvidenceDto,
      };
      service.createEvidence.mockResolvedValue(mockCreatedEvidence as any);

      const result = await controller.createEvidence(
        validEvidenceDto,
        mockRequest,
      );

      expect(service.createEvidence).toHaveBeenCalledWith({
        ...validEvidenceDto,
        publicationDate: new Date('2024-01-15'),
        createdBy: 'user-123',
      });
      expect(result).toEqual(mockCreatedEvidence);
    });

    it('should throw BadRequestException for missing required fields', async () => {
      await expect(
        controller.createEvidence(
          { ...validEvidenceDto, title: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createEvidence(
          { ...validEvidenceDto, url: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createEvidence(
          { ...validEvidenceDto, parentNodeId: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createEvidence(
          { ...validEvidenceDto, parentNodeType: undefined as any },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createEvidence(
          { ...validEvidenceDto, evidenceType: undefined as any },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createEvidence(
          { ...validEvidenceDto, publicCredit: undefined as any },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid publication date', async () => {
      await expect(
        controller.createEvidence(
          { ...validEvidenceDto, publicationDate: 'invalid-date' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle service errors', async () => {
      service.createEvidence.mockRejectedValue(
        new BadRequestException('Parent node not found'),
      );

      await expect(
        controller.createEvidence(validEvidenceDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getEvidence', () => {
    it('should get evidence by id', async () => {
      const mockEvidence = {
        id: 'evidence-123',
        title: 'Climate Study',
      };
      service.getEvidence.mockResolvedValue(mockEvidence as any);

      const result = await controller.getEvidence('evidence-123');

      expect(service.getEvidence).toHaveBeenCalledWith('evidence-123');
      expect(result).toEqual(mockEvidence);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(controller.getEvidence('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle NotFoundException from service', async () => {
      service.getEvidence.mockRejectedValue(
        new NotFoundException('Evidence not found'),
      );

      await expect(controller.getEvidence('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateEvidence', () => {
    it('should update evidence', async () => {
      const updateDto = {
        title: 'Updated Title',
        description: 'Updated description',
      };
      const mockUpdatedEvidence = {
        id: 'evidence-123',
        ...updateDto,
      };
      service.updateEvidence.mockResolvedValue(mockUpdatedEvidence as any);

      const result = await controller.updateEvidence('evidence-123', updateDto);

      expect(service.updateEvidence).toHaveBeenCalledWith(
        'evidence-123',
        updateDto,
      );
      expect(result).toEqual(mockUpdatedEvidence);
    });

    it('should parse publication date when provided', async () => {
      const updateDto = {
        publicationDate: '2024-02-15',
      };
      service.updateEvidence.mockResolvedValue({ id: 'evidence-123' } as any);

      await controller.updateEvidence('evidence-123', updateDto);

      expect(service.updateEvidence).toHaveBeenCalledWith('evidence-123', {
        publicationDate: new Date('2024-02-15'),
      });
    });

    it('should throw BadRequestException for invalid publication date', async () => {
      await expect(
        controller.updateEvidence('evidence-123', {
          publicationDate: 'invalid-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(
        controller.updateEvidence('', { title: 'New Title' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteEvidence', () => {
    it('should delete evidence', async () => {
      service.deleteEvidence.mockResolvedValue(undefined);

      await controller.deleteEvidence('evidence-123', mockRequest);

      expect(service.deleteEvidence).toHaveBeenCalledWith(
        'evidence-123',
        'user-123',
      );
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(controller.deleteEvidence('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle BadRequestException from service', async () => {
      service.deleteEvidence.mockRejectedValue(
        new BadRequestException('Only creator can delete'),
      );

      await expect(
        controller.deleteEvidence('evidence-123', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitPeerReview', () => {
    const validReviewDto = {
      qualityScore: 5,
      independenceScore: 4,
      relevanceScore: 5,
      comments: 'Excellent',
    };

    it('should submit peer review', async () => {
      const mockReview = {
        id: 'review-123',
        evidenceId: 'evidence-123',
        userId: 'user-123',
        ...validReviewDto,
      };
      service.submitPeerReview.mockResolvedValue(mockReview as any);

      const result = await controller.submitPeerReview(
        'evidence-123',
        validReviewDto,
        mockRequest,
      );

      expect(service.submitPeerReview).toHaveBeenCalledWith({
        evidenceId: 'evidence-123',
        userId: 'user-123',
        ...validReviewDto,
      });
      expect(result).toEqual(mockReview);
    });

    it('should validate score ranges', async () => {
      await expect(
        controller.submitPeerReview(
          'evidence-123',
          { ...validReviewDto, qualityScore: 0 },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.submitPeerReview(
          'evidence-123',
          { ...validReviewDto, qualityScore: 6 },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.submitPeerReview(
          'evidence-123',
          { ...validReviewDto, independenceScore: 3.5 },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when evidence id is empty', async () => {
      await expect(
        controller.submitPeerReview('', validReviewDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
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
      };
      service.getPeerReviewStats.mockResolvedValue(mockStats as any);

      const result = await controller.getPeerReviewStats('evidence-123');

      expect(service.getPeerReviewStats).toHaveBeenCalledWith('evidence-123');
      expect(result).toEqual(mockStats);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(controller.getPeerReviewStats('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMyPeerReview', () => {
    it('should get user peer review', async () => {
      const mockReview = {
        id: 'review-123',
        qualityScore: 5,
      };
      service.getUserPeerReview.mockResolvedValue(mockReview as any);

      const result = await controller.getMyPeerReview(
        'evidence-123',
        mockRequest,
      );

      expect(service.getUserPeerReview).toHaveBeenCalledWith(
        'evidence-123',
        'user-123',
      );
      expect(result).toEqual(mockReview);
    });

    it('should return hasReviewed false when no review', async () => {
      service.getUserPeerReview.mockResolvedValue(null);

      const result = await controller.getMyPeerReview(
        'evidence-123',
        mockRequest,
      );

      expect(result).toEqual({ hasReviewed: false });
    });
  });

  describe('isPeerReviewAllowed', () => {
    it('should check if peer review is allowed', async () => {
      service.isPeerReviewAllowed.mockResolvedValue(true);

      const result = await controller.isPeerReviewAllowed('evidence-123');

      expect(result).toEqual({ allowed: true });
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(controller.isPeerReviewAllowed('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('voteInclusion', () => {
    it('should record inclusion vote', async () => {
      const result = await controller.voteInclusion('evidence-123', {
        isPositive: true,
      });

      expect(result).toEqual({
        success: true,
        message: 'Inclusion vote recorded',
        status: 'agree',
      });
    });

    it('should handle negative vote', async () => {
      const result = await controller.voteInclusion('evidence-123', {
        isPositive: false,
      });

      expect(result.status).toBe('disagree');
    });

    it('should throw BadRequestException for missing vote value', async () => {
      await expect(
        controller.voteInclusion('evidence-123', {
          isPositive: undefined as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getEvidenceForParent', () => {
    it('should get evidence for parent node', async () => {
      const mockEvidence = [{ id: 'evidence-1' }, { id: 'evidence-2' }];
      service.getEvidenceForNode.mockResolvedValue(mockEvidence as any);

      const result = await controller.getEvidenceForParent(
        'statement-123',
        'StatementNode',
      );

      expect(service.getEvidenceForNode).toHaveBeenCalledWith(
        'statement-123',
        'StatementNode',
      );
      expect(result).toEqual({ evidence: mockEvidence, count: 2 });
    });

    it('should validate parent node type', async () => {
      await expect(
        controller.getEvidenceForParent('statement-123', 'InvalidType'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing parent node type', async () => {
      await expect(
        controller.getEvidenceForParent('statement-123', undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTopRatedEvidence', () => {
    it('should get top rated evidence', async () => {
      const mockEvidence = [{ id: 'evidence-1' }];
      service.getTopRatedEvidence.mockResolvedValue(mockEvidence as any);

      const result = await controller.getTopRatedEvidence(10, 'academic_paper');

      expect(service.getTopRatedEvidence).toHaveBeenCalledWith({
        limit: 10,
        evidenceType: 'academic_paper',
      });
      expect(result).toEqual({ evidence: mockEvidence, count: 1 });
    });

    it('should use default limit when not provided', async () => {
      service.getTopRatedEvidence.mockResolvedValue([]);

      await controller.getTopRatedEvidence();

      expect(service.getTopRatedEvidence).toHaveBeenCalledWith({
        limit: 20,
        evidenceType: undefined,
      });
    });
  });

  describe('searchEvidence', () => {
    it('should search evidence with filters', async () => {
      const mockEvidence = [{ id: 'evidence-1' }];
      service.searchEvidence.mockResolvedValue(mockEvidence as any);

      const result = await controller.searchEvidence(
        'academic_paper',
        4.0,
        5,
        10,
        0,
      );

      expect(service.searchEvidence).toHaveBeenCalledWith({
        evidenceType: 'academic_paper',
        minOverallScore: 4.0,
        minInclusionVotes: 5,
        limit: 10,
        offset: 0,
      });
      expect(result).toEqual({ evidence: mockEvidence, count: 1 });
    });
  });

  describe('getCategories', () => {
    it('should get evidence categories', async () => {
      const mockCategories = [{ id: 'cat-1', name: 'Science' }];
      service.getEvidenceCategories.mockResolvedValue(mockCategories as any);

      const result = await controller.getCategories('evidence-123');

      expect(service.getEvidenceCategories).toHaveBeenCalledWith(
        'evidence-123',
      );
      expect(result).toEqual({ categories: mockCategories });
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(controller.getCategories('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getRelatedEvidence', () => {
    it('should get related evidence', async () => {
      const mockRelated = { evidence: [], totalOverlap: 0 };
      service.discoverRelatedEvidence.mockResolvedValue(mockRelated);

      const result = await controller.getRelatedEvidence('evidence-123');

      expect(service.discoverRelatedEvidence).toHaveBeenCalledWith(
        'evidence-123',
      );
      expect(result).toEqual(mockRelated);
    });
  });

  describe('getDiscussion', () => {
    it('should get discussion id', async () => {
      const mockEvidence = {
        id: 'evidence-123',
        discussionId: 'discussion-456',
      };
      service.getEvidenceWithDiscussion.mockResolvedValue(mockEvidence as any);

      const result = await controller.getDiscussion('evidence-123');

      expect(result).toEqual({ discussionId: 'discussion-456' });
    });
  });

  describe('getComments', () => {
    it('should get evidence comments', async () => {
      const mockComments = { comments: [{ id: 'comment-1' }] };
      service.getEvidenceComments.mockResolvedValue(mockComments as any);

      const result = await controller.getComments('evidence-123');

      expect(service.getEvidenceComments).toHaveBeenCalledWith('evidence-123');
      expect(result).toEqual(mockComments);
    });
  });

  describe('addComment', () => {
    it('should add comment to evidence', async () => {
      const mockComment = { id: 'comment-123', commentText: 'Great study' };
      service.addEvidenceComment.mockResolvedValue(mockComment as any);

      const result = await controller.addComment(
        'evidence-123',
        { commentText: 'Great study' },
        mockRequest,
      );

      expect(service.addEvidenceComment).toHaveBeenCalledWith(
        'evidence-123',
        { commentText: 'Great study' },
        'user-123',
      );
      expect(result).toEqual(mockComment);
    });

    it('should throw BadRequestException for empty comment', async () => {
      await expect(
        controller.addComment('evidence-123', { commentText: '' }, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('isApproved', () => {
    it('should check if evidence is approved', async () => {
      service.isEvidenceApproved.mockResolvedValue(true);

      const result = await controller.isApproved('evidence-123');

      expect(result).toEqual({ approved: true });
    });
  });

  describe('getStats', () => {
    it('should get evidence statistics', async () => {
      const mockStats = {
        count: 150,
        byType: {
          academic_paper: 50,
          news_article: 30,
        },
        withReviews: 100,
        wellReviewed: 75,
      };
      service.checkEvidenceStats.mockResolvedValue(mockStats);

      const result = await controller.getStats();

      expect(result).toEqual(mockStats);
    });
  });
});
