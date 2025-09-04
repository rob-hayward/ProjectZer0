// src/nodes/statement/statement.service.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { CategoryService } from '../category/category.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { v4 as uuidv4 } from 'uuid';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

// Constants
const TEXT_LIMITS = {
  MAX_STATEMENT_LENGTH: 2000,
};

// Interface definitions
interface CreateStatementData {
  createdBy: string;
  publicCredit: boolean;
  statement: string;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment: string;
  parentStatementId?: string; // For statement-to-statement relationships
}

interface UpdateStatementData {
  statement?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
}

interface GetStatementNetworkOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: string;
  keywords?: string[];
  userId?: string;
}

interface StatementNodeData {
  id: string;
  createdBy: string;
  publicCredit: boolean;
  statement: string;
  keywords: KeywordWithFrequency[];
  categoryIds?: string[];
  initialComment: string;
  parentStatementId?: string;
}

interface GetStatementOptions {
  includeDiscussion?: boolean;
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
export class StatementService {
  private readonly logger = new Logger(StatementService.name);

  constructor(
    private readonly statementSchema: StatementSchema,
    private readonly categoryService: CategoryService,
    private readonly discussionService: DiscussionService,
    private readonly commentService: CommentService,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
  ) {}

  // CRUD OPERATIONS

  /**
   * Create a new statement
   */
  async createStatement(statementData: CreateStatementData) {
    try {
      // Validate input data
      this.validateCreateStatementData(statementData);

      const statementId = uuidv4();

      this.logger.log(
        `Creating statement: ${statementData.statement.substring(0, 50)}...`,
      );
      this.logger.debug(`Statement data: ${JSON.stringify(statementData)}`);

      // Extract keywords if not provided by user
      let keywords: KeywordWithFrequency[] = [];
      if (statementData.userKeywords && statementData.userKeywords.length > 0) {
        keywords = statementData.userKeywords.map((keyword) => ({
          word: keyword,
          frequency: 1,
          source: 'user' as const,
        }));
      } else {
        try {
          const extractionResult =
            await this.keywordExtractionService.extractKeywords({
              text: statementData.statement,
              userKeywords: statementData.userKeywords,
            });
          keywords = extractionResult.keywords;
        } catch (error) {
          this.logger.warn(
            `Keyword extraction failed for statement: ${error.message}`,
          );
          keywords = [];
        }
      }

      // Process keywords to ensure Word nodes exist
      if (keywords.length > 0) {
        await this.processKeywordsForCreation(keywords, statementData);
      }

      // Validate categories if provided
      if (statementData.categoryIds && statementData.categoryIds.length > 0) {
        await this.validateCategories(statementData.categoryIds);
      }

      const statementNodeData: StatementNodeData = {
        id: statementId,
        createdBy: statementData.createdBy,
        publicCredit: statementData.publicCredit,
        statement: statementData.statement,
        keywords,
        categoryIds: statementData.categoryIds,
        initialComment: statementData.initialComment,
        parentStatementId: statementData.parentStatementId,
      };

      // Create the statement node
      const result =
        await this.statementSchema.createStatement(statementNodeData);

      // Create discussion for the statement
      if (statementData.initialComment && statementData.initialComment.trim()) {
        try {
          await this.discussionService.createDiscussion({
            createdBy: statementData.createdBy,
            associatedNodeId: statementId,
            associatedNodeType: 'StatementNode',
            initialComment: statementData.initialComment,
          });
        } catch (error) {
          this.logger.warn(
            `Discussion creation failed for statement ${statementId}: ${error.message}`,
          );
          // Continue - statement created successfully even if discussion fails
        }
      }

      this.logger.log(`Successfully created statement with ID: ${result.id}`);
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error creating statement: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create statement: ${error.message}`,
      );
    }
  }

  /**
   * Get a statement by ID
   */
  async getStatement(id: string, options: GetStatementOptions = {}) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting statement with ID: ${id}`);
      const statement = await this.statementSchema.getStatement(id);

      if (!statement) {
        this.logger.debug(`Statement with ID ${id} not found`);
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      // If includeDiscussion is requested, fetch and attach discussion
      if (options.includeDiscussion && statement.discussionId) {
        statement.discussion = await this.discussionService.getDiscussion(
          statement.discussionId,
        );
      }

      return statement;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve statement: ${error.message}`,
      );
    }
  }

  /**
   * Update a statement
   */
  async updateStatement(id: string, updateData: UpdateStatementData) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      // Validate update data
      this.validateUpdateStatementData(updateData);

      this.logger.log(
        `Updating statement ${id}: ${JSON.stringify(updateData)}`,
      );

      // If statement text is being updated, re-extract keywords
      if (updateData.statement) {
        return this.updateStatementWithKeywords(id, updateData);
      }

      // If only other fields are being updated, no need to re-extract keywords
      const updatedStatement = await this.statementSchema.updateStatement(
        id,
        updateData,
      );
      if (!updatedStatement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      this.logger.log(`Successfully updated statement: ${id}`);
      return updatedStatement;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update statement: ${error.message}`,
      );
    }
  }

  /**
   * Delete a statement
   */
  async deleteStatement(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.log(`Deleting statement: ${id}`);

      // Verify statement exists
      const statement = await this.getStatement(id);
      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      await this.statementSchema.deleteStatement(id);

      this.logger.log(`Successfully deleted statement: ${id}`);
      return { success: true, message: 'Statement deleted successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete statement: ${error.message}`,
      );
    }
  }

  // NETWORK AND LISTING

  /**
   * Get statement network for display
   */
  async getStatementNetwork(
    options: GetStatementNetworkOptions,
  ): Promise<any[]> {
    try {
      this.logger.debug(
        `Getting statement network with options: ${JSON.stringify(options)}`,
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

      return await this.statementSchema.getStatementNetwork(validatedOptions);
    } catch (error) {
      this.logger.error(
        `Error getting statement network: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get statement network: ${error.message}`,
      );
    }
  }

  // VISIBILITY MANAGEMENT

  /**
   * Set visibility status for a statement
   */
  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      if (typeof isVisible !== 'boolean') {
        throw new BadRequestException('isVisible must be a boolean value');
      }

      this.logger.log(`Setting visibility for statement ${id}: ${isVisible}`);

      const updatedStatement = await this.statementSchema.setVisibilityStatus(
        id,
        isVisible,
      );
      if (!updatedStatement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      this.logger.debug(
        `Visibility status updated for statement ${id}: ${isVisible}`,
      );
      return updatedStatement;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error setting visibility for statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to set statement visibility: ${error.message}`,
      );
    }
  }

  /**
   * Get visibility status for a statement
   */
  async getVisibilityStatus(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting visibility status for statement ${id}`);
      const status = await this.statementSchema.getVisibilityStatus(id);

      return { isVisible: status };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting visibility status for statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get statement visibility status: ${error.message}`,
      );
    }
  }

  // VOTING METHODS - DUAL VOTING (INCLUSION + CONTENT)

  /**
   * Vote for statement inclusion
   */
  async voteStatementInclusion(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Processing inclusion vote on statement ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      return await this.statementSchema.voteStatementInclusion(
        id,
        sub,
        isPositive,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error voting on statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on statement: ${error.message}`,
      );
    }
  }

  /**
   * Vote for statement content (agreement)
   */
  async voteStatementContent(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Processing content vote on statement ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      return await this.statementSchema.voteStatementContent(
        id,
        sub,
        isPositive,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error voting on statement content ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on statement content: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for a statement by a specific user
   */
  async getStatementVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      return await this.statementSchema.getStatementVoteStatus(id, sub);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting vote status for statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get statement vote status: ${error.message}`,
      );
    }
  }

  /**
   * Remove vote from a statement
   */
  async removeStatementVote(
    id: string,
    sub: string,
    kind: 'INCLUSION' | 'CONTENT' = 'INCLUSION',
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Removing ${kind} vote from statement ${id} by user ${sub}`,
      );

      return await this.statementSchema.removeStatementVote(id, sub, kind);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error removing vote from statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to remove vote: ${error.message}`,
      );
    }
  }

  /**
   * Get vote counts for a statement
   */
  async getStatementVotes(id: string): Promise<VoteResult | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting votes for statement ${id}`);
      return await this.statementSchema.getStatementVotes(id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting votes for statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get votes: ${error.message}`,
      );
    }
  }

  // DISCOVERY METHODS - Delegating to StatementSchema

  /**
   * Get related content that shares categories with the given statement
   */
  async getRelatedContentBySharedCategories(
    statementId: string,
    options: DiscoveryOptions = {},
  ) {
    try {
      if (!statementId || statementId.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(
        `Getting related content for statement ${statementId} with options: ${JSON.stringify(options)}`,
      );

      return await this.statementSchema.getRelatedContentBySharedCategories(
        statementId,
        options,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting related content for statement ${statementId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get related content: ${error.message}`,
      );
    }
  }

  /**
   * Get categories associated with a statement
   */
  async getStatementCategories(statementId: string) {
    try {
      if (!statementId || statementId.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting categories for statement ${statementId}`);

      return await this.statementSchema.getNodeCategories(statementId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting categories for statement ${statementId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get statement categories: ${error.message}`,
      );
    }
  }

  // STATEMENT RELATIONSHIPS - Direct statement-to-statement relationships only

  /**
   * Create a related statement with a direct relationship
   */
  async createRelatedStatement(
    existingStatementId: string,
    statementData: CreateStatementData,
  ) {
    try {
      if (!existingStatementId || existingStatementId.trim() === '') {
        throw new BadRequestException('Existing statement ID is required');
      }

      this.logger.log(`Creating related statement to: ${existingStatementId}`);

      // Verify existing statement exists
      const existingStatement = await this.getStatement(existingStatementId);
      if (!existingStatement) {
        throw new NotFoundException(
          `Statement with ID ${existingStatementId} not found`,
        );
      }

      // Create the new statement
      const newStatement = await this.createStatement(statementData);

      // Create the direct relationship between the statements
      await this.createDirectRelationship(existingStatementId, newStatement.id);

      this.logger.debug(
        `Created new statement ${newStatement.id} related to ${existingStatementId}`,
      );
      return newStatement;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error creating related statement: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create related statement: ${error.message}`,
      );
    }
  }

  /**
   * Create a direct relationship between two statements
   */
  async createDirectRelationship(statementId1: string, statementId2: string) {
    try {
      if (!statementId1 || !statementId2) {
        throw new BadRequestException('Both statement IDs are required');
      }

      if (statementId1 === statementId2) {
        throw new BadRequestException(
          'Cannot create a relationship between a statement and itself',
        );
      }

      this.logger.log(
        `Creating direct relationship between statements ${statementId1} and ${statementId2}`,
      );

      // Verify both statements exist
      const statement1 = await this.getStatement(statementId1);
      const statement2 = await this.getStatement(statementId2);

      if (!statement1 || !statement2) {
        throw new NotFoundException('One or both statements not found');
      }

      await this.statementSchema.createDirectRelationship(
        statementId1,
        statementId2,
      );

      this.logger.debug(
        `Direct relationship created successfully between ${statementId1} and ${statementId2}`,
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
   * Remove a direct relationship between two statements
   */
  async removeDirectRelationship(statementId1: string, statementId2: string) {
    try {
      if (!statementId1 || !statementId2) {
        throw new BadRequestException('Both statement IDs are required');
      }

      this.logger.log(
        `Removing direct relationship between statements ${statementId1} and ${statementId2}`,
      );

      await this.statementSchema.removeDirectRelationship(
        statementId1,
        statementId2,
      );

      this.logger.debug(
        `Direct relationship removed successfully between ${statementId1} and ${statementId2}`,
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
   * Get all statements directly related to the given statement
   */
  async getDirectlyRelatedStatements(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting directly related statements for: ${id}`);
      return await this.statementSchema.getDirectlyRelatedStatements(id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting directly related statements for ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get directly related statements: ${error.message}`,
      );
    }
  }

  // DISCUSSION & COMMENT INTEGRATION

  /**
   * Get statement with its discussion
   */
  async getStatementWithDiscussion(id: string) {
    return this.getStatement(id, { includeDiscussion: true });
  }

  /**
   * Get comments for a statement's discussion
   */
  async getStatementComments(id: string) {
    try {
      const statement = await this.getStatement(id);

      if (!statement.discussionId) {
        return { comments: [] };
      }

      const comments = await this.commentService.getCommentsByDiscussionId(
        statement.discussionId,
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
        `Error getting comments for statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get statement comments: ${error.message}`,
      );
    }
  }

  /**
   * Add comment to a statement's discussion
   */
  async addStatementComment(
    id: string,
    commentData: { commentText: string; parentCommentId?: string },
    createdBy: string,
  ) {
    try {
      const statement = await this.getStatement(id);

      if (!statement.discussionId) {
        throw new Error(
          `Statement ${id} is missing its discussion - this should not happen`,
        );
      }

      // Create the comment
      const comment = await this.commentService.createComment({
        createdBy,
        discussionId: statement.discussionId,
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
        `Error adding comment to statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to add statement comment: ${error.message}`,
      );
    }
  }

  // UTILITY METHODS

  /**
   * Check if a statement has passed the inclusion threshold
   */
  async isStatementApproved(id: string): Promise<boolean> {
    try {
      const votes = await this.getStatementVotes(id);
      return votes ? votes.inclusionNetVotes > 0 : false;
    } catch (error) {
      this.logger.error(
        `Error checking approval status for statement ${id}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Check if content voting is available for a statement
   */
  async isContentVotingAvailable(id: string): Promise<boolean> {
    try {
      return await this.statementSchema.isContentVotingAvailable(id);
    } catch (error) {
      this.logger.error(
        `Error checking content voting availability for statement ${id}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get statement statistics
   */
  async getStatementStats(id: string) {
    try {
      const [statement, votes, categories] = await Promise.all([
        this.getStatement(id),
        this.getStatementVotes(id),
        this.getStatementCategories(id),
      ]);

      const isApproved = votes ? votes.inclusionNetVotes > 0 : false;
      const contentVotingAvailable = await this.isContentVotingAvailable(id);

      return {
        id: statement.id,
        statement: statement.statement,
        categories: categories || [],
        votes: votes || {
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        },
        isApproved,
        contentVotingAvailable,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting stats for statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get statement stats: ${error.message}`,
      );
    }
  }

  /**
   * Utility method for checking statements count
   */
  async checkStatements(): Promise<{ count: number }> {
    try {
      return await this.statementSchema.checkStatements();
    } catch (error) {
      this.logger.error(
        `Error checking statements: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to check statements: ${error.message}`,
      );
    }
  }

  // PRIVATE HELPER METHODS

  /**
   * Validate statement creation data
   */
  private validateCreateStatementData(
    statementData: CreateStatementData,
  ): void {
    if (!statementData.statement || statementData.statement.trim() === '') {
      throw new BadRequestException('Statement text is required');
    }

    if (statementData.statement.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
      throw new BadRequestException(
        `Statement text must not exceed ${TEXT_LIMITS.MAX_STATEMENT_LENGTH} characters`,
      );
    }

    if (!statementData.createdBy || statementData.createdBy.trim() === '') {
      throw new BadRequestException('Creator ID is required');
    }

    if (typeof statementData.publicCredit !== 'boolean') {
      throw new BadRequestException('Public credit flag is required');
    }

    // Validate category count (0-3)
    if (statementData.categoryIds && statementData.categoryIds.length > 3) {
      throw new BadRequestException('Statement can have maximum 3 categories');
    }

    if (
      !statementData.initialComment ||
      statementData.initialComment.trim() === ''
    ) {
      throw new BadRequestException('Initial comment is required');
    }
  }

  /**
   * Validate statement update data
   */
  private validateUpdateStatementData(updateData: UpdateStatementData): void {
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update data provided');
    }

    if (updateData.statement !== undefined) {
      if (!updateData.statement || updateData.statement.trim() === '') {
        throw new BadRequestException('Statement text cannot be empty');
      }

      if (updateData.statement.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
        throw new BadRequestException(
          `Statement text must not exceed ${TEXT_LIMITS.MAX_STATEMENT_LENGTH} characters`,
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
   * Update statement with keyword re-extraction
   */
  private async updateStatementWithKeywords(
    id: string,
    updateData: UpdateStatementData,
  ) {
    const originalStatement = await this.getStatement(id);
    if (!originalStatement) {
      throw new NotFoundException(`Statement with ID ${id} not found`);
    }

    // Extract keywords for the new text
    let keywords: KeywordWithFrequency[] = [];
    if (updateData.userKeywords && updateData.userKeywords.length > 0) {
      keywords = updateData.userKeywords.map((keyword) => ({
        word: keyword,
        frequency: 1,
        source: 'user' as const,
      }));
    } else if (updateData.statement) {
      try {
        const extractionResult =
          await this.keywordExtractionService.extractKeywords({
            text: updateData.statement,
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
        createdBy: originalStatement.createdBy,
        statement: updateData.statement || originalStatement.statement,
        publicCredit:
          updateData.publicCredit !== undefined
            ? updateData.publicCredit
            : originalStatement.publicCredit,
        initialComment: '', // Not used for updates
      });
    }

    // Prepare update data with keywords
    const updateDataWithKeywords = {
      ...updateData,
      keywords,
    };

    const updatedStatement = await this.statementSchema.updateStatement(
      id,
      updateDataWithKeywords,
    );
    if (!updatedStatement) {
      throw new NotFoundException(`Statement with ID ${id} not found`);
    }

    return updatedStatement;
  }

  /**
   * Process keywords to ensure Word nodes exist before statement creation/update
   */
  private async processKeywordsForCreation(
    keywords: KeywordWithFrequency[],
    statementData: {
      createdBy: string;
      statement: string;
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
            createdBy: statementData.createdBy,
            publicCredit: statementData.publicCredit,
            discussion: `Word created from statement: "${statementData.statement.substring(0, 100)}..."`, // Changed from initialComment to discussion
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
