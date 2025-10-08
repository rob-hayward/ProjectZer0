// src/nodes/universal/universal-graph.controller.spec.ts - Phase 4.1 E2E Tests

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { UniversalGraphModule } from './universal-graph.module';
import { Neo4jService } from '../../neo4j/neo4j.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Result } from 'neo4j-driver';

describe('UniversalGraphController (E2E) - Phase 4.1', () => {
  let app: INestApplication;
  let neo4jService: Neo4jService;

  const mockUser = {
    sub: 'test-user-id',
    email: 'test@example.com',
  };

  // Type-safe mock that matches Neo4j Result type
  const mockNeo4jResult = (records: any[]): Result => {
    return {
      records: records.map((record) => ({
        get: (key: string) => record[key],
        toObject: () => record,
        keys: Object.keys(record),
        length: Object.keys(record).length,
        has: (key: string) => key in record,
        forEach: () => {},
        map: () => [],
      })) as any,
      summary: {} as any,
    } as unknown as Result; // ✅ Changed from `as Partial<Result>` to `as unknown as Result`
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UniversalGraphModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          request.user = mockUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    neo4jService = moduleFixture.get<Neo4jService>(Neo4jService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // BASIC FETCH TESTS
  // ============================================
  describe('GET /graph/universal/nodes - Basic Fetching', () => {
    it('should return nodes with default parameters (statement + openquestion)', async () => {
      jest
        .spyOn(neo4jService, 'read')
        .mockResolvedValueOnce(
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
          ]),
        )
        .mockResolvedValueOnce(
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
          ]),
        );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .expect(200);

      expect(response.body.nodes).toHaveLength(2);
      expect(response.body.nodes[0].type).toBe('statement');
      expect(response.body.nodes[1].type).toBe('openquestion');
      expect(response.body.total_count).toBe(2);
      expect(response.body.has_more).toBe(false);
      expect(response.body.performance_metrics).toBeDefined();
      expect(response.body.performance_metrics.node_count).toBe(2);
    });

    it('should filter by single node type', async () => {
      jest.spyOn(neo4jService, 'read').mockResolvedValueOnce(
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
        ]),
      );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'statement' })
        .expect(200);

      expect(response.body.nodes).toHaveLength(1);
      expect(response.body.nodes[0].type).toBe('statement');
    });

    it('should handle multiple node types as comma-separated string', async () => {
      jest
        .spyOn(neo4jService, 'read')
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
          ]),
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
                  inclusionNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]),
        );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'statement,openquestion' })
        .expect(200);

      expect(response.body.nodes).toHaveLength(2);
    });

    it('should support all 5 node types', async () => {
      jest
        .spyOn(neo4jService, 'read')
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
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]),
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
                  inclusionNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]),
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
              parentQuestionText: 'Question?',
              keywords: [],
              categories: [],
            },
          ]),
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
          ]),
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
              parentContent: 'Statement',
              keywords: [],
              categories: [],
            },
          ]),
        );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          node_types: 'statement,openquestion,answer,quantity,evidence',
        })
        .expect(200);

      expect(response.body.nodes).toHaveLength(5);
      const types = response.body.nodes.map((n: any) => n.type);
      expect(types).toContain('statement');
      expect(types).toContain('openquestion');
      expect(types).toContain('answer');
      expect(types).toContain('quantity');
      expect(types).toContain('evidence');
    });
  });

  // ============================================
  // FILTERING TESTS
  // ============================================
  describe('GET /graph/universal/nodes - Filtering', () => {
    it('should filter by keywords (include mode)', async () => {
      jest
        .spyOn(neo4jService, 'read')
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
          ]),
        )
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          node_types: 'statement',
          keywords: 'ai',
          includeKeywordsFilter: true,
        })
        .expect(200);

      expect(response.body.nodes).toHaveLength(1);
      expect(response.body.nodes[0].id).toBe('stmt-1');
    });

    it('should filter by keywords (exclude mode)', async () => {
      jest
        .spyOn(neo4jService, 'read')
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
          ]),
        )
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          node_types: 'statement',
          keywords: 'ai',
          includeKeywordsFilter: false,
        })
        .expect(200);

      expect(response.body.nodes).toHaveLength(1);
      expect(response.body.nodes[0].id).toBe('stmt-2');
    });

    it('should filter by categories', async () => {
      jest
        .spyOn(neo4jService, 'read')
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
              categories: [{ id: 'cat-sci', name: 'Science' }],
            },
          ]),
        )
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'statement', categories: 'cat-tech' })
        .expect(200);

      expect(response.body.nodes).toHaveLength(1);
      expect(response.body.nodes[0].categories[0].id).toBe('cat-tech');
    });

    it('should filter by user_id', async () => {
      jest
        .spyOn(neo4jService, 'read')
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
          ]),
        )
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'statement', user_id: 'user-1' })
        .expect(200);

      expect(response.body.nodes).toHaveLength(1);
      expect(response.body.nodes[0].createdBy).toBe('user-1');
    });
  });

  // ============================================
  // SORTING TESTS
  // ============================================
  describe('GET /graph/universal/nodes - Sorting', () => {
    it('should sort by netVotes descending', async () => {
      jest
        .spyOn(neo4jService, 'read')
        .mockResolvedValueOnce(
          mockNeo4jResult([
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
                  statement: 'High votes',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-02T00:00:00Z',
                  updatedAt: '2025-01-02T00:00:00Z',
                  inclusionNetVotes: 10,
                  contentNetVotes: 10,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]),
        )
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          node_types: 'statement',
          sort_by: 'netVotes',
          sort_direction: 'desc',
        })
        .expect(200);

      expect(response.body.nodes[0].id).toBe('stmt-2');
      expect(response.body.nodes[1].id).toBe('stmt-1');
    });

    it('should sort by chronological', async () => {
      jest
        .spyOn(neo4jService, 'read')
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'Old',
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
                  statement: 'New',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-05T00:00:00Z',
                  updatedAt: '2025-01-05T00:00:00Z',
                  inclusionNetVotes: 1,
                  contentNetVotes: 1,
                },
              },
              discussionId: null,
              keywords: [],
              categories: [],
            },
          ]),
        )
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          node_types: 'statement',
          sort_by: 'chronological',
          sort_direction: 'desc',
        })
        .expect(200);

      expect(response.body.nodes[0].id).toBe('stmt-2'); // Newer first
    });
  });

  // ============================================
  // PAGINATION TESTS
  // ============================================
  describe('GET /graph/universal/nodes - Pagination', () => {
    it('should apply pagination correctly', async () => {
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

      jest
        .spyOn(neo4jService, 'read')
        .mockResolvedValueOnce(mockNeo4jResult(mockStatements))
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'statement', limit: 2, offset: 1 })
        .expect(200);

      expect(response.body.nodes).toHaveLength(2);
      expect(response.body.total_count).toBe(5);
      expect(response.body.has_more).toBe(true);
    });

    it('should set has_more to false when at end', async () => {
      jest
        .spyOn(neo4jService, 'read')
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
          ]),
        )
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'statement', limit: 10 })
        .expect(200);

      expect(response.body.has_more).toBe(false);
    });
  });

  // ============================================
  // CONTENT VOTE FALLBACK TESTS
  // ============================================
  describe('GET /graph/universal/nodes - Content Vote Fallback', () => {
    it('should use inclusion votes for OpenQuestion when sorting by content', async () => {
      jest
        .spyOn(neo4jService, 'read')
        .mockResolvedValueOnce(mockNeo4jResult([]))
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              q: {
                properties: {
                  id: 'q-1',
                  questionText: 'High inclusion?',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 10,
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
                  questionText: 'Low inclusion?',
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
          ]),
        );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'openquestion', sort_by: 'content_votes' })
        .expect(200);

      expect(response.body.nodes[0].id).toBe('q-1');
      expect(response.body.nodes[0].contentNetVotes).toBe(10); // Fallback
    });
  });

  // ============================================
  // METADATA TESTS
  // ============================================
  describe('GET /graph/universal/nodes - Metadata', () => {
    it('should include parent question info in Answer nodes', async () => {
      jest
        .spyOn(neo4jService, 'read')
        .mockResolvedValueOnce(mockNeo4jResult([]))
        .mockResolvedValueOnce(mockNeo4jResult([]))
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              a: {
                properties: {
                  id: 'ans-1',
                  answerText: 'Test answer',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 3,
                  contentNetVotes: 2,
                },
              },
              discussionId: null,
              parentQuestionId: 'q-1',
              parentQuestionText: 'What is AI?',
              keywords: [],
              categories: [],
            },
          ]),
        );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'answer' })
        .expect(200);

      const answer = response.body.nodes[0];
      expect(answer.metadata.parentQuestion).toBeDefined();
      expect(answer.metadata.parentQuestion.nodeId).toBe('q-1');
      expect(answer.metadata.parentQuestion.questionText).toBe('What is AI?');
    });

    it('should include parent node info in Evidence nodes', async () => {
      jest
        .spyOn(neo4jService, 'read')
        .mockResolvedValueOnce(mockNeo4jResult([]))
        .mockResolvedValueOnce(mockNeo4jResult([]))
        .mockResolvedValueOnce(mockNeo4jResult([]))
        .mockResolvedValueOnce(mockNeo4jResult([]))
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              ev: {
                properties: {
                  id: 'ev-1',
                  title: 'Research paper',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 5,
                  sourceUrl: 'https://example.com/paper',
                  isPeerReviewed: true,
                },
              },
              discussionId: null,
              parentNodeId: 'stmt-1',
              parentNodeType: 'StatementNode',
              parentContent: 'AI is transformative',
              keywords: [],
              categories: [],
            },
          ]),
        );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'evidence' })
        .expect(200);

      const evidence = response.body.nodes[0];
      expect(evidence.metadata.parentNode).toBeDefined();
      expect(evidence.metadata.parentNode.nodeId).toBe('stmt-1');
      expect(evidence.metadata.parentNode.content).toBe('AI is transformative');
      expect(evidence.metadata.sourceUrl).toBe('https://example.com/paper');
      expect(evidence.metadata.isPeerReviewed).toBe(true);
    });
  });

  // ============================================
  // VALIDATION TESTS
  // ============================================
  describe('GET /graph/universal/nodes - Validation', () => {
    it('should validate invalid node types', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'invalid_type' })
        .expect(400);

      expect(response.body.message).toContain('Invalid node types');
    });

    it('should validate invalid sort options', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ sort_by: 'invalid_sort' })
        .expect(400);

      expect(response.body.message).toContain('sort_by must be one of');
    });

    it('should validate limit range (too high)', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ limit: 2000 })
        .expect(400);

      expect(response.body.message).toContain(
        'limit must be between 1 and 1000',
      );
    });

    it('should validate limit range (too low)', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ limit: 0 })
        .expect(400);

      expect(response.body.message).toContain(
        'limit must be between 1 and 1000',
      );
    });

    it('should validate offset (negative)', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ offset: -1 })
        .expect(400);

      expect(response.body.message).toContain('offset must be non-negative');
    });

    it('should validate relationship types', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ relationship_types: 'invalid_rel_type' })
        .expect(400);

      expect(response.body.message).toContain('Invalid relationship types');
    });

    it('should validate sort direction', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ sort_direction: 'invalid' })
        .expect(400);

      expect(response.body.message).toContain('sort_direction must be either');
    });

    it('should reject empty node_types array', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: '' })
        .expect(400);

      expect(response.body.message).toContain('cannot be an empty array');
    });
  });

  // ============================================
  // RELATIONSHIPS TESTS
  // ============================================
  describe('GET /graph/universal/nodes - Relationships', () => {
    it('should handle include_relationships parameter', async () => {
      jest
        .spyOn(neo4jService, 'read')
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
          ]),
        )
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'statement', include_relationships: false })
        .expect(200);

      expect(response.body.relationships).toEqual([]);
    });

    it('should return empty relationships in Phase 4.1', async () => {
      jest
        .spyOn(neo4jService, 'read')
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
          ]),
        )
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          node_types: 'statement',
          include_relationships: true,
          relationship_types: 'shared_keyword,related_to',
        })
        .expect(200);

      // Phase 4.1: Relationships not implemented yet
      expect(response.body.relationships).toEqual([]);
    });
  });

  // ============================================
  // HELPER ENDPOINTS TESTS
  // ============================================
  describe('GET /graph/universal/filters/keywords', () => {
    it('should return available keywords', async () => {
      jest.spyOn(neo4jService, 'read').mockResolvedValueOnce(
        mockNeo4jResult([
          { word: 'ai', usageCount: { toNumber: () => 10 } },
          { word: 'machine-learning', usageCount: { toNumber: () => 5 } },
        ]),
      );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/filters/keywords')
        .expect(200);

      expect(response.body.keywords).toHaveLength(2);
      expect(response.body.keywords[0].word).toBe('ai');
      expect(response.body.keywords[0].usageCount).toBe(10);
      expect(response.body.total).toBe(2);
    });

    it('should handle empty results', async () => {
      jest
        .spyOn(neo4jService, 'read')
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/filters/keywords')
        .expect(200);

      expect(response.body.keywords).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should require authentication', async () => {
      const testApp = await Test.createTestingModule({
        imports: [UniversalGraphModule],
      }).compile();

      const unauthenticatedApp = testApp.createNestApplication();
      await unauthenticatedApp.init();

      await request(unauthenticatedApp.getHttpServer())
        .get('/graph/universal/filters/keywords')
        .expect(401);

      await unauthenticatedApp.close();
    });
  });

  describe('GET /graph/universal/filters/categories', () => {
    it('should return available categories', async () => {
      jest.spyOn(neo4jService, 'read').mockResolvedValueOnce(
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
            description: 'Science category',
            usageCount: { toNumber: () => 8 },
          },
        ]),
      );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/filters/categories')
        .expect(200);

      expect(response.body.categories).toHaveLength(2);
      expect(response.body.categories[0].id).toBe('cat-1');
      expect(response.body.categories[0].name).toBe('Technology');
      expect(response.body.categories[0].usageCount).toBe(15);
      expect(response.body.total).toBe(2);
    });

    it('should handle empty results', async () => {
      jest
        .spyOn(neo4jService, 'read')
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/filters/categories')
        .expect(200);

      expect(response.body.categories).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should require authentication', async () => {
      const testApp = await Test.createTestingModule({
        imports: [UniversalGraphModule],
      }).compile();

      const unauthenticatedApp = testApp.createNestApplication();
      await unauthenticatedApp.init();

      await request(unauthenticatedApp.getHttpServer())
        .get('/graph/universal/filters/categories')
        .expect(401);

      await unauthenticatedApp.close();
    });
  });

  // ============================================
  // PERFORMANCE METRICS TESTS
  // ============================================
  describe('GET /graph/universal/nodes - Performance Metrics', () => {
    it('should return performance metrics', async () => {
      jest
        .spyOn(neo4jService, 'read')
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
          ]),
        )
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'statement' })
        .expect(200);

      expect(response.body.performance_metrics).toBeDefined();
      expect(response.body.performance_metrics.node_count).toBe(1);
      expect(response.body.performance_metrics.relationship_count).toBe(0);
      expect(response.body.performance_metrics.relationship_density).toBe(0);
      expect(response.body.performance_metrics.consolidation_ratio).toBe(1);
    });
  });

  // ============================================
  // AUTHENTICATION TESTS
  // ============================================
  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      const testApp = await Test.createTestingModule({
        imports: [UniversalGraphModule],
      }).compile();

      const unauthenticatedApp = testApp.createNestApplication();
      await unauthenticatedApp.init();

      await request(unauthenticatedApp.getHttpServer())
        .get('/graph/universal/nodes')
        .expect(401);

      await request(unauthenticatedApp.getHttpServer())
        .get('/graph/universal/filters/keywords')
        .expect(401);

      await request(unauthenticatedApp.getHttpServer())
        .get('/graph/universal/filters/categories')
        .expect(401);

      await unauthenticatedApp.close();
    });
  });

  // ============================================
  // INTEGRATION TESTS
  // ============================================
  describe('Integration Scenarios', () => {
    it('should handle complete workflow with multiple filters and sorting', async () => {
      jest
        .spyOn(neo4jService, 'read')
        .mockResolvedValueOnce(
          mockNeo4jResult([
            {
              s: {
                properties: {
                  id: 'stmt-1',
                  statement: 'AI Tech statement by user-1',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-01T00:00:00Z',
                  updatedAt: '2025-01-01T00:00:00Z',
                  inclusionNetVotes: 10,
                  contentNetVotes: 8,
                },
              },
              discussionId: null,
              keywords: [{ word: 'ai', frequency: 0.9 }],
              categories: [{ id: 'cat-tech', name: 'Technology' }],
            },
            {
              s: {
                properties: {
                  id: 'stmt-2',
                  statement: 'AI Science statement by user-2',
                  createdBy: 'user-2',
                  publicCredit: true,
                  createdAt: '2025-01-02T00:00:00Z',
                  updatedAt: '2025-01-02T00:00:00Z',
                  inclusionNetVotes: 5,
                  contentNetVotes: 3,
                },
              },
              discussionId: null,
              keywords: [{ word: 'ai', frequency: 0.8 }],
              categories: [{ id: 'cat-sci', name: 'Science' }],
            },
            {
              s: {
                properties: {
                  id: 'stmt-3',
                  statement: 'Other statement',
                  createdBy: 'user-1',
                  publicCredit: true,
                  createdAt: '2025-01-03T00:00:00Z',
                  updatedAt: '2025-01-03T00:00:00Z',
                  inclusionNetVotes: 7,
                  contentNetVotes: 5,
                },
              },
              discussionId: null,
              keywords: [{ word: 'other', frequency: 0.7 }],
              categories: [{ id: 'cat-tech', name: 'Technology' }],
            },
          ]),
        )
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          node_types: 'statement',
          keywords: 'ai',
          includeKeywordsFilter: true,
          categories: 'cat-tech',
          includeCategoriesFilter: true,
          user_id: 'user-1',
          sort_by: 'content_votes',
          sort_direction: 'desc',
          limit: 10,
        })
        .expect(200);

      // Should only return stmt-1 (matches all filters)
      expect(response.body.nodes).toHaveLength(1);
      expect(response.body.nodes[0].id).toBe('stmt-1');
      expect(response.body.nodes[0].createdBy).toBe('user-1');
      expect(
        response.body.nodes[0].keywords.some((k: any) => k.word === 'ai'),
      ).toBe(true);
      expect(
        response.body.nodes[0].categories.some((c: any) => c.id === 'cat-tech'),
      ).toBe(true);
    });

    it('should handle empty result sets gracefully', async () => {
      jest
        .spyOn(neo4jService, 'read')
        .mockResolvedValueOnce(mockNeo4jResult([]))
        .mockResolvedValueOnce(mockNeo4jResult([]));

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .expect(200);

      expect(response.body.nodes).toEqual([]);
      expect(response.body.relationships).toEqual([]);
      expect(response.body.total_count).toBe(0);
      expect(response.body.has_more).toBe(false);
    });
  });
});
