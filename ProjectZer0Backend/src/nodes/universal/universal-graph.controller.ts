// src/nodes/universal/universal-graph.controller.ts

import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  UniversalGraphService,
  UniversalGraphOptions,
  UniversalGraphResponse,
} from './universal-graph.service';

export class UniversalNodesQueryDto implements UniversalGraphOptions {
  node_types?: Array<'statement' | 'openquestion' | 'quantity'>;
  min_consensus?: number;
  max_consensus?: number;
  limit?: number;
  offset?: number;
  sort_by?: 'consensus' | 'chronological' | 'participants';
  sort_direction?: 'asc' | 'desc';
  keywords?: string[];
  user_id?: string;
}

@Controller('graph/universal')
// @UseGuards(JwtAuthGuard)  // Keep commented out for testing
export class UniversalGraphController {
  private readonly logger = new Logger(UniversalGraphController.name);

  constructor(private readonly universalGraphService: UniversalGraphService) {}

  @Get('nodes')
  async getUniversalNodes(
    @Query() query: any, // Changed from UniversalNodesQueryDto to any for now
  ): Promise<UniversalGraphResponse> {
    try {
      this.logger.log(
        `Received request for universal nodes with params: ${JSON.stringify(query)}`,
      );

      // Parse query parameters properly
      const parsedQuery: UniversalGraphOptions = {};

      // Handle node_types as array
      if (query.node_types) {
        if (Array.isArray(query.node_types)) {
          parsedQuery.node_types = query.node_types;
        } else {
          parsedQuery.node_types = [query.node_types];
        }
      }

      // Handle keywords as array
      if (query.keywords) {
        if (Array.isArray(query.keywords)) {
          parsedQuery.keywords = query.keywords;
        } else {
          parsedQuery.keywords = [query.keywords];
        }
      }

      // Parse numeric values
      if (query.min_consensus !== undefined) {
        parsedQuery.min_consensus = Number(query.min_consensus);
      }
      if (query.max_consensus !== undefined) {
        parsedQuery.max_consensus = Number(query.max_consensus);
      }
      if (query.limit !== undefined) {
        parsedQuery.limit = Number(query.limit);
      }
      if (query.offset !== undefined) {
        parsedQuery.offset = Number(query.offset);
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
    // Validate consensus range
    if (query.min_consensus !== undefined) {
      const min = Number(query.min_consensus);
      if (isNaN(min) || min < 0 || min > 1) {
        throw new BadRequestException('min_consensus must be between 0 and 1');
      }
    }

    if (query.max_consensus !== undefined) {
      const max = Number(query.max_consensus);
      if (isNaN(max) || max < 0 || max > 1) {
        throw new BadRequestException('max_consensus must be between 0 and 1');
      }
    }

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

    // Validate sort_by
    if (
      query.sort_by &&
      !['consensus', 'chronological', 'participants'].includes(query.sort_by)
    ) {
      throw new BadRequestException(
        'sort_by must be one of: consensus, chronological, participants',
      );
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

    // Validate node_types
    if (query.node_types) {
      const validTypes = ['statement', 'openquestion', 'quantity'];
      const types = Array.isArray(query.node_types)
        ? query.node_types
        : [query.node_types];

      for (const type of types) {
        if (!validTypes.includes(type)) {
          throw new BadRequestException(
            `Invalid node type: ${type}. Must be one of: ${validTypes.join(', ')}`,
          );
        }
      }
    }
  }
}
