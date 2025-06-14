// src/nodes/openquestion/openquestion.service.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { OpenQuestionSchema } from '../../neo4j/schemas/openquestion.schema';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { StatementService } from '../statement/statement.service';
import { v4 as uuidv4 } from 'uuid';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

interface CreateOpenQuestionData {
  createdBy: string;
  publicCredit: boolean;
  questionText: string;
  userKeywords?: string[];
  initialComment: string;
}

interface UpdateOpenQuestionData {
  questionText?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  discussionId?: string;
}

interface GetOpenQuestionNetworkOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: string;
  keywords?: string[];
  userId?: string;
}

interface CreateAnswerData {
  createdBy: string;
  publicCredit: boolean;
  statement: string;
  userKeywords?: string[];
  initialComment: string;
}

@Injectable()
export class OpenQuestionService {
  private readonly logger = new Logger(OpenQuestionService.name);

  constructor(
    private readonly openQuestionSchema: OpenQuestionSchema,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
    private readonly statementService: StatementService,
  ) {}

  async getOpenQuestionNetwork(
    options: GetOpenQuestionNetworkOptions,
  ): Promise<any[]> {
    try {
      this.logger.debug(
        `Getting open question network with options: ${JSON.stringify(options)}`,
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

      // Get questions from the schema
      const questions =
        await this.openQuestionSchema.getOpenQuestionNetwork(validatedOptions);

      // Force numeric conversion if vote properties are Neo4j integers
      this.normalizeVoteCounts(questions);

      return questions;
    } catch (error) {
      this.logger.error(
        `Error in getOpenQuestionNetwork: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get open question network: ${error.message}`,
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

  private normalizeVoteCounts(questions: any[]): void {
    questions.forEach((question) => {
      // Ensure positiveVotes is a number
      if (
        typeof question.positiveVotes === 'object' &&
        question.positiveVotes !== null
      ) {
        if ('low' in question.positiveVotes) {
          question.positiveVotes = Number(question.positiveVotes.low);
        } else if ('valueOf' in question.positiveVotes) {
          question.positiveVotes = Number(question.positiveVotes.valueOf());
        }
      }

      // Ensure negativeVotes is a number
      if (
        typeof question.negativeVotes === 'object' &&
        question.negativeVotes !== null
      ) {
        if ('low' in question.negativeVotes) {
          question.negativeVotes = Number(question.negativeVotes.low);
        } else if ('valueOf' in question.negativeVotes) {
          question.negativeVotes = Number(question.negativeVotes.valueOf());
        }
      }

      // Ensure netVotes is a number
      if (typeof question.netVotes === 'object' && question.netVotes !== null) {
        if ('low' in question.netVotes) {
          question.netVotes = Number(question.netVotes.low);
        } else if ('valueOf' in question.netVotes) {
          question.netVotes = Number(question.netVotes.valueOf());
        }
      }

      // Normalize vote counts in answers as well
      if (question.answers && question.answers.length > 0) {
        question.answers.forEach((answer) => {
          ['positiveVotes', 'negativeVotes', 'netVotes'].forEach((prop) => {
            if (
              answer[prop] !== undefined &&
              typeof answer[prop] === 'object' &&
              answer[prop] !== null
            ) {
              if ('low' in answer[prop]) {
                answer[prop] = Number(answer[prop].low);
              } else if ('valueOf' in answer[prop]) {
                answer[prop] = Number(answer[prop].valueOf());
              }
            }
          });
        });
      }
    });
  }

  async createOpenQuestion(questionData: CreateOpenQuestionData) {
    try {
      // Validate input data
      this.validateCreateQuestionData(questionData);

      this.logger.log(
        `Creating open question: "${questionData.questionText.substring(0, 30)}..." by user ${questionData.createdBy}`,
      );

      // Extract keywords from question text
      const extractionResult =
        await this.keywordExtractionService.extractKeywords({
          text: questionData.questionText,
          userKeywords: questionData.userKeywords,
        });

      // Check for new keywords and create word nodes for them
      await this.processKeywordsForCreation(
        extractionResult.keywords,
        questionData,
      );

      // Create question with extracted keywords
      const questionWithId = {
        ...questionData,
        id: uuidv4(),
        keywords: extractionResult.keywords,
      };

      const createdQuestion =
        await this.openQuestionSchema.createOpenQuestion(questionWithId);
      this.logger.log(
        `Successfully created open question with ID: ${createdQuestion.id}`,
      );

      return createdQuestion;
    } catch (error) {
      this.logger.error(
        `Error creating open question: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Open question creation failed: ${error.message}`,
      );
    }
  }

  private validateCreateQuestionData(data: CreateOpenQuestionData): void {
    if (!data.createdBy) {
      throw new BadRequestException(
        'Creator ID (createdBy) is required for question creation',
      );
    }

    if (!data.questionText || data.questionText.trim() === '') {
      throw new BadRequestException('Question text cannot be empty');
    }

    // Twitter character limit (280 characters)
    if (data.questionText.length > 280) {
      throw new BadRequestException(
        'Question text is too long (maximum 280 characters)',
      );
    }

    if (typeof data.publicCredit !== 'boolean') {
      throw new BadRequestException('publicCredit must be a boolean value');
    }
  }

  private async processKeywordsForCreation(
    keywords: KeywordWithFrequency[],
    questionData: CreateOpenQuestionData,
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
            createdBy: questionData.createdBy,
            publicCredit: questionData.publicCredit,
          });
          this.logger.debug(
            `Created new word: "${keyword.word}" for question creation`,
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

  async getOpenQuestion(id: string) {
    try {
      if (!id) {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.debug(`Getting open question with ID: ${id}`);
      const question = await this.openQuestionSchema.getOpenQuestion(id);

      if (!question) {
        this.logger.debug(`Open question with ID ${id} not found`);
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      // Log answer information for debugging
      this.logger.debug(
        `Question ${id} has ${question.answers?.length || 0} answers`,
      );
      if (question.answers && question.answers.length > 0) {
        this.logger.debug(
          `Answers: ${JSON.stringify(question.answers.map((a) => ({ id: a.id, statement: a.statement.substring(0, 50) + '...', netVotes: a.netVotes })))}`,
        );
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

  async updateOpenQuestion(id: string, updateData: UpdateOpenQuestionData) {
    try {
      if (!id) {
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

      this.logger.debug(`Open question ${id} updated successfully`);
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

  private validateUpdateQuestionData(data: UpdateOpenQuestionData): void {
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    if (data.questionText !== undefined && data.questionText.trim() === '') {
      throw new BadRequestException('Question text cannot be empty');
    }

    if (data.questionText && data.questionText.length > 280) {
      throw new BadRequestException(
        'Question text is too long (maximum 280 characters)',
      );
    }

    if (
      data.publicCredit !== undefined &&
      typeof data.publicCredit !== 'boolean'
    ) {
      throw new BadRequestException('publicCredit must be a boolean value');
    }
  }

  private async updateQuestionWithKeywords(
    id: string,
    updateData: UpdateOpenQuestionData,
  ) {
    try {
      // Get the original question for creator info
      const originalQuestion =
        await this.openQuestionSchema.getOpenQuestion(id);
      if (!originalQuestion) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      const extractionResult =
        await this.keywordExtractionService.extractKeywords({
          text: updateData.questionText as string,
          userKeywords: updateData.userKeywords,
        });

      // Process new keywords
      await this.processKeywordsForUpdate(
        extractionResult.keywords,
        originalQuestion.createdBy,
        updateData.publicCredit !== undefined
          ? updateData.publicCredit
          : originalQuestion.publicCredit,
      );

      // Update question with new keywords
      const updatedQuestion = await this.openQuestionSchema.updateOpenQuestion(
        id,
        {
          ...updateData,
          keywords: extractionResult.keywords,
        },
      );

      this.logger.debug(`Open question ${id} updated with new keywords`);
      return updatedQuestion;
    } catch (error) {
      this.logger.error(
        `Error updating question keywords: ${error.message}`,
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
            `Created new word: "${keyword.word}" during question update`,
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

  async deleteOpenQuestion(id: string) {
    try {
      if (!id) {
        throw new BadRequestException('Open question ID is required');
      }

      this.logger.log(`Deleting open question with ID: ${id}`);

      // Check if question exists first
      const question = await this.openQuestionSchema.getOpenQuestion(id);
      if (!question) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      await this.openQuestionSchema.deleteOpenQuestion(id);
      this.logger.log(`Open question ${id} deleted successfully`);

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

  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      if (!id) {
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

  async getVisibilityStatus(id: string) {
    try {
      if (!id) {
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

  // Standardized vote methods - delegate directly to schema with added error handling
  async voteOpenQuestion(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      if (!id) {
        throw new BadRequestException('Open question ID is required');
      }

      if (!sub) {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Processing vote on open question ${id} by user ${sub}: ${isPositive}`,
      );

      const result = await this.openQuestionSchema.voteOpenQuestion(
        id,
        sub,
        isPositive,
      );
      this.logger.debug(`Vote processed successfully for open question ${id}`);

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error processing vote for open question ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to process vote: ${error.message}`,
      );
    }
  }

  async getOpenQuestionVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    try {
      if (!id) {
        throw new BadRequestException('Open question ID is required');
      }

      if (!sub) {
        throw new BadRequestException('User ID is required');
      }

      this.logger.debug(
        `Getting vote status for open question ${id} by user ${sub}`,
      );
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
        `Failed to get vote status: ${error.message}`,
      );
    }
  }

  async removeOpenQuestionVote(id: string, sub: string): Promise<VoteResult> {
    try {
      if (!id) {
        throw new BadRequestException('Open question ID is required');
      }

      if (!sub) {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(`Removing vote from open question ${id} by user ${sub}`);

      const result = await this.openQuestionSchema.removeOpenQuestionVote(
        id,
        sub,
      );
      this.logger.debug(`Vote removed successfully from open question ${id}`);

      return result;
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

  async getOpenQuestionVotes(id: string): Promise<VoteResult | null> {
    try {
      if (!id) {
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

  /**
   * Creates a direct relationship between two open questions
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
   * Removes a direct relationship between two open questions
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
   * Gets all open questions directly related to the given question
   */
  async getDirectlyRelatedQuestions(questionId: string) {
    try {
      if (!questionId) {
        throw new BadRequestException('Question ID is required');
      }

      this.logger.debug(`Getting directly related questions for ${questionId}`);

      // Verify question exists
      const question = await this.getOpenQuestion(questionId);
      if (!question) {
        throw new NotFoundException(
          `Open question with ID ${questionId} not found`,
        );
      }

      const relatedQuestions =
        await this.openQuestionSchema.getDirectlyRelatedQuestions(questionId);
      this.logger.debug(
        `Found ${relatedQuestions.length} directly related questions for ${questionId}`,
      );

      return relatedQuestions;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting directly related questions: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get directly related questions: ${error.message}`,
      );
    }
  }

  /**
   * Creates a new open question directly related to an existing question
   */
  async createRelatedQuestion(
    existingQuestionId: string,
    questionData: CreateOpenQuestionData,
  ) {
    try {
      if (!existingQuestionId) {
        throw new BadRequestException('Existing question ID is required');
      }

      this.logger.log(`Creating new question related to ${existingQuestionId}`);

      // First validate that the existing question exists
      const existingQuestion = await this.getOpenQuestion(existingQuestionId);
      if (!existingQuestion) {
        throw new NotFoundException(
          `Open question with ID ${existingQuestionId} not found`,
        );
      }

      // Create the new question normally
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
   * Creates a statement that answers this open question
   * FIXED: Now properly passes parentNode to statement service
   */
  async createAnswerStatement(
    questionId: string,
    answerData: CreateAnswerData,
  ) {
    try {
      if (!questionId) {
        throw new BadRequestException('Question ID is required');
      }

      this.logger.log(`Creating answer statement for question ${questionId}`);

      // Verify the question exists
      const question = await this.getOpenQuestion(questionId);
      if (!question) {
        throw new NotFoundException(
          `Open question with ID ${questionId} not found`,
        );
      }

      // FIXED: Create the statement with parentNode information
      // This ensures the statement service knows to create an ANSWERS relationship
      const statementData = {
        ...answerData,
        parentNode: {
          id: questionId,
          type: 'OpenQuestionNode' as const,
          relationshipType: 'ANSWERS',
        },
      };

      // Create the statement using the statement service
      const statement =
        await this.statementService.createStatement(statementData);

      // NOTE: We no longer need to manually link the statement as an answer
      // because the statement service now handles this when parentNode is provided
      // The old code that called linkAnswerToQuestion is no longer needed

      this.logger.debug(
        `Created answer statement ${statement.id} for question ${questionId}`,
      );

      return statement;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error creating answer statement: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create answer statement: ${error.message}`,
      );
    }
  }

  /**
   * Links an existing statement as an answer to this open question
   */
  async linkExistingAnswerToQuestion(questionId: string, statementId: string) {
    try {
      if (!questionId) {
        throw new BadRequestException('Question ID is required');
      }

      if (!statementId) {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.log(
        `Linking existing statement ${statementId} to question ${questionId}`,
      );

      // Verify both the question and statement exist
      const question = await this.getOpenQuestion(questionId);
      if (!question) {
        throw new NotFoundException(
          `Open question with ID ${questionId} not found`,
        );
      }

      const statement = await this.statementService.getStatement(statementId);
      if (!statement) {
        throw new NotFoundException(
          `Statement with ID ${statementId} not found`,
        );
      }

      // Create the link
      await this.openQuestionSchema.linkAnswerToQuestion(
        questionId,
        statementId,
      );

      this.logger.debug(
        `Successfully linked statement ${statementId} to question ${questionId}`,
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
        `Error linking answer to question: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to link answer to question: ${error.message}`,
      );
    }
  }

  /**
   * Removes the link between a statement and this open question
   */
  async unlinkAnswerFromQuestion(questionId: string, statementId: string) {
    try {
      if (!questionId) {
        throw new BadRequestException('Question ID is required');
      }

      if (!statementId) {
        throw new BadRequestException('Statement ID is required');
      }

      this.logger.log(
        `Unlinking statement ${statementId} from question ${questionId}`,
      );

      await this.openQuestionSchema.unlinkAnswerFromQuestion(
        questionId,
        statementId,
      );

      this.logger.debug(
        `Successfully unlinked statement ${statementId} from question ${questionId}`,
      );

      return { success: true };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error unlinking answer from question: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to unlink answer from question: ${error.message}`,
      );
    }
  }

  /**
   * Gets all statements that answer this open question
   */
  async getQuestionAnswers(questionId: string) {
    try {
      if (!questionId) {
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

      const answers =
        await this.openQuestionSchema.getQuestionAnswers(questionId);
      this.logger.debug(
        `Found ${answers.length} answers for question ${questionId}`,
      );

      return answers;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting question answers: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get question answers: ${error.message}`,
      );
    }
  }

  async checkOpenQuestions(): Promise<{ count: number }> {
    try {
      this.logger.debug('Checking open questions count');
      return this.openQuestionSchema.checkOpenQuestions();
    } catch (error) {
      this.logger.error(
        `Error in checkOpenQuestions: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to check open questions: ${error.message}`,
      );
    }
  }
}
