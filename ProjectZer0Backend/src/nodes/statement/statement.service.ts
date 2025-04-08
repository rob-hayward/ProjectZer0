// src/nodes/statement/statement.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StatementService {
  private readonly logger = new Logger(StatementService.name);

  constructor(
    private readonly statementSchema: StatementSchema,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
  ) {}

  async getStatementNetwork(options: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: string;
    keywords?: string[];
    userId?: string;
  }): Promise<any[]> {
    try {
      // Get statements from the schema
      const statements =
        await this.statementSchema.getStatementNetwork(options);

      // Force numeric conversion if vote properties are Neo4j integers
      // This ensures we always return plain JavaScript numbers to the frontend
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

      return statements;
    } catch (error) {
      this.logger.error(`Error in getStatementNetwork: ${error.message}`);
      throw new Error(`Failed to get statement network: ${error.message}`);
    }
  }

  async createStatement(statementData: {
    createdBy: string;
    publicCredit: boolean;
    statement: string;
    userKeywords?: string[];
    initialComment: string;
  }) {
    try {
      // Extract keywords from statement text
      const extractionResult =
        await this.keywordExtractionService.extractKeywords({
          text: statementData.statement,
          userKeywords: statementData.userKeywords,
        });

      // Check for new keywords and create word nodes for them
      const newWordPromises = extractionResult.keywords.map(async (keyword) => {
        try {
          const wordExists = await this.wordService.checkWordExistence(
            keyword.word,
          );

          if (!wordExists) {
            // Use existing word creation flow which includes:
            // - Getting definition from Free Dictionary API
            // - Creating definition node
            // - Creating empty discussion
            await this.wordService.createWord({
              word: keyword.word,
              createdBy: statementData.createdBy,
              publicCredit: statementData.publicCredit,
              // The word service will handle fetching a definition automatically
            });
          }
        } catch (error) {
          this.logger.warn(
            `Error creating word for keyword "${keyword.word}": ${error.message}`,
          );
          // Continue with other keywords even if one fails
        }
      });

      // Wait for all word creation processes to complete
      await Promise.all(newWordPromises);

      // Create statement with extracted keywords
      const statementWithId = {
        ...statementData,
        id: uuidv4(),
        keywords: extractionResult.keywords,
      };

      return this.statementSchema.createStatement(statementWithId);
    } catch (error) {
      this.logger.error(`Error creating statement: ${error.message}`);
      throw new Error(`Statement creation failed: ${error.message}`);
    }
  }

  async getStatement(id: string) {
    return this.statementSchema.getStatement(id);
  }

  async updateStatement(
    id: string,
    updateData: {
      statement?: string;
      publicCredit?: boolean;
      userKeywords?: string[];
    },
  ) {
    // If statement text is being updated, re-extract keywords
    if (updateData.statement) {
      try {
        // Get the original statement for creator info
        const originalStatement = await this.statementSchema.getStatement(id);
        if (!originalStatement) {
          throw new Error(`Statement with ID ${id} not found`);
        }

        const extractionResult =
          await this.keywordExtractionService.extractKeywords({
            text: updateData.statement,
            userKeywords: updateData.userKeywords,
          });

        // Check for new keywords and create word nodes for them
        const newWordPromises = extractionResult.keywords.map(
          async (keyword) => {
            try {
              const wordExists = await this.wordService.checkWordExistence(
                keyword.word,
              );

              if (!wordExists) {
                await this.wordService.createWord({
                  word: keyword.word,
                  createdBy: originalStatement.createdBy,
                  publicCredit:
                    updateData.publicCredit !== undefined
                      ? updateData.publicCredit
                      : originalStatement.publicCredit,
                });
              }
            } catch (error) {
              this.logger.warn(
                `Error creating word for keyword "${keyword.word}": ${error.message}`,
              );
            }
          },
        );

        // Wait for all word creation processes to complete
        await Promise.all(newWordPromises);

        return this.statementSchema.updateStatement(id, {
          ...updateData,
          keywords: extractionResult.keywords,
        });
      } catch (error) {
        this.logger.error(
          `Error updating statement keywords: ${error.message}`,
        );
        throw new Error(`Statement update failed: ${error.message}`);
      }
    }

    // If only other fields are being updated, no need to re-extract keywords
    return this.statementSchema.updateStatement(id, updateData);
  }

  async deleteStatement(id: string) {
    return this.statementSchema.deleteStatement(id);
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    return this.statementSchema.setVisibilityStatus(id, isVisible);
  }

  async getVisibilityStatus(id: string) {
    return this.statementSchema.getVisibilityStatus(id);
  }

  // Standardized vote methods - delegate directly to schema
  async voteStatement(id: string, sub: string, isPositive: boolean) {
    return this.statementSchema.voteStatement(id, sub, isPositive);
  }

  async getStatementVoteStatus(id: string, sub: string) {
    return this.statementSchema.getStatementVoteStatus(id, sub);
  }

  async removeStatementVote(id: string, sub: string) {
    return this.statementSchema.removeStatementVote(id, sub);
  }

  async getStatementVotes(id: string) {
    return this.statementSchema.getStatementVotes(id);
  }

  /**
   * Creates a direct relationship between two statements
   */
  async createDirectRelationship(statementId1: string, statementId2: string) {
    try {
      // Verify both statements exist
      const statement1 = await this.getStatement(statementId1);
      const statement2 = await this.getStatement(statementId2);

      if (!statement1 || !statement2) {
        throw new Error(
          `One or both statements not found: ${statementId1}, ${statementId2}`,
        );
      }

      return await this.statementSchema.createDirectRelationship(
        statementId1,
        statementId2,
      );
    } catch (error) {
      this.logger.error(`Error in createDirectRelationship: ${error.message}`);
      throw new Error(`Failed to create direct relationship: ${error.message}`);
    }
  }

  /**
   * Removes a direct relationship between two statements
   */
  async removeDirectRelationship(statementId1: string, statementId2: string) {
    try {
      return await this.statementSchema.removeDirectRelationship(
        statementId1,
        statementId2,
      );
    } catch (error) {
      this.logger.error(`Error in removeDirectRelationship: ${error.message}`);
      throw new Error(`Failed to remove direct relationship: ${error.message}`);
    }
  }

  /**
   * Gets all statements directly related to the given statement
   */
  async getDirectlyRelatedStatements(statementId: string) {
    try {
      return await this.statementSchema.getDirectlyRelatedStatements(
        statementId,
      );
    } catch (error) {
      this.logger.error(
        `Error in getDirectlyRelatedStatements: ${error.message}`,
      );
      throw new Error(
        `Failed to get directly related statements: ${error.message}`,
      );
    }
  }

  /**
   * Creates a new statement directly related to an existing statement
   */
  async createRelatedStatement(
    existingStatementId: string,
    statementData: {
      createdBy: string;
      publicCredit: boolean;
      statement: string;
      userKeywords?: string[];
      initialComment: string;
    },
  ) {
    try {
      // First validate that the existing statement exists
      const existingStatement = await this.getStatement(existingStatementId);
      if (!existingStatement) {
        throw new Error(`Statement with ID ${existingStatementId} not found`);
      }

      // Create the new statement normally
      const newStatement = await this.createStatement(statementData);

      // Create the direct relationship between the statements
      await this.createDirectRelationship(existingStatementId, newStatement.id);

      return newStatement;
    } catch (error) {
      this.logger.error(`Error in createRelatedStatement: ${error.message}`);
      throw new Error(`Failed to create related statement: ${error.message}`);
    }
  }

  async checkStatements(): Promise<{ count: number }> {
    try {
      return this.statementSchema.checkStatements();
    } catch (error) {
      this.logger.error(`Error in checkStatements: ${error.message}`);
      throw new Error(`Failed to check statements: ${error.message}`);
    }
  }
}
