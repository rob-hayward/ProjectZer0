// src/nodes/universal/universal-graph.service.spec.ts

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

describe('UniversalGraphService - Phase 4.1 Tests', () => {
  let service: UniversalGraphService;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  /**
   * Helper to create mock Neo4j result
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

    const mockVoteSchema = {
      getVoteStatus: jest.fn(),
    };

    const mockVisibilityService = {};

    const mockCategoryService = {};

    const mockStatementSchema = {};
    const mockOpenQuestionSchema = {};
    const mockAnswerSchema = {};
    const mockQuantitySchema = {};
    const mockEvidenceSchema = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UniversalGraphService,
        { provide: Neo4jService, useValue: mockNeo4jService },
        { provide: VoteSchema, useValue: mockVoteSchema },
        { provide: VisibilityService, useValue: mockVisibilityService },
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: StatementSchema, useValue: mockStatementSchema },
        { provide: OpenQuestionSchema, useValue: mockOpenQuestionSchema },
        { provide: AnswerSchema, useValue: mockAnswerSchema },
        { provide: QuantitySchema, useValue: mockQuantitySchema },
        { provide: EvidenceSchema, useValue: mockEvidenceSchema },
      ],
    }).compile();

    service = module.get<UniversalGraphService>(UniversalGraphService);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // BASIC FETCH TESTS
  // ============================================
  describe('getUniversalNodes - Basic Fetching', () => {
    it('should fetch nodes with default parameters (statement + openquestion)', async () => {
      // Mock statements
      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([
          {
            s: {
              properties: {
                id: 'stmt-1',
                statement: 'Test statement',
                createdBy: 'user-1',
                publicCredit: true,
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-01T00:00:00Z',
                inclusionPositiveVotes: 5,
                inclusionNegativeVotes: 1,
                inclusionNetVotes: 4,
                contentPositiveVotes: 3,
                contentNegativeVotes: 0,
                contentNetVotes: 3,
              },
            },
            discussionId: 'disc-1',
            keywords: [{ word: 'test', frequency: 0.8, source: 'ai' }],
            categories: [{ id: 'cat-1', name: 'Technology' }],
          },
        ]) as any,
      );

      // Mock open questions
      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([
          {
            q: {
              properties: {
                id: 'q-1',
                questionText: 'Test question?',
                createdBy: 'user-1',
                publicCredit: true,
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-01T00:00:00Z',
                inclusionPositiveVotes: 3,
                inclusionNegativeVotes: 0,
                inclusionNetVotes: 3,
              },
            },
            discussionId: 'disc-2',
            keywords: [{ word: 'question', frequency: 0.9, source: 'ai' }],
            categories: [{ id: 'cat-1', name: 'Technology' }],
          },
        ]) as any,
      );

      const result = await service.getUniversalNodes({});

      expect(neo4jService.read).toHaveBeenCalledTimes(2); // Statements + questions
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0].type).toBe('statement');
      expect(result.nodes[0].content).toBe('Test statement');
      expect(result.nodes[1].type).toBe('openquestion');
      expect(result.nodes[1].content).toBe('Test question?');
      expect(result.total_count).toBe(2);
      expect(result.has_more).toBe(false);
    });

    it('should fetch only specified node types', async () => {
      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([
          {
            s: {
              properties: {
                id: 'stmt-1',
                statement: 'Test',
                createdBy: 'user-1',
                publicCredit: true,
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-01T00:00:00Z',
                inclusionNetVotes: 1,
                contentNetVotes: 1,
              },
            },
            discussionId: null,
            keywords: [],
            categories: [],
          },
        ]) as any,
      );

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        includeNodeTypes: true,
      });

      expect(neo4jService.read).toHaveBeenCalledTimes(1); // Only statements
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('statement');
    });

    it('should fetch all 5 node types when requested', async () => {
      // Mock all 5 node types
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Test',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              q: {
                properties: {
                  id: 'q-1',
                  questionText: 'Test?',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              a: {
                properties: {
                  id: 'ans-1',
                  answerText: 'Answer',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              parentQuestionId: 'q-1',
              parentQuestionText: 'Test?',
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              qty: {
                properties: {
                  id: 'qty-1',
                  definition: 'Quantity',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  measurementUnit: 'kg',
                  value: 10,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              ev: {
                properties: {
                  id: 'ev-1',
                  title: 'Evidence',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  sourceUrl: 'http://example.com',
                  isPeerReviewed: true,
                },
              },
              discussionId: null,
              parentNodeId: 'stmt-1',
              parentNodeType: 'StatementNode',
              parentContent: 'Test',
              keywords: [],
              categories: [],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: [
          'statement',
          'openquestion',
          'answer',
          'quantity',
          'evidence',
        ],
      });

      expect(neo4jService.read).toHaveBeenCalledTimes(5);
      expect(result.nodes).toHaveLength(5);
      expect(result.nodes.map((n) => n.type)).toEqual([
        'statement',
        'openquestion',
        'answer',
        'quantity',
        'evidence',
      ]);
    });

    it('should exclude specified node types', async () => {
      // Mock statements only
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              q: {
                properties: {
                  id: 'q-1',
                  questionText: 'Test?',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              a: {
                properties: {
                  id: 'ans-1',
                  answerText: 'Answer',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              parentQuestionId: 'q-1',
              parentQuestionText: 'Test?',
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              qty: {
                properties: {
                  id: 'qty-1',
                  definition: 'Quantity',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              ev: {
                properties: {
                  id: 'ev-1',
                  title: 'Evidence',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                },
              },
              discussionId: null,
              parentNodeId: 'stmt-1',
              parentNodeType: 'StatementNode',
              parentContent: 'Test',
              keywords: [],
              categories: [],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['statement'], // Exclude statement
        includeNodeTypes: false, // Exclude mode
      });

      // Should fetch all except statement
      expect(result.nodes).toHaveLength(4);
      expect(result.nodes.find((n) => n.type === 'statement')).toBeUndefined();
    });
  });

  // ============================================
  // TRANSFORMATION TESTS
  // ============================================
  describe('Node Transformations', () => {
    it('should correctly transform Statement nodes', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'AI transforms society',
                  createdBy: 'user-123',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-02T00:00:00Z',
                  inclusionPositiveVotes: 10,
                  inclusionNegativeVotes: 2,
                  inclusionNetVotes: 8,
                  contentPositiveVotes: 5,
                  contentNegativeVotes: 1,
                  contentNetVotes: 4,
                },
              },
              discussionId: 'disc-123',
              keywords: [
                { word: 'ai', frequency: 0.9, source: 'ai' },
                { word: 'society', frequency: 0.7, source: 'ai' },
              ],
              categories: [
                { id: 'cat-1', name: 'Technology', description: 'Tech topics' },
              ],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
      });

      const node = result.nodes[0];
      expect(node.type).toBe('statement');
      expect(node.content).toBe('AI transforms society');
      expect(node.createdBy).toBe('user-123');
      expect(node.publicCredit).toBe(true);
      expect(node.inclusionNetVotes).toBe(8);
      expect(node.contentNetVotes).toBe(4);
      expect(node.discussionId).toBe('disc-123');
      expect(node.keywords).toHaveLength(2);
      expect(node.categories).toHaveLength(1);
    });

    it('should correctly transform OpenQuestion nodes with content vote fallback', async () => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              q: {
                properties: {
                  id: 'q-1',
                  questionText: 'What is consciousness?',
                  createdBy: 'user-456',
                  publicCredit: false,
                  createdAt: '2025-01-03T00:00:00Z',
                  updatedAt: '2025-01-03T00:00:00Z',
                  inclusionPositiveVotes: 7,
                  inclusionNegativeVotes: 1,
                  inclusionNetVotes: 6,
                },
              },
              discussionId: 'disc-456',
              keywords: [
                { word: 'consciousness', frequency: 1.0, source: 'user' },
              ],
              categories: [{ id: 'cat-2', name: 'Philosophy' }],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['openquestion'],
      });

      const node = result.nodes[0];
      expect(node.type).toBe('openquestion');
      expect(node.content).toBe('What is consciousness?');
      expect(node.inclusionNetVotes).toBe(6);
      expect(node.contentPositiveVotes).toBe(0);
      expect(node.contentNegativeVotes).toBe(0);
      expect(node.contentNetVotes).toBe(6); // ✅ Fallback to inclusion
    });

    it('should correctly transform Answer nodes with parent question info', async () => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              a: {
                properties: {
                  id: 'ans-1',
                  answerText: 'It is the state of awareness',
                  createdBy: 'user-789',
                  publicCredit: true,
                  createdAt: '2025-01-04T00:00:00Z',
                  updatedAt: '2025-01-04T00:00:00Z',
                  inclusionPositiveVotes: 5,
                  inclusionNegativeVotes: 0,
                  inclusionNetVotes: 5,
                  contentPositiveVotes: 8,
                  contentNegativeVotes: 2,
                  contentNetVotes: 6,
                },
              },
              discussionId: 'disc-789',
              parentQuestionId: 'q-1',
              parentQuestionText: 'What is consciousness?',
              keywords: [{ word: 'awareness', frequency: 0.8, source: 'ai' }],
              categories: [],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['answer'],
      });

      const node = result.nodes[0];
      expect(node.type).toBe('answer');
      expect(node.content).toBe('It is the state of awareness');
      expect(node.contentNetVotes).toBe(6); // ✅ Has real content votes
      expect(node.metadata.parentQuestion).toBeDefined();
      expect(node.metadata.parentQuestion?.nodeId).toBe('q-1');
      expect(node.metadata.parentQuestion?.nodeType).toBe('openquestion');
      expect(node.metadata.parentQuestion?.questionText).toBe(
        'What is consciousness?',
      );
    });

    it('should correctly transform Quantity nodes with fallback and measurement info', async () => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              qty: {
                properties: {
                  id: 'qty-1',
                  definition: 'Average human weight',
                  createdBy: 'user-111',
                  publicCredit: true,
                  createdAt: '2025-01-05T00:00:00Z',
                  updatedAt: '2025-01-05T00:00:00Z',
                  inclusionPositiveVotes: 4,
                  inclusionNegativeVotes: 1,
                  inclusionNetVotes: 3,
                  measurementUnit: 'kg',
                  value: 70,
                },
              },
              discussionId: null,
              keywords: [{ word: 'weight', frequency: 0.9, source: 'ai' }],
              categories: [{ id: 'cat-3', name: 'Health' }],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['quantity'],
      });

      const node = result.nodes[0];
      expect(node.type).toBe('quantity');
      expect(node.content).toBe('Average human weight');
      expect(node.inclusionNetVotes).toBe(3);
      expect(node.contentNetVotes).toBe(3); // ✅ Fallback to inclusion
      expect(node.metadata.measurementUnit).toBe('kg');
      expect(node.metadata.value).toBe(70);
    });

    it('should correctly transform Evidence nodes with parent node info', async () => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              ev: {
                properties: {
                  id: 'ev-1',
                  title: 'Peer-reviewed study on AI impact',
                  createdBy: 'user-222',
                  publicCredit: true,
                  createdAt: '2025-01-06T00:00:00Z',
                  updatedAt: '2025-01-06T00:00:00Z',
                  inclusionPositiveVotes: 10,
                  inclusionNegativeVotes: 0,
                  inclusionNetVotes: 10,
                  sourceUrl: 'https://journal.example.com/ai-study',
                  isPeerReviewed: true,
                },
              },
              discussionId: null,
              parentNodeId: 'stmt-1',
              parentNodeType: 'StatementNode',
              parentContent: 'AI transforms society',
              keywords: [{ word: 'study', frequency: 0.7, source: 'ai' }],
              categories: [{ id: 'cat-1', name: 'Technology' }],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['evidence'],
      });

      const node = result.nodes[0];
      expect(node.type).toBe('evidence');
      expect(node.content).toBe('Peer-reviewed study on AI impact');
      expect(node.contentNetVotes).toBe(10); // ✅ Fallback to inclusion
      expect(node.metadata.parentNode).toBeDefined();
      expect(node.metadata.parentNode?.nodeId).toBe('stmt-1');
      expect(node.metadata.parentNode?.nodeType).toBe('StatementNode');
      expect(node.metadata.parentNode?.content).toBe('AI transforms society');
      expect(node.metadata.sourceUrl).toBe(
        'https://journal.example.com/ai-study',
      );
      expect(node.metadata.isPeerReviewed).toBe(true);
    });
  });

  // ============================================
  // FILTERING TESTS
  // ============================================
  describe('Filtering', () => {
    describe('Keyword Filtering', () => {
      beforeEach(() => {
        neo4jService.read
          .mockResolvedValueOnce(
            mockNeo4jResult([
              {
                s: {
                  properties: {
                    id: 'stmt-1',
                    statement: 'AI statement',
                    createdBy: 'user-1',
                    publicCredit: true,
                    createdAt: '2025-01-01T00:00:00Z',
                    updatedAt: '2025-01-01T00:00:00Z',
                    inclusionNetVotes: 1,
                    contentNetVotes: 1,
                  },
                },
                discussionId: null,
                keywords: [{ word: 'ai', frequency: 0.8 }],
                categories: [],
              },
              {
                s: {
                  properties: {
                    id: 'stmt-2',
                    statement: 'Other statement',
                    createdBy: 'user-1',
                    publicCredit: true,
                    createdAt: '2025-01-01T00:00:00Z',
                    updatedAt: '2025-01-01T00:00:00Z',
                    inclusionNetVotes: 1,
                    contentNetVotes: 1,
                  },
                },
                discussionId: null,
                keywords: [{ word: 'other', frequency: 0.8 }],
                categories: [],
              },
            ]) as any,
          )
          .mockResolvedValueOnce(mockNeo4jResult([]) as any);
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

      it('should be case-insensitive', async () => {
        const result = await service.getUniversalNodes({
          node_types: ['statement'],
          keywords: ['AI'], // Uppercase
          includeKeywordsFilter: true,
        });

        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0].id).toBe('stmt-1');
      });
    });

    describe('Category Filtering', () => {
      beforeEach(() => {
        neo4jService.read
          .mockResolvedValueOnce(
            mockNeo4jResult([
              {
                s: {
                  properties: {
                    id: 'stmt-1',
                    statement: 'Tech statement',
                    createdBy: 'user-1',
                    publicCredit: true,
                    createdAt: '2025-01-01T00:00:00Z',
                    updatedAt: '2025-01-01T00:00:00Z',
                    inclusionNetVotes: 1,
                    contentNetVotes: 1,
                  },
                },
                discussionId: null,
                keywords: [],
                categories: [{ id: 'cat-tech', name: 'Technology' }],
              },
              {
                s: {
                  properties: {
                    id: 'stmt-2',
                    statement: 'Science statement',
                    createdBy: 'user-1',
                    publicCredit: true,
                    createdAt: '2025-01-01T00:00:00Z',
                    updatedAt: '2025-01-01T00:00:00Z',
                    inclusionNetVotes: 1,
                    contentNetVotes: 1,
                  },
                },
                discussionId: null,
                keywords: [],
                categories: [{ id: 'cat-science', name: 'Science' }],
              },
            ]) as any,
          )
          .mockResolvedValueOnce(mockNeo4jResult([]) as any);
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

      it('should filter by categories (exclude mode)', async () => {
        const result = await service.getUniversalNodes({
          node_types: ['statement'],
          categories: ['cat-tech'],
          includeCategoriesFilter: false,
        });

        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0].id).toBe('stmt-2');
      });
    });

    describe('User Filtering', () => {
      beforeEach(() => {
        neo4jService.read
          .mockResolvedValueOnce(
            mockNeo4jResult([
              {
                s: {
                  properties: {
                    id: 'stmt-1',
                    statement: 'User 1 statement',
                    createdBy: 'user-1',
                    publicCredit: true,
                    createdAt: '2025-01-01T00:00:00Z',
                    updatedAt: '2025-01-01T00:00:00Z',
                    inclusionNetVotes: 1,
                    contentNetVotes: 1,
                  },
                },
                discussionId: null,
                keywords: [],
                categories: [],
              },
              {
                s: {
                  properties: {
                    id: 'stmt-2',
                    statement: 'User 2 statement',
                    createdBy: 'user-2',
                    publicCredit: true,
                    createdAt: '2025-01-01T00:00:00Z',
                    updatedAt: '2025-01-01T00:00:00Z',
                    inclusionNetVotes: 1,
                    contentNetVotes: 1,
                  },
                },
                discussionId: null,
                keywords: [],
                categories: [],
              },
            ]) as any,
          )
          .mockResolvedValueOnce(mockNeo4jResult([]) as any);
      });

      it('should filter by user_id', async () => {
        const result = await service.getUniversalNodes({
          node_types: ['statement'],
          user_id: 'user-1',
        });

        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0].createdBy).toBe('user-1');
      });
    });

    describe('Combined Filtering', () => {
      it('should apply multiple filters together', async () => {
        neo4jService.read
          .mockResolvedValueOnce(
            mockNeo4jResult([
              {
                s: {
                  properties: {
                    id: 'stmt-1',
                    statement: 'Matches all',
                    createdBy: 'user-1',
                    publicCredit: true,
                    createdAt: '2025-01-01T00:00:00Z',
                    updatedAt: '2025-01-01T00:00:00Z',
                    inclusionNetVotes: 1,
                    contentNetVotes: 1,
                  },
                },
                discussionId: null,
                keywords: [{ word: 'ai', frequency: 0.8 }],
                categories: [{ id: 'cat-tech', name: 'Technology' }],
              },
              {
                s: {
                  properties: {
                    id: 'stmt-2',
                    statement: 'Wrong user',
                    createdBy: 'user-2',
                    publicCredit: true,
                    createdAt: '2025-01-01T00:00:00Z',
                    updatedAt: '2025-01-01T00:00:00Z',
                    inclusionNetVotes: 1,
                    contentNetVotes: 1,
                  },
                },
                discussionId: null,
                keywords: [{ word: 'ai', frequency: 0.8 }],
                categories: [{ id: 'cat-tech', name: 'Technology' }],
              },
              {
                s: {
                  properties: {
                    id: 'stmt-3',
                    statement: 'Wrong keyword',
                    createdBy: 'user-1',
                    publicCredit: true,
                    createdAt: '2025-01-01T00:00:00Z',
                    updatedAt: '2025-01-01T00:00:00Z',
                    inclusionNetVotes: 1,
                    contentNetVotes: 1,
                  },
                },
                discussionId: null,
                keywords: [{ word: 'other', frequency: 0.8 }],
                categories: [{ id: 'cat-tech', name: 'Technology' }],
              },
            ]) as any,
          )
          .mockResolvedValueOnce(mockNeo4jResult([]) as any);

        const result = await service.getUniversalNodes({
          node_types: ['statement'],
          keywords: ['ai'],
          includeKeywordsFilter: true,
          categories: ['cat-tech'],
          includeCategoriesFilter: true,
          user_id: 'user-1',
        });

        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0].id).toBe('stmt-1');
      });
    });
  });

  // ============================================
  // SORTING TESTS
  // ============================================
  describe('Sorting', () => {
    const mockStatements = [
      {
        s: {
          properties: {
            id: 'stmt-1',
            statement: 'Low votes',
            createdBy: 'user-1',
            publicCredit: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            inclusionNetVotes: 1,
            contentNetVotes: 2,
          },
        },
        discussionId: null,
        keywords: [],
        categories: [],
      },
      {
        s: {
          properties: {
            id: 'stmt-2',
            statement: 'High votes',
            createdBy: 'user-1',
            publicCredit: true,
            createdAt: '2025-01-02T00:00:00Z',
            updatedAt: '2025-01-02T00:00:00Z',
            inclusionNetVotes: 10,
            contentNetVotes: 8,
          },
        },
        discussionId: null,
        keywords: [],
        categories: [],
      },
    ];

    beforeEach(() => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult(mockStatements) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);
    });

    it('should sort by netVotes descending (default)', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        sort_by: 'netVotes',
        sort_direction: 'desc',
      });

      expect(result.nodes[0].id).toBe('stmt-2');
      expect(result.nodes[1].id).toBe('stmt-1');
    });

    it('should sort by netVotes ascending', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        sort_by: 'netVotes',
        sort_direction: 'asc',
      });

      expect(result.nodes[0].id).toBe('stmt-1');
      expect(result.nodes[1].id).toBe('stmt-2');
    });

    it('should sort by chronological descending', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        sort_by: 'chronological',
        sort_direction: 'desc',
      });

      expect(result.nodes[0].id).toBe('stmt-2'); // Newer first
      expect(result.nodes[1].id).toBe('stmt-1');
    });

    it('should sort by chronological ascending', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        sort_by: 'chronological',
        sort_direction: 'asc',
      });

      expect(result.nodes[0].id).toBe('stmt-1'); // Older first
      expect(result.nodes[1].id).toBe('stmt-2');
    });

    it('should sort by inclusion_votes', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        sort_by: 'inclusion_votes',
        sort_direction: 'desc',
      });

      expect(result.nodes[0].id).toBe('stmt-2');
      expect(result.nodes[0].inclusionNetVotes).toBe(10);
    });

    it('should sort by content_votes', async () => {
      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        sort_by: 'content_votes',
        sort_direction: 'desc',
      });

      expect(result.nodes[0].id).toBe('stmt-2');
      expect(result.nodes[0].contentNetVotes).toBe(8);
    });
  });

  // ============================================
  // CONTENT VOTE FALLBACK TESTS
  // ============================================
  describe('Content Vote Fallback', () => {
    it('should use inclusion votes for OpenQuestion when sorting by content votes', async () => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              q: {
                properties: {
                  id: 'q-1',
                  questionText: 'Question 1?',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionPositiveVotes: 5,
                  inclusionNegativeVotes: 0,
                  inclusionNetVotes: 5,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
            {
              q: {
                properties: {
                  id: 'q-2',
                  questionText: 'Question 2?',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionPositiveVotes: 2,
                  inclusionNegativeVotes: 0,
                  inclusionNetVotes: 2,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['openquestion'],
        sort_by: 'content_votes',
        sort_direction: 'desc',
      });

      expect(result.nodes[0].id).toBe('q-1');
      expect(result.nodes[0].contentNetVotes).toBe(5); // Fallback value
      expect(result.nodes[1].id).toBe('q-2');
      expect(result.nodes[1].contentNetVotes).toBe(2); // Fallback value
    });

    it('should use inclusion votes for Quantity when sorting by content votes', async () => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              qty: {
                properties: {
                  id: 'qty-1',
                  definition: 'Quantity 1',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 7,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
            {
              qty: {
                properties: {
                  id: 'qty-2',
                  definition: 'Quantity 2',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 3,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['quantity'],
        sort_by: 'content_votes',
        sort_direction: 'desc',
      });

      expect(result.nodes[0].id).toBe('qty-1');
      expect(result.nodes[0].contentNetVotes).toBe(7);
    });

    it('should use inclusion votes for Evidence when sorting by content votes', async () => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              ev: {
                properties: {
                  id: 'ev-1',
                  title: 'Evidence 1',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 9,
                },
              },
              discussionId: null,
              parentNodeId: 'stmt-1',
              parentNodeType: 'StatementNode',
              parentContent: 'Test',
              keywords: [],
              categories: [],
            },
            {
              ev: {
                properties: {
                  id: 'ev-2',
                  title: 'Evidence 2',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 4,
                },
              },
              discussionId: null,
              parentNodeId: 'stmt-1',
              parentNodeType: 'StatementNode',
              parentContent: 'Test',
              keywords: [],
              categories: [],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['evidence'],
        sort_by: 'content_votes',
        sort_direction: 'desc',
      });

      expect(result.nodes[0].id).toBe('ev-1');
      expect(result.nodes[0].contentNetVotes).toBe(9);
    });

    it('should use actual content votes for Statement and Answer', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Statement',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 10,
                  contentNetVotes: 3,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              a: {
                properties: {
                  id: 'ans-1',
                  answerText: 'Answer',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 5,
                  contentNetVotes: 8,
                },
              },
              discussionId: null,
              parentQuestionId: 'q-1',
              parentQuestionText: 'Test?',
              keywords: [],
              categories: [],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['statement', 'answer'],
        sort_by: 'content_votes',
        sort_direction: 'desc',
      });

      // Answer has higher content votes despite lower inclusion votes
      expect(result.nodes[0].id).toBe('ans-1');
      expect(result.nodes[0].contentNetVotes).toBe(8);
      expect(result.nodes[1].id).toBe('stmt-1');
      expect(result.nodes[1].contentNetVotes).toBe(3);
    });
  });

  // ============================================
  // PAGINATION TESTS
  // ============================================
  describe('Pagination', () => {
    it('should apply limit correctly', async () => {
      const mockStatements = Array.from({ length: 5 }, (_, i) => ({
        s: {
          properties: {
            id: `stmt-${i}`,
            statement: `Statement ${i}`,
            createdBy: 'user-1',
            publicCredit: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            inclusionNetVotes: 5 - i,
            contentNetVotes: 5 - i,
          },
        },
        discussionId: null,
        keywords: [],
        categories: [],
      }));

      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult(mockStatements) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        limit: 2,
      });

      expect(result.nodes).toHaveLength(2);
      expect(result.total_count).toBe(5);
      expect(result.has_more).toBe(true);
    });

    it('should apply offset correctly', async () => {
      const mockStatements = Array.from({ length: 5 }, (_, i) => ({
        s: {
          properties: {
            id: `stmt-${i}`,
            statement: `Statement ${i}`,
            createdBy: 'user-1',
            publicCredit: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            inclusionNetVotes: 5 - i,
            contentNetVotes: 5 - i,
          },
        },
        discussionId: null,
        keywords: [],
        categories: [],
      }));

      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult(mockStatements) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        limit: 2,
        offset: 1,
      });

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0].id).toBe('stmt-1'); // Second item
      expect(result.nodes[1].id).toBe('stmt-2'); // Third item
      expect(result.has_more).toBe(true);
    });

    it('should set has_more to false when at end', async () => {
      const mockStatements = Array.from({ length: 3 }, (_, i) => ({
        s: {
          properties: {
            id: `stmt-${i}`,
            statement: `Statement ${i}`,
            createdBy: 'user-1',
            publicCredit: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            inclusionNetVotes: 1,
            contentNetVotes: 1,
          },
        },
        discussionId: null,
        keywords: [],
        categories: [],
      }));

      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult(mockStatements) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        limit: 10,
      });

      expect(result.nodes).toHaveLength(3);
      expect(result.has_more).toBe(false);
    });
  });

  // ============================================
  // HELPER METHODS TESTS
  // ============================================
  describe('getAvailableKeywords', () => {
    it('should return keywords with usage counts', async () => {
      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([
          { word: 'ai', usageCount: { toNumber: () => 10 } },
          { word: 'machine-learning', usageCount: { toNumber: () => 5 } },
        ]) as any,
      );

      const result = await service.getAvailableKeywords();

      expect(result).toHaveLength(2);
      expect(result[0].word).toBe('ai');
      expect(result[0].usageCount).toBe(10);
      expect(result[1].word).toBe('machine-learning');
      expect(result[1].usageCount).toBe(5);
    });

    it('should return empty array on error', async () => {
      neo4jService.read.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.getAvailableKeywords();

      expect(result).toEqual([]);
    });

    it('should only return keywords with positive inclusion votes', async () => {
      expect(neo4jService.read).toBeDefined();
      // Query should filter: WHERE w.inclusionNetVotes > 0
      await service.getAvailableKeywords();
      const query = (neo4jService.read as jest.Mock).mock.calls[0][0];
      expect(query).toContain('inclusionNetVotes > 0');
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
            usageCount: { toNumber: () => 15 },
          },
          {
            id: 'cat-2',
            name: 'Science',
            description: null,
            usageCount: { toNumber: () => 8 },
          },
        ]) as any,
      );

      const result = await service.getAvailableCategories();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('cat-1');
      expect(result[0].name).toBe('Technology');
      expect(result[0].description).toBe('Tech category');
      expect(result[0].usageCount).toBe(15);
      expect(result[1].description).toBeNull();
    });

    it('should return empty array on error', async () => {
      neo4jService.read.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.getAvailableCategories();

      expect(result).toEqual([]);
    });

    it('should exclude self-categorization from usage counts', async () => {
      await service.getAvailableCategories();
      const query = (neo4jService.read as jest.Mock).mock.calls[0][0];
      // Should have WHERE content.id <> c.id
      expect(query).toContain('content.id <> c.id');
    });
  });

  // ============================================
  // PERFORMANCE METRICS TESTS
  // ============================================
  describe('Performance Metrics', () => {
    it('should return accurate performance metrics', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Test',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
      });

      expect(result.performance_metrics).toBeDefined();
      expect(result.performance_metrics?.node_count).toBe(1);
      expect(result.performance_metrics?.relationship_count).toBe(0);
      expect(result.performance_metrics?.relationship_density).toBe(0);
      expect(result.performance_metrics?.consolidation_ratio).toBe(1);
      expect(result.performance_metrics?.category_filtered_count).toBe(0);
    });

    it('should track filtered node count', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'AI',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [{ word: 'ai', frequency: 0.8 }],
              categories: [],
            },
            {
              s: {
                properties: {
                  id: 'stmt-2',
                  statement: 'Other',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [{ word: 'other', frequency: 0.8 }],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        keywords: ['ai'],
        includeKeywordsFilter: true,
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.performance_metrics?.category_filtered_count).toBe(1); // 1 node filtered out
    });

    it('should calculate relationship density correctly', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Test',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
            {
              s: {
                properties: {
                  id: 'stmt-2',
                  statement: 'Test 2',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        include_relationships: false, // No relationships
      });

      expect(result.performance_metrics?.relationship_density).toBe(0);
    });
  });

  // ============================================
  // USER CONTEXT ENRICHMENT TESTS
  // ============================================
  describe('User Context Enrichment', () => {
    it('should enrich nodes with user vote status when requesting_user_id provided', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Test',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      // Mock user vote query
      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([
          { kind: 'INCLUSION', status: 'agree' },
          { kind: 'CONTENT', status: 'disagree' },
        ]) as any,
      );

      // Mock visibility query
      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([{ preference: 'hidden' }]) as any,
      );

      voteSchema.getVoteStatus.mockResolvedValueOnce({} as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        requesting_user_id: 'user-123',
      });

      expect(result.nodes[0].metadata.userVoteStatus).toBeDefined();
      expect(result.nodes[0].metadata.userVoteStatus?.inclusionVote).toBe(
        'positive',
      );
      expect(result.nodes[0].metadata.userVoteStatus?.contentVote).toBe(
        'negative',
      );
      expect(result.nodes[0].metadata.userVisibilityPreference).toBe('hidden');
    });

    it('should handle missing user votes gracefully', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Test',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      // Mock empty user vote query
      neo4jService.read.mockResolvedValueOnce(mockNeo4jResult([]) as any);

      // Mock empty visibility query
      neo4jService.read.mockResolvedValueOnce(mockNeo4jResult([]) as any);

      voteSchema.getVoteStatus.mockResolvedValueOnce(null);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        requesting_user_id: 'user-123',
      });

      expect(result.nodes[0].metadata.userVoteStatus).toBeDefined();
      expect(result.nodes[0].metadata.userVoteStatus?.inclusionVote).toBeNull();
      expect(result.nodes[0].metadata.userVoteStatus?.contentVote).toBeNull();
      expect(result.nodes[0].metadata.userVisibilityPreference).toBe('visible'); // Default
    });

    it('should not enrich when requesting_user_id not provided', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Test',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
      });

      expect(result.nodes[0].metadata.userVoteStatus).toBeUndefined();
      expect(result.nodes[0].metadata.userVisibilityPreference).toBeUndefined();
      expect(voteSchema.getVoteStatus).not.toHaveBeenCalled();
    });

    it('should continue if enrichment fails for individual nodes', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Test 1',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
            {
              s: {
                properties: {
                  id: 'stmt-2',
                  statement: 'Test 2',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      // First node succeeds
      voteSchema.getVoteStatus.mockResolvedValueOnce({} as any);
      neo4jService.read.mockResolvedValueOnce(mockNeo4jResult([]) as any);
      neo4jService.read.mockResolvedValueOnce(mockNeo4jResult([]) as any);

      // Second node fails
      voteSchema.getVoteStatus.mockRejectedValueOnce(
        new Error('Vote fetch failed'),
      );

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        requesting_user_id: 'user-123',
      });

      // Should still return both nodes
      expect(result.nodes).toHaveLength(2);
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  describe('Error Handling', () => {
    it('should handle Neo4j query errors gracefully', async () => {
      neo4jService.read.mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      await expect(
        service.getUniversalNodes({ node_types: ['statement'] }),
      ).rejects.toThrow('Database connection failed');
    });

    it('should return empty nodes array if all fetches fail', async () => {
      neo4jService.read
        .mockRejectedValueOnce(new Error('Statement fetch failed'))
        .mockRejectedValueOnce(new Error('Question fetch failed'));

      const result = await service.getUniversalNodes({});

      expect(result.nodes).toHaveLength(0);
      expect(result.total_count).toBe(0);
    });

    it('should handle partial fetch failures', async () => {
      // Statements succeed
      neo4jService.read.mockResolvedValueOnce(
        mockNeo4jResult([
          {
            s: {
              properties: {
                id: 'stmt-1',
                statement: 'Test',
                createdBy: 'user-1',
                publicCredit: true,
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-01T00:00:00Z',
                inclusionNetVotes: 1,
                contentNetVotes: 1,
              },
            },
            discussionId: null,
            keywords: [],
            categories: [],
          },
        ]) as any,
      );

      // Questions fail
      neo4jService.read.mockRejectedValueOnce(
        new Error('Question fetch failed'),
      );

      const result = await service.getUniversalNodes({});

      // Should still return statements
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('statement');
    });
  });

  // ============================================
  // INTEGRATION SCENARIOS
  // ============================================
  describe('Integration Scenarios', () => {
    it('should handle complete workflow: fetch, filter, sort, paginate, enrich', async () => {
      // Mock 10 statements with various properties
      const mockStatements = Array.from({ length: 10 }, (_, i) => ({
        s: {
          properties: {
            id: `stmt-${i}`,
            statement: `Statement ${i}`,
            createdBy: i % 2 === 0 ? 'user-1' : 'user-2',
            publicCredit: true,
            createdAt: `2025-01-0${i + 1}T00:00:00Z`,
            updatedAt: `2025-01-0${i + 1}T00:00:00Z`,
            inclusionNetVotes: 10 - i,
            contentNetVotes: 10 - i,
          },
        },
        discussionId: null,
        keywords:
          i % 3 === 0
            ? [{ word: 'ai', frequency: 0.8 }]
            : [{ word: 'other', frequency: 0.8 }],
        categories:
          i % 2 === 0
            ? [{ id: 'cat-tech', name: 'Technology' }]
            : [{ id: 'cat-sci', name: 'Science' }],
      }));

      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult(mockStatements) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      // Mock user context enrichment
      voteSchema.getVoteStatus.mockResolvedValue({} as any);
      neo4jService.read.mockResolvedValue(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        keywords: ['ai'],
        includeKeywordsFilter: true,
        categories: ['cat-tech'],
        includeCategoriesFilter: true,
        user_id: 'user-1',
        sort_by: 'content_votes',
        sort_direction: 'desc',
        limit: 2,
        offset: 0,
        requesting_user_id: 'user-123',
      });

      // Should have filtered and paginated correctly
      expect(result.nodes.length).toBeLessThanOrEqual(2);
      expect(result.total_count).toBeGreaterThan(0);

      // All nodes should pass filters
      result.nodes.forEach((node) => {
        expect(node.createdBy).toBe('user-1');
        expect(node.keywords.some((k) => k.word === 'ai')).toBe(true);
        expect(node.categories.some((c) => c.id === 'cat-tech')).toBe(true);
      });

      // Should be sorted by content votes descending
      for (let i = 0; i < result.nodes.length - 1; i++) {
        expect(result.nodes[i].contentNetVotes).toBeGreaterThanOrEqual(
          result.nodes[i + 1].contentNetVotes,
        );
      }
    });

    it('should handle mixed node types with different voting systems', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Statement',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 5,
                  contentNetVotes: 3,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              q: {
                properties: {
                  id: 'q-1',
                  questionText: 'Question?',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 7,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              a: {
                properties: {
                  id: 'ans-1',
                  answerText: 'Answer',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 4,
                  contentNetVotes: 8,
                },
              },
              discussionId: null,
              parentQuestionId: 'q-1',
              parentQuestionText: 'Question?',
              keywords: [],
              categories: [],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['statement', 'openquestion', 'answer'],
        sort_by: 'content_votes',
        sort_direction: 'desc',
      });

      expect(result.nodes).toHaveLength(3);

      // Answer has highest content votes (8)
      expect(result.nodes[0].id).toBe('ans-1');
      expect(result.nodes[0].contentNetVotes).toBe(8);

      // Question uses inclusion fallback (7)
      expect(result.nodes[1].id).toBe('q-1');
      expect(result.nodes[1].contentNetVotes).toBe(7);

      // Statement has real content votes (3)
      expect(result.nodes[2].id).toBe('stmt-1');
      expect(result.nodes[2].contentNetVotes).toBe(3);
    });

    it('should handle empty result set', async () => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({});

      expect(result.nodes).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
      expect(result.total_count).toBe(0);
      expect(result.has_more).toBe(false);
      expect(result.performance_metrics?.node_count).toBe(0);
    });

    it('should handle large result sets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        s: {
          properties: {
            id: `stmt-${i}`,
            statement: `Statement ${i}`,
            createdBy: 'user-1',
            publicCredit: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            inclusionNetVotes: 1000 - i,
            contentNetVotes: 1000 - i,
          },
        },
        discussionId: null,
        keywords: [],
        categories: [],
      }));

      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult(largeDataset) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        limit: 200,
        offset: 100,
      });

      expect(result.nodes).toHaveLength(200);
      expect(result.total_count).toBe(1000);
      expect(result.has_more).toBe(true);

      // Should be properly sorted
      expect(result.nodes[0].contentNetVotes).toBeGreaterThanOrEqual(
        result.nodes[result.nodes.length - 1].contentNetVotes,
      );
    });
  });

  // ============================================
  // RELATIONSHIPS TESTS (Placeholder for Phase 4.2+)
  // ============================================
  describe('Relationships', () => {
    it('should return empty relationships array when include_relationships is false', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Test',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        include_relationships: false,
      });

      expect(result.relationships).toHaveLength(0);
    });

    it('should return empty relationships array in Phase 4.1', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Test',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
        include_relationships: true,
        relationship_types: ['shared_keyword', 'related_to'],
      });

      // Phase 4.1: Relationships not implemented yet
      expect(result.relationships).toHaveLength(0);
    });
  });

  // ============================================
  // DEFAULT BEHAVIOR TESTS
  // ============================================
  describe('Default Behavior', () => {
    it('should use correct default values', async () => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({});

      // Defaults should be: statement + openquestion, limit 200, offset 0
      expect(neo4jService.read).toHaveBeenCalledTimes(2); // Statement + OpenQuestion
      expect(result.nodes.length).toBeLessThanOrEqual(200);
    });

    it('should include relationships by default', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Test',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
      });

      // include_relationships defaults to true
      expect(result.relationships).toBeDefined();
    });

    it('should sort by netVotes descending by default', async () => {
      neo4jService.read
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Low',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
            {
              s: {
                properties: {
                  id: 'stmt-2',
                  statement: 'High',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 10,
                  contentNetVotes: 10,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        )
        .mockResolvedValueOnce(mockNeo4jResult([]) as any);

      const result = await service.getUniversalNodes({
        node_types: ['statement'],
      });

      // Should be sorted descending
      expect(result.nodes[0].id).toBe('stmt-2');
      expect(result.nodes[1].id).toBe('stmt-1');
    });
  });

  // ============================================
  // METADATA VALIDATION TESTS
  // ============================================
  describe('Metadata Validation', () => {
    it('should always include parent question info for Answer nodes', async () => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              a: {
                properties: {
                  id: 'ans-1',
                  answerText: 'Test',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              parentQuestionId: 'q-1',
              parentQuestionText: 'What is AI?',
              keywords: [],
              categories: [],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['answer'],
      });

      expect(result.nodes[0].metadata.parentQuestion).toBeDefined();
      expect(result.nodes[0].metadata.parentQuestion?.nodeId).toBe('q-1');
      expect(result.nodes[0].metadata.parentQuestion?.nodeType).toBe(
        'openquestion',
      );
      expect(result.nodes[0].metadata.parentQuestion?.questionText).toBe(
        'What is AI?',
      );
    });

    it('should always include parent node info for Evidence nodes', async () => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              ev: {
                properties: {
                  id: 'ev-1',
                  title: 'Study',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  sourceUrl: 'http://test.com',
                  isPeerReviewed: true,
                },
              },
              discussionId: null,
              parentNodeId: 'stmt-1',
              parentNodeType: 'StatementNode',
              parentContent: 'AI is important',
              keywords: [],
              categories: [],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['evidence'],
      });

      expect(result.nodes[0].metadata.parentNode).toBeDefined();
      expect(result.nodes[0].metadata.parentNode?.nodeId).toBe('stmt-1');
      expect(result.nodes[0].metadata.parentNode?.nodeType).toBe(
        'StatementNode',
      );
      expect(result.nodes[0].metadata.parentNode?.content).toBe(
        'AI is important',
      );
      expect(result.nodes[0].metadata.sourceUrl).toBe('http://test.com');
      expect(result.nodes[0].metadata.isPeerReviewed).toBe(true);
    });

    it('should include measurement info for Quantity nodes', async () => {
      neo4jService.read
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(mockNeo4jResult([]) as any)
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              qty: {
                properties: {
                  id: 'qty-1',
                  definition: 'Height',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 1,
                  measurementUnit: 'meters',
                  value: 1.75,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]) as any,
        );

      const result = await service.getUniversalNodes({
        node_types: ['quantity'],
      });

      expect(result.nodes[0].metadata.measurementUnit).toBe('meters');
      expect(result.nodes[0].metadata.value).toBe(1.75);
    });
  });
});
