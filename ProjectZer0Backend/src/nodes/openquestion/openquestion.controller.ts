// src/nodes/openquestion/openquestion.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  Request,
  Query,
  HttpStatus,
  HttpCode,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { OpenQuestionService } from './openquestion.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';

@Controller('nodes/openquestion')
@UseGuards(JwtAuthGuard)
export class OpenQuestionController {
  private readonly logger = new Logger(OpenQuestionController.name);

  constructor(
    private readonly openQuestionService: OpenQuestionService,
    private readonly discussionService: DiscussionService,
    private readonly commentService: CommentService,
  ) {}

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

    // Get the questions from the service
    return await this.openQuestionService.getOpenQuestionNetwork({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      sortBy,
      sortDirection,
      keywords,
      userId,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOpenQuestion(@Body() questionData: any, @Request() req: any) {
    this.logger.log(
      `Received request to create open question from user ${req.user.sub}`,
    );

    // Validate required fields
    if (!questionData.questionText || questionData.questionText.trim() === '') {
      throw new BadRequestException('Question text is required');
    }

    if (typeof questionData.publicCredit !== 'boolean') {
      throw new BadRequestException('publicCredit must be a boolean value');
    }

    return this.openQuestionService.createOpenQuestion({
      ...questionData,
      createdBy: req.user.sub, // Use the authenticated user's ID from JWT
    });
  }

  @Get(':id')
  async getOpenQuestion(@Param('id') id: string) {
    this.logger.debug(`Received request to get open question ${id}`);

    if (!id) {
      throw new BadRequestException('Open question ID is required');
    }

    return this.openQuestionService.getOpenQuestion(id);
  }

  @Put(':id')
  async updateOpenQuestion(@Param('id') id: string, @Body() updateData: any) {
    this.logger.log(`Received request to update open question ${id}`);

    if (!id) {
      throw new BadRequestException('Open question ID is required');
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update data provided');
    }

    return this.openQuestionService.updateOpenQuestion(id, updateData);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOpenQuestion(@Param('id') id: string) {
    this.logger.log(`Received request to delete open question ${id}`);

    if (!id) {
      throw new BadRequestException('Open question ID is required');
    }

    return this.openQuestionService.deleteOpenQuestion(id);
  }

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: { isVisible: boolean },
  ) {
    this.logger.log(
      `Received request to set visibility for open question ${id}: ${visibilityData.isVisible}`,
    );

    if (!id) {
      throw new BadRequestException('Open question ID is required');
    }

    if (typeof visibilityData.isVisible !== 'boolean') {
      throw new BadRequestException('isVisible must be a boolean value');
    }

    return this.openQuestionService.setVisibilityStatus(
      id,
      visibilityData.isVisible,
    );
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    this.logger.debug(
      `Received request to get visibility status for open question ${id}`,
    );

    if (!id) {
      throw new BadRequestException('Open question ID is required');
    }

    return this.openQuestionService.getVisibilityStatus(id);
  }

  @Post(':id/vote')
  async voteOpenQuestion(
    @Param('id') id: string,
    @Body() voteData: { isPositive: boolean },
    @Request() req: any,
  ) {
    this.logger.log(
      `Received request to vote on open question ${id}: ${voteData.isPositive}`,
    );

    if (!id) {
      throw new BadRequestException('Open question ID is required');
    }

    if (typeof voteData.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean value');
    }

    return await this.openQuestionService.voteOpenQuestion(
      id,
      req.user.sub,
      voteData.isPositive,
    );
  }

  @Get(':id/vote')
  async getOpenQuestionVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    this.logger.debug(
      `Received request to get vote status for open question ${id} by user ${req.user.sub}`,
    );

    if (!id) {
      throw new BadRequestException('Open question ID is required');
    }

    return await this.openQuestionService.getOpenQuestionVoteStatus(
      id,
      req.user.sub,
    );
  }

  @Post(':id/vote/remove')
  async removeOpenQuestionVote(@Param('id') id: string, @Request() req: any) {
    this.logger.log(
      `Received request to remove vote from open question ${id} by user ${req.user.sub}`,
    );

    if (!id) {
      throw new BadRequestException('Open question ID is required');
    }

    return await this.openQuestionService.removeOpenQuestionVote(
      id,
      req.user.sub,
    );
  }

  @Get(':id/votes')
  async getOpenQuestionVotes(@Param('id') id: string) {
    this.logger.debug(`Received request to get votes for open question ${id}`);

    if (!id) {
      throw new BadRequestException('Open question ID is required');
    }

    return await this.openQuestionService.getOpenQuestionVotes(id);
  }

  // Discussion and comment endpoints for open questions
  @Get(':id/discussion')
  async getOpenQuestionWithDiscussion(@Param('id') id: string) {
    this.logger.debug(
      `Received request to get open question ${id} with discussion`,
    );

    if (!id) {
      throw new BadRequestException('Open question ID is required');
    }

    const question = await this.openQuestionService.getOpenQuestion(id);

    if (!question) {
      throw new NotFoundException(`Open question with ID ${id} not found`);
    }

    return question; // The getOpenQuestion method already includes discussion info
  }

  @Get(':id/comments')
  async getOpenQuestionComments(@Param('id') id: string) {
    this.logger.debug(
      `Received request to get comments for open question ${id}`,
    );

    if (!id) {
      throw new BadRequestException('Open question ID is required');
    }

    const question = await this.openQuestionService.getOpenQuestion(id);

    if (!question) {
      throw new NotFoundException(`Open question with ID ${id} not found`);
    }

    if (!question.discussionId) {
      return { comments: [] };
    }

    const comments = await this.commentService.getCommentsByDiscussionId(
      question.discussionId,
    );
    return { comments };
  }

  @Post(':id/comments')
  async addOpenQuestionComment(
    @Param('id') id: string,
    @Body() commentData: { commentText: string; parentCommentId?: string },
    @Request() req: any,
  ) {
    this.logger.log(`Received request to add comment to open question ${id}`);

    if (!id) {
      throw new BadRequestException('Open question ID is required');
    }

    if (!commentData.commentText || commentData.commentText.trim() === '') {
      throw new BadRequestException('Comment text is required');
    }

    const question = await this.openQuestionService.getOpenQuestion(id);

    if (!question) {
      throw new NotFoundException(`Open question with ID ${id} not found`);
    }

    // Discussion should already exist from question creation
    const discussionId = question.discussionId;

    if (!discussionId) {
      throw new Error(
        `Open question ${id} is missing its discussion - this should not happen`,
      );
    }

    // Create the comment
    const comment = await this.commentService.createComment({
      createdBy: req.user.sub,
      discussionId,
      commentText: commentData.commentText,
      parentCommentId: commentData.parentCommentId,
    });

    return comment;
  }

  /**
   * Create an open question directly related to an existing question
   */
  @Post(':id/related')
  @HttpCode(HttpStatus.CREATED)
  async createRelatedQuestion(
    @Param('id') existingId: string,
    @Body() questionData: any,
    @Request() req: any,
  ) {
    this.logger.log(
      `Received request to create question related to ${existingId}`,
    );

    if (!existingId) {
      throw new BadRequestException('Existing question ID is required');
    }

    if (!questionData.questionText || questionData.questionText.trim() === '') {
      throw new BadRequestException('Question text is required');
    }

    return this.openQuestionService.createRelatedQuestion(existingId, {
      ...questionData,
      createdBy: req.user.sub, // Use the authenticated user's ID from JWT
    });
  }

  /**
   * Create a direct relationship between two existing questions
   */
  @Post(':id1/relationship/:id2')
  async createDirectRelationship(
    @Param('id1') id1: string,
    @Param('id2') id2: string,
  ) {
    this.logger.log(
      `Received request to create relationship between questions ${id1} and ${id2}`,
    );

    if (!id1 || !id2) {
      throw new BadRequestException('Both question IDs are required');
    }

    if (id1 === id2) {
      throw new BadRequestException(
        'Cannot create relationship between a question and itself',
      );
    }

    return this.openQuestionService.createDirectRelationship(id1, id2);
  }

  /**
   * Remove a direct relationship between two questions
   */
  @Delete(':id1/relationship/:id2')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDirectRelationship(
    @Param('id1') id1: string,
    @Param('id2') id2: string,
  ) {
    this.logger.log(
      `Received request to remove relationship between questions ${id1} and ${id2}`,
    );

    if (!id1 || !id2) {
      throw new BadRequestException('Both question IDs are required');
    }

    return this.openQuestionService.removeDirectRelationship(id1, id2);
  }

  /**
   * Get all questions directly related to the given question
   */
  @Get(':id/related')
  async getDirectlyRelatedQuestions(@Param('id') id: string) {
    this.logger.debug(`Received request to get questions related to ${id}`);

    if (!id) {
      throw new BadRequestException('Question ID is required');
    }

    return this.openQuestionService.getDirectlyRelatedQuestions(id);
  }

  /**
   * Create a statement that answers this open question
   */
  @Post(':id/answers')
  @HttpCode(HttpStatus.CREATED)
  async createAnswerStatement(
    @Param('id') questionId: string,
    @Body() answerData: any,
    @Request() req: any,
  ) {
    this.logger.log(
      `Received request to create answer for question ${questionId}`,
    );

    if (!questionId) {
      throw new BadRequestException('Question ID is required');
    }

    if (!answerData.statement || answerData.statement.trim() === '') {
      throw new BadRequestException('Statement text is required');
    }

    if (typeof answerData.publicCredit !== 'boolean') {
      throw new BadRequestException('publicCredit must be a boolean value');
    }

    return this.openQuestionService.createAnswerStatement(questionId, {
      ...answerData,
      createdBy: req.user.sub, // Use the authenticated user's ID from JWT
    });
  }

  /**
   * Link an existing statement as an answer to this question
   */
  @Post(':questionId/answers/:statementId/link')
  async linkExistingAnswerToQuestion(
    @Param('questionId') questionId: string,
    @Param('statementId') statementId: string,
  ) {
    this.logger.log(
      `Received request to link statement ${statementId} to question ${questionId}`,
    );

    if (!questionId) {
      throw new BadRequestException('Question ID is required');
    }

    if (!statementId) {
      throw new BadRequestException('Statement ID is required');
    }

    return this.openQuestionService.linkExistingAnswerToQuestion(
      questionId,
      statementId,
    );
  }

  /**
   * Unlink a statement from this question
   */
  @Delete(':questionId/answers/:statementId/unlink')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkAnswerFromQuestion(
    @Param('questionId') questionId: string,
    @Param('statementId') statementId: string,
  ) {
    this.logger.log(
      `Received request to unlink statement ${statementId} from question ${questionId}`,
    );

    if (!questionId) {
      throw new BadRequestException('Question ID is required');
    }

    if (!statementId) {
      throw new BadRequestException('Statement ID is required');
    }

    return this.openQuestionService.unlinkAnswerFromQuestion(
      questionId,
      statementId,
    );
  }

  /**
   * Get all statements that answer this question
   */
  @Get(':id/answers')
  async getQuestionAnswers(@Param('id') questionId: string) {
    this.logger.debug(
      `Received request to get answers for question ${questionId}`,
    );

    if (!questionId) {
      throw new BadRequestException('Question ID is required');
    }

    return this.openQuestionService.getQuestionAnswers(questionId);
  }

  @Get('check')
  async checkOpenQuestions(): Promise<{ count: number }> {
    this.logger.debug('Received request to check open questions count');
    return this.openQuestionService.checkOpenQuestions();
  }
}
