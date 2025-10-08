// src/nodes/universal/universal-graph.service.spec.ts
// ✅ Phase 4.1: Updated to mock schema methods with correct types

import { Test, TestingModule } from '@nestjs/testing';
import { UniversalGraphService } from './universal-graph.service';
import { Neo4jService } from '../../neo4j/neo4j.service';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VisibilityService } from '../../users/visibility/visibility.service';
import { CategoryService } from '../category/category.service';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { OpenQuestionSchema } from '../../neo4j/schemas/openquestion.schema';
import { AnswerSchema } from '../../neo4j/schemas/answer.schema';
import { QuantitySchema } from '../../neo4j/schemas/quantity.schema';
import { EvidenceSchema } from '../../neo4j/schemas/evidence.schema';

describe('UniversalGraphService - Phase 4.1 Schema Integration', () => {
  let service: UniversalGraphService;
  let neo4jService: jest.Mocked<Neo4jService>;
  let statementSchema: jest.Mocked<StatementSchema>;
  let openQuestionSchema: jest.Mocked<OpenQuestionSchema>;
  let answerSchema: jest.Mocked<AnswerSchema>;
  let quantitySchema: jest.Mocked<QuantitySchema>;
  let evidenceSchema: jest.Mocked<EvidenceSchema>;

  /**
   * Helper to create mock Neo4j result (for direct queries like keywords/categories)
   */
  const mockNeo4jResult = (records: any[]) => ({
    records: records.map((record) => ({
      get: jest.fn((key: string) => record[key]),
      toObject: jest.fn(() => record),
    })),
  });

  beforeEach(async () => {
    const mockNeo4jService = {
      read: jest.fn(),
      write: jest.fn(),
    };

    const mockStatementSchema = {
      findAll: jest.fn(),
      findById: jest.fn(),
      getVoteStatus: jest.fn(),
    };

    const mockOpenQuestionSchema = {
      findAll: jest.fn(),
      findById: jest.fn(),
      getVoteStatus: jest.fn(),
    };

    const mockAnswerSchema = {
      findAll: jest.fn(),
      findById: jest.fn(),
      getVoteStatus: jest.fn(),
    };

    const mockQuantitySchema = {
      findAll: jest.fn(),
      findById: jest.fn(),
      getVoteStatus: jest.fn(),
    };

    const mockEvidenceSchema = {
      findAll: jest.fn(),
      findById: jest.fn(),
      getVoteStatus: jest.fn(),
    };

    const mockVoteSchema = {};
    const mockVisibilityService = {};
    const mockCategoryService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UniversalGraphService,
        { provide: Neo4jService, useValue: mockNeo4jService },
        { provide: StatementSchema, useValue: mockStatementSchema },
        { provide: OpenQuestionSchema, useValue: mockOpenQuestionSchema },
        { provide: AnswerSchema, useValue: mockAnswerSchema },
        { provide: QuantitySchema, useValue: mockQuantitySchema },
        { provide: EvidenceSchema, useValue: mockEvidenceSchema },
        { provide: VoteSchema, useValue: mockVoteSchema },
        { provide: VisibilityService, useValue: mockVisibilityService },
        { provide: CategoryService, useValue: mockCategoryService },
      ],
    }).compile();

    service = module.get<UniversalGraphService>(UniversalGraphService);
    neo4jService = module.get(Neo4jService);
    statementSchema = module.get(StatementSchema);
    openQuestionSchema = module.get(OpenQuestionSchema);
    answerSchema = module.get(AnswerSchema);
    quantitySchema = module.get(QuantitySchema);
    evidenceSchema = module.get(EvidenceSchema);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // NODE FETCHING TESTS
  // ============================================
  describe('Node Fetching with Schema Integration', () => {
    it('should fetch statements using StatementSchema.findAll()', async () => {
      const mockStatements = [
        {
          id: 'stmt-1',
          statement: 'AI will transform society',
          createdBy: 'user-123',
          publicCredit: true,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          inclusionPositiveVotes: 10,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 8,
          contentPositiveVotes: 7,
          contentNegativeVotes: 1,
          contentNetVotes: 6,
          discussionId: null,
          keywords: [{ word: 'ai', frequency: 0.9, source: 'ai' as const }],
          categories: [{ id: 'cat-1', name: 'Technology' }],
        },
      ];

      statementSchema.findAll.mockResolvedValue(mockStatements as any);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
      });

      expect(statementSchema.findAll).toHaveBeenCalledWith({
        minInclusionVotes: -5,
        includeKeywords: true,
        includeCategories: true,
        includeDiscussion: true,
        limit: 10000,
      });
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('statement');
      expect(result.nodes[0].content).toBe('AI will transform society');
      expect(result.nodes[0].contentNetVotes).toBe(6);
    });

    it('should fetch open questions and apply content vote fallback', async () => {
      const mockQuestions = [
        {
          id: 'q-1',
          questionText: 'What is AI?',
          createdBy: 'user-123',
          publicCredit: true,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          inclusionPositiveVotes: 5,
          inclusionNegativeVotes: 1,
          inclusionNetVotes: 4,
          discussionId: null,
          keywords: [{ word: 'ai', frequency: 0.8, source: 'ai' as const }],
          categories: [],
        },
      ];

      statementSchema.findAll.mockResolvedValue([]);
      openQuestionSchema.findAll.mockResolvedValue(mockQuestions as any);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);

      const result = await service.getUniversalNodes({
        node_types: ['openquestion'],
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('openquestion');
      expect(result.nodes[0].inclusionNetVotes).toBe(4);
      // ✅ Content votes should fall back to inclusion
      expect(result.nodes[0].contentNetVotes).toBe(4);
      expect(result.nodes[0].contentPositiveVotes).toBe(0);
      expect(result.nodes[0].contentNegativeVotes).toBe(0);
    });

    it('should fetch answers with parent question info', async () => {
      const mockAnswers = [
        {
          id: 'ans-1',
          answerText: 'AI is artificial intelligence',
          parentQuestionId: 'q-1',
          createdBy: 'user-456',
          publicCredit: true,
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
          inclusionPositiveVotes: 8,
          inclusionNegativeVotes: 1,
          inclusionNetVotes: 7,
          contentPositiveVotes: 6,
          contentNegativeVotes: 0,
          contentNetVotes: 6,
          discussionId: null,
          keywords: [],
          categories: [],
        },
      ];

      // Mock findById to return answer with parent question text
      const mockFullAnswer = {
        ...mockAnswers[0],
        parentQuestionText: 'What is AI?',
      };

      statementSchema.findAll.mockResolvedValue([]);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue(mockAnswers as any);
      answerSchema.findById.mockResolvedValue(mockFullAnswer as any);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);

      const result = await service.getUniversalNodes({
        node_types: ['answer'],
      });

      expect(answerSchema.findById).toHaveBeenCalledWith('ans-1');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('answer');
      expect(result.nodes[0].metadata.parentQuestion).toBeDefined();
      expect(result.nodes[0].metadata.parentQuestion?.nodeId).toBe('q-1');
      expect(result.nodes[0].metadata.parentQuestion?.nodeType).toBe(
        'openquestion',
      );
      expect(result.nodes[0].metadata.parentQuestion?.questionText).toBe(
        'What is AI?',
      );
    });

    it('should fetch quantities and apply content vote fallback', async () => {
      const mockQuantities = [
        {
          id: 'qty-1',
          question: 'Average human weight?',
          unitCategoryId: 'mass',
          defaultUnitId: 'kg',
          createdBy: 'user-789',
          publicCredit: true,
          createdAt: new Date('2025-01-03'),
          updatedAt: new Date('2025-01-03'),
          inclusionPositiveVotes: 6,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 4,
          discussionId: null,
          keywords: [{ word: 'weight', frequency: 0.7, source: 'ai' as const }],
          categories: [],
        },
      ];

      statementSchema.findAll.mockResolvedValue([]);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue(mockQuantities as any);
      evidenceSchema.findAll.mockResolvedValue([]);

      const result = await service.getUniversalNodes({
        node_types: ['quantity'],
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('quantity');
      expect(result.nodes[0].content).toBe('Average human weight?');
      expect(result.nodes[0].inclusionNetVotes).toBe(4);
      // ✅ Content votes should fall back to inclusion
      expect(result.nodes[0].contentNetVotes).toBe(4);
    });

    it('should fetch evidence with parent node info and apply content vote fallback', async () => {
      const mockEvidence = [
        {
          id: 'ev-1',
          title: 'Peer-reviewed study on AI',
          url: 'https://example.com/study',
          evidenceType: 'academic_paper' as const, // ✅ Correct type
          parentNodeId: 'stmt-1',
          parentNodeType: 'StatementNode' as const, // ✅ Correct type
          createdBy: 'user-999',
          publicCredit: true,
          createdAt: new Date('2025-01-04'),
          updatedAt: new Date('2025-01-04'),
          inclusionPositiveVotes: 12,
          inclusionNegativeVotes: 1,
          inclusionNetVotes: 11,
          discussionId: null,
          keywords: [{ word: 'study', frequency: 0.8, source: 'ai' as const }],
          categories: [],
        },
      ];

      // Mock findById to return evidence with parent info
      const mockFullEvidence = {
        ...mockEvidence[0],
        parentInfo: {
          id: 'stmt-1',
          type: 'statement',
          title: 'AI will transform society',
        },
      };

      statementSchema.findAll.mockResolvedValue([]);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue(mockEvidence as any);
      evidenceSchema.findById.mockResolvedValue(mockFullEvidence as any);

      const result = await service.getUniversalNodes({
        node_types: ['evidence'],
      });

      expect(evidenceSchema.findById).toHaveBeenCalledWith('ev-1');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('evidence');
      expect(result.nodes[0].content).toBe('Peer-reviewed study on AI');
      expect(result.nodes[0].inclusionNetVotes).toBe(11);
      // ✅ Content votes should fall back to inclusion
      expect(result.nodes[0].contentNetVotes).toBe(11);
      // ✅ Parent node info should be included
      expect(result.nodes[0].metadata.parentNode).toBeDefined();
      expect(result.nodes[0].metadata.parentNode?.nodeId).toBe('stmt-1');
      expect(result.nodes[0].metadata.sourceUrl).toBe(
        'https://example.com/study',
      );
    });
  });

  // ============================================
  // FILTERING TESTS
  // ============================================
  describe('Filtering', () => {
    beforeEach(() => {
      statementSchema.findAll.mockResolvedValue([
        {
          id: 'stmt-1',
          statement: 'AI statement',
          createdBy: 'user-1',
          publicCredit: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          inclusionNetVotes: 5,
          contentNetVotes: 3,
          keywords: [{ word: 'ai', frequency: 0.8, source: 'ai' as const }],
          categories: [{ id: 'cat-tech', name: 'Technology' }],
        },
        {
          id: 'stmt-2',
          statement: 'Ethics statement',
          createdBy: 'user-2',
          publicCredit: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          inclusionNetVotes: 3,
          contentNetVotes: 2,
          keywords: [
            { word: 'ethics', frequency: 0.7, source: 'user' as const },
          ],
          categories: [{ id: 'cat-phil', name: 'Philosophy' }],
        },
      ] as any);

      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);
    });

    it('should filter by keywords (include mode)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        keywords: ['ai'],
        includeKeywordsFilter: true,
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('stmt-1');
    });

    it('should filter by keywords (exclude mode)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        keywords: ['ai'],
        includeKeywordsFilter: false,
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('stmt-2');
    });

    it('should filter by categories (include mode)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        categories: ['cat-tech'],
        includeCategoriesFilter: true,
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('stmt-1');
    });

    it('should filter by user', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        user_id: 'user-1',
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].createdBy).toBe('user-1');
    });
  });

  // ============================================
  // SORTING TESTS
  // ============================================
  describe('Sorting', () => {
    beforeEach(() => {
      statementSchema.findAll.mockResolvedValue([
        {
          id: 'stmt-1',
          statement: 'Statement 1',
          createdBy: 'user-1',
          publicCredit: true,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-03'),
          inclusionNetVotes: 10,
          contentNetVotes: 8,
          inclusionPositiveVotes: 12,
          inclusionNegativeVotes: 2,
          contentPositiveVotes: 9,
          contentNegativeVotes: 1,
          keywords: [],
          categories: [],
        },
        {
          id: 'stmt-2',
          statement: 'Statement 2',
          createdBy: 'user-2',
          publicCredit: true,
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
          inclusionNetVotes: 5,
          contentNetVotes: 3,
          inclusionPositiveVotes: 6,
          inclusionNegativeVotes: 1,
          contentPositiveVotes: 4,
          contentNegativeVotes: 1,
          keywords: [],
          categories: [],
        },
      ] as any);

      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);
    });

    it('should sort by netVotes DESC (default)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
      });

      expect(result.nodes[0].id).toBe('stmt-1');
      expect(result.nodes[1].id).toBe('stmt-2');
    });

    it('should sort by content_votes', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        sort_by: 'content_votes',
      });

      expect(result.nodes[0].id).toBe('stmt-1');
      expect(result.nodes[1].id).toBe('stmt-2');
    });
  });

  // ============================================
  // PAGINATION TESTS
  // ============================================
  describe('Pagination', () => {
    beforeEach(() => {
      const mockStatements = Array.from({ length: 10 }, (_, i) => ({
        id: `stmt-${i + 1}`,
        statement: `Statement ${i + 1}`,
        createdBy: 'user-1',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 10 - i,
        contentNetVotes: 8 - i,
        keywords: [],
        categories: [],
      }));

      statementSchema.findAll.mockResolvedValue(mockStatements as any);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);
    });

    it('should paginate results', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        limit: 5,
      });

      expect(result.nodes).toHaveLength(5);
      expect(result.total_count).toBe(10);
      expect(result.has_more).toBe(true);
    });

    it('should handle offset pagination', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        limit: 5,
        offset: 5,
      });

      expect(result.nodes).toHaveLength(5);
      expect(result.nodes[0].id).toBe('stmt-6');
      expect(result.has_more).toBe(false);
    });
  });

  // ============================================
  // AVAILABLE KEYWORDS/CATEGORIES TESTS
  // ============================================
  describe('getAvailableKeywords', () => {
    it('should return keywords with usage counts', async () => {
      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([
          {
            word: 'ai',
            usageCount: { toInt: () => 25 },
          },
          {
            word: 'ethics',
            usageCount: { toInt: () => 15 },
          },
        ]) as any,
      );

      const result = await service.getAvailableKeywords();

      expect(result).toHaveLength(2);
      expect(result[0].word).toBe('ai');
      expect(result[0].usageCount).toBe(25);
    });

    it('should return empty array on error', async () => {
      neo4jService.read.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.getAvailableKeywords();

      expect(result).toEqual([]);
    });
  });

  describe('getAvailableCategories', () => {
    it('should return categories with usage counts', async () => {
      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([
          {
            id: 'cat-1',
            name: 'Technology',
            description: 'Tech category',
            usageCount: { toInt: () => 15 },
          },
        ]) as any,
      );

      const result = await service.getAvailableCategories();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cat-1');
    });
  });

  // ============================================
  // USER CONTEXT ENRICHMENT TESTS
  // ============================================
  describe('User Context Enrichment', () => {
    beforeEach(() => {
      statementSchema.findAll.mockResolvedValue([
        {
          id: 'stmt-1',
          statement: 'Test',
          createdBy: 'user-1',
          publicCredit: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          inclusionNetVotes: 5,
          contentNetVotes: 3,
          keywords: [],
          categories: [],
        },
      ] as any);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);
    });

    it('should enrich nodes with user vote status', async () => {
      statementSchema.getVoteStatus.mockResolvedValue({
        inclusionStatus: 'agree' as const,
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 5,
        contentStatus: 'agree' as const,
        contentPositiveVotes: 3,
        contentNegativeVotes: 0,
        contentNetVotes: 3,
      });

      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([
          { kind: 'INCLUSION', status: 'agree' },
          { kind: 'CONTENT', status: 'agree' },
        ]) as any,
      );

      neo4jService.read.mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        requesting_user_id: 'user-123',
      });

      expect(result.nodes[0].metadata.userVoteStatus).toBeDefined();
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  describe('Error Handling', () => {
    it('should handle schema findAll errors gracefully', async () => {
      statementSchema.findAll.mockRejectedValue(new Error('Database error'));
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
      });

      expect(result.nodes).toHaveLength(0);
    });
  });
});
