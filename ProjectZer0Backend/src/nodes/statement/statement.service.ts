// src/nodes/statement/statement.service.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { CategoryService } from '../category/category.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';
import type { StatementData } from '../../neo4j/schemas/statement.schema';
import { v4 as uuidv4 } from 'uuid';
import { TEXT_LIMITS } from '../../constants/validation';

/**
 * Keyword with frequency data from extraction service
 */
interface KeywordWithFrequency {
  word: string;
  frequency: number;
  source: 'ai' | 'user';
}

interface CreateStatementData {
  statement: string;
  createdBy: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  categoryIds?: string[];
  parentStatementId?: string;
  initialComment?: string;
}

interface UpdateStatementData {
  statement?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  categoryIds?: string[];
}

interface GetStatementNetworkOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: string;
  keywords?: string[];
  userId?: string;
}

/**
 * StatementService - Business logic for statement operations
 *
 * ARCHITECTURE:
 * - Delegates all CRUD operations to StatementSchema
 * - Injects DiscussionSchema directly (NOT DiscussionService)
 * - Injects UserSchema for user tracking
 * - Orchestrates complex operations (keyword extraction, word creation, categories)
 *
 * SPECIAL CHARACTERISTICS:
 * - Statement extends CategorizedNodeSchema
 * - Dual voting (inclusion + content)
 * - AI-extracted keywords (multiple, with frequency)
 * - 0-3 user-selected categories
 * - Auto-creates missing word nodes
 * - Parent statement relationships (RELATED_TO)
 * - Standard 'id' field
 *
 * RESPONSIBILITIES:
 * ✅ Orchestrate multiple schema calls (statement + discussion + words)
 * ✅ Keyword extraction via AI service
 * ✅ Word node creation for missing keywords
 * ✅ Category validation (0-3 max)
 * ✅ Business validation beyond schema rules
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Writing Cypher queries (that's StatementSchema)
 * ❌ Direct database access (that's Neo4jService)
 * ❌ HTTP concerns (that's StatementController)
 */
@Injectable()
export class StatementService {
  private readonly logger = new Logger(StatementService.name);

  constructor(
    private readonly statementSchema: StatementSchema,
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
   * Create a new statement with optional discussion
   * Orchestrates: validation + keyword extraction + word creation + statement creation + discussion creation
   */
  async createStatement(
    statementData: CreateStatementData,
  ): Promise<StatementData> {
    this.validateCreateStatementData(statementData);

    const statementId = uuidv4();
    this.logger.log(
      `Creating statement: ${statementData.statement.substring(0, 50)}...`,
    );

    try {
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
            });
          keywords = extractionResult.keywords;
          this.logger.debug(`Extracted ${keywords.length} keywords via AI`);
        } catch (error) {
          this.logger.error(
            `Keyword extraction failed: ${error.message}`,
            error.stack,
          );
          throw new InternalServerErrorException(
            'Failed to extract keywords from statement',
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
              createdBy: statementData.createdBy,
              publicCredit: statementData.publicCredit ?? true,
            });
          }
        } catch (error) {
          this.logger.warn(
            `Failed to create word node for ${keyword.word}: ${error.message}`,
          );
          // Continue - word creation failure shouldn't block statement creation
        }
      }

      // Validate categories (0-3 max)
      if (statementData.categoryIds && statementData.categoryIds.length > 3) {
        throw new BadRequestException('Maximum 3 categories allowed');
      }

      // Create statement via schema
      const statement = await this.statementSchema.createStatement({
        id: statementId,
        statement: statementData.statement.trim(),
        createdBy: statementData.createdBy,
        publicCredit: statementData.publicCredit ?? true,
        keywords,
        categoryIds: statementData.categoryIds,
        parentStatementId: statementData.parentStatementId,
      });

      // Create discussion if initialComment provided
      // ⚠️ CRITICAL: Use direct DiscussionSchema injection
      if (statementData.initialComment) {
        try {
          await this.discussionSchema.createDiscussionForNode({
            nodeId: statement.id,
            nodeType: 'StatementNode',
            nodeIdField: 'id', // ← Standard 'id' field
            createdBy: statementData.createdBy,
            initialComment: statementData.initialComment,
          });
          this.logger.debug(
            `Created discussion for statement: ${statement.id}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to create discussion for statement ${statement.id}: ${error.message}`,
          );
          // Continue - statement creation succeeded
        }
      }

      this.logger.log(`Successfully created statement: ${statement.id}`);
      return statement;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
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
   * Direct delegation to schema
   */
  async getStatement(id: string): Promise<StatementData | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    this.logger.debug(`Getting statement: ${id}`);

    try {
      const statement = await this.statementSchema.findById(id);

      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      return statement;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error getting statement: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get statement: ${error.message}`,
      );
    }
  }

  /**
   * Update a statement
   * Handles keyword re-extraction if statement text changes
   */
  async updateStatement(
    id: string,
    updateData: UpdateStatementData,
  ): Promise<StatementData | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    // Validate at least one field to update
    if (
      !updateData.statement &&
      updateData.publicCredit === undefined &&
      !updateData.userKeywords &&
      !updateData.categoryIds
    ) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    // Validate statement text if provided
    if (updateData.statement !== undefined) {
      if (updateData.statement.trim() === '') {
        throw new BadRequestException('Statement text cannot be empty');
      }
      if (updateData.statement.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
        throw new BadRequestException(
          `Statement text cannot exceed ${TEXT_LIMITS.MAX_STATEMENT_LENGTH} characters`,
        );
      }
    }

    // Validate categories (0-3 max)
    if (updateData.categoryIds && updateData.categoryIds.length > 3) {
      throw new BadRequestException('Maximum 3 categories allowed');
    }

    this.logger.log(`Updating statement: ${id}`);

    try {
      // If statement text is changing, re-extract keywords
      let keywords: KeywordWithFrequency[] | undefined;
      if (updateData.statement) {
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
              });
            keywords = extractionResult.keywords;
            this.logger.debug(
              `Re-extracted ${keywords.length} keywords via AI`,
            );
          } catch (error) {
            this.logger.error(
              `Keyword extraction failed: ${error.message}`,
              error.stack,
            );
            // Continue without new keywords rather than failing the update
          }
        }

        // Create missing word nodes for new keywords
        if (keywords) {
          for (const keyword of keywords) {
            try {
              const wordExists = await this.wordService.checkWordExistence(
                keyword.word,
              );
              if (!wordExists) {
                this.logger.debug(
                  `Creating missing word node: ${keyword.word}`,
                );
                // Get original statement to use same creator
                const original = await this.statementSchema.findById(id);
                await this.wordService.createWord({
                  word: keyword.word,
                  createdBy: original?.createdBy || 'system',
                  publicCredit: true,
                });
              }
            } catch (error) {
              this.logger.warn(
                `Failed to create word node for ${keyword.word}: ${error.message}`,
              );
            }
          }
        }
      }

      const statement = await this.statementSchema.update(id, {
        ...updateData,
        keywords,
      });

      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      this.logger.debug(`Updated statement: ${id}`);
      return statement;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating statement: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update statement: ${error.message}`,
      );
    }
  }

  /**
   * Delete a statement
   * Direct delegation to schema
   */
  async deleteStatement(id: string): Promise<void> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    this.logger.log(`Deleting statement: ${id}`);

    try {
      await this.statementSchema.delete(id);
      this.logger.debug(`Deleted statement: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error deleting statement: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete statement: ${error.message}`,
      );
    }
  }

  // ============================================
  // VOTING OPERATIONS - Direct delegation
  // ============================================

  /**
   * Vote on statement inclusion
   * Direct delegation to schema
   */
  async voteInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Voting on statement inclusion: ${id} by user: ${userId}, isPositive: ${isPositive}`,
    );

    try {
      const result = await this.statementSchema.voteInclusion(
        id,
        userId,
        isPositive,
      );
      this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error voting on statement inclusion: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on statement inclusion: ${error.message}`,
      );
    }
  }

  /**
   * Vote on statement content
   * Direct delegation to schema (schema enforces inclusion threshold)
   */
  async voteContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Voting on statement content: ${id} by user: ${userId}, isPositive: ${isPositive}`,
    );

    try {
      // Schema will validate that statement has passed inclusion threshold
      const result = await this.statementSchema.voteContent(
        id,
        userId,
        isPositive,
      );
      this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error voting on statement content: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on statement content: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for a user on a statement
   */
  async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting vote status for statement: ${id}, user: ${userId}`,
    );

    try {
      return await this.statementSchema.getVoteStatus(id, userId);
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
   * Remove a vote (inclusion or content)
   */
  async removeVote(
    id: string,
    userId: string,
    kind: 'INCLUSION' | 'CONTENT',
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Removing ${kind} vote for statement: ${id}, user: ${userId}`,
    );

    try {
      return await this.statementSchema.removeVote(id, userId, kind);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(`Error removing vote: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to remove vote: ${error.message}`,
      );
    }
  }

  /**
   * Get vote counts for a statement
   */
  async getVotes(id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    this.logger.debug(`Getting votes for statement: ${id}`);

    try {
      return await this.statementSchema.getVotes(id);
    } catch (error) {
      this.logger.error(`Error getting votes: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to get votes: ${error.message}`,
      );
    }
  }

  // ============================================
  // RELATIONSHIP OPERATIONS
  // ============================================

  /**
   * Create a related statement (child statement)
   */
  async createRelatedStatement(
    parentStatementId: string,
    statementData: CreateStatementData,
  ): Promise<StatementData> {
    if (!parentStatementId || parentStatementId.trim() === '') {
      throw new BadRequestException('Parent statement ID is required');
    }

    this.logger.log(`Creating related statement to: ${parentStatementId}`);

    try {
      // Verify parent statement exists
      const parentStatement =
        await this.statementSchema.findById(parentStatementId);
      if (!parentStatement) {
        throw new NotFoundException(
          `Parent statement with ID ${parentStatementId} not found`,
        );
      }

      // Create new statement with parent relationship
      const newStatement = await this.createStatement({
        ...statementData,
        parentStatementId,
      });

      this.logger.log(
        `Successfully created related statement: ${newStatement.id}`,
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
   * Create direct relationship between two statements
   */
  async createDirectRelationship(
    statementId1: string,
    statementId2: string,
  ): Promise<{ success: boolean }> {
    if (!statementId1 || statementId1.trim() === '') {
      throw new BadRequestException('First statement ID is required');
    }

    if (!statementId2 || statementId2.trim() === '') {
      throw new BadRequestException('Second statement ID is required');
    }

    this.logger.log(
      `Creating relationship between statements: ${statementId1} and ${statementId2}`,
    );

    try {
      // Verify both statements exist
      const statement1 = await this.statementSchema.findById(statementId1);
      if (!statement1) {
        throw new NotFoundException(
          `Statement with ID ${statementId1} not found`,
        );
      }

      const statement2 = await this.statementSchema.findById(statementId2);
      if (!statement2) {
        throw new NotFoundException(
          `Statement with ID ${statementId2} not found`,
        );
      }

      // Delegate to schema
      await this.statementSchema.createDirectRelationship(
        statementId1,
        statementId2,
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
        `Error creating relationship: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create relationship: ${error.message}`,
      );
    }
  }

  /**
   * Remove direct relationship between two statements
   */
  async removeDirectRelationship(
    statementId1: string,
    statementId2: string,
  ): Promise<void> {
    if (!statementId1 || statementId1.trim() === '') {
      throw new BadRequestException('First statement ID is required');
    }

    if (!statementId2 || statementId2.trim() === '') {
      throw new BadRequestException('Second statement ID is required');
    }

    this.logger.log(
      `Removing relationship between statements: ${statementId1} and ${statementId2}`,
    );

    try {
      await this.statementSchema.removeDirectRelationship(
        statementId1,
        statementId2,
      );
    } catch (error) {
      this.logger.error(
        `Error removing relationship: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to remove relationship: ${error.message}`,
      );
    }
  }

  /**
   * Get statements directly related to a statement
   */
  async getDirectlyRelatedStatements(id: string): Promise<StatementData[]> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    this.logger.debug(`Getting directly related statements for: ${id}`);

    try {
      // Verify statement exists
      const statement = await this.statementSchema.findById(id);
      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      return await this.statementSchema.getDirectlyRelatedStatements(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error getting related statements: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get related statements: ${error.message}`,
      );
    }
  }

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  /**
   * Get statement network
   * Direct delegation to schema
   */
  async getStatementNetwork(
    options: GetStatementNetworkOptions,
  ): Promise<any[]> {
    this.logger.debug('Getting statement network');

    try {
      return await this.statementSchema.getStatementNetwork(options);
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

  /**
   * Check statements count
   * Direct delegation to schema
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

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Check if statement is approved (has positive net inclusion votes)
   */
  async isStatementApproved(id: string): Promise<boolean> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    this.logger.debug(`Checking approval status for statement: ${id}`);

    try {
      const votes = await this.statementSchema.getVotes(id);
      return votes ? votes.inclusionNetVotes > 0 : false;
    } catch (error) {
      this.logger.error(
        `Error checking approval status: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to check approval status: ${error.message}`,
      );
    }
  }

  /**
   * Check if content voting is available (inclusion threshold met)
   */
  async isContentVotingAvailable(id: string): Promise<boolean> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    this.logger.debug(
      `Checking content voting availability for statement: ${id}`,
    );

    try {
      return await this.isStatementApproved(id);
    } catch (error) {
      this.logger.error(
        `Error checking content voting availability: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to check content voting availability: ${error.message}`,
      );
    }
  }

  // ============================================
  // PRIVATE VALIDATION HELPERS
  // ============================================

  /**
   * Validates statement creation data
   */
  private validateCreateStatementData(
    statementData: CreateStatementData,
  ): void {
    if (!statementData.statement || statementData.statement.trim() === '') {
      throw new BadRequestException('Statement text is required');
    }

    if (statementData.statement.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
      throw new BadRequestException(
        `Statement text cannot exceed ${TEXT_LIMITS.MAX_STATEMENT_LENGTH} characters`,
      );
    }

    if (!statementData.createdBy || statementData.createdBy.trim() === '') {
      throw new BadRequestException('Creator ID is required');
    }

    if (
      !statementData.initialComment ||
      statementData.initialComment.trim() === ''
    ) {
      throw new BadRequestException('Initial comment is required');
    }
  }
}
