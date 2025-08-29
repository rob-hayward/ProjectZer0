// src/neo4j/schemas/quantity.schema.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { VotingUtils } from '../../config/voting.config';
import { UnitService } from '../../units/unit.service';
import { v4 as uuidv4 } from 'uuid';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from './vote.schema';

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

export interface QuantityNodeStats {
  responseCount: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  standardDeviation: number;
  percentiles: Record<number, number>;
  distributionCurve: number[][];
  responses?: QuantityNodeResponse[];
}

@Injectable()
export class QuantitySchema {
  private readonly logger = new Logger(QuantitySchema.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly voteSchema: VoteSchema,
    private readonly unitService: UnitService,
  ) {}

  /**
   * Create a new quantity node
   */
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
  }) {
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
      this.logger.debug(`Quantity data: ${JSON.stringify(quantityData)}`);

      let query = `
        // Create the quantity node with both inclusion and content voting
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
          // Both inclusion and content voting
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0
        })
      `;

      // Add category validation and relationships if provided
      if (quantityData.categoryIds && quantityData.categoryIds.length > 0) {
        query += `
        // Validate categories exist and have passed inclusion threshold
        WITH q, $categoryIds as categoryIds
        UNWIND categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0 // Must have passed inclusion
        
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
        
        // Connect to other quantity nodes that share this keyword
        WITH q, w, keyword
        OPTIONAL MATCH (o:QuantityNode)-[t:TAGGED]->(w)
        WHERE o.id <> q.id
        
        // Create SHARED_TAG relationships between quantity nodes
        FOREACH (dummy IN CASE WHEN o IS NOT NULL THEN [1] ELSE [] END |
          MERGE (q)-[st:SHARED_TAG {word: w.word}]->(o)
          ON CREATE SET st.strength = keyword.frequency * t.frequency
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
        )
        `;
      }

      // Create discussion node and initial comment if provided
      query += `
        // Create CREATED relationship for user-created content
        WITH q, $createdBy as userId
        MATCH (u:User {sub: userId})
        CREATE (u)-[:CREATED {
            createdAt: datetime(),
            type: 'quantity'
        }]->(q)
        
        // Create discussion node automatically
        WITH DISTINCT q
        CREATE (d:DiscussionNode {
          id: apoc.create.uuid(),
          createdAt: datetime(),
          createdBy: $createdBy,
          visibilityStatus: true
        })
        CREATE (q)-[:HAS_DISCUSSION]->(d)
        
        // Create initial comment only if provided
        WITH q, d, $initialComment as initialComment
        WHERE initialComment IS NOT NULL AND size(initialComment) > 0
        CREATE (c:CommentNode {
          id: apoc.create.uuid(),
          createdBy: $createdBy,
          commentText: initialComment,
          createdAt: datetime(),
          updatedAt: datetime(),
          positiveVotes: 0,
          negativeVotes: 0,
          visibilityStatus: true
        })
        CREATE (d)-[:HAS_COMMENT]->(c)
        
        RETURN q
      `;

      // Prepare parameters
      const params: any = {
        id: quantityData.id,
        createdBy: quantityData.createdBy,
        publicCredit: quantityData.publicCredit,
        question: quantityData.question,
        unitCategoryId: quantityData.unitCategoryId,
        defaultUnitId: quantityData.defaultUnitId,
        initialComment: quantityData.initialComment || null,
      };

      if (quantityData.categoryIds && quantityData.categoryIds.length > 0) {
        params.categoryIds = quantityData.categoryIds;
      }

      if (quantityData.keywords && quantityData.keywords.length > 0) {
        params.keywords = quantityData.keywords;
      }

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Failed to create quantity node - some dependencies may not exist or have not passed inclusion threshold',
        );
      }

      const createdQuantityNode = result.records[0].get('q').properties;
      this.logger.log(
        `Successfully created quantity node with ID: ${createdQuantityNode.id}`,
      );
      this.logger.debug(
        `Created quantity node: ${JSON.stringify(createdQuantityNode)}`,
      );

      return createdQuantityNode;
    } catch (error) {
      this.logger.error(
        `Error creating quantity node: ${error.message}`,
        error.stack,
      );

      // Handle specific error cases
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle the specific case of missing dependencies
      if (
        error.message &&
        error.message.includes('some dependencies may not exist')
      ) {
        throw new BadRequestException(
          `Some categories or keywords don't exist or haven't passed inclusion threshold.`,
        );
      }

      throw new Error(`Failed to create quantity node: ${error.message}`);
    }
  }

  /**
   * Get a quantity node by ID
   */
  async getQuantityNode(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID cannot be empty');
      }

      this.logger.debug(`Retrieving quantity node with ID: ${id}`);

      const result = await this.neo4jService.read(
        `
        MATCH (q:QuantityNode {id: $id})
        
        // Get keywords
        OPTIONAL MATCH (q)-[t:TAGGED]->(w:WordNode)
        
        // Get categories
        OPTIONAL MATCH (q)-[:CATEGORIZED_AS]->(cat:CategoryNode)
        
        // Get discussion
        OPTIONAL MATCH (q)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        // Get statistics
        WITH q, d, 
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
        
        RETURN q,
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

      const quantityNode = result.records[0].get('q').properties;
      quantityNode.keywords = result.records[0].get('keywords');
      quantityNode.categories = result.records[0].get('categories');
      quantityNode.discussionId = result.records[0].get('discussionId');

      // Convert Neo4j integers to JavaScript numbers
      [
        'responseCount',
        'inclusionPositiveVotes',
        'inclusionNegativeVotes',
        'inclusionNetVotes',
        'contentPositiveVotes',
        'contentNegativeVotes',
        'contentNetVotes',
      ].forEach((prop) => {
        if (quantityNode[prop] !== undefined) {
          quantityNode[prop] = this.toNumber(quantityNode[prop]);
        }
      });

      this.logger.debug(`Retrieved quantity node with ID: ${id}`);
      return quantityNode;
    } catch (error) {
      this.logger.error(
        `Error retrieving quantity node ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to retrieve quantity node: ${error.message}`);
    }
  }

  /**
   * Update a quantity node
   */
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
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID cannot be empty');
      }

      // Validate category count if updating categories
      if (updateData.categoryIds && updateData.categoryIds.length > 3) {
        throw new BadRequestException(
          'Quantity node can have maximum 3 categories',
        );
      }

      this.logger.log(`Updating quantity node with ID: ${id}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateData)}`);

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
        const currentNode = await this.getQuantityNode(id);
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
        const currentNode = await this.getQuantityNode(id);
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

      // Complex update with keywords and/or categories
      if (
        (updateData.keywords && updateData.keywords.length > 0) ||
        updateData.categoryIds !== undefined
      ) {
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
          OPTIONAL MATCH (q)-[sharedRel:SHARED_TAG]->()
          DELETE tagRel, sharedRel
          
          // Process updated keywords
          WITH q
          UNWIND $keywords as keyword
          
          // Find word node for each keyword
          MATCH (w:WordNode {word: keyword.word})
          
          // Create new TAGGED relationship
          CREATE (q)-[:TAGGED {
            frequency: keyword.frequency,
            source: keyword.source
          }]->(w)
          
          // Reconnect to other quantity nodes that share this keyword
          WITH q, w, keyword
          OPTIONAL MATCH (o:QuantityNode)-[t:TAGGED]->(w)
          WHERE o.id <> q.id
          
          // Create new SHARED_TAG relationships
          FOREACH (dummy IN CASE WHEN o IS NOT NULL THEN [1] ELSE [] END |
            MERGE (q)-[st:SHARED_TAG {word: w.word}]->(o)
            ON CREATE SET st.strength = keyword.frequency * t.frequency
            ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
          )
          `;
        }

        query += ` RETURN q`;

        const result = await this.neo4jService.write(query, {
          id,
          updateProperties: {
            question: updateData.question,
            unitCategoryId: updateData.unitCategoryId,
            defaultUnitId: updateData.defaultUnitId,
            publicCredit: updateData.publicCredit,
            updatedAt: new Date().toISOString(),
          },
          categoryIds: updateData.categoryIds || [],
          keywords: updateData.keywords || [],
        });

        if (!result.records || result.records.length === 0) {
          throw new NotFoundException(`Quantity node with ID ${id} not found`);
        }

        const updatedQuantityNode = result.records[0].get('q').properties;
        this.logger.log(`Successfully updated quantity node with ID: ${id}`);
        this.logger.debug(
          `Updated quantity node: ${JSON.stringify(updatedQuantityNode)}`,
        );

        return updatedQuantityNode;
      } else {
        // Simple update without changing relationships
        const result = await this.neo4jService.write(
          `
          MATCH (q:QuantityNode {id: $id})
          SET q += $updateProperties,
              q.updatedAt = datetime()
          RETURN q
          `,
          {
            id,
            updateProperties: {
              question: updateData.question,
              unitCategoryId: updateData.unitCategoryId,
              defaultUnitId: updateData.defaultUnitId,
              publicCredit: updateData.publicCredit,
            },
          },
        );

        if (!result.records || result.records.length === 0) {
          throw new NotFoundException(`Quantity node with ID ${id} not found`);
        }

        const updatedQuantityNode = result.records[0].get('q').properties;
        this.logger.log(`Successfully updated quantity node with ID: ${id}`);
        this.logger.debug(
          `Updated quantity node: ${JSON.stringify(updatedQuantityNode)}`,
        );

        return updatedQuantityNode;
      }
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

      throw new Error(`Failed to update quantity node: ${error.message}`);
    }
  }

  /**
   * Delete a quantity node
   */
  async deleteQuantityNode(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID cannot be empty');
      }

      this.logger.log(`Deleting quantity node with ID: ${id}`);

      // First check if the quantity node exists
      const checkResult = await this.neo4jService.read(
        `MATCH (q:QuantityNode {id: $id}) RETURN q`,
        { id },
      );

      if (!checkResult.records || checkResult.records.length === 0) {
        throw new NotFoundException(`Quantity node with ID ${id} not found`);
      }

      // Delete the quantity node and all its relationships
      await this.neo4jService.write(
        `
        MATCH (q:QuantityNode {id: $id})
        
        // Get associated discussion and comments to delete as well
        OPTIONAL MATCH (q)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        OPTIONAL MATCH (d)-[:HAS_COMMENT]->(c:CommentNode)
        
        // Also get all responses to delete
        OPTIONAL MATCH (q)<-[:RESPONSE_TO]-(r:QuantityResponseNode)
        
        // Delete everything
        DETACH DELETE q, d, c, r
        `,
        { id },
      );

      this.logger.log(`Successfully deleted quantity node with ID: ${id}`);
      return {
        success: true,
        message: `Quantity node with ID ${id} successfully deleted`,
      };
    } catch (error) {
      this.logger.error(
        `Error deleting quantity node ${id}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new Error(`Failed to delete quantity node: ${error.message}`);
    }
  }

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
      this.logger.debug(`Response data: ${JSON.stringify(responseData)}`);

      // First validate that the quantity node exists and get its category
      const quantityNode = await this.getQuantityNode(
        responseData.quantityNodeId,
      );
      if (!quantityNode) {
        throw new NotFoundException(
          `Quantity node with ID ${responseData.quantityNodeId} not found`,
        );
      }

      // Check if quantity node has passed inclusion threshold
      if (
        !VotingUtils.isNumericResponseAllowed(quantityNode.inclusionNetVotes)
      ) {
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
   * Get a user's response to a quantity node
   */
  async getUserResponse(
    userId: string,
    quantityNodeId: string,
  ): Promise<QuantityNodeResponse | null> {
    try {
      this.logger.debug(
        `Getting response for user ${userId} on quantity node ${quantityNodeId}`,
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

      if (
        !result.records ||
        result.records.length === 0 ||
        !result.records[0].get('response')
      ) {
        return null;
      }

      return result.records[0].get('response');
    } catch (error) {
      this.logger.error(
        `Error getting user response: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get user response: ${error.message}`);
    }
  }

  /**
   * Delete a user's response to a quantity node
   */
  async deleteUserResponse(
    userId: string,
    quantityNodeId: string,
  ): Promise<boolean> {
    try {
      this.logger.log(
        `Deleting response for user ${userId} on quantity node ${quantityNodeId}`,
      );

      const result = await this.neo4jService.write(
        `
        MATCH (u:User {sub: $userId})
        MATCH (q:QuantityNode {id: $quantityNodeId})
        OPTIONAL MATCH (u)-[r:RESPONSE_TO]->(q)
        
        WITH u, q, r
        WHERE r IS NOT NULL
        
        DELETE r
        
        // Decrement response count on the quantity node
        SET q.responseCount = COALESCE(q.responseCount, 1) - 1
        
        RETURN count(r) > 0 as deleted
        `,
        { userId, quantityNodeId },
      );

      const deleted = result.records[0].get('deleted');

      if (deleted) {
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
      throw new Error(`Failed to get responses: ${error.message}`);
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
          responses: [], // Include empty responses array
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
      const squaredDifferences = normalizedValues.map((v) =>
        Math.pow(v - mean, 2),
      );
      const variance =
        squaredDifferences.reduce((acc, val) => acc + val, 0) /
        normalizedValues.length;
      const standardDeviation = Math.sqrt(variance);

      // Calculate percentiles (25th, 50th, 75th, 90th, 95th, 99th)
      const percentiles: Record<number, number> = {};
      [25, 50, 75, 90, 95, 99].forEach((p) => {
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        percentiles[p] = sorted[Math.min(index, sorted.length - 1)];
      });

      // Generate distribution curve data
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
        responses: responses, // Include the raw responses array
      };
    } catch (error) {
      this.logger.error(
        `Error getting statistics: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get statistics: ${error.message}`);
    }
  }

  /**
   * Recalculate and store statistics for a quantity node
   */
  private async recalculateStatistics(quantityNodeId: string): Promise<void> {
    try {
      const stats = await this.getStatistics(quantityNodeId);

      // Store basic statistics directly on the quantity node for quick access
      await this.neo4jService.write(
        `
        MATCH (q:QuantityNode {id: $quantityNodeId})
        SET q.min = $min,
            q.max = $max,
            q.mean = $mean,
            q.median = $median,
            q.standardDeviation = $standardDeviation
        `,
        {
          quantityNodeId,
          min: stats.min,
          max: stats.max,
          mean: stats.mean,
          median: stats.median,
          standardDeviation: stats.standardDeviation,
        },
      );

      this.logger.debug(
        `Updated statistics for quantity node ${quantityNodeId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error recalculating statistics: ${error.message}`,
        error.stack,
      );
      // Don't throw, as this is a background operation
    }
  }

  /**
   * Generate data points for a normal distribution curve based on statistics
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

  // Voting methods - BOTH INCLUSION AND CONTENT for Quantity nodes

  async voteQuantityInclusion(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      this.logger.log(
        `Processing inclusion vote on quantity node ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );
      return await this.voteSchema.vote(
        'QuantityNode',
        { id },
        sub,
        isPositive,
        'INCLUSION',
      );
    } catch (error) {
      this.logger.error(
        `Error voting on quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to vote on quantity node: ${error.message}`);
    }
  }

  async voteQuantityContent(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      this.logger.log(
        `Processing content vote on quantity node ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );
      return await this.voteSchema.vote(
        'QuantityNode',
        { id },
        sub,
        isPositive,
        'CONTENT',
      );
    } catch (error) {
      this.logger.error(
        `Error voting on quantity node content ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to vote on quantity node content: ${error.message}`,
      );
    }
  }

  async getQuantityVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    try {
      this.logger.debug(
        `Getting vote status for quantity node ${id} by user ${sub}`,
      );
      return await this.voteSchema.getVoteStatus('QuantityNode', { id }, sub);
    } catch (error) {
      this.logger.error(
        `Error getting vote status for quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to get quantity node vote status: ${error.message}`,
      );
    }
  }

  async removeQuantityVote(
    id: string,
    sub: string,
    kind: 'INCLUSION' | 'CONTENT',
  ): Promise<VoteResult> {
    try {
      this.logger.log(
        `Removing ${kind} vote from quantity node ${id} by user ${sub}`,
      );
      return await this.voteSchema.removeVote(
        'QuantityNode',
        { id },
        sub,
        kind,
      );
    } catch (error) {
      this.logger.error(
        `Error removing vote from quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to remove quantity node vote: ${error.message}`);
    }
  }

  async getQuantityVotes(id: string): Promise<VoteResult | null> {
    try {
      this.logger.debug(`Getting votes for quantity node ${id}`);

      const voteStatus = await this.voteSchema.getVoteStatus(
        'QuantityNode',
        { id },
        '',
      );
      if (!voteStatus) {
        return null;
      }

      return {
        inclusionPositiveVotes: voteStatus.inclusionPositiveVotes,
        inclusionNegativeVotes: voteStatus.inclusionNegativeVotes,
        inclusionNetVotes: voteStatus.inclusionNetVotes,
        contentPositiveVotes: voteStatus.contentPositiveVotes,
        contentNegativeVotes: voteStatus.contentNegativeVotes,
        contentNetVotes: voteStatus.contentNetVotes,
      };
    } catch (error) {
      this.logger.error(
        `Error getting votes for quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get quantity node votes: ${error.message}`);
    }
  }

  // Visibility methods

  async setVisibilityStatus(quantityNodeId: string, isVisible: boolean) {
    try {
      if (!quantityNodeId || quantityNodeId.trim() === '') {
        throw new BadRequestException('Quantity node ID cannot be empty');
      }

      this.logger.log(
        `Setting visibility for quantity node ${quantityNodeId}: ${isVisible}`,
      );

      const result = await this.neo4jService.write(
        `
        MATCH (q:QuantityNode {id: $quantityNodeId})
        SET q.visibilityStatus = $isVisible,
            q.updatedAt = datetime()
        RETURN q
        `,
        { quantityNodeId, isVisible },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(
          `Quantity node with ID ${quantityNodeId} not found`,
        );
      }

      const updatedNode = result.records[0].get('q').properties;
      this.logger.log(
        `Successfully updated visibility for quantity node ${quantityNodeId}`,
      );

      return updatedNode;
    } catch (error) {
      this.logger.error(
        `Error setting visibility for quantity node ${quantityNodeId}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new Error(`Failed to set visibility status: ${error.message}`);
    }
  }

  async getVisibilityStatus(quantityNodeId: string) {
    try {
      if (!quantityNodeId || quantityNodeId.trim() === '') {
        throw new BadRequestException('Quantity node ID cannot be empty');
      }

      this.logger.debug(
        `Getting visibility status for quantity node ${quantityNodeId}`,
      );

      const result = await this.neo4jService.read(
        `
        MATCH (q:QuantityNode {id: $quantityNodeId})
        RETURN q.visibilityStatus
        `,
        { quantityNodeId },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(
          `Quantity node with ID ${quantityNodeId} not found`,
        );
      }

      const visibilityStatus =
        result.records[0]?.get('q.visibilityStatus') ?? true;
      this.logger.debug(
        `Visibility status for quantity node ${quantityNodeId}: ${visibilityStatus}`,
      );

      return visibilityStatus;
    } catch (error) {
      this.logger.error(
        `Error getting visibility status for quantity node ${quantityNodeId}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new Error(`Failed to get visibility status: ${error.message}`);
    }
  }

  /**
   * Check if numeric responses are allowed (quantity node has passed inclusion threshold)
   */
  async isNumericResponseAllowed(quantityNodeId: string): Promise<boolean> {
    try {
      const quantityNode = await this.getQuantityNode(quantityNodeId);
      if (!quantityNode) return false;

      return VotingUtils.isNumericResponseAllowed(
        quantityNode.inclusionNetVotes,
      );
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
      nodeTypes?: ('statement' | 'answer' | 'openquestion' | 'quantity')[];
      limit?: number;
      offset?: number;
      sortBy?:
        | 'category_overlap'
        | 'created'
        | 'inclusion_votes'
        | 'content_votes';
      sortDirection?: 'asc' | 'desc';
      excludeSelf?: boolean;
      minCategoryOverlap?: number;
    } = {},
  ): Promise<any[]> {
    try {
      const {
        nodeTypes,
        limit = 10,
        offset = 0,
        sortBy = 'category_overlap',
        sortDirection = 'desc',
        excludeSelf = true,
        minCategoryOverlap = 1,
      } = options;

      this.logger.debug(
        `Getting related content by shared categories for quantity node ${nodeId}`,
      );

      let query = `
        MATCH (current:QuantityNode {id: $nodeId})
        MATCH (current)-[:CATEGORIZED_AS]->(sharedCat:CategoryNode)
        MATCH (related)-[:CATEGORIZED_AS]->(sharedCat)
        WHERE (related.visibilityStatus <> false OR related.visibilityStatus IS NULL)
      `;

      // Exclude self if requested
      if (excludeSelf) {
        query += ` AND related.id <> $nodeId`;
      }

      // Add node type filter if specified
      if (nodeTypes && nodeTypes.length > 0) {
        const nodeLabels = nodeTypes
          .map((type) => {
            switch (type) {
              case 'statement':
                return 'StatementNode';
              case 'answer':
                return 'AnswerNode';
              case 'openquestion':
                return 'OpenQuestionNode';
              case 'quantity':
                return 'QuantityNode';
              default:
                return null;
            }
          })
          .filter(Boolean);

        if (nodeLabels.length > 0) {
          query += ` AND (${nodeLabels.map((label) => `related:${label}`).join(' OR ')})`;
        }
      } else {
        query += ` AND (related:StatementNode OR related:AnswerNode OR related:OpenQuestionNode OR related:QuantityNode)`;
      }

      // Group by related node and count category overlaps
      query += `
        WITH related,
             count(DISTINCT sharedCat) as categoryOverlap,
             collect(DISTINCT {
               id: sharedCat.id, 
               name: sharedCat.name
             }) as sharedCategories
        WHERE categoryOverlap >= $minCategoryOverlap
      `;

      // Add sorting
      if (sortBy === 'category_overlap') {
        query += ` ORDER BY categoryOverlap ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'created') {
        query += ` ORDER BY related.createdAt ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'inclusion_votes') {
        query += ` ORDER BY related.inclusionNetVotes ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'content_votes') {
        query += ` ORDER BY COALESCE(related.contentNetVotes, 0) ${sortDirection.toUpperCase()}`;
      }

      // Add pagination
      query += ` SKIP $offset LIMIT $limit`;

      // Return formatted results
      query += `
        RETURN {
          id: related.id,
          type: CASE 
            WHEN related:StatementNode THEN 'statement'
            WHEN related:AnswerNode THEN 'answer' 
            WHEN related:OpenQuestionNode THEN 'openquestion'
            WHEN related:QuantityNode THEN 'quantity'
            ELSE 'unknown'
          END,
          content: CASE
            WHEN related:StatementNode THEN related.statement
            WHEN related:AnswerNode THEN related.answerText
            WHEN related:OpenQuestionNode THEN related.questionText  
            WHEN related:QuantityNode THEN related.question
            ELSE null
          END,
          createdBy: related.createdBy,
          createdAt: related.createdAt,
          inclusionNetVotes: related.inclusionNetVotes,
          contentNetVotes: COALESCE(related.contentNetVotes, 0),
          categoryOverlap: categoryOverlap,
          sharedCategories: sharedCategories
        } as relatedNode
      `;

      const result = await this.neo4jService.read(query, {
        nodeId,
        offset,
        limit,
        minCategoryOverlap,
      });

      const relatedNodes = result.records.map((record) => {
        const node = record.get('relatedNode');
        // Convert Neo4j integers
        ['inclusionNetVotes', 'contentNetVotes', 'categoryOverlap'].forEach(
          (prop) => {
            if (node[prop] !== undefined) {
              node[prop] = this.toNumber(node[prop]);
            }
          },
        );
        return node;
      });

      this.logger.debug(
        `Found ${relatedNodes.length} related nodes by shared categories`,
      );
      return relatedNodes;
    } catch (error) {
      this.logger.error(
        `Error getting related content by shared categories: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get related content: ${error.message}`);
    }
  }

  /**
   * Get all categories associated with this quantity node
   */
  async getNodeCategories(quantityNodeId: string): Promise<any[]> {
    try {
      this.logger.debug(
        `Getting categories for quantity node ${quantityNodeId}`,
      );

      const result = await this.neo4jService.read(
        `
        MATCH (q:QuantityNode {id: $quantityNodeId})
        MATCH (q)-[:CATEGORIZED_AS]->(c:CategoryNode)
        
        // Get parent hierarchy for each category
        OPTIONAL MATCH path = (root:CategoryNode)-[:PARENT_OF*]->(c)
        WHERE NOT EXISTS((other:CategoryNode)-[:PARENT_OF]->(root))
        
        RETURN collect({
          id: c.id,
          name: c.name,
          description: c.description,
          inclusionNetVotes: c.inclusionNetVotes,
          path: CASE 
            WHEN path IS NOT NULL 
            THEN [node IN nodes(path) | {id: node.id, name: node.name}]
            ELSE [{id: c.id, name: c.name}]
          END
        }) as categories
        `,
        { quantityNodeId },
      );

      if (!result.records || result.records.length === 0) {
        return [];
      }

      const categories = result.records[0].get('categories');

      // Convert Neo4j integers
      categories.forEach((category) => {
        if (category.inclusionNetVotes !== undefined) {
          category.inclusionNetVotes = this.toNumber(
            category.inclusionNetVotes,
          );
        }
      });

      this.logger.debug(
        `Retrieved ${categories.length} categories for quantity node ${quantityNodeId}`,
      );
      return categories;
    } catch (error) {
      this.logger.error(
        `Error getting quantity node categories: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to get quantity node categories: ${error.message}`,
      );
    }
  }

  /**
   * Helper method to convert Neo4j integer values to JavaScript numbers
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'object' && value !== null) {
      if ('low' in value && typeof value.low === 'number') {
        return Number(value.low);
      } else if ('valueOf' in value && typeof value.valueOf === 'function') {
        return Number(value.valueOf());
      }
    }

    return Number(value);
  }
}
