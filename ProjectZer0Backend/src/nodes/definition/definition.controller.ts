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
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { DefinitionService } from './definition.service';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

@Controller('definitions')
@UseGuards(JwtAuthGuard)
export class DefinitionController {
  private readonly logger = new Logger(DefinitionController.name);

  constructor(private readonly definitionService: DefinitionService) {}

  @Post()
  async createDefinition(
    @Body()
    definitionData: {
      word: string;
      createdBy: string;
      definitionText: string;
    },
  ) {
    this.logger.log(`Creating definition: ${JSON.stringify(definitionData)}`);
    return this.definitionService.createDefinition(definitionData);
  }

  @Get(':id')
  async getDefinition(@Param('id') id: string) {
    this.logger.log(`Getting definition: ${id}`);
    return this.definitionService.getDefinition(id);
  }

  @Put(':id')
  async updateDefinition(
    @Param('id') id: string,
    @Body() updateData: { definitionText: string },
  ) {
    this.logger.log(`Updating definition ${id}: ${JSON.stringify(updateData)}`);
    return this.definitionService.updateDefinition(id, updateData);
  }

  @Delete(':id')
  async deleteDefinition(@Param('id') id: string) {
    this.logger.log(`Deleting definition: ${id}`);
    return this.definitionService.deleteDefinition(id);
  }

  @Post(':id/vote')
  async voteDefinition(
    @Param('id') id: string,
    @Body() voteData: { isPositive: boolean },
    @Request() req: any,
  ): Promise<VoteResult> {
    this.logger.log(
      `Received request to vote on definition: ${id} with data: ${JSON.stringify(voteData, null, 2)}`,
    );
    const result = await this.definitionService.voteDefinition(
      id,
      req.user.sub,
      voteData.isPositive,
    );
    this.logger.log(`Vote result: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  @Get(':id/vote')
  async getDefinitionVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    this.logger.log(
      `Getting vote status for definition: ${id} from user: ${req.user.sub}`,
    );
    const status = await this.definitionService.getDefinitionVoteStatus(
      id,
      req.user.sub,
    );
    this.logger.log(
      `Vote status for definition ${id}: ${JSON.stringify(status, null, 2)}`,
    );
    return status;
  }

  @Post(':id/vote/remove')
  async removeDefinitionVote(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    this.logger.log(
      `Removing vote for definition: ${id} from user: ${req.user.sub}`,
    );
    const result = await this.definitionService.removeDefinitionVote(
      id,
      req.user.sub,
    );
    this.logger.log(`Remove vote result: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  @Get(':id/votes')
  async getDefinitionVotes(
    @Param('id') id: string,
  ): Promise<VoteResult | null> {
    this.logger.log(`Getting votes for definition: ${id}`);
    const votes = await this.definitionService.getDefinitionVotes(id);
    this.logger.log(
      `Votes for definition ${id}: ${JSON.stringify(votes, null, 2)}`,
    );
    return votes;
  }

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: { isVisible: boolean },
  ) {
    this.logger.log(
      `Setting visibility for definition ${id}: ${visibilityData.isVisible}`,
    );
    return this.definitionService.setVisibilityStatus(
      id,
      visibilityData.isVisible,
    );
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    this.logger.log(`Getting visibility status for definition: ${id}`);
    return this.definitionService.getVisibilityStatus(id);
  }
}
