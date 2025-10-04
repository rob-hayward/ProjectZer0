// src/nodes/definition/definition.controller.ts - REFACTORED TO SCHEMA ARCHITECTURE

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
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { DefinitionService } from './definition.service';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

/**
 * DTOs for Definition endpoints
 */
interface CreateDefinitionDto {
  word: string;
  createdBy: string;
  definitionText: string;
  publicCredit?: boolean;
  initialComment?: string;
  isApiDefinition?: boolean;
  isAICreated?: boolean;
}

interface UpdateDefinitionDto {
  definitionText?: string;
  publicCredit?: boolean;
}

interface VoteDto {
  isPositive: boolean;
}

/**
 * DefinitionController - HTTP layer for definition operations
 *
 * ARCHITECTURE:
 * - All endpoints delegate to DefinitionService
 * - DTOs for input validation
 * - Proper HTTP status codes
 * - Authentication via JWT guards
 * - User ID extracted from req.user.sub
 *
 * RESPONSIBILITIES:
 * ✅ Handle HTTP request/response
 * ✅ Input validation via DTOs
 * ✅ Apply authentication guards
 * ✅ Return proper HTTP status codes
 * ✅ Extract user info from request
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Business logic (that's DefinitionService)
 * ❌ Database operations (that's DefinitionSchema)
 * ❌ Calling schemas directly
 */
@Controller('definitions')
@UseGuards(JwtAuthGuard)
export class DefinitionController {
  private readonly logger = new Logger(DefinitionController.name);

  constructor(private readonly definitionService: DefinitionService) {}

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  /**
   * Create a new definition
   * POST /definitions
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDefinition(
    @Body() createDto: CreateDefinitionDto,
    @Request() req: any,
  ) {
    // Validate required fields
    if (!createDto.word || createDto.word.trim() === '') {
      throw new BadRequestException('Word is required');
    }

    if (!createDto.definitionText || createDto.definitionText.trim() === '') {
      throw new BadRequestException('Definition text is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Creating definition for word: ${createDto.word}`);

    const createdDefinition = await this.definitionService.createDefinition({
      word: createDto.word,
      createdBy: req.user.sub,
      definitionText: createDto.definitionText,
      publicCredit: createDto.publicCredit,
      initialComment: createDto.initialComment,
      isApiDefinition: createDto.isApiDefinition,
      isAICreated: createDto.isAICreated,
    });

    this.logger.debug(
      `Created definition: ${JSON.stringify(createdDefinition)}`,
    );
    return createdDefinition;
  }

  /**
   * Get a single definition by ID
   * GET /definitions/:id
   */
  @Get(':id')
  async getDefinition(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    this.logger.debug(`Getting definition: ${id}`);

    const definition = await this.definitionService.getDefinition(id);

    if (!definition) {
      this.logger.debug(`Definition not found: ${id}`);
      throw new NotFoundException(`Definition with ID ${id} not found`);
    }

    return definition;
  }

  /**
   * Update a definition
   * PUT /definitions/:id
   */
  @Put(':id')
  async updateDefinition(
    @Param('id') id: string,
    @Body() updateDto: UpdateDefinitionDto,
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Updating definition: ${id} with data: ${JSON.stringify(updateDto)}`,
    );

    const updatedDefinition = await this.definitionService.updateDefinition(
      id,
      updateDto,
    );

    this.logger.debug(
      `Updated definition: ${JSON.stringify(updatedDefinition)}`,
    );
    return updatedDefinition;
  }

  /**
   * Delete a definition
   * DELETE /definitions/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDefinition(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Deleting definition: ${id}`);
    await this.definitionService.deleteDefinition(id);
    this.logger.debug(`Deleted definition: ${id}`);
  }

  // ============================================
  // VOTING ENDPOINTS
  // ============================================

  /**
   * Vote on definition inclusion
   * POST /definitions/:id/vote-inclusion
   */
  @Post(':id/vote-inclusion')
  async voteInclusion(
    @Param('id') id: string,
    @Body() voteDto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof voteDto.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    this.logger.debug(
      `Voting on definition inclusion: ${id} with value: ${voteDto.isPositive}`,
    );

    const result = await this.definitionService.voteInclusion(
      id,
      req.user.sub,
      voteDto.isPositive,
    );

    this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Vote on definition content (quality)
   * POST /definitions/:id/vote-content
   */
  @Post(':id/vote-content')
  async voteContent(
    @Param('id') id: string,
    @Body() voteDto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof voteDto.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    this.logger.debug(
      `Voting on definition content: ${id} with value: ${voteDto.isPositive}`,
    );

    const result = await this.definitionService.voteContent(
      id,
      req.user.sub,
      voteDto.isPositive,
    );

    this.logger.debug(`Content vote result: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Get vote status for current user
   * GET /definitions/:id/vote-status
   */
  @Get(':id/vote-status')
  async getVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Getting vote status for definition: ${id}`);

    const status = await this.definitionService.getVoteStatus(id, req.user.sub);
    this.logger.debug(`Vote status: ${JSON.stringify(status)}`);
    return status;
  }

  /**
   * Remove inclusion vote from a definition
   * DELETE /definitions/:id/vote-inclusion
   */
  @Delete(':id/vote-inclusion')
  async removeInclusionVote(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Removing inclusion vote from definition: ${id}`);

    const result = await this.definitionService.removeVote(
      id,
      req.user.sub,
      'INCLUSION',
    );

    this.logger.debug(`Remove vote result: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Remove content vote from a definition
   * DELETE /definitions/:id/vote-content
   */
  @Delete(':id/vote-content')
  async removeContentVote(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Removing content vote from definition: ${id}`);

    const result = await this.definitionService.removeVote(
      id,
      req.user.sub,
      'CONTENT',
    );

    this.logger.debug(`Remove vote result: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Get vote totals for a definition
   * GET /definitions/:id/votes
   */
  @Get(':id/votes')
  async getVotes(@Param('id') id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    this.logger.debug(`Getting votes for definition: ${id}`);

    const votes = await this.definitionService.getVotes(id);
    this.logger.debug(`Votes: ${JSON.stringify(votes)}`);
    return votes;
  }

  // ============================================
  // QUERY ENDPOINTS
  // ============================================

  /**
   * Get all definitions for a word
   * GET /definitions/word/:word
   */
  @Get('word/:word')
  async getDefinitionsByWord(@Param('word') word: string) {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    this.logger.debug(`Getting definitions for word: ${word}`);

    const definitions = await this.definitionService.getDefinitionsByWord(word);
    return { definitions };
  }

  /**
   * Get top-rated definition for a word
   * GET /definitions/word/:word/top
   */
  @Get('word/:word/top')
  async getTopDefinitionForWord(@Param('word') word: string) {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    this.logger.debug(`Getting top definition for word: ${word}`);

    const definition =
      await this.definitionService.getTopDefinitionForWord(word);

    if (!definition) {
      throw new NotFoundException(
        `No approved definition found for word: ${word}`,
      );
    }

    return definition;
  }

  /**
   * Check if a word can have definitions created
   * GET /definitions/word/:word/can-create
   */
  @Get('word/:word/can-create')
  async canCreateDefinitionForWord(
    @Param('word') word: string,
  ): Promise<{ canCreate: boolean }> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    this.logger.debug(
      `Checking if definitions can be created for word: ${word}`,
    );

    const canCreate =
      await this.definitionService.canCreateDefinitionForWord(word);
    return { canCreate };
  }
}
