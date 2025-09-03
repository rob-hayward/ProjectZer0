// src/nodes/answer/answer.service.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AnswerSchema } from '../../neo4j/schemas/answer.schema';
import { CategoryService } from '../category/category.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { v4 as uuidv4 } from 'uuid';
import type { AnswerNodeData } from '../../neo4j/schemas/answer.schema';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';

// Fallback constants - should match actual validation constants
const TEXT_LIMITS = {
  MAX_ANSWER_LENGTH: 2000,
  MAX_COMMENT_LENGTH: 2000,
};

interface CreateAnswerData {
  answerText: string;
  createdBy: string;
  publicCredit: boolean;
  parentQuestionId: string;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment?: string;
}

interface UpdateAnswerData {
  answerText?: string;
  publicCredit?: boolean;
}

interface GetAnswerOptions {
  includeParentQuestion?: boolean;
  includeDiscussion?: boolean;
  includeCategories?: boolean;
}

interface GetAnswersOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'created' | 'inclusion_votes' | 'content_votes';
  sortDirection?: 'asc' | 'desc';
  onlyApproved?: boolean;
}

interface DiscoveryOptions {
  nodeTypes?: ('statement' | 'answer' | 'openquestion' | 'quantity')[];
  limit?: number;
  offset?: number;
  sortBy?: 'category_overlap' | 'created' | 'inclusion_votes' | 'content_votes';
  sortDirection?: 'asc' | 'desc';
  excludeSelf?: boolean;
  minCategoryOverlap?: number;
}

@Injectable()
export class AnswerService {
  private readonly logger = new Logger(AnswerService.name);

  constructor(
    private readonly answerSchema: AnswerSchema,
    private readonly categoryService: CategoryService,
    private readonly discussionService: DiscussionService,
    private readonly commentService: CommentService,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
  ) {}

  /**
   * Create a new answer (typically called by OpenQuestionService)
   */
  async createAnswer(answerData: CreateAnswerData) {
    try {
      // Validate input data
      this.validateCreateAnswerData(answerData);

      const answerId = uuidv4();

      this.logger.log(
        `Creating answer for question: ${answerData.parentQuestionId}`,
      );
      this.logger.debug(`Answer data: ${JSON.stringify(answerData)}`);

      // Extract keywords if not provided by user
      let keywords: KeywordWithFrequency[] = [];
      if (answerData.userKeywords && answerData.userKeywords.length > 0) {
        keywords = answerData.userKeywords.map((keyword) => ({
          word: keyword,
          frequency: 1,
          source: 'user' as const,
        }));
      } else {
        try {
          const extractionResult =
            await this.keywordExtractionService.extractKeywords({
              text: answerData.answerText,
              userKeywords: answerData.userKeywords,
            });
          keywords = extractionResult.keywords;
        } catch (error) {
          this.logger.warn(
            `Keyword extraction failed for answer: ${error.message}`,
          );
          keywords = [];
        }
      }

      // Process keywords to ensure Word nodes exist
      if (keywords.length > 0) {
        await this.processKeywordsForCreation(keywords, answerData);
      }

      // Validate categories if provided
      if (answerData.categoryIds && answerData.categoryIds.length > 0) {
        await this.validateCategories(answerData.categoryIds);
      }

      const answerNodeData: AnswerNodeData = {
        id: answerId,
        answerText: answerData.answerText.trim(),
        createdBy: answerData.createdBy,
        publicCredit: answerData.publicCredit,
        parentQuestionId: answerData.parentQuestionId,
        categoryIds: answerData.categoryIds || [],
        keywords,
        initialComment: answerData.initialComment?.trim(),
      };

      const result = await this.answerSchema.createAnswer(answerNodeData);

      this.logger.log(`Successfully created answer with ID: ${result.id}`);
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Error creating answer: ${error.message}`, error.stack);

      if (error.message.includes('parent question')) {
        throw new BadRequestException(
          'Parent question must exist and have passed inclusion threshold',
        );
      }

      if (error.message.includes('categories')) {
        throw new BadRequestException(
          'All categories must exist and have passed inclusion threshold',
        );
      }

      throw new InternalServerErrorException(
        `Failed to create answer: ${error.message}`,
      );
    }
  }

  /**
   * Get an answer by ID
   */
  async getAnswer(id: string, options: GetAnswerOptions = {}) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.debug(`Retrieving answer: ${id}`);

      const answer = await this.answerSchema.getAnswer(id);

      if (!answer) {
        throw new NotFoundException(`Answer with ID ${id} not found`);
      }

      // Enhance with additional data if requested
      if (options.includeDiscussion && answer.discussionId) {
        try {
          const discussion = await this.discussionService.getDiscussion(
            answer.discussionId,
          );
          answer.discussion = discussion;
        } catch (error) {
          this.logger.warn(
            `Could not fetch discussion ${answer.discussionId} for answer ${id}: ${error.message}`,
          );
        }
      }

      if (options.includeCategories) {
        try {
          const categories = await this.getAnswerCategories(id);
          answer.categories = categories;
        } catch (error) {
          this.logger.warn(
            `Could not fetch categories for answer ${id}: ${error.message}`,
          );
        }
      }

      this.logger.debug(`Retrieved answer: ${JSON.stringify(answer)}`);
      return answer;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error retrieving answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve answer: ${error.message}`,
      );
    }
  }

  /**
   * Update an existing answer
   */
  async updateAnswer(id: string, updateData: UpdateAnswerData) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      // Validate update data
      if (updateData.answerText !== undefined) {
        if (!updateData.answerText || updateData.answerText.trim() === '') {
          throw new BadRequestException('Answer text cannot be empty');
        }
        if (updateData.answerText.length > TEXT_LIMITS.MAX_ANSWER_LENGTH) {
          throw new BadRequestException(
            `Answer text must not exceed ${TEXT_LIMITS.MAX_ANSWER_LENGTH} characters`,
          );
        }
      }

      this.logger.log(`Updating answer ${id}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateData)}`);

      const updatedAnswer = await this.answerSchema.updateAnswer(
        id,
        updateData,
      );

      if (!updatedAnswer) {
        throw new NotFoundException(`Answer with ID ${id} not found`);
      }

      this.logger.log(`Successfully updated answer ${id}`);
      return updatedAnswer;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update answer: ${error.message}`,
      );
    }
  }

  /**
   * Delete an answer
   */
  async deleteAnswer(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.log(`Deleting answer ${id}`);

      const result = await this.answerSchema.deleteAnswer(id);

      if (!result.success) {
        throw new NotFoundException(`Answer with ID ${id} not found`);
      }

      this.logger.log(`Successfully deleted answer ${id}`);
      return { success: true };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete answer: ${error.message}`,
      );
    }
  }

  /**
   * Get answers for a specific question
   */
  async getAnswersForQuestion(
    questionId: string,
    options: GetAnswersOptions = {},
  ) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Question ID is required');
      }

      const {
        limit,
        offset = 0,
        sortBy = 'created',
        sortDirection = 'desc',
        onlyApproved = false,
      } = options;

      // Validate options
      if (limit !== undefined && (limit < 1 || limit > 1000)) {
        throw new BadRequestException('Limit must be between 1 and 1000');
      }

      if (offset < 0) {
        throw new BadRequestException('Offset must be non-negative');
      }

      const validSortOptions = ['created', 'inclusion_votes', 'content_votes'];
      if (!validSortOptions.includes(sortBy)) {
        throw new BadRequestException(
          `sortBy must be one of: ${validSortOptions.join(', ')}`,
        );
      }

      if (!['asc', 'desc'].includes(sortDirection)) {
        throw new BadRequestException(
          'sortDirection must be either asc or desc',
        );
      }

      this.logger.debug(
        `Getting answers for question ${questionId} with options: ${JSON.stringify(options)}`,
      );

      // Convert 'created' to schema-expected 'newest'/'oldest' based on sort direction
      const schemaSortBy =
        sortBy === 'created'
          ? sortDirection === 'desc'
            ? 'newest'
            : 'oldest'
          : sortBy;

      return await this.answerSchema.getAnswersForQuestion(questionId, {
        limit,
        offset,
        sortBy: schemaSortBy,
        sortDirection,
        onlyApproved,
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting answers for question ${questionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get answers: ${error.message}`,
      );
    }
  }

  // VOTING METHODS - Following consistent patterns

  /**
   * Vote for answer inclusion
   */
  async voteAnswerInclusion(id: string, sub: string, isPositive: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Processing inclusion vote on answer ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      return await this.answerSchema.voteAnswerInclusion(id, sub, isPositive);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error voting on answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on answer: ${error.message}`,
      );
    }
  }

  /**
   * Vote for answer content (quality)
   */
  async voteAnswerContent(id: string, sub: string, isPositive: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Processing content vote on answer ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      return await this.answerSchema.voteAnswerContent(id, sub, isPositive);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error voting on answer content ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on answer content: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for an answer by a specific user
   */
  async getAnswerVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      return await this.answerSchema.getAnswerVoteStatus(id, sub);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting vote status for answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get answer vote status: ${error.message}`,
      );
    }
  }

  /**
   * Remove vote from an answer
   */
  async removeAnswerVote(
    id: string,
    sub: string,
    kind: 'INCLUSION' | 'CONTENT' = 'INCLUSION',
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(`Removing ${kind} vote from answer ${id} by user ${sub}`);

      return await this.answerSchema.removeAnswerVote(id, sub, kind);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error removing vote from answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to remove answer vote: ${error.message}`,
      );
    }
  }

  /**
   * Get aggregated vote counts for an answer
   */
  async getAnswerVotes(id: string): Promise<VoteResult | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      return await this.answerSchema.getAnswerVotes(id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting votes for answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get answer votes: ${error.message}`,
      );
    }
  }

  // VISIBILITY METHODS - Following consistent patterns

  /**
   * Set visibility status for an answer
   */
  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.log(`Setting visibility for answer ${id} to ${isVisible}`);

      return await this.answerSchema.setVisibilityStatus(id, isVisible);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error setting visibility for answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to set answer visibility: ${error.message}`,
      );
    }
  }

  /**
   * Get visibility status for an answer
   */
  async getVisibilityStatus(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      return await this.answerSchema.getVisibilityStatus(id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting visibility status for answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get answer visibility status: ${error.message}`,
      );
    }
  }

  // DISCOVERY METHODS - Delegating to schema

  /**
   * Get related content that shares categories with the given answer
   */
  async getRelatedContentBySharedCategories(
    answerId: string,
    options: DiscoveryOptions = {},
  ) {
    try {
      if (!answerId || answerId.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.debug(
        `Getting related content for answer ${answerId} with options: ${JSON.stringify(options)}`,
      );

      return await this.answerSchema.getRelatedContentBySharedCategories(
        answerId,
        options,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting related content for answer ${answerId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get related content: ${error.message}`,
      );
    }
  }

  /**
   * Get categories associated with an answer
   */
  async getAnswerCategories(answerId: string) {
    try {
      if (!answerId || answerId.trim() === '') {
        throw new BadRequestException('Answer ID is required');
      }

      this.logger.debug(`Getting categories for answer ${answerId}`);

      return await this.answerSchema.getNodeCategories(answerId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting categories for answer ${answerId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get answer categories: ${error.message}`,
      );
    }
  }

  // DISCUSSION & COMMENT INTEGRATION - Following consistent patterns

  /**
   * Get answer with its discussion
   */
  async getAnswerWithDiscussion(id: string) {
    return this.getAnswer(id, { includeDiscussion: true });
  }

  /**
   * Get comments for an answer's discussion
   */
  async getAnswerComments(id: string) {
    try {
      const answer = await this.getAnswer(id);

      if (!answer.discussionId) {
        return { comments: [] };
      }

      const comments = await this.commentService.getCommentsByDiscussionId(
        answer.discussionId,
      );
      return { comments };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting comments for answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get answer comments: ${error.message}`,
      );
    }
  }

  /**
   * Add comment to an answer's discussion
   */
  async addAnswerComment(
    id: string,
    commentData: { commentText: string; parentCommentId?: string },
    createdBy: string,
  ) {
    try {
      const answer = await this.getAnswer(id);

      if (!answer.discussionId) {
        throw new Error(
          `Answer ${id} is missing its discussion - this should not happen`,
        );
      }

      // Create the comment
      const comment = await this.commentService.createComment({
        createdBy,
        discussionId: answer.discussionId,
        commentText: commentData.commentText,
        parentCommentId: commentData.parentCommentId,
      });

      return comment;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error adding comment to answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to add answer comment: ${error.message}`,
      );
    }
  }

  // UTILITY METHODS

  /**
   * Check if an answer has passed the inclusion threshold
   */
  async isAnswerApproved(id: string): Promise<boolean> {
    try {
      const votes = await this.getAnswerVotes(id);
      return votes ? votes.inclusionNetVotes > 0 : false;
    } catch (error) {
      this.logger.error(
        `Error checking approval status for answer ${id}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Check if content voting is available for an answer
   */
  async isContentVotingAvailable(id: string): Promise<boolean> {
    try {
      const answer = await this.getAnswer(id);
      if (!answer) return false;

      // For answers, content voting is always available (unlike statements)
      return true;
    } catch (error) {
      this.logger.error(
        `Error checking content voting availability for answer ${id}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get answer statistics
   */
  async getAnswerStats(id: string) {
    try {
      const [answer, votes, categories] = await Promise.all([
        this.getAnswer(id),
        this.getAnswerVotes(id),
        this.getAnswerCategories(id),
      ]);

      return {
        id: answer.id,
        answerText: answer.answerText,
        parentQuestionId: answer.parentQuestionId,
        categories: categories || [],
        votes: votes || {
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        },
        isApproved: votes ? votes.inclusionNetVotes > 0 : false,
        contentVotingAvailable: true, // Always available for answers
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting stats for answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get answer stats: ${error.message}`,
      );
    }
  }

  // PRIVATE HELPER METHODS

  /**
   * Validate answer creation data
   */
  private validateCreateAnswerData(answerData: CreateAnswerData): void {
    if (!answerData.answerText || answerData.answerText.trim() === '') {
      throw new BadRequestException('Answer text is required');
    }

    if (answerData.answerText.length > TEXT_LIMITS.MAX_ANSWER_LENGTH) {
      throw new BadRequestException(
        `Answer text must not exceed ${TEXT_LIMITS.MAX_ANSWER_LENGTH} characters`,
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
      throw new BadRequestException('publicCredit must be a boolean value');
    }

    // Validate category count (0-3 categories allowed)
    if (answerData.categoryIds && answerData.categoryIds.length > 3) {
      throw new BadRequestException('Answer can have maximum 3 categories');
    }

    if (
      answerData.initialComment &&
      answerData.initialComment.length > TEXT_LIMITS.MAX_COMMENT_LENGTH
    ) {
      throw new BadRequestException(
        `Initial comment must not exceed ${TEXT_LIMITS.MAX_COMMENT_LENGTH} characters`,
      );
    }
  }

  /**
   * Process keywords and create any missing word nodes
   */
  private async processKeywordsForCreation(
    keywords: KeywordWithFrequency[],
    answerData: CreateAnswerData,
  ): Promise<void> {
    const newWordPromises = keywords.map(async (keyword) => {
      try {
        const wordExists = await this.wordService.checkWordExistence(
          keyword.word,
        );

        if (!wordExists) {
          // Create new word node with required properties
          await this.wordService.createWord({
            word: keyword.word,
            createdBy: answerData.createdBy,
            publicCredit: answerData.publicCredit,
          });
          this.logger.debug(
            `Created new word: "${keyword.word}" for answer creation`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Error processing keyword "${keyword.word}": ${error.message}`,
        );
        // Continue with other keywords even if one fails
      }
    });

    // Wait for all word creation processes to complete
    await Promise.all(newWordPromises);
  }

  /**
   * Validate that categories exist and have passed inclusion threshold
   */
  private async validateCategories(categoryIds: string[]): Promise<void> {
    const validationPromises = categoryIds.map(async (categoryId) => {
      try {
        const isApproved =
          await this.categoryService.isCategoryApproved(categoryId);
        if (!isApproved) {
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
