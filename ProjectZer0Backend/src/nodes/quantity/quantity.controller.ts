// src/nodes/quantity/quantity.controller.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { QuantityService } from './quantity.service';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

/**
 * DTOs for Quantity endpoints
 */
interface CreateQuantityNodeDto {
  question: string;
  publicCredit?: boolean;
  unitCategoryId: string;
  defaultUnitId: string;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment?: string;
}

interface UpdateQuantityNodeDto {
  question?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  categoryIds?: string[];
}

interface VoteDto {
  isPositive: boolean;
}

interface SubmitResponseDto {
  value: number;
  unitId: string;
}

/**
 * QuantityController - HTTP layer for quantity node operations
 *
 * RESPONSIBILITIES:
 * ✅ Parse and validate HTTP requests
 * ✅ Extract user from JWT (req.user.sub)
 * ✅ Call QuantityService methods
 * ✅ Return appropriate HTTP status codes
 * ✅ Handle HTTP-specific errors
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Business logic (that's QuantityService)
 * ❌ Database queries (that's QuantitySchema)
 * ❌ Complex validation (that's QuantityService)
 *
 * KEY CHARACTERISTICS:
 * - Inclusion voting only (no content voting - uses numeric responses)
 * - Numeric response submission endpoints
 * - Statistical aggregation endpoints
 * - Standard CRUD operations
 * - User context from JWT
 */
@Controller('nodes/quantity')
@UseGuards(JwtAuthGuard)
export class QuantityController {
  private readonly logger = new Logger(QuantityController.name);

  constructor(private readonly quantityService: QuantityService) {}

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  /**
   * Create a new quantity node
   * POST /nodes/quantity
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createQuantityNode(
    @Body() createDto: CreateQuantityNodeDto,
    @Request() req: any,
  ) {
    if (!createDto.question || createDto.question.trim() === '') {
      throw new BadRequestException('Question text is required');
    }

    if (!createDto.unitCategoryId || createDto.unitCategoryId.trim() === '') {
      throw new BadRequestException('Unit category ID is required');
    }

    if (!createDto.defaultUnitId || createDto.defaultUnitId.trim() === '') {
      throw new BadRequestException('Default unit ID is required');
    }

    if (createDto.categoryIds && createDto.categoryIds.length > 3) {
      throw new BadRequestException('Maximum 3 categories allowed');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(
      `Creating quantity node from user ${req.user.sub}: ${createDto.question.substring(0, 50)}...`,
    );

    const result = await this.quantityService.createQuantityNode({
      ...createDto,
      createdBy: req.user.sub, // Extract from JWT
      publicCredit: createDto.publicCredit ?? true,
    });

    this.logger.log(`Successfully created quantity node: ${result.id}`);
    return result;
  }

  /**
   * Get a quantity node by ID
   * GET /nodes/quantity/:id
   */
  @Get(':id')
  async getQuantityNode(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    this.logger.debug(`Getting quantity node: ${id}`);

    const quantityNode = await this.quantityService.getQuantityNode(id);

    if (!quantityNode) {
      throw new NotFoundException(`Quantity node with ID ${id} not found`);
    }

    return quantityNode;
  }

  /**
   * Update a quantity node
   * PUT /nodes/quantity/:id
   */
  @Put(':id')
  async updateQuantityNode(
    @Param('id') id: string,
    @Body() updateDto: UpdateQuantityNodeDto,
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (Object.keys(updateDto).length === 0) {
      throw new BadRequestException('No update data provided');
    }

    if (updateDto.categoryIds && updateDto.categoryIds.length > 3) {
      throw new BadRequestException('Maximum 3 categories allowed');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Updating quantity node: ${id}`);

    const result = await this.quantityService.updateQuantityNode(id, updateDto);

    this.logger.log(`Successfully updated quantity node: ${id}`);
    return result;
  }

  /**
   * Delete a quantity node
   * DELETE /nodes/quantity/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuantityNode(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Deleting quantity node: ${id}`);

    await this.quantityService.deleteQuantityNode(id);

    this.logger.log(`Successfully deleted quantity node: ${id}`);
  }

  // ============================================
  // VOTING ENDPOINTS - INCLUSION ONLY
  // ============================================

  /**
   * Vote on quantity node inclusion
   * POST /nodes/quantity/:id/vote-inclusion
   */
  @Post(':id/vote')
  async voteInclusion(
    @Param('id') id: string,
    @Body() voteDto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof voteDto.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    this.logger.log(
      `Processing inclusion vote on quantity node ${id}: ${voteDto.isPositive ? 'positive' : 'negative'}`,
    );

    const result = await this.quantityService.voteInclusion(
      id,
      req.user.sub,
      voteDto.isPositive,
    );

    return result;
  }

  /**
   * Get vote status for current user
   * GET /nodes/quantity/:id/vote-status
   */
  @Get(':id/vote-status')
  async getVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Getting vote status for quantity node: ${id}`);

    const status = await this.quantityService.getVoteStatus(id, req.user.sub);

    return status;
  }

  /**
   * Remove vote from a quantity node
   * DELETE /nodes/quantity/:id/vote
   */
  @Delete(':id/vote')
  async removeVote(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Removing vote from quantity node: ${id}`);

    const result = await this.quantityService.removeVote(id, req.user.sub);

    return result;
  }

  /**
   * Get vote totals for a quantity node
   * GET /nodes/quantity/:id/votes
   */
  @Get(':id/votes')
  async getVotes(@Param('id') id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    this.logger.debug(`Getting votes for quantity node: ${id}`);

    const votes = await this.quantityService.getVotes(id);

    return votes;
  }

  // ============================================
  // NUMERIC RESPONSE ENDPOINTS
  // ============================================

  /**
   * Submit a numeric response to a quantity node
   * POST /nodes/quantity/:id/response
   */
  @Post(':id/response')
  async submitResponse(
    @Param('id') id: string,
    @Body() responseDto: SubmitResponseDto,
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof responseDto.value !== 'number' || isNaN(responseDto.value)) {
      throw new BadRequestException('Valid numeric value is required');
    }

    if (!responseDto.unitId || responseDto.unitId.trim() === '') {
      throw new BadRequestException('Unit ID is required');
    }

    this.logger.log(
      `Submitting response to quantity node ${id}: value=${responseDto.value}, unit=${responseDto.unitId}`,
    );

    const result = await this.quantityService.submitResponse({
      userId: req.user.sub,
      quantityNodeId: id,
      value: responseDto.value,
      unitId: responseDto.unitId,
    });

    this.logger.log(`Successfully submitted response to quantity node ${id}`);
    return result;
  }

  /**
   * Get current user's response to a quantity node
   * GET /nodes/quantity/:id/response
   */
  @Get(':id/response')
  async getUserResponse(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting user response for quantity node ${id}, user ${req.user.sub}`,
    );

    const response = await this.quantityService.getUserResponse(
      req.user.sub,
      id,
    );

    return response;
  }

  /**
   * Delete current user's response to a quantity node
   * DELETE /nodes/quantity/:id/response
   */
  @Delete(':id/response')
  async deleteUserResponse(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(
      `Deleting user response for quantity node ${id}, user ${req.user.sub}`,
    );

    const result = await this.quantityService.deleteUserResponse(
      req.user.sub,
      id,
    );

    return result;
  }

  // ============================================
  // STATISTICS ENDPOINTS
  // ============================================

  /**
   * Get statistics for a quantity node
   * GET /nodes/quantity/:id/statistics
   */
  @Get(':id/statistics')
  async getStatistics(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    this.logger.debug(`Getting statistics for quantity node: ${id}`);

    const statistics = await this.quantityService.getStatistics(id);

    return statistics;
  }

  // ============================================
  // UTILITY ENDPOINTS
  // ============================================

  /**
   * Check if quantity node has passed inclusion threshold
   * GET /nodes/quantity/:id/approved
   */
  @Get(':id/approved')
  async isQuantityNodeApproved(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    this.logger.debug(`Checking approval status for quantity node: ${id}`);

    const isApproved = await this.quantityService.isQuantityNodeApproved(id);

    return { isApproved };
  }

  /**
   * Check if numeric responses are allowed for quantity node
   * GET /nodes/quantity/:id/response-allowed
   */
  @Get(':id/response-allowed')
  async isNumericResponseAllowed(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    this.logger.debug(
      `Checking numeric response availability for quantity node: ${id}`,
    );

    const isAllowed = await this.quantityService.isNumericResponseAllowed(id);

    return { isAllowed };
  }
}
