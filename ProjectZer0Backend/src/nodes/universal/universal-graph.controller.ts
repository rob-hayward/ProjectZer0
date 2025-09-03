// src/nodes/universal/universal-graph.controller.ts

import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  UniversalGraphService,
  UniversalGraphOptions,
  UniversalGraphResponse,
} from './universal-graph.service';

export class UniversalNodesQueryDto implements UniversalGraphOptions {
  // ENHANCED: Now supports all node types including answer, quantity, category
  node_types?: Array<
    'openquestion' | 'statement' | 'answer' | 'quantity' | 'category'
  >;
  includeNodeTypes?: boolean; // NEW: Include/exclude logic for node types

  // NEW: Category filtering options
  categories?: string[];
  includeCategoriesFilter?: boolean;

  limit?: number;
  offset?: number;
  sort_by?: 'netVotes' | 'chronological' | 'participants' | 'category_overlap'; // ENHANCED: Added category_overlap
  sort_direction?: 'asc' | 'desc';
  keywords?: string[];
  includeKeywordsFilter?: boolean; // NEW: Include/exclude logic for keywords
  user_id?: string;
  include_relationships?: boolean;
  relationship_types?: Array<
    | 'shared_keyword'
    | 'related_to'
    | 'answers'
    | 'shared_category'
    | 'categorized_as'
  >; // ENHANCED: Added category relationship types

  // NEW: Discovery options
  minCategoryOverlap?: number;
  includeCategorizationData?: boolean;
}

@Controller('graph/universal')
@UseGuards(JwtAuthGuard)
export class UniversalGraphController {
  private readonly logger = new Logger(UniversalGraphController.name);

  constructor(private readonly universalGraphService: UniversalGraphService) {}

  @Get('nodes')
  async getUniversalNodes(
    @Query() query: any,
    @Request() req: any,
  ): Promise<UniversalGraphResponse> {
    try {
      this.logger.log(
        `Received request for universal nodes with enhanced params: ${JSON.stringify(query)}`,
      );

      // Parse query parameters properly
      const parsedQuery: UniversalGraphOptions = {};

      // ENHANCED: Handle node_types as array - now supports all node types
      if (query.node_types) {
        const nodeTypes = Array.isArray(query.node_types)
          ? query.node_types
          : [query.node_types];

        // Validate that only supported types are requested
        const validTypes = [
          'openquestion',
          'statement',
          'answer',
          'quantity',
          'category',
        ];
        const invalidTypes = nodeTypes.filter(
          (type) => !validTypes.includes(type),
        );
        if (invalidTypes.length > 0) {
          throw new BadRequestException(
            `Invalid node types: ${invalidTypes.join(', ')}. Supported types are: ${validTypes.join(', ')}.`,
          );
        }

        parsedQuery.node_types = nodeTypes as Array<
          'openquestion' | 'statement' | 'answer' | 'quantity' | 'category'
        >;
      } else {
        // Default to both openquestion and statement for backward compatibility
        parsedQuery.node_types = ['openquestion', 'statement'];
      }

      // NEW: Handle includeNodeTypes flag
      if (query.includeNodeTypes !== undefined) {
        parsedQuery.includeNodeTypes =
          query.includeNodeTypes === 'true' || query.includeNodeTypes === true;
      }

      // NEW: Handle categories as array
      if (query.categories) {
        if (Array.isArray(query.categories)) {
          parsedQuery.categories = query.categories;
        } else {
          parsedQuery.categories = [query.categories];
        }
      }

      // NEW: Handle includeCategoriesFilter flag
      if (query.includeCategoriesFilter !== undefined) {
        parsedQuery.includeCategoriesFilter =
          query.includeCategoriesFilter === 'true' ||
          query.includeCategoriesFilter === true;
      }

      // Handle keywords as array
      if (query.keywords) {
        if (Array.isArray(query.keywords)) {
          parsedQuery.keywords = query.keywords;
        } else {
          parsedQuery.keywords = [query.keywords];
        }
      }

      // NEW: Handle includeKeywordsFilter flag
      if (query.includeKeywordsFilter !== undefined) {
        parsedQuery.includeKeywordsFilter =
          query.includeKeywordsFilter === 'true' ||
          query.includeKeywordsFilter === true;
      }

      // Handle relationship_types as array - ENHANCED with category relationship types
      if (query.relationship_types) {
        const relTypes = Array.isArray(query.relationship_types)
          ? query.relationship_types
          : [query.relationship_types];

        // Validate relationship types - now includes category relationship types
        const validRelTypes = [
          'shared_keyword',
          'related_to',
          'answers',
          'shared_category',
          'categorized_as',
        ];
        const invalidRelTypes = relTypes.filter(
          (type) => !validRelTypes.includes(type),
        );
        if (invalidRelTypes.length > 0) {
          throw new BadRequestException(
            `Invalid relationship types: ${invalidRelTypes.join(', ')}. Valid types are: ${validRelTypes.join(', ')}`,
          );
        }

        parsedQuery.relationship_types = relTypes as Array<
          | 'shared_keyword'
          | 'related_to'
          | 'answers'
          | 'shared_category'
          | 'categorized_as'
        >;
      }

      // Parse numeric values
      if (query.limit !== undefined) {
        parsedQuery.limit = Number(query.limit);
      }
      if (query.offset !== undefined) {
        parsedQuery.offset = Number(query.offset);
      }

      // NEW: Parse minCategoryOverlap
      if (query.minCategoryOverlap !== undefined) {
        parsedQuery.minCategoryOverlap = Number(query.minCategoryOverlap);
      }

      // Parse boolean values
      if (query.include_relationships !== undefined) {
        parsedQuery.include_relationships =
          query.include_relationships === 'true' ||
          query.include_relationships === true;
      }

      // NEW: Parse includeCategorizationData
      if (query.includeCategorizationData !== undefined) {
        parsedQuery.includeCategorizationData =
          query.includeCategorizationData === 'true' ||
          query.includeCategorizationData === true;
      }

      // Copy string values
      if (query.sort_by) {
        parsedQuery.sort_by = query.sort_by;
      }
      if (query.sort_direction) {
        parsedQuery.sort_direction = query.sort_direction;
      }
      if (query.user_id) {
        parsedQuery.user_id = query.user_id;
      }

      // Pass the requesting user's ID for user-specific data enhancement
      parsedQuery.requesting_user_id = req.user?.sub;

      this.logger.log(
        `Parsed enhanced query params: ${JSON.stringify(parsedQuery)}`,
      );

      // Validate query parameters
      this.validateQueryParams(parsedQuery);

      const result =
        await this.universalGraphService.getUniversalNodes(parsedQuery);

      // Log performance metrics for monitoring
      if (result.performance_metrics) {
        this.logger.log(
          `Enhanced Performance: ${result.performance_metrics.node_count} nodes, ` +
            `${result.performance_metrics.relationship_count} relationships ` +
            `(density: ${result.performance_metrics.relationship_density}, ` +
            `consolidation: ${result.performance_metrics.consolidation_ratio}x` +
            (result.performance_metrics.category_filtered_count
              ? `, category_filtered: ${result.performance_metrics.category_filtered_count}`
              : '') +
            ')',
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Error in getUniversalNodes: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  private validateQueryParams(query: UniversalGraphOptions): void {
    // Validate limit
    if (query.limit !== undefined) {
      const limit = Number(query.limit);
      if (isNaN(limit) || limit < 1 || limit > 1000) {
        throw new BadRequestException('limit must be between 1 and 1000');
      }
    }

    // Validate offset
    if (query.offset !== undefined) {
      const offset = Number(query.offset);
      if (isNaN(offset) || offset < 0) {
        throw new BadRequestException('offset must be non-negative');
      }
    }

    // ENHANCED: Validate sort_by with new category_overlap option
    if (query.sort_by) {
      const validSortOptions = [
        'netVotes',
        'chronological',
        'participants',
        'category_overlap',
      ];
      if (!validSortOptions.includes(query.sort_by)) {
        throw new BadRequestException(
          `sort_by must be one of: ${validSortOptions.join(', ')}`,
        );
      }
    }

    // Validate sort_direction
    if (
      query.sort_direction &&
      !['asc', 'desc'].includes(query.sort_direction)
    ) {
      throw new BadRequestException(
        'sort_direction must be either asc or desc',
      );
    }

    // ENHANCED: Validate node_types with new supported types
    if (query.node_types) {
      const validTypes = [
        'openquestion',
        'statement',
        'answer',
        'quantity',
        'category',
      ];
      const types = Array.isArray(query.node_types)
        ? query.node_types
        : [query.node_types];

      const invalidTypes = types.filter((type) => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        throw new BadRequestException(
          `Invalid node types: ${invalidTypes.join(', ')}. Supported types are: ${validTypes.join(', ')}.`,
        );
      }
    }

    // ENHANCED: Validate relationship_types with new category relationship types
    if (query.relationship_types) {
      const validRelTypes = [
        'shared_keyword',
        'related_to',
        'answers',
        'shared_category',
        'categorized_as',
      ];
      const types = Array.isArray(query.relationship_types)
        ? query.relationship_types
        : [query.relationship_types];

      const invalidTypes = types.filter(
        (type) => !validRelTypes.includes(type),
      );
      if (invalidTypes.length > 0) {
        throw new BadRequestException(
          `Invalid relationship types: ${invalidTypes.join(', ')}. Valid types are: ${validRelTypes.join(', ')}`,
        );
      }
    }

    // Validate keywords array
    if (query.keywords && Array.isArray(query.keywords)) {
      if (
        query.keywords.some(
          (keyword) => typeof keyword !== 'string' || keyword.trim() === '',
        )
      ) {
        throw new BadRequestException('All keywords must be non-empty strings');
      }
    }

    // NEW: Validate categories array
    if (query.categories && Array.isArray(query.categories)) {
      if (
        query.categories.some(
          (category) => typeof category !== 'string' || category.trim() === '',
        )
      ) {
        throw new BadRequestException(
          'All category IDs must be non-empty strings',
        );
      }
    }

    // NEW: Validate minCategoryOverlap
    if (query.minCategoryOverlap !== undefined) {
      const overlap = Number(query.minCategoryOverlap);
      if (isNaN(overlap) || overlap < 1) {
        throw new BadRequestException(
          'minCategoryOverlap must be a positive integer',
        );
      }
    }

    // Validate user_id format (basic check)
    if (query.user_id && typeof query.user_id !== 'string') {
      throw new BadRequestException('user_id must be a string');
    }

    // NEW: Validate category_overlap sort requirements
    if (
      query.sort_by === 'category_overlap' &&
      (!query.categories || query.categories.length === 0)
    ) {
      throw new BadRequestException(
        'category_overlap sorting requires at least one category to be specified',
      );
    }
  }

  /**
   * ENHANCED: Health check endpoint with new supported types
   */
  @Get('health')
  async getHealthStatus(): Promise<{
    status: string;
    supportedTypes: string[];
    supportedRelationshipTypes: string[];
    supportedSortOptions: string[];
    performanceOptimizations: string[];
  }> {
    this.logger.debug('Health check requested for enhanced universal graph');

    return {
      status: 'healthy',
      supportedTypes: [
        'openquestion',
        'statement',
        'answer',
        'quantity',
        'category',
      ],
      supportedRelationshipTypes: [
        'shared_keyword',
        'related_to',
        'answers',
        'shared_category',
        'categorized_as',
      ],
      supportedSortOptions: [
        'netVotes',
        'chronological',
        'participants',
        'category_overlap',
      ],
      performanceOptimizations: [
        'consolidated_shared_keyword_relationships',
        'user_data_enhancement',
        'performance_metrics_tracking',
        'category_based_filtering',
        'category_overlap_discovery',
      ],
    };
  }

  /**
   * ENHANCED: Get available sort options with new category support
   */
  @Get('sort-options')
  async getSortOptions(): Promise<{
    sortBy: string[];
    sortDirection: string[];
    relationshipTypes: string[];
    filteringOptions: {
      supportedNodeTypes: string[];
      categoryFiltering: boolean;
      keywordFiltering: boolean;
      includeExcludeLogic: boolean;
    };
  }> {
    this.logger.debug('Enhanced sort options requested');

    return {
      sortBy: ['netVotes', 'chronological', 'participants', 'category_overlap'],
      sortDirection: ['asc', 'desc'],
      relationshipTypes: [
        'shared_keyword',
        'related_to',
        'answers',
        'shared_category',
        'categorized_as',
      ],
      filteringOptions: {
        supportedNodeTypes: [
          'openquestion',
          'statement',
          'answer',
          'quantity',
          'category',
        ],
        categoryFiltering: true,
        keywordFiltering: true,
        includeExcludeLogic: true,
      },
    };
  }

  /**
   * ENHANCED: Performance metrics endpoint with category metrics
   */
  @Get('performance')
  async getPerformanceMetrics(@Query() query: any): Promise<{
    current_metrics?: any;
    optimization_info: {
      consolidation_enabled: boolean;
      expected_reduction: string;
      features: string[];
    };
  }> {
    this.logger.debug('Enhanced performance metrics requested');

    const optimizationInfo = {
      consolidation_enabled: true,
      expected_reduction: '~70% relationship count reduction',
      features: [
        'Consolidated shared keyword relationships',
        'Performance metrics tracking',
        'User-specific data enhancement',
        'Category-based filtering and discovery',
        'Multi-node type support (5 types)',
        'Advanced include/exclude filtering logic',
        'Category overlap sorting for discovery',
        'Backward compatibility maintained',
      ],
    };

    // Optionally include current metrics if specific query provided
    let current_metrics;
    if (query.include_current && query.include_current === 'true') {
      try {
        // Get a small sample to calculate current metrics with enhanced options
        const sampleResult = await this.universalGraphService.getUniversalNodes(
          {
            limit: 50,
            include_relationships: true,
            node_types: ['openquestion', 'statement', 'category'], // Sample with categories
            relationship_types: ['shared_keyword', 'shared_category'],
            includeCategorizationData: true,
          },
        );
        current_metrics = sampleResult.performance_metrics;
      } catch (error) {
        this.logger.warn(
          `Could not fetch current enhanced metrics: ${error.message}`,
        );
      }
    }

    return {
      current_metrics,
      optimization_info: optimizationInfo,
    };
  }

  /**
   * NEW: Category discovery endpoint for finding related content via categories
   */
  @Get('category-discovery')
  async getCategoryBasedDiscovery(
    @Query('categories') categories?: string | string[],
    @Query('minOverlap') minOverlap: string = '1',
    @Query('nodeTypes') nodeTypes?: string | string[],
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
    @Request() req?: any,
  ): Promise<UniversalGraphResponse> {
    try {
      this.logger.log('Category-based discovery requested');

      if (!categories) {
        throw new BadRequestException(
          'Categories parameter is required for category discovery',
        );
      }

      // Parse categories
      const categoryList = Array.isArray(categories)
        ? categories
        : [categories];

      // Parse node types
      const nodeTypeList = nodeTypes
        ? Array.isArray(nodeTypes)
          ? nodeTypes
          : [nodeTypes]
        : ['openquestion', 'statement', 'answer', 'quantity'];

      const discoveryQuery: UniversalGraphOptions = {
        categories: categoryList,
        includeCategoriesFilter: true,
        node_types: nodeTypeList as any,
        includeNodeTypes: true,
        sort_by: 'category_overlap',
        sort_direction: 'desc',
        limit: parseInt(limit),
        offset: parseInt(offset),
        include_relationships: true,
        relationship_types: ['shared_category', 'categorized_as'],
        minCategoryOverlap: parseInt(minOverlap),
        includeCategorizationData: true,
        requesting_user_id: req?.user?.sub,
      };

      this.validateQueryParams(discoveryQuery);

      return await this.universalGraphService.getUniversalNodes(discoveryQuery);
    } catch (error) {
      this.logger.error(`Error in category discovery: ${error.message}`);
      throw new BadRequestException(
        `Category discovery failed: ${error.message}`,
      );
    }
  }
}
