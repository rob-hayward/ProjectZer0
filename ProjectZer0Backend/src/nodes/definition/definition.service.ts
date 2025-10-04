// src/nodes/definition/definition.service.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { TEXT_LIMITS } from '../../constants/validation';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';
import type { DefinitionData } from '../../neo4j/schemas/definition.schema';
import { v4 as uuidv4 } from 'uuid';

/**
 * DefinitionService - Business logic for definition operations
 *
 * ARCHITECTURE:
 * - Delegates all CRUD operations to DefinitionSchema
 * - Injects DiscussionSchema directly (NOT DiscussionService)
 * - Orchestrates definition creation + discussion
 * - Validates parent word has passed inclusion threshold
 *
 * KEY DIFFERENCES FROM WORD:
 * - Standard 'id' field (not 'word')
 * - Discussion uses nodeIdField: 'id' (not 'word')
 * - Dual voting (inclusion + content)
 * - Parent word validation required
 *
 * RESPONSIBILITIES:
 * ✅ Orchestrate multiple schema calls (definition + discussion)
 * ✅ Business validation (word threshold, text length)
 * ✅ Data transformation
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Writing Cypher queries (that's DefinitionSchema)
 * ❌ Direct database access (that's Neo4jService)
 * ❌ HTTP concerns (that's DefinitionController)
 */
@Injectable()
export class DefinitionService {
  private readonly logger = new Logger(DefinitionService.name);

  constructor(
    private readonly definitionSchema: DefinitionSchema,
    private readonly discussionSchema: DiscussionSchema, // ← Direct injection
    private readonly userSchema: UserSchema,
  ) {}

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Create a new definition with optional discussion
   * Orchestrates: validation + definition creation + discussion creation
   */
  async createDefinition(definitionData: {
    word: string;
    createdBy: string;
    definitionText: string;
    publicCredit?: boolean;
    initialComment?: string;
    isApiDefinition?: boolean;
    isAICreated?: boolean;
  }): Promise<DefinitionData> {
    // Validate input
    this.validateDefinitionInput(definitionData);

    this.logger.log(`Creating definition for word: ${definitionData.word}`);

    try {
      // Generate ID
      const definitionId = uuidv4();

      // Create definition via schema
      const definition = await this.definitionSchema.createDefinition({
        id: definitionId,
        word: definitionData.word.toLowerCase().trim(),
        createdBy: definitionData.createdBy,
        definitionText: definitionData.definitionText.trim(),
        publicCredit: definitionData.publicCredit ?? true,
        isApiDefinition: definitionData.isApiDefinition,
        isAICreated: definitionData.isAICreated,
      });

      // Create discussion if initialComment provided
      // ⚠️ CRITICAL: Use direct DiscussionSchema injection
      if (definitionData.initialComment) {
        try {
          await this.discussionSchema.createDiscussionForNode({
            nodeId: definition.id, // ← Standard 'id' field
            nodeType: 'DefinitionNode',
            nodeIdField: 'id', // ← Standard: 'id' not 'word'
            createdBy: definitionData.createdBy,
            initialComment: definitionData.initialComment,
          });
          this.logger.debug(
            `Created discussion for definition: ${definition.id}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to create discussion for definition ${definition.id}: ${error.message}`,
          );
          // Continue - definition creation succeeded
        }
      }

      this.logger.log(`Successfully created definition: ${definition.id}`);
      return definition;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error creating definition: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create definition: ${error.message}`,
      );
    }
  }

  /**
   * Get a definition by ID
   * Direct delegation to schema
   */
  async getDefinition(id: string): Promise<DefinitionData | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    this.logger.debug(`Getting definition: ${id}`);

    try {
      const definition = await this.definitionSchema.findById(id);

      if (!definition) {
        this.logger.debug(`Definition not found: ${id}`);
        return null;
      }

      return definition;
    } catch (error) {
      this.logger.error(
        `Error getting definition: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get definition: ${error.message}`,
      );
    }
  }

  /**
   * Update a definition
   * Direct delegation to schema
   */
  async updateDefinition(
    id: string,
    updateData: Partial<DefinitionData>,
  ): Promise<DefinitionData> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    // Validate definition text if provided
    if (updateData.definitionText !== undefined) {
      if (
        !updateData.definitionText ||
        updateData.definitionText.trim() === ''
      ) {
        throw new BadRequestException('Definition text cannot be empty');
      }

      if (
        updateData.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH
      ) {
        throw new BadRequestException(
          `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`,
        );
      }
    }

    this.logger.debug(
      `Updating definition: ${id} with data: ${JSON.stringify(updateData)}`,
    );

    try {
      const updatedDefinition = await this.definitionSchema.update(
        id,
        updateData,
      );

      if (!updatedDefinition) {
        throw new NotFoundException(`Definition with ID ${id} not found`);
      }

      this.logger.debug(
        `Updated definition: ${JSON.stringify(updatedDefinition)}`,
      );
      return updatedDefinition;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating definition: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update definition: ${error.message}`,
      );
    }
  }

  /**
   * Delete a definition
   * Direct delegation to schema
   */
  async deleteDefinition(id: string): Promise<void> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    this.logger.debug(`Deleting definition: ${id}`);

    try {
      await this.definitionSchema.delete(id);
      this.logger.debug(`Deleted definition: ${id}`);
    } catch (error) {
      this.logger.error(
        `Error deleting definition: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete definition: ${error.message}`,
      );
    }
  }

  // ============================================
  // VOTING OPERATIONS - Direct delegation
  // ============================================

  /**
   * Vote on definition inclusion
   */
  async voteInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Voting on definition inclusion: ${id} by user: ${userId}, isPositive: ${isPositive}`,
    );

    try {
      const result = await this.definitionSchema.voteInclusion(
        id,
        userId,
        isPositive,
      );
      this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error voting on definition: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on definition: ${error.message}`,
      );
    }
  }

  /**
   * Vote on definition content (quality)
   * Only available after inclusion threshold passed
   */
  async voteContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Voting on definition content: ${id} by user: ${userId}, isPositive: ${isPositive}`,
    );

    try {
      const result = await this.definitionSchema.voteContent(
        id,
        userId,
        isPositive,
      );
      this.logger.debug(`Content vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error voting on definition content: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on definition content: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for a user on a definition
   */
  async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting vote status for definition: ${id} and user: ${userId}`,
    );

    try {
      const status = await this.definitionSchema.getVoteStatus(id, userId);
      this.logger.debug(
        `Vote status for definition ${id} and user ${userId}: ${JSON.stringify(status)}`,
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
   * Remove a vote from a definition
   */
  async removeVote(
    id: string,
    userId: string,
    kind: 'INCLUSION' | 'CONTENT',
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Removing ${kind} vote from definition: ${id} by user: ${userId}`,
    );

    try {
      const result = await this.definitionSchema.removeVote(id, userId, kind);
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
   * Get vote totals for a definition
   */
  async getVotes(id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID is required');
    }

    this.logger.debug(`Getting votes for definition: ${id}`);

    try {
      const votes = await this.definitionSchema.getVotes(id);
      this.logger.debug(`Votes for definition ${id}: ${JSON.stringify(votes)}`);
      return votes;
    } catch (error) {
      this.logger.error(`Error getting votes: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to get votes: ${error.message}`,
      );
    }
  }

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  /**
   * Get definitions for a word
   * Direct delegation to schema
   */
  async getDefinitionsByWord(word: string): Promise<DefinitionData[]> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word is required');
    }

    this.logger.debug(`Getting definitions for word: ${word}`);

    try {
      const definitions = await this.definitionSchema.getDefinitionsByWord(
        word.toLowerCase().trim(),
      );
      this.logger.debug(
        `Retrieved ${definitions.length} definitions for word: ${word}`,
      );
      return definitions;
    } catch (error) {
      this.logger.error(
        `Error getting definitions for word: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get definitions for word: ${error.message}`,
      );
    }
  }

  /**
   * Get top-rated definition for a word
   * Direct delegation to schema
   */
  async getTopDefinitionForWord(word: string): Promise<DefinitionData | null> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word is required');
    }

    this.logger.debug(`Getting top definition for word: ${word}`);

    try {
      const definition = await this.definitionSchema.getTopDefinitionForWord(
        word.toLowerCase().trim(),
      );
      return definition;
    } catch (error) {
      this.logger.error(
        `Error getting top definition: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get top definition: ${error.message}`,
      );
    }
  }

  /**
   * Check if a word is available for definition creation
   * Business rule: word must have passed inclusion threshold
   */
  async canCreateDefinitionForWord(word: string): Promise<boolean> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word is required');
    }

    try {
      return await this.definitionSchema.canCreateDefinitionForWord(
        word.toLowerCase().trim(),
      );
    } catch (error) {
      this.logger.error(
        `Error checking definition availability: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to check definition availability: ${error.message}`,
      );
    }
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  private validateDefinitionInput(data: {
    word: string;
    createdBy: string;
    definitionText: string;
  }): void {
    if (!data.word || data.word.trim() === '') {
      throw new BadRequestException('Word is required');
    }

    if (!data.createdBy || data.createdBy.trim() === '') {
      throw new BadRequestException('Creator is required');
    }

    if (!data.definitionText || data.definitionText.trim() === '') {
      throw new BadRequestException('Definition text is required');
    }

    if (data.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH) {
      throw new BadRequestException(
        `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`,
      );
    }
  }
}
