// src/nodes/discussion/discussion.service.ts - UPDATED FOR BaseNodeSchema

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { CommentService } from '../comment/comment.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DiscussionService {
  private readonly logger = new Logger(DiscussionService.name);

  constructor(
    private readonly discussionSchema: DiscussionSchema,
    private readonly commentService: CommentService,
  ) {}

  async createDiscussion(discussionData: {
    createdBy: string;
    associatedNodeId: string;
    associatedNodeType: string;
    initialComment?: string;
  }) {
    if (!discussionData.createdBy || discussionData.createdBy.trim() === '') {
      throw new HttpException('Created by is required', HttpStatus.BAD_REQUEST);
    }

    if (
      !discussionData.associatedNodeId ||
      discussionData.associatedNodeId.trim() === ''
    ) {
      throw new HttpException(
        'Associated node ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      !discussionData.associatedNodeType ||
      discussionData.associatedNodeType.trim() === ''
    ) {
      throw new HttpException(
        'Associated node type is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(`Creating discussion: ${JSON.stringify(discussionData)}`);

    try {
      const discussionWithId = {
        ...discussionData,
        id: uuidv4(),
      };

      const createdDiscussion =
        await this.discussionSchema.createDiscussion(discussionWithId);

      this.logger.log(`Created discussion: ${createdDiscussion.id}`);

      // Create initial comment if provided
      if (
        discussionData.initialComment &&
        discussionData.initialComment.trim() !== ''
      ) {
        this.logger.log(
          `Creating initial comment for discussion: ${createdDiscussion.id}`,
        );

        try {
          const comment = await this.commentService.createComment({
            createdBy: discussionData.createdBy,
            discussionId: createdDiscussion.id,
            commentText: discussionData.initialComment,
            parentCommentId: undefined, // Root comment
          });

          this.logger.log(`Created initial comment: ${comment.id}`);
        } catch (error) {
          this.logger.warn(
            `Failed to create initial comment: ${error.message}`,
          );
          // Continue - discussion was created successfully
        }
      }

      return createdDiscussion;
    } catch (error) {
      this.logger.error(
        `Error creating discussion: ${error.message}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to create discussion: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ UPDATED: Use inherited findById() instead of getDiscussion()
  async getDiscussion(id: string) {
    if (!id || id.trim() === '') {
      throw new HttpException(
        'Discussion ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Getting discussion: ${id}`);

    try {
      const discussion = await this.discussionSchema.findById(id);

      if (!discussion) {
        this.logger.debug(`Discussion not found: ${id}`);
        return null;
      }

      this.logger.debug(`Retrieved discussion: ${id}`);
      return discussion;
    } catch (error) {
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

  // ✅ UPDATED: Use inherited update() instead of updateDiscussion()
  async updateDiscussion(id: string, updateData: any) {
    if (!id || id.trim() === '') {
      throw new HttpException(
        'Discussion ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Updating discussion: ${id}`);

    try {
      const updatedDiscussion = await this.discussionSchema.update(
        id,
        updateData,
      );

      if (!updatedDiscussion) {
        throw new HttpException(
          `Discussion with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(`Updated discussion: ${id}`);
      return updatedDiscussion;
    } catch (error) {
      this.logger.error(
        `Error updating discussion: ${error.message}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to update discussion: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ UPDATED: Use inherited delete() instead of deleteDiscussion()
  async deleteDiscussion(id: string) {
    if (!id || id.trim() === '') {
      throw new HttpException(
        'Discussion ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Deleting discussion: ${id}`);

    try {
      const result = await this.discussionSchema.delete(id);

      this.logger.log(`Deleted discussion: ${id}`);
      return result;
    } catch (error) {
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

  // ✅ PRESERVED: Unique container methods
  async getDiscussionsByAssociatedNode(nodeId: string, nodeType: string) {
    if (!nodeId || nodeId.trim() === '') {
      throw new HttpException('Node ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!nodeType || nodeType.trim() === '') {
      throw new HttpException('Node type is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Getting discussions for ${nodeType}: ${nodeId}`);

    try {
      const discussions =
        await this.discussionSchema.getDiscussionsByAssociatedNode(
          nodeId,
          nodeType,
        );

      this.logger.debug(
        `Retrieved ${discussions.length} discussions for ${nodeType}: ${nodeId}`,
      );
      return discussions;
    } catch (error) {
      this.logger.error(
        `Error getting discussions for node: ${error.message}`,
        error.stack,
      );

      throw new HttpException(
        `Failed to get discussions: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getDiscussionWithComments(id: string) {
    if (!id || id.trim() === '') {
      throw new HttpException(
        'Discussion ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Getting discussion with comments: ${id}`);

    try {
      // Get the discussion using inherited method
      const discussion = await this.discussionSchema.findById(id);

      if (!discussion) {
        throw new HttpException(
          `Discussion with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Get comments for this discussion
      const comments = await this.commentService.getCommentsByDiscussionId(id);

      return {
        ...discussion,
        comments,
      };
    } catch (error) {
      this.logger.error(
        `Error getting discussion with comments: ${error.message}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to get discussion with comments: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ✅ PRESERVED: Comment count utility
  async getDiscussionCommentCount(id: string) {
    if (!id || id.trim() === '') {
      throw new HttpException(
        'Discussion ID is required',
        HttpStatus.BAD_REQUEST,
      );
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

  // ❌ REMOVED: Visibility methods are not needed for discussions
  // - setVisibilityStatus()
  // - getVisibilityStatus()
}
