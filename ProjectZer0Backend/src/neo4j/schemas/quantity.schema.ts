// src/neo4j/schemas/quantity.schema.ts - REFACTORED - BUG #1 FIXED

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import {
  CategorizedNodeSchema,
  CategorizedNodeData,
} from './base/categorized.schema';
import { DiscussionSchema } from './discussion.schema';
import { UserSchema } from './user.schema';
import { UnitService } from '../../units/unit.service';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { VotingUtils } from '../../config/voting.config';
import { Record } from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';

/**
 * QuantityNode data interface
 * Questions that request numeric responses with units
 */
export interface QuantityData extends CategorizedNodeData {
  question: string;
  unitCategoryId: string;
  defaultUnitId: string;
  responseCount?: number;
  // Inherited from CategorizedNodeData:
  // - categories (up to 3)
  // Inherited from TaggedNodeData through CategorizedNodeData:
  // - keywords (tagged with relevant words)
  // Inherited from BaseNodeData:
  // - All voting fields (inclusion only for quantities)
  // - discussionId, createdBy, publicCredit, etc.
}

/**
 * Quantity response interface (separate from voting)
 * Represents a user's numeric response to a quantity question
 */
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

/**
 * Statistics interface for quantity analysis
 */
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

/**
 * Schema for QuantityNode - questions requesting numeric responses.
 *
 * Inheritance hierarchy:
 * BaseNodeSchema -> TaggedNodeSchema -> CategorizedNodeSchema -> QuantitySchema
 *
 * Key characteristics:
 * - Uses standard 'id' field
 * - Inclusion voting only (no content voting - uses numeric responses instead)
 * - Has discussions (via injected DiscussionSchema)
 * - IS taggable (multiple keywords from the question)
 * - IS categorizable (up to 3 categories)
 * - Requires unit category and default unit specification
 * - Numeric responses only after inclusion threshold passed
 * - Provides statistical aggregation of responses
 */
@Injectable()
export class QuantitySchema extends CategorizedNodeSchema<QuantityData> {
  protected readonly nodeLabel = 'QuantityNode';
  protected readonly idField = 'id'; // Standard ID field
  protected readonly maxCategories = 3; // Quantities can have up to 3 categories

  constructor(
    neo4jService: Neo4jService,
    voteSchema: VoteSchema,
    private readonly discussionSchema: DiscussionSchema,
    private readonly userSchema: UserSchema,
    private readonly unitService: UnitService,
  ) {
    super(neo4jService, voteSchema, QuantitySchema.name);
  }

  // ============================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================

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
    // Filter out complex fields that need special handling
    const setClause = Object.keys(data)
      .filter(
        (key) =>
          key !== 'id' &&
          key !== 'keywords' &&
          key !== 'categories' &&
          key !== 'categoryIds',
      )
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

  // ============================================
  // QUANTITY-SPECIFIC METHODS
  // ============================================

  /**
   * Creates a new quantity question with keywords and categories
   */
  async createQuantityNode(quantityData: {
    id?: string;
    createdBy: string;
    publicCredit: boolean;
    question: string;
    unitCategoryId: string;
    defaultUnitId: string;
    categoryIds?: string[];
    keywords?: KeywordWithFrequency[];
    initialComment?: string;
  }): Promise<QuantityData> {
    // Validate inputs
    if (!quantityData.question || quantityData.question.trim() === '') {
      throw new BadRequestException('Question text cannot be empty');
    }

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

    // Validate category count
    if (
      quantityData.categoryIds &&
      quantityData.categoryIds.length > this.maxCategories
    ) {
      throw new BadRequestException(
        `Quantity node can have maximum ${this.maxCategories} categories`,
      );
    }

    const quantityId = quantityData.id || uuidv4();

    this.logger.log(`Creating quantity node with ID: ${quantityId}`);

    try {
      let query = `
        // Create the quantity node with inclusion voting only (no content voting)
        CREATE (q:QuantityNode {
          id: $id,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          question: $question,
          unitCategoryId: $unitCategoryId,
          defaultUnitId: $defaultUnitId,
          responseCount: 0,
          createdAt: datetime(),
          updatedAt: datetime(),
          // Only inclusion voting
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0
        })
      `;

      const params: any = {
        id: quantityId,
        createdBy: quantityData.createdBy,
        publicCredit: quantityData.publicCredit,
        question: quantityData.question.trim(),
        unitCategoryId: quantityData.unitCategoryId,
        defaultUnitId: quantityData.defaultUnitId,
      };

      // Add categories if provided
      // FIXED BUG #1: Removed WHERE cat.inclusionNetVotes > 0
      if (quantityData.categoryIds && quantityData.categoryIds.length > 0) {
        query += `
        // Match categories and create relationships
        WITH q
        UNWIND $categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        
        // Create CATEGORIZED_AS relationships
        CREATE (q)-[:CATEGORIZED_AS {
          createdAt: datetime()
        }]->(cat)
        
        // Create SHARED_CATEGORY relationships for discovery
        WITH q, cat
        OPTIONAL MATCH (other:QuantityNode)-[:CATEGORIZED_AS]->(cat)
        WHERE other.id <> q.id AND other.inclusionNetVotes > 0
        FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (q)-[sc:SHARED_CATEGORY {categoryId: cat.id}]->(other)
          ON CREATE SET sc.strength = 1,
                        sc.categoryName = cat.name,
                        sc.createdAt = datetime()
          ON MATCH SET sc.strength = sc.strength + 1,
                       sc.updatedAt = datetime()
        )
        `;
        params.categoryIds = quantityData.categoryIds;
      }

      // Add keywords if provided
      // FIXED BUG #1: Removed WHERE w.inclusionNetVotes > 0
      if (quantityData.keywords && quantityData.keywords.length > 0) {
        query += `
        // Process keywords
        WITH q
        UNWIND $keywords as keyword
        
        // Find word node for each keyword (should already exist)
        MATCH (w:WordNode {word: keyword.word})
        
        // Create TAGGED relationship
        CREATE (q)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source,
          createdAt: datetime()
        }]->(w)
        
        // Create SHARED_TAG relationships for discovery
        WITH q, w, keyword
        OPTIONAL MATCH (other:QuantityNode)-[t:TAGGED]->(w)
        WHERE other.id <> q.id
        FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (q)-[st:SHARED_TAG {word: w.word}]->(other)
          ON CREATE SET st.strength = keyword.frequency * t.frequency,
                        st.createdAt = datetime()
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency),
                       st.updatedAt = datetime()
        )
        `;
        params.keywords = quantityData.keywords;
      }

      // Create user relationship
      query += `
        // Create CREATED relationship for user tracking
        WITH q
        MATCH (u:User {sub: $createdBy})
        CREATE (u)-[:CREATED {
          createdAt: datetime(),
          nodeType: 'quantity'
        }]->(q)
        
        RETURN q as n
      `;

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Failed to create quantity node - some dependencies may not exist or have not passed inclusion threshold',
        );
      }

      const createdNode = this.mapNodeFromRecord(result.records[0]);

      // Create discussion using the centralized DiscussionSchema
      const discussionResult =
        await this.discussionSchema.createDiscussionForNode({
          nodeId: quantityId,
          nodeType: this.nodeLabel,
          nodeIdField: 'id',
          createdBy: quantityData.createdBy,
          initialComment: quantityData.initialComment,
        });

      createdNode.discussionId = discussionResult.discussionId;

      // Track user participation
      try {
        await this.userSchema.addCreatedNode(
          quantityData.createdBy,
          quantityId,
          'quantity',
        );
      } catch (error) {
        this.logger.warn(
          `Could not track user creation for quantity ${quantityId}: ${error.message}`,
        );
      }

      this.logger.log(`Successfully created quantity node: ${createdNode.id}`);
      return createdNode;
    } catch (error) {
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

      this.logger.error(
        `Error creating quantity node: ${error.message}`,
        error.stack,
      );
      throw this.standardError('create quantity node', error);
    }
  }

  /**
   * Gets a quantity node with all its relationships
   */
  async getQuantity(id: string): Promise<QuantityData | null> {
    this.validateId(id);

    this.logger.debug(`Retrieving quantity node with ID: ${id}`);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (q:QuantityNode {id: $id})
        
        // Get keywords
        OPTIONAL MATCH (q)-[t:TAGGED]->(w:WordNode)
        
        // Get categories
        OPTIONAL MATCH (q)-[:CATEGORIZED_AS]->(cat:CategoryNode)
        WHERE cat.inclusionNetVotes > 0
        
        // Get discussion
        OPTIONAL MATCH (q)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        // Get response count
        OPTIONAL MATCH (q)<-[:RESPONSE_TO]-(response)
        
        RETURN q as n,
               collect(DISTINCT {
                 word: w.word, 
                 frequency: t.frequency,
                 source: t.source
               }) as keywords,
               collect(DISTINCT {
                 id: cat.id,
                 name: cat.name,
                 description: cat.description,
                 inclusionNetVotes: cat.inclusionNetVotes
               }) as categories,
               d.id as discussionId,
               count(DISTINCT response) as actualResponseCount
        `,
        { id },
      );

      if (result.records.length === 0) {
        this.logger.warn(`Quantity node not found with ID: ${id}`);
        return null;
      }

      const record = result.records[0];
      const quantityNode = this.mapNodeFromRecord(record);

      // Add related data
      const keywords = record
        .get('keywords')
        .filter((k: any) => k.word !== null);
      const categories = record
        .get('categories')
        .filter((c: any) => c.id !== null);

      if (keywords.length > 0) quantityNode.keywords = keywords;
      if (categories.length > 0) quantityNode.categories = categories;

      quantityNode.discussionId = record.get('discussionId');
      quantityNode.responseCount = this.toNumber(
        record.get('actualResponseCount'),
      );

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

  /**
   * Updates a quantity node including its keywords and categories
   */
  async updateQuantityNode(
    id: string,
    updateData: {
      question?: string;
      unitCategoryId?: string;
      defaultUnitId?: string;
      publicCredit?: boolean;
      categoryIds?: string[];
      keywords?: KeywordWithFrequency[];
    },
  ): Promise<QuantityData | null> {
    this.validateId(id);

    // Validate category count if updating categories
    if (
      updateData.categoryIds &&
      updateData.categoryIds.length > this.maxCategories
    ) {
      throw new BadRequestException(
        `Quantity node can have maximum ${this.maxCategories} categories`,
      );
    }

    // If unit category or default unit is being updated, validate
    if (updateData.unitCategoryId || updateData.defaultUnitId) {
      const currentNode = await this.getQuantity(id);
      if (!currentNode) {
        throw new NotFoundException(`Quantity node with ID ${id} not found`);
      }

      const categoryToValidate =
        updateData.unitCategoryId || currentNode.unitCategoryId;
      const unitToValidate =
        updateData.defaultUnitId || currentNode.defaultUnitId;

      if (
        !this.unitService.validateUnitInCategory(
          categoryToValidate,
          unitToValidate,
        )
      ) {
        throw new BadRequestException(
          `Unit ${unitToValidate} is not valid for category ${categoryToValidate}`,
        );
      }
    }

    // If no keywords or categories to update, use base update
    if (!updateData.keywords && updateData.categoryIds === undefined) {
      return await this.update(id, updateData);
    }

    // Complex update with keywords/categories
    try {
      // Update categories if provided (uses inherited method)
      if (updateData.categoryIds !== undefined) {
        await this.updateCategories(id, updateData.categoryIds);
      }

      // Update keywords if provided (uses inherited method)
      if (updateData.keywords) {
        await this.updateKeywords(id, updateData.keywords);
      }

      // Update basic properties
      const basicUpdate = { ...updateData };
      delete basicUpdate.keywords;
      delete basicUpdate.categoryIds;

      if (Object.keys(basicUpdate).length > 0) {
        await this.update(id, basicUpdate);
      }

      // Return updated quantity
      return await this.getQuantity(id);
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
      throw this.standardError('update quantity node', error);
    }
  }

  // ============================================
  // QUANTITY RESPONSE METHODS - Core unique functionality
  // ============================================

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
      const quantityNode = await this.getQuantity(responseData.quantityNodeId);
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
        const responseId = uuidv4();

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
      const quantityNode = await this.getQuantity(quantityNodeId);
      if (!quantityNode) return false;

      return VotingUtils.hasPassedInclusion(quantityNode.inclusionNetVotes);
    } catch (error) {
      this.logger.error(
        `Error checking numeric response availability: ${error.message}`,
      );
      return false;
    }
  }

  // ============================================
  // DISCOVERY METHODS - Leveraging inherited functionality
  // ============================================

  /**
   * Get quantity nodes related by tags or categories
   */
  async getRelatedQuantities(
    quantityId: string,
    limit: number = 10,
  ): Promise<QuantityData[]> {
    // Use inherited method from CategorizedNodeSchema
    const related = await this.findRelatedByCombined(quantityId, limit);

    // Load full quantity data for each related ID
    const quantities = await Promise.all(
      related.map((r) => this.getQuantity(r.nodeId)),
    );

    return quantities.filter((q) => q !== null) as QuantityData[];
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

  /**
   * Get all quantity nodes with optional filters
   */
  async getQuantities(
    options: {
      includeUnapproved?: boolean;
      categoryId?: string;
      unitCategoryId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<QuantityData[]> {
    const {
      includeUnapproved = false,
      categoryId,
      unitCategoryId,
      limit = 50,
      offset = 0,
    } = options;

    try {
      const whereConditions = [];
      const params: any = { limit, offset };

      if (!includeUnapproved) {
        whereConditions.push('q.inclusionNetVotes > 0');
      }

      if (categoryId) {
        whereConditions.push(
          'EXISTS((q)-[:CATEGORIZED_AS]->(:CategoryNode {id: $categoryId}))',
        );
        params.categoryId = categoryId;
      }

      if (unitCategoryId) {
        whereConditions.push('q.unitCategoryId = $unitCategoryId');
        params.unitCategoryId = unitCategoryId;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      const result = await this.neo4jService.read(
        `
        MATCH (q:QuantityNode)
        ${whereClause}
        RETURN q as n
        ORDER BY q.inclusionNetVotes DESC, q.responseCount DESC
        SKIP $offset
        LIMIT $limit
        `,
        params,
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(
        `Error getting quantity nodes: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get quantity nodes', error);
    }
  }

  /**
   * Check quantity statistics
   */
  async checkQuantities(): Promise<{ count: number }> {
    try {
      const result = await this.neo4jService.read(
        'MATCH (q:QuantityNode) RETURN count(q) as count',
        {},
      );

      const count = this.toNumber(result.records[0].get('count'));
      return { count };
    } catch (error) {
      this.logger.error(`Error checking quantities: ${error.message}`);
      throw this.standardError('check quantities', error);
    }
  }
}
