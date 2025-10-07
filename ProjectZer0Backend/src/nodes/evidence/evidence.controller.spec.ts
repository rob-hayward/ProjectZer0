// src/nodes/evidence/evidence.controller.spec.ts - COMPREHENSIVE TEST SUITE

import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('EvidenceController - Comprehensive Tests', () => {
  let controller: EvidenceController;
  let evidenceService: jest.Mocked<EvidenceService>;

  const mockEvidenceService = {
    createEvidence: jest.fn(),
    getEvidence: jest.fn(),
    updateEvidence: jest.fn(),
    deleteEvidence: jest.fn(),
    voteInclusion: jest.fn(),
    getVoteStatus: jest.fn(),
    removeVote: jest.fn(),
    getVotes: jest.fn(),
    submitPeerReview: jest.fn(),
    getPeerReviewStats: jest.fn(),
    getUserPeerReview: jest.fn(),
    isPeerReviewAllowed: jest.fn(),
    getEvidenceForNode: jest.fn(),
    isEvidenceApproved: jest.fn(),
  };

  const mockRequest = {
    user: {
      sub: 'user-123',
      username: 'testuser',
    },
  };

  const mockRequestWithoutUser = {
    user: null,
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
    evidenceService = module.get(EvidenceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================
  // CREATE EVIDENCE TESTS
  // ============================================
  describe('createEvidence', () => {
    const validCreateDto = {
      title: 'Climate Study 2024',
      url: 'https://journal.org/study',
      evidenceType: 'academic_paper' as const,
      parentNodeId: 'statement-123',
      parentNodeType: 'StatementNode' as const,
      authors: ['Smith, J.', 'Doe, A.'],
      publicationDate: '2024-01-15',
      description: 'Important climate findings',
      publicCredit: true,
      categoryIds: ['cat-science'],
      userKeywords: ['climate', 'environment'],
      initialComment: 'Significant research',
    };

    it('should create evidence with valid data', async () => {
      const mockCreatedEvidence = {
        id: 'evidence-123',
        createdBy: 'user-123',
        ...validCreateDto,
        publicationDate: new Date('2024-01-15'),
      };

      evidenceService.createEvidence.mockResolvedValue(
        mockCreatedEvidence as any,
      );

      const result = await controller.createEvidence(
        validCreateDto,
        mockRequest,
      );

      expect(evidenceService.createEvidence).toHaveBeenCalledWith({
        ...validCreateDto,
        publicationDate: new Date('2024-01-15'),
        createdBy: 'user-123',
      });
      expect(result).toEqual(mockCreatedEvidence);
    });

    it('should create evidence without optional fields', async () => {
      const minimalDto = {
        title: 'Study',
        url: 'https://example.com',
        evidenceType: 'website' as const,
        parentNodeId: 'statement-123',
        parentNodeType: 'StatementNode' as const,
        publicCredit: true,
      };

      const mockCreatedEvidence = {
        id: 'evidence-124',
        createdBy: 'user-123',
        ...minimalDto,
      };

      evidenceService.createEvidence.mockResolvedValue(
        mockCreatedEvidence as any,
      );

      const result = await controller.createEvidence(minimalDto, mockRequest);

      expect(evidenceService.createEvidence).toHaveBeenCalledWith({
        ...minimalDto,
        publicationDate: undefined,
        createdBy: 'user-123',
      });
      expect(result).toEqual(mockCreatedEvidence);
    });

    it('should throw BadRequestException when title is empty', async () => {
      await expect(
        controller.createEvidence(
          { ...validCreateDto, title: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when url is empty', async () => {
      await expect(
        controller.createEvidence({ ...validCreateDto, url: '' }, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when parentNodeId is empty', async () => {
      await expect(
        controller.createEvidence(
          { ...validCreateDto, parentNodeId: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when parentNodeType is missing', async () => {
      await expect(
        controller.createEvidence(
          { ...validCreateDto, parentNodeType: undefined as any },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when evidenceType is missing', async () => {
      await expect(
        controller.createEvidence(
          { ...validCreateDto, evidenceType: undefined as any },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when publicCredit is not boolean', async () => {
      await expect(
        controller.createEvidence(
          { ...validCreateDto, publicCredit: 'yes' as any },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when categoryIds exceed maximum', async () => {
      await expect(
        controller.createEvidence(
          {
            ...validCreateDto,
            categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'],
          },
          mockRequest,
        ),
      ).rejects.toThrow('Maximum 3 categories allowed');
    });

    it('should throw BadRequestException for invalid publication date', async () => {
      await expect(
        controller.createEvidence(
          { ...validCreateDto, publicationDate: 'invalid-date' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.createEvidence(validCreateDto, mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');
    });

    it('should propagate service errors', async () => {
      evidenceService.createEvidence.mockRejectedValue(
        new BadRequestException('Parent node not found'),
      );

      await expect(
        controller.createEvidence(validCreateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // GET EVIDENCE TESTS
  // ============================================
  describe('getEvidence', () => {
    it('should retrieve evidence by ID', async () => {
      const mockEvidence = {
        id: 'test-id',
        title: 'Climate Study',
        url: 'https://example.com',
      };

      evidenceService.getEvidence.mockResolvedValue(mockEvidence as any);

      const result = await controller.getEvidence('test-id');

      expect(evidenceService.getEvidence).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockEvidence);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getEvidence('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when evidence not found', async () => {
      evidenceService.getEvidence.mockResolvedValue(null);

      await expect(controller.getEvidence('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate service errors', async () => {
      evidenceService.getEvidence.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getEvidence('test-id')).rejects.toThrow();
    });
  });

  // ============================================
  // UPDATE EVIDENCE TESTS
  // ============================================
  describe('updateEvidence', () => {
    const validUpdateDto = {
      title: 'Updated Title',
      description: 'Updated description',
      userKeywords: ['updated', 'keywords'],
      categoryIds: ['cat-1', 'cat-2'],
    };

    it('should update evidence with valid data', async () => {
      const mockUpdatedEvidence = {
        id: 'test-id',
        ...validUpdateDto,
      };

      evidenceService.updateEvidence.mockResolvedValue(
        mockUpdatedEvidence as any,
      );

      const result = await controller.updateEvidence(
        'test-id',
        validUpdateDto,
        mockRequest,
      );

      expect(evidenceService.updateEvidence).toHaveBeenCalledWith(
        'test-id',
        validUpdateDto,
      );
      expect(result).toEqual(mockUpdatedEvidence);
    });

    it('should update only specific fields', async () => {
      const updateDto = { title: 'New Title' };
      const mockUpdatedEvidence = { id: 'test-id', title: 'New Title' };

      evidenceService.updateEvidence.mockResolvedValue(
        mockUpdatedEvidence as any,
      );

      const result = await controller.updateEvidence(
        'test-id',
        updateDto,
        mockRequest,
      );

      expect(evidenceService.updateEvidence).toHaveBeenCalledWith(
        'test-id',
        updateDto,
      );
      expect(result).toEqual(mockUpdatedEvidence);
    });

    it('should parse publication date when provided', async () => {
      const updateDto = { publicationDate: '2024-02-15' };

      evidenceService.updateEvidence.mockResolvedValue({
        id: 'test-id',
      } as any);

      await controller.updateEvidence('test-id', updateDto, mockRequest);

      expect(evidenceService.updateEvidence).toHaveBeenCalledWith('test-id', {
        publicationDate: new Date('2024-02-15'),
      });
    });

    it('should throw BadRequestException for invalid publication date', async () => {
      await expect(
        controller.updateEvidence(
          'test-id',
          { publicationDate: 'invalid-date' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.updateEvidence('', validUpdateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no update data provided', async () => {
      await expect(
        controller.updateEvidence('test-id', {}, mockRequest),
      ).rejects.toThrow('No update data provided');
    });

    it('should throw BadRequestException when categoryIds exceed maximum', async () => {
      await expect(
        controller.updateEvidence(
          'test-id',
          { categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'] },
          mockRequest,
        ),
      ).rejects.toThrow('Maximum 3 categories allowed');
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.updateEvidence(
          'test-id',
          validUpdateDto,
          mockRequestWithoutUser,
        ),
      ).rejects.toThrow('User ID is required');
    });

    it('should propagate service errors', async () => {
      evidenceService.updateEvidence.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(
        controller.updateEvidence('test-id', validUpdateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // DELETE EVIDENCE TESTS
  // ============================================
  describe('deleteEvidence', () => {
    it('should delete evidence successfully', async () => {
      evidenceService.deleteEvidence.mockResolvedValue(undefined);

      await controller.deleteEvidence('test-id', mockRequest);

      expect(evidenceService.deleteEvidence).toHaveBeenCalledWith(
        'test-id',
        'user-123',
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.deleteEvidence('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.deleteEvidence('test-id', mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');
    });

    it('should propagate NotFoundException from service', async () => {
      evidenceService.deleteEvidence.mockRejectedValue(
        new NotFoundException('Evidence not found'),
      );

      await expect(
        controller.deleteEvidence('test-id', mockRequest),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException from service', async () => {
      evidenceService.deleteEvidence.mockRejectedValue(
        new BadRequestException('Only creator can delete'),
      );

      await expect(
        controller.deleteEvidence('test-id', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // VOTING TESTS - INCLUSION ONLY
  // ============================================
  describe('Voting Endpoints', () => {
    const voteDto = { isPositive: true };
    const mockVoteResult = {
      inclusionPositiveVotes: 5,
      inclusionNegativeVotes: 2,
      inclusionNetVotes: 3,
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
    };

    describe('voteInclusion', () => {
      it('should vote positively on evidence inclusion', async () => {
        evidenceService.voteInclusion.mockResolvedValue(mockVoteResult);

        const result = await controller.voteInclusion(
          'test-id',
          voteDto,
          mockRequest,
        );

        expect(evidenceService.voteInclusion).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          true,
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should vote negatively on evidence inclusion', async () => {
        const negativeVoteDto = { isPositive: false };
        evidenceService.voteInclusion.mockResolvedValue(mockVoteResult);

        await controller.voteInclusion('test-id', negativeVoteDto, mockRequest);

        expect(evidenceService.voteInclusion).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          false,
        );
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(
          controller.voteInclusion('', voteDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.voteInclusion('test-id', voteDto, mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });

      it('should throw BadRequestException for non-boolean isPositive', async () => {
        await expect(
          controller.voteInclusion(
            'test-id',
            { isPositive: 'yes' as any },
            mockRequest,
          ),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getVoteStatus', () => {
      const mockVoteStatus = {
        inclusionStatus: 'agree' as const,
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 2,
        inclusionNetVotes: 3,
        contentStatus: null,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      it('should get vote status for authenticated user', async () => {
        evidenceService.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await controller.getVoteStatus('test-id', mockRequest);

        expect(evidenceService.getVoteStatus).toHaveBeenCalledWith(
          'test-id',
          'user-123',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when user has not voted', async () => {
        evidenceService.getVoteStatus.mockResolvedValue(null);

        const result = await controller.getVoteStatus('test-id', mockRequest);

        expect(result).toBeNull();
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.getVoteStatus('', mockRequest)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.getVoteStatus('test-id', mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });
    });

    describe('removeVote', () => {
      it('should remove an inclusion vote', async () => {
        evidenceService.removeVote.mockResolvedValue(mockVoteResult);

        const result = await controller.removeVote('test-id', mockRequest);

        expect(evidenceService.removeVote).toHaveBeenCalledWith(
          'test-id',
          'user-123',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.removeVote('', mockRequest)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.removeVote('test-id', mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });
    });

    describe('getVotes', () => {
      it('should get vote totals for evidence', async () => {
        evidenceService.getVotes.mockResolvedValue(mockVoteResult);

        const result = await controller.getVotes('test-id');

        expect(evidenceService.getVotes).toHaveBeenCalledWith('test-id');
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.getVotes('')).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  // ============================================
  // PEER REVIEW TESTS
  // ============================================
  describe('Peer Review Endpoints', () => {
    describe('submitPeerReview', () => {
      const validReviewDto = {
        qualityScore: 5,
        independenceScore: 4,
        relevanceScore: 5,
        comments: 'Excellent methodology',
      };

      it('should submit peer review successfully', async () => {
        const mockReview = {
          id: 'review-123',
          evidenceId: 'evidence-123',
          userId: 'user-123',
          ...validReviewDto,
          createdAt: new Date(),
        };

        evidenceService.submitPeerReview.mockResolvedValue(mockReview as any);

        const result = await controller.submitPeerReview(
          'evidence-123',
          validReviewDto,
          mockRequest,
        );

        expect(evidenceService.submitPeerReview).toHaveBeenCalledWith({
          evidenceId: 'evidence-123',
          userId: 'user-123',
          ...validReviewDto,
        });
        expect(result).toEqual(mockReview);
      });

      it('should validate quality score range', async () => {
        await expect(
          controller.submitPeerReview(
            'evidence-123',
            { ...validReviewDto, qualityScore: 0 },
            mockRequest,
          ),
        ).rejects.toThrow('Quality score must be an integer between 1 and 5');

        await expect(
          controller.submitPeerReview(
            'evidence-123',
            { ...validReviewDto, qualityScore: 6 },
            mockRequest,
          ),
        ).rejects.toThrow('Quality score must be an integer between 1 and 5');

        await expect(
          controller.submitPeerReview(
            'evidence-123',
            { ...validReviewDto, qualityScore: 3.5 },
            mockRequest,
          ),
        ).rejects.toThrow('Quality score must be an integer between 1 and 5');
      });

      it('should validate independence score range', async () => {
        await expect(
          controller.submitPeerReview(
            'evidence-123',
            { ...validReviewDto, independenceScore: 0 },
            mockRequest,
          ),
        ).rejects.toThrow(
          'Independence score must be an integer between 1 and 5',
        );

        await expect(
          controller.submitPeerReview(
            'evidence-123',
            { ...validReviewDto, independenceScore: 6 },
            mockRequest,
          ),
        ).rejects.toThrow(
          'Independence score must be an integer between 1 and 5',
        );
      });

      it('should validate relevance score range', async () => {
        await expect(
          controller.submitPeerReview(
            'evidence-123',
            { ...validReviewDto, relevanceScore: 0 },
            mockRequest,
          ),
        ).rejects.toThrow('Relevance score must be an integer between 1 and 5');

        await expect(
          controller.submitPeerReview(
            'evidence-123',
            { ...validReviewDto, relevanceScore: 6 },
            mockRequest,
          ),
        ).rejects.toThrow('Relevance score must be an integer between 1 and 5');
      });

      it('should throw BadRequestException for empty evidence ID', async () => {
        await expect(
          controller.submitPeerReview('', validReviewDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.submitPeerReview(
            'evidence-123',
            validReviewDto,
            mockRequestWithoutUser,
          ),
        ).rejects.toThrow('User ID is required');
      });

      it('should propagate service errors', async () => {
        evidenceService.submitPeerReview.mockRejectedValue(
          new BadRequestException('Evidence not approved'),
        );

        await expect(
          controller.submitPeerReview(
            'evidence-123',
            validReviewDto,
            mockRequest,
          ),
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
          scoreDistribution: {
            quality: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 2 },
            independence: { 1: 0, 2: 1, 3: 1, 4: 2, 5: 1 },
            relevance: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 3 },
          },
        };

        evidenceService.getPeerReviewStats.mockResolvedValue(mockStats as any);

        const result = await controller.getPeerReviewStats('evidence-123');

        expect(evidenceService.getPeerReviewStats).toHaveBeenCalledWith(
          'evidence-123',
        );
        expect(result).toEqual(mockStats);
      });

      it('should throw BadRequestException for empty ID', async () => {
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
          independenceScore: 4,
          relevanceScore: 5,
        };

        evidenceService.getUserPeerReview.mockResolvedValue(mockReview as any);

        const result = await controller.getMyPeerReview(
          'evidence-123',
          mockRequest,
        );

        expect(evidenceService.getUserPeerReview).toHaveBeenCalledWith(
          'evidence-123',
          'user-123',
        );
        expect(result).toEqual(mockReview);
      });

      it('should return hasReviewed false when no review exists', async () => {
        evidenceService.getUserPeerReview.mockResolvedValue(null);

        const result = await controller.getMyPeerReview(
          'evidence-123',
          mockRequest,
        );

        expect(result).toEqual({ hasReviewed: false });
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(
          controller.getMyPeerReview('', mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.getMyPeerReview('evidence-123', mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });
    });

    describe('isPeerReviewAllowed', () => {
      it('should check if peer review is allowed', async () => {
        evidenceService.isPeerReviewAllowed.mockResolvedValue(true);

        const result = await controller.isPeerReviewAllowed('evidence-123');

        expect(evidenceService.isPeerReviewAllowed).toHaveBeenCalledWith(
          'evidence-123',
        );
        expect(result).toEqual({ allowed: true });
      });

      it('should return false when peer review is not allowed', async () => {
        evidenceService.isPeerReviewAllowed.mockResolvedValue(false);

        const result = await controller.isPeerReviewAllowed('evidence-123');

        expect(result).toEqual({ allowed: false });
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.isPeerReviewAllowed('')).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  // ============================================
  // UTILITY ENDPOINTS TESTS
  // ============================================
  describe('Utility Endpoints', () => {
    describe('isEvidenceApproved', () => {
      it('should return true when evidence is approved', async () => {
        evidenceService.isEvidenceApproved.mockResolvedValue(true);

        const result = await controller.isEvidenceApproved('test-id');

        expect(evidenceService.isEvidenceApproved).toHaveBeenCalledWith(
          'test-id',
        );
        expect(result).toEqual({ approved: true });
      });

      it('should return false when evidence is not approved', async () => {
        evidenceService.isEvidenceApproved.mockResolvedValue(false);

        const result = await controller.isEvidenceApproved('test-id');

        expect(result).toEqual({ approved: false });
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.isEvidenceApproved('')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('getEvidenceForParent', () => {
      it('should get evidence for a parent node', async () => {
        const mockEvidence = [
          { id: 'evidence-1', title: 'Study 1' },
          { id: 'evidence-2', title: 'Study 2' },
        ];

        evidenceService.getEvidenceForNode.mockResolvedValue(
          mockEvidence as any,
        );

        const result = await controller.getEvidenceForParent(
          'statement-123',
          'StatementNode',
        );

        expect(evidenceService.getEvidenceForNode).toHaveBeenCalledWith(
          'statement-123',
          'StatementNode',
        );
        expect(result).toEqual({
          evidence: mockEvidence,
          count: 2,
        });
      });

      it('should throw BadRequestException for empty parent node ID', async () => {
        await expect(
          controller.getEvidenceForParent('', 'StatementNode'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for missing parent node type', async () => {
        await expect(
          controller.getEvidenceForParent('statement-123', undefined),
        ).rejects.toThrow('Parent node type is required');
      });

      it('should throw BadRequestException for invalid parent node type', async () => {
        await expect(
          controller.getEvidenceForParent('statement-123', 'InvalidNode'),
        ).rejects.toThrow(
          'Parent node type must be StatementNode, AnswerNode, or QuantityNode',
        );
      });

      it('should accept AnswerNode as parent type', async () => {
        evidenceService.getEvidenceForNode.mockResolvedValue([]);

        await controller.getEvidenceForParent('answer-123', 'AnswerNode');

        expect(evidenceService.getEvidenceForNode).toHaveBeenCalledWith(
          'answer-123',
          'AnswerNode',
        );
      });

      it('should accept QuantityNode as parent type', async () => {
        evidenceService.getEvidenceForNode.mockResolvedValue([]);

        await controller.getEvidenceForParent('quantity-123', 'QuantityNode');

        expect(evidenceService.getEvidenceForNode).toHaveBeenCalledWith(
          'quantity-123',
          'QuantityNode',
        );
      });
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  describe('Error Handling', () => {
    it('should propagate generic errors from service', async () => {
      evidenceService.getEvidence.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getEvidence('test-id')).rejects.toThrow();
    });

    it('should preserve NotFoundException from service', async () => {
      evidenceService.getEvidence.mockRejectedValue(
        new NotFoundException('Evidence not found'),
      );

      await expect(controller.getEvidence('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve BadRequestException from service', async () => {
      evidenceService.updateEvidence.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(
        controller.updateEvidence('test-id', { title: 'test' }, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate all ID parameters consistently', async () => {
      await expect(controller.getEvidence('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.updateEvidence('', { title: 'test' }, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(controller.deleteEvidence('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.voteInclusion('', { isPositive: true }, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(controller.getVotes('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.submitPeerReview(
          '',
          { qualityScore: 5, independenceScore: 4, relevanceScore: 5 },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(controller.getPeerReviewStats('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getMyPeerReview('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.isPeerReviewAllowed('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.isEvidenceApproved('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate user authentication consistently', async () => {
      const validDto = {
        title: 'Test',
        url: 'https://example.com',
        evidenceType: 'website' as const,
        parentNodeId: 'statement-123',
        parentNodeType: 'StatementNode' as const,
        publicCredit: true,
      };

      await expect(
        controller.createEvidence(validDto, mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');

      await expect(
        controller.updateEvidence(
          'test-id',
          { title: 'test' },
          mockRequestWithoutUser,
        ),
      ).rejects.toThrow('User ID is required');

      await expect(
        controller.deleteEvidence('test-id', mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');

      await expect(
        controller.voteInclusion(
          'test-id',
          { isPositive: true },
          mockRequestWithoutUser,
        ),
      ).rejects.toThrow('User ID is required');

      await expect(
        controller.getVoteStatus('test-id', mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');

      await expect(
        controller.removeVote('test-id', mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');

      await expect(
        controller.submitPeerReview(
          'test-id',
          { qualityScore: 5, independenceScore: 4, relevanceScore: 5 },
          mockRequestWithoutUser,
        ),
      ).rejects.toThrow('User ID is required');

      await expect(
        controller.getMyPeerReview('test-id', mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');
    });
  });
});
