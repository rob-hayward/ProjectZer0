// src/nodes/comment/comment.controller.ts - UPDATED FOR BaseNodeSchema + VisibilityService

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Logger,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CommentService } from './comment.service';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentController {
  private readonly logger = new Logger(CommentController.name);

  constructor(private readonly commentService: CommentService) {}

  @Post()
  async createComment(
    @Body()
    commentData: {
      createdBy: string;
      discussionId: string;
      commentText: string;
      parentCommentId?: string;
    },
  ) {
    if (!commentData.discussionId) {
      throw new BadRequestException('Discussion ID is required');
    }

    if (!commentData.commentText || commentData.commentText.trim() === '') {
      throw new BadRequestException('Comment text is required');
    }

    this.logger.debug(
      `Creating comment for discussion: ${commentData.discussionId}`,
    );
    return this.commentService.createComment(commentData);
  }

  @Get(':id')
  async getComment(@Param('id') id: string, @Request() req: any) {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(
      `Getting comment: ${id} for user: ${req.user?.sub || 'anonymous'}`,
    );
    return this.commentService.getCommentWithVisibility(id, req.user?.sub);
  }

  @Put(':id')
  async updateComment(
    @Param('id') id: string,
    @Body() updateData: { commentText: string },
    @Request() req: any,
  ) {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (!updateData.commentText || updateData.commentText.trim() === '') {
      throw new BadRequestException('Comment text is required');
    }

    this.logger.debug(`Updating comment: ${id}`);

    // Check if user can edit the comment
    const canEdit = await this.commentService.canEditComment(id, req.user.sub);
    if (!canEdit) {
      throw new HttpException(
        'You can only edit your own comments within 15 minutes of creation',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.commentService.updateComment(id, updateData);
  }

  @Delete(':id')
  async deleteComment(@Param('id') id: string, @Request() req: any) {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Deleting comment: ${id}`);

    // Verify user can delete the comment (typically only creator or admin)
    const comment = await this.commentService.getComment(id);
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    if (comment.createdBy !== req.user.sub) {
      throw new HttpException(
        'You can only delete your own comments',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.commentService.deleteComment(id);
  }

  @Get('discussion/:discussionId')
  async getCommentsByDiscussion(
    @Param('discussionId') discussionId: string,
    @Request() req: any,
    @Query('sortBy') sortBy: 'popularity' | 'newest' | 'oldest' = 'popularity',
  ) {
    if (!discussionId) {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comments for discussion: ${discussionId}`);
    return this.commentService.getCommentsByDiscussionIdWithVisibility(
      discussionId,
      req.user?.sub,
      sortBy,
    );
  }

  // ✅ UPDATED: Content voting only (comments don't have inclusion voting)
  @Post(':id/vote')
  async voteCommentContent(
    @Param('id') id: string,
    @Body() voteData: { isPositive: boolean },
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (typeof voteData.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.debug(
      `Voting ${voteData.isPositive ? 'positive' : 'negative'} on comment content: ${id}`,
    );

    return this.commentService.voteComment(
      id,
      req.user.sub,
      voteData.isPositive,
      'CONTENT',
    );
  }

  @Get(':id/vote-status')
  async getCommentVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.debug(`Getting vote status for comment: ${id}`);
    return this.commentService.getCommentVoteStatus(id, req.user.sub);
  }

  @Delete(':id/vote')
  async removeCommentVote(
    @Param('id') id: string,
    @Body() voteData: { kind: 'CONTENT' },
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (voteData.kind !== 'CONTENT') {
      throw new BadRequestException('Comments only support CONTENT voting');
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.debug(`Removing content vote from comment: ${id}`);
    return this.commentService.removeCommentVote(id, req.user.sub, 'CONTENT');
  }

  @Get(':id/votes')
  async getCommentVotes(@Param('id') id: string): Promise<VoteResult | null> {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting vote counts for comment: ${id}`);
    return this.commentService.getCommentVotes(id);
  }

  // ✅ NEW: Centralized visibility preference endpoints
  @Post(':id/visibility')
  async setCommentVisibilityPreference(
    @Param('id') id: string,
    @Body() visibilityData: { isVisible: boolean },
    @Request() req: any,
  ) {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (typeof visibilityData.isVisible !== 'boolean') {
      throw new BadRequestException('isVisible must be a boolean');
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.debug(
      `Setting visibility preference for comment ${id}: ${visibilityData.isVisible}`,
    );

    const result = await this.commentService.setCommentVisibilityPreference(
      req.user.sub,
      id,
      visibilityData.isVisible,
    );

    return result;
  }

  @Get(':id/visibility')
  async getCommentVisibility(@Param('id') id: string, @Request() req: any) {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting visibility for comment: ${id}`);
    const isVisible = await this.commentService.getCommentVisibilityForUser(
      id,
      req.user?.sub,
    );

    this.logger.debug(`Comment ${id} visibility: ${isVisible}`);
    return { isVisible };
  }

  // ✅ PRESERVE: Unique comment functionality
  @Get('discussion/:discussionId/stats')
  async getDiscussionCommentStats(@Param('discussionId') discussionId: string) {
    if (!discussionId) {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comment stats for discussion: ${discussionId}`);
    return this.commentService.getDiscussionCommentStats(discussionId);
  }

  @Get('discussion/:discussionId/count')
  async getDiscussionCommentCount(@Param('discussionId') discussionId: string) {
    if (!discussionId) {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comment count for discussion: ${discussionId}`);
    const stats =
      await this.commentService.getDiscussionCommentStats(discussionId);
    return { count: stats.totalComments };
  }

  // ✅ NEW: Comment hierarchy endpoints
  @Get(':id/replies')
  async getCommentReplies(@Param('id') id: string, @Request() req: any) {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting replies for comment: ${id}`);
    return this.commentService.getCommentReplies(id, req.user?.sub);
  }

  @Get(':id/thread')
  async getCommentThread(@Param('id') id: string, @Request() req: any) {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting comment thread for: ${id}`);
    return this.commentService.getCommentThread(id, req.user?.sub);
  }
}
