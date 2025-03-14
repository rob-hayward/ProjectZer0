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
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

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
    return this.statementService.getStatementNetwork({
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
    this.logger.log(`Received request to get statement: ${id}`);
    return this.statementService.getStatement(id);
  }

  @Put(':id')
  async updateStatement(
    @Param('id') id: string,
    @Body() updateData: UpdateStatementDto,
  ) {
    this.logger.log(`Received request to update statement: ${id}`);
    return this.statementService.updateStatement(id, updateData);
  }

  @Delete(':id')
  async deleteStatement(@Param('id') id: string) {
    this.logger.log(`Received request to delete statement: ${id}`);
    return this.statementService.deleteStatement(id);
  }

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: { isVisible: boolean },
  ) {
    this.logger.log(`Received request to set statement visibility: ${id}`);
    return this.statementService.setVisibilityStatus(
      id,
      visibilityData.isVisible,
    );
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    this.logger.log(`Received request to get statement visibility: ${id}`);
    return this.statementService.getVisibilityStatus(id);
  }

  @Post(':id/vote')
  async voteStatement(
    @Param('id') id: string,
    @Body() voteData: { isPositive: boolean },
    @Request() req: any,
  ): Promise<VoteResult> {
    this.logger.log(
      `Received request to vote on statement: ${id} with data: ${JSON.stringify(voteData, null, 2)}`,
    );
    const result = await this.statementService.voteStatement(
      id,
      req.user.sub,
      voteData.isPositive,
    );
    this.logger.log(`Vote result: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  @Get(':id/vote')
  async getStatementVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    this.logger.log(
      `Received request to get vote status for statement: ${id} from user: ${req.user.sub}`,
    );
    const status = await this.statementService.getStatementVoteStatus(
      id,
      req.user.sub,
    );
    this.logger.log(
      `Vote status for statement ${id}: ${JSON.stringify(status, null, 2)}`,
    );
    return status;
  }

  @Post(':id/vote/remove')
  async removeStatementVote(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    this.logger.log(
      `Received request to remove vote for statement: ${id} from user: ${req.user.sub}`,
    );
    const result = await this.statementService.removeStatementVote(
      id,
      req.user.sub,
    );
    this.logger.log(`Remove vote result: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  @Get(':id/votes')
  async getStatementVotes(@Param('id') id: string): Promise<VoteResult | null> {
    this.logger.log(`Received request to get votes for statement: ${id}`);
    const votes = await this.statementService.getStatementVotes(id);
    this.logger.log(
      `Votes for statement ${id}: ${JSON.stringify(votes, null, 2)}`,
    );
    return votes;
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
    this.logger.log(
      `Received request to create statement related to ${existingId}`,
    );
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
      `Received request to create relationship between ${id1} and ${id2}`,
    );
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
    this.logger.log(
      `Received request to remove relationship between ${id1} and ${id2}`,
    );
    return this.statementService.removeDirectRelationship(id1, id2);
  }

  /**
   * Get all statements directly related to the given statement
   */
  @Get(':id/related')
  async getDirectlyRelatedStatements(@Param('id') id: string) {
    this.logger.log(
      `Received request to get statements directly related to ${id}`,
    );
    return this.statementService.getDirectlyRelatedStatements(id);
  }

  @Get('check')
  async checkStatements(): Promise<{ count: number }> {
    this.logger.log('Received request to check if statements exist');
    return this.statementService.checkStatements();
  }
}
