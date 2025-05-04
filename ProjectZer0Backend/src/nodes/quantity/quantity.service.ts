// src/nodes/quantity/quantity.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  QuantitySchema,
  QuantityNodeStats,
} from '../../neo4j/schemas/quantity.schema';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { UnitService } from '../../units/unit.service';
import { v4 as uuidv4 } from 'uuid';

interface CreateQuantityNodeData {
  createdBy: string;
  publicCredit: boolean;
  question: string;
  unitCategoryId: string;
  defaultUnitId: string;
  userKeywords?: string[];
  initialComment?: string;
}

interface UpdateQuantityNodeData {
  question?: string;
  unitCategoryId?: string;
  defaultUnitId?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  discussionId?: string;
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
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
    private readonly unitService: UnitService,
  ) {}

  /**
   * Create a new quantity node
   */
  async createQuantityNode(nodeData: CreateQuantityNodeData) {
    try {
      // Validate input data
      this.validateCreateQuantityNodeData(nodeData);

      this.logger.log(
        `Creating quantity node with question: "${nodeData.question.substring(0, 30)}..." by user ${nodeData.createdBy}`,
      );

      // Validate unit category and default unit
      if (
        !this.unitService.validateUnitInCategory(
          nodeData.unitCategoryId,
          nodeData.defaultUnitId,
        )
      ) {
        throw new BadRequestException(
          `Default unit ${nodeData.defaultUnitId} is not valid for category ${nodeData.unitCategoryId}`,
        );
      }

      // Extract keywords from question text
      const extractionResult =
        await this.keywordExtractionService.extractKeywords({
          text: nodeData.question,
          userKeywords: nodeData.userKeywords,
        });

      // Process keywords and create any missing word nodes
      await this.processKeywordsForCreation(
        extractionResult.keywords,
        nodeData.createdBy,
        nodeData.publicCredit,
      );

      // Create quantity node with extracted keywords
      const nodeWithId = {
        ...nodeData,
        id: uuidv4(),
        keywords: extractionResult.keywords,
      };

      const createdNode =
        await this.quantitySchema.createQuantityNode(nodeWithId);
      this.logger.log(
        `Successfully created quantity node with ID: ${createdNode.id}`,
      );

      return createdNode;
    } catch (error) {
      this.logger.error(
        `Error creating quantity node: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Quantity node creation failed: ${error.message}`,
      );
    }
  }

  /**
   * Validate input data for creating a quantity node
   */
  private validateCreateQuantityNodeData(data: CreateQuantityNodeData): void {
    if (!data.createdBy) {
      throw new BadRequestException(
        'Creator ID (createdBy) is required for quantity node creation',
      );
    }

    if (!data.question || data.question.trim() === '') {
      throw new BadRequestException('Question text cannot be empty');
    }

    if (data.question.length > 2000) {
      throw new BadRequestException(
        'Question text is too long (maximum 2000 characters)',
      );
    }

    if (typeof data.publicCredit !== 'boolean') {
      throw new BadRequestException('publicCredit must be a boolean value');
    }

    if (!data.unitCategoryId) {
      throw new BadRequestException('Unit category ID is required');
    }

    if (!data.defaultUnitId) {
      throw new BadRequestException('Default unit ID is required');
    }
  }

  /**
   * Process keywords and create any missing word nodes
   */
  private async processKeywordsForCreation(
    keywords: any[],
    createdBy: string,
    publicCredit: boolean,
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
            createdBy: createdBy,
            publicCredit: publicCredit,
          });
          this.logger.debug(
            `Created new word: "${keyword.word}" for quantity node creation`,
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

  /**
   * Get a quantity node by ID
   */
  async getQuantityNode(id: string) {
    try {
      if (!id) {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting quantity node with ID: ${id}`);
      const node = await this.quantitySchema.getQuantityNode(id);

      if (!node) {
        this.logger.debug(`Quantity node with ID ${id} not found`);
        throw new NotFoundException(`Quantity node with ID ${id} not found`);
      }

      return node;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve quantity node: ${error.message}`,
      );
    }
  }

  /**
   * Update a quantity node
   */
  async updateQuantityNode(id: string, updateData: UpdateQuantityNodeData) {
    try {
      if (!id) {
        throw new BadRequestException('Quantity node ID is required');
      }

      // Validate update data
      this.validateUpdateQuantityNodeData(updateData);

      this.logger.log(
        `Updating quantity node ${id}: ${JSON.stringify(updateData)}`,
      );

      // If question text is being updated, re-extract keywords
      if (updateData.question) {
        return this.updateQuantityNodeWithKeywords(id, updateData);
      }

      // If only other fields are being updated, no need to re-extract keywords
      const updatedNode = await this.quantitySchema.updateQuantityNode(
        id,
        updateData,
      );
      if (!updatedNode) {
        throw new NotFoundException(`Quantity node with ID ${id} not found`);
      }

      this.logger.debug(`Quantity node ${id} updated successfully`);
      return updatedNode;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update quantity node: ${error.message}`,
      );
    }
  }

  /**
   * Validate update data for a quantity node
   */
  private validateUpdateQuantityNodeData(data: UpdateQuantityNodeData): void {
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    if (data.question !== undefined && data.question.trim() === '') {
      throw new BadRequestException('Question text cannot be empty');
    }

    if (data.question && data.question.length > 2000) {
      throw new BadRequestException(
        'Question text is too long (maximum 2000 characters)',
      );
    }

    if (
      data.publicCredit !== undefined &&
      typeof data.publicCredit !== 'boolean'
    ) {
      throw new BadRequestException('publicCredit must be a boolean value');
    }
  }

  /**
   * Update a quantity node with new keywords extracted from updated question
   */
  private async updateQuantityNodeWithKeywords(
    id: string,
    updateData: UpdateQuantityNodeData,
  ) {
    try {
      // Get the original node for creator info
      const originalNode = await this.quantitySchema.getQuantityNode(id);
      if (!originalNode) {
        throw new NotFoundException(`Quantity node with ID ${id} not found`);
      }

      const extractionResult =
        await this.keywordExtractionService.extractKeywords({
          text: updateData.question as string,
          userKeywords: updateData.userKeywords,
        });

      // Process new keywords
      await this.processKeywordsForCreation(
        extractionResult.keywords,
        originalNode.createdBy,
        updateData.publicCredit !== undefined
          ? updateData.publicCredit
          : originalNode.publicCredit,
      );

      // Update node with new keywords
      const updatedNode = await this.quantitySchema.updateQuantityNode(id, {
        ...updateData,
        keywords: extractionResult.keywords,
      });

      this.logger.debug(`Quantity node ${id} updated with new keywords`);
      return updatedNode;
    } catch (error) {
      this.logger.error(
        `Error updating quantity node keywords: ${error.message}`,
        error.stack,
      );
      throw error; // Re-throw the error to be handled by the parent function
    }
  }

  /**
   * Delete a quantity node
   */
  async deleteQuantityNode(id: string) {
    try {
      if (!id) {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.log(`Deleting quantity node with ID: ${id}`);

      const result = await this.quantitySchema.deleteQuantityNode(id);
      this.logger.log(`Quantity node ${id} deleted successfully`);

      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete quantity node: ${error.message}`,
      );
    }
  }

  /**
   * Submit a response to a quantity node
   */
  async submitResponse(responseData: SubmitResponseData) {
    try {
      // Validate response data
      this.validateResponseData(responseData);

      this.logger.log(
        `Submitting response to quantity node ${responseData.quantityNodeId}`,
      );

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
   * Validate response data
   */
  private validateResponseData(data: SubmitResponseData): void {
    if (!data.userId) {
      throw new BadRequestException('User ID is required');
    }

    if (!data.quantityNodeId) {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (data.value === undefined || data.value === null || isNaN(data.value)) {
      throw new BadRequestException('Response value must be a valid number');
    }

    if (!data.unitId) {
      throw new BadRequestException('Unit ID is required');
    }
  }

  /**
   * Get a user's response to a quantity node
   */
  async getUserResponse(userId: string, quantityNodeId: string) {
    try {
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      if (!quantityNodeId) {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(
        `Getting response from user ${userId} for quantity node ${quantityNodeId}`,
      );

      const response = await this.quantitySchema.getUserResponse(
        userId,
        quantityNodeId,
      );
      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

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
  async deleteUserResponse(userId: string, quantityNodeId: string) {
    try {
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      if (!quantityNodeId) {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.log(
        `Deleting response from user ${userId} for quantity node ${quantityNodeId}`,
      );

      const deleted = await this.quantitySchema.deleteUserResponse(
        userId,
        quantityNodeId,
      );

      if (!deleted) {
        this.logger.debug(
          `No response found to delete for user ${userId} on quantity node ${quantityNodeId}`,
        );
        return { success: false, message: 'No response found to delete' };
      }

      this.logger.log(
        `Successfully deleted response from user ${userId} for quantity node ${quantityNodeId}`,
      );
      return { success: true, message: 'Response successfully deleted' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

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
  async getStatistics(quantityNodeId: string): Promise<QuantityNodeStats> {
    try {
      if (!quantityNodeId) {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(
        `Getting statistics for quantity node ${quantityNodeId}`,
      );

      // First verify the node exists
      const node = await this.quantitySchema.getQuantityNode(quantityNodeId);
      if (!node) {
        throw new NotFoundException(
          `Quantity node with ID ${quantityNodeId} not found`,
        );
      }

      const stats = await this.quantitySchema.getStatistics(quantityNodeId);
      return stats;
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

  /**
   * Set visibility status for a quantity node
   */
  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      if (!id) {
        throw new BadRequestException('Quantity node ID is required');
      }

      if (typeof isVisible !== 'boolean') {
        throw new BadRequestException('isVisible must be a boolean value');
      }

      this.logger.log(
        `Setting visibility for quantity node ${id}: ${isVisible}`,
      );

      const updatedNode = await this.quantitySchema.setVisibilityStatus(
        id,
        isVisible,
      );

      this.logger.debug(
        `Visibility status updated for quantity node ${id}: ${isVisible}`,
      );
      return updatedNode;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error setting visibility for quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to set quantity node visibility: ${error.message}`,
      );
    }
  }

  /**
   * Get visibility status for a quantity node
   */
  async getVisibilityStatus(id: string) {
    try {
      if (!id) {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting visibility status for quantity node ${id}`);
      const status = await this.quantitySchema.getVisibilityStatus(id);

      return { isVisible: status };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting visibility status for quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get quantity node visibility status: ${error.message}`,
      );
    }
  }
}
