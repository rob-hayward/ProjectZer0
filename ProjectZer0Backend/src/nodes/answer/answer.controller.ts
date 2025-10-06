// src/nodes/answer/answer.controller.ts - REFACTORED TO SCHEMA ARCHITECTURE

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
import { AnswerService } from './answer.service';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

/**
 * DTOs for Answer endpoints
 */
interface CreateAnswerDto {
  answerText: string;
  publicCredit?: boolean;
  parentQuestionId: string;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment?: string;
}

interface UpdateAnswerDto {
  answerText?: string;
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
 * AnswerController - HTTP layer for answer operations
 *
 * RESPONSIBILITIES:
 * ✅ Parse and validate HTTP requests
 * ✅ Extract user from JWT (req.user.sub)
 * ✅ Call AnswerService methods
 * ✅ Return appropriate HTTP status codes
 * ✅ Handle HTTP-specific errors
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Business logic (that's AnswerService)
 * ❌ Database queries (that's AnswerSchema)
 * ❌ Complex validation (that's AnswerService)
 *
 * KEY CHARACTERISTICS:
 * - Dual voting (inclusion + content)
 * - Standard CRUD operations
 * - User context from JWT
 * - Parent question validation
 */
@Controller('nodes/answer')
@UseGuards(JwtAuthGuard)
export class AnswerController {
  private readonly logger = new Logger(AnswerController.name);

  constructor(private readonly answerService: AnswerService) {}

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  /**
   * Create a new answer
   * POST /nodes/answer
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAnswer(@Body() createDto: CreateAnswerDto, @Request() req: any) {
    if (!createDto.answerText || createDto.answerText.trim() === '') {
      throw new BadRequestException('Answer text is required');
    }

    if (
      !createDto.parentQuestionId ||
      createDto.parentQuestionId.trim() === ''
    ) {
      throw new BadRequestException('Parent question ID is required');
    }

    if (createDto.categoryIds && createDto.categoryIds.length > 3) {
      throw new BadRequestException('Maximum 3 categories allowed');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(
      `Creating answer for question ${createDto.parentQuestionId} from user ${req.user.sub}`,
    );

    const result = await this.answerService.createAnswer({
      ...createDto,
      createdBy: req.user.sub, // Extract from JWT
      publicCredit: createDto.publicCredit ?? true,
    });

    this.logger.log(`Successfully created answer: ${result.id}`);
    return result;
  }

  /**
   * Get an answer by ID
   * GET /nodes/answer/:id
   */
  @Get(':id')
  async getAnswer(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    this.logger.debug(`Getting answer: ${id}`);

    const answer = await this.answerService.getAnswer(id);

    if (!answer) {
      throw new NotFoundException(`Answer with ID ${id} not found`);
    }

    return answer;
  }

  /**
   * Update an answer
   * PUT /nodes/answer/:id
   */
  @Put(':id')
  async updateAnswer(
    @Param('id') id: string,
    @Body() updateDto: UpdateAnswerDto,
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
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

    this.logger.log(`Updating answer: ${id}`);

    const result = await this.answerService.updateAnswer(id, updateDto);

    this.logger.log(`Successfully updated answer: ${id}`);
    return result;
  }

  /**
   * Delete an answer
   * DELETE /nodes/answer/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAnswer(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Deleting answer: ${id}`);

    await this.answerService.deleteAnswer(id);

    this.logger.log(`Successfully deleted answer: ${id}`);
  }

  /**
   * Get answers for a specific question
   * GET /nodes/answer/question/:questionId
   */
  @Get('question/:questionId')
  async getAnswersForQuestion(
    @Param('questionId') questionId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: 'created' | 'inclusion_votes' | 'content_votes',
    @Query('sortDirection') sortDirection?: 'asc' | 'desc',
    @Query('onlyApproved') onlyApproved?: string,
  ) {
    if (!questionId || questionId.trim() === '') {
      throw new BadRequestException('Question ID is required');
    }

    this.logger.log(`Getting answers for question: ${questionId}`);

    const options = {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : 0,
      sortBy: sortBy || 'created',
      sortDirection: sortDirection || 'desc',
      onlyApproved: onlyApproved === 'true',
    };

    const answers = await this.answerService.getAnswersForQuestion(
      questionId,
      options,
    );

    this.logger.debug(
      `Retrieved ${answers.length} answers for question ${questionId}`,
    );
    return answers;
  }

  // ============================================
  // VOTING ENDPOINTS - DUAL VOTING
  // ============================================

  /**
   * Vote on answer inclusion
   * POST /nodes/answer/:id/vote-inclusion
   */
  @Post(':id/vote-inclusion')
  async voteInclusion(
    @Param('id') id: string,
    @Body() voteDto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof voteDto.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    this.logger.log(
      `Processing inclusion vote on answer ${id}: ${voteDto.isPositive ? 'positive' : 'negative'}`,
    );

    const result = await this.answerService.voteInclusion(
      id,
      req.user.sub,
      voteDto.isPositive,
    );

    return result;
  }

  /**
   * Vote on answer content (quality)
   * POST /nodes/answer/:id/vote-content
   */
  @Post(':id/vote-content')
  async voteContent(
    @Param('id') id: string,
    @Body() voteDto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof voteDto.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    this.logger.log(
      `Processing content vote on answer ${id}: ${voteDto.isPositive ? 'positive' : 'negative'}`,
    );

    const result = await this.answerService.voteContent(
      id,
      req.user.sub,
      voteDto.isPositive,
    );

    return result;
  }

  /**
   * Get vote status for current user
   * GET /nodes/answer/:id/vote-status
   */
  @Get(':id/vote-status')
  async getVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Getting vote status for answer: ${id}`);

    const status = await this.answerService.getVoteStatus(id, req.user.sub);

    return status;
  }

  /**
   * Remove vote from an answer
   * DELETE /nodes/answer/:id/vote
   */
  @Delete(':id/vote')
  async removeVote(
    @Param('id') id: string,
    @Body() removeVoteDto: RemoveVoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (
      !removeVoteDto.kind ||
      !['INCLUSION', 'CONTENT'].includes(removeVoteDto.kind)
    ) {
      throw new BadRequestException('Vote kind must be INCLUSION or CONTENT');
    }

    this.logger.log(`Removing ${removeVoteDto.kind} vote from answer: ${id}`);

    const result = await this.answerService.removeVote(
      id,
      req.user.sub,
      removeVoteDto.kind,
    );

    return result;
  }

  /**
   * Get vote totals for an answer
   * GET /nodes/answer/:id/votes
   */
  @Get(':id/votes')
  async getVotes(@Param('id') id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    this.logger.debug(`Getting votes for answer: ${id}`);

    const votes = await this.answerService.getVotes(id);

    return votes;
  }

  // ============================================
  // UTILITY ENDPOINTS
  // ============================================

  /**
   * Check if answer has passed inclusion threshold
   * GET /nodes/answer/:id/approved
   */
  @Get(':id/approved')
  async isAnswerApproved(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    this.logger.debug(`Checking approval status for answer: ${id}`);

    const isApproved = await this.answerService.isAnswerApproved(id);

    return { isApproved };
  }

  /**
   * Check if content voting is available for answer
   * GET /nodes/answer/:id/content-voting
   */
  @Get(':id/content-voting')
  async isContentVotingAvailable(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    this.logger.debug(`Checking content voting availability for answer: ${id}`);

    const isAvailable = await this.answerService.isContentVotingAvailable(id);

    return { isAvailable };
  }
}
