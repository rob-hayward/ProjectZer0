// src/nodes/comment/comment.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CommentSchema } from '../../neo4j/schemas/comment.schema';
import { v4 as uuidv4 } from 'uuid';
import { VisibilityService } from '../../users/visibility/visibility.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private readonly commentSchema: CommentSchema,
    private readonly visibilityService: VisibilityService,
  ) {}

  async createComment(commentData: {
    createdBy: string;
    discussionId: string;
    commentText: string;
    parentCommentId?: string;
  }) {
    this.logger.log(
      `Creating comment: ${JSON.stringify(commentData, null, 2)}`,
    );
    const commentWithId = {
      ...commentData,
      id: uuidv4(),
    };
    const createdComment =
      await this.commentSchema.createComment(commentWithId);
    this.logger.log(
      `Created comment: ${JSON.stringify(createdComment, null, 2)}`,
    );
    return createdComment;
  }

  async getComment(id: string) {
    if (!id || id.trim() === '') {
      this.logger.warn('Attempted to get comment with empty ID');
      throw new BadRequestException('Comment ID cannot be empty');
    }

    this.logger.log(`Getting comment: ${id}`);
    const comment = await this.commentSchema.getComment(id);
    this.logger.log(`Retrieved comment: ${JSON.stringify(comment, null, 2)}`);
    return comment;
  }

  async getCommentWithVisibility(commentId: string, userId?: string) {
    try {
      const comment = await this.commentSchema.getComment(commentId);

      if (!comment) {
        return null;
      }

      // Get votes for community visibility calculation
      const voteStatus = await this.commentSchema.getCommentVotes(commentId);

      // Determine the community visibility
      const communityVisibility = {
        netVotes: voteStatus?.netVotes,
        isVisible: comment.visibilityStatus,
      };

      // Get the final visibility which may be overridden by user preference
      const isVisible = await this.visibilityService.getObjectVisibility(
        userId,
        commentId,
        communityVisibility,
      );

      // Attach visibility flag to the comment
      return {
        ...comment,
        isVisible,
      };
    } catch (error) {
      this.logger.error(
        `Error getting comment with visibility: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to get comment with visibility: ${error.message}`,
      );
    }
  }

  async updateComment(id: string, updateData: { commentText: string }) {
    this.logger.log(
      `Updating comment ${id}: ${JSON.stringify(updateData, null, 2)}`,
    );
    const updatedComment = await this.commentSchema.updateComment(
      id,
      updateData,
    );
    this.logger.log(
      `Updated comment: ${JSON.stringify(updatedComment, null, 2)}`,
    );
    return updatedComment;
  }

  async deleteComment(id: string) {
    this.logger.log(`Deleting comment: ${id}`);
    await this.commentSchema.deleteComment(id);
    this.logger.log(`Deleted comment: ${id}`);
  }

  async getCommentsByDiscussionId(discussionId: string) {
    this.logger.log(`Getting comments for discussion: ${discussionId}`);
    const comments =
      await this.commentSchema.getCommentsByDiscussionId(discussionId);
    this.logger.log(
      `Retrieved ${comments.length} comments for discussion ${discussionId}`,
    );
    return comments;
  }

  async getCommentsByDiscussionIdWithSorting(
    discussionId: string,
    sortBy: 'popularity' | 'newest' | 'oldest' = 'popularity',
  ): Promise<any[]> {
    this.logger.log(
      `Getting comments for discussion ${discussionId} sorted by ${sortBy}`,
    );

    const comments =
      await this.commentSchema.getCommentsByDiscussionIdWithSorting(
        discussionId,
        sortBy,
      );

    this.logger.log(
      `Retrieved ${comments.length} comments sorted by ${sortBy}`,
    );
    return comments;
  }

  async getCommentsByDiscussionIdWithVisibility(
    discussionId: string,
    userId?: string,
    sortBy: 'popularity' | 'newest' | 'oldest' = 'popularity',
  ) {
    try {
      // Get all comments for this discussion
      const comments =
        await this.commentSchema.getCommentsByDiscussionIdWithSorting(
          discussionId,
          sortBy,
        );

      // Process each comment with visibility
      const commentsWithVisibility = await Promise.all(
        comments.map(async (comment) => {
          // Get votes for community visibility calculation
          const voteStatus = await this.commentSchema.getCommentVotes(
            comment.id,
          );

          // Determine the community visibility
          const communityVisibility = {
            netVotes: voteStatus?.netVotes,
            isVisible: comment.visibilityStatus,
          };

          // Get the final visibility which may be overridden by user preference
          const isVisible = await this.visibilityService.getObjectVisibility(
            userId,
            comment.id,
            communityVisibility,
          );

          // Attach visibility flag to the comment
          return {
            ...comment,
            isVisible,
          };
        }),
      );

      return commentsWithVisibility;
    } catch (error) {
      this.logger.error(
        `Error getting comments with visibility: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to get comments with visibility: ${error.message}`,
      );
    }
  }

  async voteComment(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (!sub) {
      throw new BadRequestException('User ID is required');
    }

    try {
      this.logger.log(
        `Processing vote on comment ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      // Vote on the comment
      const result = await this.commentSchema.voteComment(id, sub, isPositive);

      // Update visibility based on new vote count
      await this.updateCommentVisibilityBasedOnVotes(id);

      this.logger.debug(
        `Vote result for comment ${id}: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error voting on comment ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to vote on comment: ${error.message}`);
    }
  }

  async getCommentVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (!sub) {
      throw new BadRequestException('User ID is required');
    }

    try {
      this.logger.debug(`Getting vote status for comment ${id} by user ${sub}`);
      const status = await this.commentSchema.getCommentVoteStatus(id, sub);
      this.logger.debug(`Vote status: ${JSON.stringify(status)}`);
      return status;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting vote status for comment ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get comment vote status: ${error.message}`);
    }
  }

  async removeCommentVote(id: string, sub: string): Promise<VoteResult> {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (!sub) {
      throw new BadRequestException('User ID is required');
    }

    try {
      this.logger.log(`Removing vote from comment ${id} by user ${sub}`);
      const result = await this.commentSchema.removeCommentVote(id, sub);

      // Update visibility based on new vote count
      await this.updateCommentVisibilityBasedOnVotes(id);

      this.logger.debug(`Remove vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error removing vote from comment ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to remove comment vote: ${error.message}`);
    }
  }

  async getCommentVotes(id: string): Promise<VoteResult | null> {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    try {
      this.logger.debug(`Getting votes for comment: ${id}`);
      const votes = await this.commentSchema.getCommentVotes(id);
      this.logger.debug(`Votes: ${JSON.stringify(votes)}`);
      return votes;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting votes for comment ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get comment votes: ${error.message}`);
    }
  }

  /**
   * ENHANCED: Get all comment votes for a specific user
   */
  async getUserCommentVotes(
    userId: string,
  ): Promise<Record<string, 'agree' | 'disagree' | 'none'>> {
    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    try {
      this.logger.debug(`Getting all comment votes for user: ${userId}`);

      const userVotes = await this.commentSchema.getUserCommentVotes(userId);

      this.logger.debug(
        `Retrieved votes for ${Object.keys(userVotes).length} comments`,
      );
      return userVotes;
    } catch (error) {
      this.logger.error(
        `Error getting user comment votes: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get user comment votes: ${error.message}`);
    }
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    this.logger.log(
      `Setting visibility status for comment ${id}: ${isVisible}`,
    );
    const updatedComment = await this.commentSchema.setVisibilityStatus(
      id,
      isVisible,
    );
    this.logger.log(
      `Updated comment visibility: ${JSON.stringify(updatedComment, null, 2)}`,
    );
    return updatedComment;
  }

  async getVisibilityStatus(id: string) {
    this.logger.log(`Getting visibility status for comment: ${id}`);
    const status = await this.commentSchema.getVisibilityStatus(id);
    this.logger.log(`Visibility status for comment ${id}: ${status}`);
    return status;
  }

  /**
   * Updates a comment's visibility status based on its vote count
   */
  async updateCommentVisibilityBasedOnVotes(
    commentId: string,
    voteThreshold: number = -5,
  ): Promise<boolean> {
    try {
      if (!commentId) {
        throw new BadRequestException('Comment ID is required');
      }

      this.logger.log(
        `Updating visibility based on votes for comment: ${commentId}`,
      );
      const visibilityStatus =
        await this.commentSchema.updateVisibilityBasedOnVotes(
          commentId,
          voteThreshold,
        );

      this.logger.debug(`Visibility status updated to: ${visibilityStatus}`);
      return visibilityStatus;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating visibility based on votes for comment ${commentId}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to update comment visibility based on votes: ${error.message}`,
      );
    }
  }
}
