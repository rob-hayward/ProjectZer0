// src/nodes/answer/answer.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AnswerService } from './answer.service';
import type { VoteResult } from '../../neo4j/schemas/vote.schema';

// Define DTOs for better type safety - Following consistent patterns
interface CreateAnswerDto {
  answerText: string;
  publicCredit: boolean;
  parentQuestionId: string;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment?: string;
}

interface UpdateAnswerDto {
  answerText?: string;
  publicCredit?: boolean;
}

interface VoteAnswerDto {
  isPositive: boolean;
}

interface RemoveVoteDto {
  kind?: 'INCLUSION' | 'CONTENT';
}

interface VisibilityDto {
  isVisible: boolean;
}

interface AddCommentDto {
  commentText: string;
  parentCommentId?: string;
}

@Controller('nodes/answer')
@UseGuards(JwtAuthGuard)
export class AnswerController {
  private readonly logger = new Logger(AnswerController.name);

  constructor(private readonly answerService: AnswerService) {}

  // CRUD OPERATIONS - Following consistent patterns

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAnswer(@Body() answerData: CreateAnswerDto, @Request() req: any) {
    try {
      this.logger.log(
        `Creating answer for question: ${answerData.parentQuestionId}`,
      );

      // Validate required fields
      if (!answerData.answerText || answerData.answerText.trim() === '') {
        throw new BadRequestException('Answer text is required');
      }

      if (
        !answerData.parentQuestionId ||
        answerData.parentQuestionId.trim() === ''
      ) {
        throw new BadRequestException('Parent question ID is required');
      }

      if (typeof answerData.publicCredit !== 'boolean') {
        throw new BadRequestException('Public credit flag is required');
      }

      const result = await this.answerService.createAnswer({
        ...answerData,
        createdBy: req.user.sub, // Use authenticated user ID from JWT
      });

      this.logger.log(`Successfully created answer with ID: ${result.id}`);
      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error creating answer for question: ${answerData.parentQuestionId}`,
      );
    }
  }

  @Get(':id')
  async getAnswer(
    @Param('id') id: string,
    @Query('includeParentQuestion') includeParentQuestion?: string,
    @Query('includeDiscussion') includeDiscussion?: string,
    @Query('includeCategories') includeCategories?: string,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.debug(`Retrieving answer: ${id}`);

      const options = {
        includeParentQuestion: includeParentQuestion === 'true',
        includeDiscussion: includeDiscussion === 'true',
        includeCategories: includeCategories === 'true',
      };

      const answer = await this.answerService.getAnswer(id, options);

      this.logger.debug(
        `Retrieved answer: ${answer.answerText.substring(0, 50)}...`,
      );
      return answer;
    } catch (error) {
      this.handleError(error, `Error retrieving answer: ${id}`);
    }
  }

  @Put(':id')
  async updateAnswer(
    @Param('id') id: string,
    @Body() updateData: UpdateAnswerDto,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.log(`Updating answer: ${id}`);

      const result = await this.answerService.updateAnswer(id, updateData);

      this.logger.log(`Successfully updated answer: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `Error updating answer: ${id}`);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAnswer(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.log(`Deleting answer: ${id}`);

      await this.answerService.deleteAnswer(id);

      this.logger.log(`Successfully deleted answer: ${id}`);
    } catch (error) {
      this.handleError(error, `Error deleting answer: ${id}`);
    }
  }

  // QUESTION-SPECIFIC ENDPOINTS

  @Get('question/:questionId')
  async getAnswersForQuestion(
    @Param('questionId') questionId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy')
    sortBy: 'created' | 'inclusion_votes' | 'content_votes' = 'created',
    @Query('sortDirection') sortDirection: 'asc' | 'desc' = 'desc',
    @Query('onlyApproved') onlyApproved?: string,
  ) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Question ID is required');
      }

      this.logger.log(`Getting answers for question: ${questionId}`);

      const options = {
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : 0,
        sortBy,
        sortDirection,
        onlyApproved: onlyApproved === 'true',
      };

      const answers = await this.answerService.getAnswersForQuestion(
        questionId,
        options,
      );

      this.logger.debug(
        `Retrieved ${answers.length} answers for question ${questionId}`,
      );
      return answers;
    } catch (error) {
      this.handleError(
        error,
        `Error getting answers for question: ${questionId}`,
      );
    }
  }

  // VOTING ENDPOINTS - Following consistent patterns

  @Post(':id/vote/inclusion')
  async voteAnswerInclusion(
    @Param('id') id: string,
    @Body() voteData: VoteAnswerDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      if (typeof voteData.isPositive !== 'boolean') {
        throw new BadRequestException(
          'Vote direction (isPositive) is required',
        );
      }

      this.logger.log(
        `Processing inclusion vote on answer ${id}: ${voteData.isPositive ? 'positive' : 'negative'}`,
      );

      const result = await this.answerService.voteAnswerInclusion(
        id,
        req.user.sub,
        voteData.isPositive,
      );

      return result;
    } catch (error) {
      this.handleError(error, `Error voting on answer inclusion: ${id}`);
    }
  }

  @Post(':id/vote/content')
  async voteAnswerContent(
    @Param('id') id: string,
    @Body() voteData: VoteAnswerDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      if (typeof voteData.isPositive !== 'boolean') {
        throw new BadRequestException(
          'Vote direction (isPositive) is required',
        );
      }

      this.logger.log(
        `Processing content vote on answer ${id}: ${voteData.isPositive ? 'positive' : 'negative'}`,
      );

      const result = await this.answerService.voteAnswerContent(
        id,
        req.user.sub,
        voteData.isPositive,
      );

      return result;
    } catch (error) {
      this.handleError(error, `Error voting on answer content: ${id}`);
    }
  }

  @Get(':id/vote')
  async getAnswerVoteStatus(@Param('id') id: string, @Request() req: any) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.debug(`Getting vote status for answer: ${id}`);

      const voteStatus = await this.answerService.getAnswerVoteStatus(
        id,
        req.user.sub,
      );

      return { voteStatus };
    } catch (error) {
      this.handleError(error, `Error getting vote status for answer: ${id}`);
    }
  }

  @Delete(':id/vote')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAnswerVote(
    @Param('id') id: string,
    @Body() removeVoteData: RemoveVoteDto,
    @Request() req: any,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      const kind = removeVoteData.kind || 'INCLUSION';
      this.logger.log(`Removing ${kind} vote from answer: ${id}`);

      await this.answerService.removeAnswerVote(id, req.user.sub, kind);
    } catch (error) {
      this.handleError(error, `Error removing vote from answer: ${id}`);
    }
  }

  @Get(':id/votes')
  async getAnswerVotes(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.debug(`Getting vote counts for answer: ${id}`);

      const votes = await this.answerService.getAnswerVotes(id);

      return { votes };
    } catch (error) {
      this.handleError(error, `Error getting votes for answer: ${id}`);
    }
  }

  // VISIBILITY ENDPOINTS - Following consistent patterns

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: VisibilityDto,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      if (typeof visibilityData.isVisible !== 'boolean') {
        throw new BadRequestException(
          'Visibility status (isVisible) is required',
        );
      }

      this.logger.log(
        `Setting visibility for answer ${id} to ${visibilityData.isVisible}`,
      );

      const result = await this.answerService.setVisibilityStatus(
        id,
        visibilityData.isVisible,
      );

      return result;
    } catch (error) {
      this.handleError(error, `Error setting visibility for answer: ${id}`);
    }
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.debug(`Getting visibility status for answer: ${id}`);

      const status = await this.answerService.getVisibilityStatus(id);

      return { visibilityStatus: status };
    } catch (error) {
      this.handleError(
        error,
        `Error getting visibility status for answer: ${id}`,
      );
    }
  }

  // DISCOVERY ENDPOINTS - Following consistent patterns

  @Get(':id/related')
  async getRelatedContentBySharedCategories(
    @Param('id') id: string,
    @Query('nodeTypes') nodeTypes?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy')
    sortBy:
      | 'category_overlap'
      | 'created'
      | 'inclusion_votes'
      | 'content_votes' = 'category_overlap',
    @Query('sortDirection') sortDirection: 'asc' | 'desc' = 'desc',
    @Query('excludeSelf') excludeSelf?: string,
    @Query('minCategoryOverlap') minCategoryOverlap?: number,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.debug(`Getting related content for answer: ${id}`);

      const options = {
        nodeTypes: nodeTypes
          ? (nodeTypes.split(',') as (
              | 'statement'
              | 'answer'
              | 'openquestion'
              | 'quantity'
            )[])
          : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : 0,
        sortBy,
        sortDirection,
        excludeSelf: excludeSelf === 'true',
        minCategoryOverlap: minCategoryOverlap
          ? Number(minCategoryOverlap)
          : undefined,
      };

      const relatedContent =
        await this.answerService.getRelatedContentBySharedCategories(
          id,
          options,
        );

      return { relatedContent };
    } catch (error) {
      this.handleError(
        error,
        `Error getting related content for answer: ${id}`,
      );
    }
  }

  @Get(':id/categories')
  async getAnswerCategories(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.debug(`Getting categories for answer: ${id}`);

      const categories = await this.answerService.getAnswerCategories(id);

      return { categories };
    } catch (error) {
      this.handleError(error, `Error getting categories for answer: ${id}`);
    }
  }

  // DISCUSSION AND COMMENT ENDPOINTS - Following consistent patterns

  @Get(':id/discussion')
  async getAnswerWithDiscussion(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.log(`Getting answer with discussion: ${id}`);

      const answer = await this.answerService.getAnswerWithDiscussion(id);

      return answer;
    } catch (error) {
      this.handleError(error, `Error retrieving answer with discussion: ${id}`);
    }
  }

  @Get(':id/comments')
  async getAnswerComments(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.log(`Getting comments for answer: ${id}`);

      const result = await this.answerService.getAnswerComments(id);

      return result;
    } catch (error) {
      this.handleError(error, `Error retrieving comments for answer: ${id}`);
    }
  }

  @Post(':id/comments')
  async addAnswerComment(
    @Param('id') id: string,
    @Body() commentData: AddCommentDto,
    @Request() req: any,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      if (!commentData.commentText || commentData.commentText.trim() === '') {
        throw new BadRequestException('Comment text is required');
      }

      this.logger.log(`Adding comment to answer: ${id}`);

      const comment = await this.answerService.addAnswerComment(
        id,
        commentData,
        req.user.sub,
      );

      return comment;
    } catch (error) {
      this.handleError(error, `Error adding comment to answer: ${id}`);
    }
  }

  // UTILITY ENDPOINTS

  @Get(':id/approved')
  async isAnswerApproved(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.debug(`Checking approval status for answer: ${id}`);

      const isApproved = await this.answerService.isAnswerApproved(id);

      return { isApproved };
    } catch (error) {
      this.handleError(error, `Error checking approval for answer: ${id}`);
    }
  }

  @Get(':id/content-voting')
  async isContentVotingAvailable(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.debug(
        `Checking content voting availability for answer: ${id}`,
      );

      const isAvailable = await this.answerService.isContentVotingAvailable(id);

      return { contentVotingAvailable: isAvailable };
    } catch (error) {
      this.handleError(
        error,
        `Error checking content voting availability for answer: ${id}`,
      );
    }
  }

  @Get(':id/stats')
  async getAnswerStats(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.debug(`Getting answer stats for: ${id}`);

      const stats = await this.answerService.getAnswerStats(id);

      return stats;
    } catch (error) {
      this.handleError(error, `Error getting answer stats: ${id}`);
    }
  }

  // PRIVATE HELPER METHODS - Following consistent patterns

  /**
   * Centralized error handling
   */
  private handleError(error: any, context: string): never {
    this.logger.error(`${context}: ${error.message}`, error.stack);

    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    // Log the full error for debugging while throwing a generic message
    throw new HttpException(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An internal server error occurred',
        error: 'Internal Server Error',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
