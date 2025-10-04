// src/nodes/word/word.controller.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { WordService } from './word.service';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

/**
 * DTOs for Word endpoints
 */
interface CreateWordDto {
  word: string;
  createdBy: string;
  publicCredit?: boolean;
  initialDefinition?: string;
  initialComment?: string;
  isApiDefinition?: boolean;
  isAICreated?: boolean;
}

interface UpdateWordDto {
  publicCredit?: boolean;
  // Add other updatable fields as needed
}

interface VoteDto {
  isPositive: boolean;
}

/**
 * WordController - HTTP layer for word operations
 *
 * ARCHITECTURE:
 * - All endpoints delegate to WordService
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
 * ❌ Business logic (that's WordService)
 * ❌ Database operations (that's WordSchema)
 * ❌ Calling schemas directly
 */
@Controller('words')
@UseGuards(JwtAuthGuard)
export class WordController {
  private readonly logger = new Logger(WordController.name);

  constructor(private readonly wordService: WordService) {}

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  /**
   * Create a new word
   * POST /words
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWord(@Body() createDto: CreateWordDto, @Request() req: any) {
    // Validate required fields
    if (!createDto.word || createDto.word.trim() === '') {
      throw new BadRequestException('Word is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Creating word: ${createDto.word}`);

    try {
      const createdWord = await this.wordService.createWord({
        word: createDto.word,
        createdBy: req.user.sub,
        publicCredit: createDto.publicCredit,
        initialDefinition: createDto.initialDefinition,
        initialComment: createDto.initialComment,
        isApiDefinition: createDto.isApiDefinition,
        isAICreated: createDto.isAICreated,
      });

      this.logger.debug(`Created word: ${JSON.stringify(createdWord)}`);
      return createdWord;
    } catch (error) {
      this.logger.error(`Error creating word: ${error.message}`, error.stack);
      throw error; // Re-throw to let NestJS handle it
    }
  }

  /**
   * Get a single word by its word value
   * GET /words/:word
   */
  @Get(':word')
  async getWord(@Param('word') word: string, @Request() req: any) {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    this.logger.debug(`Getting word: ${word}`);

    // Get user ID for visibility context (optional for anonymous access)
    const userId = req.user?.sub;

    const fetchedWord = await this.wordService.getWordWithVisibility(
      word.toLowerCase(),
      userId,
    );

    if (!fetchedWord) {
      this.logger.debug(`Word not found: ${word}`);
      throw new NotFoundException(`Word '${word}' not found`);
    }

    return fetchedWord;
  }

  /**
   * Update a word
   * PUT /words/:word
   */
  @Put(':word')
  async updateWord(
    @Param('word') word: string,
    @Body() updateDto: UpdateWordDto,
    @Request() req: any,
  ) {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Updating word: ${word} with data: ${JSON.stringify(updateDto)}`,
    );

    const updatedWord = await this.wordService.updateWord(word, updateDto);
    this.logger.debug(`Updated word: ${JSON.stringify(updatedWord)}`);
    return updatedWord;
  }

  /**
   * Delete a word
   * DELETE /words/:word
   */
  @Delete(':word')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWord(@Param('word') word: string, @Request() req: any) {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Deleting word: ${word}`);
    await this.wordService.deleteWord(word);
    this.logger.debug(`Deleted word: ${word}`);
  }

  // ============================================
  // VOTING ENDPOINTS
  // ============================================

  /**
   * Vote on word inclusion
   * POST /words/:word/vote-inclusion
   */
  @Post(':word/vote-inclusion')
  async voteInclusion(
    @Param('word') word: string,
    @Body() voteDto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof voteDto.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    this.logger.debug(
      `Voting on word inclusion: ${word} with value: ${voteDto.isPositive}`,
    );

    const result = await this.wordService.voteInclusion(
      word,
      req.user.sub,
      voteDto.isPositive,
    );

    this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Get vote status for current user
   * GET /words/:word/vote-status
   */
  @Get(':word/vote-status')
  async getVoteStatus(
    @Param('word') word: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Getting vote status for word: ${word}`);

    const status = await this.wordService.getVoteStatus(word, req.user.sub);
    this.logger.debug(`Vote status: ${JSON.stringify(status)}`);
    return status;
  }

  /**
   * Remove vote from a word
   * DELETE /words/:word/vote
   */
  @Delete(':word/vote')
  async removeVote(
    @Param('word') word: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Removing vote from word: ${word}`);

    const result = await this.wordService.removeVote(word, req.user.sub);
    this.logger.debug(`Remove vote result: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Get vote totals for a word
   * GET /words/:word/votes
   */
  @Get(':word/votes')
  async getVotes(@Param('word') word: string): Promise<VoteResult | null> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    this.logger.debug(`Getting votes for word: ${word}`);

    const votes = await this.wordService.getVotes(word);
    this.logger.debug(`Votes: ${JSON.stringify(votes)}`);
    return votes;
  }

  // ============================================
  // VISIBILITY ENDPOINTS
  // ============================================

  /**
   * Set visibility preference for a word
   * POST /words/:word/visibility
   */
  @Post(':word/visibility')
  async setVisibilityPreference(
    @Param('word') word: string,
    @Body() visibilityDto: { isVisible: boolean },
    @Request() req: any,
  ) {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof visibilityDto.isVisible !== 'boolean') {
      throw new BadRequestException('isVisible must be a boolean');
    }

    this.logger.debug(
      `Setting visibility preference for word ${word}: ${visibilityDto.isVisible}`,
    );

    await this.wordService.setVisibilityPreference(
      req.user.sub,
      word,
      visibilityDto.isVisible,
    );

    return { success: true };
  }

  /**
   * Get visibility status for a word
   * GET /words/:word/visibility
   */
  @Get(':word/visibility')
  async getVisibility(
    @Param('word') word: string,
    @Request() req: any,
  ): Promise<{ isVisible: boolean }> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    // User ID is optional for anonymous access
    const userId = req.user?.sub;

    this.logger.debug(
      `Getting visibility for word ${word} and user ${userId || 'anonymous'}`,
    );

    const isVisible = await this.wordService.getVisibilityForUser(word, userId);
    return { isVisible };
  }

  // ============================================
  // QUERY ENDPOINTS
  // ============================================

  /**
   * Check if a word exists
   * GET /words/check/:word
   */
  @Get('check/:word')
  async checkWordExistence(
    @Param('word') word: string,
  ): Promise<{ exists: boolean }> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    this.logger.debug(`Checking existence of word: ${word}`);

    const exists = await this.wordService.checkWordExistence(word);
    return { exists };
  }

  /**
   * Get all words
   * GET /words
   */
  @Get()
  async getAllWords() {
    this.logger.debug('Getting all words');
    return await this.wordService.getAllWords();
  }

  /**
   * Get approved words (passed inclusion threshold)
   * GET /words/approved
   */
  @Get('approved/list')
  async getApprovedWords(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: 'alphabetical' | 'votes' | 'created',
    @Query('sortDirection') sortDirection?: 'asc' | 'desc',
  ) {
    this.logger.debug('Getting approved words');

    // Parse query parameters
    const options = {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      sortBy,
      sortDirection,
    };

    // Validate parsed numbers
    if (options.limit !== undefined && isNaN(options.limit)) {
      throw new BadRequestException('Invalid limit parameter');
    }

    if (options.offset !== undefined && isNaN(options.offset)) {
      throw new BadRequestException('Invalid offset parameter');
    }

    return await this.wordService.getApprovedWords(options);
  }

  /**
   * Check word statistics
   * GET /words/stats/count
   */
  @Get('stats/count')
  async checkWords(): Promise<{ count: number }> {
    this.logger.debug('Checking word statistics');
    return await this.wordService.checkWords();
  }

  /**
   * Check if word is available for definition creation
   * GET /words/:word/available-for-definition
   */
  @Get(':word/available-for-definition')
  async isAvailableForDefinition(
    @Param('word') word: string,
  ): Promise<{ available: boolean }> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word parameter is required');
    }

    this.logger.debug(
      `Checking if word ${word} is available for definition creation`,
    );

    const available =
      await this.wordService.isWordAvailableForDefinitionCreation(word);
    return { available };
  }
}
