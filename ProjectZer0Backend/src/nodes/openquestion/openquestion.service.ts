// src/nodes/openquestion/openquestion.service.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { OpenQuestionSchema } from '../../neo4j/schemas/openquestion.schema';
import { AnswerService } from '../answer/answer.service'; // NEW: Import AnswerService
import { CategoryService } from '../category/category.service'; // NEW: Import CategoryService
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { v4 as uuidv4 } from 'uuid';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

// Constants
const TEXT_LIMITS = {
  MAX_QUESTION_LENGTH: 1000,
};

// Interface definitions
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
}

interface GetOpenQuestionNetworkOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: string;
  keywords?: string[];
  userId?: string;
}

interface OpenQuestionNodeData {
  id: string;
  createdBy: string;
  publicCredit: boolean;
  questionText: string;
  keywords: KeywordWithFrequency[];
  categoryIds?: string[];
  initialComment: string;
}

interface GetOpenQuestionOptions {
  includeDiscussion?: boolean;
  includeAnswers?: boolean; // NEW: Option to include Answer nodes
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

// NEW: Interface for Answer creation via OpenQuestion
interface CreateAnswerForQuestionData {
  answerText: string;
  publicCredit: boolean;
  categoryIds?: string[];
  userKeywords?: string[];
  initialComment: string;
}

@Injectable()
export class OpenQuestionService {
  private readonly logger = new Logger(OpenQuestionService.name);

  constructor(
    private readonly openQuestionSchema: OpenQuestionSchema,
    private readonly answerService: AnswerService, // NEW: Inject AnswerService
    private readonly categoryService: CategoryService, // NEW: Inject CategoryService
    private readonly discussionService: DiscussionService,
    private readonly commentService: CommentService,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
    // REMOVED: StatementService dependency
  ) {}

  // CRUD OPERATIONS

  /**
   * Create a new open question
   */
  async createOpenQuestion(questionData: CreateOpenQuestionData) {
    try {
      // Validate input data
      this.validateCreateQuestionData(questionData);

      const questionId = uuidv4();

      this.logger.log(
        `Creating open question: ${questionData.questionText.substring(0, 50)}...`,
      );
      this.logger.debug(`Question data: ${JSON.stringify(questionData)}`);

      // Extract keywords if not provided by user
      let keywords: KeywordWithFrequency[] = [];
      if (questionData.userKeywords && questionData.userKeywords.length > 0) {
        keywords = questionData.userKeywords.map((keyword) => ({
          word: keyword,
          frequency: 1,
          source: 'user' as const,
        }));
      } else {
        try {
          const extractionResult =
            await this.keywordExtractionService.extractKeywords({
              text: questionData.questionText,
              userKeywords: questionData.userKeywords,
            });
          keywords = extractionResult.keywords;
        } catch (error) {
          this.logger.warn(
            `Keyword extraction failed for open question: ${error.message}`,
          );
          keywords = [];
        }
      }

      // Process keywords to ensure Word nodes exist
      if (keywords.length > 0) {
        await this.processKeywordsForCreation(keywords, questionData);
      }

      // Validate categories if provided
      if (questionData.categoryIds && questionData.categoryIds.length > 0) {
        await this.validateCategories(questionData.categoryIds);
      }

      const questionNodeData: OpenQuestionNodeData = {
        id: questionId,
        createdBy: questionData.createdBy,
        publicCredit: questionData.publicCredit,
        questionText: questionData.questionText,
        keywords,
        categoryIds: questionData.categoryIds,
        initialComment: questionData.initialComment,
      };

      // Create the open question node
      const result =
        await this.openQuestionSchema.createOpenQuestion(questionNodeData);

      // Create discussion for the question
      if (questionData.initialComment && questionData.initialComment.trim()) {
        try {
          await this.discussionService.createDiscussion({
            createdBy: questionData.createdBy,
            associatedNodeId: questionId,
            associatedNodeType: 'OpenQuestionNode',
            initialComment: questionData.initialComment,
          });
        } catch (error) {
          this.logger.warn(
            `Discussion creation failed for open question ${questionId}: ${error.message}`,
          );
          // Continue - question created successfully even if discussion fails
        }
      }

      this.logger.log(
        `Successfully created open question with ID: ${result.id}`,
      );
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
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
   */
  async getOpenQuestion(id: string, options: GetOpenQuestionOptions = {}) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting open question with ID: ${id}`);
      const question = await this.openQuestionSchema.getOpenQuestion(id);

      if (!question) {
        this.logger.debug(`Open question with ID ${id} not found`);
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      // If includeDiscussion is requested, fetch and attach discussion
      if (options.includeDiscussion && question.discussionId) {
        question.discussion = await this.discussionService.getDiscussion(
          question.discussionId,
        );
      }

      // If includeAnswers is requested, fetch Answer nodes (not Statement nodes)
      if (options.includeAnswers) {
        try {
          const answers = await this.answerService.getAnswersForQuestion(id);
          question.answers = answers;
        } catch (error) {
          this.logger.warn(
            `Failed to fetch answers for question ${id}: ${error.message}`,
          );
          question.answers = [];
        }
      }

      return question;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve open question: ${error.message}`,
      );
    }
  }

  /**
   * Update an open question
   */
  async updateOpenQuestion(id: string, updateData: UpdateOpenQuestionData) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      // Validate update data
      this.validateUpdateQuestionData(updateData);

      this.logger.log(
        `Updating open question ${id}: ${JSON.stringify(updateData)}`,
      );

      // If question text is being updated, re-extract keywords
      if (updateData.questionText) {
        return this.updateQuestionWithKeywords(id, updateData);
      }

      // If only other fields are being updated, no need to re-extract keywords
      const updatedQuestion = await this.openQuestionSchema.updateOpenQuestion(
        id,
        updateData,
      );
      if (!updatedQuestion) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      this.logger.log(`Successfully updated open question: ${id}`);
      return updatedQuestion;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update open question: ${error.message}`,
      );
    }
  }

  /**
   * Delete an open question
   */
  async deleteOpenQuestion(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.log(`Deleting open question: ${id}`);

      // Verify question exists
      const question = await this.getOpenQuestion(id);
      if (!question) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      await this.openQuestionSchema.deleteOpenQuestion(id);

      this.logger.log(`Successfully deleted open question: ${id}`);
      return { success: true, message: 'Open question deleted successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete open question: ${error.message}`,
      );
    }
  }

  // NETWORK AND LISTING

  /**
   * Get open question network for display
   */
  async getOpenQuestionNetwork(
    options: GetOpenQuestionNetworkOptions,
  ): Promise<any[]> {
    try {
      this.logger.debug(
        `Getting open question network with options: ${JSON.stringify(options)}`,
      );

      const validatedOptions = {
        limit: options.limit !== undefined ? Number(options.limit) : undefined,
        offset:
          options.offset !== undefined ? Number(options.offset) : undefined,
        sortBy: options.sortBy || 'netPositive',
        sortDirection: options.sortDirection || 'desc',
        keywords: options.keywords || [],
        userId: options.userId,
      };

      return await this.openQuestionSchema.getOpenQuestionNetwork(
        validatedOptions,
      );
    } catch (error) {
      this.logger.error(
        `Error getting open question network: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get open question network: ${error.message}`,
      );
    }
  }

  // VISIBILITY MANAGEMENT

  /**
   * Set visibility status for an open question
   */
  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      if (typeof isVisible !== 'boolean') {
        throw new BadRequestException('isVisible must be a boolean value');
      }

      this.logger.log(
        `Setting visibility for open question ${id}: ${isVisible}`,
      );

      const updatedQuestion = await this.openQuestionSchema.setVisibilityStatus(
        id,
        isVisible,
      );
      if (!updatedQuestion) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      this.logger.debug(
        `Visibility status updated for open question ${id}: ${isVisible}`,
      );
      return updatedQuestion;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error setting visibility for open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to set open question visibility: ${error.message}`,
      );
    }
  }

  /**
   * Get visibility status for an open question
   */
  async getVisibilityStatus(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting visibility status for open question ${id}`);
      const status = await this.openQuestionSchema.getVisibilityStatus(id);

      return { isVisible: status };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting visibility status for open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get open question visibility status: ${error.message}`,
      );
    }
  }

  // VOTING METHODS - INCLUSION ONLY (OpenQuestions don't have content voting)

  /**
   * Vote for open question inclusion
   */
  async voteOpenQuestionInclusion(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Processing inclusion vote on open question ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      return await this.openQuestionSchema.voteOpenQuestionInclusion(
        id,
        sub,
        isPositive,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error voting on open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on open question: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for an open question by a specific user
   */
  async getOpenQuestionVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      return await this.openQuestionSchema.getOpenQuestionVoteStatus(id, sub);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting vote status for open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get open question vote status: ${error.message}`,
      );
    }
  }

  /**
   * Remove vote from an open question
   */
  async removeOpenQuestionVote(id: string, sub: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(`Removing vote from open question ${id} by user ${sub}`);

      return await this.openQuestionSchema.removeOpenQuestionVote(id, sub);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error removing vote from open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to remove vote: ${error.message}`,
      );
    }
  }

  /**
   * Get vote counts for an open question
   */
  async getOpenQuestionVotes(id: string): Promise<VoteResult | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting votes for open question ${id}`);
      return await this.openQuestionSchema.getOpenQuestionVotes(id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting votes for open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get votes: ${error.message}`,
      );
    }
  }

  // NEW: ANSWER INTEGRATION - Replacing Statement-based workflow

  /**
   * Create an Answer for this open question
   * NEW: Replaces createAnswerStatement() - now uses AnswerService
   */
  async createAnswerForQuestion(
    questionId: string,
    answerData: CreateAnswerForQuestionData,
    createdBy: string,
  ) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Question ID is required');
      }

      this.logger.log(`Creating answer for question ${questionId}`);

      // Verify the question exists and has passed inclusion threshold
      const question = await this.getOpenQuestion(questionId);
      if (!question) {
        throw new NotFoundException(
          `Open question with ID ${questionId} not found`,
        );
      }

      // Check if question has passed inclusion threshold (required for answer creation)
      const questionVotes = await this.getOpenQuestionVotes(questionId);
      if (!questionVotes || questionVotes.inclusionNetVotes <= 0) {
        throw new BadRequestException(
          'Question must pass inclusion threshold before answers can be created',
        );
      }

      // Prepare answer data for AnswerService
      const answerCreationData = {
        answerText: answerData.answerText,
        publicCredit: answerData.publicCredit,
        parentQuestionId: questionId,
        categoryIds: answerData.categoryIds,
        userKeywords: answerData.userKeywords,
        initialComment: answerData.initialComment,
        createdBy,
      };

      // Create the answer using AnswerService
      const answer = await this.answerService.createAnswer(answerCreationData);

      this.logger.debug(
        `Created answer ${answer.id} for question ${questionId}`,
      );
      return answer;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error creating answer for question: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create answer for question: ${error.message}`,
      );
    }
  }

  /**
   * Get all answers for this open question
   * NEW: Returns Answer nodes instead of Statement nodes
   */
  async getQuestionAnswers(
    questionId: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'created' | 'inclusion_votes' | 'content_votes';
      sortDirection?: 'asc' | 'desc';
      onlyApproved?: boolean;
    } = {},
  ) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Question ID is required');
      }

      this.logger.debug(`Getting answers for question ${questionId}`);

      // Verify question exists
      const question = await this.getOpenQuestion(questionId);
      if (!question) {
        throw new NotFoundException(
          `Open question with ID ${questionId} not found`,
        );
      }

      // Get answers using AnswerService
      return await this.answerService.getAnswersForQuestion(
        questionId,
        options,
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting answers for question ${questionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get question answers: ${error.message}`,
      );
    }
  }

  /**
   * Get an open question with its answers included
   * NEW: Includes Answer nodes instead of Statement nodes
   */
  async getQuestionWithAnswers(questionId: string) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Question ID is required');
      }

      this.logger.debug(`Getting question with answers: ${questionId}`);

      // Get question with answers included
      const question = await this.getOpenQuestion(questionId, {
        includeAnswers: true,
      });

      return question;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting question with answers ${questionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get question with answers: ${error.message}`,
      );
    }
  }

  // DISCOVERY METHODS - Delegating to OpenQuestionSchema

  /**
   * Get related content that shares categories with the given open question
   */
  async getRelatedContentBySharedCategories(
    questionId: string,
    options: DiscoveryOptions = {},
  ) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(
        `Getting related content for open question ${questionId} with options: ${JSON.stringify(options)}`,
      );

      return await this.openQuestionSchema.getRelatedContentBySharedCategories(
        questionId,
        options,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting related content for open question ${questionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get related content: ${error.message}`,
      );
    }
  }

  /**
   * Get categories associated with an open question
   */
  async getOpenQuestionCategories(questionId: string) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting categories for open question ${questionId}`);

      return await this.openQuestionSchema.getNodeCategories(questionId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting categories for open question ${questionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get open question categories: ${error.message}`,
      );
    }
  }

  // QUESTION RELATIONSHIPS - Direct question-to-question relationships

  /**
   * Create a related question with a direct relationship
   */
  async createRelatedQuestion(
    existingQuestionId: string,
    questionData: CreateOpenQuestionData,
  ) {
    try {
      if (!existingQuestionId || existingQuestionId.trim() === '') {
        throw new BadRequestException('Existing question ID is required');
      }

      this.logger.log(`Creating related question to: ${existingQuestionId}`);

      // Verify existing question exists
      const existingQuestion = await this.getOpenQuestion(existingQuestionId);
      if (!existingQuestion) {
        throw new NotFoundException(
          `Open question with ID ${existingQuestionId} not found`,
        );
      }

      // Create the new question
      const newQuestion = await this.createOpenQuestion(questionData);

      // Create the direct relationship between the questions
      await this.createDirectRelationship(existingQuestionId, newQuestion.id);

      this.logger.debug(
        `Created new question ${newQuestion.id} related to ${existingQuestionId}`,
      );
      return newQuestion;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error creating related question: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create related question: ${error.message}`,
      );
    }
  }

  /**
   * Create a direct relationship between two open questions
   */
  async createDirectRelationship(questionId1: string, questionId2: string) {
    try {
      if (!questionId1 || !questionId2) {
        throw new BadRequestException('Both question IDs are required');
      }

      if (questionId1 === questionId2) {
        throw new BadRequestException(
          'Cannot create a relationship between a question and itself',
        );
      }

      this.logger.log(
        `Creating direct relationship between questions ${questionId1} and ${questionId2}`,
      );

      // Verify both questions exist
      const question1 = await this.getOpenQuestion(questionId1);
      const question2 = await this.getOpenQuestion(questionId2);

      if (!question1 || !question2) {
        throw new NotFoundException('One or both questions not found');
      }

      await this.openQuestionSchema.createDirectRelationship(
        questionId1,
        questionId2,
      );

      this.logger.debug(
        `Direct relationship created successfully between ${questionId1} and ${questionId2}`,
      );
      return { success: true };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error creating direct relationship: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create direct relationship: ${error.message}`,
      );
    }
  }

  /**
   * Remove a direct relationship between two open questions
   */
  async removeDirectRelationship(questionId1: string, questionId2: string) {
    try {
      if (!questionId1 || !questionId2) {
        throw new BadRequestException('Both question IDs are required');
      }

      this.logger.log(
        `Removing direct relationship between questions ${questionId1} and ${questionId2}`,
      );

      await this.openQuestionSchema.removeDirectRelationship(
        questionId1,
        questionId2,
      );

      this.logger.debug(
        `Direct relationship removed successfully between ${questionId1} and ${questionId2}`,
      );
      return { success: true };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error removing direct relationship: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to remove direct relationship: ${error.message}`,
      );
    }
  }

  /**
   * Get all open questions directly related to the given question
   */
  async getDirectlyRelatedQuestions(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting directly related questions for: ${id}`);
      return await this.openQuestionSchema.getDirectlyRelatedQuestions(id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting directly related questions for ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get directly related questions: ${error.message}`,
      );
    }
  }

  // DISCUSSION & COMMENT INTEGRATION

  /**
   * Get open question with its discussion
   */
  async getOpenQuestionWithDiscussion(id: string) {
    return this.getOpenQuestion(id, { includeDiscussion: true });
  }

  /**
   * Get comments for an open question's discussion
   */
  async getOpenQuestionComments(id: string) {
    try {
      const question = await this.getOpenQuestion(id);

      if (!question.discussionId) {
        return { comments: [] };
      }

      const comments = await this.commentService.getCommentsByDiscussionId(
        question.discussionId,
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
        `Error getting comments for open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get open question comments: ${error.message}`,
      );
    }
  }

  /**
   * Add comment to an open question's discussion
   */
  async addOpenQuestionComment(
    id: string,
    commentData: { commentText: string; parentCommentId?: string },
    createdBy: string,
  ) {
    try {
      const question = await this.getOpenQuestion(id);

      if (!question.discussionId) {
        throw new Error(
          `Open question ${id} is missing its discussion - this should not happen`,
        );
      }

      // Create the comment
      const comment = await this.commentService.createComment({
        createdBy,
        discussionId: question.discussionId,
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
        `Error adding comment to open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to add open question comment: ${error.message}`,
      );
    }
  }

  // UTILITY METHODS

  /**
   * Check if an open question has passed the inclusion threshold
   */
  async isOpenQuestionApproved(id: string): Promise<boolean> {
    try {
      const votes = await this.getOpenQuestionVotes(id);
      return votes ? votes.inclusionNetVotes > 0 : false;
    } catch (error) {
      this.logger.error(
        `Error checking approval status for open question ${id}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get open question statistics
   */
  async getOpenQuestionStats(id: string) {
    try {
      const [question, votes, categories, answers] = await Promise.all([
        this.getOpenQuestion(id),
        this.getOpenQuestionVotes(id),
        this.getOpenQuestionCategories(id),
        this.getQuestionAnswers(id),
      ]);

      const isApproved = votes ? votes.inclusionNetVotes > 0 : false;

      return {
        id: question.id,
        questionText: question.questionText,
        categories: categories || [],
        answerCount: answers?.length || 0,
        votes: votes || {
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
        },
        isApproved,
        answerCreationAvailable: isApproved, // Answer creation available when question is approved
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting stats for open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get open question stats: ${error.message}`,
      );
    }
  }

  /**
   * Utility method for checking open questions count
   */
  async checkOpenQuestions(): Promise<{ count: number }> {
    try {
      return await this.openQuestionSchema.checkOpenQuestions();
    } catch (error) {
      this.logger.error(
        `Error checking open questions: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to check open questions: ${error.message}`,
      );
    }
  }

  // PRIVATE HELPER METHODS

  /**
   * Validate open question creation data
   */
  private validateCreateQuestionData(
    questionData: CreateOpenQuestionData,
  ): void {
    if (!questionData.questionText || questionData.questionText.trim() === '') {
      throw new BadRequestException('Question text is required');
    }

    if (questionData.questionText.length > TEXT_LIMITS.MAX_QUESTION_LENGTH) {
      throw new BadRequestException(
        `Question text must not exceed ${TEXT_LIMITS.MAX_QUESTION_LENGTH} characters`,
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

      if (updateData.questionText.length > TEXT_LIMITS.MAX_QUESTION_LENGTH) {
        throw new BadRequestException(
          `Question text must not exceed ${TEXT_LIMITS.MAX_QUESTION_LENGTH} characters`,
        );
      }
    }

    if (
      updateData.publicCredit !== undefined &&
      typeof updateData.publicCredit !== 'boolean'
    ) {
      throw new BadRequestException('Public credit must be a boolean value');
    }
  }

  /**
   * Update open question with keyword re-extraction
   */
  private async updateQuestionWithKeywords(
    id: string,
    updateData: UpdateOpenQuestionData,
  ) {
    const originalQuestion = await this.getOpenQuestion(id);
    if (!originalQuestion) {
      throw new NotFoundException(`Open question with ID ${id} not found`);
    }

    // Extract keywords for the new text
    let keywords: KeywordWithFrequency[] = [];
    if (updateData.userKeywords && updateData.userKeywords.length > 0) {
      keywords = updateData.userKeywords.map((keyword) => ({
        word: keyword,
        frequency: 1,
        source: 'user' as const,
      }));
    } else if (updateData.questionText) {
      try {
        const extractionResult =
          await this.keywordExtractionService.extractKeywords({
            text: updateData.questionText,
            userKeywords: updateData.userKeywords,
          });
        keywords = extractionResult.keywords;
      } catch (error) {
        this.logger.warn(
          `Keyword extraction failed during update: ${error.message}`,
        );
        keywords = [];
      }
    }

    // Process keywords to ensure Word nodes exist
    if (keywords.length > 0) {
      await this.processKeywordsForCreation(keywords, {
        createdBy: originalQuestion.createdBy,
        questionText: updateData.questionText || originalQuestion.questionText,
        publicCredit:
          updateData.publicCredit !== undefined
            ? updateData.publicCredit
            : originalQuestion.publicCredit,
        initialComment: '', // Not used for updates
      });
    }

    // Prepare update data with keywords
    const updateDataWithKeywords = {
      ...updateData,
      keywords,
    };

    const updatedQuestion = await this.openQuestionSchema.updateOpenQuestion(
      id,
      updateDataWithKeywords,
    );
    if (!updatedQuestion) {
      throw new NotFoundException(`Open question with ID ${id} not found`);
    }

    return updatedQuestion;
  }

  /**
   * Process keywords to ensure Word nodes exist before question creation/update
   */
  private async processKeywordsForCreation(
    keywords: KeywordWithFrequency[],
    questionData: {
      createdBy: string;
      questionText: string;
      publicCredit: boolean;
      initialComment: string;
    },
  ): Promise<void> {
    const newWordPromises = keywords.map(async (keyword) => {
      try {
        const wordExists = await this.wordService.checkWordExistence(
          keyword.word,
        );
        if (!wordExists) {
          // Create new word if it doesn't exist
          await this.wordService.createWord({
            word: keyword.word,
            createdBy: questionData.createdBy,
            publicCredit: questionData.publicCredit,
            discussion: `Word created from open question: "${questionData.questionText.substring(0, 100)}..."`,
          });
        }
      } catch (error) {
        this.logger.warn(
          `Failed to create word '${keyword.word}': ${error.message}`,
        );
        // Continue with other keywords even if one fails
      }
    });

    // Wait for all word creation processes to complete
    await Promise.all(newWordPromises);
  }

  /**
   * Validate categories exist and are approved for use
   */
  private async validateCategories(categoryIds: string[]): Promise<void> {
    if (!categoryIds || categoryIds.length === 0) return;

    const validationPromises = categoryIds.map(async (categoryId) => {
      const isApproved =
        await this.categoryService.isCategoryApproved(categoryId);
      if (!isApproved) {
        throw new BadRequestException(
          `Category ${categoryId} must be approved before use`,
        );
      }
    });

    await Promise.all(validationPromises);
  }
}
