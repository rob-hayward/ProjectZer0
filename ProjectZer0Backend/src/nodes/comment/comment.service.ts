// src/nodes/comment/comment.service.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CommentSchema } from '../../neo4j/schemas/comment.schema';
import { VisibilityService } from '../../users/visibility/visibility.service';
import { TEXT_LIMITS } from '../../constants/validation';
import { v4 as uuidv4 } from 'uuid';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';
import type { CommentData } from '../../neo4j/schemas/comment.schema';

/**
 * CommentService - Service layer for comment business logic
 *
 * ARCHITECTURE:
 * - Delegates all CRUD operations to CommentSchema
 * - Orchestrates comment + visibility operations
 * - Provides convenience methods for discussion-level comment queries
 * - Handles input validation and error transformation
 *
 * RESPONSIBILITIES:
 * ✅ Orchestrate multiple schema calls (comment + visibility)
 * ✅ Business validation beyond schema enforcement
 * ✅ Transform/aggregate data for API responses
 * ✅ Provide domain-specific convenience methods
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Writing Cypher queries (that's CommentSchema)
 * ❌ Direct database access
 * ❌ Simple pass-throughs to single schema methods
 */
@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private readonly commentSchema: CommentSchema,
    private readonly visibilityService: VisibilityService,
  ) {}

  // ============================================
  // CRUD OPERATIONS - Delegate to Schema
  // ============================================

  /**
   * Create a new comment with auto-generated ID
   * Orchestrates: ID generation + schema creation
   */
  async createComment(commentData: {
    createdBy: string;
    discussionId: string;
    commentText: string;
    parentCommentId?: string;
  }): Promise<CommentData> {
    // Input validation
    if (!commentData.createdBy || commentData.createdBy.trim() === '') {
      throw new BadRequestException('Creator ID is required');
    }

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

    this.logger.log(
      `Creating comment for discussion: ${commentData.discussionId}`,
    );

    try {
      // Generate ID (service-level concern)
      const commentId = uuidv4();

      // Delegate to schema
      const result = await this.commentSchema.createComment({
        id: commentId,
        ...commentData,
      });

      this.logger.log(`Successfully created comment: ${commentId}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error creating comment: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to create comment: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a comment by ID
   * Direct delegation to schema
   */
  async getComment(id: string): Promise<CommentData | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting comment: ${id}`);

    try {
      return await this.commentSchema.findById(id);
    } catch (error) {
      this.logger.error(`Error getting comment: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get comment: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update a comment
   * Direct delegation to schema with edit permission check
   */
  async updateComment(
    id: string,
    userId: string,
    updateData: { commentText: string },
  ): Promise<CommentData> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    if (!updateData.commentText || updateData.commentText.trim() === '') {
      throw new BadRequestException('Comment text is required');
    }

    if (updateData.commentText.length > TEXT_LIMITS.MAX_COMMENT_LENGTH) {
      throw new BadRequestException(
        `Comment text must not exceed ${TEXT_LIMITS.MAX_COMMENT_LENGTH} characters`,
      );
    }

    this.logger.debug(`Updating comment: ${id}`);

    try {
      // Check edit permission (business rule)
      const canEdit = await this.commentSchema.canEditComment(id, userId);
      if (!canEdit) {
        throw new BadRequestException(
          'Cannot edit comment: either not the author or edit window expired',
        );
      }

      // Delegate to schema
      return await this.commentSchema.update(id, updateData);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Error updating comment: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to update comment: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a comment
   * Direct delegation to schema
   */
  async deleteComment(id: string): Promise<void> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Deleting comment: ${id}`);

    try {
      await this.commentSchema.delete(id);
      this.logger.log(`Successfully deleted comment: ${id}`);
    } catch (error) {
      this.logger.error(
        `Error deleting comment: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to delete comment: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check if a comment can be edited
   * Direct delegation to schema
   */
  async canEditComment(commentId: string, userId: string): Promise<boolean> {
    if (!commentId || commentId.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Checking if user ${userId} can edit comment ${commentId}`,
    );

    try {
      return await this.commentSchema.canEditComment(commentId, userId);
    } catch (error) {
      this.logger.error(
        `Error checking edit permission: ${error.message}`,
        error.stack,
      );
      return false; // Default to false on error
    }
  }

  // ============================================
  // VOTING OPERATIONS - Delegate to Schema
  // ============================================

  /**
   * Vote on comment content (comments only support content voting)
   * Direct delegation to schema
   */
  async voteComment(
    id: string,
    userId: string,
    isPositive: boolean,
    kind: 'CONTENT',
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    if (kind !== 'CONTENT') {
      throw new BadRequestException('Comments only support CONTENT voting');
    }

    this.logger.debug(
      `Voting ${isPositive ? 'positive' : 'negative'} on comment content: ${id}`,
    );

    try {
      return await this.commentSchema.voteContent(id, userId, isPositive);
    } catch (error) {
      this.logger.error(
        `Error voting on comment: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to vote on comment: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get vote status for a user on a comment
   * Direct delegation to schema
   */
  async getCommentVoteStatus(
    id: string,
    userId: string,
  ): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting vote status for comment: ${id} and user: ${userId}`,
    );

    try {
      return await this.commentSchema.getVoteStatus(id, userId);
    } catch (error) {
      this.logger.error(
        `Error getting comment vote status: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get comment vote status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Remove a vote from a comment
   * Direct delegation to schema
   */
  async removeCommentVote(
    id: string,
    userId: string,
    kind: 'CONTENT',
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    if (kind !== 'CONTENT') {
      throw new BadRequestException('Comments only support CONTENT voting');
    }

    this.logger.debug(`Removing content vote from comment: ${id}`);

    try {
      return await this.commentSchema.removeVote(id, userId, 'CONTENT');
    } catch (error) {
      this.logger.error(
        `Error removing comment vote: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to remove comment vote: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get vote counts for a comment
   * Direct delegation to schema
   */
  async getCommentVotes(id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting votes for comment: ${id}`);

    try {
      return await this.commentSchema.getVotes(id);
    } catch (error) {
      this.logger.error(
        `Error getting comment votes: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get comment votes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // VISIBILITY OPERATIONS - Orchestrate Schema + VisibilityService
  // ============================================

  /**
   * Set user visibility preference for a comment
   * Delegation to VisibilityService
   */
  async setCommentVisibilityPreference(
    userId: string,
    commentId: string,
    isVisible: boolean,
  ) {
    if (!commentId || commentId.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Setting visibility preference for comment ${commentId} by user ${userId}: ${isVisible}`,
    );

    try {
      return await this.visibilityService.setUserVisibilityPreference(
        userId,
        commentId,
        isVisible,
      );
    } catch (error) {
      this.logger.error(
        `Error setting comment visibility preference: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to set comment visibility preference: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get visibility status for a comment for a specific user
   * Orchestrates: CommentSchema (for vote data) + VisibilityService
   */
  async getCommentVisibilityForUser(
    commentId: string,
    userId?: string,
  ): Promise<boolean> {
    if (!commentId || commentId.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(
      `Getting visibility for comment ${commentId} and user ${userId || 'anonymous'}`,
    );

    try {
      // Get comment data to access vote counts
      const commentData = await this.commentSchema.findById(commentId);
      if (!commentData) {
        throw new NotFoundException(`Comment with ID ${commentId} not found`);
      }

      // Delegate to VisibilityService with vote data
      return await this.visibilityService.getObjectVisibility(
        userId || null,
        commentId,
        {
          netVotes: commentData.contentNetVotes, // Comments use content votes for visibility
        },
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error getting comment visibility: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get comment visibility: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get comment with visibility status
   * Orchestrates: comment data + visibility check
   */
  async getCommentWithVisibility(
    id: string,
    userId?: string,
  ): Promise<(CommentData & { isVisible: boolean }) | null> {
    const comment = await this.getComment(id);
    if (!comment) {
      return null;
    }

    const isVisible = await this.getCommentVisibilityForUser(id, userId);
    return { ...comment, isVisible };
  }

  // ============================================
  // DISCUSSION-LEVEL OPERATIONS - Schema Delegation + Orchestration
  // ============================================

  /**
   * Get all comments for a discussion
   * Direct delegation to schema
   */
  async getCommentsByDiscussionId(
    discussionId: string,
  ): Promise<CommentData[]> {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comments for discussion: ${discussionId}`);

    try {
      const comments =
        await this.commentSchema.getCommentsByDiscussionId(discussionId);
      this.logger.debug(
        `Retrieved ${comments.length} comments for discussion: ${discussionId}`,
      );
      return comments;
    } catch (error) {
      this.logger.error(
        `Error getting comments for discussion: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get comments for discussion: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get comments for a discussion with visibility status
   * Orchestrates: fetch comments + add visibility to each
   */
  async getCommentsByDiscussionIdWithVisibility(
    discussionId: string,
    userId?: string,
    sortBy: 'newest' | 'oldest' | 'topVoted' = 'newest',
  ) {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(
      `Getting comments with visibility for discussion: ${discussionId}`,
    );

    try {
      // Get all comments
      const comments =
        await this.commentSchema.getCommentsByDiscussionId(discussionId);

      // Add visibility to each comment
      const commentsWithVisibility = await Promise.all(
        comments.map(async (comment) => {
          const isVisible = await this.getCommentVisibilityForUser(
            comment.id,
            userId,
          );
          return { ...comment, isVisible };
        }),
      );

      // Sort based on parameter
      const sorted = this.sortComments(commentsWithVisibility, sortBy);

      this.logger.debug(
        `Retrieved ${sorted.length} comments with visibility for discussion: ${discussionId}`,
      );
      return sorted;
    } catch (error) {
      this.logger.error(
        `Error getting comments with visibility: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get comments with visibility: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get comment statistics for a discussion
   * Direct delegation to schema
   */
  async getDiscussionCommentStats(discussionId: string) {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comment stats for discussion: ${discussionId}`);

    try {
      return await this.commentSchema.getDiscussionCommentStats(discussionId);
    } catch (error) {
      this.logger.error(
        `Error getting comment stats: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get comment stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // THREADED COMMENT OPERATIONS - Schema Delegation + Orchestration
  // ============================================

  /**
   * Get replies to a comment with visibility
   * Orchestrates: fetch replies + add visibility to each
   */
  async getCommentReplies(
    commentId: string,
    userId?: string,
  ): Promise<Array<CommentData & { isVisible: boolean }>> {
    if (!commentId || commentId.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting replies for comment: ${commentId}`);

    try {
      const replies = await this.commentSchema.getRepliesForComment(commentId);

      // Add visibility to each reply
      const repliesWithVisibility = await Promise.all(
        replies.map(async (reply) => {
          const isVisible = await this.getCommentVisibilityForUser(
            reply.id,
            userId,
          );
          return { ...reply, isVisible };
        }),
      );

      this.logger.debug(
        `Retrieved ${repliesWithVisibility.length} replies for comment: ${commentId}`,
      );
      return repliesWithVisibility;
    } catch (error) {
      this.logger.error(
        `Error getting replies for comment: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get replies for comment: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get complete comment thread (comment + all replies)
   * Orchestrates: root comment + replies with visibility
   */
  async getCommentThread(commentId: string, userId?: string) {
    if (!commentId || commentId.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting comment thread for: ${commentId}`);

    try {
      const rootComment = await this.getCommentWithVisibility(
        commentId,
        userId,
      );
      if (!rootComment) {
        throw new NotFoundException(`Comment with ID ${commentId} not found`);
      }

      const replies = await this.getCommentReplies(commentId, userId);

      return {
        rootComment,
        replies,
        totalCount: replies.length + 1, // +1 for root comment
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error getting comment thread: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get comment thread: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // UTILITY METHODS - Business Logic
  // ============================================

  /**
   * Sort comments based on criteria
   * Pure business logic, no external dependencies
   */
  private sortComments(
    comments: Array<CommentData & { isVisible: boolean }>,
    sortBy: 'newest' | 'oldest' | 'topVoted',
  ): Array<CommentData & { isVisible: boolean }> {
    switch (sortBy) {
      case 'newest':
        return comments.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      case 'oldest':
        return comments.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      case 'topVoted':
        return comments.sort((a, b) => b.contentNetVotes - a.contentNetVotes);
      default:
        return comments;
    }
  }
}
