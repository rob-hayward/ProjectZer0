// src/nodes/discussion/discussion.service.ts - REFACTORED TO USE NEW SCHEMA METHODS

import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { CommentService } from '../comment/comment.service';

@Injectable()
export class DiscussionService {
  private readonly logger = new Logger(DiscussionService.name);

  constructor(
    private readonly discussionSchema: DiscussionSchema,
    private readonly commentService: CommentService,
  ) {}

  /**
   * Create a discussion for a node
   * This method now uses the refactored schema method createDiscussionForNode
   */
  async createDiscussion(discussionData: {
    createdBy: string;
    associatedNodeId: string;
    associatedNodeType: string;
    initialComment?: string;
  }) {
    // Validate inputs
    if (!discussionData.createdBy || discussionData.createdBy.trim() === '') {
      throw new BadRequestException('Created by is required');
    }

    if (
      !discussionData.associatedNodeId ||
      discussionData.associatedNodeId.trim() === ''
    ) {
      throw new BadRequestException('Associated node ID is required');
    }

    if (
      !discussionData.associatedNodeType ||
      discussionData.associatedNodeType.trim() === ''
    ) {
      throw new BadRequestException('Associated node type is required');
    }

    this.logger.log(
      `Creating discussion for ${discussionData.associatedNodeType}: ${discussionData.associatedNodeId}`,
    );

    try {
      // Use the new refactored schema method
      const result = await this.discussionSchema.createDiscussionForNode({
        nodeId: discussionData.associatedNodeId,
        nodeType: discussionData.associatedNodeType,
        nodeIdField: 'id', // Default to 'id', override if needed (e.g., 'word' for WordNode)
        createdBy: discussionData.createdBy,
        initialComment: discussionData.initialComment,
      });

      this.logger.log(`Created discussion: ${result.discussionId}`);

      // If initial comment was provided and created
      if (result.commentId) {
        this.logger.log(`Created initial comment: ${result.commentId}`);
      }

      // Return a DiscussionData-like object for backward compatibility
      return {
        id: result.discussionId,
        createdBy: discussionData.createdBy,
        associatedNodeId: discussionData.associatedNodeId,
        associatedNodeType: discussionData.associatedNodeType,
        commentId: result.commentId,
      };
    } catch (error) {
      this.logger.error(
        `Error creating discussion: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new HttpException(
        `Failed to create discussion: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a discussion by ID
   */
  async getDiscussion(id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting discussion: ${id}`);

    try {
      const discussion = await this.discussionSchema.findById(id);

      if (!discussion) {
        throw new HttpException(
          `Discussion with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      return discussion;
    } catch (error) {
      if (error instanceof HttpException) {
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
   * Get the discussion ID for a specific node
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

  /**
   * Get all comments for a discussion
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
      if (error instanceof HttpException) {
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
   * Add a comment to a discussion
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
        error instanceof HttpException ||
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

  /**
   * Delete a discussion (admin/cleanup operation)
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
        error instanceof HttpException ||
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
}
