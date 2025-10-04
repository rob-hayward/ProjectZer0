// src/nodes/statement/statement.controller.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { StatementService } from './statement.service';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

/**
 * DTOs for Statement endpoints
 */
interface CreateStatementDto {
  statement: string;
  publicCredit?: boolean;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  parentStatementId?: string;
  initialComment: string;
}

interface UpdateStatementDto {
  statement?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  categoryIds?: string[];
}

interface VoteDto {
  isPositive: boolean;
}

interface RemoveVoteDto {
  kind: 'INCLUSION' | 'CONTENT';
}

/**
 * StatementController - HTTP layer for statement operations
 *
 * RESPONSIBILITIES:
 * ✅ Parse and validate HTTP requests
 * ✅ Extract user from JWT (req.user.sub)
 * ✅ Call StatementService methods
 * ✅ Return appropriate HTTP status codes
 * ✅ Handle HTTP-specific errors
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Business logic (that's StatementService)
 * ❌ Database queries (that's StatementSchema)
 * ❌ Complex validation (that's StatementService)
 */
@Controller('nodes/statement')
@UseGuards(JwtAuthGuard)
export class StatementController {
  private readonly logger = new Logger(StatementController.name);

  constructor(private readonly statementService: StatementService) {}

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  /**
   * Create a new statement
   * POST /nodes/statement
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createStatement(
    @Body() createDto: CreateStatementDto,
    @Request() req: any,
  ) {
    if (!createDto.statement || createDto.statement.trim() === '') {
      throw new BadRequestException('Statement text is required');
    }

    if (!createDto.initialComment || createDto.initialComment.trim() === '') {
      throw new BadRequestException('Initial comment is required');
    }

    if (createDto.categoryIds && createDto.categoryIds.length > 3) {
      throw new BadRequestException('Maximum 3 categories allowed');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Creating statement from user ${req.user.sub}`);

    const result = await this.statementService.createStatement({
      ...createDto,
      createdBy: req.user.sub, // Extract from JWT
      publicCredit: createDto.publicCredit ?? true,
    });

    this.logger.log(`Successfully created statement with ID: ${result.id}`);
    return result;
  }

  /**
   * Get a statement by ID
   * GET /nodes/statement/:id
   */
  @Get(':id')
  async getStatement(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    this.logger.debug(`Retrieving statement: ${id}`);

    const statement = await this.statementService.getStatement(id);

    if (!statement) {
      throw new NotFoundException(`Statement with ID ${id} not found`);
    }

    return statement;
  }

  /**
   * Update a statement
   * PUT /nodes/statement/:id
   */
  @Put(':id')
  async updateStatement(
    @Param('id') id: string,
    @Body() updateDto: UpdateStatementDto,
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    // Validate at least one field provided
    if (
      !updateDto.statement &&
      updateDto.publicCredit === undefined &&
      !updateDto.userKeywords &&
      !updateDto.categoryIds
    ) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    if (updateDto.categoryIds && updateDto.categoryIds.length > 3) {
      throw new BadRequestException('Maximum 3 categories allowed');
    }

    this.logger.log(`Updating statement: ${id}`);

    const result = await this.statementService.updateStatement(id, updateDto);

    if (!result) {
      throw new NotFoundException(`Statement with ID ${id} not found`);
    }

    this.logger.log(`Successfully updated statement: ${id}`);
    return result;
  }

  /**
   * Delete a statement
   * DELETE /nodes/statement/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteStatement(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Deleting statement: ${id}`);

    await this.statementService.deleteStatement(id);

    this.logger.log(`Successfully deleted statement: ${id}`);
  }

  // ============================================
  // VOTING ENDPOINTS - DUAL VOTING (INCLUSION + CONTENT)
  // ============================================

  /**
   * Vote on statement inclusion
   * POST /nodes/statement/:id/vote-inclusion
   */
  @Post(':id/vote-inclusion')
  async voteInclusion(
    @Param('id') id: string,
    @Body() voteDto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof voteDto.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    this.logger.log(
      `Processing inclusion vote on statement ${id}: ${voteDto.isPositive ? 'positive' : 'negative'}`,
    );

    const result = await this.statementService.voteInclusion(
      id,
      req.user.sub,
      voteDto.isPositive,
    );

    return result;
  }

  /**
   * Vote on statement content
   * POST /nodes/statement/:id/vote-content
   */
  @Post(':id/vote-content')
  async voteContent(
    @Param('id') id: string,
    @Body() voteDto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof voteDto.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    this.logger.log(
      `Processing content vote on statement ${id}: ${voteDto.isPositive ? 'positive' : 'negative'}`,
    );

    const result = await this.statementService.voteContent(
      id,
      req.user.sub,
      voteDto.isPositive,
    );

    return result;
  }

  /**
   * Get vote status for current user
   * GET /nodes/statement/:id/vote-status
   */
  @Get(':id/vote-status')
  async getVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    return await this.statementService.getVoteStatus(id, req.user.sub);
  }

  /**
   * Remove vote (inclusion or content)
   * DELETE /nodes/statement/:id/vote
   */
  @Delete(':id/vote')
  async removeVote(
    @Param('id') id: string,
    @Body() removeVoteDto: RemoveVoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (
      !removeVoteDto.kind ||
      !['INCLUSION', 'CONTENT'].includes(removeVoteDto.kind)
    ) {
      throw new BadRequestException(
        'Vote kind must be either INCLUSION or CONTENT',
      );
    }

    this.logger.log(`Removing ${removeVoteDto.kind} vote on statement: ${id}`);

    return await this.statementService.removeVote(
      id,
      req.user.sub,
      removeVoteDto.kind,
    );
  }

  /**
   * Get vote counts
   * GET /nodes/statement/:id/votes
   */
  @Get(':id/votes')
  async getVotes(@Param('id') id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    return await this.statementService.getVotes(id);
  }

  // ============================================
  // RELATIONSHIP ENDPOINTS
  // ============================================

  /**
   * Create a related statement (child statement)
   * POST /nodes/statement/:id/related
   */
  @Post(':id/related')
  @HttpCode(HttpStatus.CREATED)
  async createRelatedStatement(
    @Param('id') parentStatementId: string,
    @Body() createDto: CreateStatementDto,
    @Request() req: any,
  ) {
    if (!parentStatementId || parentStatementId.trim() === '') {
      throw new BadRequestException('Parent statement ID is required');
    }

    if (!createDto.statement || createDto.statement.trim() === '') {
      throw new BadRequestException('Statement text is required');
    }

    if (!createDto.initialComment || createDto.initialComment.trim() === '') {
      throw new BadRequestException('Initial comment is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Creating related statement to: ${parentStatementId}`);

    const result = await this.statementService.createRelatedStatement(
      parentStatementId,
      {
        ...createDto,
        createdBy: req.user.sub,
        publicCredit: createDto.publicCredit ?? true,
      },
    );

    this.logger.log(
      `Successfully created related statement with ID: ${result.id}`,
    );
    return result;
  }

  /**
   * Create direct relationship between two statements
   * POST /nodes/statement/:id1/relationship/:id2
   */
  @Post(':id1/relationship/:id2')
  async createDirectRelationship(
    @Param('id1') id1: string,
    @Param('id2') id2: string,
  ) {
    if (!id1 || !id2) {
      throw new BadRequestException('Both statement IDs are required');
    }

    this.logger.log(
      `Creating relationship between statements ${id1} and ${id2}`,
    );

    const result = await this.statementService.createDirectRelationship(
      id1,
      id2,
    );

    return result;
  }

  /**
   * Remove direct relationship between two statements
   * DELETE /nodes/statement/:id1/relationship/:id2
   */
  @Delete(':id1/relationship/:id2')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDirectRelationship(
    @Param('id1') id1: string,
    @Param('id2') id2: string,
  ) {
    if (!id1 || !id2) {
      throw new BadRequestException('Both statement IDs are required');
    }

    this.logger.log(
      `Removing relationship between statements ${id1} and ${id2}`,
    );

    await this.statementService.removeDirectRelationship(id1, id2);
  }

  /**
   * Get statements directly related to a statement
   * GET /nodes/statement/:id/direct-relationships
   */
  @Get(':id/direct-relationships')
  async getDirectlyRelatedStatements(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    this.logger.debug(`Getting directly related statements for: ${id}`);

    const relatedStatements =
      await this.statementService.getDirectlyRelatedStatements(id);

    return { relatedStatements };
  }

  // ============================================
  // QUERY ENDPOINTS
  // ============================================

  /**
   * Get statement network
   * GET /nodes/statement/network
   */
  @Get('network')
  async getStatementNetwork(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDirection') sortDirection?: string,
    @Query('keywords') keywords?: string[],
    @Query('userId') userId?: string,
  ) {
    return await this.statementService.getStatementNetwork({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      sortBy: sortBy || 'netPositive',
      sortDirection: sortDirection || 'desc',
      keywords,
      userId,
    });
  }

  /**
   * Check statements count
   * GET /nodes/statement/count
   */
  @Get('count')
  async checkStatements() {
    return await this.statementService.checkStatements();
  }

  // ============================================
  // UTILITY ENDPOINTS
  // ============================================

  /**
   * Check if statement is approved
   * GET /nodes/statement/:id/approved
   */
  @Get(':id/approved')
  async isStatementApproved(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    this.logger.debug(`Checking approval status for statement: ${id}`);

    const isApproved = await this.statementService.isStatementApproved(id);

    return { isApproved };
  }

  /**
   * Check if content voting is available
   * GET /nodes/statement/:id/content-voting-available
   */
  @Get(':id/content-voting-available')
  async isContentVotingAvailable(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    this.logger.debug(
      `Checking content voting availability for statement: ${id}`,
    );

    const isAvailable =
      await this.statementService.isContentVotingAvailable(id);

    return { isAvailable };
  }
}
