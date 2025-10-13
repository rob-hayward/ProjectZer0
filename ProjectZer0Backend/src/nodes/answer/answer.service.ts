// src/nodes/answer/answer.service.ts - REFACTORED TO SCHEMA ARCHITECTURE
// 🐛 BUG #2 FIX APPLIED: Changed findById() to getAnswer() on line ~208

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AnswerSchema } from '../../neo4j/schemas/answer.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { CategoryService } from '../category/category.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { OpenQuestionService } from '../openquestion/openquestion.service';
import { v4 as uuidv4 } from 'uuid';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { TEXT_LIMITS } from '../../constants/validation';
import { VotingUtils } from '../../config/voting.config';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';
import type { AnswerData } from '../../neo4j/schemas/answer.schema';

/**
 * AnswerService - Business logic for answer operations
 *
 * ARCHITECTURE:
 * - Delegates all CRUD operations to AnswerSchema
 * - Injects DiscussionSchema directly (NOT DiscussionService)
 * - Orchestrates answer creation + keyword extraction + word creation + discussion
 * - Validates parent question has passed inclusion threshold
 * - Handles business validation beyond schema rules
 *
 * KEY CHARACTERISTICS:
 * - Uses 'id' as ID field (standard)
 * - Discussion creation uses nodeIdField: 'id'
 * - Dual voting (inclusion + content)
 * - AI keyword extraction (like Statement/OpenQuestion)
 * - Auto-creates missing word nodes (like Statement/OpenQuestion)
 * - 0-3 categories (like Statement/OpenQuestion)
 * - Must validate parent question approval
 *
 * RESPONSIBILITIES:
 * ✅ Orchestrate multiple schema calls (answer + discussion + keywords + categories)
 * ✅ Business validation (text limits, category count, parent question approval)
 * ✅ Keyword extraction and word creation
 * ✅ Data transformation and aggregation
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Writing Cypher queries (that's AnswerSchema)
 * ❌ Direct database access (that's Neo4jService)
 * ❌ HTTP concerns (that's AnswerController)
 */

// ============================================
// INTERFACES
// ============================================

interface CreateAnswerData {
  createdBy: string;
  publicCredit: boolean;
  answerText: string;
  parentQuestionId: string;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment?: string;
}

interface UpdateAnswerData {
  answerText?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  categoryIds?: string[];
}

interface GetAnswersOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'created' | 'inclusion_votes' | 'content_votes';
  sortDirection?: 'asc' | 'desc';
  onlyApproved?: boolean;
}

@Injectable()
export class AnswerService {
  private readonly logger = new Logger(AnswerService.name);

  constructor(
    private readonly answerSchema: AnswerSchema,
    private readonly discussionSchema: DiscussionSchema, // ← Direct injection
    private readonly userSchema: UserSchema,
    private readonly categoryService: CategoryService,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
    private readonly openQuestionService: OpenQuestionService,
  ) {}

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Create a new answer with optional discussion
   * Orchestrates: parent validation + keyword extraction + word creation + answer creation + discussion creation
   */
  async createAnswer(answerData: CreateAnswerData): Promise<AnswerData> {
    this.validateCreateAnswerData(answerData);

    const answerId = uuidv4();
    this.logger.log(
      `Creating answer for question: ${answerData.parentQuestionId}`,
    );

    try {
      // Validate parent question exists and has passed inclusion
      const parentQuestion = await this.openQuestionService.getOpenQuestion(
        answerData.parentQuestionId,
      );

      if (!parentQuestion) {
        throw new BadRequestException(
          `Parent question ${answerData.parentQuestionId} not found`,
        );
      }

      if (
        !VotingUtils.hasPassedInclusion(parentQuestion.inclusionNetVotes || 0)
      ) {
        throw new BadRequestException(
          'Parent question must pass inclusion threshold before answers can be added',
        );
      }

      // Extract keywords if not provided by user
      let keywords: KeywordWithFrequency[] = [];
      if (answerData.userKeywords && answerData.userKeywords.length > 0) {
        keywords = answerData.userKeywords.map((keyword) => ({
          word: keyword,
          frequency: 1,
          source: 'user' as const,
        }));
        this.logger.debug(`Using ${keywords.length} user-provided keywords`);
      } else {
        try {
          const extractionResult =
            await this.keywordExtractionService.extractKeywords({
              text: answerData.answerText,
            });
          keywords = extractionResult.keywords;
          this.logger.debug(`Extracted ${keywords.length} keywords via AI`);
        } catch (error) {
          this.logger.error(
            `Keyword extraction failed: ${error.message}`,
            error.stack,
          );
          throw new InternalServerErrorException(
            'Failed to extract keywords from answer',
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
              createdBy: answerData.createdBy,
              publicCredit: answerData.publicCredit ?? true,
            });
          }
        } catch (error) {
          this.logger.warn(
            `Failed to create word '${keyword.word}': ${error.message}`,
          );
          // Continue - don't fail answer creation if word creation fails
        }
      }

      // Validate categories if provided
      if (answerData.categoryIds && answerData.categoryIds.length > 0) {
        await this.validateCategories(answerData.categoryIds);
      }

      // Create the answer via schema
      const createdAnswer = await this.answerSchema.createAnswer({
        id: answerId,
        createdBy: answerData.createdBy,
        publicCredit: answerData.publicCredit,
        answerText: answerData.answerText,
        parentQuestionId: answerData.parentQuestionId,
        keywords,
        categoryIds: answerData.categoryIds,
      });

      // Create discussion if initialComment provided
      // ⚠️ CRITICAL: Use direct DiscussionSchema injection, NOT DiscussionService
      if (answerData.initialComment) {
        try {
          await this.discussionSchema.createDiscussionForNode({
            nodeId: createdAnswer.id,
            nodeType: 'AnswerNode',
            nodeIdField: 'id', // ← Standard ID field
            createdBy: answerData.createdBy,
            initialComment: answerData.initialComment,
          });
          this.logger.debug(
            `Created discussion for answer: ${createdAnswer.id}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to create discussion for answer ${createdAnswer.id}: ${error.message}`,
          );
          // Continue - answer creation succeeded
        }
      }

      this.logger.log(`Successfully created answer: ${createdAnswer.id}`);
      return createdAnswer;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error(`Error creating answer: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to create answer: ${error.message}`,
      );
    }
  }

  /**
   * Get an answer by ID
   * Direct delegation to schema with error handling
   *
   * 🐛 BUG #2 FIX APPLIED:
   * - Changed from this.answerSchema.findById(id)
   * - To this.answerSchema.getAnswer(id)
   * - Reason: findById() returns only basic properties
   * - getAnswer() returns complete data with keywords, categories, parentQuestion, relatedAnswers, discussionId
   */
  async getAnswer(id: string): Promise<AnswerData> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    this.logger.debug(`Getting answer: ${id}`);

    try {
      // ✅ FIXED: Use getAnswer() instead of findById()
      const answer = await this.answerSchema.getAnswer(id);

      if (!answer) {
        throw new NotFoundException(`Answer with ID ${id} not found`);
      }

      return answer;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Error getting answer: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to get answer: ${error.message}`,
      );
    }
  }

  /**
   * Update an answer with optional keyword re-extraction
   * Orchestrates: validation + optional keyword re-extraction + word creation + update
   */
  async updateAnswer(
    id: string,
    updateData: UpdateAnswerData,
  ): Promise<AnswerData> {
    this.validateUpdateAnswerData(updateData);

    this.logger.debug(`Updating answer: ${id}`);

    try {
      // Check if answer text is changing
      const textChanged =
        updateData.answerText !== undefined &&
        updateData.answerText.trim() !== '';

      if (textChanged) {
        // Get original answer to access createdBy
        const originalAnswer = await this.getAnswer(id);

        if (!originalAnswer) {
          throw new NotFoundException(`Answer with ID ${id} not found`);
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
              text: updateData.answerText!,
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
                createdBy: originalAnswer.createdBy,
                publicCredit: originalAnswer.publicCredit ?? true,
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
      const updatedAnswer = await this.answerSchema.updateAnswer(
        id,
        updateData,
      );

      if (!updatedAnswer) {
        throw new NotFoundException(`Answer with ID ${id} not found`);
      }

      this.logger.debug(`Successfully updated answer: ${id}`);
      return updatedAnswer;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(`Error updating answer: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to update answer: ${error.message}`,
      );
    }
  }

  /**
   * Delete an answer
   * Direct delegation to schema
   */
  async deleteAnswer(id: string): Promise<{ success: boolean }> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    this.logger.debug(`Deleting answer: ${id}`);

    try {
      // Verify answer exists before deletion
      await this.getAnswer(id);

      await this.answerSchema.delete(id);
      this.logger.debug(`Deleted answer: ${id}`);

      return { success: true };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(`Error deleting answer: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to delete answer: ${error.message}`,
      );
    }
  }

  /**
   * Get all answers for a specific question
   * Note: AnswerSchema handles the filtering and sorting
   */
  async getAnswersForQuestion(
    questionId: string,
    options?: GetAnswersOptions,
  ): Promise<AnswerData[]> {
    if (!questionId || questionId.trim() === '') {
      throw new BadRequestException('Question ID is required');
    }

    this.logger.debug(`Getting answers for question: ${questionId}`);

    try {
      const includeUnapproved = options?.onlyApproved === false;
      const answers = await this.answerSchema.getAnswersByQuestion(
        questionId,
        includeUnapproved,
      );

      this.logger.debug(
        `Found ${answers.length} answers for question ${questionId}`,
      );
      return answers;
    } catch (error) {
      this.logger.error(
        `Error getting answers for question: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get answers for question: ${error.message}`,
      );
    }
  }

  /**
   * Get the top-voted answer for a question
   */
  async getTopAnswerForQuestion(
    questionId: string,
  ): Promise<AnswerData | null> {
    if (!questionId || questionId.trim() === '') {
      throw new BadRequestException('Question ID is required');
    }

    this.logger.debug(`Getting top answer for question: ${questionId}`);

    try {
      const topAnswer =
        await this.answerSchema.getTopAnswerForQuestion(questionId);
      return topAnswer;
    } catch (error) {
      this.logger.error(
        `Error getting top answer: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get top answer: ${error.message}`,
      );
    }
  }

  // ============================================
  // VOTING OPERATIONS - DUAL VOTING
  // ============================================

  /**
   * Vote on answer inclusion
   * Answers support both inclusion and content voting
   */
  async voteInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Voting on answer inclusion: ${id} by user: ${userId}, isPositive: ${isPositive}`,
    );

    try {
      const result = await this.answerSchema.voteInclusion(
        id,
        userId,
        isPositive,
      );
      this.logger.debug(`Inclusion vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error voting on answer: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on answer: ${error.message}`,
      );
    }
  }

  /**
   * Vote on answer content quality
   * Only allowed after inclusion threshold passed
   */
  async voteContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Voting on answer content: ${id} by user: ${userId}, isPositive: ${isPositive}`,
    );

    try {
      const result = await this.answerSchema.voteContent(
        id,
        userId,
        isPositive,
      );
      this.logger.debug(`Content vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      // Schema will throw BadRequestException if inclusion threshold not passed
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error voting on answer content: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on answer content: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for a user on an answer
   */
  async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Getting vote status for answer ${id} by user ${userId}`);

    try {
      const status = await this.answerSchema.getVoteStatus(id, userId);
      this.logger.debug(
        `Vote status for answer ${id} and user ${userId}: ${JSON.stringify(status)}`,
      );
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
   * Remove a vote from an answer
   */
  async removeVote(
    id: string,
    userId: string,
    kind: 'INCLUSION' | 'CONTENT',
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Removing ${kind} vote on answer: ${id} by user: ${userId}`,
    );

    try {
      const result = await this.answerSchema.removeVote(id, userId, kind);
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
   * Get vote totals for an answer
   */
  async getVotes(id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Answer ID is required');
    }

    this.logger.debug(`Getting votes for answer: ${id}`);

    try {
      const votes = await this.answerSchema.getVotes(id);
      this.logger.debug(`Votes for answer ${id}: ${JSON.stringify(votes)}`);
      return votes;
    } catch (error) {
      this.logger.error(`Error getting votes: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to get votes: ${error.message}`,
      );
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Check if an answer has passed inclusion threshold
   */
  async isAnswerApproved(id: string): Promise<boolean> {
    try {
      const answer = await this.getAnswer(id);
      return VotingUtils.hasPassedInclusion(answer.inclusionNetVotes || 0);
    } catch {
      return false;
    }
  }

  /**
   * Check if content voting is available for an answer
   */
  async isContentVotingAvailable(id: string): Promise<boolean> {
    return await this.isAnswerApproved(id);
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  /**
   * Validate answer creation data
   */
  private validateCreateAnswerData(answerData: CreateAnswerData): void {
    if (!answerData.answerText || answerData.answerText.trim() === '') {
      throw new BadRequestException('Answer text is required');
    }

    if (answerData.answerText.length > TEXT_LIMITS.MAX_ANSWER_LENGTH) {
      throw new BadRequestException(
        `Answer text cannot exceed ${TEXT_LIMITS.MAX_ANSWER_LENGTH} characters`,
      );
    }

    if (!answerData.createdBy || answerData.createdBy.trim() === '') {
      throw new BadRequestException('Creator ID is required');
    }

    if (
      !answerData.parentQuestionId ||
      answerData.parentQuestionId.trim() === ''
    ) {
      throw new BadRequestException('Parent question ID is required');
    }

    if (typeof answerData.publicCredit !== 'boolean') {
      throw new BadRequestException('Public credit flag is required');
    }

    // Validate category count (0-3)
    if (answerData.categoryIds && answerData.categoryIds.length > 3) {
      throw new BadRequestException('Answer can have maximum 3 categories');
    }
  }

  /**
   * Validate answer update data
   */
  private validateUpdateAnswerData(updateData: UpdateAnswerData): void {
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update data provided');
    }

    if (updateData.answerText !== undefined) {
      if (!updateData.answerText || updateData.answerText.trim() === '') {
        throw new BadRequestException('Answer text cannot be empty');
      }

      if (updateData.answerText.length > TEXT_LIMITS.MAX_ANSWER_LENGTH) {
        throw new BadRequestException(
          `Answer text cannot exceed ${TEXT_LIMITS.MAX_ANSWER_LENGTH} characters`,
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
      throw new BadRequestException('Answer can have maximum 3 categories');
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
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        throw new BadRequestException(
          `Category ${categoryId} does not exist or is not accessible: ${errorMessage}`,
        );
      }
    });

    await Promise.all(validationPromises);
  }
}
