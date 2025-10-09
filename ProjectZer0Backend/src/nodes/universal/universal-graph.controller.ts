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

/**
 * DTO for Universal Graph query parameters
 * Phase 4.1: Supports all 5 content node types (no Category in dataset)
 * Phase 4.2: Added ANY/ALL modes for keyword and category filters, plus user interaction filtering
 */
export class UniversalNodesQueryDto {
  // Node type filtering
  node_types?: Array<
    'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence'
  >;
  includeNodeTypes?: boolean;

  // ✅ Phase 4.2: Category filtering with ANY/ALL modes
  categories?: string[];
  includeCategoriesFilter?: boolean;
  categoryMode?: 'any' | 'all'; // NEW: any = at least one, all = must have all

  // Pagination
  limit?: number;
  offset?: number;

  // Sorting
  sort_by?:
    | 'netVotes'
    | 'chronological'
    | 'participants'
    | 'latest_activity'
    | 'inclusion_votes'
    | 'content_votes'
    | 'keyword_relevance';
  sort_direction?: 'asc' | 'desc';

  // ✅ Phase 4.2: Keyword filtering with ANY/ALL modes
  keywords?: string[];
  includeKeywordsFilter?: boolean;
  keywordMode?: 'any' | 'all'; // NEW: any = at least one, all = must have all

  // ✅ Phase 4.2: User filtering with interaction modes
  user_id?: string;
  userFilterMode?: 'all' | 'created' | 'interacted' | 'voted'; // NEW: Filter by user interaction

  // Relationships
  include_relationships?: boolean;
  relationship_types?: Array<
    | 'shared_keyword'
    | 'related_to'
    | 'answers'
    | 'evidence_for'
    | 'shared_category'
    | 'categorized_as'
  >;

  // Discovery options
  minCategoryOverlap?: number;
  includeCategorizationData?: boolean;
}

/**
 * Universal Graph Controller
 *
 * Phase 4.1: Schema integration complete ✅
 * - Uses injected schemas instead of direct Neo4j queries
 * - Supports all 5 primary content node types
 * - Evidence support included
 * - Content vote fallback for OpenQuestion/Quantity/Evidence
 *
 * Phase 4.2: Advanced filtering complete ✅
 * - Keyword filtering with ANY/ALL modes
 * - Category filtering with ANY/ALL modes
 * - User interaction filtering (all/created/interacted/voted modes)
 *
 * Endpoints:
 * - GET /graph/universal/nodes - Fetch universal graph with filters
 * - GET /graph/universal/filters/keywords - Get available keywords
 * - GET /graph/universal/filters/categories - Get available categories
 */
@Controller('graph/universal')
@UseGuards(JwtAuthGuard)
export class UniversalGraphController {
  private readonly logger = new Logger(UniversalGraphController.name);

  constructor(private readonly universalGraphService: UniversalGraphService) {}

  /**
   * Get Universal Graph Nodes
   *
   * Fetches nodes of specified types with filtering, sorting, and relationships.
   * All filtering options support both include and exclude modes.
   *
   * Query Parameters:
   * - node_types: Comma-separated or array of types (default: statement,openquestion)
   * - includeNodeTypes: true=include types, false=exclude types (default: true)
   *
   * - categories: Comma-separated or array of category IDs
   * - includeCategoriesFilter: true=include, false=exclude (default: true)
   * - categoryMode: 'any'=at least one category, 'all'=all categories (default: any) ✅ NEW
   *
   * - keywords: Comma-separated or array of keywords
   * - includeKeywordsFilter: true=include, false=exclude (default: true)
   * - keywordMode: 'any'=at least one keyword, 'all'=all keywords (default: any) ✅ NEW
   *
   * - user_id: User ID for user filtering
   * - userFilterMode: 'all'=no filter, 'created'=created by user,
   *                   'voted'=voted by user, 'interacted'=voted or commented (default: all) ✅ NEW
   *
   * - limit: Max nodes to return (1-1000, default: 200)
   * - offset: Pagination offset (default: 0)
   * - sort_by: Sort field (default: netVotes)
   * - sort_direction: asc or desc (default: desc)
   * - include_relationships: Include graph relationships (default: true)
   * - relationship_types: Types of relationships to include
   * - minCategoryOverlap: Minimum shared categories for relationships (default: 1)
   *
   * Examples:
   * - Basic: GET /graph/universal/nodes?node_types=statement,answer&limit=50
   * - Keyword ANY: GET /graph/universal/nodes?keywords=ai,ethics&keywordMode=any
   * - Keyword ALL: GET /graph/universal/nodes?keywords=ai,ethics&keywordMode=all
   * - Category ALL: GET /graph/universal/nodes?categories=tech,philosophy&categoryMode=all
   * - User created: GET /graph/universal/nodes?user_id=user-123&userFilterMode=created
   * - User voted: GET /graph/universal/nodes?user_id=user-123&userFilterMode=voted
   */
  @Get('nodes')
  async getUniversalNodes(
    @Query() query: any,
    @Request() req: any,
  ): Promise<UniversalGraphResponse> {
    try {
      this.logger.log(
        `Universal graph request from user ${req.user?.sub} with params: ${JSON.stringify(query)}`,
      );

      // Parse and validate query parameters
      const parsedQuery: UniversalGraphOptions = this.parseQueryParams(
        query,
        req,
      );

      // Validate parsed parameters
      this.validateQueryParams(parsedQuery);

      // Call service
      const result =
        await this.universalGraphService.getUniversalNodes(parsedQuery);

      // Log performance metrics
      if (result.performance_metrics) {
        this.logger.log(
          `Performance: ${result.performance_metrics.node_count} nodes, ` +
            `${result.performance_metrics.relationship_count} relationships, ` +
            `density: ${result.performance_metrics.relationship_density.toFixed(2)}, ` +
            `filtered: ${result.performance_metrics.category_filtered_count || 0}`,
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
      throw new BadRequestException(
        `Failed to fetch universal nodes: ${error.message}`,
      );
    }
  }

  /**
   * Get Available Keywords
   *
   * Returns all keywords that have been approved (passed inclusion voting)
   * and are tagged on at least one content node. Useful for populating
   * keyword filter UI components.
   *
   * Response includes usage counts for each keyword.
   */
  @Get('filters/keywords')
  async getAvailableKeywords(@Request() req: any) {
    try {
      this.logger.debug(
        `Fetching available keywords for user ${req.user?.sub}`,
      );

      const keywords = await this.universalGraphService.getAvailableKeywords();

      return {
        keywords,
        total: keywords.length,
      };
    } catch (error) {
      this.logger.error(`Error fetching keywords: ${error.message}`);
      throw new BadRequestException('Failed to fetch available keywords');
    }
  }

  /**
   * Get Available Categories
   *
   * Returns all categories that have been approved (passed inclusion voting).
   * Useful for populating category filter UI components.
   *
   * Response includes usage counts and hierarchy information.
   */
  @Get('filters/categories')
  async getAvailableCategories(@Request() req: any) {
    try {
      this.logger.debug(
        `Fetching available categories for user ${req.user?.sub}`,
      );

      const categories =
        await this.universalGraphService.getAvailableCategories();

      return {
        categories,
        total: categories.length,
      };
    } catch (error) {
      this.logger.error(`Error fetching categories: ${error.message}`);
      throw new BadRequestException('Failed to fetch available categories');
    }
  }

  /**
   * Parse query parameters into UniversalGraphOptions
   */
  private parseQueryParams(query: any, req: any): UniversalGraphOptions {
    const parsedQuery: UniversalGraphOptions = {};

    // Parse node_types (array or comma-separated string)
    if (query.node_types) {
      const nodeTypes = Array.isArray(query.node_types)
        ? query.node_types
        : query.node_types.split(',').map((t: string) => t.trim());

      // Validate node types
      const validTypes = [
        'statement',
        'openquestion',
        'answer',
        'quantity',
        'evidence',
      ];
      const invalidTypes = nodeTypes.filter(
        (type: string) => !validTypes.includes(type),
      );

      if (invalidTypes.length > 0) {
        throw new BadRequestException(
          `Invalid node types: ${invalidTypes.join(', ')}. ` +
            `Valid types are: ${validTypes.join(', ')}`,
        );
      }

      parsedQuery.node_types = nodeTypes as Array<
        'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence'
      >;
    }

    // Parse includeNodeTypes (boolean)
    if (query.includeNodeTypes !== undefined) {
      parsedQuery.includeNodeTypes =
        query.includeNodeTypes === 'true' || query.includeNodeTypes === true;
    }

    // Parse categories (array or comma-separated string)
    if (query.categories) {
      parsedQuery.categories = Array.isArray(query.categories)
        ? query.categories
        : query.categories.split(',').map((c: string) => c.trim());
    }

    // Parse includeCategoriesFilter (boolean)
    if (query.includeCategoriesFilter !== undefined) {
      parsedQuery.includeCategoriesFilter =
        query.includeCategoriesFilter === 'true' ||
        query.includeCategoriesFilter === true;
    }

    // ✅ Phase 4.2: Parse categoryMode (any | all)
    if (query.categoryMode) {
      parsedQuery.categoryMode = query.categoryMode;
    }

    // Parse keywords (array or comma-separated string)
    if (query.keywords) {
      parsedQuery.keywords = Array.isArray(query.keywords)
        ? query.keywords
        : query.keywords.split(',').map((k: string) => k.trim());
    }

    // Parse includeKeywordsFilter (boolean)
    if (query.includeKeywordsFilter !== undefined) {
      parsedQuery.includeKeywordsFilter =
        query.includeKeywordsFilter === 'true' ||
        query.includeKeywordsFilter === true;
    }

    // ✅ Phase 4.2: Parse keywordMode (any | all)
    if (query.keywordMode) {
      parsedQuery.keywordMode = query.keywordMode;
    }

    // Parse user_id (string)
    if (query.user_id) {
      parsedQuery.user_id = query.user_id;
    }

    // ✅ Phase 4.2: Parse userFilterMode (all | created | interacted | voted)
    if (query.userFilterMode) {
      parsedQuery.userFilterMode = query.userFilterMode;
    }

    // Parse relationship_types (array or comma-separated string)
    if (query.relationship_types) {
      const relTypes = Array.isArray(query.relationship_types)
        ? query.relationship_types
        : query.relationship_types.split(',').map((t: string) => t.trim());

      // Validate relationship types
      const validRelTypes = [
        'shared_keyword',
        'related_to',
        'answers',
        'evidence_for',
        'shared_category',
        'categorized_as',
      ];
      const invalidRelTypes = relTypes.filter(
        (type: string) => !validRelTypes.includes(type),
      );

      if (invalidRelTypes.length > 0) {
        throw new BadRequestException(
          `Invalid relationship types: ${invalidRelTypes.join(', ')}. ` +
            `Valid types are: ${validRelTypes.join(', ')}`,
        );
      }

      parsedQuery.relationship_types = relTypes as Array<
        | 'shared_keyword'
        | 'related_to'
        | 'answers'
        | 'evidence_for'
        | 'shared_category'
        | 'categorized_as'
      >;
    }

    // Parse numeric values
    if (query.limit !== undefined) {
      const limit = Number(query.limit);
      if (isNaN(limit)) {
        throw new BadRequestException('limit must be a number');
      }
      parsedQuery.limit = limit;
    }

    if (query.offset !== undefined) {
      const offset = Number(query.offset);
      if (isNaN(offset)) {
        throw new BadRequestException('offset must be a number');
      }
      parsedQuery.offset = offset;
    }

    if (query.minCategoryOverlap !== undefined) {
      const overlap = Number(query.minCategoryOverlap);
      if (isNaN(overlap)) {
        throw new BadRequestException('minCategoryOverlap must be a number');
      }
      parsedQuery.minCategoryOverlap = overlap;
    }

    // Parse boolean values
    if (query.include_relationships !== undefined) {
      parsedQuery.include_relationships =
        query.include_relationships === 'true' ||
        query.include_relationships === true;
    }

    if (query.includeCategorizationData !== undefined) {
      parsedQuery.includeCategorizationData =
        query.includeCategorizationData === 'true' ||
        query.includeCategorizationData === true;
    }

    // Parse string values
    if (query.sort_by) {
      parsedQuery.sort_by = query.sort_by;
    }

    if (query.sort_direction) {
      parsedQuery.sort_direction = query.sort_direction;
    }

    // Add requesting user ID from JWT token
    parsedQuery.requesting_user_id = req.user?.sub;

    this.logger.debug(
      `Parsed query parameters: ${JSON.stringify(parsedQuery)}`,
    );

    return parsedQuery;
  }

  /**
   * Validate query parameters
   */
  private validateQueryParams(query: UniversalGraphOptions): void {
    // Validate limit
    if (query.limit !== undefined) {
      if (query.limit < 1 || query.limit > 1000) {
        throw new BadRequestException('limit must be between 1 and 1000');
      }
    }

    // Validate offset
    if (query.offset !== undefined) {
      if (query.offset < 0) {
        throw new BadRequestException('offset must be non-negative');
      }
    }

    // Validate sort_by
    if (query.sort_by) {
      const validSortOptions = [
        'netVotes',
        'chronological',
        'participants',
        'latest_activity',
        'inclusion_votes',
        'content_votes',
        'keyword_relevance',
      ];

      if (!validSortOptions.includes(query.sort_by)) {
        throw new BadRequestException(
          `sort_by must be one of: ${validSortOptions.join(', ')}`,
        );
      }
    }

    // Validate sort_direction
    if (query.sort_direction) {
      if (!['asc', 'desc'].includes(query.sort_direction)) {
        throw new BadRequestException(
          'sort_direction must be either "asc" or "desc"',
        );
      }
    }

    // ✅ Phase 4.2: Validate keywordMode
    if (query.keywordMode) {
      if (!['any', 'all'].includes(query.keywordMode)) {
        throw new BadRequestException(
          'keywordMode must be either "any" or "all"',
        );
      }
    }

    // ✅ Phase 4.2: Validate categoryMode
    if (query.categoryMode) {
      if (!['any', 'all'].includes(query.categoryMode)) {
        throw new BadRequestException(
          'categoryMode must be either "any" or "all"',
        );
      }
    }

    // ✅ Phase 4.2: Validate userFilterMode
    if (query.userFilterMode) {
      if (
        !['all', 'created', 'interacted', 'voted'].includes(
          query.userFilterMode,
        )
      ) {
        throw new BadRequestException(
          'userFilterMode must be one of: all, created, interacted, voted',
        );
      }
    }

    // Validate minCategoryOverlap
    if (query.minCategoryOverlap !== undefined) {
      if (query.minCategoryOverlap < 0) {
        throw new BadRequestException(
          'minCategoryOverlap must be non-negative',
        );
      }
    }

    // Validate node types exist if provided
    if (query.node_types && query.node_types.length === 0) {
      throw new BadRequestException('node_types cannot be an empty array');
    }

    // Validate arrays are not empty if provided
    if (query.categories && query.categories.length === 0) {
      throw new BadRequestException('categories cannot be an empty array');
    }

    if (query.keywords && query.keywords.length === 0) {
      throw new BadRequestException('keywords cannot be an empty array');
    }

    if (query.relationship_types && query.relationship_types.length === 0) {
      throw new BadRequestException(
        'relationship_types cannot be an empty array',
      );
    }
  }
}
