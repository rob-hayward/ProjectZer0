interface DiscoveryOptions {
  nodeTypes?: ('statement' | 'answer' | 'openquestion' | 'quantity')[];
  limit?: number;
  offset?: number;
  sortBy?: 'category_overlap' | 'created' | 'inclusion_votes' | 'content_votes';
  sortDirection?: 'asc' | 'desc';
  excludeSelf?: boolean;
  minCategoryOverlap?: number;
} // src/nodes/statement/statement.service.ts - COMPLETE FIXED VERSION FOR BaseNodeSchema Integration

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
  parentStatementId?: string;
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

      // Create word nodes for any keywords that don't exist
      for (const keyword of keywords) {
        try {
          const wordExists = await this.wordService.checkWordExistence(
            keyword.word,
          );
          if (!wordExists) {
            this.logger.debug(`Creating word node: ${keyword.word}`);
            await this.wordService.createWord({
              word: keyword.word,
              createdBy: statementData.createdBy,
              publicCredit: statementData.publicCredit,
            });
          }
        } catch (error) {
          this.logger.warn(
            `Failed to create word ${keyword.word}: ${error.message}`,
          );
          // Continue with statement creation even if word creation fails
        }
      }

      // Validate categories if provided
      if (statementData.categoryIds && statementData.categoryIds.length > 0) {
        for (const categoryId of statementData.categoryIds) {
          try {
            const category = await this.categoryService.getCategory(categoryId);
            if (!category) {
              throw new BadRequestException(
                `Category with ID ${categoryId} not found`,
              );
            }
          } catch (error) {
            if (error instanceof NotFoundException) {
              throw new BadRequestException(
                `Category with ID ${categoryId} not found`,
              );
            }
            throw error;
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
        const updatedStatement = await this.statementSchema.update(result.id, {
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
        undefined, // categories parameter (not used in current schema method)
        options.userId,
      );

      return result;
    } catch (error) {
      this.handleError(error, 'get statement network');
    }
  }

  // VISIBILITY MANAGEMENT - Uses enhanced domain methods

  /**
   * Set visibility status for a statement - Uses enhanced domain method
   */
  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      this.validateId(id);

      if (typeof isVisible !== 'boolean') {
        throw new BadRequestException('isVisible must be a boolean value');
      }

      this.logger.log(`Setting visibility for statement ${id}: ${isVisible}`);

      // ✅ Use enhanced domain method (preserved for statement-specific visibility logic)
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
      this.handleError(error, `set visibility status for statement ${id}`);
    }
  }

  /**
   * Get visibility status for a statement - Uses enhanced domain method
   */
  async getVisibilityStatus(id: string) {
    try {
      this.validateId(id);

      this.logger.debug(`Getting visibility status for statement ${id}`);

      // ✅ Use enhanced domain method
      const status = await this.statementSchema.getVisibilityStatus(id);

      return { isVisible: status };
    } catch (error) {
      this.handleError(error, `get visibility status for statement ${id}`);
    }
  }

  // VOTING METHODS - DUAL VOTING (INCLUSION + CONTENT) - Uses BaseNodeSchema methods

  /**
   * Vote for statement inclusion - Uses BaseNodeSchema method
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
        `Processing inclusion vote on statement ${id} by user ${userId}: ${isPositive ? 'positive' : 'negative'}`,
      );

      // ✅ Use BaseNodeSchema method for standard voting
      return await this.statementSchema.voteInclusion(id, userId, isPositive);
    } catch (error) {
      this.handleError(error, `vote on statement inclusion ${id}`);
    }
  }

  /**
   * Vote for statement content (agreement) - Uses BaseNodeSchema method with business logic
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
        `Processing content vote on statement ${id} by user ${userId}: ${isPositive ? 'positive' : 'negative'}`,
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
          `Statement with ID ${statementId1} not found`,
        );
      }
      if (!statement2) {
        throw new NotFoundException(
          `Statement with ID ${statementId2} not found`,
        );
      }

      // ✅ Use enhanced domain method for relationship creation
      return await this.statementSchema.createDirectRelationship(
        statementId1,
        statementId2,
      );
    } catch (error) {
      this.handleError(
        error,
        `create relationship between statements ${statementId1} and ${statementId2}`,
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

      // ✅ Use enhanced domain method
      return await this.statementSchema.removeDirectRelationship(
        statementId1,
        statementId2,
      );
    } catch (error) {
      this.handleError(
        error,
        `remove relationship between statements ${statementId1} and ${statementId2}`,
      );
    }
  }

  /**
   * Get directly related statements - Uses enhanced domain method
   */
  async getDirectlyRelatedStatements(id: string) {
    try {
      this.validateId(id);

      // ✅ Use enhanced domain method
      return await this.statementSchema.getDirectlyRelatedStatements(id);
    } catch (error) {
      this.handleError(error, `get directly related statements for ${id}`);
    }
  }

  /**
   * Create a related statement and establish direct relationship
   */
  async createRelatedStatement(
    existingStatementId: string,
    statementData: CreateStatementData,
  ) {
    try {
      this.validateId(existingStatementId);

      // Verify existing statement exists
      const existingStatement =
        await this.statementSchema.findById(existingStatementId);
      if (!existingStatement) {
        throw new NotFoundException(
          `Statement with ID ${existingStatementId} not found`,
        );
      }

      // Create the new statement
      const newStatement = await this.createStatement(statementData);

      // Create direct relationship
      await this.createDirectRelationship(existingStatementId, newStatement.id);

      return newStatement;
    } catch (error) {
      this.handleError(
        error,
        `create related statement for ${existingStatementId}`,
      );
    }
  }

  // DISCOVERY METHODS - Alternative implementations using available data

  /**
   * Get related content that shares categories with the given statement
   * IMPLEMENTATION NOTE: Since StatementSchema doesn't have this method, we'll implement it using getStatement()
   */
  async getRelatedContentBySharedCategories(
    statementId: string,
    options: DiscoveryOptions = {},
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

  /**
   * Check if content voting is available for a statement
   */
  async isContentVotingAvailable(id: string): Promise<boolean> {
    try {
      this.validateId(id);

      // Get statement using BaseNodeSchema method
      const statement = await this.statementSchema.findById(id);

      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      // Check if statement has passed inclusion threshold
      // This logic might be implemented in VotingUtils or similar
      return statement.inclusionNetVotes >= 3; // Example threshold
    } catch (error) {
      this.handleError(
        error,
        `check content voting availability for statement ${id}`,
      );
    }
  }

  /**
   * Get statement statistics
   */
  async getStatementStats(id: string) {
    try {
      this.validateId(id);

      // Get statement using enhanced method
      const statement = await this.getStatement(id);

      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      // Return comprehensive stats
      return {
        id: statement.id,
        inclusionVotes: {
          positive: statement.inclusionPositiveVotes || 0,
          negative: statement.inclusionNegativeVotes || 0,
          net: statement.inclusionNetVotes || 0,
        },
        contentVotes: {
          positive: statement.contentPositiveVotes || 0,
          negative: statement.contentNegativeVotes || 0,
          net: statement.contentNetVotes || 0,
        },
        keywordCount: statement.keywords?.length || 0,
        categoryCount: statement.categories?.length || 0,
        createdAt: statement.createdAt,
        updatedAt: statement.updatedAt,
      };
    } catch (error) {
      this.handleError(error, `get stats for statement ${id}`);
    }
  }

  // PRIVATE HELPER METHODS

  /**
   * Validate categories using CategoryService
   */
  private async validateCategories(categoryIds: string[]) {
    try {
      // Get categories to verify they exist and are approved
      for (const categoryId of categoryIds) {
        const category = await this.categoryService.getCategory(categoryId);
        if (!category) {
          throw new BadRequestException(
            `Category with ID ${categoryId} not found`,
          );
        }
        // Add additional validation if needed (e.g., approval status)
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to validate categories');
    }
  }

  /**
   * Perform complex statement update with keyword processing
   */
  private async performComplexStatementUpdate(
    id: string,
    updateData: UpdateStatementData,
  ) {
    // Get original statement for comparison using BaseNodeSchema method
    const originalStatement = await this.statementSchema.findById(id);
    if (!originalStatement) {
      throw new NotFoundException(`Statement with ID ${id} not found`);
    }

    // Process keywords if statement text changed
    if (updateData.statement) {
      let keywords: KeywordWithFrequency[] = [];

      if (updateData.userKeywords && updateData.userKeywords.length > 0) {
        keywords = updateData.userKeywords.map((keyword) => ({
          word: keyword,
          frequency: 1,
          source: 'user' as const,
        }));
      } else {
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
        });
      }

      // Add keywords to update data
      (updateData as any).keywords = keywords;
    }

    // ✅ Use enhanced domain method for complex updates
    const result = await this.statementSchema.updateStatement(id, updateData);

    if (!result) {
      throw new NotFoundException(`Statement with ID ${id} not found`);
    }

    this.logger.log(`Successfully updated statement: ${id}`);
    return result;
  }

  /**
   * Process keywords to ensure Word nodes exist
   */
  private async processKeywordsForCreation(
    keywords: KeywordWithFrequency[],
    statementData: any,
  ) {
    for (const keyword of keywords) {
      const wordExists = await this.wordService.checkWordExistence(
        keyword.word,
      );
      if (!wordExists) {
        try {
          await this.wordService.createWord({
            word: keyword.word,
            createdBy: statementData.createdBy,
            publicCredit: true, // Default for auto-created words
          });
        } catch (error) {
          this.logger.warn(
            `Failed to create word node for "${keyword.word}": ${error.message}`,
          );
        }
      }
    }
  }

  // VALIDATION HELPERS

  private validateId(id: string, fieldName: string = 'ID') {
    if (!id || id.trim() === '') {
      throw new BadRequestException(`${fieldName} is required`);
    }
  }

  private validateUserId(userId: string) {
    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }
  }

  private validateCreateStatementData(data: CreateStatementData) {
    if (!data.statement || data.statement.trim() === '') {
      throw new BadRequestException('Statement text is required');
    }

    if (data.statement.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
      throw new BadRequestException(
        `Statement text cannot exceed ${TEXT_LIMITS.MAX_STATEMENT_LENGTH} characters`,
      );
    }

    if (!data.createdBy || data.createdBy.trim() === '') {
      throw new BadRequestException('Creator user ID is required');
    }

    if (!data.initialComment || data.initialComment.trim() === '') {
      throw new BadRequestException('Initial comment is required');
    }
  }

  private validateUpdateStatementData(data: UpdateStatementData) {
    if (!data || Object.keys(data).length === 0) {
      throw new BadRequestException('Update data is required');
    }

    if (data.statement !== undefined) {
      if (!data.statement || data.statement.trim() === '') {
        throw new BadRequestException('Statement text cannot be empty');
      }

      if (data.statement.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
        throw new BadRequestException(
          `Statement text cannot exceed ${TEXT_LIMITS.MAX_STATEMENT_LENGTH} characters`,
        );
      }
    }
  }

  private handleError(error: any, operation: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }

    this.logger.error(`Error ${operation}: ${error.message}`, error.stack);
    throw new InternalServerErrorException(
      `Failed to ${operation}: ${error.message}`,
    );
  }
}
