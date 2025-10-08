// src/nodes/universal/universal-graph.controller.spec.ts
// ✅ Phase 4.1: Fixed E2E tests - Mock service instead of importing full module

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { UniversalGraphController } from './universal-graph.controller';
import { UniversalGraphService } from './universal-graph.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('UniversalGraphController (E2E) - Phase 4.1', () => {
  let app: INestApplication;
  let universalGraphService: jest.Mocked<UniversalGraphService>;

  const mockUser = {
    sub: 'test-user-id',
    email: 'test@example.com',
  };

  beforeAll(async () => {
    // Create mock service
    const mockService = {
      getUniversalNodes: jest.fn(),
      getAvailableKeywords: jest.fn(),
      getAvailableCategories: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UniversalGraphController],
      providers: [
        {
          provide: UniversalGraphService,
          useValue: mockService,
        },
      ],
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

    universalGraphService = moduleFixture.get(UniversalGraphService);
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
    it('should return nodes with default parameters', async () => {
      const mockResponse = {
        nodes: [
          {
            id: 'stmt-1',
            type: 'statement' as const,
            content: 'Test statement',
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
            discussionId: null,
            keywords: [],
            categories: [],
            metadata: {},
          },
        ],
        relationships: [],
        total_count: 1,
        has_more: false,
        performance_metrics: {
          node_count: 1,
          relationship_count: 0,
          relationship_density: 0,
          consolidation_ratio: 1,
        },
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .expect(200);

      expect(response.body.nodes).toBeDefined();
      expect(response.body.relationships).toBeDefined();
      expect(response.body.total_count).toBe(1);
      expect(response.body.has_more).toBe(false);
      expect(response.body.performance_metrics).toBeDefined();
    });

    it('should filter by node types', async () => {
      const mockResponse = {
        nodes: [
          {
            id: 'stmt-1',
            type: 'statement' as const,
            content: 'Test',
            createdBy: 'user-1',
            publicCredit: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            inclusionNetVotes: 1,
            contentNetVotes: 1,
            inclusionPositiveVotes: 1,
            inclusionNegativeVotes: 0,
            contentPositiveVotes: 1,
            contentNegativeVotes: 0,
            discussionId: null,
            keywords: [],
            categories: [],
            metadata: {},
          },
        ],
        relationships: [],
        total_count: 1,
        has_more: false,
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'statement' })
        .expect(200);

      expect(universalGraphService.getUniversalNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          node_types: ['statement'],
        }),
      );
      expect(response.body.nodes[0].type).toBe('statement');
    });

    it('should handle multiple node types', async () => {
      const mockResponse = {
        nodes: [],
        relationships: [],
        total_count: 0,
        has_more: false,
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: 'statement,openquestion,answer' })
        .expect(200);

      expect(universalGraphService.getUniversalNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          node_types: ['statement', 'openquestion', 'answer'],
        }),
      );
    });
  });

  // ============================================
  // FILTERING TESTS
  // ============================================
  describe('GET /graph/universal/nodes - Filtering', () => {
    it('should filter by keywords', async () => {
      const mockResponse = {
        nodes: [],
        relationships: [],
        total_count: 0,
        has_more: false,
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ keywords: 'ai,ethics' })
        .expect(200);

      expect(universalGraphService.getUniversalNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: ['ai', 'ethics'],
        }),
      );
    });

    it('should filter by categories', async () => {
      const mockResponse = {
        nodes: [],
        relationships: [],
        total_count: 0,
        has_more: false,
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ categories: 'cat-1,cat-2' })
        .expect(200);

      expect(universalGraphService.getUniversalNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: ['cat-1', 'cat-2'],
        }),
      );
    });

    it('should filter by user', async () => {
      const mockResponse = {
        nodes: [],
        relationships: [],
        total_count: 0,
        has_more: false,
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ user_id: 'user-123' })
        .expect(200);

      expect(universalGraphService.getUniversalNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
        }),
      );
    });
  });

  // ============================================
  // SORTING TESTS
  // ============================================
  describe('GET /graph/universal/nodes - Sorting', () => {
    it('should sort by netVotes DESC (default)', async () => {
      const mockResponse = {
        nodes: [],
        relationships: [],
        total_count: 0,
        has_more: false,
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .expect(200);

      // Controller only passes requesting_user_id when no query params provided
      // Service uses defaults internally
      expect(universalGraphService.getUniversalNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          requesting_user_id: 'test-user-id',
        }),
      );

      // Verify sort_by and sort_direction are NOT in the call (let service use defaults)
      const callArgs = universalGraphService.getUniversalNodes.mock.calls[0][0];
      expect(callArgs.sort_by).toBeUndefined();
      expect(callArgs.sort_direction).toBeUndefined();
    });

    it('should sort by specified field', async () => {
      const mockResponse = {
        nodes: [],
        relationships: [],
        total_count: 0,
        has_more: false,
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ sort_by: 'chronological', sort_direction: 'asc' })
        .expect(200);

      expect(universalGraphService.getUniversalNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          sort_by: 'chronological',
          sort_direction: 'asc',
        }),
      );
    });
  });

  // ============================================
  // PAGINATION TESTS
  // ============================================
  describe('GET /graph/universal/nodes - Pagination', () => {
    it('should paginate results', async () => {
      const mockResponse = {
        nodes: [],
        relationships: [],
        total_count: 100,
        has_more: true,
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ limit: 10, offset: 20 })
        .expect(200);

      expect(universalGraphService.getUniversalNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 20,
        }),
      );
      expect(response.body.total_count).toBe(100);
      expect(response.body.has_more).toBe(true);
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

    it('should handle empty string node_types as no filter', async () => {
      // When node_types='', it becomes [''] after split
      // The controller doesn't validate empty strings as "invalid", it just passes them through
      const mockResponse = {
        nodes: [],
        relationships: [],
        total_count: 0,
        has_more: false,
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ node_types: '' })
        .expect(200);

      // Empty string is treated as "no node_types filter"
      expect(response.body).toBeDefined();
    });

    it('should handle empty keywords string as no filter', async () => {
      const mockResponse = {
        nodes: [],
        relationships: [],
        total_count: 0,
        has_more: false,
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      // Empty string for keywords just gets ignored - becomes [''] after split
      // But keywords don't have validation for "invalid keywords", so they just pass through
      await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ keywords: '' })
        .expect(200);
    });

    it('should handle empty categories string as no filter', async () => {
      const mockResponse = {
        nodes: [],
        relationships: [],
        total_count: 0,
        has_more: false,
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      // Empty string for categories just gets ignored - becomes [''] after split
      await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ categories: '' })
        .expect(200);
    });
  });

  // ============================================
  // HELPER ENDPOINTS TESTS
  // ============================================
  describe('GET /graph/universal/filters/keywords', () => {
    it('should return available keywords', async () => {
      const mockKeywords = [
        { word: 'ai', usageCount: 25 },
        { word: 'ethics', usageCount: 15 },
      ];

      universalGraphService.getAvailableKeywords.mockResolvedValue(
        mockKeywords,
      );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/filters/keywords')
        .expect(200);

      expect(response.body.keywords).toBeDefined();
      expect(response.body.keywords).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.keywords[0].word).toBe('ai');
      expect(response.body.keywords[0].usageCount).toBe(25);
    });

    it('should handle errors gracefully', async () => {
      universalGraphService.getAvailableKeywords.mockRejectedValue(
        new Error('Database error'),
      );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/filters/keywords')
        .expect(400);

      expect(response.body.message).toContain(
        'Failed to fetch available keywords',
      );
    });
  });

  describe('GET /graph/universal/filters/categories', () => {
    it('should return available categories', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Technology',
          description: 'Tech',
          usageCount: 30,
        },
        { id: 'cat-2', name: 'Science', description: null, usageCount: 20 },
      ];

      universalGraphService.getAvailableCategories.mockResolvedValue(
        mockCategories,
      );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/filters/categories')
        .expect(200);

      expect(response.body.categories).toBeDefined();
      expect(response.body.categories).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.categories[0].name).toBe('Technology');
    });

    it('should handle errors gracefully', async () => {
      universalGraphService.getAvailableCategories.mockRejectedValue(
        new Error('Database error'),
      );

      const response = await request(app.getHttpServer())
        .get('/graph/universal/filters/categories')
        .expect(400);

      expect(response.body.message).toContain(
        'Failed to fetch available categories',
      );
    });
  });

  // ============================================
  // AUTHENTICATION TESTS
  // ============================================
  describe('Authentication', () => {
    it('should include requesting user ID from JWT', async () => {
      const mockResponse = {
        nodes: [],
        relationships: [],
        total_count: 0,
        has_more: false,
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .expect(200);

      expect(universalGraphService.getUniversalNodes).toHaveBeenCalledWith(
        expect.objectContaining({
          requesting_user_id: 'test-user-id',
        }),
      );
    });
  });

  // ============================================
  // PERFORMANCE METRICS TESTS
  // ============================================
  describe('Performance Metrics', () => {
    it('should return performance metrics', async () => {
      const mockResponse = {
        nodes: [],
        relationships: [],
        total_count: 0,
        has_more: false,
        performance_metrics: {
          node_count: 10,
          relationship_count: 5,
          relationship_density: 0.5,
          consolidation_ratio: 1.0,
          category_filtered_count: 2,
        },
      };

      universalGraphService.getUniversalNodes.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .expect(200);

      expect(response.body.performance_metrics).toBeDefined();
      expect(response.body.performance_metrics.node_count).toBe(10);
      expect(response.body.performance_metrics.relationship_count).toBe(5);
      expect(response.body.performance_metrics.relationship_density).toBe(0.5);
      expect(response.body.performance_metrics.consolidation_ratio).toBe(1.0);
    });
  });
});
