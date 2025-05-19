// src/nodes/comment/comment.controller.ts
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

    return this.commentService.createComment(commentData);
  }

  @Get(':id')
  async getComment(@Param('id') id: string, @Request() req: any) {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    return this.commentService.getCommentWithVisibility(id, req.user?.sub);
  }

  @Put(':id')
  async updateComment(
    @Param('id') id: string,
    @Body() updateData: { commentText: string },
  ) {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (!updateData.commentText || updateData.commentText.trim() === '') {
      throw new BadRequestException('Comment text is required');
    }

    return this.commentService.updateComment(id, updateData);
  }

  @Delete(':id')
  async deleteComment(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
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

    return this.commentService.getCommentsByDiscussionIdWithVisibility(
      discussionId,
      req.user?.sub,
      sortBy,
    );
  }

  @Post(':id/vote')
  async voteComment(
    @Param('id') id: string,
    @Body() voteData: { isPositive: boolean },
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (voteData.isPositive === undefined) {
      throw new BadRequestException('Vote value (isPositive) is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User authentication is required');
    }

    this.logger.log(
      `Received request to vote on comment: ${id} with data: ${JSON.stringify(voteData)}`,
    );

    return this.commentService.voteComment(
      id,
      req.user.sub,
      voteData.isPositive,
    );
  }

  @Get(':id/vote')
  async getCommentVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User authentication is required');
    }

    return this.commentService.getCommentVoteStatus(id, req.user.sub);
  }

  @Post(':id/vote/remove')
  async removeCommentVote(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User authentication is required');
    }

    return this.commentService.removeCommentVote(id, req.user.sub);
  }

  @Get(':id/votes')
  async getCommentVotes(@Param('id') id: string): Promise<VoteResult | null> {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    return this.commentService.getCommentVotes(id);
  }

  // ENHANCED: Users comments votes endpoint for persistent vote states
  @Get('users/comments/votes')
  async getUserCommentVotes(@Request() req: any) {
    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    try {
      this.logger.log(`Getting user comment votes for user: ${req.user.sub}`);

      // Get all votes by this user on comments
      const userVotes = await this.commentService.getUserCommentVotes(
        req.user.sub,
      );

      this.logger.debug(
        `Retrieved ${Object.keys(userVotes).length} comment votes for user ${req.user.sub}`,
      );
      return { votes: userVotes };
    } catch (error) {
      this.logger.error(
        `Error getting user comment votes: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get user comment votes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: { isVisible: boolean },
  ) {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    if (visibilityData.isVisible === undefined) {
      throw new BadRequestException('Visibility status is required');
    }

    return this.commentService.setVisibilityStatus(
      id,
      visibilityData.isVisible,
    );
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('Comment ID is required');
    }

    const status = await this.commentService.getVisibilityStatus(id);
    return { visibilityStatus: status };
  }

  private handleError(error: any, logMessage: string): never {
    if (error instanceof BadRequestException) {
      this.logger.warn(`${logMessage}: ${error.message}`);
      throw error;
    }

    if (error instanceof NotFoundException) {
      this.logger.warn(`${logMessage}: ${error.message}`);
      throw error;
    }

    // For other types of errors
    this.logger.error(`${logMessage}: ${error.message}`, error.stack);

    throw new HttpException(
      error.message || 'An unexpected error occurred',
      error.status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
