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
  node_types?: Array<'openquestion'>; // | 'statement' | 'quantity'>;
  limit?: number;
  offset?: number;
  sort_by?: 'netVotes' | 'chronological' | 'participants';
  sort_direction?: 'asc' | 'desc';
  keywords?: string[];
  user_id?: string;
  include_relationships?: boolean;
  relationship_types?: Array<'shared_keyword' | 'related_to'>; // | 'answers' | 'responds_to'>;
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
        `Received request for universal nodes with params: ${JSON.stringify(query)}`,
      );

      // Parse query parameters properly
      const parsedQuery: UniversalGraphOptions = {};

      // Handle node_types as array - only allow 'openquestion' for now
      if (query.node_types) {
        const nodeTypes = Array.isArray(query.node_types)
          ? query.node_types
          : [query.node_types];

        // Validate that only openquestion is requested
        const invalidTypes = nodeTypes.filter(
          (type) => type !== 'openquestion',
        );
        if (invalidTypes.length > 0) {
          throw new BadRequestException(
            `Invalid node types: ${invalidTypes.join(', ')}. Only 'openquestion' is currently supported.`,
          );
        }

        parsedQuery.node_types = nodeTypes as Array<'openquestion'>;
      } else {
        // Default to openquestion only
        parsedQuery.node_types = ['openquestion'];
      }

      // Handle keywords as array
      if (query.keywords) {
        if (Array.isArray(query.keywords)) {
          parsedQuery.keywords = query.keywords;
        } else {
          parsedQuery.keywords = [query.keywords];
        }
      }

      // Handle relationship_types as array
      if (query.relationship_types) {
        const relTypes = Array.isArray(query.relationship_types)
          ? query.relationship_types
          : [query.relationship_types];

        // Validate relationship types for OpenQuestion
        const validRelTypes = ['shared_keyword', 'related_to'];
        const invalidRelTypes = relTypes.filter(
          (type) => !validRelTypes.includes(type),
        );
        if (invalidRelTypes.length > 0) {
          throw new BadRequestException(
            `Invalid relationship types: ${invalidRelTypes.join(', ')}. Valid types are: ${validRelTypes.join(', ')}`,
          );
        }

        parsedQuery.relationship_types = relTypes as Array<
          'shared_keyword' | 'related_to'
        >;
      }

      // Parse numeric values
      if (query.limit !== undefined) {
        parsedQuery.limit = Number(query.limit);
      }
      if (query.offset !== undefined) {
        parsedQuery.offset = Number(query.offset);
      }

      // Parse boolean values
      if (query.include_relationships !== undefined) {
        parsedQuery.include_relationships =
          query.include_relationships === 'true' ||
          query.include_relationships === true;
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

      this.logger.log(`Parsed query params: ${JSON.stringify(parsedQuery)}`);

      // Validate query parameters
      this.validateQueryParams(parsedQuery);

      return await this.universalGraphService.getUniversalNodes(parsedQuery);
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

    // Validate sort_by for OpenQuestion nodes
    if (query.sort_by) {
      const validSortOptions = ['netVotes', 'chronological', 'participants'];
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

    // Validate node_types (should only be openquestion for now)
    if (query.node_types) {
      const types = Array.isArray(query.node_types)
        ? query.node_types
        : [query.node_types];

      const invalidTypes = types.filter((type) => type !== 'openquestion');
      if (invalidTypes.length > 0) {
        throw new BadRequestException(
          `Invalid node types: ${invalidTypes.join(', ')}. Only 'openquestion' is currently supported.`,
        );
      }
    }

    // Validate relationship_types
    if (query.relationship_types) {
      const validRelTypes = ['shared_keyword', 'related_to'];
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

    // Validate user_id format (basic check)
    if (query.user_id && typeof query.user_id !== 'string') {
      throw new BadRequestException('user_id must be a string');
    }
  }

  /**
   * Health check endpoint for the universal graph
   */
  @Get('health')
  async getHealthStatus(): Promise<{
    status: string;
    supportedTypes: string[];
  }> {
    this.logger.debug('Health check requested for universal graph');

    return {
      status: 'healthy',
      supportedTypes: ['openquestion'],
    };
  }

  /**
   * Get available sort options for the current configuration
   */
  @Get('sort-options')
  async getSortOptions(): Promise<{
    sortBy: string[];
    sortDirection: string[];
    relationshipTypes: string[];
  }> {
    this.logger.debug('Sort options requested');

    return {
      sortBy: ['netVotes', 'chronological', 'participants'],
      sortDirection: ['asc', 'desc'],
      relationshipTypes: ['shared_keyword', 'related_to'],
    };
  }
}
