import { Injectable, Logger } from '@nestjs/common';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StatementService {
  private readonly logger = new Logger(StatementService.name);

  constructor(
    private readonly statementSchema: StatementSchema,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
    private readonly voteSchema: VoteSchema,
  ) {}

  async getStatementNetwork(options: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: string;
    keywords?: string[];
    userId?: string;
  }): Promise<any[]> {
    this.logger.log(
      `Getting statement network with options: ${JSON.stringify(options)}`,
    );
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
      this.logger.error(
        `Error in getStatementNetwork: ${error.message}`,
        error.stack,
      );
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
    this.logger.log(
      `Creating statement: "${statementData.statement.substring(0, 50)}..."`,
    );

    try {
      // Extract keywords from statement text
      const extractionResult =
        await this.keywordExtractionService.extractKeywords({
          text: statementData.statement,
          userKeywords: statementData.userKeywords,
        });

      this.logger.log(
        `Extracted ${extractionResult.keywords.length} keywords for statement`,
      );

      // Check for new keywords and create word nodes for them
      const newWordPromises = extractionResult.keywords.map(async (keyword) => {
        try {
          const wordExists = await this.wordService.checkWordExistence(
            keyword.word,
          );

          if (!wordExists) {
            this.logger.log(
              `Creating new word node for keyword: ${keyword.word}`,
            );

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
      this.logger.log(
        `Finished creating any necessary word nodes for keywords`,
      );

      // Create statement with extracted keywords
      const statementWithId = {
        ...statementData,
        id: uuidv4(),
        keywords: extractionResult.keywords,
      };

      this.logger.log(
        `Creating statement with ${extractionResult.keywords.length} keywords`,
      );
      return this.statementSchema.createStatement(statementWithId);
    } catch (error) {
      this.logger.error(
        `Error creating statement: ${error.message}`,
        error.stack,
      );
      throw new Error(`Statement creation failed: ${error.message}`);
    }
  }

  async getStatement(id: string) {
    this.logger.log(`Getting statement: ${id}`);
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
    this.logger.log(`Updating statement: ${id}`);

    // If statement text is being updated, re-extract keywords
    if (updateData.statement) {
      try {
        this.logger.log(`Re-extracting keywords for updated statement text`);

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

        this.logger.log(
          `Extracted ${extractionResult.keywords.length} keywords for updated statement`,
        );

        // Check for new keywords and create word nodes for them
        const newWordPromises = extractionResult.keywords.map(
          async (keyword) => {
            try {
              const wordExists = await this.wordService.checkWordExistence(
                keyword.word,
              );

              if (!wordExists) {
                this.logger.log(
                  `Creating new word node for keyword: ${keyword.word}`,
                );

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
          error.stack,
        );
        throw new Error(`Statement update failed: ${error.message}`);
      }
    }

    // If only other fields are being updated, no need to re-extract keywords
    return this.statementSchema.updateStatement(id, updateData);
  }

  async deleteStatement(id: string) {
    this.logger.log(`Deleting statement: ${id}`);
    return this.statementSchema.deleteStatement(id);
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    this.logger.log(`Setting visibility for statement ${id}: ${isVisible}`);
    return this.statementSchema.setVisibilityStatus(id, isVisible);
  }

  async getVisibilityStatus(id: string) {
    this.logger.log(`Getting visibility status for statement: ${id}`);
    return this.statementSchema.getVisibilityStatus(id);
  }

  async voteStatement(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    this.logger.log(
      `Voting on statement: ${id} by user: ${sub}, isPositive: ${isPositive}`,
    );
    try {
      const result = await this.voteSchema.vote(
        'StatementNode',
        { id },
        sub,
        isPositive,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error in voteStatement: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to vote on statement: ${error.message}`);
    }
  }

  async getStatementVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    this.logger.log(
      `Getting vote status for statement: ${id} and user: ${sub}`,
    );
    try {
      const status = await this.voteSchema.getVoteStatus(
        'StatementNode',
        { id },
        sub,
      );
      return status;
    } catch (error) {
      this.logger.error(
        `Error in getStatementVoteStatus: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get statement vote status: ${error.message}`);
    }
  }

  async removeStatementVote(id: string, sub: string): Promise<VoteResult> {
    this.logger.log(`Removing vote on statement: ${id} by user: ${sub}`);
    try {
      const result = await this.voteSchema.removeVote(
        'StatementNode',
        { id },
        sub,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error in removeStatementVote: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to remove statement vote: ${error.message}`);
    }
  }

  async getStatementVotes(id: string): Promise<VoteResult | null> {
    this.logger.log(`Getting votes for statement: ${id}`);
    try {
      const voteStatus = await this.voteSchema.getVoteStatus(
        'StatementNode',
        { id },
        '', // Empty string as we don't need user-specific status
      );

      if (!voteStatus) {
        this.logger.log(`No votes found for statement: ${id}`);
        return null;
      }

      const votes = {
        positiveVotes: voteStatus.positiveVotes,
        negativeVotes: voteStatus.negativeVotes,
        netVotes: voteStatus.netVotes,
      };

      return votes;
    } catch (error) {
      this.logger.error(
        `Error in getStatementVotes: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get statement votes: ${error.message}`);
    }
  }

  /**
   * Creates a direct relationship between two statements
   */
  async createDirectRelationship(statementId1: string, statementId2: string) {
    this.logger.log(
      `Creating direct relationship between statements ${statementId1} and ${statementId2}`,
    );
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
      this.logger.error(
        `Error in createDirectRelationship: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to create direct relationship: ${error.message}`);
    }
  }

  /**
   * Removes a direct relationship between two statements
   */
  async removeDirectRelationship(statementId1: string, statementId2: string) {
    this.logger.log(
      `Removing direct relationship between statements ${statementId1} and ${statementId2}`,
    );
    try {
      return await this.statementSchema.removeDirectRelationship(
        statementId1,
        statementId2,
      );
    } catch (error) {
      this.logger.error(
        `Error in removeDirectRelationship: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to remove direct relationship: ${error.message}`);
    }
  }

  /**
   * Gets all statements directly related to the given statement
   */
  async getDirectlyRelatedStatements(statementId: string) {
    this.logger.log(`Getting directly related statements for ${statementId}`);
    try {
      return await this.statementSchema.getDirectlyRelatedStatements(
        statementId,
      );
    } catch (error) {
      this.logger.error(
        `Error in getDirectlyRelatedStatements: ${error.message}`,
        error.stack,
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
    this.logger.log(`Creating new statement related to ${existingStatementId}`);

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
      this.logger.error(
        `Error in createRelatedStatement: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to create related statement: ${error.message}`);
    }
  }

  async checkStatements(): Promise<{ count: number }> {
    this.logger.log('Checking if statements exist in database');
    try {
      return this.statementSchema.checkStatements();
    } catch (error) {
      this.logger.error(
        `Error in checkStatements: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to check statements: ${error.message}`);
    }
  }
}
