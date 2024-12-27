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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { DefinitionService } from './definition.service';

@Controller('definitions')
@UseGuards(JwtAuthGuard)
export class DefinitionController {
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
    return this.definitionService.createDefinition(definitionData);
  }

  @Get(':id')
  async getDefinition(@Param('id') id: string) {
    return this.definitionService.getDefinition(id);
  }

  @Put(':id')
  async updateDefinition(
    @Param('id') id: string,
    @Body() updateData: { definitionText: string },
  ) {
    return this.definitionService.updateDefinition(id, updateData);
  }

  @Delete(':id')
  async deleteDefinition(@Param('id') id: string) {
    return this.definitionService.deleteDefinition(id);
  }

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: { isVisible: boolean },
  ) {
    return this.definitionService.setVisibilityStatus(
      id,
      visibilityData.isVisible,
    );
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    return this.definitionService.getVisibilityStatus(id);
  }

  @Post(':id/vote')
  async voteDefinition(
    @Param('id') id: string,
    @Request() req,
    @Body() voteData: { vote: 'agree' | 'disagree' },
  ) {
    return this.definitionService.voteDefinition(
      id,
      req.user.sub,
      voteData.vote,
    );
  }

  @Get(':id/vote')
  async getDefinitionVote(@Param('id') id: string, @Request() req) {
    return this.definitionService.getDefinitionVote(id, req.user.sub);
  }
}
