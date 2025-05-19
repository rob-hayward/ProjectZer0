// src/nodes/statement/statement.controller.ts
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
import { StatementService } from './statement.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';

@Controller('nodes/statement')
@UseGuards(JwtAuthGuard)
export class StatementController {
  private readonly logger = new Logger(StatementController.name);

  constructor(
    private readonly statementService: StatementService,
    private readonly discussionService: DiscussionService,
    private readonly commentService: CommentService,
  ) {}

  @Get('network')
  async getStatementNetwork(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy') sortBy = 'netPositive',
    @Query('sortDirection') sortDirection = 'desc',
    @Query('keyword') keywords?: string[],
    @Query('userId') userId?: string,
  ): Promise<any[]> {
    this.logger.log(
      `Received request to get statement network with params: ${JSON.stringify({
        limit,
        offset,
        sortBy,
        sortDirection,
        keywords,
        userId,
      })}`,
    );

    // Get the statements from the service
    return await this.statementService.getStatementNetwork({
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
  async createStatement(@Body() statementData: any, @Request() req: any) {
    this.logger.log(
      `Received request to create statement from user ${req.user.sub}`,
    );

    // Validate required fields
    if (!statementData.statement || statementData.statement.trim() === '') {
      throw new BadRequestException('Statement text is required');
    }

    if (typeof statementData.publicCredit !== 'boolean') {
      throw new BadRequestException('publicCredit must be a boolean value');
    }

    return this.statementService.createStatement({
      ...statementData,
      createdBy: req.user.sub, // Use the authenticated user's ID from JWT
    });
  }

  @Get(':id')
  async getStatement(@Param('id') id: string) {
    this.logger.debug(`Received request to get statement ${id}`);

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    return this.statementService.getStatement(id);
  }

  @Put(':id')
  async updateStatement(@Param('id') id: string, @Body() updateData: any) {
    this.logger.log(`Received request to update statement ${id}`);

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update data provided');
    }

    return this.statementService.updateStatement(id, updateData);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteStatement(@Param('id') id: string) {
    this.logger.log(`Received request to delete statement ${id}`);

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    return this.statementService.deleteStatement(id);
  }

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: { isVisible: boolean },
  ) {
    this.logger.log(
      `Received request to set visibility for statement ${id}: ${visibilityData.isVisible}`,
    );

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    if (typeof visibilityData.isVisible !== 'boolean') {
      throw new BadRequestException('isVisible must be a boolean value');
    }

    return this.statementService.setVisibilityStatus(
      id,
      visibilityData.isVisible,
    );
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    this.logger.debug(
      `Received request to get visibility status for statement ${id}`,
    );

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    return this.statementService.getVisibilityStatus(id);
  }

  @Post(':id/vote')
  async voteStatement(
    @Param('id') id: string,
    @Body() voteData: { isPositive: boolean },
    @Request() req: any,
  ) {
    this.logger.log(
      `Received request to vote on statement ${id}: ${voteData.isPositive}`,
    );

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    if (typeof voteData.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean value');
    }

    return await this.statementService.voteStatement(
      id,
      req.user.sub,
      voteData.isPositive,
    );
  }

  @Get(':id/vote')
  async getStatementVoteStatus(@Param('id') id: string, @Request() req: any) {
    this.logger.debug(
      `Received request to get vote status for statement ${id} by user ${req.user.sub}`,
    );

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    return await this.statementService.getStatementVoteStatus(id, req.user.sub);
  }

  @Post(':id/vote/remove')
  async removeStatementVote(@Param('id') id: string, @Request() req: any) {
    this.logger.log(
      `Received request to remove vote from statement ${id} by user ${req.user.sub}`,
    );

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    return await this.statementService.removeStatementVote(id, req.user.sub);
  }

  @Get(':id/votes')
  async getStatementVotes(@Param('id') id: string) {
    this.logger.debug(`Received request to get votes for statement ${id}`);

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    return await this.statementService.getStatementVotes(id);
  }

  // ADDED: Discussion and comment endpoints for statements
  @Get(':id/discussion')
  async getStatementWithDiscussion(@Param('id') id: string) {
    this.logger.debug(
      `Received request to get statement ${id} with discussion`,
    );

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    const statement = await this.statementService.getStatement(id);

    if (!statement) {
      throw new NotFoundException(`Statement with ID ${id} not found`);
    }

    return statement; // The getStatement method already includes discussion info
  }

  @Get(':id/comments')
  async getStatementComments(@Param('id') id: string) {
    this.logger.debug(`Received request to get comments for statement ${id}`);

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    const statement = await this.statementService.getStatement(id);

    if (!statement) {
      throw new NotFoundException(`Statement with ID ${id} not found`);
    }

    if (!statement.discussionId) {
      return { comments: [] };
    }

    const comments = await this.commentService.getCommentsByDiscussionId(
      statement.discussionId,
    );
    return { comments };
  }

  @Post(':id/comments')
  async addStatementComment(
    @Param('id') id: string,
    @Body() commentData: { commentText: string; parentCommentId?: string },
    @Request() req: any,
  ) {
    this.logger.log(`Received request to add comment to statement ${id}`);

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    if (!commentData.commentText || commentData.commentText.trim() === '') {
      throw new BadRequestException('Comment text is required');
    }

    const statement = await this.statementService.getStatement(id);

    if (!statement) {
      throw new NotFoundException(`Statement with ID ${id} not found`);
    }

    // Discussion should already exist from statement creation
    const discussionId = statement.discussionId;

    if (!discussionId) {
      throw new Error(
        `Statement ${id} is missing its discussion - this should not happen`,
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
   * Create a statement directly related to an existing statement
   */
  @Post(':id/related')
  @HttpCode(HttpStatus.CREATED)
  async createRelatedStatement(
    @Param('id') existingId: string,
    @Body() statementData: any,
    @Request() req: any,
  ) {
    this.logger.log(
      `Received request to create statement related to ${existingId}`,
    );

    if (!existingId) {
      throw new BadRequestException('Existing statement ID is required');
    }

    if (!statementData.statement || statementData.statement.trim() === '') {
      throw new BadRequestException('Statement text is required');
    }

    return this.statementService.createRelatedStatement(existingId, {
      ...statementData,
      createdBy: req.user.sub, // Use the authenticated user's ID from JWT
    });
  }

  /**
   * Create a direct relationship between two existing statements
   */
  @Post(':id1/relationship/:id2')
  async createDirectRelationship(
    @Param('id1') id1: string,
    @Param('id2') id2: string,
  ) {
    this.logger.log(
      `Received request to create relationship between statements ${id1} and ${id2}`,
    );

    if (!id1 || !id2) {
      throw new BadRequestException('Both statement IDs are required');
    }

    if (id1 === id2) {
      throw new BadRequestException(
        'Cannot create relationship between a statement and itself',
      );
    }

    return this.statementService.createDirectRelationship(id1, id2);
  }

  /**
   * Remove a direct relationship between two statements
   */
  @Delete(':id1/relationship/:id2')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDirectRelationship(
    @Param('id1') id1: string,
    @Param('id2') id2: string,
  ) {
    this.logger.log(
      `Received request to remove relationship between statements ${id1} and ${id2}`,
    );

    if (!id1 || !id2) {
      throw new BadRequestException('Both statement IDs are required');
    }

    return this.statementService.removeDirectRelationship(id1, id2);
  }

  /**
   * Get all statements directly related to the given statement
   */
  @Get(':id/related')
  async getDirectlyRelatedStatements(@Param('id') id: string) {
    this.logger.debug(`Received request to get statements related to ${id}`);

    if (!id) {
      throw new BadRequestException('Statement ID is required');
    }

    return this.statementService.getDirectlyRelatedStatements(id);
  }

  @Get('check')
  async checkStatements(): Promise<{ count: number }> {
    this.logger.debug('Received request to check statements count');
    return this.statementService.checkStatements();
  }
}
