// src/nodes/statement/statement.service.ts - COMPLETE FIXED VERSION FOR BaseNodeSchema Integration

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
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
  parentStatementId?: string;
}

interface UpdateStatementData {
  statement?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  keywords?: KeywordWithFrequency[]; // Add this for internal processing
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

// Note: DiscoveryOptions interface removed as it's not currently used
// Can be re-added when implementing discovery functionality

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

  // CRUD OPERATIONS - HYBRID PATTERN IMPLEMENTATION

  /**
   * Create a new statement - UPDATED: Discussion creation is mandatory
   */
  async createStatement(statementData: CreateStatementData) {
    try {
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
          this.logger.error(`Keyword extraction failed: ${error.message}`);
          throw new InternalServerErrorException(
            `Failed to extract keywords: ${error.message}`,
          );
        }
      }

      // Create missing words if they don't exist
      for (const keyword of keywords) {
        const wordExists = await this.wordService.checkWordExistence(
          keyword.word,
        );
        if (!wordExists) {
          try {
            await this.wordService.createWord({
              word: keyword.word,
              createdBy: statementData.createdBy,
              publicCredit: statementData.publicCredit,
            });
            this.logger.debug(`Created missing word: ${keyword.word}`);
          } catch (error) {
            this.logger.warn(
              `Failed to create word ${keyword.word}: ${error.message}`,
            );
          }
        }
      }

      const statementNodeData: StatementNodeData = {
        id: statementId,
        createdBy: statementData.createdBy,
        publicCredit: statementData.publicCredit,
        statement: statementData.statement.trim(),
        keywords,
        categoryIds: statementData.categoryIds || [],
        initialComment: statementData.initialComment.trim(),
        parentStatementId: statementData.parentStatementId,
      };

      // ✅ FIXED: Create statement first
      const result =
        await this.statementSchema.createStatement(statementNodeData);

      // ✅ MANDATORY: Create discussion for statement - MUST SUCCEED
      try {
        this.logger.debug(
          `Creating mandatory discussion for statement: ${result.id}`,
        );
        const discussion = await this.discussionService.createDiscussion({
          createdBy: statementData.createdBy,
          associatedNodeId: result.id,
          associatedNodeType: 'StatementNode',
          initialComment: statementData.initialComment,
        });

        // Update statement with discussion ID
        await this.statementSchema.update(result.id, {
          discussionId: discussion.id,
        });

        this.logger.log(
          `Successfully created statement with discussion: ${result.id}`,
        );

        // Return the statement with discussionId included
        return {
          ...result,
          discussionId: discussion.id,
        };
      } catch (error) {
        // ✅ CRITICAL: If discussion creation fails, DELETE the statement to maintain consistency
        this.logger.error(
          `Failed to create mandatory discussion for statement ${result.id}: ${error.message}`,
        );

        try {
          await this.statementSchema.delete(result.id);
          this.logger.warn(
            `Cleaned up statement ${result.id} due to discussion creation failure`,
          );
        } catch (deleteError) {
          this.logger.error(
            `Failed to cleanup statement ${result.id}: ${deleteError.message}`,
          );
        }

        throw new InternalServerErrorException(
          'Failed to create discussion for statement - statement creation aborted',
        );
      }
    } catch (error) {
      this.handleError(error, 'create statement');
    }
  }

  /**
   * Get comments for a statement
   * UPDATED: Assumes statement always has discussionId
   */
  async getStatementComments(id: string) {
    try {
      this.validateId(id);

      this.logger.log(`Getting comments for statement: ${id}`);

      const statement = await this.getStatement(id);

      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      // ✅ ARCHITECTURAL CONSTRAINT: All statements MUST have discussionId
      if (!statement.discussionId) {
        this.logger.error(
          `CRITICAL: Statement ${id} missing discussionId - data integrity violation!`,
        );
        throw new InternalServerErrorException(
          `Statement ${id} is in an invalid state - missing required discussion`,
        );
      }

      try {
        const comments = await this.commentService.getCommentsByDiscussionId(
          statement.discussionId,
        );
        return { comments };
      } catch (error) {
        this.logger.warn(
          `Failed to get comments for discussion ${statement.discussionId}: ${error.message}`,
        );
        // Return empty comments rather than fail - discussion exists but comment retrieval failed
        return { comments: [] };
      }
    } catch (error) {
      this.handleError(error, `get comments for statement ${id}`);
    }
  }

  /**
   * Add comment to statement
   * UPDATED: Assumes statement always has discussionId
   */
  async addStatementComment(
    statementId: string,
    commentData: { commentText: string; parentCommentId?: string },
    userId: string,
  ) {
    try {
      this.validateId(statementId);
      this.validateUserId(userId);

      if (!commentData.commentText || commentData.commentText.trim() === '') {
        throw new BadRequestException('Comment text is required');
      }

      this.logger.log(
        `Adding comment to statement ${statementId} by user ${userId}`,
      );

      // Get statement to ensure it exists
      const statement = await this.getStatement(statementId);

      if (!statement) {
        throw new NotFoundException(
          `Statement with ID ${statementId} not found`,
        );
      }

      // ✅ ARCHITECTURAL CONSTRAINT: All statements MUST have discussionId
      if (!statement.discussionId) {
        this.logger.error(
          `CRITICAL: Statement ${statementId} missing discussionId - data integrity violation!`,
        );
        throw new InternalServerErrorException(
          `Statement ${statementId} is in an invalid state - missing required discussion`,
        );
      }

      // Create the comment (discussion is guaranteed to exist)
      try {
        const comment = await this.commentService.createComment({
          createdBy: userId,
          discussionId: statement.discussionId,
          commentText: commentData.commentText.trim(),
          parentCommentId: commentData.parentCommentId,
        });

        this.logger.log(
          `Successfully added comment to statement ${statementId}`,
        );
        return comment;
      } catch (error) {
        this.logger.error(`Failed to create comment: ${error.message}`);
        throw new InternalServerErrorException('Failed to create comment');
      }
    } catch (error) {
      this.handleError(error, `add comment to statement ${statementId}`);
    }
  }

  /**
   * Get statement with its discussion (convenience method)
   * UPDATED: Assumes statement always has discussionId
   */
  async getStatementWithDiscussion(id: string) {
    try {
      this.validateId(id);

      this.logger.log(`Getting statement with discussion: ${id}`);

      const statement = await this.getStatement(id);

      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      // ✅ ARCHITECTURAL CONSTRAINT: All statements MUST have discussionId
      if (!statement.discussionId) {
        this.logger.error(
          `CRITICAL: Statement ${id} missing discussionId - data integrity violation!`,
        );
        throw new InternalServerErrorException(
          `Statement ${id} is in an invalid state - missing required discussion`,
        );
      }

      // Statement already includes discussionId - return as-is
      // The enhanced getStatement() method should handle any discussion integration
      return statement;
    } catch (error) {
      this.handleError(error, `get statement with discussion ${id}`);
    }
  }

  /**
   * Get statement by ID - Uses enhanced getStatement() method
   */
  async getStatement(id: string) {
    try {
      this.validateId(id);

      // ✅ Use enhanced domain method for complex retrieval
      const statement = await this.statementSchema.getStatement(id);

      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      return statement;
    } catch (error) {
      this.handleError(error, `get statement ${id}`);
    }
  }

  /**
   * Update statement - Hybrid approach: enhanced for complex updates, BaseNodeSchema for simple ones
   */
  async updateStatement(id: string, updateData: UpdateStatementData) {
    try {
      this.validateId(id);
      this.validateUpdateStatementData(updateData);

      // Check if this is a complex update (statement text or keywords changed)
      const isComplexUpdate = updateData.statement || updateData.userKeywords;

      if (isComplexUpdate) {
        // ✅ Use enhanced domain method for complex updates
        return await this.performComplexStatementUpdate(id, updateData);
      } else {
        // ✅ Use BaseNodeSchema method for simple updates
        const result = await this.statementSchema.update(id, updateData);

        if (!result) {
          throw new NotFoundException(`Statement with ID ${id} not found`);
        }

        this.logger.log(`Successfully updated statement: ${id}`);
        return result;
      }
    } catch (error) {
      this.handleError(error, `update statement ${id}`);
    }
  }

  /**
   * Delete statement - Uses BaseNodeSchema method
   */
  async deleteStatement(id: string) {
    try {
      this.validateId(id);

      this.logger.log(`Deleting statement: ${id}`);

      // Check if statement exists first using enhanced method
      const statement = await this.getStatement(id);
      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      // ✅ Use BaseNodeSchema method for standard deletion
      await this.statementSchema.delete(id);

      this.logger.log(`Successfully deleted statement: ${id}`);
      return { success: true, message: 'Statement deleted successfully' };
    } catch (error) {
      this.handleError(error, `delete statement ${id}`);
    }
  }

  // NETWORK AND LISTING - Uses enhanced domain methods

  /**
   * Get statement network for display - Uses enhanced domain method
   */
  async getStatementNetwork(
    options: GetStatementNetworkOptions = {},
  ): Promise<any[]> {
    try {
      this.logger.debug(
        `Getting statement network with options: ${JSON.stringify(options)}`,
      );

      // ✅ Use enhanced domain method with correct parameter structure
      const result = await this.statementSchema.getStatementNetwork(
        options.limit !== undefined ? Number(options.limit) : 20,
        options.offset !== undefined ? Number(options.offset) : 0,
        options.keywords || [],
        undefined, // categories parameter not used in current schema
        options.userId,
      );

      // Convert Neo4j integer objects to JavaScript numbers
      return result.map((statement) => ({
        ...statement,
        positiveVotes: this.toNumber(statement.positiveVotes),
        negativeVotes: this.toNumber(statement.negativeVotes),
        netVotes: this.toNumber(statement.netVotes),
      }));
    } catch (error) {
      this.handleError(error, 'get statement network');
    }
  }

  // VOTING SYSTEM - Uses BaseNodeSchema methods

  /**
   * Vote on statement inclusion - Uses BaseNodeSchema method
   */
  async voteStatementInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      this.validateId(id);
      this.validateUserId(userId);

      this.logger.log(
        `Voting ${isPositive ? 'positive' : 'negative'} on statement inclusion: ${id}`,
      );

      // ✅ Use BaseNodeSchema method
      return await this.statementSchema.voteInclusion(id, userId, isPositive);
    } catch (error) {
      this.handleError(error, `vote on statement inclusion ${id}`);
    }
  }

  /**
   * Vote on statement content - Uses BaseNodeSchema method with business logic
   */
  async voteStatementContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      this.validateId(id);
      this.validateUserId(userId);

      this.logger.log(
        `Voting ${isPositive ? 'positive' : 'negative'} on statement content: ${id}`,
      );

      // ✅ Use BaseNodeSchema method - it has built-in business logic for content voting threshold
      return await this.statementSchema.voteContent(id, userId, isPositive);
    } catch (error) {
      this.handleError(error, `vote on statement content ${id}`);
    }
  }

  /**
   * Get vote status for a statement by a specific user - Uses BaseNodeSchema method
   */
  async getStatementVoteStatus(
    id: string,
    userId: string,
  ): Promise<VoteStatus | null> {
    try {
      this.validateId(id);
      this.validateUserId(userId);

      // ✅ Use BaseNodeSchema method
      return await this.statementSchema.getVoteStatus(id, userId);
    } catch (error) {
      this.handleError(error, `get vote status for statement ${id}`);
    }
  }

  /**
   * Remove vote from a statement - Uses BaseNodeSchema method
   */
  async removeStatementVote(
    id: string,
    userId: string,
    voteType: 'INCLUSION' | 'CONTENT' = 'INCLUSION',
  ) {
    try {
      this.validateId(id);
      this.validateUserId(userId);

      this.logger.log(
        `Removing ${voteType} vote from statement ${id} by user ${userId}`,
      );

      // ✅ Use BaseNodeSchema method
      return await this.statementSchema.removeVote(id, userId, voteType);
    } catch (error) {
      this.handleError(error, `remove vote from statement ${id}`);
    }
  }

  /**
   * Get vote counts for a statement - Uses BaseNodeSchema method
   */
  async getStatementVotes(id: string): Promise<VoteResult> {
    try {
      this.validateId(id);

      this.logger.debug(`Getting votes for statement ${id}`);

      // ✅ Use BaseNodeSchema method (returns VoteResult, not VoteStatus)
      return await this.statementSchema.getVotes(id);
    } catch (error) {
      this.handleError(error, `get votes for statement ${id}`);
    }
  }

  // RELATIONSHIP MANAGEMENT - Uses enhanced domain methods

  /**
   * Create direct relationship between statements - Uses enhanced domain method
   */
  async createDirectRelationship(statementId1: string, statementId2: string) {
    try {
      this.validateId(statementId1, 'First statement ID');
      this.validateId(statementId2, 'Second statement ID');

      // Verify both statements exist using BaseNodeSchema method
      const statement1 = await this.statementSchema.findById(statementId1);
      const statement2 = await this.statementSchema.findById(statementId2);

      if (!statement1) {
        throw new NotFoundException(
          `First statement with ID ${statementId1} not found`,
        );
      }

      if (!statement2) {
        throw new NotFoundException(
          `Second statement with ID ${statementId2} not found`,
        );
      }

      this.logger.log(
        `Creating direct relationship between statements ${statementId1} and ${statementId2}`,
      );

      // ✅ Use enhanced domain method
      return await this.statementSchema.createDirectRelationship(
        statementId1,
        statementId2,
      );
    } catch (error) {
      this.handleError(
        error,
        `create direct relationship between statements ${statementId1} and ${statementId2}`,
      );
    }
  }

  /**
   * Remove direct relationship between statements - Uses enhanced domain method
   */
  async removeDirectRelationship(statementId1: string, statementId2: string) {
    try {
      this.validateId(statementId1, 'First statement ID');
      this.validateId(statementId2, 'Second statement ID');

      // Verify both statements exist using BaseNodeSchema method
      const statement1 = await this.statementSchema.findById(statementId1);
      const statement2 = await this.statementSchema.findById(statementId2);

      if (!statement1) {
        throw new NotFoundException(
          `First statement with ID ${statementId1} not found`,
        );
      }

      if (!statement2) {
        throw new NotFoundException(
          `Second statement with ID ${statementId2} not found`,
        );
      }

      this.logger.log(
        `Removing direct relationship between statements ${statementId1} and ${statementId2}`,
      );

      // ✅ Use enhanced domain method
      return await this.statementSchema.removeDirectRelationship(
        statementId1,
        statementId2,
      );
    } catch (error) {
      this.handleError(
        error,
        `remove direct relationship between statements ${statementId1} and ${statementId2}`,
      );
    }
  }

  /**
   * Get statements directly related to a statement - Uses enhanced domain method
   */
  async getDirectlyRelatedStatements(id: string) {
    try {
      this.validateId(id);

      // Verify statement exists using enhanced method
      const statement = await this.statementSchema.getStatement(id);
      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      this.logger.debug(`Getting directly related statements for: ${id}`);

      // ✅ Use enhanced domain method
      return await this.statementSchema.getDirectlyRelatedStatements(id);
    } catch (error) {
      this.handleError(error, `get directly related statements for ${id}`);
    }
  }

  /**
   * Create a new statement related to an existing statement - Uses enhanced creation + relationship methods
   */
  async createRelatedStatement(
    existingStatementId: string,
    statementData: CreateStatementData,
  ) {
    try {
      this.validateId(existingStatementId);

      // Verify existing statement exists
      const existingStatement =
        await this.statementSchema.getStatement(existingStatementId);
      if (!existingStatement) {
        throw new NotFoundException(
          `Existing statement with ID ${existingStatementId} not found`,
        );
      }

      this.logger.log(
        `Creating new statement related to existing statement: ${existingStatementId}`,
      );

      // Create the new statement using existing createStatement method
      const newStatement = await this.createStatement(statementData);

      // Create the relationship between the statements
      await this.createDirectRelationship(existingStatementId, newStatement.id);

      this.logger.log(
        `Successfully created related statement ${newStatement.id} linked to ${existingStatementId}`,
      );

      return newStatement;
    } catch (error) {
      this.handleError(
        error,
        `create related statement for ${existingStatementId}`,
      );
    }
  }

  // VISIBILITY MANAGEMENT - Uses enhanced domain methods

  /**
   * Set visibility status for a statement - Uses enhanced domain method
   */
  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      this.validateId(id);

      this.logger.log(
        `Setting visibility status for statement ${id}: ${isVisible}`,
      );

      // ✅ Use enhanced domain method
      const result = await this.statementSchema.setVisibilityStatus(
        id,
        isVisible,
      );

      if (!result) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      this.logger.log(`Successfully updated visibility for statement: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `set visibility status for statement ${id}`);
    }
  }

  /**
   * Get visibility status for a statement - Uses enhanced domain method
   */
  async getVisibilityStatus(id: string) {
    try {
      this.validateId(id);

      this.logger.debug(`Getting visibility status for statement: ${id}`);

      // ✅ Use enhanced domain method
      const status = await this.statementSchema.getVisibilityStatus(id);

      return { isVisible: status };
    } catch (error) {
      this.handleError(error, `get visibility status for statement ${id}`);
    }
  }

  // UTILITY METHODS

  /**
   * Check if statement is approved (has positive net inclusion votes) - Uses BaseNodeSchema method
   */
  async isStatementApproved(id: string): Promise<boolean> {
    try {
      this.validateId(id);

      this.logger.debug(`Checking approval status for statement: ${id}`);

      // ✅ Use BaseNodeSchema method to get votes
      const votes = await this.statementSchema.getVotes(id);

      // Statement is approved if it has positive net inclusion votes
      const isApproved = votes.inclusionNetVotes > 0;

      this.logger.debug(
        `Statement ${id} approval status: ${isApproved} (net votes: ${votes.inclusionNetVotes})`,
      );

      return isApproved;
    } catch (error) {
      this.handleError(error, `check approval status for statement ${id}`);
    }
  }

  /**
   * Check if content voting is available for a statement (minimum inclusion threshold met)
   */
  async isContentVotingAvailable(id: string): Promise<boolean> {
    try {
      this.validateId(id);

      this.logger.debug(
        `Checking content voting availability for statement: ${id}`,
      );

      // Content voting is available when statement has positive inclusion votes
      const isApproved = await this.isStatementApproved(id);

      this.logger.debug(
        `Statement ${id} content voting available: ${isApproved}`,
      );

      return isApproved;
    } catch (error) {
      this.handleError(
        error,
        `check content voting availability for statement ${id}`,
      );
    }
  }

  /**
   * Get statement statistics including vote counts and relationships
   */
  async getStatementStats(id: string): Promise<any> {
    try {
      this.validateId(id);

      this.logger.debug(`Getting statistics for statement: ${id}`);

      // Get the statement to ensure it exists
      const statement = await this.getStatement(id);
      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      // Get vote statistics using BaseNodeSchema method
      const votes = await this.statementSchema.getVotes(id);

      // Calculate additional statistics
      const isApproved = votes.inclusionNetVotes > 0;
      const contentVotingAvailable = isApproved;

      return {
        id,
        votes,
        isApproved,
        contentVotingAvailable,
        // Add more statistics as needed
      };
    } catch (error) {
      this.handleError(error, `get statistics for statement ${id}`);
    }
  }

  /**
   * Get categories associated with a statement
   * IMPLEMENTATION NOTE: Uses the categories returned by getStatement()
   */
  async getStatementCategories(statementId: string) {
    try {
      this.validateId(statementId);

      this.logger.debug(`Getting categories for statement ${statementId}`);

      // Get statement with categories using enhanced method
      const statement = await this.statementSchema.getStatement(statementId);

      if (!statement) {
        throw new NotFoundException(
          `Statement with ID ${statementId} not found`,
        );
      }

      // Return categories from the statement data
      return statement.categories || [];
    } catch (error) {
      this.handleError(error, `get categories for statement ${statementId}`);
    }
  }

  /**
   * Get related content that shares categories with the given statement
   * IMPLEMENTATION NOTE: Placeholder implementation - would need CategoryService integration
   */
  async getRelatedContentBySharedCategories(
    statementId: string,
    options: {
      nodeTypes?: ('statement' | 'answer' | 'openquestion' | 'quantity')[];
      limit?: number;
      offset?: number;
      sortBy?:
        | 'category_overlap'
        | 'created'
        | 'inclusion_votes'
        | 'content_votes';
      sortDirection?: 'asc' | 'desc';
      excludeSelf?: boolean;
      minCategoryOverlap?: number;
    } = {},
  ) {
    try {
      this.validateId(statementId);

      this.logger.debug(
        `Getting related content for statement ${statementId} with options: ${JSON.stringify(options)}`,
      );

      // Get the statement with its categories using enhanced method
      const statement = await this.statementSchema.getStatement(statementId);

      if (!statement) {
        throw new NotFoundException(
          `Statement with ID ${statementId} not found`,
        );
      }

      // For now, return empty array with a note - this would need to be implemented
      // in StatementSchema or use CategoryService to find related content
      this.logger.warn(
        `getRelatedContentBySharedCategories not yet fully implemented - returning empty array`,
      );

      // TODO: Implement category-based discovery logic
      // This could use CategoryService.getNodesUsingCategory() for each category
      // and then filter/sort the results according to the options

      return [];
    } catch (error) {
      this.handleError(
        error,
        `get related content for statement ${statementId}`,
      );
    }
  }

  /**
   * Check statements count - Uses enhanced domain method
   */
  async checkStatements() {
    try {
      // ✅ Use enhanced domain method
      return await this.statementSchema.checkStatements();
    } catch (error) {
      this.handleError(error, 'check statements count');
    }
  }

  // PRIVATE HELPER METHODS

  /**
   * Perform complex statement update with keyword extraction and processing
   */
  private async performComplexStatementUpdate(
    id: string,
    updateData: UpdateStatementData,
  ) {
    // Verify statement exists
    const existingStatement = await this.statementSchema.getStatement(id);
    if (!existingStatement) {
      throw new NotFoundException(`Statement with ID ${id} not found`);
    }

    const processedUpdateData: UpdateStatementData & {
      keywords?: KeywordWithFrequency[];
    } = { ...updateData };

    // Extract keywords if statement text is being updated
    if (updateData.statement) {
      try {
        const extractionResult =
          await this.keywordExtractionService.extractKeywords({
            text: updateData.statement,
            userKeywords: updateData.userKeywords,
          });

        // Create missing words if needed
        for (const keyword of extractionResult.keywords) {
          const wordExists = await this.wordService.checkWordExistence(
            keyword.word,
          );
          if (!wordExists) {
            try {
              await this.wordService.createWord({
                word: keyword.word,
                createdBy: existingStatement.createdBy,
                publicCredit: existingStatement.publicCredit,
              });
              this.logger.debug(`Created missing word: ${keyword.word}`);
            } catch (error) {
              this.logger.warn(
                `Failed to create word ${keyword.word}: ${error.message}`,
              );
            }
          }
        }

        processedUpdateData.keywords = extractionResult.keywords;
      } catch (error) {
        this.logger.error(`Keyword extraction failed: ${error.message}`);
        throw new InternalServerErrorException(
          `Failed to extract keywords: ${error.message}`,
        );
      }
    }

    // ✅ Use enhanced domain method for complex updates
    const result = await this.statementSchema.updateStatement(
      id,
      processedUpdateData,
    );

    if (!result) {
      throw new NotFoundException(`Statement with ID ${id} not found`);
    }

    this.logger.log(`Successfully updated statement: ${id}`);
    return result;
  }

  /**
   * Validate statement creation data
   */
  private validateCreateStatementData(data: CreateStatementData) {
    if (!data.createdBy || data.createdBy.trim() === '') {
      throw new BadRequestException('Created by is required');
    }

    if (typeof data.publicCredit !== 'boolean') {
      throw new BadRequestException('Public credit must be a boolean');
    }

    if (!data.statement || data.statement.trim() === '') {
      throw new BadRequestException('Statement text is required');
    }

    if (data.statement.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
      throw new BadRequestException(
        `Statement must not exceed ${TEXT_LIMITS.MAX_STATEMENT_LENGTH} characters`,
      );
    }

    if (!data.initialComment || data.initialComment.trim() === '') {
      throw new BadRequestException('Initial comment is required');
    }

    // Validate category IDs if provided
    if (data.categoryIds && data.categoryIds.length > 3) {
      throw new BadRequestException(
        'Cannot assign more than 3 categories to a statement',
      );
    }

    // Validate user keywords if provided
    if (data.userKeywords && data.userKeywords.length > 10) {
      throw new BadRequestException(
        'Cannot provide more than 10 user keywords',
      );
    }
  }

  /**
   * Validate statement update data
   */
  private validateUpdateStatementData(data: UpdateStatementData) {
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    if (data.statement !== undefined) {
      if (!data.statement || data.statement.trim() === '') {
        throw new BadRequestException('Statement text cannot be empty');
      }

      if (data.statement.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
        throw new BadRequestException(
          `Statement must not exceed ${TEXT_LIMITS.MAX_STATEMENT_LENGTH} characters`,
        );
      }
    }

    if (
      data.publicCredit !== undefined &&
      typeof data.publicCredit !== 'boolean'
    ) {
      throw new BadRequestException('Public credit must be a boolean');
    }

    if (data.userKeywords && data.userKeywords.length > 10) {
      throw new BadRequestException(
        'Cannot provide more than 10 user keywords',
      );
    }
  }

  /**
   * Validate ID parameter
   */
  private validateId(id: string, paramName = 'ID') {
    if (!id || id.trim() === '') {
      throw new BadRequestException(`${paramName} is required`);
    }
  }

  /**
   * Validate user ID parameter
   */
  private validateUserId(userId: string) {
    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }
  }

  /**
   * Convert Neo4j integer objects to JavaScript numbers
   */
  private toNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (value && typeof value.toNumber === 'function') return value.toNumber();
    return parseInt(value) || 0;
  }

  /**
   * Centralized error handling
   */
  private handleError(error: any, operation: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.logger.error(`Error ${operation}: ${error.message}`, error.stack);
    throw new InternalServerErrorException(
      `Failed to ${operation}: ${error.message}`,
    );
  }
}
