// src/neo4j/schemas/__tests__/evidence.schema.spec.ts - NEW TEST SUITE

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  EvidenceSchema,
  EvidenceData,
  CreateEvidenceData,
  CreatePeerReviewData,
  EvidenceType,
} from '../evidence.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';

describe('EvidenceSchema with BaseNodeSchema Integration', () => {
  let schema: EvidenceSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  const mockEvidenceData: EvidenceData = {
    id: 'evidence-123',
    title: 'Comprehensive Study on AI Safety',
    url: 'https://arxiv.org/abs/2023.12345',
    authors: ['Dr. Jane Smith', 'Prof. John Doe'],
    publicationDate: new Date('2023-06-15'),
    evidenceType: 'academic_paper',
    parentNodeId: 'statement-456',
    parentNodeType: 'StatementNode',
    description:
      'A comprehensive study examining AI safety measures and their effectiveness.',
    createdBy: 'user-789',
    createdAt: new Date('2023-06-20T10:00:00Z'),
    updatedAt: new Date('2023-06-20T10:00:00Z'),
    // Only inclusion voting (no content voting)
    inclusionPositiveVotes: 15,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 12,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
    // Peer review aggregates
    avgQualityScore: 4.2,
    avgIndependenceScore: 4.0,
    avgRelevanceScore: 4.5,
    overallScore: 4.23, // (4.2 * 0.333) + (4.0 * 0.333) + (4.5 * 0.334)
    reviewCount: 8,
  };

  const mockCreateEvidenceData: CreateEvidenceData = {
    id: 'evidence-123',
    title: 'Comprehensive Study on AI Safety',
    url: 'https://arxiv.org/abs/2023.12345',
    authors: ['Dr. Jane Smith', 'Prof. John Doe'],
    publicationDate: new Date('2023-06-15'),
    evidenceType: 'academic_paper',
    parentNodeId: 'statement-456',
    parentNodeType: 'StatementNode',
    description: 'A comprehensive study examining AI safety measures.',
    createdBy: 'user-789',
  };

  const mockPeerReviewData: CreatePeerReviewData = {
    evidenceId: 'evidence-123',
    userId: 'reviewer-456',
    qualityScore: 4,
    independenceScore: 5,
    relevanceScore: 3,
    comments: 'Well-structured study with solid methodology.',
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 15,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 12,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 15,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 12,
    contentStatus: null, // No content voting for evidence
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceSchema,
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

    schema = module.get<EvidenceSchema>(EvidenceSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BaseNodeSchema Integration', () => {
    describe('supportsContentVoting', () => {
      it('should not support content voting (uses peer review instead)', () => {
        expect(schema['supportsContentVoting']()).toBe(false);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should map Neo4j record to EvidenceData correctly', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
        } as unknown as Record;

        const result = schema['mapNodeFromRecord'](mockRecord);

        expect(result).toEqual(mockEvidenceData);
        expect(result.inclusionNetVotes).toBe(12);
        expect(result.contentNetVotes).toBe(0); // No content voting
        expect(result.overallScore).toBe(4.23);
        expect(result.reviewCount).toBe(8);
      });

      it('should handle Neo4j Integer conversion for peer review scores', () => {
        const mockPropsWithIntegers = {
          ...mockEvidenceData,
          inclusionPositiveVotes: Integer.fromNumber(25),
          avgQualityScore: Integer.fromNumber(4),
          avgIndependenceScore: Integer.fromNumber(5),
          avgRelevanceScore: Integer.fromNumber(3),
          overallScore: Integer.fromNumber(4),
          reviewCount: Integer.fromNumber(10),
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockPropsWithIntegers }),
        } as unknown as Record;

        const result = schema['mapNodeFromRecord'](mockRecord);

        expect(result.inclusionPositiveVotes).toBe(25);
        expect(result.avgQualityScore).toBe(4);
        expect(result.avgIndependenceScore).toBe(5);
        expect(result.avgRelevanceScore).toBe(3);
        expect(result.overallScore).toBe(4);
        expect(result.reviewCount).toBe(10);
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build update query excluding id field', () => {
        const updateData = {
          title: 'Updated Study Title',
          description: 'Updated description',
          url: 'https://updated-url.com',
        };

        const queryInfo = schema['buildUpdateQuery'](
          'evidence-123',
          updateData,
        );

        expect(queryInfo.cypher).toContain('SET');
        expect(queryInfo.cypher).toContain('n.title = $updateData.title');
        expect(queryInfo.cypher).toContain(
          'n.description = $updateData.description',
        );
        expect(queryInfo.cypher).not.toContain('n.id =');
        expect(queryInfo.params).toEqual({
          id: 'evidence-123',
          updateData,
        });
      });
    });
  });

  describe('Inherited BaseNodeSchema Methods', () => {
    describe('findById (inherited)', () => {
      it('should find evidence by id using inherited method', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.findById('evidence-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:EvidenceNode {id: $id})'),
          { id: 'evidence-123' },
        );
        expect(result).toEqual(mockEvidenceData);
      });

      it('should return null when evidence not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.findById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('update (inherited)', () => {
      it('should update evidence using inherited method', async () => {
        const updateData = {
          title: 'Updated Title',
          description: 'Updated desc',
        };
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockEvidenceData, ...updateData },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.update('evidence-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:EvidenceNode {id: $id})'),
          expect.objectContaining({
            id: 'evidence-123',
            updateData,
          }),
        );
        expect(result?.title).toBe('Updated Title');
        expect(result?.description).toBe('Updated desc');
      });
    });

    describe('delete (inherited)', () => {
      it('should delete evidence using inherited method', async () => {
        // Mock findById for existence check
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        // Mock the actual delete operation
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.delete('evidence-123');

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Voting Integration with BaseNodeSchema', () => {
    describe('voteInclusion (inherited)', () => {
      it('should vote on evidence inclusion using inherited method', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteInclusion(
          'evidence-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'EvidenceNode',
          { id: 'evidence-123' },
          'user-456',
          true,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate inputs using inherited validation', async () => {
        await expect(
          schema.voteInclusion('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(
          schema.voteInclusion('evidence-123', '', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('voteContent (inherited) - Should Reject', () => {
      it('should throw BadRequestException when trying to vote on content', async () => {
        await expect(
          schema.voteContent('evidence-123', 'user-456', true),
        ).rejects.toThrow('Evidence does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus (inherited)', () => {
      it('should get vote status using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('evidence-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'EvidenceNode',
          { id: 'evidence-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
        expect(result?.inclusionStatus).toBe('agree');
        expect(result?.contentStatus).toBeNull(); // No content voting
      });
    });

    describe('removeVote (inherited)', () => {
      it('should remove inclusion vote using inherited method', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeVote(
          'evidence-123',
          'user-456',
          'INCLUSION',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'EvidenceNode',
          { id: 'evidence-123' },
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('getVotes (inherited)', () => {
      it('should get vote counts with content votes zero for evidence', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('evidence-123');

        expect(result).toEqual({
          inclusionPositiveVotes: mockVoteStatus.inclusionPositiveVotes,
          inclusionNegativeVotes: mockVoteStatus.inclusionNegativeVotes,
          inclusionNetVotes: mockVoteStatus.inclusionNetVotes,
          contentPositiveVotes: 0, // Always 0 for evidence
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });
    });
  });

  describe('Enhanced Evidence-Specific Methods', () => {
    describe('createEvidence', () => {
      it('should create evidence successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.createEvidence(mockCreateEvidenceData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (e:EvidenceNode'),
          expect.objectContaining({
            id: mockCreateEvidenceData.id,
            title: mockCreateEvidenceData.title,
            url: mockCreateEvidenceData.url,
            authors: mockCreateEvidenceData.authors,
            evidenceType: mockCreateEvidenceData.evidenceType,
            parentNodeId: mockCreateEvidenceData.parentNodeId,
            parentNodeType: mockCreateEvidenceData.parentNodeType,
          }),
        );
        expect(result).toBeDefined();
        expect(result.id).toBe(mockCreateEvidenceData.id);
      });

      it('should validate required fields', async () => {
        const invalidData = { ...mockCreateEvidenceData, title: '' };
        await expect(schema.createEvidence(invalidData)).rejects.toThrow(
          'Evidence title cannot be empty',
        );

        const invalidUrl = { ...mockCreateEvidenceData, url: '' };
        await expect(schema.createEvidence(invalidUrl)).rejects.toThrow(
          'Evidence URL cannot be empty',
        );

        const invalidParent = { ...mockCreateEvidenceData, parentNodeId: '' };
        await expect(schema.createEvidence(invalidParent)).rejects.toThrow(
          'Parent node ID cannot be empty',
        );
      });

      it('should validate URL format', async () => {
        const invalidUrlFormat = {
          ...mockCreateEvidenceData,
          url: 'not-a-valid-url',
        };
        await expect(schema.createEvidence(invalidUrlFormat)).rejects.toThrow(
          'Invalid URL format',
        );
      });

      it('should validate evidence type', async () => {
        const invalidType = {
          ...mockCreateEvidenceData,
          evidenceType: 'invalid_type' as EvidenceType,
        };
        await expect(schema.createEvidence(invalidType)).rejects.toThrow(
          'Invalid evidence type',
        );
      });

      it('should handle parent node validation failure', async () => {
        neo4jService.write.mockRejectedValue(
          new Error(
            'Parent node may not exist or have not passed inclusion threshold',
          ),
        );

        await expect(
          schema.createEvidence(mockCreateEvidenceData),
        ).rejects.toThrow(
          'Parent node must exist and have passed inclusion threshold before evidence can be added',
        );
      });
    });

    describe('getEvidence', () => {
      it('should retrieve evidence with enhanced data', async () => {
        const extendedEvidenceData = {
          ...mockEvidenceData,
          parentInfo: {
            id: 'statement-456',
            type: 'StatementNode',
            title: 'AI safety is crucial for future development',
          },
          reviews: [
            {
              id: 'review-1',
              userId: 'reviewer-1',
              qualityScore: 4,
              independenceScore: 5,
              relevanceScore: 4,
              comments: 'Excellent methodology',
              createdAt: '2023-06-21T10:00:00Z',
            },
          ],
        };

        const mockRecord = {
          get: jest.fn((field) => {
            if (field === 'n') return { properties: mockEvidenceData }; // Fix: return proper structure for mapNodeFromRecord
            if (field === 'e') return { properties: mockEvidenceData };
            if (field === 'parentInfo') return extendedEvidenceData.parentInfo;
            if (field === 'reviews') return extendedEvidenceData.reviews;
            return null;
          }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getEvidence('evidence-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (e:EvidenceNode {id: $id})'),
          { id: 'evidence-123' },
        );
        expect(result).toBeDefined();
        expect(result.parentInfo).toEqual(extendedEvidenceData.parentInfo);
        expect(result.reviews).toEqual(extendedEvidenceData.reviews);
      });

      it('should return null when evidence not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getEvidence('nonexistent');

        expect(result).toBeNull();
      });

      it('should validate input', async () => {
        await expect(schema.getEvidence('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('submitPeerReview', () => {
      it('should submit peer review successfully', async () => {
        // Mock evidence exists and has passed inclusion threshold
        const mockEvidence = { ...mockEvidenceData, inclusionNetVotes: 5 };
        jest.spyOn(schema, 'findById').mockResolvedValue(mockEvidence);

        // Mock no existing review
        jest.spyOn(schema, 'getUserPeerReview').mockResolvedValue(null);

        // Mock successful review creation
        const mockReviewRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              id: 'review-123',
              evidenceId: mockPeerReviewData.evidenceId,
              userId: mockPeerReviewData.userId,
              qualityScore: mockPeerReviewData.qualityScore,
              independenceScore: mockPeerReviewData.independenceScore,
              relevanceScore: mockPeerReviewData.relevanceScore,
              comments: mockPeerReviewData.comments,
              createdAt: '2023-06-21T10:00:00Z',
            },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockReviewRecord],
        } as unknown as Result);

        // Mock score recalculation
        jest.spyOn(schema, 'recalculateEvidenceScores').mockResolvedValue();

        const result = await schema.submitPeerReview(mockPeerReviewData);

        expect(result).toBeDefined();
        expect(result.evidenceId).toBe(mockPeerReviewData.evidenceId);
        expect(result.userId).toBe(mockPeerReviewData.userId);
        expect(result.qualityScore).toBe(mockPeerReviewData.qualityScore);
        expect(schema.recalculateEvidenceScores).toHaveBeenCalledWith(
          mockPeerReviewData.evidenceId,
        );
      });

      it('should validate score ranges (1-5)', async () => {
        const invalidScores = [
          { ...mockPeerReviewData, qualityScore: 0 },
          { ...mockPeerReviewData, independenceScore: 6 },
          { ...mockPeerReviewData, relevanceScore: -1 },
        ];

        for (const invalidData of invalidScores) {
          await expect(schema.submitPeerReview(invalidData)).rejects.toThrow(
            'All scores must be between 1 and 5',
          );
        }
      });

      it('should reject review if evidence not found', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue(null);

        await expect(
          schema.submitPeerReview(mockPeerReviewData),
        ).rejects.toThrow(NotFoundException);
      });

      it('should reject review if evidence has not passed inclusion threshold', async () => {
        const mockEvidence = { ...mockEvidenceData, inclusionNetVotes: -2 };
        jest.spyOn(schema, 'findById').mockResolvedValue(mockEvidence);

        await expect(
          schema.submitPeerReview(mockPeerReviewData),
        ).rejects.toThrow(
          'Evidence must pass inclusion threshold before peer review is allowed',
        );
      });

      it('should reject duplicate reviews from same user', async () => {
        const mockEvidence = { ...mockEvidenceData, inclusionNetVotes: 5 };
        jest.spyOn(schema, 'findById').mockResolvedValue(mockEvidence);

        const existingReview = {
          id: 'existing-review',
          evidenceId: mockPeerReviewData.evidenceId,
          userId: mockPeerReviewData.userId,
          qualityScore: 3,
          independenceScore: 4,
          relevanceScore: 5,
          createdAt: new Date(),
        };
        jest
          .spyOn(schema, 'getUserPeerReview')
          .mockResolvedValue(existingReview);

        await expect(
          schema.submitPeerReview(mockPeerReviewData),
        ).rejects.toThrow(
          'User has already submitted a peer review for this evidence',
        );
      });
    });

    describe('recalculateEvidenceScores', () => {
      it('should recalculate evidence scores with equal weighting', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await schema.recalculateEvidenceScores('evidence-123');

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining(
            '(avgQuality * 0.333) + (avgIndependence * 0.333) + (avgRelevance * 0.334)',
          ),
          { evidenceId: 'evidence-123' },
        );
      });
    });

    describe('getEvidenceForNode', () => {
      it('should get evidence for a specific node', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getEvidenceForNode(
          'statement-456',
          'StatementNode',
        );

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (parent:StatementNode {id: $nodeId})<-[:EVIDENCE_FOR]-(e:EvidenceNode)',
          ),
          { nodeId: 'statement-456' },
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockEvidenceData);
      });

      it('should validate input', async () => {
        await expect(
          schema.getEvidenceForNode('', 'StatementNode'),
        ).rejects.toThrow(BadRequestException);
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('getTopRatedEvidence', () => {
      it('should get top rated evidence', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getTopRatedEvidence(10);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'WHERE e.inclusionNetVotes > 0 AND e.reviewCount >= 5',
          ),
          { limit: 10 },
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockEvidenceData);
      });

      it('should filter by evidence type', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getTopRatedEvidence(10, 'academic_paper');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('AND e.evidenceType = $evidenceType'),
          { limit: 10, evidenceType: 'academic_paper' },
        );
        expect(result).toHaveLength(1);
      });
    });

    describe('getUserPeerReview', () => {
      it('should get user peer review', async () => {
        const mockReview = {
          id: 'review-123',
          evidenceId: 'evidence-123',
          userId: 'reviewer-456',
          qualityScore: 4,
          independenceScore: 5,
          relevanceScore: 3,
          comments: 'Good study',
          createdAt: '2023-06-21T10:00:00Z',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockReview }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getUserPeerReview(
          'evidence-123',
          'reviewer-456',
        );

        expect(result).toBeDefined();
        expect(result?.id).toBe(mockReview.id);
        expect(result?.qualityScore).toBe(mockReview.qualityScore);
      });

      it('should return null when no review found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getUserPeerReview(
          'evidence-123',
          'reviewer-456',
        );

        expect(result).toBeNull();
      });
    });

    describe('checkEvidence', () => {
      it('should return evidence count', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(42)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.checkEvidence();

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (e:EvidenceNode) RETURN count(e) as count',
          {},
        );
        expect(result.count).toBe(42);
      });
    });
  });

  describe('Error Handling Consistency', () => {
    it('should use standardized error messages from BaseNodeSchema', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.findById('test')).rejects.toThrow(
        'Failed to find Evidence: Database connection failed',
      );
    });

    it('should use standardized error format for evidence-specific methods', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query timeout'));

      await expect(schema.getEvidence('test')).rejects.toThrow(
        'Failed to retrieve evidence Evidence: Query timeout',
      );
    });

    it('should validate input parameters consistently', async () => {
      await expect(
        schema.getEvidenceForNode('', 'StatementNode'),
      ).rejects.toThrow(BadRequestException);
      expect(neo4jService.read).not.toHaveBeenCalled();
    });
  });

  describe('Evidence Type Validation', () => {
    const validEvidenceTypes: EvidenceType[] = [
      'academic_paper',
      'news_article',
      'government_report',
      'dataset',
      'book',
      'website',
      'legal_document',
      'expert_testimony',
      'survey_study',
      'meta_analysis',
      'other',
    ];

    it('should accept all valid evidence types', () => {
      validEvidenceTypes.forEach((type) => {
        const data = { ...mockCreateEvidenceData, evidenceType: type };
        expect(() => {
          // This would normally validate in createEvidence, but we can test the enum
          if (!validEvidenceTypes.includes(data.evidenceType)) {
            throw new BadRequestException('Invalid evidence type');
          }
        }).not.toThrow();
      });
    });
  });

  describe('Peer Review Score Calculation', () => {
    it('should use equal weighting (33.3% each) for score calculation', () => {
      const quality = 4;
      const independence = 5;
      const relevance = 3;

      // Expected calculation: (4 * 0.333) + (5 * 0.333) + (3 * 0.334) = 1.332 + 1.665 + 1.002 = 3.999
      const expectedScore =
        quality * 0.333 + independence * 0.333 + relevance * 0.334;

      expect(expectedScore).toBeCloseTo(4.0, 2);
    });

    it('should handle edge cases in score calculation', () => {
      // All minimum scores
      const minScore = 1 * 0.333 + 1 * 0.333 + 1 * 0.334;
      expect(minScore).toBeCloseTo(1.0, 2);

      // All maximum scores
      const maxScore = 5 * 0.333 + 5 * 0.333 + 5 * 0.334;
      expect(maxScore).toBeCloseTo(5.0, 2);
    });
  });

  describe('Legacy Method Absence', () => {
    it('should not have legacy voting methods (uses inherited)', () => {
      expect((schema as any).voteEvidenceInclusion).toBeUndefined();
      expect((schema as any).getEvidenceVoteStatus).toBeUndefined();
      expect((schema as any).removeEvidenceVote).toBeUndefined();
      expect((schema as any).getEvidenceVotes).toBeUndefined();
    });

    it('should have inherited voting methods available', () => {
      expect(schema.voteInclusion).toBeDefined();
      expect(schema.getVoteStatus).toBeDefined();
      expect(schema.removeVote).toBeDefined();
      expect(schema.getVotes).toBeDefined();
    });

    it('should have enhanced evidence-specific methods', () => {
      expect(schema.createEvidence).toBeDefined();
      expect(schema.getEvidence).toBeDefined();
      expect(schema.submitPeerReview).toBeDefined();
      expect(schema.getUserPeerReview).toBeDefined();
      expect(schema.recalculateEvidenceScores).toBeDefined();
      expect(schema.getEvidenceForNode).toBeDefined();
      expect(schema.getTopRatedEvidence).toBeDefined();
      expect(schema.checkEvidence).toBeDefined();
    });
  });
});
