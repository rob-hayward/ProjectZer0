// src/nodes/universal/universal-graph.service.spec.ts
// ✅ Phase 4.1: Updated to mock schema methods with correct types
// ✅ Phase 4.2: Added tests for ANY/ALL filtering modes and user interaction filtering

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

describe('UniversalGraphService - Phase 4.1 & 4.2', () => {
  let service: UniversalGraphService;
  let neo4jService: jest.Mocked<Neo4jService>;
  let statementSchema: jest.Mocked<StatementSchema>;
  let openQuestionSchema: jest.Mocked<OpenQuestionSchema>;
  let answerSchema: jest.Mocked<AnswerSchema>;
  let quantitySchema: jest.Mocked<QuantitySchema>;
  let evidenceSchema: jest.Mocked<EvidenceSchema>;
  let visibilityService: jest.Mocked<VisibilityService>;

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

    const mockVisibilityService = {
      getUserVisibilityPreferences: jest.fn(),
    };

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
    visibilityService = module.get(VisibilityService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // NODE FETCHING TESTS (Phase 4.1)
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
          createdBy: 'user-456',
          publicCredit: true,
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
          inclusionPositiveVotes: 8,
          inclusionNegativeVotes: 3,
          inclusionNetVotes: 5,
          discussionId: null,
          keywords: [{ word: 'ai', frequency: 0.95, source: 'user' as const }],
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
      expect(result.nodes[0].inclusionNetVotes).toBe(5);
      // ✅ Content votes should fall back to inclusion
      expect(result.nodes[0].contentNetVotes).toBe(5);
    });

    it('should fetch answers with parent question info', async () => {
      const mockAnswers = [
        {
          id: 'ans-1',
          answerText: 'AI is artificial intelligence',
          parentQuestionId: 'q-1',
          createdBy: 'user-789',
          publicCredit: true,
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
          inclusionPositiveVotes: 12,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 10,
          contentPositiveVotes: 9,
          contentNegativeVotes: 1,
          contentNetVotes: 8,
          discussionId: null,
          keywords: [],
          categories: [],
        },
      ];

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
          evidenceType: 'academic_paper' as const,
          parentNodeId: 'stmt-1',
          parentNodeType: 'StatementNode' as const,
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
  // PHASE 4.2: KEYWORD FILTERING ANY/ALL MODES
  // ============================================
  describe('Phase 4.2: Keyword Filtering with ANY/ALL Modes', () => {
    const mockNodes = [
      {
        id: 'stmt-1',
        statement: 'AI and ethics',
        createdBy: 'user-1',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 5,
        contentNetVotes: 3,
        keywords: [
          { word: 'ai', frequency: 0.8, source: 'ai' as const },
          { word: 'ethics', frequency: 0.7, source: 'ai' as const },
        ],
        categories: [],
      },
      {
        id: 'stmt-2',
        statement: 'Only AI',
        createdBy: 'user-2',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 3,
        contentNetVotes: 2,
        keywords: [{ word: 'ai', frequency: 0.9, source: 'user' as const }],
        categories: [],
      },
      {
        id: 'stmt-3',
        statement: 'Only ethics',
        createdBy: 'user-3',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 4,
        contentNetVotes: 2,
        keywords: [
          { word: 'ethics', frequency: 0.85, source: 'user' as const },
        ],
        categories: [],
      },
    ];

    beforeEach(() => {
      statementSchema.findAll.mockResolvedValue(mockNodes as any);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);
    });

    it('should filter by keywords with ANY mode (include)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        keywords: ['ai', 'ethics'],
        includeKeywordsFilter: true,
        keywordMode: 'any',
      });

      // Should include all 3 nodes (all have at least one of the keywords)
      expect(result.nodes).toHaveLength(3);
    });

    it('should filter by keywords with ALL mode (include)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        keywords: ['ai', 'ethics'],
        includeKeywordsFilter: true,
        keywordMode: 'all',
      });

      // Should only include stmt-1 (has both keywords)
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('stmt-1');
    });

    it('should filter by keywords with ANY mode (exclude)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        keywords: ['ai'],
        includeKeywordsFilter: false,
        keywordMode: 'any',
      });

      // Should only include stmt-3 (doesn't have 'ai')
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('stmt-3');
    });

    it('should filter by keywords with ALL mode (exclude)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        keywords: ['ai', 'ethics'],
        includeKeywordsFilter: false,
        keywordMode: 'all',
      });

      // Should include stmt-2 and stmt-3 (don't have both keywords)
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.map((n) => n.id)).toContain('stmt-2');
      expect(result.nodes.map((n) => n.id)).toContain('stmt-3');
    });

    it('should default to ANY mode when keywordMode not specified', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        keywords: ['ai', 'ethics'],
        includeKeywordsFilter: true,
        // keywordMode not specified - should default to 'any'
      });

      // Should include all 3 nodes
      expect(result.nodes).toHaveLength(3);
    });
  });

  // ============================================
  // PHASE 4.2: CATEGORY FILTERING ANY/ALL MODES
  // ============================================
  describe('Phase 4.2: Category Filtering with ANY/ALL Modes', () => {
    const mockNodes = [
      {
        id: 'stmt-1',
        statement: 'Tech and science',
        createdBy: 'user-1',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 5,
        contentNetVotes: 3,
        keywords: [],
        categories: [
          { id: 'cat-tech', name: 'Technology' },
          { id: 'cat-sci', name: 'Science' },
        ],
      },
      {
        id: 'stmt-2',
        statement: 'Only tech',
        createdBy: 'user-2',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 3,
        contentNetVotes: 2,
        keywords: [],
        categories: [{ id: 'cat-tech', name: 'Technology' }],
      },
      {
        id: 'stmt-3',
        statement: 'Only philosophy',
        createdBy: 'user-3',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 4,
        contentNetVotes: 2,
        keywords: [],
        categories: [{ id: 'cat-phil', name: 'Philosophy' }],
      },
    ];

    beforeEach(() => {
      statementSchema.findAll.mockResolvedValue(mockNodes as any);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);
    });

    it('should filter by categories with ANY mode (include)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        categories: ['cat-tech', 'cat-sci'],
        includeCategoriesFilter: true,
        categoryMode: 'any',
      });

      // Should include stmt-1 and stmt-2 (both have at least one category)
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.map((n) => n.id)).toContain('stmt-1');
      expect(result.nodes.map((n) => n.id)).toContain('stmt-2');
    });

    it('should filter by categories with ALL mode (include)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        categories: ['cat-tech', 'cat-sci'],
        includeCategoriesFilter: true,
        categoryMode: 'all',
      });

      // Should only include stmt-1 (has both categories)
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('stmt-1');
    });

    it('should filter by categories with ANY mode (exclude)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        categories: ['cat-tech'],
        includeCategoriesFilter: false,
        categoryMode: 'any',
      });

      // Should only include stmt-3 (doesn't have cat-tech)
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('stmt-3');
    });

    it('should filter by categories with ALL mode (exclude)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        categories: ['cat-tech', 'cat-sci'],
        includeCategoriesFilter: false,
        categoryMode: 'all',
      });

      // Should include stmt-2 and stmt-3 (don't have both categories)
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.map((n) => n.id)).toContain('stmt-2');
      expect(result.nodes.map((n) => n.id)).toContain('stmt-3');
    });

    it('should default to ANY mode when categoryMode not specified', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        categories: ['cat-tech', 'cat-sci'],
        includeCategoriesFilter: true,
        // categoryMode not specified - should default to 'any'
      });

      // Should include stmt-1 and stmt-2
      expect(result.nodes).toHaveLength(2);
    });
  });

  // ============================================
  // PHASE 4.2: USER INTERACTION FILTERING
  // ============================================
  describe('Phase 4.2: User Interaction Filtering', () => {
    const mockNodes = [
      {
        id: 'stmt-1',
        statement: 'Created by user-123',
        createdBy: 'user-123',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 5,
        contentNetVotes: 3,
        keywords: [],
        categories: [],
      },
      {
        id: 'stmt-2',
        statement: 'Created by user-456',
        createdBy: 'user-456',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 3,
        contentNetVotes: 2,
        keywords: [],
        categories: [],
      },
      {
        id: 'stmt-3',
        statement: 'Created by user-789',
        createdBy: 'user-789',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 4,
        contentNetVotes: 2,
        keywords: [],
        categories: [],
      },
    ];

    beforeEach(() => {
      statementSchema.findAll.mockResolvedValue(mockNodes as any);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);
    });

    it('should filter by user with "created" mode', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        user_id: 'user-123',
        userFilterMode: 'created',
      });

      // Should only include nodes created by user-123
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('stmt-1');
      expect(result.nodes[0].createdBy).toBe('user-123');
    });

    it('should filter by user with "voted" mode', async () => {
      // Mock Neo4j query for voted nodes
      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([{ nodeId: 'stmt-1' }, { nodeId: 'stmt-2' }]) as any,
      );

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        user_id: 'user-123',
        userFilterMode: 'voted',
      });

      // Should only include nodes user-123 has voted on
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.map((n) => n.id)).toContain('stmt-1');
      expect(result.nodes.map((n) => n.id)).toContain('stmt-2');
    });

    it('should filter by user with "interacted" mode', async () => {
      // Mock Neo4j query for interacted nodes (voted or commented)
      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([{ nodeId: 'stmt-1' }, { nodeId: 'stmt-3' }]) as any,
      );

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        user_id: 'user-123',
        userFilterMode: 'interacted',
      });

      // Should only include nodes user-123 has interacted with
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.map((n) => n.id)).toContain('stmt-1');
      expect(result.nodes.map((n) => n.id)).toContain('stmt-3');
    });

    it('should not filter when userFilterMode is "all"', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        user_id: 'user-123',
        userFilterMode: 'all',
      });

      // Should include all nodes
      expect(result.nodes).toHaveLength(3);
    });

    it('should default to "all" mode when userFilterMode not specified', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        user_id: 'user-123',
        // userFilterMode not specified - should default to 'all'
      });

      // Should include all nodes
      expect(result.nodes).toHaveLength(3);
    });
  });

  // ============================================
  // COMBINED FILTERS TEST
  // ============================================
  describe('Phase 4.2: Combined Filtering', () => {
    const mockNodes = [
      {
        id: 'stmt-1',
        statement: 'AI ethics tech',
        createdBy: 'user-123',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 5,
        contentNetVotes: 3,
        keywords: [
          { word: 'ai', frequency: 0.8, source: 'ai' as const },
          { word: 'ethics', frequency: 0.7, source: 'ai' as const },
        ],
        categories: [{ id: 'cat-tech', name: 'Technology' }],
      },
      {
        id: 'stmt-2',
        statement: 'AI only',
        createdBy: 'user-456',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 3,
        contentNetVotes: 2,
        keywords: [{ word: 'ai', frequency: 0.9, source: 'user' as const }],
        categories: [{ id: 'cat-tech', name: 'Technology' }],
      },
      {
        id: 'stmt-3',
        statement: 'Ethics only',
        createdBy: 'user-123',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionNetVotes: 4,
        contentNetVotes: 2,
        keywords: [
          { word: 'ethics', frequency: 0.85, source: 'user' as const },
        ],
        categories: [{ id: 'cat-phil', name: 'Philosophy' }],
      },
    ];

    beforeEach(() => {
      statementSchema.findAll.mockResolvedValue(mockNodes as any);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);
    });

    it('should apply keyword ALL + category ANY filters together', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        keywords: ['ai', 'ethics'],
        keywordMode: 'all',
        includeKeywordsFilter: true,
        categories: ['cat-tech', 'cat-phil'],
        categoryMode: 'any',
        includeCategoriesFilter: true,
      });

      // Should only include stmt-1 (has both keywords AND at least one category)
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('stmt-1');
    });

    it('should apply keyword ANY + category ALL + user created filters together', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        keywords: ['ai', 'ethics'],
        keywordMode: 'any',
        includeKeywordsFilter: true,
        categories: ['cat-tech'],
        categoryMode: 'all',
        includeCategoriesFilter: true,
        user_id: 'user-123',
        userFilterMode: 'created',
      });

      // Should only include stmt-1 (has at least one keyword AND has cat-tech AND created by user-123)
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('stmt-1');
    });
  });

  // ============================================
  // SORTING TESTS
  // ============================================
  describe('Sorting', () => {
    const mockNodes = [
      {
        id: 'stmt-1',
        statement: 'High votes',
        createdBy: 'user-1',
        publicCredit: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-03'),
        inclusionPositiveVotes: 10,
        inclusionNegativeVotes: 2,
        inclusionNetVotes: 8,
        contentPositiveVotes: 7,
        contentNegativeVotes: 1,
        contentNetVotes: 6,
        keywords: [],
        categories: [],
      },
      {
        id: 'stmt-2',
        statement: 'Medium votes',
        createdBy: 'user-2',
        publicCredit: true,
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02'),
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 1,
        inclusionNetVotes: 4,
        contentPositiveVotes: 3,
        contentNegativeVotes: 0,
        contentNetVotes: 3,
        keywords: [],
        categories: [],
      },
      {
        id: 'stmt-3',
        statement: 'Low votes',
        createdBy: 'user-3',
        publicCredit: true,
        createdAt: new Date('2025-01-03'),
        updatedAt: new Date('2025-01-01'),
        inclusionPositiveVotes: 2,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 2,
        contentPositiveVotes: 1,
        contentNegativeVotes: 0,
        contentNetVotes: 1,
        keywords: [],
        categories: [],
      },
    ];

    beforeEach(() => {
      statementSchema.findAll.mockResolvedValue(mockNodes as any);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);
    });

    it('should sort by inclusion votes DESC (default)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        sort_by: 'inclusion_votes',
        sort_direction: 'desc',
      });

      expect(result.nodes[0].id).toBe('stmt-1');
      expect(result.nodes[1].id).toBe('stmt-2');
      expect(result.nodes[2].id).toBe('stmt-3');
    });

    it('should sort by content votes DESC', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        sort_by: 'content_votes',
        sort_direction: 'desc',
      });

      expect(result.nodes[0].id).toBe('stmt-1');
      expect(result.nodes[1].id).toBe('stmt-2');
      expect(result.nodes[2].id).toBe('stmt-3');
    });

    it('should sort by chronological ASC', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        sort_by: 'chronological',
        sort_direction: 'asc',
      });

      expect(result.nodes[0].id).toBe('stmt-1'); // 2025-01-01
      expect(result.nodes[1].id).toBe('stmt-2'); // 2025-01-02
      expect(result.nodes[2].id).toBe('stmt-3'); // 2025-01-03
    });

    it('should sort by latest_activity DESC', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        sort_by: 'latest_activity',
        sort_direction: 'desc',
      });

      expect(result.nodes[0].id).toBe('stmt-1'); // updatedAt: 2025-01-03
      expect(result.nodes[1].id).toBe('stmt-2'); // updatedAt: 2025-01-02
      expect(result.nodes[2].id).toBe('stmt-3'); // updatedAt: 2025-01-01
    });

    it('should sort by participants DESC', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        sort_by: 'participants',
        sort_direction: 'desc',
      });

      // stmt-1: 10+2+7+1 = 20 participants
      // stmt-2: 5+1+3+0 = 9 participants
      // stmt-3: 2+0+1+0 = 3 participants
      expect(result.nodes[0].id).toBe('stmt-1');
      expect(result.nodes[1].id).toBe('stmt-2');
      expect(result.nodes[2].id).toBe('stmt-3');
    });
  });

  // ============================================
  // PAGINATION TESTS
  // ============================================
  describe('Pagination', () => {
    const mockNodes = Array.from({ length: 15 }, (_, i) => ({
      id: `stmt-${i + 1}`,
      statement: `Statement ${i + 1}`,
      createdBy: 'user-1',
      publicCredit: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      inclusionNetVotes: 15 - i, // Descending order
      contentNetVotes: 15 - i,
      inclusionPositiveVotes: 15 - i,
      inclusionNegativeVotes: 0,
      contentPositiveVotes: 15 - i,
      contentNegativeVotes: 0,
      keywords: [],
      categories: [],
    }));

    beforeEach(() => {
      statementSchema.findAll.mockResolvedValue(mockNodes as any);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);
    });

    it('should paginate results correctly', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        limit: 5,
        offset: 0,
      });

      expect(result.nodes).toHaveLength(5);
      expect(result.nodes[0].id).toBe('stmt-1');
      expect(result.total_count).toBe(15);
      expect(result.has_more).toBe(true);
    });

    it('should handle offset correctly', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        limit: 5,
        offset: 5,
      });

      expect(result.nodes).toHaveLength(5);
      expect(result.nodes[0].id).toBe('stmt-6');
      expect(result.has_more).toBe(true);
    });

    it('should set has_more to false on last page', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        limit: 5,
        offset: 10,
      });

      expect(result.nodes).toHaveLength(5);
      expect(result.nodes[0].id).toBe('stmt-11');
      expect(result.has_more).toBe(false);
    });
  });

  // ============================================
  // AVAILABLE KEYWORDS/CATEGORIES TESTS
  // ============================================
  describe('getAvailableCategories', () => {
    it('should return categories with usage counts', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Technology',
          description: 'Tech category',
        },
      ];

      // Mock categoryService (need to get it from the module first)
      const mockCategoryService = {
        getAllCategories: jest.fn().mockResolvedValue(mockCategories),
      };

      // Replace the categoryService mock for this test
      (service as any).categoryService = mockCategoryService;

      const result = await service.getAvailableCategories();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cat-1');
      expect(result[0].name).toBe('Technology');
      expect(result[0].usageCount).toBe(0); // Always 0 with TODO comment
    });

    it('should return empty array on error', async () => {
      const mockCategoryService = {
        getAllCategories: jest
          .fn()
          .mockRejectedValue(new Error('Service error')),
      };

      (service as any).categoryService = mockCategoryService;

      const result = await service.getAvailableCategories();

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // USER CONTEXT ENRICHMENT TESTS
  // ============================================
  describe('User Context Enrichment', () => {
    const mockNodes = [
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
    ];

    beforeEach(() => {
      statementSchema.findAll.mockResolvedValue(mockNodes as any);
      openQuestionSchema.findAll.mockResolvedValue([]);
      answerSchema.findAll.mockResolvedValue([]);
      quantitySchema.findAll.mockResolvedValue([]);
      evidenceSchema.findAll.mockResolvedValue([]);
    });

    it('should enrich nodes with user vote status', async () => {
      // Mock getUserVotesForNodes query
      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([
          {
            nodeId: 'stmt-1',
            voteType: 'inclusion',
            isPositive: true,
          },
        ]) as any,
      );

      // Mock visibility preferences
      visibilityService.getUserVisibilityPreferences.mockResolvedValue({});

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        requesting_user_id: 'user-123',
      });

      expect(result.nodes[0].metadata.userVoteStatus).toBeDefined();
      expect(result.nodes[0].metadata.userVoteStatus?.inclusionVote).toBe(
        'positive',
      );
    });

    it('should enrich nodes with visibility preferences', async () => {
      // Mock getUserVotesForNodes query
      neo4jService.read.mockResolvedValueOnce(mockNeo4jResult([]) as any);

      // Mock visibility preferences
      visibilityService.getUserVisibilityPreferences.mockResolvedValue({
        'stmt-1': true,
      });

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        requesting_user_id: 'user-123',
      });

      expect(result.nodes[0].metadata.userVisibilityPreference).toBe('visible');
    });
  });
});
