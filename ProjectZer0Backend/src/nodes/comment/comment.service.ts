// src/nodes/comment/comment.service.ts - FIXED FOR BaseNodeSchema Integration

import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { CommentSchema } from '../../neo4j/schemas/comment.schema';
import { VisibilityService } from '../../users/visibility/visibility.service';
import { v4 as uuidv4 } from 'uuid';

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
      throw new HttpException('createdBy is required', HttpStatus.BAD_REQUEST);
    }

    if (!commentData.discussionId || commentData.discussionId.trim() === '') {
      throw new HttpException(
        'discussionId is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!commentData.commentText || commentData.commentText.trim() === '') {
      throw new HttpException(
        'commentText is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(
      `Creating comment for discussion: ${commentData.discussionId}`,
    );

    try {
      // ✅ FIXED: Generate id and pass it to schema
      const commentWithId = {
        ...commentData,
        id: uuidv4(),
      };

      const comment = await this.commentSchema.createComment(commentWithId);
      this.logger.log(`Created comment: ${comment.id}`);
      return comment;
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

      this.logger.debug(`Retrieved comment: ${id}`);
      return comment;
    } catch (error) {
      this.logger.error(`Error getting comment: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get comment: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateComment(id: string, updateData: { commentText: string }) {
    if (!id || id.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!updateData.commentText || updateData.commentText.trim() === '') {
      throw new HttpException(
        'Comment text is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Updating comment: ${id}`);

    try {
      const updatedComment = await this.commentSchema.update(id, updateData);
      this.logger.log(`Updated comment: ${id}`);
      return updatedComment;
    } catch (error) {
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

  // ✅ NEW: Missing method for comment controller
  async canEditComment(commentId: string, userId: string): Promise<boolean> {
    if (!commentId || commentId.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!userId || userId.trim() === '') {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
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

  // ✅ UPDATED: Content voting only (comments don't have inclusion voting)
  async voteComment(
    id: string,
    userId: string,
    isPositive: boolean,
    kind: 'CONTENT',
  ) {
    if (!id || id.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!userId || userId.trim() === '') {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    if (kind !== 'CONTENT') {
      throw new HttpException(
        'Comments only support CONTENT voting',
        HttpStatus.BAD_REQUEST,
      );
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

  async getCommentVoteStatus(id: string, userId: string) {
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

  async removeCommentVote(id: string, userId: string, kind: 'CONTENT') {
    if (!id || id.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
    }

    if (!userId || userId.trim() === '') {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    if (kind !== 'CONTENT') {
      throw new HttpException(
        'Comments only support CONTENT voting',
        HttpStatus.BAD_REQUEST,
      );
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

  async getCommentVotes(id: string) {
    if (!id || id.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
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

  async getCommentWithVisibility(id: string, userId?: string) {
    const comment = await this.getComment(id);
    if (!comment) {
      return null;
    }

    const isVisible = await this.getCommentVisibilityForUser(id, userId);
    return { ...comment, isVisible };
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

  async getCommentsByDiscussionIdWithVisibility(
    discussionId: string,
    userId?: string,
    sortBy: 'popularity' | 'newest' | 'oldest' = 'popularity',
  ) {
    const comments = await this.getCommentsByDiscussionId(discussionId);

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

    // Sort comments based on sortBy parameter
    switch (sortBy) {
      case 'newest':
        return commentsWithVisibility.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      case 'oldest':
        return commentsWithVisibility.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      case 'popularity':
      default:
        return commentsWithVisibility.sort(
          (a, b) => b.contentNetVotes - a.contentNetVotes,
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

  // ✅ NEW: Missing methods for comment hierarchy
  async getCommentReplies(commentId: string, userId?: string) {
    if (!commentId || commentId.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
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

  async getCommentThread(commentId: string, userId?: string) {
    if (!commentId || commentId.trim() === '') {
      throw new HttpException('Comment ID is required', HttpStatus.BAD_REQUEST);
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
}
