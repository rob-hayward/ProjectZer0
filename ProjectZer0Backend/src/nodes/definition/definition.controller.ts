import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
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
}
