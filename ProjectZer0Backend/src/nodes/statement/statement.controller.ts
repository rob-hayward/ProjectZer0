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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { StatementService } from './statement.service';

// Define DTO for statement creation
interface CreateStatementDto {
  publicCredit: boolean;
  statement: string;
  userKeywords?: string[];
  initialComment: string;
}

// Define DTO for statement update
interface UpdateStatementDto {
  statement?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
}

@Controller('nodes/statement')
@UseGuards(JwtAuthGuard)
export class StatementController {
  private readonly logger = new Logger(StatementController.name);

  constructor(private readonly statementService: StatementService) {}

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
  async createStatement(
    @Body() statementData: CreateStatementDto,
    @Request() req: any,
  ) {
    this.logger.log(`Received request to create statement`);
    return this.statementService.createStatement({
      ...statementData,
      createdBy: req.user.sub, // Use the authenticated user's ID from JWT
    });
  }

  @Get(':id')
  async getStatement(@Param('id') id: string) {
    return this.statementService.getStatement(id);
  }

  @Put(':id')
  async updateStatement(
    @Param('id') id: string,
    @Body() updateData: UpdateStatementDto,
  ) {
    return this.statementService.updateStatement(id, updateData);
  }

  @Delete(':id')
  async deleteStatement(@Param('id') id: string) {
    return this.statementService.deleteStatement(id);
  }

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: { isVisible: boolean },
  ) {
    return this.statementService.setVisibilityStatus(
      id,
      visibilityData.isVisible,
    );
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    return this.statementService.getVisibilityStatus(id);
  }

  @Post(':id/vote')
  async voteStatement(
    @Param('id') id: string,
    @Body() voteData: { isPositive: boolean },
    @Request() req: any,
  ) {
    return await this.statementService.voteStatement(
      id,
      req.user.sub,
      voteData.isPositive,
    );
  }

  @Get(':id/vote')
  async getStatementVoteStatus(@Param('id') id: string, @Request() req: any) {
    return await this.statementService.getStatementVoteStatus(id, req.user.sub);
  }

  @Post(':id/vote/remove')
  async removeStatementVote(@Param('id') id: string, @Request() req: any) {
    return await this.statementService.removeStatementVote(id, req.user.sub);
  }

  @Get(':id/votes')
  async getStatementVotes(@Param('id') id: string) {
    return await this.statementService.getStatementVotes(id);
  }

  /**
   * Create a statement directly related to an existing statement
   */
  @Post(':id/related')
  async createRelatedStatement(
    @Param('id') existingId: string,
    @Body() statementData: CreateStatementDto,
    @Request() req: any,
  ) {
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
    return this.statementService.createDirectRelationship(id1, id2);
  }

  /**
   * Remove a direct relationship between two statements
   */
  @Delete(':id1/relationship/:id2')
  async removeDirectRelationship(
    @Param('id1') id1: string,
    @Param('id2') id2: string,
  ) {
    return this.statementService.removeDirectRelationship(id1, id2);
  }

  /**
   * Get all statements directly related to the given statement
   */
  @Get(':id/related')
  async getDirectlyRelatedStatements(@Param('id') id: string) {
    return this.statementService.getDirectlyRelatedStatements(id);
  }

  @Get('check')
  async checkStatements(): Promise<{ count: number }> {
    return this.statementService.checkStatements();
  }
}
