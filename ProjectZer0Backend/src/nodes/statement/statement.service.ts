// src/nodes/statement/statement.service.ts - COMPLETE VERSION with all methods

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
import { VotingUtils } from '../../config/voting.config';
import { v4 as uuidv4 } from 'uuid';
import { TEXT_LIMITS } from '../../constants/validation';

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

@Injectable()
export class StatementService {
  private readonly logger = new Logger(StatementService.name);

  constructor(
    private readonly statementSchema: StatementSchema,
    private readonly discussionSchema: DiscussionSchema,
    private readonly userSchema: UserSchema,
    private readonly categoryService: CategoryService,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
  ) {}

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  async createStatement(
    statementData: CreateStatementData,
  ): Promise<StatementData> {
    this.validateCreateStatementData(statementData);

    const statementId = uuidv4();
    this.logger.log(
      `Creating statement: ${statementData.statement.substring(0, 50)}...`,
    );

    try {
      // Extract keywords
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
        }
      }

      // Validate categories
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
        initialComment: statementData.initialComment,
      });

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

  async getStatement(id: string): Promise<StatementData | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    this.logger.debug(`Getting statement: ${id}`);

    try {
      const statement = await this.statementSchema.getStatement(id);

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

  async updateStatement(
    id: string,
    updateData: UpdateStatementData,
  ): Promise<StatementData | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

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

    if (updateData.categoryIds && updateData.categoryIds.length > 3) {
      throw new BadRequestException('Maximum 3 categories allowed');
    }

    this.logger.log(`Updating statement: ${id}`);

    try {
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
          }
        }

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
                const original = await this.statementSchema.getStatement(id);
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

      const statement = await this.statementSchema.updateStatement(id, {
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
  // VOTING OPERATIONS
  // ============================================

  async voteInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    return await this.statementSchema.voteInclusion(id, userId, isPositive);
  }

  async voteContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    return await this.statementSchema.voteContent(id, userId, isPositive);
  }

  async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null> {
    return await this.statementSchema.getVoteStatus(id, userId);
  }

  async removeVote(
    id: string,
    userId: string,
    kind: 'INCLUSION' | 'CONTENT',
  ): Promise<VoteResult> {
    return await this.statementSchema.removeVote(id, userId, kind);
  }

  async getVotes(id: string): Promise<VoteResult | null> {
    return await this.statementSchema.getVotes(id);
  }

  // ============================================
  // RELATIONSHIP OPERATIONS
  // ============================================

  async createRelatedStatement(
    parentStatementId: string,
    statementData: CreateStatementData,
  ): Promise<StatementData> {
    if (!parentStatementId || parentStatementId.trim() === '') {
      throw new BadRequestException('Parent statement ID is required');
    }

    this.logger.log(`Creating related statement to: ${parentStatementId}`);

    try {
      const parentStatement =
        await this.statementSchema.getStatement(parentStatementId);
      if (!parentStatement) {
        throw new NotFoundException(
          `Parent statement with ID ${parentStatementId} not found`,
        );
      }

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
      const statement1 = await this.statementSchema.getStatement(statementId1);
      if (!statement1) {
        throw new NotFoundException(
          `Statement with ID ${statementId1} not found`,
        );
      }

      const statement2 = await this.statementSchema.getStatement(statementId2);
      if (!statement2) {
        throw new NotFoundException(
          `Statement with ID ${statementId2} not found`,
        );
      }

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

  async getDirectlyRelatedStatements(id: string): Promise<StatementData[]> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    this.logger.debug(`Getting directly related statements for: ${id}`);

    try {
      const statement = await this.statementSchema.getStatement(id);
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

  async getStatementNetwork(options: GetStatementNetworkOptions): Promise<any> {
    return await this.statementSchema.getStatementNetwork(options);
  }

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

  async isStatementApproved(id: string): Promise<boolean> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    try {
      const statement = await this.statementSchema.getStatement(id);
      if (!statement) {
        return false;
      }

      return VotingUtils.hasPassedInclusion(statement.inclusionNetVotes || 0);
    } catch (error) {
      this.logger.error(
        `Error checking statement approval: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  async isContentVotingAvailable(id: string): Promise<boolean> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Statement ID is required');
    }

    try {
      const statement = await this.statementSchema.getStatement(id);
      if (!statement) {
        return false;
      }

      return VotingUtils.hasPassedInclusion(statement.inclusionNetVotes || 0);
    } catch (error) {
      this.logger.error(
        `Error checking content voting availability: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  private validateCreateStatementData(data: CreateStatementData): void {
    if (!data.createdBy || data.createdBy.trim() === '') {
      throw new BadRequestException('createdBy is required');
    }

    if (!data.statement || data.statement.trim() === '') {
      throw new BadRequestException('Statement text is required');
    }

    if (data.statement.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
      throw new BadRequestException(
        `Statement text cannot exceed ${TEXT_LIMITS.MAX_STATEMENT_LENGTH} characters`,
      );
    }
  }
}
