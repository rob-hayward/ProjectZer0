// src/nodes/discussion/discussion.controller.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Controller,
  Get,
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
import { DiscussionService } from './discussion.service';

/**
 * DTOs for type safety
 */
interface UpdateDiscussionDto {
  updatedAt?: Date;
}

/**
 * DiscussionController - HTTP layer for discussion query operations
 *
 * ARCHITECTURE DECISION:
 * Discussion creation is NOT exposed as an HTTP endpoint here.
 * Discussions are created automatically when content nodes (Word, Statement, etc.)
 * are created with an initialComment. This happens at the schema layer.
 *
 * This controller focuses on:
 * - Reading discussions
 * - Querying discussion comments
 * - Managing existing discussions (update, delete)
 *
 * RESPONSIBILITIES:
 * ✅ HTTP request/response handling for discussion queries
 * ✅ Input validation at the boundary
 * ✅ Authentication/authorization checks
 * ✅ Proper status codes
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Creating discussions (handled by content creation endpoints)
 * ❌ Business logic
 * ❌ Calling schemas directly
 */
@Controller('discussions')
@UseGuards(JwtAuthGuard)
export class DiscussionController {
  private readonly logger = new Logger(DiscussionController.name);

  constructor(private readonly discussionService: DiscussionService) {}

  // ============================================
  // READ ENDPOINTS
  // ============================================

  /**
   * Get a discussion by ID
   * GET /discussions/:id
   */
  @Get(':id')
  async getDiscussion(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting discussion: ${id}`);

    const discussion = await this.discussionService.getDiscussion(id);

    if (!discussion) {
      throw new NotFoundException(`Discussion with ID ${id} not found`);
    }

    return discussion;
  }

  /**
   * Get discussion with all comments
   * GET /discussions/:id/with-comments
   */
  @Get(':id/with-comments')
  async getDiscussionWithComments(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting discussion with comments: ${id}`);
    return await this.discussionService.getDiscussionWithComments(id);
  }

  /**
   * Get discussion with comments including visibility status
   * GET /discussions/:id/with-comments-visibility
   */
  @Get(':id/with-comments-visibility')
  async getDiscussionWithCommentsAndVisibility(
    @Param('id') id: string,
    @Query('sortBy') sortBy: 'newest' | 'oldest' | 'topVoted' = 'newest',
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    const validSortOptions = ['newest', 'oldest', 'topVoted'];
    if (sortBy && !validSortOptions.includes(sortBy)) {
      throw new BadRequestException(
        `sortBy must be one of: ${validSortOptions.join(', ')}`,
      );
    }

    this.logger.debug(`Getting discussion with comments and visibility: ${id}`);

    return await this.discussionService.getDiscussionWithCommentsAndVisibility(
      id,
      req.user?.sub,
      sortBy,
    );
  }

  /**
   * Get all comments for a discussion
   * GET /discussions/:id/comments
   */
  @Get(':id/comments')
  async getDiscussionComments(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comments for discussion: ${id}`);
    return await this.discussionService.getDiscussionComments(id);
  }

  /**
   * Get comment count for a discussion
   * GET /discussions/:id/comment-count
   */
  @Get(':id/comment-count')
  async getDiscussionCommentCount(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comment count for discussion: ${id}`);
    const count = await this.discussionService.getDiscussionCommentCount(id);
    return { count };
  }

  /**
   * Get discussions by associated node
   * GET /discussions/by-node/:nodeType/:nodeId
   */
  @Get('by-node/:nodeType/:nodeId')
  async getDiscussionsByNode(
    @Param('nodeType') nodeType: string,
    @Param('nodeId') nodeId: string,
  ) {
    if (!nodeType || nodeType.trim() === '') {
      throw new BadRequestException('Node type is required');
    }

    if (!nodeId || nodeId.trim() === '') {
      throw new BadRequestException('Node ID is required');
    }

    this.logger.debug(`Getting discussions for ${nodeType}: ${nodeId}`);
    return await this.discussionService.getDiscussionsByAssociatedNode(
      nodeId,
      nodeType,
    );
  }

  // ============================================
  // UPDATE ENDPOINT
  // ============================================

  /**
   * Update a discussion (minimal updates allowed)
   * PUT /discussions/:id
   *
   * Note: Discussions have minimal updatable fields
   * Most discussion properties are immutable after creation
   */
  @Put(':id')
  async updateDiscussion(
    @Param('id') id: string,
    @Body() updateData: UpdateDiscussionDto,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    // Validate that only allowed fields are being updated
    const allowedFields = ['updatedAt'];
    const invalidFields = Object.keys(updateData).filter(
      (key) => !allowedFields.includes(key),
    );

    if (invalidFields.length > 0) {
      throw new BadRequestException(
        `Cannot update fields: ${invalidFields.join(', ')}. Only ${allowedFields.join(', ')} can be updated.`,
      );
    }

    this.logger.debug(`Updating discussion: ${id}`);
    return await this.discussionService.updateDiscussion(id, updateData);
  }

  // ============================================
  // DELETE ENDPOINT
  // ============================================

  /**
   * Delete a discussion
   * DELETE /discussions/:id
   *
   * Note: Only the discussion creator can delete it
   * This is typically used for cleanup/admin purposes
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDiscussion(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.debug(`Deleting discussion: ${id}`);

    // Verify discussion exists and check ownership
    const discussion = await this.discussionService.getDiscussion(id);

    if (!discussion) {
      throw new NotFoundException(`Discussion with ID ${id} not found`);
    }

    // Only creator can delete (or admin - could add role check here)
    if (discussion.createdBy !== req.user.sub) {
      throw new HttpException(
        'Only the discussion creator can delete it',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.discussionService.deleteDiscussion(id);
  }

  // ============================================
  // COMMENT MANAGEMENT ENDPOINTS
  // ============================================

  /**
   * Add a comment to a discussion
   * POST /discussions/:id/comments
   *
   * Note: This is a convenience endpoint
   * Comments can also be created via the comments controller
   */
  @Get(':id/add-comment')
  async addCommentToDiscussion(
    @Param('id') id: string,
    @Body() commentData: { commentText: string; parentCommentId?: string },
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    if (!commentData.commentText || commentData.commentText.trim() === '') {
      throw new BadRequestException('Comment text is required');
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.log(`Adding comment to discussion: ${id}`);

    return await this.discussionService.addCommentToDiscussion(
      id,
      commentData,
      req.user.sub,
    );
  }

  // ============================================
  // NOTES ON REMOVED ENDPOINTS
  // ============================================

  /**
   * ❌ REMOVED: POST /discussions (createDiscussion)
   *
   * Discussions are now created automatically when content nodes
   * are created with an initialComment. This happens through:
   * - POST /words (with initialComment)
   * - POST /statements (with initialComment)
   * - POST /definitions (with initialComment)
   * - etc.
   *
   * The content creation endpoints call DiscussionSchema.createDiscussionForNode()
   * directly at the schema layer.
   */

  /**
   * ❌ REMOVED: All voting endpoints
   *
   * Discussions don't support voting - they're simple containers.
   * Voting happens at the comment level within discussions.
   */

  /**
   * ❌ REMOVED: All visibility endpoints
   *
   * Discussions don't have user visibility preferences.
   * Discussion visibility is determined by the associated node.
   * If a word is visible, its discussion is visible.
   * User preferences are handled at the comment level.
   */
}
