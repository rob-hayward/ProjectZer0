// src/neo4j/schemas/quantity.schema.ts - STANDARDIZED

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base/base-node.schema';
import { UnitService } from '../../units/unit.service';
import { VotingUtils } from '../../config/voting.config';
import { v4 as uuidv4 } from 'uuid';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { Record } from 'neo4j-driver';

// Quantity-specific data interface extending BaseNodeData
export interface QuantityData extends BaseNodeData {
  question: string;
  unitCategoryId: string;
  defaultUnitId: string;
  responseCount: number;
  keywords?: KeywordWithFrequency[];
  categories?: any[];
  // Note: Only inclusion voting, no content voting (uses quantity responses instead)
}

// Quantity response interface (separate from voting)
export interface QuantityNodeResponse {
  id: string;
  userId: string;
  quantityNodeId: string;
  value: number;
  unitId: string;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
  normalizedValue: number;
}

// Statistics interface for quantity analysis
export interface QuantityNodeStats {
  responseCount: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  standardDeviation: number;
  percentiles: { [key: number]: number };
  distributionCurve: number[][];
  responses?: QuantityNodeResponse[];
}

@Injectable()
export class QuantitySchema extends BaseNodeSchema<QuantityData> {
  protected readonly nodeLabel = 'QuantityNode';
  protected readonly idField = 'id';

  constructor(
    neo4jService: Neo4jService,
    voteSchema: VoteSchema,
    private readonly unitService: UnitService,
  ) {
    super(neo4jService, voteSchema, QuantitySchema.name);
  }

  // IMPLEMENT: Abstract methods from BaseNodeSchema

  protected supportsContentVoting(): boolean {
    return false; // Quantities use numeric responses, not binary content voting
  }

  protected mapNodeFromRecord(record: Record): QuantityData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      question: props.question,
      unitCategoryId: props.unitCategoryId,
      defaultUnitId: props.defaultUnitId,
      responseCount: this.toNumber(props.responseCount),
      discussionId: props.discussionId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      // Only inclusion voting (no content voting)
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      // Content voting disabled for quantities
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<QuantityData>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'id')
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:QuantityNode {id: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: data },
    };
  }

  // QUANTITY-SPECIFIC METHODS

  async createQuantityNode(quantityData: {
    id: string;
    createdBy: string;
    publicCredit: boolean;
    question: string;
    unitCategoryId: string;
    defaultUnitId: string;
    categoryIds?: string[];
    keywords?: KeywordWithFrequency[];
    initialComment?: string;
  }): Promise<QuantityData> {
    try {
      // Validate unit category and default unit
      if (
        !this.unitService.validateUnitInCategory(
          quantityData.unitCategoryId,
          quantityData.defaultUnitId,
        )
      ) {
        throw new BadRequestException(
          `Unit ${quantityData.defaultUnitId} is not valid for category ${quantityData.unitCategoryId}`,
        );
      }

      // Validate category count (0-3)
      if (quantityData.categoryIds && quantityData.categoryIds.length > 3) {
        throw new BadRequestException(
          'Quantity node can have maximum 3 categories',
        );
      }

      this.logger.log(`Creating quantity node with ID: ${quantityData.id}`);

      let query = `
        // Create the quantity node with inclusion voting only (no content voting)
        CREATE (q:QuantityNode {
          id: $id,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          question: $question,
          unitCategoryId: $unitCategoryId,
          defaultUnitId: $defaultUnitId,
          createdAt: datetime(),
          updatedAt: datetime(),
          responseCount: 0,
          // Only inclusion voting
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0
        })
      `;

      // Add category validation and relationships if provided
      if (quantityData.categoryIds && quantityData.categoryIds.length > 0) {
        query += `
        // Validate categories exist and have passed inclusion threshold
        WITH q, $categoryIds as categoryIds
        UNWIND categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0
        
        // Create CATEGORIZED_AS relationships
        CREATE (q)-[:CATEGORIZED_AS]->(cat)
        
        WITH q, collect(cat) as validCategories, categoryIds
        WHERE size(validCategories) = size(categoryIds)
        `;
      }

      // Process each keyword if provided
      if (quantityData.keywords && quantityData.keywords.length > 0) {
        query += `
        WITH q
        UNWIND $keywords as keyword
        
        // Find word node for each keyword (these should already be created by WordService)
        MATCH (w:WordNode {word: keyword.word})
        
        // Create TAGGED relationship with frequency and source
        CREATE (q)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source
        }]->(w)
        
        // Create SHARED_TAG relationship to enable discovery
        CREATE (q)-[:SHARED_TAG]->(w)
        `;
      }

      query += `
        WITH q
        RETURN q as n
      `;

      const params = {
        id: quantityData.id,
        createdBy: quantityData.createdBy,
        publicCredit: quantityData.publicCredit,
        question: quantityData.question,
        unitCategoryId: quantityData.unitCategoryId,
        defaultUnitId: quantityData.defaultUnitId,
        categoryIds: quantityData.categoryIds || [],
        keywords: quantityData.keywords || [],
      };

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Failed to create quantity node - some dependencies may not exist or have not passed inclusion threshold',
        );
      }

      const createdNode = this.mapNodeFromRecord(result.records[0]);

      // Always create discussion using standardized method
      const discussionId = await this.createDiscussion({
        nodeId: quantityData.id,
        nodeType: this.nodeLabel,
        createdBy: quantityData.createdBy,
        initialComment: quantityData.initialComment,
      });

      createdNode.discussionId = discussionId;

      this.logger.log(`Successfully created quantity node: ${createdNode.id}`);
      return createdNode;
    } catch (error) {
      this.logger.error(
        `Error creating quantity node: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (
        error.message &&
        error.message.includes('some dependencies may not exist')
      ) {
        throw new BadRequestException(
          `Some categories or keywords don't exist or haven't passed inclusion threshold.`,
        );
      }

      throw this.standardError('create quantity node', error);
    }
  }

  // Override findById to include quantity-specific data
  async findById(id: string): Promise<QuantityData | null> {
    try {
      this.validateId(id);

      this.logger.debug(`Retrieving quantity node with ID: ${id}`);

      const result = await this.neo4jService.read(
        `
        MATCH (n:QuantityNode {id: $id})
        
        // Get keywords
        OPTIONAL MATCH (n)-[t:TAGGED]->(w:WordNode)
        
        // Get categories
        OPTIONAL MATCH (n)-[:CATEGORIZED_AS]->(cat:CategoryNode)
        
        // Get discussion
        OPTIONAL MATCH (n)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        WITH n, d, 
             collect(DISTINCT {
               word: w.word, 
               frequency: t.frequency,
               source: t.source
             }) as keywords,
             collect(DISTINCT {
               id: cat.id,
               name: cat.name,
               inclusionNetVotes: cat.inclusionNetVotes
             }) as categories
        
        RETURN n,
               keywords,
               categories,
               d.id as discussionId
        `,
        { id },
      );

      if (result.records.length === 0) {
        this.logger.warn(`Quantity node not found with ID: ${id}`);
        return null;
      }

      const quantityNode = this.mapNodeFromRecord(result.records[0]);
      // Attach additional data from the query
      (quantityNode as any).keywords = result.records[0].get('keywords');
      (quantityNode as any).categories = result.records[0].get('categories');
      quantityNode.discussionId = result.records[0].get('discussionId');

      this.logger.debug(`Retrieved quantity node with ID: ${id}`);
      return quantityNode;
    } catch (error) {
      this.logger.error(
        `Error retrieving quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw this.standardError('retrieve quantity node', error);
    }
  }

  // Complex update with unit validation
  async updateQuantityNode(
    id: string,
    updateData: Partial<{
      question: string;
      unitCategoryId: string;
      defaultUnitId: string;
      publicCredit: boolean;
      categoryIds: string[];
      keywords: KeywordWithFrequency[];
    }>,
  ): Promise<QuantityData> {
    try {
      this.validateId(id);

      // Validate category count if updating categories
      if (updateData.categoryIds && updateData.categoryIds.length > 3) {
        throw new BadRequestException(
          'Quantity node can have maximum 3 categories',
        );
      }

      this.logger.log(`Updating quantity node with ID: ${id}`);

      // If unit category or default unit is being updated, validate
      if (updateData.unitCategoryId && updateData.defaultUnitId) {
        if (
          !this.unitService.validateUnitInCategory(
            updateData.unitCategoryId,
            updateData.defaultUnitId,
          )
        ) {
          throw new BadRequestException(
            `Unit ${updateData.defaultUnitId} is not valid for category ${updateData.unitCategoryId}`,
          );
        }
      } else if (updateData.unitCategoryId) {
        // If only category is changing, need to get current default unit to validate
        const currentNode = await this.findById(id);
        if (!currentNode) {
          throw new NotFoundException(`Quantity node with ID ${id} not found`);
        }

        if (
          !this.unitService.validateUnitInCategory(
            updateData.unitCategoryId,
            currentNode.defaultUnitId,
          )
        ) {
          throw new BadRequestException(
            `Current default unit ${currentNode.defaultUnitId} is not valid for new category ${updateData.unitCategoryId}`,
          );
        }
      } else if (updateData.defaultUnitId) {
        // If only default unit is changing, need to get current category to validate
        const currentNode = await this.findById(id);
        if (!currentNode) {
          throw new NotFoundException(`Quantity node with ID ${id} not found`);
        }

        if (
          !this.unitService.validateUnitInCategory(
            currentNode.unitCategoryId,
            updateData.defaultUnitId,
          )
        ) {
          throw new BadRequestException(
            `New default unit ${updateData.defaultUnitId} is not valid for category ${currentNode.unitCategoryId}`,
          );
        }
      }

      // For simple property updates, use the base class update method
      if (
        !updateData.keywords?.length &&
        updateData.categoryIds === undefined
      ) {
        return await this.update(id, updateData);
      }

      // Complex update with keywords and/or categories
      let query = `
        // Match the quantity node to update
        MATCH (q:QuantityNode {id: $id})
        
        // Set updated properties
        SET q += $updateProperties,
            q.updatedAt = datetime()
      `;

      // Handle category updates
      if (updateData.categoryIds !== undefined) {
        query += `
        // Remove existing CATEGORIZED_AS relationships
        WITH q
        OPTIONAL MATCH (q)-[catRel:CATEGORIZED_AS]->()
        DELETE catRel
        
        // Create new category relationships if provided
        WITH q, $categoryIds as categoryIds
        WHERE size(categoryIds) > 0
        UNWIND categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0
        CREATE (q)-[:CATEGORIZED_AS]->(cat)
        
        WITH q, collect(cat) as validCategories, categoryIds
        WHERE size(validCategories) = size(categoryIds) OR size(categoryIds) = 0
        `;
      }

      // Handle keyword updates
      if (updateData.keywords && updateData.keywords.length > 0) {
        query += `
        // Remove existing TAGGED and SHARED_TAG relationships
        WITH q
        OPTIONAL MATCH (q)-[tagRel:TAGGED]->()
        DELETE tagRel
        OPTIONAL MATCH (q)-[shareRel:SHARED_TAG]->()
        DELETE shareRel
        
        // Create new keyword relationships
        WITH q
        UNWIND $keywords as keyword
        MATCH (w:WordNode {word: keyword.word})
        CREATE (q)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source
        }]->(w)
        CREATE (q)-[:SHARED_TAG]->(w)
        `;
      }

      query += `
        WITH q
        RETURN q as n
      `;

      // Prepare update properties (exclude complex fields)
      const updateProperties = { ...updateData };
      delete updateProperties.categoryIds;
      delete updateProperties.keywords;

      const params = {
        id,
        updateProperties,
        categoryIds: updateData.categoryIds || [],
        keywords: updateData.keywords || [],
      };

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Quantity node with ID ${id} not found`);
      }

      const updatedNode = this.mapNodeFromRecord(result.records[0]);
      this.logger.log(`Successfully updated quantity node: ${id}`);
      return updatedNode;
    } catch (error) {
      this.logger.error(
        `Error updating quantity node ${id}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('update quantity node', error);
    }
  }

  // QUANTITY RESPONSE METHODS - Core unique functionality

  /**
   * Submit a response to a quantity node (requires inclusion threshold)
   */
  async submitResponse(responseData: {
    userId: string;
    quantityNodeId: string;
    value: number;
    unitId: string;
  }): Promise<QuantityNodeResponse> {
    try {
      this.logger.log(
        `Submitting response for quantity node ${responseData.quantityNodeId}`,
      );

      // First validate that the quantity node exists and get its category
      const quantityNode = await this.findById(responseData.quantityNodeId);
      if (!quantityNode) {
        throw new NotFoundException(
          `Quantity node with ID ${responseData.quantityNodeId} not found`,
        );
      }

      // Check if quantity node has passed inclusion threshold
      if (!VotingUtils.hasPassedInclusion(quantityNode.inclusionNetVotes)) {
        throw new BadRequestException(
          'Quantity node must pass inclusion threshold before numeric responses are allowed',
        );
      }

      // Validate that the unit is valid for this category
      if (
        !this.unitService.validateUnitInCategory(
          quantityNode.unitCategoryId,
          responseData.unitId,
        )
      ) {
        throw new BadRequestException(
          `Unit ${responseData.unitId} is not valid for category ${quantityNode.unitCategoryId}`,
        );
      }

      // Get normalized value (converted to base unit)
      const normalizedValue = this.unitService.convert(
        quantityNode.unitCategoryId,
        responseData.value,
        responseData.unitId,
        this.unitService.getCategory(quantityNode.unitCategoryId).baseUnit,
      );

      // Generate a unique ID for the response
      const responseId = uuidv4();

      // Check if user has already submitted a response
      const existingResponse = await this.getUserResponse(
        responseData.userId,
        responseData.quantityNodeId,
      );

      if (existingResponse) {
        // Update existing response
        const result = await this.neo4jService.write(
          `
          MATCH (u:User {sub: $userId})
          MATCH (q:QuantityNode {id: $quantityNodeId})
          MATCH (u)-[r:RESPONSE_TO]->(q)
          
          SET r.value = $value,
              r.unitId = $unitId,
              r.updatedAt = datetime(),
              r.normalizedValue = $normalizedValue
          
          RETURN r {
            .id,
            .userId,
            .quantityNodeId,
            .value,
            .unitId,
            .categoryId,
            .createdAt,
            .updatedAt,
            .normalizedValue
          } as response
          `,
          {
            userId: responseData.userId,
            quantityNodeId: responseData.quantityNodeId,
            value: responseData.value,
            unitId: responseData.unitId,
            normalizedValue,
          },
        );

        const updatedResponse = result.records[0].get('response');
        this.logger.log(
          `Updated response for user ${responseData.userId} on quantity node ${responseData.quantityNodeId}`,
        );

        // Recalculate statistics for the quantity node
        await this.recalculateStatistics(responseData.quantityNodeId);

        return updatedResponse;
      } else {
        // Create new response
        const result = await this.neo4jService.write(
          `
          MATCH (u:User {sub: $userId})
          MATCH (q:QuantityNode {id: $quantityNodeId})
          
          CREATE (u)-[r:RESPONSE_TO {
            id: $responseId,
            userId: $userId,
            quantityNodeId: $quantityNodeId,
            value: $value,
            unitId: $unitId,
            categoryId: $categoryId,
            createdAt: datetime(),
            updatedAt: datetime(),
            normalizedValue: $normalizedValue
          }]->(q)
          
          // Increment response count on the quantity node
          SET q.responseCount = COALESCE(q.responseCount, 0) + 1
          
          RETURN r {
            .id,
            .userId,
            .quantityNodeId,
            .value,
            .unitId,
            .categoryId,
            .createdAt,
            .updatedAt,
            .normalizedValue
          } as response
          `,
          {
            responseId,
            userId: responseData.userId,
            quantityNodeId: responseData.quantityNodeId,
            value: responseData.value,
            unitId: responseData.unitId,
            categoryId: quantityNode.unitCategoryId,
            normalizedValue,
          },
        );

        const newResponse = result.records[0].get('response');
        this.logger.log(
          `Created new response for user ${responseData.userId} on quantity node ${responseData.quantityNodeId}`,
        );

        // Recalculate statistics for the quantity node
        await this.recalculateStatistics(responseData.quantityNodeId);

        return newResponse;
      }
    } catch (error) {
      this.logger.error(
        `Error submitting response: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new Error(`Failed to submit response: ${error.message}`);
    }
  }

  /**
   * Get user's response to a quantity node
   */
  async getUserResponse(
    userId: string,
    quantityNodeId: string,
  ): Promise<QuantityNodeResponse | null> {
    try {
      this.logger.debug(
        `Getting user response for user ${userId} on quantity node ${quantityNodeId}`,
      );

      const result = await this.neo4jService.read(
        `
        MATCH (u:User {sub: $userId})
        MATCH (q:QuantityNode {id: $quantityNodeId})
        OPTIONAL MATCH (u)-[r:RESPONSE_TO]->(q)
        
        RETURN r {
          .id,
          .userId,
          .quantityNodeId,
          .value,
          .unitId,
          .categoryId,
          .createdAt,
          .updatedAt,
          .normalizedValue
        } as response
        `,
        { userId, quantityNodeId },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      const response = result.records[0].get('response');
      return response || null;
    } catch (error) {
      this.logger.error(
        `Error getting user response: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get user response: ${error.message}`);
    }
  }

  /**
   * Delete user's response to a quantity node
   */
  async deleteUserResponse(
    userId: string,
    quantityNodeId: string,
  ): Promise<boolean> {
    try {
      this.logger.log(
        `Deleting user response for user ${userId} on quantity node ${quantityNodeId}`,
      );

      const result = await this.neo4jService.write(
        `
        MATCH (u:User {sub: $userId})
        MATCH (q:QuantityNode {id: $quantityNodeId})
        OPTIONAL MATCH (u)-[r:RESPONSE_TO]->(q)
        
        WITH r, q, CASE WHEN r IS NOT NULL THEN true ELSE false END as found
        
        // Delete the response if it exists
        DELETE r
        
        // Decrement response count on the quantity node if response was found
        SET q.responseCount = CASE 
          WHEN found THEN COALESCE(q.responseCount, 1) - 1 
          ELSE COALESCE(q.responseCount, 0) 
        END
        
        RETURN found
        `,
        { userId, quantityNodeId },
      );

      const deleted =
        result.records && result.records.length > 0
          ? result.records[0].get('found')
          : false;

      if (deleted) {
        this.logger.log(
          `Successfully deleted user response for user ${userId} on quantity node ${quantityNodeId}`,
        );
        // Recalculate statistics for the quantity node
        await this.recalculateStatistics(quantityNodeId);
      }

      return deleted;
    } catch (error) {
      this.logger.error(
        `Error deleting user response: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to delete user response: ${error.message}`);
    }
  }

  /**
   * Get all responses for a quantity node
   */
  async getAllResponses(
    quantityNodeId: string,
  ): Promise<QuantityNodeResponse[]> {
    try {
      this.logger.debug(
        `Getting all responses for quantity node ${quantityNodeId}`,
      );

      const result = await this.neo4jService.read(
        `
        MATCH (q:QuantityNode {id: $quantityNodeId})
        MATCH (u:User)-[r:RESPONSE_TO]->(q)
        
        RETURN r {
          .id,
          .userId,
          .quantityNodeId,
          .value,
          .unitId,
          .categoryId,
          .createdAt,
          .updatedAt,
          .normalizedValue
        } as response
        ORDER BY r.createdAt
        `,
        { quantityNodeId },
      );

      if (!result.records || result.records.length === 0) {
        return [];
      }

      return result.records.map((record) => record.get('response'));
    } catch (error) {
      this.logger.error(
        `Error getting all responses: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get all responses: ${error.message}`);
    }
  }

  /**
   * Get statistics for a quantity node
   */
  async getStatistics(quantityNodeId: string): Promise<QuantityNodeStats> {
    try {
      this.logger.debug(
        `Getting statistics for quantity node ${quantityNodeId}`,
      );

      // Get all responses
      const responses = await this.getAllResponses(quantityNodeId);

      if (responses.length === 0) {
        return {
          responseCount: 0,
          min: 0,
          max: 0,
          mean: 0,
          median: 0,
          standardDeviation: 0,
          percentiles: {},
          distributionCurve: [],
          responses: [],
        };
      }

      // Get the normalized (base) values
      const normalizedValues = responses.map((r) => r.normalizedValue);

      // Calculate basic statistics
      const sorted = [...normalizedValues].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const sum = normalizedValues.reduce((acc, val) => acc + val, 0);
      const mean = sum / normalizedValues.length;

      // Calculate median
      const median =
        sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];

      // Calculate standard deviation
      const variance =
        normalizedValues.reduce(
          (acc, val) => acc + Math.pow(val - mean, 2),
          0,
        ) / normalizedValues.length;
      const standardDeviation = Math.sqrt(variance);

      // Calculate percentiles
      const percentiles: { [key: number]: number } = {};
      [10, 25, 50, 75, 90, 95, 99].forEach((p) => {
        const index = (p / 100) * (sorted.length - 1);
        if (Number.isInteger(index)) {
          percentiles[p] = sorted[index];
        } else {
          const lower = Math.floor(index);
          const upper = Math.ceil(index);
          const weight = index - lower;
          percentiles[p] =
            sorted[lower] * (1 - weight) + sorted[upper] * weight;
        }
      });

      // Generate distribution curve
      const distributionCurve = this.generateNormalDistributionCurve(
        mean,
        standardDeviation,
      );

      return {
        responseCount: responses.length,
        min,
        max,
        mean,
        median,
        standardDeviation,
        percentiles,
        distributionCurve,
        responses,
      };
    } catch (error) {
      this.logger.error(
        `Error getting statistics: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get quantity statistics: ${error.message}`);
    }
  }

  /**
   * Recalculate and update statistics for a quantity node
   */
  private async recalculateStatistics(quantityNodeId: string): Promise<void> {
    try {
      this.logger.debug(
        `Recalculating statistics for quantity node ${quantityNodeId}`,
      );

      // Get all responses and calculate new statistics
      const responses = await this.getAllResponses(quantityNodeId);

      if (responses.length === 0) {
        // If no responses, reset statistics
        await this.neo4jService.write(
          `
          MATCH (q:QuantityNode {id: $quantityNodeId})
          SET q.responseCount = 0
          `,
          { quantityNodeId },
        );
        return;
      }

      // Update response count (should already be accurate, but ensure consistency)
      await this.neo4jService.write(
        `
        MATCH (q:QuantityNode {id: $quantityNodeId})
        SET q.responseCount = $responseCount
        `,
        { quantityNodeId, responseCount: responses.length },
      );

      this.logger.debug(
        `Updated statistics for quantity node ${quantityNodeId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error recalculating statistics for quantity node ${quantityNodeId}: ${error.message}`,
        error.stack,
      );
      // Don't throw - this is a background operation
    }
  }

  /**
   * Generate normal distribution curve based on statistics
   */
  private generateNormalDistributionCurve(
    mean: number,
    standardDeviation: number,
    points = 100,
    rangeMultiplier = 3, // How many standard deviations to include on each side
  ): number[][] {
    if (standardDeviation === 0 || isNaN(standardDeviation)) {
      // Special case: all values are identical or there's no valid SD
      return [[mean, 1]];
    }

    const result: number[][] = [];
    const minX = mean - rangeMultiplier * standardDeviation;
    const maxX = mean + rangeMultiplier * standardDeviation;
    const step = (maxX - minX) / (points - 1);

    for (let i = 0; i < points; i++) {
      const x = minX + i * step;
      // Normal distribution probability density function
      const y =
        (1 / (standardDeviation * Math.sqrt(2 * Math.PI))) *
        Math.exp(-0.5 * Math.pow((x - mean) / standardDeviation, 2));
      result.push([x, y]);
    }

    return result;
  }

  /**
   * Check if numeric responses are allowed (quantity node has passed inclusion threshold)
   */
  async isNumericResponseAllowed(quantityNodeId: string): Promise<boolean> {
    try {
      const quantityNode = await this.findById(quantityNodeId);
      if (!quantityNode) return false;

      return VotingUtils.hasPassedInclusion(quantityNode.inclusionNetVotes);
    } catch (error) {
      this.logger.error(
        `Error checking numeric response availability: ${error.message}`,
      );
      return false;
    }
  }

  // DISCOVERY METHODS - New functionality for finding related content

  /**
   * Get content nodes that share categories with the given quantity node
   */
  async getRelatedContentBySharedCategories(
    nodeId: string,
    options: {
      nodeTypes?: string[];
      limit?: number;
      includeStats?: boolean;
    } = {},
  ): Promise<any[]> {
    try {
      const {
        nodeTypes = ['QuantityNode'],
        limit = 10,
        includeStats = false,
      } = options;

      this.logger.debug(
        `Getting related content by shared categories for quantity node ${nodeId}`,
      );

      let nodeTypeFilter = '';
      if (nodeTypes.length > 0) {
        const labels = nodeTypes
          .map((type) => `labels(related) CONTAINS '${type}'`)
          .join(' OR ');
        nodeTypeFilter = `WHERE (${labels}) AND related.id <> $nodeId`;
      }

      const query = `
        MATCH (q:QuantityNode {id: $nodeId})-[:CATEGORIZED_AS]->(cat:CategoryNode)
        MATCH (related)-[:CATEGORIZED_AS]->(cat)
        ${nodeTypeFilter}
        
        // Count shared categories
        WITH related, COUNT(DISTINCT cat) as sharedCategoryCount
        
        ${
          includeStats
            ? `
        // Get statistics if requested
        OPTIONAL MATCH (related:QuantityNode)
        WITH related, sharedCategoryCount, related.responseCount as responseCount
        `
            : `
        WITH related, sharedCategoryCount
        `
        }
        
        RETURN related, 
               sharedCategoryCount
               ${includeStats ? ', responseCount' : ''}
        ORDER BY sharedCategoryCount DESC, related.inclusionNetVotes DESC
        LIMIT $limit
      `;

      const result = await this.neo4jService.read(query, { nodeId, limit });

      return result.records.map((record) => ({
        node: record.get('related').properties,
        sharedCategoryCount: this.toNumber(record.get('sharedCategoryCount')),
        ...(includeStats && {
          responseCount: this.toNumber(record.get('responseCount')) || 0,
        }),
      }));
    } catch (error) {
      this.logger.error(
        `Error getting related content by shared categories: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get related content: ${error.message}`);
    }
  }

  /**
   * Get quantity nodes by unit category
   */
  async getQuantityNodesByUnitCategory(
    unitCategoryId: string,
    options: {
      limit?: number;
      sortBy?: 'netVotes' | 'responseCount' | 'recent';
      includeStats?: boolean;
    } = {},
  ): Promise<any[]> {
    try {
      const { limit = 20, sortBy = 'netVotes', includeStats = false } = options;

      this.logger.debug(
        `Getting quantity nodes by unit category: ${unitCategoryId}`,
      );

      let orderClause = '';
      switch (sortBy) {
        case 'netVotes':
          orderClause = 'ORDER BY q.inclusionNetVotes DESC';
          break;
        case 'responseCount':
          orderClause = 'ORDER BY q.responseCount DESC';
          break;
        case 'recent':
          orderClause = 'ORDER BY q.createdAt DESC';
          break;
      }

      const query = `
        MATCH (q:QuantityNode {unitCategoryId: $unitCategoryId})
        WHERE q.inclusionNetVotes > 0
        
        ${
          includeStats
            ? `
        // Get response statistics if requested
        OPTIONAL MATCH (q)<-[r:RESPONSE_TO]-()
        WITH q, COUNT(r) as actualResponseCount
        `
            : `
        WITH q
        `
        }
        
        RETURN q
               ${includeStats ? ', actualResponseCount' : ''}
        ${orderClause}
        LIMIT $limit
      `;

      const result = await this.neo4jService.read(query, {
        unitCategoryId,
        limit,
      });

      return result.records.map((record) => {
        const node = record.get('q').properties;
        // Convert Neo4j integers
        [
          'responseCount',
          'inclusionPositiveVotes',
          'inclusionNegativeVotes',
          'inclusionNetVotes',
        ].forEach((prop) => {
          if (node[prop] !== undefined) {
            node[prop] = this.toNumber(node[prop]);
          }
        });

        return {
          ...node,
          ...(includeStats && {
            actualResponseCount:
              this.toNumber(record.get('actualResponseCount')) || 0,
          }),
        };
      });
    } catch (error) {
      this.logger.error(
        `Error getting quantity nodes by unit category: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to get quantity nodes by unit category: ${error.message}`,
      );
    }
  }
}
