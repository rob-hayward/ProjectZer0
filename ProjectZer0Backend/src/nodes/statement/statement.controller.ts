// src/nodes/statement/statement.controller.ts

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
import { StatementService } from './statement.service';
import type { VoteResult } from '../../neo4j/schemas/vote.schema';

// Define DTOs for better type safety - Following consistent patterns
interface CreateStatementDto {
  statement: string;
  publicCredit: boolean;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment: string;
}

interface UpdateStatementDto {
  statement?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
}

interface VoteStatementDto {
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

@Controller('nodes/statement')
@UseGuards(JwtAuthGuard)
export class StatementController {
  private readonly logger = new Logger(StatementController.name);

  constructor(private readonly statementService: StatementService) {}

  // NETWORK AND LISTING ENDPOINTS

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

    return await this.statementService.getStatementNetwork({
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
  async createStatement(
    @Body() statementData: CreateStatementDto,
    @Request() req: any,
  ) {
    try {
      this.logger.log(`Creating statement from user ${req.user.sub}`);

      // Validate required fields
      if (!statementData.statement || statementData.statement.trim() === '') {
        throw new BadRequestException('Statement text is required');
      }

      if (typeof statementData.publicCredit !== 'boolean') {
        throw new BadRequestException('Public credit flag is required');
      }

      if (
        !statementData.initialComment ||
        statementData.initialComment.trim() === ''
      ) {
        throw new BadRequestException('Initial comment is required');
      }

      const result = await this.statementService.createStatement({
        ...statementData,
        createdBy: req.user.sub, // Use authenticated user ID from JWT
      });

      this.logger.log(`Successfully created statement with ID: ${result.id}`);
      return result;
    } catch (error) {
      this.handleError(error, `Error creating statement`);
    }
  }

  @Get(':id')
  async getStatement(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Retrieving statement: ${id}`);

      const statement = await this.statementService.getStatement(id);

      this.logger.debug(
        `Retrieved statement: ${statement.statement.substring(0, 50)}...`,
      );
      return statement;
    } catch (error) {
      this.handleError(error, `Error retrieving statement: ${id}`);
    }
  }

  @Put(':id')
  async updateStatement(
    @Param('id') id: string,
    @Body() updateData: UpdateStatementDto,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.log(`Updating statement: ${id}`);

      const result = await this.statementService.updateStatement(
        id,
        updateData,
      );

      this.logger.log(`Successfully updated statement: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `Error updating statement: ${id}`);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteStatement(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.log(`Deleting statement: ${id}`);

      await this.statementService.deleteStatement(id);

      this.logger.log(`Successfully deleted statement: ${id}`);
    } catch (error) {
      this.handleError(error, `Error deleting statement: ${id}`);
    }
  }

  // VOTING ENDPOINTS - DUAL VOTING (INCLUSION + CONTENT)

  @Post(':id/vote/inclusion')
  async voteStatementInclusion(
    @Param('id') id: string,
    @Body() voteData: VoteStatementDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      if (typeof voteData.isPositive !== 'boolean') {
        throw new BadRequestException(
          'Vote direction (isPositive) is required',
        );
      }

      this.logger.log(
        `Processing inclusion vote on statement ${id}: ${voteData.isPositive ? 'positive' : 'negative'}`,
      );

      const result = await this.statementService.voteStatementInclusion(
        id,
        req.user.sub,
        voteData.isPositive,
      );

      return result;
    } catch (error) {
      this.handleError(error, `Error voting on statement inclusion: ${id}`);
    }
  }

  @Post(':id/vote/content')
  async voteStatementContent(
    @Param('id') id: string,
    @Body() voteData: VoteStatementDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      if (typeof voteData.isPositive !== 'boolean') {
        throw new BadRequestException(
          'Vote direction (isPositive) is required',
        );
      }

      this.logger.log(
        `Processing content vote on statement ${id}: ${voteData.isPositive ? 'positive' : 'negative'}`,
      );

      const result = await this.statementService.voteStatementContent(
        id,
        req.user.sub,
        voteData.isPositive,
      );

      return result;
    } catch (error) {
      this.handleError(error, `Error voting on statement content: ${id}`);
    }
  }

  @Get(':id/vote')
  async getStatementVoteStatus(@Param('id') id: string, @Request() req: any) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting vote status for statement: ${id}`);

      const voteStatus = await this.statementService.getStatementVoteStatus(
        id,
        req.user.sub,
      );

      return { voteStatus };
    } catch (error) {
      this.handleError(error, `Error getting vote status for statement: ${id}`);
    }
  }

  @Delete(':id/vote')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeStatementVote(
    @Param('id') id: string,
    @Body() removeVoteData: RemoveVoteDto,
    @Request() req: any,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      const kind = removeVoteData.kind || 'INCLUSION';
      this.logger.log(`Removing ${kind} vote from statement: ${id}`);

      await this.statementService.removeStatementVote(id, req.user.sub, kind);
    } catch (error) {
      this.handleError(error, `Error removing vote from statement: ${id}`);
    }
  }

  @Get(':id/votes')
  async getStatementVotes(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting vote counts for statement: ${id}`);

      const votes = await this.statementService.getStatementVotes(id);

      return { votes };
    } catch (error) {
      this.handleError(error, `Error getting votes for statement: ${id}`);
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
        throw new BadRequestException('Statement ID is required');
      }

      if (typeof visibilityData.isVisible !== 'boolean') {
        throw new BadRequestException(
          'Visibility status (isVisible) is required',
        );
      }

      this.logger.log(
        `Setting visibility for statement ${id} to ${visibilityData.isVisible}`,
      );

      const result = await this.statementService.setVisibilityStatus(
        id,
        visibilityData.isVisible,
      );

      return result;
    } catch (error) {
      this.handleError(error, `Error setting visibility for statement: ${id}`);
    }
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting visibility status for statement: ${id}`);

      const status = await this.statementService.getVisibilityStatus(id);

      return { visibilityStatus: status };
    } catch (error) {
      this.handleError(
        error,
        `Error getting visibility status for statement: ${id}`,
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
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting related content for statement: ${id}`);

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
        await this.statementService.getRelatedContentBySharedCategories(
          id,
          options,
        );

      return { relatedContent };
    } catch (error) {
      this.handleError(
        error,
        `Error getting related content for statement: ${id}`,
      );
    }
  }

  @Get(':id/categories')
  async getStatementCategories(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting categories for statement: ${id}`);

      const categories = await this.statementService.getStatementCategories(id);

      return { categories };
    } catch (error) {
      this.handleError(error, `Error getting categories for statement: ${id}`);
    }
  }

  // DISCUSSION AND COMMENT ENDPOINTS - Following consistent patterns

  @Get(':id/discussion')
  async getStatementWithDiscussion(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.log(`Getting statement with discussion: ${id}`);

      const statement =
        await this.statementService.getStatementWithDiscussion(id);

      return statement;
    } catch (error) {
      this.handleError(
        error,
        `Error retrieving statement with discussion: ${id}`,
      );
    }
  }

  @Get(':id/comments')
  async getStatementComments(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.log(`Getting comments for statement: ${id}`);

      const result = await this.statementService.getStatementComments(id);

      return result;
    } catch (error) {
      this.handleError(error, `Error retrieving comments for statement: ${id}`);
    }
  }

  @Post(':id/comments')
  async addStatementComment(
    @Param('id') id: string,
    @Body() commentData: AddCommentDto,
    @Request() req: any,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      if (!commentData.commentText || commentData.commentText.trim() === '') {
        throw new BadRequestException('Comment text is required');
      }

      this.logger.log(`Adding comment to statement: ${id}`);

      const comment = await this.statementService.addStatementComment(
        id,
        commentData,
        req.user.sub,
      );

      return comment;
    } catch (error) {
      this.handleError(error, `Error adding comment to statement: ${id}`);
    }
  }

  // STATEMENT RELATIONSHIP ENDPOINTS

  @Post(':id/related')
  @HttpCode(HttpStatus.CREATED)
  async createRelatedStatement(
    @Param('id') existingStatementId: string,
    @Body() statementData: CreateStatementDto,
    @Request() req: any,
  ) {
    try {
      if (!existingStatementId || existingStatementId.trim() === '') {
        throw new BadRequestException('Existing statement ID is required');
      }

      this.logger.log(`Creating related statement to: ${existingStatementId}`);

      const result = await this.statementService.createRelatedStatement(
        existingStatementId,
        {
          ...statementData,
          createdBy: req.user.sub,
        },
      );

      this.logger.log(
        `Successfully created related statement with ID: ${result.id}`,
      );
      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error creating related statement to: ${existingStatementId}`,
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
        throw new BadRequestException('Both statement IDs are required');
      }

      this.logger.log(
        `Creating relationship between statements ${id1} and ${id2}`,
      );

      const result = await this.statementService.createDirectRelationship(
        id1,
        id2,
      );

      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error creating relationship between statements ${id1} and ${id2}`,
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
        throw new BadRequestException('Both statement IDs are required');
      }

      this.logger.log(
        `Removing relationship between statements ${id1} and ${id2}`,
      );

      await this.statementService.removeDirectRelationship(id1, id2);
    } catch (error) {
      this.handleError(
        error,
        `Error removing relationship between statements ${id1} and ${id2}`,
      );
    }
  }

  @Get(':id/direct-relationships')
  async getDirectlyRelatedStatements(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting directly related statements for: ${id}`);

      const relatedStatements =
        await this.statementService.getDirectlyRelatedStatements(id);

      return { relatedStatements };
    } catch (error) {
      this.handleError(
        error,
        `Error getting directly related statements for: ${id}`,
      );
    }
  }

  // UTILITY ENDPOINTS

  @Get(':id/approved')
  async isStatementApproved(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Checking approval status for statement: ${id}`);

      const isApproved = await this.statementService.isStatementApproved(id);

      return { isApproved };
    } catch (error) {
      this.handleError(error, `Error checking approval for statement: ${id}`);
    }
  }

  @Get(':id/content-voting')
  async isContentVotingAvailable(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(
        `Checking content voting availability for statement: ${id}`,
      );

      const isAvailable =
        await this.statementService.isContentVotingAvailable(id);

      return { contentVotingAvailable: isAvailable };
    } catch (error) {
      this.handleError(
        error,
        `Error checking content voting availability for statement: ${id}`,
      );
    }
  }

  @Get(':id/stats')
  async getStatementStats(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting statement stats for: ${id}`);

      const stats = await this.statementService.getStatementStats(id);

      return stats;
    } catch (error) {
      this.handleError(error, `Error getting statement stats: ${id}`);
    }
  }

  @Get('check')
  async checkStatements(): Promise<{ count: number }> {
    try {
      this.logger.debug('Received request to check statements count');
      return await this.statementService.checkStatements();
    } catch (error) {
      this.handleError(error, 'Error checking statements count');
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
