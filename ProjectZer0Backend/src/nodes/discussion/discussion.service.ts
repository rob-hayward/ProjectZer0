// src/nodes/discussion/discussion.service.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { CommentService } from '../comment/comment.service';

/**
 * DiscussionService - Service layer for discussion query operations
 *
 * ARCHITECTURE DECISION:
 * Discussion creation is handled DIRECTLY by DiscussionSchema, NOT through this service.
 * Other services (Word, Statement, etc.) inject DiscussionSchema and call
 * discussionSchema.createDiscussionForNode() directly.
 *
 * This service focuses on:
 * - Reading discussions (with orchestration)
 * - Querying discussion comments
 * - Utility methods for discussion operations
 *
 * RESPONSIBILITIES:
 * ✅ Orchestrate discussion + comment queries
 * ✅ Provide convenience methods for discussion retrieval
 * ✅ Handle discussion-related business logic
 * ✅ Error handling and transformation
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Creating discussions (that's DiscussionSchema, called by content services)
 * ❌ Writing Cypher queries (that's DiscussionSchema)
 * ❌ Simple pass-throughs to single schema methods
 *
 * USAGE PATTERN:
 * ```typescript
 * // In WordService, StatementService, etc.
 * constructor(
 *   private readonly wordSchema: WordSchema,
 *   private readonly discussionSchema: DiscussionSchema, // ← Inject schema directly
 * ) {}
 *
 * async createWord(data) {
 *   const word = await this.wordSchema.createWord(data);
 *
 *   if (data.initialComment) {
 *     await this.discussionSchema.createDiscussionForNode({ // ← Call schema directly
 *       nodeId: word.word,
 *       nodeType: 'WordNode',
 *       nodeIdField: 'word',
 *       createdBy: data.createdBy,
 *       initialComment: data.initialComment
 *     });
 *   }
 * }
 * ```
 */
@Injectable()
export class DiscussionService {
  private readonly logger = new Logger(DiscussionService.name);

  constructor(
    private readonly discussionSchema: DiscussionSchema,
    private readonly commentService: CommentService,
  ) {}

  // ============================================
  // READ OPERATIONS - Direct Delegation
  // ============================================

  /**
   * Get a discussion by ID
   * Direct delegation to schema
   */
  async getDiscussion(id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting discussion: ${id}`);

    try {
      const discussion = await this.discussionSchema.findById(id);

      if (!discussion) {
        throw new NotFoundException(`Discussion with ID ${id} not found`);
      }

      return discussion;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error getting discussion: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get discussion: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get discussion ID for a node
   * Direct delegation to schema
   */
  async getDiscussionIdForNode(
    nodeType: string,
    nodeId: string,
    idField: string = 'id',
  ): Promise<string | null> {
    if (!nodeType || nodeType.trim() === '') {
      throw new BadRequestException('Node type is required');
    }

    if (!nodeId || nodeId.trim() === '') {
      throw new BadRequestException('Node ID is required');
    }

    try {
      return await this.discussionSchema.getDiscussionIdForNode(
        nodeType,
        nodeId,
        idField,
      );
    } catch (error) {
      this.logger.error(
        `Error getting discussion ID for node: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Check if a node has a discussion
   * Direct delegation to schema
   */
  async hasDiscussion(
    nodeType: string,
    nodeId: string,
    idField: string = 'id',
  ): Promise<boolean> {
    if (!nodeType || nodeType.trim() === '') {
      throw new BadRequestException('Node type is required');
    }

    if (!nodeId || nodeId.trim() === '') {
      throw new BadRequestException('Node ID is required');
    }

    try {
      return await this.discussionSchema.hasDiscussion(
        nodeType,
        nodeId,
        idField,
      );
    } catch (error) {
      this.logger.error(
        `Error checking if node has discussion: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  // ============================================
  // ORCHESTRATION METHODS - Add Business Value
  // ============================================

  /**
   * Get discussion with all its comments
   * Orchestrates: discussion data + comments
   *
   * This is genuine orchestration - combines multiple data sources
   */
  async getDiscussionWithComments(id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting discussion with comments: ${id}`);

    try {
      // Get the discussion
      const discussion = await this.discussionSchema.findById(id);

      if (!discussion) {
        throw new NotFoundException(`Discussion with ID ${id} not found`);
      }

      // Get all comments for this discussion
      const comments = await this.commentService.getCommentsByDiscussionId(id);

      return {
        ...discussion,
        comments,
        commentCount: comments.length,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting discussion with comments: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get discussion with comments: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get discussion with comments including visibility
   * Orchestrates: discussion + comments with visibility status
   *
   * This is genuine orchestration with user-specific data
   */
  async getDiscussionWithCommentsAndVisibility(
    id: string,
    userId?: string,
    sortBy: 'newest' | 'oldest' | 'topVoted' = 'newest',
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(
      `Getting discussion with comments and visibility: ${id} for user: ${userId || 'anonymous'}`,
    );

    try {
      // Get the discussion
      const discussion = await this.discussionSchema.findById(id);

      if (!discussion) {
        throw new NotFoundException(`Discussion with ID ${id} not found`);
      }

      // Get comments with visibility for the user
      const comments =
        await this.commentService.getCommentsByDiscussionIdWithVisibility(
          id,
          userId,
          sortBy,
        );

      return {
        ...discussion,
        comments,
        commentCount: comments.length,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting discussion with comments and visibility: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get discussion with comments and visibility: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // COMMENT-RELATED UTILITY METHODS
  // ============================================

  /**
   * Get all comments for a discussion
   * Delegates to CommentService
   */
  async getDiscussionComments(discussionId: string) {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comments for discussion: ${discussionId}`);

    try {
      // Verify discussion exists
      await this.getDiscussion(discussionId);

      // Get comments
      const comments =
        await this.commentService.getCommentsByDiscussionId(discussionId);

      return { comments };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting discussion comments: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get discussion comments: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get comment count for a discussion
   * Direct delegation to schema
   */
  async getDiscussionCommentCount(id: string): Promise<number> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    try {
      return await this.discussionSchema.getDiscussionCommentCount(id);
    } catch (error) {
      this.logger.error(
        `Error getting discussion comment count: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get discussion comment count: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Add a comment to a discussion
   * Orchestrates: discussion verification + comment creation
   */
  async addCommentToDiscussion(
    discussionId: string,
    commentData: {
      commentText: string;
      parentCommentId?: string;
    },
    createdBy: string,
  ) {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    if (!commentData.commentText || commentData.commentText.trim() === '') {
      throw new BadRequestException('Comment text is required');
    }

    if (!createdBy || createdBy.trim() === '') {
      throw new BadRequestException('Creator is required');
    }

    this.logger.log(`Adding comment to discussion: ${discussionId}`);

    try {
      // Verify discussion exists
      await this.getDiscussion(discussionId);

      // Create comment
      const comment = await this.commentService.createComment({
        createdBy,
        discussionId,
        commentText: commentData.commentText.trim(),
        parentCommentId: commentData.parentCommentId,
      });

      this.logger.log(`Created comment: ${comment.id}`);
      return comment;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error adding comment to discussion: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to add comment to discussion: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // MANAGEMENT OPERATIONS
  // ============================================

  /**
   * Update a discussion (minimal updates allowed)
   * Direct delegation to schema
   */
  async updateDiscussion(id: string, updateData: Partial<{ updatedAt: Date }>) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Updating discussion: ${id}`);

    try {
      // Verify discussion exists
      await this.getDiscussion(id);

      // Update discussion
      return await this.discussionSchema.update(id, updateData);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating discussion: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to update discussion: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a discussion (admin/cleanup operation)
   * Direct delegation to schema
   */
  async deleteDiscussion(id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.log(`Deleting discussion: ${id}`);

    try {
      // Verify discussion exists
      await this.getDiscussion(id);

      // Delete discussion using schema
      await this.discussionSchema.delete(id);

      this.logger.log(`Successfully deleted discussion: ${id}`);
      return { success: true, message: 'Discussion deleted successfully' };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting discussion: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to delete discussion: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get discussions by associated node
   * Utility method for finding all discussions for a specific node
   */
  async getDiscussionsByAssociatedNode(nodeId: string, nodeType: string) {
    if (!nodeId || nodeId.trim() === '') {
      throw new BadRequestException('Node ID is required');
    }

    if (!nodeType || nodeType.trim() === '') {
      throw new BadRequestException('Node type is required');
    }

    this.logger.debug(`Getting discussions for ${nodeType}: ${nodeId}`);

    try {
      // This would use a schema method to find all discussions for a node
      // For now, we can use getDiscussionIdForNode as a starting point
      const discussionId = await this.getDiscussionIdForNode(
        nodeType,
        nodeId,
        'id',
      );

      if (!discussionId) {
        return [];
      }

      const discussion = await this.getDiscussion(discussionId);
      return [discussion];
    } catch (error) {
      this.logger.error(
        `Error getting discussions by node: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get discussions by node: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
