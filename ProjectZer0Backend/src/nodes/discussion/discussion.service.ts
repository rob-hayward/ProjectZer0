// src/nodes/discussion/discussion.service.ts - SIMPLIFIED CONTAINER

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

  async getDiscussion(id: string) {
    if (!id || id.trim() === '') {
      throw new HttpException(
        'Discussion ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Getting discussion: ${id}`);

    try {
      const discussion = await this.discussionSchema.getDiscussion(id);

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

  async updateDiscussion(id: string, updateData: any) {
    if (!id || id.trim() === '') {
      throw new HttpException(
        'Discussion ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Updating discussion: ${id}`);

    try {
      const updatedDiscussion = await this.discussionSchema.updateDiscussion(
        id,
        updateData,
      );

      this.logger.debug(`Updated discussion: ${id}`);
      return updatedDiscussion;
    } catch (error) {
      this.logger.error(
        `Error updating discussion: ${error.message}`,
        error.stack,
      );

      if (error.message.includes('not found')) {
        throw new HttpException(
          `Discussion with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        `Failed to update discussion: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteDiscussion(id: string) {
    if (!id || id.trim() === '') {
      throw new HttpException(
        'Discussion ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Deleting discussion: ${id}`);

    try {
      const result = await this.discussionSchema.deleteDiscussion(id);

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
      const discussion = await this.getDiscussion(id);

      if (!discussion) {
        return null;
      }

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

      throw new HttpException(
        `Failed to get discussion with comments: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getDiscussionCommentCount(id: string): Promise<number> {
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
      return 0; // Return 0 on error rather than throwing
    }
  }

  // ❌ REMOVED: All voting methods - discussions don't need voting
  // - voteDiscussion()
  // - getDiscussionVoteStatus()
  // - removeDiscussionVote()
  // - getDiscussionVotes()

  // ❌ REMOVED: All visibility methods - discussions don't need user visibility preferences
  // - setVisibilityStatus()
  // - getVisibilityStatus()

  // Discussions are simple containers:
  // - Visibility determined by associated node (e.g., if word is visible, its discussions are visible)
  // - No community voting needed (discussions are just organizational containers)
  // - User preferences handled at comment level, not discussion level
}
