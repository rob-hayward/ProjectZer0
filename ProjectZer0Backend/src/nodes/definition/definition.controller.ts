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
  Logger, // Added Logger
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { DefinitionService } from './definition.service';

@Controller('definitions')
@UseGuards(JwtAuthGuard)
export class DefinitionController {
  private readonly logger = new Logger(DefinitionController.name); // Added logger

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

  @Post(':id/vote')
  async voteDefinition(
    @Param('id') id: string,
    @Request() req,
    @Body() voteData: { vote: 'agree' | 'disagree' },
  ) {
    this.logger.log(
      `Vote request for definition ${id} by user ${req.user.sub}: ${voteData.vote}`,
    );
    return this.definitionService.voteDefinition(
      id,
      req.user.sub,
      voteData.vote,
    );
  }

  @Get(':id/vote')
  async getDefinitionVote(@Param('id') id: string, @Request() req) {
    this.logger.log(
      `Getting vote status for definition ${id} by user ${req.user.sub}`,
    );
    return this.definitionService.getDefinitionVote(id, req.user.sub);
  }
}
