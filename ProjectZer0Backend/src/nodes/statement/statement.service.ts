// src/nodes/statement/statement.service.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { v4 as uuidv4 } from 'uuid';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';
import { Neo4jService } from '../../neo4j/neo4j.service';

interface CreateStatementData {
  createdBy: string;
  publicCredit: boolean;
  statement: string;
  userKeywords?: string[];
  initialComment: string;
  parentNode?: {
    id: string;
    type: 'OpenQuestionNode' | 'StatementNode' | 'QuantityNode';
    relationshipType?: string;
  };
}

interface UpdateStatementData {
  statement?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  discussionId?: string;
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
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
    private readonly neo4jService: Neo4jService,
  ) {}

  async getStatementNetwork(
    options: GetStatementNetworkOptions,
  ): Promise<any[]> {
    try {
      this.logger.debug(
        `Getting statement network with options: ${JSON.stringify(options)}`,
      );

      // Validate options
      const validatedOptions = {
        limit: options.limit !== undefined ? Number(options.limit) : undefined,
        offset:
          options.offset !== undefined ? Number(options.offset) : undefined,
        sortBy: this.validateSortBy(options.sortBy || 'netPositive'),
        sortDirection: this.validateSortDirection(
          options.sortDirection || 'desc',
        ),
        keywords: options.keywords,
        userId: options.userId,
      };

      // Get statements from the schema
      const statements =
        await this.statementSchema.getStatementNetwork(validatedOptions);

      // Force numeric conversion if vote properties are Neo4j integers
      this.normalizeVoteCounts(statements);

      return statements;
    } catch (error) {
      this.logger.error(
        `Error in getStatementNetwork: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get statement network: ${error.message}`,
      );
    }
  }

  private validateSortBy(sortBy: string): string {
    const validSortOptions = ['netPositive', 'totalVotes', 'chronological'];
    if (!validSortOptions.includes(sortBy)) {
      this.logger.warn(
        `Invalid sortBy value: ${sortBy}, defaulting to 'netPositive'`,
      );
      return 'netPositive';
    }
    return sortBy;
  }

  private validateSortDirection(sortDirection: string): string {
    const validDirections = ['asc', 'desc'];
    if (!validDirections.includes(sortDirection)) {
      this.logger.warn(
        `Invalid sortDirection value: ${sortDirection}, defaulting to 'desc'`,
      );
      return 'desc';
    }
    return sortDirection;
  }

  private normalizeVoteCounts(statements: any[]): void {
    statements.forEach((statement) => {
      // Ensure positiveVotes is a number
      if (
        typeof statement.positiveVotes === 'object' &&
        statement.positiveVotes !== null
      ) {
        if ('low' in statement.positiveVotes) {
          statement.positiveVotes = Number(statement.positiveVotes.low);
        } else if ('valueOf' in statement.positiveVotes) {
          statement.positiveVotes = Number(statement.positiveVotes.valueOf());
        }
      }

      // Ensure negativeVotes is a number
      if (
        typeof statement.negativeVotes === 'object' &&
        statement.negativeVotes !== null
      ) {
        if ('low' in statement.negativeVotes) {
          statement.negativeVotes = Number(statement.negativeVotes.low);
        } else if ('valueOf' in statement.negativeVotes) {
          statement.negativeVotes = Number(statement.negativeVotes.valueOf());
        }
      }

      // Ensure netVotes is a number
      if (
        typeof statement.netVotes === 'object' &&
        statement.netVotes !== null
      ) {
        if ('low' in statement.netVotes) {
          statement.netVotes = Number(statement.netVotes.low);
        } else if ('valueOf' in statement.netVotes) {
          statement.netVotes = Number(statement.netVotes.valueOf());
        }
      }
    });
  }

  async createStatement(statementData: CreateStatementData) {
    try {
      // Validate input data
      this.validateCreateStatementData(statementData);

      // Validate parent node if provided
      if (statementData.parentNode) {
        await this.validateParentNode(statementData.parentNode);
      }

      this.logger.log(
        `Creating statement: "${statementData.statement.substring(0, 30)}..." by user ${statementData.createdBy}`,
      );

      // Extract keywords from statement text
      const extractionResult =
        await this.keywordExtractionService.extractKeywords({
          text: statementData.statement,
          userKeywords: statementData.userKeywords,
        });

      // Check for new keywords and create word nodes for them
      await this.processKeywordsForCreation(
        extractionResult.keywords,
        statementData,
      );

      // Create statement with extracted keywords and parent node
      const statementWithId = {
        ...statementData,
        id: uuidv4(),
        keywords: extractionResult.keywords,
        parentNode: statementData.parentNode, // Pass through the parentNode
      };

      const createdStatement =
        await this.statementSchema.createStatement(statementWithId);
      this.logger.log(
        `Successfully created statement with ID: ${createdStatement.id}`,
      );

      return createdStatement;
    } catch (error) {
      this.logger.error(
        `Error creating statement: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Statement creation failed: ${error.message}`,
      );
    }
  }

  private validateCreateStatementData(data: CreateStatementData): void {
    if (!data.createdBy) {
      throw new BadRequestException(
        'Creator ID (createdBy) is required for statement creation',
      );
    }

    if (!data.statement || data.statement.trim() === '') {
      throw new BadRequestException('Statement text cannot be empty');
    }

    if (data.statement.length > 2000) {
      throw new BadRequestException(
        'Statement text is too long (maximum 2000 characters)',
      );
    }

    if (typeof data.publicCredit !== 'boolean') {
      throw new BadRequestException('publicCredit must be a boolean value');
    }
  }

  private async processKeywordsForCreation(
    keywords: KeywordWithFrequency[],
    statementData: CreateStatementData,
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
            createdBy: statementData.createdBy,
            publicCredit: statementData.publicCredit,
          });
          this.logger.debug(
            `Created new word: "${keyword.word}" for statement creation`,
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

  async getStatement(id: string) {
    try {
      if (!id) {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(`Getting statement with ID: ${id}`);
      const statement = await this.statementSchema.getStatement(id);

      if (!statement) {
        this.logger.debug(`Statement with ID ${id} not found`);
        throw new NotFoundException(`Statement with ID ${id} not found`);
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

  async updateStatement(id: string, updateData: UpdateStatementData) {
    try {
      if (!id) {
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

      this.logger.debug(`Statement ${id} updated successfully`);
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

  private async validateParentNode(parentNode: { id: string; type: string }) {
    try {
      // Check if parent node exists based on type
      const query = `
      MATCH (n:${parentNode.type} {id: $id})
      RETURN n
    `;

      const result = await this.neo4jService.read(query, { id: parentNode.id });

      if (!result.records || result.records.length === 0) {
        throw new BadRequestException(
          `Parent ${parentNode.type} with ID ${parentNode.id} not found`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to validate parent node: ${error.message}`,
      );
    }
  }

  private validateUpdateStatementData(data: UpdateStatementData): void {
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    if (data.statement !== undefined && data.statement.trim() === '') {
      throw new BadRequestException('Statement text cannot be empty');
    }

    if (data.statement && data.statement.length > 2000) {
      throw new BadRequestException(
        'Statement text is too long (maximum 2000 characters)',
      );
    }

    if (
      data.publicCredit !== undefined &&
      typeof data.publicCredit !== 'boolean'
    ) {
      throw new BadRequestException('publicCredit must be a boolean value');
    }
  }

  private async updateStatementWithKeywords(
    id: string,
    updateData: UpdateStatementData,
  ) {
    try {
      // Get the original statement for creator info
      const originalStatement = await this.statementSchema.getStatement(id);
      if (!originalStatement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      const extractionResult =
        await this.keywordExtractionService.extractKeywords({
          text: updateData.statement as string,
          userKeywords: updateData.userKeywords,
        });

      // Process new keywords
      await this.processKeywordsForUpdate(
        extractionResult.keywords,
        originalStatement.createdBy,
        updateData.publicCredit !== undefined
          ? updateData.publicCredit
          : originalStatement.publicCredit,
      );

      // Update statement with new keywords
      const updatedStatement = await this.statementSchema.updateStatement(id, {
        ...updateData,
        keywords: extractionResult.keywords,
      });

      this.logger.debug(`Statement ${id} updated with new keywords`);
      return updatedStatement;
    } catch (error) {
      this.logger.error(
        `Error updating statement keywords: ${error.message}`,
        error.stack,
      );
      throw error; // Re-throw the error to be handled by the parent function
    }
  }

  private async processKeywordsForUpdate(
    keywords: KeywordWithFrequency[],
    createdBy: string,
    publicCredit: boolean,
  ): Promise<void> {
    const newWordPromises = keywords.map(async (keyword) => {
      try {
        const wordExists = await this.wordService.checkWordExistence(
          keyword.word,
        );

        if (!wordExists) {
          await this.wordService.createWord({
            word: keyword.word,
            createdBy: createdBy,
            publicCredit: publicCredit,
          });
          this.logger.debug(
            `Created new word: "${keyword.word}" during statement update`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Error processing keyword "${keyword.word}" during update: ${error.message}`,
        );
      }
    });

    await Promise.all(newWordPromises);
  }

  async deleteStatement(id: string) {
    try {
      if (!id) {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.log(`Deleting statement with ID: ${id}`);

      // Check if statement exists first
      const statement = await this.statementSchema.getStatement(id);
      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      await this.statementSchema.deleteStatement(id);
      this.logger.log(`Statement ${id} deleted successfully`);

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

  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      if (!id) {
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

  async getVisibilityStatus(id: string) {
    try {
      if (!id) {
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

  // Standardized vote methods - delegate directly to schema with added error handling
  async voteStatement(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      if (!id) {
        throw new BadRequestException('Statement ID is required');
      }

      if (!sub) {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Processing vote on statement ${id} by user ${sub}: ${isPositive}`,
      );

      const result = await this.statementSchema.voteStatement(
        id,
        sub,
        isPositive,
      );
      this.logger.debug(`Vote processed successfully for statement ${id}`);

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error processing vote for statement ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to process vote: ${error.message}`,
      );
    }
  }

  async getStatementVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    try {
      if (!id) {
        throw new BadRequestException('Statement ID is required');
      }

      if (!sub) {
        throw new BadRequestException('User ID is required');
      }

      this.logger.debug(
        `Getting vote status for statement ${id} by user ${sub}`,
      );
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
        `Failed to get vote status: ${error.message}`,
      );
    }
  }

  async removeStatementVote(id: string, sub: string): Promise<VoteResult> {
    try {
      if (!id) {
        throw new BadRequestException('Statement ID is required');
      }

      if (!sub) {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(`Removing vote from statement ${id} by user ${sub}`);

      const result = await this.statementSchema.removeStatementVote(id, sub);
      this.logger.debug(`Vote removed successfully from statement ${id}`);

      return result;
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

  async getStatementVotes(id: string): Promise<VoteResult | null> {
    try {
      if (!id) {
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

  /**
   * Creates a direct relationship between two statements
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
   * Removes a direct relationship between two statements
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
   * Gets all statements directly related to the given statement
   */
  async getDirectlyRelatedStatements(statementId: string) {
    try {
      if (!statementId) {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.debug(
        `Getting directly related statements for ${statementId}`,
      );

      // Verify statement exists
      const statement = await this.getStatement(statementId);
      if (!statement) {
        throw new NotFoundException(
          `Statement with ID ${statementId} not found`,
        );
      }

      const relatedStatements =
        await this.statementSchema.getDirectlyRelatedStatements(statementId);
      this.logger.debug(
        `Found ${relatedStatements.length} directly related statements for ${statementId}`,
      );

      return relatedStatements;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting directly related statements: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get directly related statements: ${error.message}`,
      );
    }
  }

  /**
   * Creates a new statement directly related to an existing statement
   */
  async createRelatedStatement(
    existingStatementId: string,
    statementData: CreateStatementData,
  ) {
    try {
      if (!existingStatementId) {
        throw new BadRequestException('Existing statement ID is required');
      }

      this.logger.log(
        `Creating new statement related to ${existingStatementId}`,
      );

      // First validate that the existing statement exists
      const existingStatement = await this.getStatement(existingStatementId);
      if (!existingStatement) {
        throw new NotFoundException(
          `Statement with ID ${existingStatementId} not found`,
        );
      }

      // Create the new statement normally
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

  async checkStatements(): Promise<{ count: number }> {
    try {
      this.logger.debug('Checking statements count');
      return this.statementSchema.checkStatements();
    } catch (error) {
      this.logger.error(
        `Error in checkStatements: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to check statements: ${error.message}`,
      );
    }
  }
}
