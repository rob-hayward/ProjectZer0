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
}
