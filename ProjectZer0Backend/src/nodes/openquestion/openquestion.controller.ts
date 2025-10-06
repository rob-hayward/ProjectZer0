// src/nodes/openquestion/openquestion.controller.ts - REFACTORED TO SCHEMA ARCHITECTURE

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
import { OpenQuestionService } from './openquestion.service';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

/**
 * DTOs for OpenQuestion endpoints
 */
interface CreateOpenQuestionDto {
  questionText: string;
  publicCredit?: boolean;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment: string;
}

interface UpdateOpenQuestionDto {
  questionText?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  categoryIds?: string[];
}

interface VoteDto {
  isPositive: boolean;
}

/**
 * OpenQuestionController - HTTP layer for open question operations
 *
 * RESPONSIBILITIES:
 * ✅ Parse and validate HTTP requests
 * ✅ Extract user from JWT (req.user.sub)
 * ✅ Call OpenQuestionService methods
 * ✅ Return appropriate HTTP status codes
 * ✅ Handle HTTP-specific errors
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Business logic (that's OpenQuestionService)
 * ❌ Database queries (that's OpenQuestionSchema)
 * ❌ Complex validation (that's OpenQuestionService)
 *
 * KEY CHARACTERISTICS:
 * - Inclusion voting only (no content voting)
 * - Standard CRUD operations
 * - User context from JWT
 */
@Controller('nodes/openquestion')
@UseGuards(JwtAuthGuard)
export class OpenQuestionController {
  private readonly logger = new Logger(OpenQuestionController.name);

  constructor(private readonly openQuestionService: OpenQuestionService) {}

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  /**
   * Create a new open question
   * POST /nodes/openquestion
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOpenQuestion(
    @Body() createDto: CreateOpenQuestionDto,
    @Request() req: any,
  ) {
    if (!createDto.questionText || createDto.questionText.trim() === '') {
      throw new BadRequestException('Question text is required');
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

    this.logger.log(`Creating open question from user ${req.user.sub}`);

    const result = await this.openQuestionService.createOpenQuestion({
      ...createDto,
      createdBy: req.user.sub, // Extract from JWT
      publicCredit: createDto.publicCredit ?? true,
    });

    this.logger.log(`Successfully created open question: ${result.id}`);
    return result;
  }

  /**
   * Get an open question by ID
   * GET /nodes/openquestion/:id
   */
  @Get(':id')
  async getOpenQuestion(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
    }

    this.logger.debug(`Getting open question: ${id}`);

    const question = await this.openQuestionService.getOpenQuestion(id);

    if (!question) {
      throw new NotFoundException(`Open question with ID ${id} not found`);
    }

    return question;
  }

  /**
   * Update an open question
   * PUT /nodes/openquestion/:id
   */
  @Put(':id')
  async updateOpenQuestion(
    @Param('id') id: string,
    @Body() updateDto: UpdateOpenQuestionDto,
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
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

    this.logger.log(`Updating open question: ${id}`);

    const result = await this.openQuestionService.updateOpenQuestion(
      id,
      updateDto,
    );

    this.logger.log(`Successfully updated open question: ${id}`);
    return result;
  }

  /**
   * Delete an open question
   * DELETE /nodes/openquestion/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOpenQuestion(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Deleting open question: ${id}`);

    await this.openQuestionService.deleteOpenQuestion(id);

    this.logger.log(`Successfully deleted open question: ${id}`);
  }

  // ============================================
  // VOTING ENDPOINTS - INCLUSION ONLY
  // ============================================

  /**
   * Vote on open question inclusion
   * POST /nodes/openquestion/:id/vote-inclusion
   */
  @Post(':id/vote-inclusion')
  async voteInclusion(
    @Param('id') id: string,
    @Body() voteDto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof voteDto.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    this.logger.log(
      `Processing inclusion vote on question ${id}: ${voteDto.isPositive ? 'positive' : 'negative'}`,
    );

    const result = await this.openQuestionService.voteInclusion(
      id,
      req.user.sub,
      voteDto.isPositive,
    );

    return result;
  }

  /**
   * Get vote status for current user
   * GET /nodes/openquestion/:id/vote-status
   */
  @Get(':id/vote-status')
  async getVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Getting vote status for question: ${id}`);

    const status = await this.openQuestionService.getVoteStatus(
      id,
      req.user.sub,
    );

    return status;
  }

  /**
   * Remove vote from an open question
   * DELETE /nodes/openquestion/:id/vote
   */
  @Delete(':id/vote')
  async removeVote(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Removing vote from question: ${id}`);

    const result = await this.openQuestionService.removeVote(id, req.user.sub);

    return result;
  }

  /**
   * Get vote totals for an open question
   * GET /nodes/openquestion/:id/votes
   */
  @Get(':id/votes')
  async getVotes(@Param('id') id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
    }

    this.logger.debug(`Getting votes for question: ${id}`);

    const votes = await this.openQuestionService.getVotes(id);

    return votes;
  }
}
