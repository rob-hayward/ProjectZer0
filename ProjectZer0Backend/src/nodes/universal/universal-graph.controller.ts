// src/nodes/universal/universal-graph.controller.ts

import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  Request, // NEW: Add Request for user data
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
@UseGuards(JwtAuthGuard) // Comment out for endpoint testing
export class UniversalGraphController {
  private readonly logger = new Logger(UniversalGraphController.name);

  constructor(private readonly universalGraphService: UniversalGraphService) {}

  @Get('nodes')
  async getUniversalNodes(
    @Query() query: any, // Changed from UniversalNodesQueryDto to any for now
    @Request() req: any, // NEW: Add request to get authenticated user
  ): Promise<UniversalGraphResponse> {
    try {
      this.logger.log(
        `Received request for universal nodes with params: ${JSON.stringify(query)}`,
      );

      // Parse query parameters properly with robust integer conversion
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

      // Parse numeric values with safe integer conversion
      if (query.min_consensus !== undefined) {
        const value = this.parseFloat(query.min_consensus, 'min_consensus');
        parsedQuery.min_consensus = value;
      }
      if (query.max_consensus !== undefined) {
        const value = this.parseFloat(query.max_consensus, 'max_consensus');
        parsedQuery.max_consensus = value;
      }

      // CRITICAL: Use parseInt for integer values to prevent .0 floats
      if (query.limit !== undefined) {
        const value = this.parseInt(query.limit, 'limit');
        parsedQuery.limit = value;
      }
      if (query.offset !== undefined) {
        const value = this.parseInt(query.offset, 'offset');
        parsedQuery.offset = value;
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

      // NEW: Get current user ID from JWT token
      const currentUserId = req.user?.sub;

      if (currentUserId) {
        this.logger.debug(
          `Fetching universal nodes for authenticated user: ${currentUserId}`,
        );
      }

      // NEW: Pass current user ID to service for user-specific data
      return await this.universalGraphService.getUniversalNodes(
        parsedQuery,
        currentUserId, // Pass the authenticated user ID
      );
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

  /**
   * Safely parse integer values, ensuring they are whole numbers
   */
  private parseInt(value: any, paramName: string): number {
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException(`${paramName} cannot be empty`);
    }

    // Convert to string first to handle various input types
    const stringValue = String(value).trim();

    // Check for decimal points - reject floats for integer parameters
    if (stringValue.includes('.')) {
      throw new BadRequestException(
        `${paramName} must be a whole number, got: ${stringValue}`,
      );
    }

    const parsed = parseInt(stringValue, 10);

    if (isNaN(parsed)) {
      throw new BadRequestException(
        `${paramName} must be a valid integer, got: ${stringValue}`,
      );
    }

    return parsed;
  }

  /**
   * Safely parse float values for consensus ratios
   */
  private parseFloat(value: any, paramName: string): number {
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException(`${paramName} cannot be empty`);
    }

    const parsed = parseFloat(String(value));

    if (isNaN(parsed)) {
      throw new BadRequestException(
        `${paramName} must be a valid number, got: ${value}`,
      );
    }

    return parsed;
  }

  private validateQueryParams(query: UniversalGraphOptions): void {
    // Validate consensus range
    if (query.min_consensus !== undefined) {
      if (query.min_consensus < 0 || query.min_consensus > 1) {
        throw new BadRequestException('min_consensus must be between 0 and 1');
      }
    }

    if (query.max_consensus !== undefined) {
      if (query.max_consensus < 0 || query.max_consensus > 1) {
        throw new BadRequestException('max_consensus must be between 0 and 1');
      }
    }

    // Validate consensus range relationship
    if (
      query.min_consensus !== undefined &&
      query.max_consensus !== undefined
    ) {
      if (query.min_consensus > query.max_consensus) {
        throw new BadRequestException(
          'min_consensus cannot be greater than max_consensus',
        );
      }
    }

    // Validate limit - ensure it's a positive integer
    if (query.limit !== undefined) {
      if (query.limit < 1 || query.limit > 1000) {
        throw new BadRequestException('limit must be between 1 and 1000');
      }
      // Double-check it's actually an integer (should be caught by parseInt but extra safety)
      if (!Number.isInteger(query.limit)) {
        throw new BadRequestException('limit must be a whole number');
      }
    }

    // Validate offset - ensure it's a non-negative integer
    if (query.offset !== undefined) {
      if (query.offset < 0) {
        throw new BadRequestException('offset must be non-negative');
      }
      // Double-check it's actually an integer
      if (!Number.isInteger(query.offset)) {
        throw new BadRequestException('offset must be a whole number');
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

    // Validate keywords array
    if (query.keywords) {
      if (!Array.isArray(query.keywords)) {
        throw new BadRequestException('keywords must be an array');
      }

      // Check each keyword is a valid string
      for (const keyword of query.keywords) {
        if (typeof keyword !== 'string' || keyword.trim() === '') {
          throw new BadRequestException(
            'each keyword must be a non-empty string',
          );
        }
      }
    }

    // Validate user_id format if provided
    if (query.user_id && typeof query.user_id !== 'string') {
      throw new BadRequestException('user_id must be a string');
    }
  }
}
