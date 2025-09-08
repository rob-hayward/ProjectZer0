// src/nodes/comment/comment.service.ts - CONVERTED TO BaseNodeSchema + VisibilityService

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
import { v4 as uuidv4 } from 'uuid';
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
    if (!commentData.createdBy || commentData.createdBy.trim() === '') {
      throw new HttpException('Created by is required', HttpStatus.BAD_REQUEST);
    }

    if (!commentData.discussionId || commentData.discussionId.trim() === '') {
      throw new HttpException(
        'Discussion ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!commentData.commentText || commentData.commentText.trim() === '') {
      throw new HttpException(
        'Comment text is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(
      `Creating comment for discussion: ${commentData.discussionId}`,
    );

    try {
      const commentWithId = {
        ...commentData,
        id: uuidv4(),
      };

      const createdComment =
        await this.commentSchema.createComment(commentWithId);

      this.logger.log(`Successfully created comment: ${createdComment.id}`);
      return createdComment;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

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

  async getComment(id: string) {
    if (!id || id.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Getting comment: ${id}`);

    try {
      const comment = await this.commentSchema.findById(id);

      if (!comment) {
        this.logger.debug(`Comment not found: ${id}`);
        return null;
      }

      return comment;
    } catch (error) {
      this.logger.error(`Error getting comment: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get comment: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCommentWithVisibility(commentId: string, userId?: string) {
    const comment = await this.getComment(commentId);
    if (!comment) return null;

    try {
      const isVisible = await this.visibilityService.getObjectVisibility(
        userId || null,
        commentId,
        {
          netVotes: comment.contentNetVotes, // ✅ FIXED: Use contentNetVotes from BaseNodeData
          isVisible: undefined, // Let visibility be determined by votes and user preferences
        },
      );

      return { ...comment, isVisible };
    } catch (error) {
      this.logger.error(
        `Error getting comment visibility: ${error.message}`,
        error.stack,
      );
      // Return comment without visibility info on error
      return { ...comment, isVisible: true };
    }
  }

  async updateComment(id: string, updateData: any) {
    if (!id || id.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Updating comment: ${id}`);

    try {
      const updatedComment = await this.commentSchema.update(id, updateData);

      if (!updatedComment) {
        throw new NotFoundException(`Comment with ID ${id} not found`);
      }

      this.logger.debug(`Updated comment: ${id}`);
      return updatedComment;
    } catch (error) {
      if (error instanceof HttpException) {
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

  async deleteComment(id: string) {
    if (!id || id.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Deleting comment: ${id}`);

    try {
      const result = await this.commentSchema.delete(id);

      this.logger.log(`Deleted comment: ${id}`);
      return result;
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

  // ✅ UPDATED: Use inherited BaseNodeSchema voting methods
  async voteComment(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!userId || userId.trim() === '') {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(
      `Voting on comment: ${id} by user: ${userId}, isPositive: ${isPositive}`,
    );

    try {
      // Comments use content voting (quality assessment)
      const result = await this.commentSchema.voteContent(
        id,
        userId,
        isPositive,
      );

      this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
      return result;
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

  async getCommentVoteStatus(
    id: string,
    userId: string,
  ): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!userId || userId.trim() === '') {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(
      `Getting vote status for comment: ${id} and user: ${userId}`,
    );

    try {
      const status = await this.commentSchema.getVoteStatus(id, userId);

      this.logger.debug(
        `Vote status for comment ${id} and user ${userId}: ${JSON.stringify(status)}`,
      );
      return status;
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

  async removeCommentVote(id: string, userId: string): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!userId || userId.trim() === '') {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Removing vote on comment: ${id} by user: ${userId}`);

    try {
      const result = await this.commentSchema.removeVote(id, userId, 'CONTENT');

      this.logger.debug(`Remove vote result: ${JSON.stringify(result)}`);
      return result;
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

  async getCommentVotes(id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Getting votes for comment: ${id}`);

    try {
      const votes = await this.commentSchema.getVotes(id);

      this.logger.debug(`Votes for comment ${id}: ${JSON.stringify(votes)}`);
      return votes;
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

  // ✅ NEW: Centralized visibility methods using VisibilityService
  async setCommentVisibilityPreference(
    userId: string,
    commentId: string,
    isVisible: boolean,
  ) {
    if (!commentId || commentId.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!userId || userId.trim() === '') {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(
      `Setting visibility preference for comment ${commentId} by user ${userId}: ${isVisible}`,
    );

    try {
      const result = await this.visibilityService.setUserVisibilityPreference(
        userId,
        commentId,
        isVisible,
      );

      this.logger.debug(
        `Set visibility preference result: ${JSON.stringify(result)}`,
      );
      return result;
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

  async getCommentVisibilityForUser(
    commentId: string,
    userId?: string,
  ): Promise<boolean> {
    if (!commentId || commentId.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
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

      const isVisible = await this.visibilityService.getObjectVisibility(
        userId || null,
        commentId,
        {
          netVotes: commentData.contentNetVotes, // ✅ FIXED: Use contentNetVotes
          isVisible: undefined, // Let visibility be determined by votes and user preferences
        },
      );

      this.logger.debug(`Visibility for comment ${commentId}: ${isVisible}`);
      return isVisible;
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

  // ✅ PRESERVE: Unique comment functionality
  async getCommentsByDiscussionId(discussionId: string) {
    if (!discussionId || discussionId.trim() === '') {
      throw new HttpException(
        'Discussion ID is required',
        HttpStatus.BAD_REQUEST,
      );
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

  async getRepliesForComment(commentId: string) {
    if (!commentId || commentId.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Getting replies for comment: ${commentId}`);

    try {
      const replies = await this.commentSchema.getRepliesForComment(commentId);

      this.logger.debug(
        `Retrieved ${replies.length} replies for comment: ${commentId}`,
      );
      return replies;
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

  async getCommentHierarchy(discussionId: string) {
    if (!discussionId || discussionId.trim() === '') {
      throw new HttpException(
        'Discussion ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(
      `Getting comment hierarchy for discussion: ${discussionId}`,
    );

    try {
      const hierarchy =
        await this.commentSchema.getCommentHierarchy(discussionId);

      this.logger.debug(
        `Retrieved comment hierarchy with ${hierarchy.length} root comments`,
      );
      return hierarchy;
    } catch (error) {
      this.logger.error(
        `Error getting comment hierarchy: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get comment hierarchy: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateCommentText(commentId: string, userId: string, newText: string) {
    if (!commentId || commentId.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!userId || userId.trim() === '') {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!newText || newText.trim() === '') {
      throw new HttpException(
        'Comment text is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Updating comment text: ${commentId}`);

    try {
      const updatedComment = await this.commentSchema.updateCommentText(
        commentId,
        userId,
        newText,
      );

      this.logger.log(`Updated comment text: ${commentId}`);
      return updatedComment;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error updating comment text: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to update comment text: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getDiscussionCommentStats(discussionId: string) {
    if (!discussionId || discussionId.trim() === '') {
      throw new HttpException(
        'Discussion ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const stats =
        await this.commentSchema.getDiscussionCommentStats(discussionId);

      this.logger.debug(
        `Comment stats for discussion ${discussionId}: ${JSON.stringify(stats)}`,
      );
      return stats;
    } catch (error) {
      this.logger.error(
        `Error getting discussion comment stats: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get discussion comment stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ❌ REMOVED: Old voting methods (replaced by inherited methods)
  // - voteCommentInclusion() -> Comments don't use inclusion voting
  // - getCommentVotingData() -> now getCommentVotes() using schema.getVotes()

  // ❌ REMOVED: Old visibility methods (replaced by VisibilityService)
  // - setCommentVisibilityStatus() -> now setCommentVisibilityPreference()
  // - getCommentVisibilityStatus() -> now getCommentVisibilityForUser()
  // - updateVisibilityBasedOnVotes() -> handled by VisibilityService automatically
}
