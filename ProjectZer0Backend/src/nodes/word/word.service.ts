// src/nodes/word/word.service.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { WordSchema } from '../../neo4j/schemas/word.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VisibilityService } from '../../users/visibility/visibility.service';
import { DictionaryService } from '../../dictionary/dictionary.service';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';
import type { WordNodeData } from '../../neo4j/schemas/word.schema';

/**
 * WordService - Business logic for word operations
 *
 * ARCHITECTURE:
 * - Delegates all CRUD operations to WordSchema
 * - Injects DiscussionSchema directly (NOT DiscussionService)
 * - Orchestrates word creation + optional definition + discussion
 * - Handles business validation beyond schema rules
 *
 * SPECIAL CASES FOR WORD:
 * - Uses 'word' as ID field (not 'id')
 * - Discussion creation uses nodeIdField: 'word'
 * - Self-tagging pattern (word tags itself)
 * - Inclusion voting only (no content voting)
 *
 * RESPONSIBILITIES:
 * ✅ Orchestrate multiple schema calls (word + discussion + visibility)
 * ✅ Business validation (API definition checks, etc.)
 * ✅ Integration with external services (DictionaryService)
 * ✅ Data transformation and aggregation
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Writing Cypher queries (that's WordSchema)
 * ❌ Direct database access (that's Neo4jService)
 * ❌ HTTP concerns (that's WordController)
 */
@Injectable()
export class WordService {
  private readonly logger = new Logger(WordService.name);

  constructor(
    private readonly wordSchema: WordSchema,
    private readonly discussionSchema: DiscussionSchema, // ← Direct injection
    private readonly userSchema: UserSchema,
    private readonly visibilityService: VisibilityService,
    private readonly dictionaryService: DictionaryService,
  ) {}

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Create a new word with optional initial definition and discussion
   * Orchestrates: word creation + discussion creation via DiscussionSchema
   */
  async createWord(wordData: {
    word: string;
    createdBy: string;
    publicCredit?: boolean;
    initialDefinition?: string;
    initialComment?: string;
    isApiDefinition?: boolean;
    isAICreated?: boolean;
  }): Promise<WordNodeData> {
    // Validate input
    if (!wordData.word || wordData.word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    if (!wordData.createdBy || wordData.createdBy.trim() === '') {
      throw new BadRequestException('Creator is required');
    }

    this.logger.log(`Creating word: ${wordData.word}`);

    try {
      // Check if word already exists
      const exists = await this.wordSchema.checkWordExistence(wordData.word);
      if (exists) {
        throw new ConflictException(`Word '${wordData.word}' already exists`);
      }

      // For API definitions, optionally fetch from dictionary service
      let definitionText = wordData.initialDefinition;
      if (!definitionText && wordData.isApiDefinition) {
        try {
          const apiDefinition = await this.dictionaryService.getDefinition(
            wordData.word,
          );
          if (apiDefinition) {
            definitionText = apiDefinition;
            this.logger.debug(
              `Fetched API definition for word: ${wordData.word}`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Failed to fetch API definition for ${wordData.word}: ${error.message}`,
          );
          // Continue without API definition
        }
      }

      // Create word via schema (includes optional initial definition)
      const createdWordResult = await this.wordSchema.createWord({
        word: wordData.word,
        createdBy: wordData.createdBy,
        publicCredit: wordData.publicCredit ?? true,
        initialDefinition: definitionText,
        isApiDefinition: wordData.isApiDefinition,
        isAICreated: wordData.isAICreated,
      });

      // Extract the word value from the result
      const wordValue =
        typeof createdWordResult === 'object' && 'word' in createdWordResult
          ? createdWordResult.word
          : wordData.word;

      // Create discussion if initialComment provided
      // ⚠️ CRITICAL: Use direct DiscussionSchema injection, NOT DiscussionService
      if (wordData.initialComment) {
        try {
          await this.discussionSchema.createDiscussionForNode({
            nodeId: wordValue, // ← Uses 'word' field, not 'id'
            nodeType: 'WordNode',
            nodeIdField: 'word', // ← IMPORTANT: 'word' for WordNode
            createdBy: wordData.createdBy,
            initialComment: wordData.initialComment,
          });
          this.logger.debug(`Created discussion for word: ${wordValue}`);
        } catch (error) {
          this.logger.warn(
            `Failed to create discussion for word ${wordValue}: ${error.message}`,
          );
          // Continue - word creation succeeded
        }
      }

      this.logger.log(`Successfully created word: ${wordValue}`);

      // Return the full word data by fetching it
      const word = await this.wordSchema.findById(wordValue);
      if (!word) {
        throw new InternalServerErrorException(
          'Failed to retrieve created word',
        );
      }

      return word;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      this.logger.error(`Error creating word: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to create word: ${error.message}`,
      );
    }
  }

  /**
   * Get a word by its word value (the ID)
   * Direct delegation to schema
   */
  async getWord(word: string): Promise<WordNodeData | null> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    this.logger.debug(`Getting word: ${word}`);

    try {
      const wordData = await this.wordSchema.findById(word);

      if (!wordData) {
        this.logger.debug(`Word not found: ${word}`);
        return null;
      }

      return wordData;
    } catch (error) {
      this.logger.error(`Error getting word: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to get word: ${error.message}`,
      );
    }
  }

  /**
   * Get word with visibility context for a user
   * Orchestrates: word retrieval + visibility check
   */
  async getWordWithVisibility(
    word: string,
    userId?: string,
  ): Promise<(WordNodeData & { isVisible: boolean }) | null> {
    const wordData = await this.getWord(word);
    if (!wordData) return null;

    try {
      const isVisible = await this.visibilityService.getObjectVisibility(
        userId || null,
        wordData.word, // Use word as identifier
        {
          netVotes: wordData.inclusionNetVotes,
          isVisible: undefined, // Let visibility be determined by votes and preferences
        },
      );

      return { ...wordData, isVisible };
    } catch (error) {
      this.logger.error(
        `Error getting word visibility: ${error.message}`,
        error.stack,
      );
      // Return word without visibility info on error
      return { ...wordData, isVisible: true };
    }
  }

  /**
   * Update a word
   * Direct delegation to schema
   */
  async updateWord(
    word: string,
    updateData: Partial<WordNodeData>,
  ): Promise<WordNodeData> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    this.logger.debug(
      `Updating word: ${word} with data: ${JSON.stringify(updateData)}`,
    );

    try {
      const updatedWord = await this.wordSchema.update(word, updateData);

      if (!updatedWord) {
        throw new NotFoundException(`Word "${word}" not found`);
      }

      this.logger.debug(`Updated word: ${JSON.stringify(updatedWord)}`);
      return updatedWord;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(`Error updating word: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to update word: ${error.message}`,
      );
    }
  }

  /**
   * Delete a word
   * Direct delegation to schema
   */
  async deleteWord(word: string): Promise<void> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    this.logger.debug(`Deleting word: ${word}`);

    try {
      await this.wordSchema.delete(word);
      this.logger.debug(`Deleted word: ${word}`);
    } catch (error) {
      this.logger.error(`Error deleting word: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to delete word: ${error.message}`,
      );
    }
  }

  // ============================================
  // VOTING OPERATIONS - Direct delegation
  // ============================================

  /**
   * Vote on word inclusion
   * Words only support inclusion voting, not content voting
   */
  async voteInclusion(
    word: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Voting on word inclusion: ${word} by user: ${userId}, isPositive: ${isPositive}`,
    );

    try {
      const result = await this.wordSchema.voteInclusion(
        word,
        userId,
        isPositive,
      );
      this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`Error voting on word: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to vote on word: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for a user on a word
   */
  async getVoteStatus(
    word: string,
    userId: string,
  ): Promise<VoteStatus | null> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting vote status for word: ${word} and user: ${userId}`,
    );

    try {
      const status = await this.wordSchema.getVoteStatus(word, userId);
      this.logger.debug(
        `Vote status for word ${word} and user ${userId}: ${JSON.stringify(status)}`,
      );
      return status;
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
   * Remove a vote from a word
   */
  async removeVote(word: string, userId: string): Promise<VoteResult> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Removing vote on word: ${word} by user: ${userId}`);

    try {
      const result = await this.wordSchema.removeVote(
        word,
        userId,
        'INCLUSION',
      );
      this.logger.debug(`Remove vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`Error removing vote: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to remove vote: ${error.message}`,
      );
    }
  }

  /**
   * Get vote totals for a word
   */
  async getVotes(word: string): Promise<VoteResult | null> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    this.logger.debug(`Getting votes for word: ${word}`);

    try {
      const votes = await this.wordSchema.getVotes(word);
      this.logger.debug(`Votes for word ${word}: ${JSON.stringify(votes)}`);
      return votes;
    } catch (error) {
      this.logger.error(`Error getting votes: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to get votes: ${error.message}`,
      );
    }
  }

  // ============================================
  // VISIBILITY OPERATIONS
  // ============================================

  /**
   * Set user visibility preference for a word
   * Orchestrates with VisibilityService
   */
  async setVisibilityPreference(
    userId: string,
    wordId: string,
    isVisible: boolean,
  ): Promise<void> {
    if (!wordId || wordId.trim() === '') {
      throw new BadRequestException('Word ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Setting visibility preference for word ${wordId} by user ${userId}: ${isVisible}`,
    );

    try {
      await this.visibilityService.setUserVisibilityPreference(
        userId,
        wordId,
        isVisible,
      );
      this.logger.debug(`Set visibility preference successfully`);
    } catch (error) {
      this.logger.error(
        `Error setting visibility preference: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to set visibility preference: ${error.message}`,
      );
    }
  }

  /**
   * Get visibility for a word for a specific user
   * Orchestrates: word retrieval + visibility check
   */
  async getVisibilityForUser(
    wordId: string,
    userId?: string,
  ): Promise<boolean> {
    if (!wordId || wordId.trim() === '') {
      throw new BadRequestException('Word ID is required');
    }

    this.logger.debug(
      `Getting visibility for word ${wordId} and user ${userId || 'anonymous'}`,
    );

    try {
      const wordData = await this.getWord(wordId);
      if (!wordData) {
        throw new NotFoundException(`Word with ID ${wordId} not found`);
      }

      const isVisible = await this.visibilityService.getObjectVisibility(
        userId || null,
        wordId,
        {
          netVotes: wordData.inclusionNetVotes,
          isVisible: undefined,
        },
      );

      this.logger.debug(`Visibility for word ${wordId}: ${isVisible}`);
      return isVisible;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error getting visibility: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get visibility: ${error.message}`,
      );
    }
  }

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  /**
   * Check if a word exists
   * Direct delegation to schema
   */
  async checkWordExistence(word: string): Promise<boolean> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    this.logger.debug(`Checking existence of word: ${word}`);

    try {
      const exists = await this.wordSchema.checkWordExistence(word);
      this.logger.debug(`Word '${word}' exists: ${exists}`);
      return exists;
    } catch (error) {
      this.logger.error(
        `Error checking word existence: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to check word existence: ${error.message}`,
      );
    }
  }

  /**
   * Get all words
   * Direct delegation to schema
   */
  async getAllWords(): Promise<WordNodeData[]> {
    this.logger.debug('Getting all words');

    try {
      const words = await this.wordSchema.getAllWords();
      this.logger.debug(`Retrieved ${words.length} words`);
      return words;
    } catch (error) {
      this.logger.error(
        `Error getting all words: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get all words: ${error.message}`,
      );
    }
  }

  /**
   * Get approved words (passed inclusion threshold)
   * Direct delegation to schema with options
   */
  async getApprovedWords(options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'alphabetical' | 'votes' | 'created';
    sortDirection?: 'asc' | 'desc';
  }): Promise<WordNodeData[]> {
    try {
      // Convert lowercase sort direction to uppercase for schema
      const schemaOptions = options
        ? {
            ...options,
            sortDirection: options.sortDirection
              ? (options.sortDirection.toUpperCase() as 'ASC' | 'DESC')
              : undefined,
          }
        : undefined;

      const words = await this.wordSchema.getApprovedWords(schemaOptions);
      this.logger.debug(`Retrieved ${words.length} approved words`);
      return words;
    } catch (error) {
      this.logger.error(
        `Error getting approved words: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get approved words: ${error.message}`,
      );
    }
  }

  /**
   * Check word statistics
   * Direct delegation to schema
   */
  async checkWords(): Promise<{ count: number }> {
    try {
      return await this.wordSchema.checkWords();
    } catch (error) {
      this.logger.error(`Error checking words: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to check words: ${error.message}`,
      );
    }
  }

  /**
   * Check if word is available for definition creation
   * Business rule: word must have passed inclusion threshold
   */
  async isWordAvailableForDefinitionCreation(word: string): Promise<boolean> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    try {
      return await this.wordSchema.isWordAvailableForDefinitionCreation(word);
    } catch (error) {
      this.logger.error(
        `Error checking word availability: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to check word availability: ${error.message}`,
      );
    }
  }
}
