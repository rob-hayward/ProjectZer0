// src/nodes/openquestion/openquestion.controller.ts

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
import { OpenQuestionService } from './openquestion.service';
import type { VoteResult } from '../../neo4j/schemas/vote.schema';

// Define DTOs for better type safety - Following consistent patterns
interface CreateOpenQuestionDto {
  questionText: string;
  publicCredit: boolean;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment: string;
}

interface UpdateOpenQuestionDto {
  questionText?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
}

interface VoteOpenQuestionDto {
  isPositive: boolean;
}

interface VisibilityDto {
  isVisible: boolean;
}

interface AddCommentDto {
  commentText: string;
  parentCommentId?: string;
}

// NEW: DTO for Answer creation via OpenQuestion
interface CreateAnswerDto {
  answerText: string;
  publicCredit: boolean;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment: string;
}

@Controller('nodes/openquestion')
@UseGuards(JwtAuthGuard)
export class OpenQuestionController {
  private readonly logger = new Logger(OpenQuestionController.name);

  constructor(private readonly openQuestionService: OpenQuestionService) {}

  // NETWORK AND LISTING ENDPOINTS

  @Get('network')
  async getOpenQuestionNetwork(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy') sortBy = 'netPositive',
    @Query('sortDirection') sortDirection = 'desc',
    @Query('keyword') keywords?: string[],
    @Query('userId') userId?: string,
  ): Promise<any[]> {
    this.logger.log(
      `Received request to get open question network with params: ${JSON.stringify(
        {
          limit,
          offset,
          sortBy,
          sortDirection,
          keywords,
          userId,
        },
      )}`,
    );

    return await this.openQuestionService.getOpenQuestionNetwork({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      sortBy,
      sortDirection,
      keywords,
      userId,
    });
  }

  // CRUD OPERATIONS - Following consistent patterns

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOpenQuestion(
    @Body() questionData: CreateOpenQuestionDto,
    @Request() req: any,
  ) {
    try {
      this.logger.log(`Creating open question from user ${req.user.sub}`);

      // Validate required fields
      if (
        !questionData.questionText ||
        questionData.questionText.trim() === ''
      ) {
        throw new BadRequestException('Question text is required');
      }

      if (typeof questionData.publicCredit !== 'boolean') {
        throw new BadRequestException('Public credit flag is required');
      }

      if (
        !questionData.initialComment ||
        questionData.initialComment.trim() === ''
      ) {
        throw new BadRequestException('Initial comment is required');
      }

      const result = await this.openQuestionService.createOpenQuestion({
        ...questionData,
        createdBy: req.user.sub, // Use authenticated user ID from JWT
      });

      this.logger.log(
        `Successfully created open question with ID: ${result.id}`,
      );
      return result;
    } catch (error) {
      this.handleError(error, `Error creating open question`);
    }
  }

  @Get(':id')
  async getOpenQuestion(
    @Param('id') id: string,
    @Query('includeDiscussion') includeDiscussion?: string,
    @Query('includeAnswers') includeAnswers?: string,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Retrieving open question: ${id}`);

      const options = {
        includeDiscussion: includeDiscussion === 'true',
        includeAnswers: includeAnswers === 'true',
      };

      const question = await this.openQuestionService.getOpenQuestion(
        id,
        options,
      );

      this.logger.debug(
        `Retrieved open question: ${question.questionText.substring(0, 50)}...`,
      );
      return question;
    } catch (error) {
      this.handleError(error, `Error retrieving open question: ${id}`);
    }
  }

  @Put(':id')
  async updateOpenQuestion(
    @Param('id') id: string,
    @Body() updateData: UpdateOpenQuestionDto,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.log(`Updating open question: ${id}`);

      const result = await this.openQuestionService.updateOpenQuestion(
        id,
        updateData,
      );

      this.logger.log(`Successfully updated open question: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `Error updating open question: ${id}`);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOpenQuestion(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.log(`Deleting open question: ${id}`);

      await this.openQuestionService.deleteOpenQuestion(id);

      this.logger.log(`Successfully deleted open question: ${id}`);
    } catch (error) {
      this.handleError(error, `Error deleting open question: ${id}`);
    }
  }

  // VOTING ENDPOINTS - INCLUSION ONLY (OpenQuestions don't have content voting)

  @Post(':id/vote/inclusion')
  async voteOpenQuestionInclusion(
    @Param('id') id: string,
    @Body() voteData: VoteOpenQuestionDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      if (typeof voteData.isPositive !== 'boolean') {
        throw new BadRequestException(
          'Vote direction (isPositive) is required',
        );
      }

      this.logger.log(
        `Processing inclusion vote on open question ${id}: ${voteData.isPositive ? 'positive' : 'negative'}`,
      );

      const result = await this.openQuestionService.voteOpenQuestionInclusion(
        id,
        req.user.sub,
        voteData.isPositive,
      );

      return result;
    } catch (error) {
      this.handleError(error, `Error voting on open question inclusion: ${id}`);
    }
  }

  @Get(':id/vote')
  async getOpenQuestionVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting vote status for open question: ${id}`);

      const voteStatus =
        await this.openQuestionService.getOpenQuestionVoteStatus(
          id,
          req.user.sub,
        );

      return { voteStatus };
    } catch (error) {
      this.handleError(
        error,
        `Error getting vote status for open question: ${id}`,
      );
    }
  }

  @Delete(':id/vote')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOpenQuestionVote(@Param('id') id: string, @Request() req: any) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.log(`Removing vote from open question: ${id}`);

      await this.openQuestionService.removeOpenQuestionVote(id, req.user.sub);
    } catch (error) {
      this.handleError(error, `Error removing vote from open question: ${id}`);
    }
  }

  @Get(':id/votes')
  async getOpenQuestionVotes(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting vote counts for open question: ${id}`);

      const votes = await this.openQuestionService.getOpenQuestionVotes(id);

      return { votes };
    } catch (error) {
      this.handleError(error, `Error getting votes for open question: ${id}`);
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
        throw new BadRequestException('Open question ID is required');
      }

      if (typeof visibilityData.isVisible !== 'boolean') {
        throw new BadRequestException(
          'Visibility status (isVisible) is required',
        );
      }

      this.logger.log(
        `Setting visibility for open question ${id} to ${visibilityData.isVisible}`,
      );

      const result = await this.openQuestionService.setVisibilityStatus(
        id,
        visibilityData.isVisible,
      );

      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error setting visibility for open question: ${id}`,
      );
    }
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting visibility status for open question: ${id}`);

      const status = await this.openQuestionService.getVisibilityStatus(id);

      return { visibilityStatus: status };
    } catch (error) {
      this.handleError(
        error,
        `Error getting visibility status for open question: ${id}`,
      );
    }
  }

  // NEW: ANSWER INTEGRATION ENDPOINTS - Replacing Statement-based workflow

  @Post(':id/answers')
  @HttpCode(HttpStatus.CREATED)
  async createAnswerForQuestion(
    @Param('id') questionId: string,
    @Body() answerData: CreateAnswerDto,
    @Request() req: any,
  ) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Question ID is required');
      }

      if (!answerData.answerText || answerData.answerText.trim() === '') {
        throw new BadRequestException('Answer text is required');
      }

      if (typeof answerData.publicCredit !== 'boolean') {
        throw new BadRequestException('Public credit flag is required');
      }

      if (
        !answerData.initialComment ||
        answerData.initialComment.trim() === ''
      ) {
        throw new BadRequestException('Initial comment is required');
      }

      this.logger.log(`Creating answer for question: ${questionId}`);

      const result = await this.openQuestionService.createAnswerForQuestion(
        questionId,
        answerData,
        req.user.sub,
      );

      this.logger.log(`Successfully created answer with ID: ${result.id}`);
      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error creating answer for question: ${questionId}`,
      );
    }
  }

  @Get(':id/answers')
  async getQuestionAnswers(
    @Param('id') questionId: string,
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

      this.logger.debug(`Getting answers for question: ${questionId}`);

      const options = {
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : 0,
        sortBy,
        sortDirection,
        onlyApproved: onlyApproved === 'true',
      };

      const answers = await this.openQuestionService.getQuestionAnswers(
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

  @Get(':id/with-answers')
  async getQuestionWithAnswers(@Param('id') questionId: string) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Question ID is required');
      }

      this.logger.debug(`Getting question with answers: ${questionId}`);

      const questionWithAnswers =
        await this.openQuestionService.getQuestionWithAnswers(questionId);

      return questionWithAnswers;
    } catch (error) {
      this.handleError(
        error,
        `Error getting question with answers: ${questionId}`,
      );
    }
  }

  // DISCOVERY ENDPOINTS - New functionality following established patterns

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
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting related content for open question: ${id}`);

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
        await this.openQuestionService.getRelatedContentBySharedCategories(
          id,
          options,
        );

      return { relatedContent };
    } catch (error) {
      this.handleError(
        error,
        `Error getting related content for open question: ${id}`,
      );
    }
  }

  @Get(':id/categories')
  async getOpenQuestionCategories(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting categories for open question: ${id}`);

      const categories =
        await this.openQuestionService.getOpenQuestionCategories(id);

      return { categories };
    } catch (error) {
      this.handleError(
        error,
        `Error getting categories for open question: ${id}`,
      );
    }
  }

  // DISCUSSION AND COMMENT ENDPOINTS - Following consistent patterns

  @Get(':id/discussion')
  async getOpenQuestionWithDiscussion(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.log(`Getting open question with discussion: ${id}`);

      const question =
        await this.openQuestionService.getOpenQuestionWithDiscussion(id);

      return question;
    } catch (error) {
      this.handleError(
        error,
        `Error retrieving open question with discussion: ${id}`,
      );
    }
  }

  @Get(':id/comments')
  async getOpenQuestionComments(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.log(`Getting comments for open question: ${id}`);

      const result = await this.openQuestionService.getOpenQuestionComments(id);

      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error retrieving comments for open question: ${id}`,
      );
    }
  }

  @Post(':id/comments')
  async addOpenQuestionComment(
    @Param('id') id: string,
    @Body() commentData: AddCommentDto,
    @Request() req: any,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      if (!commentData.commentText || commentData.commentText.trim() === '') {
        throw new BadRequestException('Comment text is required');
      }

      this.logger.log(`Adding comment to open question: ${id}`);

      const comment = await this.openQuestionService.addOpenQuestionComment(
        id,
        commentData,
        req.user.sub,
      );

      return comment;
    } catch (error) {
      this.handleError(error, `Error adding comment to open question: ${id}`);
    }
  }

  // QUESTION RELATIONSHIP ENDPOINTS

  @Post(':id/related')
  @HttpCode(HttpStatus.CREATED)
  async createRelatedQuestion(
    @Param('id') existingQuestionId: string,
    @Body() questionData: CreateOpenQuestionDto,
    @Request() req: any,
  ) {
    try {
      if (!existingQuestionId || existingQuestionId.trim() === '') {
        throw new BadRequestException('Existing question ID is required');
      }

      this.logger.log(`Creating related question to: ${existingQuestionId}`);

      const result = await this.openQuestionService.createRelatedQuestion(
        existingQuestionId,
        {
          ...questionData,
          createdBy: req.user.sub,
        },
      );

      this.logger.log(
        `Successfully created related question with ID: ${result.id}`,
      );
      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error creating related question to: ${existingQuestionId}`,
      );
    }
  }

  @Post(':id1/relationship/:id2')
  async createDirectRelationship(
    @Param('id1') id1: string,
    @Param('id2') id2: string,
  ) {
    try {
      if (!id1 || !id2) {
        throw new BadRequestException('Both question IDs are required');
      }

      this.logger.log(
        `Creating relationship between questions ${id1} and ${id2}`,
      );

      const result = await this.openQuestionService.createDirectRelationship(
        id1,
        id2,
      );

      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error creating relationship between questions ${id1} and ${id2}`,
      );
    }
  }

  @Delete(':id1/relationship/:id2')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDirectRelationship(
    @Param('id1') id1: string,
    @Param('id2') id2: string,
  ) {
    try {
      if (!id1 || !id2) {
        throw new BadRequestException('Both question IDs are required');
      }

      this.logger.log(
        `Removing relationship between questions ${id1} and ${id2}`,
      );

      await this.openQuestionService.removeDirectRelationship(id1, id2);
    } catch (error) {
      this.handleError(
        error,
        `Error removing relationship between questions ${id1} and ${id2}`,
      );
    }
  }

  @Get(':id/direct-relationships')
  async getDirectlyRelatedQuestions(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting directly related questions for: ${id}`);

      const relatedQuestions =
        await this.openQuestionService.getDirectlyRelatedQuestions(id);

      return { relatedQuestions };
    } catch (error) {
      this.handleError(
        error,
        `Error getting directly related questions for: ${id}`,
      );
    }
  }

  // UTILITY ENDPOINTS

  @Get(':id/approved')
  async isOpenQuestionApproved(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Checking approval status for open question: ${id}`);

      const isApproved =
        await this.openQuestionService.isOpenQuestionApproved(id);

      return { isApproved };
    } catch (error) {
      this.handleError(
        error,
        `Error checking approval for open question: ${id}`,
      );
    }
  }

  @Get(':id/stats')
  async getOpenQuestionStats(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting open question stats for: ${id}`);

      const stats = await this.openQuestionService.getOpenQuestionStats(id);

      return stats;
    } catch (error) {
      this.handleError(error, `Error getting open question stats: ${id}`);
    }
  }

  @Get('check')
  async checkOpenQuestions(): Promise<{ count: number }> {
    try {
      this.logger.debug('Received request to check open questions count');
      return await this.openQuestionService.checkOpenQuestions();
    } catch (error) {
      this.handleError(error, 'Error checking open questions count');
    }
  }

  // PRIVATE HELPER METHODS

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
