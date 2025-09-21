// src/neo4j/schemas/__tests__/evidence.schema.spec.ts - UPDATED

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  EvidenceSchema,
  EvidenceData,
  CreateEvidenceData,
  CreatePeerReviewData,
  EvidenceType,
  EvidencePeerReview,
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
    description: 'A comprehensive study examining AI safety measures.',
    createdBy: 'user-789',
    publicCredit: true,
    createdAt: new Date('2023-06-20T10:00:00Z'),
    updatedAt: new Date('2023-06-20T10:00:00Z'),
    discussionId: 'discussion-abc',
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
    overallScore: 4.23,
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
    publicCredit: true,
    initialComment: 'This evidence supports the main argument.',
  };

  const mockPeerReviewData: CreatePeerReviewData = {
    evidenceId: 'evidence-123',
    userId: 'reviewer-456',
    qualityScore: 4,
    independenceScore: 5,
    relevanceScore: 3,
    comments: 'Well-structured study with solid methodology.',
  };

  const mockPeerReview: EvidencePeerReview = {
    id: 'review-789',
    evidenceId: 'evidence-123',
    userId: 'reviewer-456',
    qualityScore: 4,
    independenceScore: 5,
    relevanceScore: 3,
    comments: 'Well-structured study with solid methodology.',
    createdAt: new Date('2023-06-21T14:00:00Z'),
    updatedAt: new Date('2023-06-21T14:00:00Z'),
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 16,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 13,
    contentPositiveVotes: 0, // Always 0 for evidence
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 16,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 13,
    contentStatus: null, // No content voting for evidence
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  beforeEach(async () => {
    neo4jService = {
      read: jest.fn(),
      write: jest.fn(),
    } as any;

    voteSchema = {
      vote: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceSchema,
        { provide: Neo4jService, useValue: neo4jService },
        { provide: VoteSchema, useValue: voteSchema },
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
      it('should not support content voting (inclusion only)', () => {
        expect((schema as any).supportsContentVoting()).toBe(false);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should map Neo4j record to EvidenceData with all BaseNodeData fields', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(result.createdBy).toBe('user-789');
        expect(result.publicCredit).toBe(true);
        expect(result.discussionId).toBe('discussion-abc');
        expect(result.contentPositiveVotes).toBe(0); // Always 0 for evidence
        expect(result.contentNegativeVotes).toBe(0);
        expect(result.contentNetVotes).toBe(0);
      });

      it('should convert Neo4j integers correctly', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              ...mockEvidenceData,
              inclusionPositiveVotes: Integer.fromNumber(15),
              inclusionNegativeVotes: Integer.fromNumber(3),
              inclusionNetVotes: Integer.fromNumber(12),
              reviewCount: Integer.fromNumber(8),
            },
          }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(typeof result.inclusionPositiveVotes).toBe('number');
        expect(typeof result.inclusionNegativeVotes).toBe('number');
        expect(typeof result.inclusionNetVotes).toBe('number');
        expect(typeof result.reviewCount).toBe('number');
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build correct update query', () => {
        const updateData = {
          title: 'Updated Study Title',
          description: 'Updated description',
        };
        const result = (schema as any).buildUpdateQuery(
          'evidence-123',
          updateData,
        );

        expect(result.cypher).toContain('MATCH (n:EvidenceNode {id: $id})');
        expect(result.cypher).toContain('SET');
        expect(result.cypher).toContain('n.updatedAt = datetime()');
        expect(result.params).toEqual({
          id: 'evidence-123',
          updateData,
        });
      });
    });
  });

  describe('Inherited Voting Methods', () => {
    describe('voteInclusion', () => {
      it('should vote on inclusion using inherited method', async () => {
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

      it('should validate inputs', async () => {
        await expect(
          schema.voteInclusion('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(
          schema.voteInclusion('evidence-123', '', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('voteContent (should reject)', () => {
      it('should throw BadRequestException when trying to vote on content', async () => {
        await expect(
          schema.voteContent('evidence-123', 'user-456', true),
        ).rejects.toThrow('Evidence does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus', () => {
      it('should get vote status using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('evidence-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'EvidenceNode',
          { id: 'evidence-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
        expect(result?.contentStatus).toBeNull();
      });
    });

    describe('removeVote', () => {
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

    describe('getVotes', () => {
      it('should get vote counts with content votes always zero', async () => {
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

  describe('Evidence-Specific Methods', () => {
    describe('createEvidence', () => {
      it('should create evidence successfully', async () => {
        // Mock evidence creation first
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        // Mock discussion creation second
        neo4jService.write.mockResolvedValueOnce({
          records: [{ get: jest.fn().mockReturnValue('discussion-abc') }],
        } as unknown as Result);

        const result = await schema.createEvidence(mockCreateEvidenceData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (e:EvidenceNode'),
          expect.objectContaining({
            id: mockCreateEvidenceData.id,
            title: mockCreateEvidenceData.title,
            url: mockCreateEvidenceData.url,
            evidenceType: mockCreateEvidenceData.evidenceType,
            parentNodeId: mockCreateEvidenceData.parentNodeId,
            parentNodeType: mockCreateEvidenceData.parentNodeType,
            createdBy: mockCreateEvidenceData.createdBy,
          }),
        );
        expect(result.discussionId).toBe('discussion-abc');
      });

      it('should validate evidence type', async () => {
        const invalidData = {
          ...mockCreateEvidenceData,
          evidenceType: 'invalid_type' as EvidenceType,
        };

        await expect(schema.createEvidence(invalidData)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should validate required fields', async () => {
        const invalidData = {
          ...mockCreateEvidenceData,
          title: '',
        };

        await expect(schema.createEvidence(invalidData)).rejects.toThrow(
          BadRequestException,
        );

        const invalidUrl = {
          ...mockCreateEvidenceData,
          url: '',
        };

        await expect(schema.createEvidence(invalidUrl)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should handle parent node validation failure', async () => {
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

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
            statement: 'AI safety is important for future development',
          },
          reviews: [mockPeerReview],
        };

        const mockRecord = {
          get: jest.fn((field) => {
            if (field === 'n') return { properties: mockEvidenceData };
            if (field === 'discussionId') return 'discussion-abc';
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
        expect(result?.id).toBe('evidence-123');
        expect((result as any).parentInfo).toBeDefined();
        expect((result as any).reviews).toBeDefined();
      });

      it('should return null when evidence not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getEvidence('nonexistent');

        expect(result).toBeNull();
      });

      it('should validate evidence ID', async () => {
        await expect(schema.getEvidence('')).rejects.toThrow(
          BadRequestException,
        );
        await expect(schema.getEvidence('   ')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('getEvidenceForNode', () => {
      it('should get evidence for a specific node', async () => {
        const mockRecords = [
          {
            get: jest.fn((field) => {
              if (field === 'n') return { properties: mockEvidenceData };
              if (field === 'discussionId') return 'discussion-abc';
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
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
        expect(result[0].id).toBe('evidence-123');
      });

      it('should validate inputs', async () => {
        await expect(
          schema.getEvidenceForNode('', 'StatementNode'),
        ).rejects.toThrow(BadRequestException);
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });
  });

  describe('Peer Review System', () => {
    describe('submitPeerReview', () => {
      it('should submit peer review when evidence has passed inclusion threshold', async () => {
        // Mock evidence with positive inclusion votes
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        // Mock no existing review
        neo4jService.read.mockResolvedValueOnce({
          records: [],
        } as unknown as Result);

        // Mock peer review creation
        const mockReviewRecord = {
          get: jest.fn().mockReturnValue({ properties: mockPeerReview }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [mockReviewRecord],
        } as unknown as Result);

        // Mock recalculation
        neo4jService.write.mockResolvedValueOnce({} as Result);

        const result = await schema.submitPeerReview(mockPeerReviewData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (pr:PeerReviewNode'),
          expect.objectContaining({
            evidenceId: mockPeerReviewData.evidenceId,
            userId: mockPeerReviewData.userId,
            qualityScore: mockPeerReviewData.qualityScore,
            independenceScore: mockPeerReviewData.independenceScore,
            relevanceScore: mockPeerReviewData.relevanceScore,
          }),
        );
        expect(result.id).toBeDefined();
      });

      it('should reject review when evidence has not passed inclusion threshold', async () => {
        const evidenceWithNegativeVotes = {
          ...mockEvidenceData,
          inclusionNetVotes: -2,
        };

        const mockRecord = {
          get: jest
            .fn()
            .mockReturnValue({ properties: evidenceWithNegativeVotes }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        await expect(
          schema.submitPeerReview(mockPeerReviewData),
        ).rejects.toThrow(
          'Evidence must pass inclusion threshold before peer review is allowed',
        );
      });

      it('should reject duplicate review from same user', async () => {
        // Mock evidence with positive inclusion votes
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        // Mock existing review
        const existingReviewRecord = {
          get: jest.fn().mockReturnValue({ properties: mockPeerReview }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValueOnce({
          records: [existingReviewRecord],
        } as unknown as Result);

        await expect(
          schema.submitPeerReview(mockPeerReviewData),
        ).rejects.toThrow(
          'User has already submitted a peer review for this evidence',
        );
      });

      it('should validate score ranges (1-5)', async () => {
        const invalidScoreData = {
          ...mockPeerReviewData,
          qualityScore: 6, // Invalid score
        };

        await expect(schema.submitPeerReview(invalidScoreData)).rejects.toThrow(
          'All scores must be between 1 and 5',
        );

        const anotherInvalidData = {
          ...mockPeerReviewData,
          relevanceScore: 0, // Invalid score
        };

        await expect(
          schema.submitPeerReview(anotherInvalidData),
        ).rejects.toThrow('All scores must be between 1 and 5');
      });

      it('should handle evidence not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(
          schema.submitPeerReview(mockPeerReviewData),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('getUserPeerReview', () => {
      it('should get user peer review', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockPeerReview }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getUserPeerReview(
          'evidence-123',
          'reviewer-456',
        );

        expect(result).toBeDefined();
        expect(result?.id).toBe(mockPeerReview.id);
        expect(result?.qualityScore).toBe(mockPeerReview.qualityScore);
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

    describe('recalculateEvidenceScores', () => {
      it('should recalculate evidence scores based on peer reviews', async () => {
        neo4jService.write.mockResolvedValue({} as Result);

        await schema.recalculateEvidenceScores('evidence-123');

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (e:EvidenceNode {id: $evidenceId})'),
          { evidenceId: 'evidence-123' },
        );
      });
    });

    describe('getTopRatedEvidence', () => {
      it('should get top rated evidence with default parameters', async () => {
        const mockRecords = [
          {
            get: jest.fn((field) => {
              if (field === 'n') return { properties: mockEvidenceData };
              return null;
            }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getTopRatedEvidence();

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY e.overallScore DESC'),
          { limit: 20 },
        );
        expect(result).toHaveLength(1);
      });

      it('should handle custom parameters', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getTopRatedEvidence(5, 'academic_paper');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('AND e.evidenceType = $evidenceType'),
          expect.objectContaining({
            limit: 5,
            evidenceType: 'academic_paper',
          }),
        );
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

  describe('Integration Tests', () => {
    it('should handle complete evidence lifecycle', async () => {
      // Create evidence
      const mockCreateRecord = {
        get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockCreateRecord],
      } as unknown as Result);

      // Mock discussion creation
      neo4jService.write.mockResolvedValueOnce({
        records: [{ get: jest.fn().mockReturnValue('discussion-abc') }],
      } as unknown as Result);

      const created = await schema.createEvidence(mockCreateEvidenceData);
      expect(created.id).toBe('evidence-123');

      // Read
      const mockReadRecord = {
        get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [mockReadRecord],
      } as unknown as Result);

      const found = await schema.findById('evidence-123');
      expect(found).toEqual(expect.objectContaining({ id: 'evidence-123' }));

      // Vote inclusion
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const voteResult = await schema.voteInclusion(
        'evidence-123',
        'user-456',
        true,
      );
      expect(voteResult).toEqual(mockVoteResult);

      // Update
      const updateData = { title: 'Updated Study Title' };
      const updatedEvidence = { ...mockEvidenceData, ...updateData };
      const mockUpdateRecord = {
        get: jest.fn().mockReturnValue({ properties: updatedEvidence }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockUpdateRecord],
      } as unknown as Result);

      const updated = await schema.update('evidence-123', updateData);
      expect(updated).toEqual(updatedEvidence);

      // Delete
      const existsRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [existsRecord],
      } as unknown as Result);
      neo4jService.write.mockResolvedValueOnce({} as Result);

      const deleteResult = await schema.delete('evidence-123');
      expect(deleteResult).toEqual({ success: true });
    });
  });

  describe('Error Handling', () => {
    it('should use standardized error messages from BaseNodeSchema', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.findById('test')).rejects.toThrow(
        'Failed to find Evidence: Database connection failed',
      );
    });

    it('should handle evidence-specific errors consistently', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query timeout'));

      await expect(schema.getEvidence('test')).rejects.toThrow(
        'Failed to retrieve evidence Evidence: Query timeout',
      );
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
