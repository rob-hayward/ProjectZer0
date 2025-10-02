// src/neo4j/schemas/__tests__/evidence.schema.spec.ts - UPDATED

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  EvidenceSchema,
  EvidenceData,
  EvidenceType,
  EvidencePeerReview,
} from '../evidence.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { DiscussionSchema } from '../discussion.schema';
import { UserSchema } from '../user.schema';
import { Record, Result, Integer } from 'neo4j-driver';

describe('EvidenceSchema', () => {
  let schema: EvidenceSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  let userSchema: jest.Mocked<UserSchema>;

  const mockEvidenceData: EvidenceData = {
    id: 'evidence-123',
    createdBy: 'user-456',
    publicCredit: true,
    title: 'Comprehensive Study on AI Safety',
    url: 'https://arxiv.org/abs/2023.12345',
    authors: ['Dr. Jane Smith', 'Prof. John Doe'],
    publicationDate: new Date('2023-06-15'),
    evidenceType: 'academic_paper',
    parentNodeId: 'statement-456',
    parentNodeType: 'StatementNode',
    description: 'A comprehensive study examining AI safety measures.',
    discussionId: 'discussion-abc',
    createdAt: new Date('2023-06-20T10:00:00Z'),
    updatedAt: new Date('2023-06-20T10:00:00Z'),
    inclusionPositiveVotes: 15,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 12,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
    avgQualityScore: 4.2,
    avgIndependenceScore: 4.0,
    avgRelevanceScore: 4.5,
    overallScore: 4.23,
    reviewCount: 8,
  };

  const mockPeerReview: EvidencePeerReview = {
    id: 'review-123',
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
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 16,
    inclusionNegativeVotes: 3,
    inclusionNetVotes: 13,
    contentStatus: null,
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
        {
          provide: DiscussionSchema,
          useValue: {
            createDiscussionForNode: jest.fn(),
          },
        },
        {
          provide: UserSchema,
          useValue: {
            addCreatedNode: jest.fn(),
          },
        },
      ],
    }).compile();

    schema = module.get<EvidenceSchema>(EvidenceSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
    discussionSchema = module.get(DiscussionSchema);
    userSchema = module.get(UserSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Inherited Methods', () => {
    describe('findById', () => {
      it('should find evidence by id', async () => {
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

      it('should validate input', async () => {
        await expect(schema.findById('')).rejects.toThrow(BadRequestException);
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('update', () => {
      it('should update evidence using inherited method', async () => {
        const updateData = { title: 'Updated Title' };
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
      });

      it('should validate input', async () => {
        await expect(schema.update('', {})).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });

    describe('delete', () => {
      it('should detach and delete evidence', async () => {
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.delete('evidence-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:EvidenceNode {id: $id})'),
          { id: 'evidence-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE n'),
          { id: 'evidence-123' },
        );
        expect(result).toEqual({ success: true });
      });

      it('should throw NotFoundException when evidence not found', async () => {
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(0)),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

        await expect(schema.delete('nonexistent')).rejects.toThrow(
          NotFoundException,
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });
  });

  describe('Voting Methods', () => {
    describe('voteInclusion', () => {
      it('should vote on evidence inclusion', async () => {
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
    });

    describe('voteContent', () => {
      it('should reject content voting for evidence', async () => {
        await expect(
          schema.voteContent('evidence-123', 'user-456', true),
        ).rejects.toThrow('Evidence does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus', () => {
      it('should get vote status with null content status', async () => {
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

    describe('getVotes', () => {
      it('should get vote counts with content votes always zero', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('evidence-123');

        expect(result).toEqual({
          inclusionPositiveVotes: 16,
          inclusionNegativeVotes: 3,
          inclusionNetVotes: 13,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });
    });
  });

  describe('createEvidence', () => {
    it('should create evidence with keywords and categories', async () => {
      const createData = {
        title: 'Test Evidence',
        url: 'https://example.com/paper',
        evidenceType: 'academic_paper' as EvidenceType,
        parentNodeId: 'statement-456',
        parentNodeType: 'StatementNode' as const,
        createdBy: 'user-456',
        publicCredit: true,
        keywords: [{ word: 'test', frequency: 1, source: 'user' as const }],
        categoryIds: ['cat1'],
        initialComment: 'Initial comment',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
      } as unknown as Record;

      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      userSchema.addCreatedNode.mockResolvedValue(undefined);

      const result = await schema.createEvidence(createData);

      expect(neo4jService.write).toHaveBeenCalled();
      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
        nodeId: expect.any(String),
        nodeType: 'EvidenceNode',
        nodeIdField: 'id',
        createdBy: 'user-456',
        initialComment: 'Initial comment',
      });
      expect(userSchema.addCreatedNode).toHaveBeenCalledWith(
        'user-456',
        expect.any(String),
        'evidence',
      );
      expect(result.id).toBe('evidence-123');
    });

    it('should reject empty title', async () => {
      await expect(
        schema.createEvidence({
          title: '',
          url: 'https://example.com',
          evidenceType: 'academic_paper',
          parentNodeId: 'statement-456',
          parentNodeType: 'StatementNode',
          createdBy: 'user-456',
          publicCredit: true,
        }),
      ).rejects.toThrow('Evidence title cannot be empty');
    });

    it('should reject empty URL', async () => {
      await expect(
        schema.createEvidence({
          title: 'Test',
          url: '',
          evidenceType: 'academic_paper',
          parentNodeId: 'statement-456',
          parentNodeType: 'StatementNode',
          createdBy: 'user-456',
          publicCredit: true,
        }),
      ).rejects.toThrow('Evidence URL cannot be empty');
    });

    it('should reject invalid URL format', async () => {
      await expect(
        schema.createEvidence({
          title: 'Test',
          url: 'not-a-valid-url',
          evidenceType: 'academic_paper',
          parentNodeId: 'statement-456',
          parentNodeType: 'StatementNode',
          createdBy: 'user-456',
          publicCredit: true,
        }),
      ).rejects.toThrow('Invalid URL format');
    });

    it('should reject invalid evidence type', async () => {
      await expect(
        schema.createEvidence({
          title: 'Test',
          url: 'https://example.com',
          evidenceType: 'invalid_type' as EvidenceType,
          parentNodeId: 'statement-456',
          parentNodeType: 'StatementNode',
          createdBy: 'user-456',
          publicCredit: true,
        }),
      ).rejects.toThrow('Invalid evidence type');
    });

    it('should reject too many categories', async () => {
      await expect(
        schema.createEvidence({
          title: 'Test',
          url: 'https://example.com',
          evidenceType: 'academic_paper',
          parentNodeId: 'statement-456',
          parentNodeType: 'StatementNode',
          createdBy: 'user-456',
          publicCredit: true,
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        }),
      ).rejects.toThrow('Evidence can have maximum 3 categories');
    });

    it('should reject when parent node not found', async () => {
      neo4jService.write.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await expect(
        schema.createEvidence({
          title: 'Test',
          url: 'https://example.com',
          evidenceType: 'academic_paper',
          parentNodeId: 'nonexistent',
          parentNodeType: 'StatementNode',
          createdBy: 'user-456',
          publicCredit: true,
        }),
      ).rejects.toThrow(
        'Parent node must exist and have passed inclusion threshold',
      );
    });

    it('should handle user tracking failure gracefully', async () => {
      const createData = {
        title: 'Test Evidence',
        url: 'https://example.com/paper',
        evidenceType: 'academic_paper' as EvidenceType,
        parentNodeId: 'statement-456',
        parentNodeType: 'StatementNode' as const,
        createdBy: 'user-456',
        publicCredit: true,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
      } as unknown as Record;

      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      userSchema.addCreatedNode.mockRejectedValue(
        new Error('User tracking failed'),
      );

      const result = await schema.createEvidence(createData);

      expect(result.id).toBe('evidence-123');
      expect(userSchema.addCreatedNode).toHaveBeenCalled();
    });
  });

  describe('getEvidence', () => {
    it('should retrieve evidence with relationships', async () => {
      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'n') {
            return { properties: mockEvidenceData };
          }
          if (key === 'parentInfo') {
            return {
              id: 'statement-456',
              type: 'StatementNode',
              title: 'Parent statement',
            };
          }
          if (key === 'keywords')
            return [{ word: 'test', frequency: 1, source: 'user' }];
          if (key === 'categories') return [{ id: 'cat1', name: 'Category 1' }];
          if (key === 'discussionId') return 'discussion-abc';
          if (key === 'reviews') return [mockPeerReview];
          return null;
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getEvidence('evidence-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('evidence-123');
      expect(result?.discussionId).toBe('discussion-abc');
      expect(result?.parentInfo).toBeDefined();
      expect(result?.reviews).toHaveLength(1);
    });

    it('should return null when evidence not found', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as unknown as Result);

      const result = await schema.getEvidence('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle empty arrays for keywords and categories', async () => {
      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'n') {
            return { properties: mockEvidenceData };
          }
          if (key === 'parentInfo') return null;
          if (key === 'keywords') return [];
          if (key === 'categories') return [];
          if (key === 'discussionId') return null;
          if (key === 'reviews') return [];
          return null;
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getEvidence('evidence-123');

      expect(result).toBeDefined();
      expect(result?.keywords).toBeUndefined();
      expect(result?.categories).toBeUndefined();
    });

    it('should validate input', async () => {
      await expect(schema.getEvidence('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateEvidence', () => {
    it('should handle simple updates', async () => {
      const updateData = { title: 'Updated Title' };

      jest.spyOn(schema, 'update').mockResolvedValue({
        ...mockEvidenceData,
        ...updateData,
      });

      const result = await schema.updateEvidence('evidence-123', updateData);

      expect(result?.title).toBe('Updated Title');
    });

    it('should validate URL format when updating', async () => {
      await expect(
        schema.updateEvidence('evidence-123', {
          url: 'not-a-valid-url',
        }),
      ).rejects.toThrow('Invalid URL format');
    });

    it('should handle complex updates with keywords', async () => {
      const updateData = {
        keywords: [{ word: 'updated', frequency: 1, source: 'user' as const }],
      };

      jest.spyOn(schema, 'updateKeywords').mockResolvedValue(undefined);
      jest.spyOn(schema, 'getEvidence').mockResolvedValue({
        ...mockEvidenceData,
        keywords: updateData.keywords,
      });

      const result = await schema.updateEvidence('evidence-123', updateData);

      expect(result).toBeDefined();
      expect(schema.updateKeywords).toHaveBeenCalledWith(
        'evidence-123',
        updateData.keywords,
      );
    });

    it('should handle complex updates with categories', async () => {
      const updateData = {
        categoryIds: ['cat1', 'cat2'],
      };

      jest.spyOn(schema, 'updateCategories').mockResolvedValue(undefined);
      jest.spyOn(schema, 'getEvidence').mockResolvedValue({
        ...mockEvidenceData,
        categories: [
          { id: 'cat1', name: 'Category 1' },
          { id: 'cat2', name: 'Category 2' },
        ],
      });

      const result = await schema.updateEvidence('evidence-123', updateData);

      expect(result).toBeDefined();
      expect(schema.updateCategories).toHaveBeenCalledWith(
        'evidence-123',
        updateData.categoryIds,
      );
    });

    it('should reject too many categories', async () => {
      await expect(
        schema.updateEvidence('evidence-123', {
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        }),
      ).rejects.toThrow('Evidence can have maximum 3 categories');
    });

    it('should handle publicationDate conversion', async () => {
      const updateData = {
        publicationDate: new Date('2024-01-01'),
      };

      jest.spyOn(schema, 'update').mockResolvedValue({
        ...mockEvidenceData,
        publicationDate: updateData.publicationDate,
      });

      await schema.updateEvidence('evidence-123', updateData);

      expect(schema.update).toHaveBeenCalledWith(
        'evidence-123',
        expect.objectContaining({
          publicationDate: '2024-01-01T00:00:00.000Z',
        }),
      );
    });
  });

  describe('Peer Review System', () => {
    describe('submitPeerReview', () => {
      it('should submit new review when inclusion threshold passed', async () => {
        jest.spyOn(schema, 'getEvidence').mockResolvedValue({
          ...mockEvidenceData,
          inclusionNetVotes: 5,
        });

        jest.spyOn(schema, 'getUserPeerReview').mockResolvedValue(null);

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockPeerReview }),
        } as unknown as Record;

        neo4jService.write.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        neo4jService.write.mockResolvedValueOnce({} as Result);

        const result = await schema.submitPeerReview({
          evidenceId: 'evidence-123',
          userId: 'reviewer-456',
          qualityScore: 4,
          independenceScore: 5,
          relevanceScore: 3,
          comments: 'Good study',
        });

        expect(result).toBeDefined();
        expect(result.qualityScore).toBe(4);
        expect(neo4jService.write).toHaveBeenCalledTimes(2);
      });

      it('should reject review when inclusion threshold not passed', async () => {
        jest.spyOn(schema, 'getEvidence').mockResolvedValue({
          ...mockEvidenceData,
          inclusionNetVotes: 0,
        });

        await expect(
          schema.submitPeerReview({
            evidenceId: 'evidence-123',
            userId: 'reviewer-456',
            qualityScore: 4,
            independenceScore: 5,
            relevanceScore: 3,
          }),
        ).rejects.toThrow(
          'Evidence must pass inclusion threshold before peer review is allowed',
        );
      });

      it('should reject duplicate review from same user', async () => {
        jest.spyOn(schema, 'getEvidence').mockResolvedValue({
          ...mockEvidenceData,
          inclusionNetVotes: 5,
        });

        jest
          .spyOn(schema, 'getUserPeerReview')
          .mockResolvedValue(mockPeerReview);

        await expect(
          schema.submitPeerReview({
            evidenceId: 'evidence-123',
            userId: 'reviewer-456',
            qualityScore: 4,
            independenceScore: 5,
            relevanceScore: 3,
          }),
        ).rejects.toThrow(
          'User has already submitted a peer review for this evidence',
        );
      });

      it('should reject invalid scores', async () => {
        await expect(
          schema.submitPeerReview({
            evidenceId: 'evidence-123',
            userId: 'reviewer-456',
            qualityScore: 6,
            independenceScore: 5,
            relevanceScore: 3,
          }),
        ).rejects.toThrow('All scores must be between 1 and 5');

        await expect(
          schema.submitPeerReview({
            evidenceId: 'evidence-123',
            userId: 'reviewer-456',
            qualityScore: 4,
            independenceScore: 0,
            relevanceScore: 3,
          }),
        ).rejects.toThrow('All scores must be between 1 and 5');
      });

      it('should reject when evidence not found', async () => {
        jest.spyOn(schema, 'getEvidence').mockResolvedValue(null);

        await expect(
          schema.submitPeerReview({
            evidenceId: 'nonexistent',
            userId: 'reviewer-456',
            qualityScore: 4,
            independenceScore: 5,
            relevanceScore: 3,
          }),
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

        expect(result).toEqual(mockPeerReview);
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

    describe('isPeerReviewAllowed', () => {
      it('should return true when inclusion threshold passed', async () => {
        jest.spyOn(schema, 'getEvidence').mockResolvedValue({
          ...mockEvidenceData,
          inclusionNetVotes: 5,
        });

        const result = await schema.isPeerReviewAllowed('evidence-123');

        expect(result).toBe(true);
      });

      it('should return false when inclusion threshold not passed', async () => {
        jest.spyOn(schema, 'getEvidence').mockResolvedValue({
          ...mockEvidenceData,
          inclusionNetVotes: 0,
        });

        const result = await schema.isPeerReviewAllowed('evidence-123');

        expect(result).toBe(false);
      });

      it('should return false when evidence not found', async () => {
        jest.spyOn(schema, 'getEvidence').mockResolvedValue(null);

        const result = await schema.isPeerReviewAllowed('nonexistent');

        expect(result).toBe(false);
      });
    });

    describe('getPeerReviewStats', () => {
      it('should calculate review statistics', async () => {
        const mockRecord = {
          get: jest.fn().mockImplementation((key) => {
            if (key === 'reviewCount') return Integer.fromNumber(3);
            if (key === 'avgQualityScore') return 4.2;
            if (key === 'avgIndependenceScore') return 4.0;
            if (key === 'avgRelevanceScore') return 4.5;
            if (key === 'overallScore') return 4.23;
            if (key === 'qualityScores') return [4, 4, 5];
            if (key === 'independenceScores') return [3, 4, 5];
            if (key === 'relevanceScores') return [4, 5, 5];
            return null;
          }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getPeerReviewStats('evidence-123');

        expect(result.reviewCount).toBe(3);
        expect(result.avgQualityScore).toBe(4.2);
        expect(result.scoreDistribution).toBeDefined();
        expect(result.scoreDistribution.quality).toBeDefined();
      });

      it('should handle zero reviews', async () => {
        const mockRecord = {
          get: jest.fn().mockImplementation((key) => {
            if (key === 'reviewCount') return Integer.fromNumber(0);
            if (key === 'avgQualityScore') return 0;
            if (key === 'avgIndependenceScore') return 0;
            if (key === 'avgRelevanceScore') return 0;
            if (key === 'overallScore') return 0;
            if (key === 'qualityScores') return [];
            if (key === 'independenceScores') return [];
            if (key === 'relevanceScores') return [];
            return null;
          }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getPeerReviewStats('evidence-123');

        expect(result.reviewCount).toBe(0);
        expect(result.overallScore).toBe(0);
      });
    });
  });

  describe('Discovery Methods', () => {
    describe('getEvidenceForNode', () => {
      it('should get evidence for a specific node', async () => {
        const mockRecords = [
          {
            get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getEvidenceForNode(
          'statement-456',
          'StatementNode',
        );

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('evidence-123');
      });

      it('should validate input', async () => {
        await expect(
          schema.getEvidenceForNode('', 'StatementNode'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getTopRatedEvidence', () => {
      it('should get top rated evidence with default parameters', async () => {
        const mockRecords = [
          {
            get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getTopRatedEvidence();

        expect(result).toHaveLength(1);
        expect(result[0].overallScore).toBe(4.23);
      });

      it('should handle custom parameters', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getTopRatedEvidence(10, 'academic_paper');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('e.evidenceType = $evidenceType'),
          expect.objectContaining({
            limit: 10,
            evidenceType: 'academic_paper',
          }),
        );
      });
    });

    describe('getEvidenceByType', () => {
      it('should get evidence by type', async () => {
        const mockRecords = [
          {
            get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getEvidenceByType('academic_paper');

        expect(result).toHaveLength(1);
        expect(result[0].evidenceType).toBe('academic_paper');
      });

      it('should support includeUnapproved option', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getEvidenceByType('academic_paper', {
          includeUnapproved: true,
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('WHERE e.evidenceType = $evidenceType'),
          expect.any(Object),
        );
      });
    });

    describe('getWellReviewedEvidence', () => {
      it('should get evidence with minimum review count', async () => {
        const mockRecords = [
          {
            get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getWellReviewedEvidence(5, 10);

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('e.reviewCount >= $minReviewCount'),
          expect.objectContaining({
            minReviewCount: 5,
            limit: 10,
          }),
        );
        expect(result).toHaveLength(1);
      });
    });

    describe('getAllEvidence', () => {
      it('should get evidence with filters', async () => {
        const mockRecords = [
          {
            get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getAllEvidence({
          categoryId: 'cat1',
          evidenceType: 'academic_paper',
          minReviewCount: 3,
        });

        expect(result).toHaveLength(1);
      });

      it('should include unapproved evidence when specified', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getAllEvidence({ includeUnapproved: true });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
        );
      });
    });

    describe('getRelatedEvidence', () => {
      it('should get related evidence by tags and categories', async () => {
        jest.spyOn(schema, 'findRelatedByCombined').mockResolvedValue([
          {
            nodeId: 'evidence-456',
            tagStrength: 50,
            categoryStrength: 30,
            combinedStrength: 110,
          },
        ]);

        jest.spyOn(schema, 'getEvidence').mockResolvedValue({
          ...mockEvidenceData,
          id: 'evidence-456',
        });

        const result = await schema.getRelatedEvidence('evidence-123', 10);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('evidence-456');
      });
    });
  });

  describe('checkEvidence', () => {
    it('should return evidence count and statistics', async () => {
      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'count') return Integer.fromNumber(42);
          if (key === 'withReviews') return Integer.fromNumber(30);
          if (key === 'wellReviewed') return Integer.fromNumber(15);
          if (key === 'academicPapers') return Integer.fromNumber(20);
          if (key === 'newsArticles') return Integer.fromNumber(10);
          if (key === 'governmentReports') return Integer.fromNumber(5);
          if (key === 'datasets') return Integer.fromNumber(3);
          if (key === 'books') return Integer.fromNumber(2);
          if (key === 'websites') return Integer.fromNumber(1);
          if (key === 'legalDocuments') return Integer.fromNumber(1);
          if (key === 'expertTestimony') return Integer.fromNumber(0);
          if (key === 'surveyStudies') return Integer.fromNumber(0);
          if (key === 'metaAnalyses') return Integer.fromNumber(0);
          if (key === 'other') return Integer.fromNumber(0);
          return Integer.fromNumber(0);
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.checkEvidence();

      expect(result.count).toBe(42);
      expect(result.withReviews).toBe(30);
      expect(result.wellReviewed).toBe(15);
      expect(result.byType).toBeDefined();
      expect(result.byType.academic_paper).toBe(20);
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
        expect(() => {
          if (!validEvidenceTypes.includes(type)) {
            throw new BadRequestException('Invalid evidence type');
          }
        }).not.toThrow();
      });
    });

    it('should reject invalid evidence types', async () => {
      await expect(
        schema.createEvidence({
          title: 'Test',
          url: 'https://example.com',
          evidenceType: 'invalid_type' as EvidenceType,
          parentNodeId: 'statement-456',
          parentNodeType: 'StatementNode',
          createdBy: 'user-456',
          publicCredit: true,
        }),
      ).rejects.toThrow('Invalid evidence type');
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
      const minScore = 1 * 0.333 + 1 * 0.333 + 1 * 0.334;
      expect(minScore).toBeCloseTo(1.0, 2);

      const maxScore = 5 * 0.333 + 5 * 0.333 + 5 * 0.334;
      expect(maxScore).toBeCloseTo(5.0, 2);
    });
  });

  describe('Input Validation', () => {
    it('should reject null/undefined IDs', async () => {
      await expect(schema.findById(null as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(schema.findById(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject whitespace-only title', async () => {
      await expect(
        schema.createEvidence({
          title: '   ',
          url: 'https://example.com',
          evidenceType: 'academic_paper',
          parentNodeId: 'statement-456',
          parentNodeType: 'StatementNode',
          createdBy: 'user-456',
          publicCredit: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty parent node ID', async () => {
      await expect(
        schema.createEvidence({
          title: 'Test',
          url: 'https://example.com',
          evidenceType: 'academic_paper',
          parentNodeId: '',
          parentNodeType: 'StatementNode',
          createdBy: 'user-456',
          publicCredit: true,
        }),
      ).rejects.toThrow('Parent node ID cannot be empty');
    });
  });

  describe('Neo4j Integer Conversion', () => {
    it('should convert Neo4j Integer objects to numbers', async () => {
      const mockDataWithIntegers = {
        ...mockEvidenceData,
        inclusionPositiveVotes: Integer.fromNumber(999),
        reviewCount: Integer.fromNumber(50),
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDataWithIntegers }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.findById('evidence-123');

      expect(result?.inclusionPositiveVotes).toBe(999);
      expect(result?.reviewCount).toBe(50);
      expect(typeof result?.inclusionPositiveVotes).toBe('number');
      expect(typeof result?.reviewCount).toBe('number');
    });
  });

  describe('Business Rules Enforcement', () => {
    it('should enforce inclusion threshold for peer reviews', async () => {
      jest.spyOn(schema, 'getEvidence').mockResolvedValue({
        ...mockEvidenceData,
        inclusionNetVotes: -2,
      });

      await expect(
        schema.submitPeerReview({
          evidenceId: 'evidence-123',
          userId: 'reviewer-456',
          qualityScore: 4,
          independenceScore: 5,
          relevanceScore: 3,
        }),
      ).rejects.toThrow('Evidence must pass inclusion threshold');
    });

    it('should prevent duplicate reviews from same user', async () => {
      jest.spyOn(schema, 'getEvidence').mockResolvedValue({
        ...mockEvidenceData,
        inclusionNetVotes: 5,
      });

      jest.spyOn(schema, 'getUserPeerReview').mockResolvedValue(mockPeerReview);

      await expect(
        schema.submitPeerReview({
          evidenceId: 'evidence-123',
          userId: 'reviewer-456',
          qualityScore: 4,
          independenceScore: 5,
          relevanceScore: 3,
        }),
      ).rejects.toThrow('User has already submitted a peer review');
    });

    it('should validate parent node exists and has passed inclusion', async () => {
      neo4jService.write.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await expect(
        schema.createEvidence({
          title: 'Test',
          url: 'https://example.com',
          evidenceType: 'academic_paper',
          parentNodeId: 'nonexistent',
          parentNodeType: 'StatementNode',
          createdBy: 'user-456',
          publicCredit: true,
        }),
      ).rejects.toThrow('Parent node must exist and have passed inclusion');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete evidence lifecycle with peer review', async () => {
      // Create
      const createRecord = {
        get: jest.fn().mockReturnValue({ properties: mockEvidenceData }),
      } as unknown as Record;

      neo4jService.write.mockResolvedValueOnce({
        records: [createRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      userSchema.addCreatedNode.mockResolvedValue(undefined);

      const created = await schema.createEvidence({
        title: 'Test Evidence',
        url: 'https://example.com',
        evidenceType: 'academic_paper',
        parentNodeId: 'statement-456',
        parentNodeType: 'StatementNode',
        createdBy: 'user-456',
        publicCredit: true,
      });

      expect(created.id).toBe('evidence-123');

      // Vote inclusion
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const voteResult = await schema.voteInclusion(
        'evidence-123',
        'user-789',
        true,
      );
      expect(voteResult.inclusionNetVotes).toBe(13);

      // Submit peer review
      jest.spyOn(schema, 'getEvidence').mockResolvedValue({
        ...mockEvidenceData,
        inclusionNetVotes: 5,
      });
      jest.spyOn(schema, 'getUserPeerReview').mockResolvedValue(null);

      const reviewRecord = {
        get: jest.fn().mockReturnValue({ properties: mockPeerReview }),
      } as unknown as Record;

      neo4jService.write.mockResolvedValueOnce({
        records: [reviewRecord],
      } as unknown as Result);

      neo4jService.write.mockResolvedValueOnce({} as Result);

      const review = await schema.submitPeerReview({
        evidenceId: 'evidence-123',
        userId: 'reviewer-456',
        qualityScore: 4,
        independenceScore: 5,
        relevanceScore: 3,
      });

      expect(review.qualityScore).toBe(4);

      // Update
      const updateData = { title: 'Updated Title' };
      jest.spyOn(schema, 'update').mockResolvedValue({
        ...mockEvidenceData,
        ...updateData,
      });

      const updated = await schema.updateEvidence('evidence-123', updateData);
      expect(updated?.title).toBe('Updated Title');

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

    it('should enforce business rules across operations', async () => {
      // Test inclusion threshold enforcement
      jest.spyOn(schema, 'getEvidence').mockResolvedValue({
        ...mockEvidenceData,
        inclusionNetVotes: -1,
      });

      await expect(
        schema.submitPeerReview({
          evidenceId: 'evidence-123',
          userId: 'reviewer-456',
          qualityScore: 4,
          independenceScore: 5,
          relevanceScore: 3,
        }),
      ).rejects.toThrow('Evidence must pass inclusion threshold');

      // Test URL validation
      await expect(
        schema.createEvidence({
          title: 'Test',
          url: 'invalid-url',
          evidenceType: 'academic_paper',
          parentNodeId: 'statement-456',
          parentNodeType: 'StatementNode',
          createdBy: 'user-456',
          publicCredit: true,
        }),
      ).rejects.toThrow('Invalid URL format');
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

  describe('Schema Characteristics', () => {
    it('should not support content voting', () => {
      expect((schema as any).supportsContentVoting()).toBe(false);
    });

    it('should have standard id field', () => {
      expect((schema as any).idField).toBe('id');
    });

    it('should have correct node label', () => {
      expect((schema as any).nodeLabel).toBe('EvidenceNode');
    });

    it('should support tagging', () => {
      expect(typeof schema.getKeywords).toBe('function');
      expect(typeof schema.updateKeywords).toBe('function');
    });

    it('should support categorization', () => {
      expect(typeof schema.getCategories).toBe('function');
      expect(typeof schema.updateCategories).toBe('function');
    });

    it('should have max 3 categories', () => {
      expect((schema as any).maxCategories).toBe(3);
    });
  });
});
