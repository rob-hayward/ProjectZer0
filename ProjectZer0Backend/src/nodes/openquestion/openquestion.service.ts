// src/nodes/openquestion/openquestion.service.ts - REFACTORED TO SCHEMA ARCHITECTURE
// 🐛 BUG #2 FIX APPLIED: Changed findById() to getOpenQuestion() on line 181

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { OpenQuestionSchema } from '../../neo4j/schemas/openquestion.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { CategoryService } from '../category/category.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { v4 as uuidv4 } from 'uuid';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { TEXT_LIMITS } from '../../constants/validation';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';
import type { OpenQuestionData } from '../../neo4j/schemas/openquestion.schema';

/**
 * OpenQuestionService - Business logic for open question operations
 *
 * ARCHITECTURE:
 * - Delegates all CRUD operations to OpenQuestionSchema
 * - Injects DiscussionSchema directly (NOT DiscussionService)
 * - Orchestrates question creation + keyword extraction + word creation + discussion
 * - Handles business validation beyond schema rules
 *
 * KEY CHARACTERISTICS:
 * - Uses 'id' as ID field (standard)
 * - Discussion creation uses nodeIdField: 'id'
 * - Inclusion voting only (no content voting)
 * - AI keyword extraction (like Statement)
 * - Auto-creates missing word nodes (like Statement)
 * - 0-3 categories (like Statement)
 * - Question text normalization (in schema layer)
 *
 * RESPONSIBILITIES:
 * ✅ Orchestrate multiple schema calls (question + discussion + keywords + categories)
 * ✅ Business validation (text limits, category count, etc.)
 * ✅ Keyword extraction and word creation
 * ✅ Data transformation and aggregation
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Writing Cypher queries (that's OpenQuestionSchema)
 * ❌ Direct database access (that's Neo4jService)
 * ❌ HTTP concerns (that's OpenQuestionController)
 * ❌ Question normalization (that's OpenQuestionSchema)
 */

// ============================================
// INTERFACES
// ============================================

interface CreateOpenQuestionData {
  createdBy: string;
  publicCredit: boolean;
  questionText: string;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment: string;
}

interface UpdateOpenQuestionData {
  questionText?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  categoryIds?: string[];
}

@Injectable()
export class OpenQuestionService {
  private readonly logger = new Logger(OpenQuestionService.name);

  constructor(
    private readonly openQuestionSchema: OpenQuestionSchema,
    private readonly discussionSchema: DiscussionSchema, // ← Direct injection
    private readonly userSchema: UserSchema,
    private readonly categoryService: CategoryService,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
  ) {}

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Create a new open question with optional discussion
   * Orchestrates: validation + keyword extraction + word creation + question creation + discussion creation
   */
  async createOpenQuestion(
    questionData: CreateOpenQuestionData,
  ): Promise<OpenQuestionData> {
    this.validateCreateQuestionData(questionData);

    const questionId = uuidv4();
    this.logger.log(
      `Creating open question: ${questionData.questionText.substring(0, 50)}...`,
    );

    try {
      // Extract keywords if not provided by user
      let keywords: KeywordWithFrequency[] = [];
      if (questionData.userKeywords && questionData.userKeywords.length > 0) {
        keywords = questionData.userKeywords.map((keyword) => ({
          word: keyword,
          frequency: 1,
          source: 'user' as const,
        }));
        this.logger.debug(`Using ${keywords.length} user-provided keywords`);
      } else {
        try {
          const extractionResult =
            await this.keywordExtractionService.extractKeywords({
              text: questionData.questionText,
            });
          keywords = extractionResult.keywords;
          this.logger.debug(`Extracted ${keywords.length} keywords via AI`);
        } catch (error) {
          this.logger.error(
            `Keyword extraction failed: ${error.message}`,
            error.stack,
          );
          throw new InternalServerErrorException(
            'Failed to extract keywords from question',
          );
        }
      }

      // Create missing word nodes
      for (const keyword of keywords) {
        try {
          const wordExists = await this.wordService.checkWordExistence(
            keyword.word,
          );
          if (!wordExists) {
            this.logger.debug(`Creating missing word node: ${keyword.word}`);
            await this.wordService.createWord({
              word: keyword.word,
              createdBy: questionData.createdBy,
              publicCredit: questionData.publicCredit ?? true,
            });
          }
        } catch (error) {
          this.logger.warn(
            `Failed to create word '${keyword.word}': ${error.message}`,
          );
          // Continue - don't fail question creation if word creation fails
        }
      }

      // Validate categories if provided
      if (questionData.categoryIds && questionData.categoryIds.length > 0) {
        await this.validateCategories(questionData.categoryIds);
      }

      // Create the open question via schema
      const createdQuestion = await this.openQuestionSchema.createOpenQuestion({
        id: questionId,
        createdBy: questionData.createdBy,
        publicCredit: questionData.publicCredit,
        questionText: questionData.questionText,
        keywords,
        categoryIds: questionData.categoryIds,
      });

      // Create discussion if initialComment provided
      // ⚠️ CRITICAL: Use direct DiscussionSchema injection, NOT DiscussionService
      if (questionData.initialComment) {
        try {
          await this.discussionSchema.createDiscussionForNode({
            nodeId: createdQuestion.id,
            nodeType: 'OpenQuestionNode',
            nodeIdField: 'id', // ← Standard ID field
            createdBy: questionData.createdBy,
            initialComment: questionData.initialComment,
          });
          this.logger.debug(
            `Created discussion for question: ${createdQuestion.id}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to create discussion for question ${createdQuestion.id}: ${error.message}`,
          );
          // Continue - question creation succeeded
        }
      }

      this.logger.log(
        `Successfully created open question: ${createdQuestion.id}`,
      );
      return createdQuestion;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error(
        `Error creating open question: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create open question: ${error.message}`,
      );
    }
  }

  /**
   * Get an open question by ID
   * Direct delegation to schema with error handling
   *
   * 🐛 BUG #2 FIX APPLIED:
   * - Changed from this.openQuestionSchema.findById(id)
   * - To this.openQuestionSchema.getOpenQuestion(id)
   * - Reason: findById() returns only basic properties
   * - getOpenQuestion() returns complete data with keywords, categories, answers, discussionId
   */
  async getOpenQuestion(id: string): Promise<OpenQuestionData> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
    }

    this.logger.debug(`Getting open question: ${id}`);

    try {
      // ✅ FIXED: Use getOpenQuestion() instead of findById()
      const question = await this.openQuestionSchema.getOpenQuestion(id);

      if (!question) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      return question;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error getting open question: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get open question: ${error.message}`,
      );
    }
  }

  /**
   * Update an open question with optional keyword re-extraction
   * Orchestrates: validation + optional keyword re-extraction + word creation + update
   */
  async updateOpenQuestion(
    id: string,
    updateData: UpdateOpenQuestionData,
  ): Promise<OpenQuestionData> {
    this.validateUpdateQuestionData(updateData);

    this.logger.debug(`Updating open question: ${id}`);

    try {
      // Check if question text is changing
      if (updateData.questionText) {
        // Get original question to access createdBy
        const originalQuestion = await this.getOpenQuestion(id);

        if (!originalQuestion) {
          throw new NotFoundException(`Open question with ID ${id} not found`);
        }

        // Extract keywords if not provided
        let keywords: KeywordWithFrequency[] = [];
        if (updateData.userKeywords && updateData.userKeywords.length > 0) {
          keywords = updateData.userKeywords.map((keyword) => ({
            word: keyword,
            frequency: 1,
            source: 'user' as const,
          }));
        } else {
          const extractionResult =
            await this.keywordExtractionService.extractKeywords({
              text: updateData.questionText,
            });
          keywords = extractionResult.keywords;
        }

        // Create missing word nodes
        for (const keyword of keywords) {
          try {
            const wordExists = await this.wordService.checkWordExistence(
              keyword.word,
            );
            if (!wordExists) {
              await this.wordService.createWord({
                word: keyword.word,
                createdBy: originalQuestion.createdBy,
                publicCredit: originalQuestion.publicCredit ?? true,
              });
            }
          } catch (error) {
            this.logger.warn(
              `Failed to create word '${keyword.word}': ${error.message}`,
            );
            // Continue - don't fail update if word creation fails
          }
        }

        // Add keywords to update data
        (updateData as any).keywords = keywords;
      }

      // Validate categories if provided
      if (updateData.categoryIds !== undefined) {
        if (updateData.categoryIds.length > 0) {
          await this.validateCategories(updateData.categoryIds);
        }
      }

      // Update via schema
      const updatedQuestion = await this.openQuestionSchema.updateOpenQuestion(
        id,
        updateData,
      );

      if (!updatedQuestion) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      this.logger.debug(`Successfully updated open question: ${id}`);
      return updatedQuestion;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating open question: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update open question: ${error.message}`,
      );
    }
  }

  /**
   * Delete an open question
   * Direct delegation to schema
   */
  async deleteOpenQuestion(id: string): Promise<{ success: boolean }> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
    }

    this.logger.debug(`Deleting open question: ${id}`);

    try {
      // Verify question exists before deletion
      await this.getOpenQuestion(id);

      await this.openQuestionSchema.delete(id);
      this.logger.debug(`Deleted open question: ${id}`);

      return { success: true };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting open question: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete open question: ${error.message}`,
      );
    }
  }

  // ============================================
  // VOTING OPERATIONS - INCLUSION ONLY
  // ============================================

  /**
   * Vote on open question inclusion
   * OpenQuestions only support inclusion voting, not content voting
   */
  async voteInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Voting on question inclusion: ${id} by user: ${userId}, isPositive: ${isPositive}`,
    );

    try {
      const result = await this.openQuestionSchema.voteInclusion(
        id,
        userId,
        isPositive,
      );
      this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error voting on question: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on question: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for a user on an open question
   */
  async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting vote status for question ${id} by user ${userId}`,
    );

    try {
      const status = await this.openQuestionSchema.getVoteStatus(id, userId);
      this.logger.debug(`Vote status: ${JSON.stringify(status)}`);
      return status;
    } catch (error) {
      this.logger.error(
        `Error getting vote status: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get vote status: ${error.message}`,
      );
    }
  }

  /**
   * Remove vote from an open question
   */
  async removeVote(id: string, userId: string): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Removing vote for question ${id} by user ${userId}`);

    try {
      const result = await this.openQuestionSchema.removeVote(
        id,
        userId,
        'INCLUSION',
      );
      this.logger.debug(`Remove vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`Error removing vote: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to remove vote: ${error.message}`,
      );
    }
  }

  /**
   * Get vote counts for an open question
   */
  async getVotes(id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Open question ID is required');
    }

    this.logger.debug(`Getting votes for question: ${id}`);

    try {
      const votes = await this.openQuestionSchema.getVotes(id);
      this.logger.debug(`Votes for question ${id}: ${JSON.stringify(votes)}`);
      return votes;
    } catch (error) {
      this.logger.error(`Error getting votes: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to get votes: ${error.message}`,
      );
    }
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  /**
   * Validate open question creation data
   */
  private validateCreateQuestionData(
    questionData: CreateOpenQuestionData,
  ): void {
    if (!questionData.questionText || questionData.questionText.trim() === '') {
      throw new BadRequestException('Question text is required');
    }

    if (
      questionData.questionText.length > TEXT_LIMITS.MAX_OPEN_QUESTION_LENGTH
    ) {
      throw new BadRequestException(
        `Question text cannot exceed ${TEXT_LIMITS.MAX_OPEN_QUESTION_LENGTH} characters`,
      );
    }

    if (!questionData.createdBy || questionData.createdBy.trim() === '') {
      throw new BadRequestException('Creator ID is required');
    }

    if (typeof questionData.publicCredit !== 'boolean') {
      throw new BadRequestException('Public credit flag is required');
    }

    // Validate category count (0-3)
    if (questionData.categoryIds && questionData.categoryIds.length > 3) {
      throw new BadRequestException(
        'Open question can have maximum 3 categories',
      );
    }

    if (
      !questionData.initialComment ||
      questionData.initialComment.trim() === ''
    ) {
      throw new BadRequestException('Initial comment is required');
    }
  }

  /**
   * Validate open question update data
   */
  private validateUpdateQuestionData(updateData: UpdateOpenQuestionData): void {
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update data provided');
    }

    if (updateData.questionText !== undefined) {
      if (!updateData.questionText || updateData.questionText.trim() === '') {
        throw new BadRequestException('Question text cannot be empty');
      }

      if (
        updateData.questionText.length > TEXT_LIMITS.MAX_OPEN_QUESTION_LENGTH
      ) {
        throw new BadRequestException(
          `Question text cannot exceed ${TEXT_LIMITS.MAX_OPEN_QUESTION_LENGTH} characters`,
        );
      }
    }

    if (
      updateData.publicCredit !== undefined &&
      typeof updateData.publicCredit !== 'boolean'
    ) {
      throw new BadRequestException('Public credit must be a boolean value');
    }

    // Validate category count if provided (0-3)
    if (updateData.categoryIds && updateData.categoryIds.length > 3) {
      throw new BadRequestException(
        'Open question can have maximum 3 categories',
      );
    }
  }

  /**
   * Validate categories exist and are approved for use
   */
  private async validateCategories(categoryIds: string[]): Promise<void> {
    if (!categoryIds || categoryIds.length === 0) return;

    const validationPromises = categoryIds.map(async (categoryId) => {
      try {
        const category = await this.categoryService.getCategory(categoryId);
        if (!category) {
          throw new BadRequestException(
            `Category ${categoryId} does not exist`,
          );
        }
        if (category.inclusionNetVotes <= 0) {
          throw new BadRequestException(
            `Category ${categoryId} must have passed inclusion threshold`,
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Category ${categoryId} does not exist or is not accessible`,
        );
      }
    });

    await Promise.all(validationPromises);
  }
}
