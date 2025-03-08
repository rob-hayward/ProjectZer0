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
import { StatementService } from './statement.service';

@Controller('nodes/statement')
@UseGuards(JwtAuthGuard)
export class StatementController {
  constructor(private readonly statementService: StatementService) {}

  @Post()
  async createStatement(@Body() statementData: any) {
    return this.statementService.createStatement(statementData);
  }

  @Get(':id')
  async getStatement(@Param('id') id: string) {
    return this.statementService.getStatement(id);
  }

  @Put(':id')
  async updateStatement(@Param('id') id: string, @Body() updateData: any) {
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
}
