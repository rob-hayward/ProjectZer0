// src/neo4j/schemas/quantity.schema.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { UnitService } from '../../units/unit.service';
import { v4 as uuidv4 } from 'uuid';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';

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

      this.logger.log(`Creating quantity node with ID: ${quantityData.id}`);
      this.logger.debug(`Quantity data: ${JSON.stringify(quantityData)}`);

      const result = await this.neo4jService.write(
        `
        // Create the quantity node
        CREATE (q:QuantityNode {
          id: $id,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          question: $question,
          unitCategoryId: $unitCategoryId,
          defaultUnitId: $defaultUnitId,
          createdAt: datetime(),
          updatedAt: datetime(),
          responseCount: 0
        })
        
        // Process each keyword if provided
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
        MATCH (o:QuantityNode)-[t:TAGGED]->(w)
        WHERE o.id <> q.id
        
        // Create SHARED_TAG relationships between quantity nodes
        MERGE (q)-[st:SHARED_TAG {word: w.word}]->(o)
        ON CREATE SET st.strength = keyword.frequency * t.frequency
        ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
        
        // Create discussion node and initial comment if provided
        WITH DISTINCT q
        CREATE (d:DiscussionNode {
          id: apoc.create.uuid(),
          createdAt: datetime(),
          createdBy: $createdBy,
          visibilityStatus: true
        })
        CREATE (q)-[:HAS_DISCUSSION]->(d)
        
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
        `,
        {
          ...quantityData,
          keywords: quantityData.keywords || [],
          initialComment: quantityData.initialComment || null,
        },
      );

      if (!result.records || result.records.length === 0) {
        throw new Error('Failed to create quantity node');
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

      // Handle the specific case of missing word nodes
      if (error.message && error.message.includes('not found')) {
        throw new BadRequestException(
          `Some keywords don't have corresponding word nodes. Ensure all keywords exist as words before creating the quantity node.`,
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
        
        // Get discussion
        OPTIONAL MATCH (q)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        // Get statistics
        WITH q, d, 
             collect(DISTINCT {
               word: w.word, 
               frequency: t.frequency,
               source: t.source
             }) as keywords
        
        RETURN q,
               keywords,
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
      quantityNode.discussionId = result.records[0].get('discussionId');

      // Convert Neo4j integers to JavaScript numbers
      if (quantityNode.responseCount !== undefined) {
        quantityNode.responseCount = this.toNumber(quantityNode.responseCount);
      }

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
      keywords: KeywordWithFrequency[];
    }>,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID cannot be empty');
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

      // If keywords are provided, update the relationships
      if (updateData.keywords && updateData.keywords.length > 0) {
        const result = await this.neo4jService.write(
          `
          // Match the quantity node to update
          MATCH (q:QuantityNode {id: $id})
          
          // Set updated properties
          SET q += $updateProperties,
              q.updatedAt = datetime()
          
          // Remove existing TAGGED relationships
          WITH q
          OPTIONAL MATCH (q)-[r:TAGGED]->()
          DELETE r
          
          // Remove existing SHARED_TAG relationships
          WITH q
          OPTIONAL MATCH (q)-[st:SHARED_TAG]->()
          DELETE st
          
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
          MATCH (o:QuantityNode)-[t:TAGGED]->(w)
          WHERE o.id <> q.id
          
          // Create new SHARED_TAG relationships
          MERGE (q)-[st:SHARED_TAG {word: w.word}]->(o)
          ON CREATE SET st.strength = keyword.frequency * t.frequency
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
          
          RETURN q
          `,
          {
            id,
            updateProperties: {
              question: updateData.question,
              unitCategoryId: updateData.unitCategoryId,
              defaultUnitId: updateData.defaultUnitId,
              publicCredit: updateData.publicCredit,
              updatedAt: new Date().toISOString(),
            },
            keywords: updateData.keywords,
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
   * Submit a response to a quantity node
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

      // First, get all normalized responses
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

  /**
   * Set visibility status for a quantity node
   */
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

  /**
   * Get visibility status for a quantity node
   */
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
   * Helper method to convert Neo4j integer values to JavaScript numbers
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    // Handle Neo4j integer objects
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
