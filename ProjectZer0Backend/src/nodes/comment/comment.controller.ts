// src/nodes/comment/comment.controller.ts - REFACTORED TO SCHEMA ARCHITECTURE

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
  Logger,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CommentService } from './comment.service';
import { TEXT_LIMITS } from '../../constants/validation';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

/**
 * DTOs for type safety and validation
 */
interface CreateCommentDto {
  createdBy: string;
  discussionId: string;
  commentText: string;
  parentCommentId?: string;
}

interface UpdateCommentDto {
  commentText: string;
}

interface VoteDto {
  isPositive: boolean;
}

interface VisibilityDto {
  isVisible: boolean;
}

/**
 * CommentController - HTTP layer for comment operations
 *
 * ARCHITECTURE:
 * - Handles HTTP concerns (request/response, status codes, validation)
 * - Delegates all business logic to CommentService
 * - Uses DTOs for input validation
 * - Applies authentication guards
 * - Returns appropriate HTTP status codes
 *
 * RESPONSIBILITIES:
 * ✅ HTTP request/response handling
 * ✅ Input validation at the boundary
 * ✅ Authentication/authorization checks
 * ✅ Proper status codes
 * ✅ Route parameter extraction
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Business logic
 * ❌ Database operations
 * ❌ Calling schemas directly
 */
@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentController {
  private readonly logger = new Logger(CommentController.name);

  constructor(private readonly commentService: CommentService) {}

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  /**
   * Create a new comment
   * POST /comments
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @Body() commentData: CreateCommentDto,
    @Request() req: any,
  ) {
    // Validate required fields
    if (!commentData.discussionId || commentData.discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    if (!commentData.commentText || commentData.commentText.trim() === '') {
      throw new BadRequestException('Comment text is required');
    }

    if (commentData.commentText.length > TEXT_LIMITS.MAX_COMMENT_LENGTH) {
      throw new BadRequestException(
        `Comment text must not exceed ${TEXT_LIMITS.MAX_COMMENT_LENGTH} characters`,
      );
    }

    // Validate user authentication
    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.log(
      `Creating comment for discussion: ${commentData.discussionId}`,
    );

    return await this.commentService.createComment({
      ...commentData,
      createdBy: req.user.sub,
    });
  }

  /**
   * Get a single comment with visibility status
   * GET /comments/:id
   */
  @Get(':id')
  async getComment(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(
      `Getting comment: ${id} for user: ${req.user?.sub || 'anonymous'}`,
    );

    const comment = await this.commentService.getCommentWithVisibility(
      id,
      req.user?.sub,
    );

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    return comment;
  }

  /**
   * Update a comment (with edit permission check)
   * PUT /comments/:id
   */
  @Put(':id')
  async updateComment(
    @Param('id') id: string,
    @Body() updateData: UpdateCommentDto,
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (!updateData.commentText || updateData.commentText.trim() === '') {
      throw new BadRequestException('Comment text is required');
    }

    if (updateData.commentText.length > TEXT_LIMITS.MAX_COMMENT_LENGTH) {
      throw new BadRequestException(
        `Comment text must not exceed ${TEXT_LIMITS.MAX_COMMENT_LENGTH} characters`,
      );
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.log(`Updating comment: ${id}`);

    // Service will handle edit permission check
    return await this.commentService.updateComment(
      id,
      req.user.sub,
      updateData,
    );
  }

  /**
   * Delete a comment
   * DELETE /comments/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.log(`Deleting comment: ${id}`);

    // Verify comment exists and user is the creator
    const comment = await this.commentService.getComment(id);
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    if (comment.createdBy !== req.user.sub) {
      throw new HttpException(
        'Only the comment creator can delete this comment',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.commentService.deleteComment(id);
  }

  /**
   * Check if user can edit a comment
   * GET /comments/:id/can-edit
   */
  @Get(':id/can-edit')
  async canEditComment(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    const canEdit = await this.commentService.canEditComment(id, req.user.sub);
    return { canEdit };
  }

  // ============================================
  // VOTING ENDPOINTS - Content Voting Only
  // ============================================

  /**
   * Vote on comment content (comments only support content voting)
   * POST /comments/:id/vote
   */
  @Post(':id/vote')
  async voteCommentContent(
    @Param('id') id: string,
    @Body() voteData: VoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (typeof voteData.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.log(
      `Voting ${voteData.isPositive ? 'positive' : 'negative'} on comment content: ${id}`,
    );

    return await this.commentService.voteComment(
      id,
      req.user.sub,
      voteData.isPositive,
      'CONTENT',
    );
  }

  /**
   * Get user's vote status for a comment
   * GET /comments/:id/vote-status
   */
  @Get(':id/vote-status')
  async getCommentVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.debug(`Getting vote status for comment: ${id}`);
    return await this.commentService.getCommentVoteStatus(id, req.user.sub);
  }

  /**
   * Remove vote from a comment
   * DELETE /comments/:id/vote
   */
  @Delete(':id/vote')
  async removeCommentVote(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.debug(`Removing content vote from comment: ${id}`);
    return await this.commentService.removeCommentVote(
      id,
      req.user.sub,
      'CONTENT',
    );
  }

  /**
   * Get vote counts for a comment
   * GET /comments/:id/votes
   */
  @Get(':id/votes')
  async getCommentVotes(@Param('id') id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting vote counts for comment: ${id}`);
    return await this.commentService.getCommentVotes(id);
  }

  // ============================================
  // VISIBILITY ENDPOINTS
  // ============================================

  /**
   * Set user's visibility preference for a comment
   * POST /comments/:id/visibility
   */
  @Post(':id/visibility')
  async setCommentVisibilityPreference(
    @Param('id') id: string,
    @Body() visibilityData: VisibilityDto,
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (typeof visibilityData.isVisible !== 'boolean') {
      throw new BadRequestException('isVisible must be a boolean');
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.log(
      `Setting visibility preference for comment ${id}: ${visibilityData.isVisible}`,
    );

    return await this.commentService.setCommentVisibilityPreference(
      req.user.sub,
      id,
      visibilityData.isVisible,
    );
  }

  /**
   * Get visibility status for a comment
   * GET /comments/:id/visibility
   */
  @Get(':id/visibility')
  async getCommentVisibility(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting visibility for comment: ${id}`);
    const isVisible = await this.commentService.getCommentVisibilityForUser(
      id,
      req.user?.sub,
    );

    return { isVisible };
  }

  // ============================================
  // DISCUSSION-LEVEL ENDPOINTS
  // ============================================

  /**
   * Get all comments for a discussion with visibility
   * GET /comments/discussion/:discussionId
   */
  @Get('discussion/:discussionId')
  async getCommentsByDiscussion(
    @Param('discussionId') discussionId: string,
    @Query('sortBy') sortBy?: 'newest' | 'oldest' | 'topVoted',
    @Request() req?: any,
  ) {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comments for discussion: ${discussionId}`);
    return await this.commentService.getCommentsByDiscussionIdWithVisibility(
      discussionId,
      req?.user?.sub,
      sortBy || 'newest',
    );
  }

  /**
   * Get comment statistics for a discussion
   * GET /comments/discussion/:discussionId/stats
   */
  @Get('discussion/:discussionId/stats')
  async getDiscussionCommentStats(@Param('discussionId') discussionId: string) {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comment stats for discussion: ${discussionId}`);
    return await this.commentService.getDiscussionCommentStats(discussionId);
  }

  /**
   * Get comment count for a discussion
   * GET /comments/discussion/:discussionId/count
   */
  @Get('discussion/:discussionId/count')
  async getDiscussionCommentCount(@Param('discussionId') discussionId: string) {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comment count for discussion: ${discussionId}`);
    const stats =
      await this.commentService.getDiscussionCommentStats(discussionId);
    return { count: stats.totalComments };
  }

  // ============================================
  // THREADED COMMENT ENDPOINTS
  // ============================================

  /**
   * Get replies to a comment
   * GET /comments/:id/replies
   */
  @Get(':id/replies')
  async getCommentReplies(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting replies for comment: ${id}`);
    return await this.commentService.getCommentReplies(id, req.user?.sub);
  }

  /**
   * Get complete comment thread (comment + all replies)
   * GET /comments/:id/thread
   */
  @Get(':id/thread')
  async getCommentThread(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting comment thread for: ${id}`);
    return await this.commentService.getCommentThread(id, req.user?.sub);
  }
}
