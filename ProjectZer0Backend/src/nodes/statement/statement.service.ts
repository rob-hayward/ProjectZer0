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
    private readonly wordService: WordService, // Add WordService dependency
  ) {}

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
}
