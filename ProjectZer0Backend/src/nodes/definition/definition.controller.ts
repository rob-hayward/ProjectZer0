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
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { DefinitionService } from './definition.service';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';
import { TEXT_LIMITS } from '../../constants/validation';

// Define DTOs for better type safety
interface CreateDefinitionDto {
  word: string;
  createdBy: string;
  definitionText: string;
}

interface UpdateDefinitionDto {
  definitionText: string;
}

interface VoteDefinitionDto {
  isPositive: boolean;
}

interface VisibilityDto {
  isVisible: boolean;
}

@Controller('definitions')
@UseGuards(JwtAuthGuard)
export class DefinitionController {
  private readonly logger = new Logger(DefinitionController.name);

  constructor(private readonly definitionService: DefinitionService) {}

  @Post()
  async createDefinition(@Body() definitionData: CreateDefinitionDto) {
    try {
      // Validate data
      if (!definitionData.word || definitionData.word.trim() === '') {
        throw new BadRequestException('Word is required');
      }

      if (!definitionData.createdBy || definitionData.createdBy.trim() === '') {
        throw new BadRequestException('Creator ID is required');
      }

      if (
        !definitionData.definitionText ||
        definitionData.definitionText.trim() === ''
      ) {
        throw new BadRequestException('Definition text is required');
      }

      if (
        definitionData.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH
      ) {
        throw new BadRequestException(
          `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`,
        );
      }

      this.logger.log(`Creating definition for word: ${definitionData.word}`);
      const result =
        await this.definitionService.createDefinition(definitionData);
      this.logger.log(`Successfully created definition with ID: ${result.id}`);
      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error creating definition for word: ${definitionData.word}`,
      );
    }
  }

  @Get(':id')
  async getDefinition(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Definition ID is required');
      }

      this.logger.log(`Getting definition: ${id}`);
      const definition = await this.definitionService.getDefinition(id);
      return definition;
    } catch (error) {
      this.handleError(error, `Error retrieving definition: ${id}`);
    }
  }

  @Put(':id')
  async updateDefinition(
    @Param('id') id: string,
    @Body() updateData: UpdateDefinitionDto,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Definition ID is required');
      }

      if (
        !updateData.definitionText ||
        updateData.definitionText.trim() === ''
      ) {
        throw new BadRequestException('Definition text is required');
      }

      if (
        updateData.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH
      ) {
        throw new BadRequestException(
          `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`,
        );
      }

      this.logger.log(`Updating definition: ${id}`);
      const result = await this.definitionService.updateDefinition(
        id,
        updateData,
      );
      this.logger.log(`Successfully updated definition: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `Error updating definition: ${id}`);
    }
  }

  @Delete(':id')
  async deleteDefinition(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Definition ID is required');
      }

      this.logger.log(`Deleting definition: ${id}`);
      const result = await this.definitionService.deleteDefinition(id);
      this.logger.log(`Successfully deleted definition: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `Error deleting definition: ${id}`);
    }
  }

  @Post(':id/vote')
  async voteDefinition(
    @Param('id') id: string,
    @Body() voteData: VoteDefinitionDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Definition ID is required');
      }

      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User authentication is required');
      }

      if (voteData.isPositive === undefined) {
        throw new BadRequestException('Vote value (isPositive) is required');
      }

      this.logger.log(
        `Received request to vote on definition: ${id} with data: ${JSON.stringify(voteData)}`,
      );

      const result = await this.definitionService.voteDefinition(
        id,
        req.user.sub,
        voteData.isPositive,
      );

      this.logger.log(`Successfully processed vote on definition: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `Error processing vote on definition: ${id}`);
    }
  }

  @Get(':id/vote')
  async getDefinitionVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Definition ID is required');
      }

      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User authentication is required');
      }

      this.logger.log(
        `Getting vote status for definition: ${id} from user: ${req.user.sub}`,
      );

      const status = await this.definitionService.getDefinitionVoteStatus(
        id,
        req.user.sub,
      );

      return status;
    } catch (error) {
      this.handleError(
        error,
        `Error getting vote status for definition: ${id}`,
      );
    }
  }

  @Post(':id/vote/remove')
  async removeDefinitionVote(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Definition ID is required');
      }

      if (!req.user || !req.user.sub) {
        throw new BadRequestException('User authentication is required');
      }

      this.logger.log(
        `Removing vote for definition: ${id} from user: ${req.user.sub}`,
      );

      const result = await this.definitionService.removeDefinitionVote(
        id,
        req.user.sub,
      );

      this.logger.log(`Successfully removed vote for definition: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `Error removing vote for definition: ${id}`);
    }
  }

  @Get(':id/votes')
  async getDefinitionVotes(
    @Param('id') id: string,
  ): Promise<VoteResult | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Definition ID is required');
      }

      this.logger.log(`Getting votes for definition: ${id}`);
      const votes = await this.definitionService.getDefinitionVotes(id);
      return votes;
    } catch (error) {
      this.handleError(error, `Error getting votes for definition: ${id}`);
    }
  }

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: VisibilityDto,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Definition ID is required');
      }

      if (visibilityData.isVisible === undefined) {
        throw new BadRequestException('Visibility status is required');
      }

      this.logger.log(
        `Setting visibility for definition ${id}: ${visibilityData.isVisible}`,
      );

      const result = await this.definitionService.setVisibilityStatus(
        id,
        visibilityData.isVisible,
      );

      this.logger.log(`Successfully updated visibility for definition: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `Error setting visibility for definition: ${id}`);
    }
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Definition ID is required');
      }

      this.logger.log(`Getting visibility status for definition: ${id}`);
      const status = await this.definitionService.getVisibilityStatus(id);
      return { visibilityStatus: status };
    } catch (error) {
      this.handleError(
        error,
        `Error getting visibility status for definition: ${id}`,
      );
    }
  }

  // Helper method to standardize error handling
  private handleError(error: any, logMessage: string): never {
    if (error instanceof BadRequestException) {
      this.logger.warn(`${logMessage}: ${error.message}`);
      throw error;
    }

    if (error instanceof NotFoundException) {
      this.logger.warn(`${logMessage}: ${error.message}`);
      throw error;
    }

    // For other types of errors
    this.logger.error(`${logMessage}: ${error.message}`, error.stack);

    throw new HttpException(
      error.message || 'An unexpected error occurred',
      error.status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
