// src/nodes/quantity/quantity.service.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { QuantitySchema } from '../../neo4j/schemas/quantity.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { CategoryService } from '../category/category.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { UnitService } from '../../units/unit.service';
import { v4 as uuidv4 } from 'uuid';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { TEXT_LIMITS } from '../../constants/validation';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';
import type {
  QuantityData,
  QuantityNodeResponse,
  QuantityNodeStats,
} from '../../neo4j/schemas/quantity.schema';

/**
 * QuantityService - Business logic for quantity node operations
 *
 * ARCHITECTURE:
 * - Delegates all CRUD operations to QuantitySchema
 * - Injects DiscussionSchema directly (NOT DiscussionService)
 * - Orchestrates quantity creation + keyword extraction + word creation + discussion
 * - Handles business validation beyond schema rules
 *
 * KEY CHARACTERISTICS:
 * - Uses 'id' as ID field (standard)
 * - Discussion creation uses nodeIdField: 'id'
 * - Inclusion voting ONLY (no content voting - uses numeric responses instead)
 * - AI keyword extraction (like Statement/OpenQuestion/Answer)
 * - Auto-creates missing word nodes
 * - 0-3 categories
 * - Requires unit category and default unit
 * - Statistical aggregation of numeric responses
 *
 * RESPONSIBILITIES:
 * ✅ Orchestrate multiple schema calls (quantity + discussion + keywords + categories)
 * ✅ Business validation (text limits, category count, unit validation)
 * ✅ Keyword extraction and word creation
 * ✅ Numeric response management
 * ✅ Statistical calculations
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Writing Cypher queries (that's QuantitySchema)
 * ❌ Direct database access (that's Neo4jService)
 * ❌ HTTP concerns (that's QuantityController)
 */

// ============================================
// INTERFACES
// ============================================

interface CreateQuantityNodeData {
  createdBy: string;
  publicCredit: boolean;
  question: string;
  unitCategoryId: string;
  defaultUnitId: string;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment?: string;
}

interface UpdateQuantityNodeData {
  question?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  categoryIds?: string[];
}

interface SubmitResponseData {
  userId: string;
  quantityNodeId: string;
  value: number;
  unitId: string;
}

@Injectable()
export class QuantityService {
  private readonly logger = new Logger(QuantityService.name);

  constructor(
    private readonly quantitySchema: QuantitySchema,
    private readonly discussionSchema: DiscussionSchema, // ← Direct injection
    private readonly userSchema: UserSchema,
    private readonly categoryService: CategoryService,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
    private readonly unitService: UnitService,
  ) {}

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Create a new quantity node with optional discussion
   * Orchestrates: validation + unit validation + keyword extraction + word creation + quantity creation + discussion creation
   */
  async createQuantityNode(
    quantityData: CreateQuantityNodeData,
  ): Promise<QuantityData> {
    this.validateCreateQuantityNodeData(quantityData);

    const quantityId = uuidv4();
    this.logger.log(
      `Creating quantity node: ${quantityData.question.substring(0, 50)}...`,
    );

    try {
      // Validate unit category and default unit
      const isValidUnit = await this.unitService.validateUnitInCategory(
        quantityData.unitCategoryId,
        quantityData.defaultUnitId,
      );

      if (!isValidUnit) {
        throw new BadRequestException(
          `Unit ${quantityData.defaultUnitId} is not valid for category ${quantityData.unitCategoryId}`,
        );
      }

      // Extract keywords if not provided by user
      let keywords: KeywordWithFrequency[] = [];
      if (quantityData.userKeywords && quantityData.userKeywords.length > 0) {
        keywords = quantityData.userKeywords.map((keyword) => ({
          word: keyword,
          frequency: 1,
          source: 'user' as const,
        }));
        this.logger.debug(`Using ${keywords.length} user-provided keywords`);
      } else {
        try {
          const extractionResult =
            await this.keywordExtractionService.extractKeywords({
              text: quantityData.question,
            });
          keywords = extractionResult.keywords;
          this.logger.debug(`Extracted ${keywords.length} keywords via AI`);
        } catch (error) {
          this.logger.error(
            `Keyword extraction failed: ${error.message}`,
            error.stack,
          );
          throw new InternalServerErrorException(
            'Failed to extract keywords from question',
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
              createdBy: quantityData.createdBy,
              publicCredit: quantityData.publicCredit ?? true,
            });
          }
        } catch (error) {
          this.logger.warn(
            `Failed to create word '${keyword.word}': ${error.message}`,
          );
          // Continue - don't fail quantity creation if word creation fails
        }
      }

      // Validate categories if provided
      if (quantityData.categoryIds && quantityData.categoryIds.length > 0) {
        await this.validateCategories(quantityData.categoryIds);
      }

      // Create the quantity node via schema
      const createdQuantity = await this.quantitySchema.createQuantityNode({
        id: quantityId,
        createdBy: quantityData.createdBy,
        publicCredit: quantityData.publicCredit,
        question: quantityData.question,
        unitCategoryId: quantityData.unitCategoryId,
        defaultUnitId: quantityData.defaultUnitId,
        keywords,
        categoryIds: quantityData.categoryIds,
      });

      // Create discussion if initialComment provided
      // ⚠️ CRITICAL: Use direct DiscussionSchema injection, NOT DiscussionService
      if (quantityData.initialComment) {
        try {
          await this.discussionSchema.createDiscussionForNode({
            nodeId: createdQuantity.id,
            nodeType: 'QuantityNode',
            nodeIdField: 'id', // ← Standard ID field
            createdBy: quantityData.createdBy,
            initialComment: quantityData.initialComment,
          });
          this.logger.debug(
            `Created discussion for quantity node: ${createdQuantity.id}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to create discussion for quantity node ${createdQuantity.id}: ${error.message}`,
          );
          // Continue - quantity creation succeeded
        }
      }

      this.logger.log(
        `Successfully created quantity node: ${createdQuantity.id}`,
      );
      return createdQuantity;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error(
        `Error creating quantity node: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create quantity node: ${error.message}`,
      );
    }
  }

  /**
   * Get a quantity node by ID
   * Direct delegation to schema with error handling
   */
  async getQuantityNode(id: string): Promise<QuantityData> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    this.logger.debug(`Getting quantity node: ${id}`);

    try {
      // ✅ CHANGE THIS LINE:
      // const quantityNode = await this.quantitySchema.getQuantity(id);
      // TO THIS:
      const quantityNode = await this.quantitySchema.findById(id);

      if (!quantityNode) {
        throw new NotFoundException(`Quantity node with ID ${id} not found`);
      }

      return quantityNode;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error getting quantity node: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get quantity node: ${error.message}`,
      );
    }
  }

  /**
   * Update a quantity node with optional keyword re-extraction
   * Orchestrates: validation + optional keyword re-extraction + word creation + update
   */
  async updateQuantityNode(
    id: string,
    updateData: UpdateQuantityNodeData,
  ): Promise<QuantityData> {
    this.validateUpdateQuantityNodeData(updateData);

    this.logger.debug(`Updating quantity node: ${id}`);

    try {
      // Check if question text is changing
      const textChanged =
        updateData.question !== undefined && updateData.question !== '';

      if (textChanged) {
        // Get original quantity node for user context
        const originalQuantity = await this.getQuantityNode(id);

        // Extract keywords for the new text
        let keywords: KeywordWithFrequency[] = [];
        if (updateData.userKeywords && updateData.userKeywords.length > 0) {
          keywords = updateData.userKeywords.map((keyword) => ({
            word: keyword,
            frequency: 1,
            source: 'user' as const,
          }));
          this.logger.debug(`Using ${keywords.length} user-provided keywords`);
        } else {
          try {
            const extractionResult =
              await this.keywordExtractionService.extractKeywords({
                text: updateData.question,
              });
            keywords = extractionResult.keywords;
            this.logger.debug(
              `Re-extracted ${keywords.length} keywords via AI`,
            );
          } catch (error) {
            this.logger.warn(
              `Keyword extraction failed during update: ${error.message}`,
            );
            keywords = [];
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
                createdBy: originalQuantity.createdBy,
                publicCredit:
                  updateData.publicCredit ?? originalQuantity.publicCredit,
              });
            }
          } catch (error) {
            this.logger.warn(
              `Failed to create word '${keyword.word}': ${error.message}`,
            );
            // Continue - don't fail update if word creation fails
          }
        }

        // Add keywords to update data
        (updateData as any).keywords = keywords;
      }

      // Validate categories if provided
      if (updateData.categoryIds !== undefined) {
        if (updateData.categoryIds.length > 0) {
          await this.validateCategories(updateData.categoryIds);
        }
      }

      // Update via schema
      const updatedQuantity = await this.quantitySchema.update(id, updateData);

      if (!updatedQuantity) {
        throw new NotFoundException(`Quantity node with ID ${id} not found`);
      }

      this.logger.debug(`Successfully updated quantity node: ${id}`);
      return updatedQuantity;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating quantity node: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update quantity node: ${error.message}`,
      );
    }
  }

  /**
   * Delete a quantity node
   * Direct delegation to schema
   */
  async deleteQuantityNode(id: string): Promise<{ success: boolean }> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    this.logger.debug(`Deleting quantity node: ${id}`);

    try {
      // Verify quantity node exists before deletion
      await this.getQuantityNode(id);

      await this.quantitySchema.delete(id);
      this.logger.debug(`Deleted quantity node: ${id}`);

      return { success: true };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting quantity node: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete quantity node: ${error.message}`,
      );
    }
  }

  // ============================================
  // VOTING OPERATIONS - INCLUSION ONLY
  // ============================================

  /**
   * Vote on quantity node inclusion
   * Quantity nodes only support inclusion voting (no content voting - uses numeric responses)
   */
  async voteInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Voting on quantity node inclusion: ${id} by user: ${userId}, isPositive: ${isPositive}`,
    );

    try {
      const result = await this.quantitySchema.voteInclusion(
        id,
        userId,
        isPositive,
      );
      this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error voting on quantity node: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on quantity node: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for a user on a quantity node
   */
  async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting vote status for quantity node: ${id} and user: ${userId}`,
    );

    try {
      const status = await this.quantitySchema.getVoteStatus(id, userId);
      this.logger.debug(
        `Vote status for quantity node ${id} and user ${userId}: ${JSON.stringify(status)}`,
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
   * Remove a vote from a quantity node
   */
  async removeVote(id: string, userId: string): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Removing vote on quantity node: ${id} by user: ${userId}`,
    );

    try {
      const result = await this.quantitySchema.removeVote(
        id,
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
   * Get vote totals for a quantity node
   */
  async getVotes(id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    this.logger.debug(`Getting votes for quantity node: ${id}`);

    try {
      const votes = await this.quantitySchema.getVotes(id);
      this.logger.debug(
        `Votes for quantity node ${id}: ${JSON.stringify(votes)}`,
      );
      return votes;
    } catch (error) {
      this.logger.error(`Error getting votes: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to get votes: ${error.message}`,
      );
    }
  }

  // ============================================
  // NUMERIC RESPONSE OPERATIONS
  // ============================================

  /**
   * Submit a numeric response to a quantity node
   * Validates: quantity exists, passed inclusion, unit is valid
   */
  async submitResponse(
    responseData: SubmitResponseData,
  ): Promise<QuantityNodeResponse> {
    this.validateResponseData(responseData);

    this.logger.log(
      `Submitting response to quantity node ${responseData.quantityNodeId}`,
    );

    try {
      // Check if quantity node has passed inclusion threshold
      const votes = await this.quantitySchema.getVotes(
        responseData.quantityNodeId,
      );

      if (!votes || votes.inclusionNetVotes <= 0) {
        throw new BadRequestException(
          'Quantity node must pass inclusion threshold before responses can be submitted',
        );
      }

      // Get quantity node to validate unit against its unit category
      // ✅ CHANGE THIS LINE:
      // const quantityNode = await this.getQuantityNode(
      //   responseData.quantityNodeId,
      // );
      // TO THIS:
      const quantityNode = await this.quantitySchema.findById(
        responseData.quantityNodeId,
      );

      if (!quantityNode) {
        throw new NotFoundException(
          `Quantity node ${responseData.quantityNodeId} not found`,
        );
      }

      // Validate unit is valid for this quantity's unit category
      const isValidUnit = this.unitService.validateUnitInCategory(
        quantityNode.unitCategoryId,
        responseData.unitId,
      );

      if (!isValidUnit) {
        throw new BadRequestException(
          `Unit ${responseData.unitId} is not valid for category ${quantityNode.unitCategoryId}`,
        );
      }

      const result = await this.quantitySchema.submitResponse(responseData);

      this.logger.log(
        `Successfully submitted response to quantity node ${responseData.quantityNodeId}`,
      );
      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error submitting response: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to submit response: ${error.message}`,
      );
    }
  }

  /**
   * Get a user's response to a quantity node
   */
  async getUserResponse(
    userId: string,
    quantityNodeId: string,
  ): Promise<QuantityNodeResponse | null> {
    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    if (!quantityNodeId || quantityNodeId.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    this.logger.debug(
      `Getting user response for user ${userId} on quantity node ${quantityNodeId}`,
    );

    try {
      const response = await this.quantitySchema.getUserResponse(
        userId,
        quantityNodeId,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Error getting user response: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get user response: ${error.message}`,
      );
    }
  }

  /**
   * Delete a user's response to a quantity node
   */
  async deleteUserResponse(
    userId: string,
    quantityNodeId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    if (!quantityNodeId || quantityNodeId.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    this.logger.log(
      `Deleting user response for user ${userId} on quantity node ${quantityNodeId}`,
    );

    try {
      const deleted = await this.quantitySchema.deleteUserResponse(
        userId,
        quantityNodeId,
      );

      if (deleted) {
        return {
          success: true,
          message: 'Response successfully deleted',
        };
      } else {
        return {
          success: false,
          message: 'No response found to delete',
        };
      }
    } catch (error) {
      this.logger.error(
        `Error deleting user response: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete user response: ${error.message}`,
      );
    }
  }

  /**
   * Get statistics for a quantity node
   */
  async getStatistics(id: string): Promise<QuantityNodeStats> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    this.logger.debug(`Getting statistics for quantity node: ${id}`);

    try {
      // Verify node exists
      await this.getQuantityNode(id);

      const statistics = await this.quantitySchema.getStatistics(id);

      this.logger.debug(
        `Statistics for quantity node ${id}: ${statistics.responseCount} responses`,
      );
      return statistics;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting statistics: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get statistics: ${error.message}`,
      );
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Check if a quantity node has passed inclusion threshold
   */
  async isQuantityNodeApproved(id: string): Promise<boolean> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    try {
      const votes = await this.quantitySchema.getVotes(id);
      return votes ? votes.inclusionNetVotes > 0 : false;
    } catch (error) {
      this.logger.error(
        `Error checking quantity node approval: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to check quantity node approval: ${error.message}`,
      );
    }
  }

  /**
   * Check if numeric responses are allowed (quantity node has passed inclusion)
   */
  async isNumericResponseAllowed(id: string): Promise<boolean> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Quantity node ID is required');
    }

    try {
      return await this.isQuantityNodeApproved(id);
    } catch (error) {
      this.logger.error(
        `Error checking numeric response availability: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to check numeric response availability: ${error.message}`,
      );
    }
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  /**
   * Validate quantity node creation data
   */
  private validateCreateQuantityNodeData(
    quantityData: CreateQuantityNodeData,
  ): void {
    if (!quantityData.question || quantityData.question.trim() === '') {
      throw new BadRequestException('Question text is required');
    }

    if (quantityData.question.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
      throw new BadRequestException(
        `Question text cannot exceed ${TEXT_LIMITS.MAX_STATEMENT_LENGTH} characters`,
      );
    }

    if (!quantityData.createdBy || quantityData.createdBy.trim() === '') {
      throw new BadRequestException('Creator ID is required');
    }

    if (typeof quantityData.publicCredit !== 'boolean') {
      throw new BadRequestException('Public credit flag is required');
    }

    if (
      !quantityData.unitCategoryId ||
      quantityData.unitCategoryId.trim() === ''
    ) {
      throw new BadRequestException('Unit category ID is required');
    }

    if (
      !quantityData.defaultUnitId ||
      quantityData.defaultUnitId.trim() === ''
    ) {
      throw new BadRequestException('Default unit ID is required');
    }

    // Validate category count (0-3)
    if (quantityData.categoryIds && quantityData.categoryIds.length > 3) {
      throw new BadRequestException(
        'Quantity node can have maximum 3 categories',
      );
    }
  }

  /**
   * Validate quantity node update data
   */
  private validateUpdateQuantityNodeData(
    updateData: UpdateQuantityNodeData,
  ): void {
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update data provided');
    }

    if (updateData.question !== undefined) {
      if (!updateData.question || updateData.question.trim() === '') {
        throw new BadRequestException('Question text cannot be empty');
      }

      if (updateData.question.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
        throw new BadRequestException(
          `Question text cannot exceed ${TEXT_LIMITS.MAX_STATEMENT_LENGTH} characters`,
        );
      }
    }

    if (
      updateData.publicCredit !== undefined &&
      typeof updateData.publicCredit !== 'boolean'
    ) {
      throw new BadRequestException('Public credit must be a boolean value');
    }

    // Validate category count if provided (0-3)
    if (updateData.categoryIds && updateData.categoryIds.length > 3) {
      throw new BadRequestException(
        'Quantity node can have maximum 3 categories',
      );
    }
  }

  /**
   * Validate numeric response data
   */
  private validateResponseData(responseData: SubmitResponseData): void {
    if (!responseData.userId || responseData.userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    if (
      !responseData.quantityNodeId ||
      responseData.quantityNodeId.trim() === ''
    ) {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (typeof responseData.value !== 'number' || isNaN(responseData.value)) {
      throw new BadRequestException('Valid numeric value is required');
    }

    if (!responseData.unitId || responseData.unitId.trim() === '') {
      throw new BadRequestException('Unit ID is required');
    }
  }

  /**
   * Validate categories exist and are approved for use
   */
  private async validateCategories(categoryIds: string[]): Promise<void> {
    if (!categoryIds || categoryIds.length === 0) return;

    const validationPromises = categoryIds.map(async (categoryId) => {
      try {
        const category = await this.categoryService.getCategory(categoryId);
        if (!category) {
          throw new BadRequestException(
            `Category ${categoryId} does not exist`,
          );
        }
        if (category.inclusionNetVotes <= 0) {
          throw new BadRequestException(
            `Category ${categoryId} must have passed inclusion threshold`,
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Category ${categoryId} does not exist or is not accessible`,
        );
      }
    });

    await Promise.all(validationPromises);
  }
}
