// src/neo4j/schemas/statement.schema.ts - CONVERTED TO BaseNodeSchema

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema, VoteResult } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base-node.schema';
import { VotingUtils } from '../../config/voting.config';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { Record } from 'neo4j-driver';

// Statement-specific data interface extending BaseNodeData
export interface StatementData extends BaseNodeData {
  createdBy: string;
  publicCredit: boolean;
  statement: string;
  discussionId?: string;
  visibilityStatus?: boolean;
  keywords?: KeywordWithFrequency[];
  categories?: any[];
  relatedStatements?: any[];
  // Both inclusion and content voting supported
}

@Injectable()
export class StatementSchema extends BaseNodeSchema<StatementData> {
  protected readonly nodeLabel = 'StatementNode';
  protected readonly idField = 'id'; // Statements use standard 'id' field

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, StatementSchema.name);
  }

  // IMPLEMENT: Abstract methods from BaseNodeSchema

  protected supportsContentVoting(): boolean {
    return true; // Statements support both inclusion and content voting
  }

  protected mapNodeFromRecord(record: Record): StatementData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      statement: props.statement,
      discussionId: props.discussionId,
      visibilityStatus: props.visibilityStatus,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      // Both inclusion and content voting
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      contentPositiveVotes: this.toNumber(props.contentPositiveVotes),
      contentNegativeVotes: this.toNumber(props.contentNegativeVotes),
      contentNetVotes: this.toNumber(props.contentNetVotes),
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<StatementData>) {
    const setClause = Object.keys(data)
      .filter(
        (key) => key !== 'id' && key !== 'keywords' && key !== 'categoryIds',
      ) // Exclude complex fields
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:StatementNode {id: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: data },
    };
  }

  // BUSINESS LOGIC OVERRIDE: Content voting with inclusion threshold validation
  async voteContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    this.validateId(id);
    this.validateUserId(userId);

    // Check if statement has passed inclusion threshold before allowing content voting
    const statement = await this.findById(id); // Use inherited method
    if (
      !statement ||
      !VotingUtils.hasPassedInclusion(statement.inclusionNetVotes)
    ) {
      throw new BadRequestException(
        'Statement must pass inclusion threshold before content voting is allowed',
      );
    }

    // Call parent implementation
    return super.voteContent(id, userId, isPositive);
  }

  // STATEMENT-SPECIFIC METHODS - Keep all unique functionality

  async createStatement(statementData: {
    id: string;
    createdBy: string;
    publicCredit: boolean;
    statement: string;
    keywords: KeywordWithFrequency[];
    categoryIds?: string[];
    initialComment: string;
    parentStatementId?: string; // For statement-to-statement relationships
  }) {
    try {
      if (!statementData.statement || statementData.statement.trim() === '') {
        throw new BadRequestException('Statement text cannot be empty');
      }

      // Validate category count (0-3)
      if (statementData.categoryIds && statementData.categoryIds.length > 3) {
        throw new BadRequestException(
          'Statement can have maximum 3 categories',
        );
      }

      this.logger.log(`Creating statement with ID: ${statementData.id}`);
      this.logger.debug(`Statement data: ${JSON.stringify(statementData)}`);

      // Build the base query
      let query = `
        // Create the statement node (both inclusion and content voting)
        CREATE (s:StatementNode {
          id: $id,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          statement: $statement,
          initialComment: $initialComment,
          createdAt: datetime(),
          updatedAt: datetime(),
          // Both inclusion and content voting
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0
        })
      `;

      // Handle parent statement relationship if provided (statement-to-statement)
      if (statementData.parentStatementId) {
        query += `
        WITH s
        MATCH (parent:StatementNode {id: $parentStatementId})
        CREATE (s)-[:RELATED_TO]->(parent)
        `;
      }

      // Add category validation and relationships if provided
      if (statementData.categoryIds && statementData.categoryIds.length > 0) {
        query += `
        // Validate categories exist and have passed inclusion threshold
        WITH s, $categoryIds as categoryIds
        UNWIND categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0 // Must have passed inclusion
        
        // Create CATEGORIZED_AS relationships
        CREATE (s)-[:CATEGORIZED_AS]->(cat)
        
        WITH s, collect(cat) as validCategories, categoryIds
        WHERE size(validCategories) = size(categoryIds)
        `;
      }

      // Handle keywords if provided
      if (statementData.keywords && statementData.keywords.length > 0) {
        query += `
        // Process keywords
        WITH s
        UNWIND $keywords as keyword
        
        // Find word node for each keyword (must exist and have passed inclusion)
        MATCH (w:WordNode {word: keyword.word})
        WHERE w.inclusionNetVotes > 0
        
        // Create TAGGED relationship
        CREATE (s)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source
        }]->(w)
        
        // Connect to other statements that share this keyword
        WITH s, w, keyword
        OPTIONAL MATCH (o:StatementNode)-[t:TAGGED]->(w)
        WHERE o.id <> s.id
        
        // Create SHARED_TAG relationships
        FOREACH (dummy IN CASE WHEN o IS NOT NULL THEN [1] ELSE [] END |
          MERGE (s)-[st:SHARED_TAG {word: w.word}]->(o)
          ON CREATE SET st.strength = keyword.frequency * t.frequency
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
        )
        `;
      }

      query += ` RETURN s`;

      const params: any = {
        id: statementData.id,
        createdBy: statementData.createdBy,
        publicCredit: statementData.publicCredit,
        statement: statementData.statement,
        initialComment: statementData.initialComment || '',
      };

      if (statementData.parentStatementId) {
        params.parentStatementId = statementData.parentStatementId;
      }

      if (statementData.categoryIds && statementData.categoryIds.length > 0) {
        params.categoryIds = statementData.categoryIds;
      }

      if (statementData.keywords && statementData.keywords.length > 0) {
        params.keywords = statementData.keywords;
      }

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Failed to create statement - some dependencies may not exist or have not passed inclusion threshold',
        );
      }

      const createdStatement = result.records[0].get('s').properties;
      this.logger.log(
        `Successfully created statement with ID: ${createdStatement.id}`,
      );

      if (statementData.parentStatementId) {
        this.logger.log(
          `Successfully linked statement ${createdStatement.id} to parent statement ${statementData.parentStatementId}`,
        );
      }

      this.logger.debug(
        `Created statement: ${JSON.stringify(createdStatement)}`,
      );

      return createdStatement;
    } catch (error) {
      this.logger.error(
        `Error creating statement: ${error.message}`,
        error.stack,
      );

      // Handle specific error cases
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle the case where dependencies don't exist
      if (
        error.message &&
        error.message.includes('some dependencies may not exist')
      ) {
        throw new BadRequestException(
          `Some categories, keywords, or parent statement don't exist or haven't passed inclusion threshold.`,
        );
      }

      throw this.standardError('create statement', error);
    }
  }

  async getStatement(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.debug(`Retrieving statement with ID: ${id}`);

      const result = await this.neo4jService.read(
        `
        MATCH (s:StatementNode {id: $id})
        
        // Get keywords
        OPTIONAL MATCH (s)-[tagged:TAGGED]->(keyword:WordNode)
        
        // Get categories
        OPTIONAL MATCH (s)-[:CATEGORIZED_AS]->(category:CategoryNode)
        WHERE category.inclusionNetVotes > 0
        
        // Get related statements via shared keywords
        OPTIONAL MATCH (s)-[shared:SHARED_TAG]->(related:StatementNode)
        WHERE related.inclusionNetVotes >= 0 // Only include statements that haven't been heavily downvoted
        
        // Get directly related statements
        OPTIONAL MATCH (s)-[:RELATED_TO]-(direct:StatementNode)
        WHERE direct.inclusionNetVotes >= 0
        
        RETURN s,
        collect(DISTINCT {
          word: keyword.word,
          frequency: tagged.frequency,
          source: tagged.source
        }) as keywords,
        collect(DISTINCT {
          id: category.id,
          name: category.name,
          description: category.description
        }) as categories,
        collect(DISTINCT {
          nodeId: related.id,
          statement: related.statement,
          sharedWord: shared.word,
          strength: shared.strength,
          inclusionNetVotes: related.inclusionNetVotes,
          contentNetVotes: related.contentNetVotes
        }) as relatedStatements,
        collect(DISTINCT {
          nodeId: direct.id,
          statement: direct.statement,
          inclusionNetVotes: direct.inclusionNetVotes,
          contentNetVotes: direct.contentNetVotes
        }) as directlyRelatedStatements
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const statement = record.get('s').properties;

      // Convert Neo4j integers to JavaScript numbers
      [
        'inclusionPositiveVotes',
        'inclusionNegativeVotes',
        'inclusionNetVotes',
        'contentPositiveVotes',
        'contentNegativeVotes',
        'contentNetVotes',
      ].forEach((prop) => {
        if (statement[prop] !== undefined) {
          statement[prop] = this.toNumber(statement[prop]);
        }
      });

      // Add additional data
      statement.keywords = (record.get('keywords') || []).filter(
        (kw) => kw && kw.word,
      );
      statement.categories = (record.get('categories') || []).filter(
        (cat) => cat && cat.id,
      );
      statement.relatedStatements = record.get('relatedStatements') || [];
      statement.directlyRelatedStatements =
        record.get('directlyRelatedStatements') || [];

      this.logger.debug(`Retrieved statement: ${JSON.stringify(statement)}`);
      return statement;
    } catch (error) {
      this.logger.error(
        `Error getting statement ${id}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('retrieve statement', error);
    }
  }

  async updateStatement(
    id: string,
    updateData: {
      statement?: string;
      publicCredit?: boolean;
      discussionId?: string;
      keywords?: KeywordWithFrequency[];
      categoryIds?: string[];
    },
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.log(`Updating statement with ID: ${id}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateData)}`);

      // Check if we need complex update (keywords or categories)
      if (
        (updateData.keywords && updateData.keywords.length > 0) ||
        (updateData.categoryIds && updateData.categoryIds.length > 0)
      ) {
        // Complex update with relationship management
        let query = `
        MATCH (s:StatementNode {id: $id})
        SET s += $updateProperties, s.updatedAt = datetime()
        `;

        // Handle category updates
        if (updateData.categoryIds && updateData.categoryIds.length > 0) {
          // Validate category count (0-3)
          if (updateData.categoryIds.length > 3) {
            throw new BadRequestException(
              'Statement can have maximum 3 categories',
            );
          }

          query += `
          // Remove existing category relationships
          WITH s
          OPTIONAL MATCH (s)-[catRel:CATEGORIZED_AS]->()
          DELETE catRel
          
          // Validate new categories exist and have passed inclusion threshold
          WITH s, $categoryIds as categoryIds
          UNWIND categoryIds as categoryId
          MATCH (cat:CategoryNode {id: categoryId})
          WHERE cat.inclusionNetVotes > 0
          
          // Create new CATEGORIZED_AS relationships
          CREATE (s)-[:CATEGORIZED_AS]->(cat)
          
          WITH s, collect(cat) as validCategories, categoryIds
          WHERE size(validCategories) = size(categoryIds) OR size(categoryIds) = 0
          `;
        }

        // Handle keyword updates
        if (updateData.keywords && updateData.keywords.length > 0) {
          query += `
          // Remove existing TAGGED and SHARED_TAG relationships
          WITH s
          OPTIONAL MATCH (s)-[tagRel:TAGGED]->()
          OPTIONAL MATCH (s)-[sharedRel:SHARED_TAG]->()
          DELETE tagRel, sharedRel
          
          // Process updated keywords
          WITH s
          UNWIND $keywords as keyword
          
          // Find word node for each keyword
          MATCH (w:WordNode {word: keyword.word})
          
          // Create new TAGGED relationship
          CREATE (s)-[:TAGGED {
            frequency: keyword.frequency,
            source: keyword.source
          }]->(w)
          
          // Reconnect to other statements that share this keyword
          WITH s, w, keyword
          OPTIONAL MATCH (o:StatementNode)-[t:TAGGED]->(w)
          WHERE o.id <> s.id
          
          // Create new SHARED_TAG relationships
          FOREACH (dummy IN CASE WHEN o IS NOT NULL THEN [1] ELSE [] END |
            MERGE (s)-[st:SHARED_TAG {word: w.word}]->(o)
            ON CREATE SET st.strength = keyword.frequency * t.frequency
            ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
          )
          `;
        }

        query += ` RETURN s`;

        const result = await this.neo4jService.write(query, {
          id,
          updateProperties: {
            statement: updateData.statement,
            publicCredit: updateData.publicCredit,
            discussionId: updateData.discussionId,
          },
          categoryIds: updateData.categoryIds || [],
          keywords: updateData.keywords || [],
        });

        if (!result.records || result.records.length === 0) {
          throw new NotFoundException(`Statement with ID ${id} not found`);
        }

        const updatedStatement = result.records[0].get('s').properties;
        this.logger.log(`Successfully updated statement with ID: ${id}`);
        this.logger.debug(
          `Updated statement: ${JSON.stringify(updatedStatement)}`,
        );

        return updatedStatement;
      } else {
        // Simple update without relationship changes - use inherited method
        const result = await this.update(id, updateData);
        if (!result) {
          throw new NotFoundException(`Statement with ID ${id} not found`);
        }
        return result;
      }
    } catch (error) {
      this.logger.error(
        `Error updating statement ${id}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Check if error is already standardized
      if (error.message && error.message.startsWith('Failed to update')) {
        throw error; // Already standardized, don't wrap again
      }

      throw this.standardError('update statement', error);
    }
  }

  async deleteStatement(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.log(`Deleting statement with ID: ${id}`);

      // First check if the statement exists using inherited method
      const statement = await this.findById(id);
      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      // Delete statement and all related nodes (discussion, comments)
      await this.neo4jService.write(
        `
        MATCH (s:StatementNode {id: $id})
        // Get associated discussion and comments to delete as well
        OPTIONAL MATCH (s)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        OPTIONAL MATCH (d)-[:HAS_COMMENT]->(c:CommentNode)
        // Delete everything
        DETACH DELETE s, d, c
        `,
        { id },
      );

      this.logger.log(`Successfully deleted statement with ID: ${id}`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error deleting statement ${id}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('delete statement', error);
    }
  }

  // VISIBILITY MANAGEMENT METHODS

  async setVisibilityStatus(id: string, visibilityStatus: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.log(
        `Setting visibility status for statement ${id} to ${visibilityStatus}`,
      );

      const result = await this.neo4jService.write(
        `
        MATCH (s:StatementNode {id: $id})
        SET s.visibilityStatus = $visibilityStatus, s.updatedAt = datetime()
        RETURN s
        `,
        { id, visibilityStatus },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      const updatedStatement = result.records[0].get('s').properties;
      this.logger.log(
        `Successfully updated visibility status for statement ${id}`,
      );

      return updatedStatement;
    } catch (error) {
      this.logger.error(
        `Error setting visibility status for statement ${id}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('set visibility status for statement', error);
    }
  }

  async getVisibilityStatus(id: string): Promise<boolean> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.debug(`Getting visibility status for statement ${id}`);

      const result = await this.neo4jService.read(
        `
        MATCH (s:StatementNode {id: $id})
        RETURN s.visibilityStatus as visibilityStatus
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      const visibilityStatus = result.records[0].get('visibilityStatus');
      // Only default to true if the value is null/undefined, not if it's explicitly false
      const finalStatus =
        visibilityStatus !== null && visibilityStatus !== undefined
          ? visibilityStatus
          : true;
      this.logger.debug(
        `Visibility status for statement ${id}: ${finalStatus}`,
      );

      return finalStatus;
    } catch (error) {
      this.logger.error(
        `Error getting visibility status for statement ${id}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('get visibility status for statement', error);
    }
  }

  // RELATIONSHIP MANAGEMENT METHODS

  /**
   * Creates a direct, undirected relationship between two statements
   */
  async createDirectRelationship(
    statementId1: string,
    statementId2: string,
  ): Promise<{ success: boolean }> {
    if (statementId1 === statementId2) {
      throw new Error(
        'Cannot create a relationship between a statement and itself',
      );
    }

    try {
      await this.neo4jService.write(
        `
        MATCH (s1:StatementNode {id: $statementId1})
        MATCH (s2:StatementNode {id: $statementId2})
        
        // Create relationship in one direction
        MERGE (s1)-[r:RELATED_TO]->(s2)
        
        // Set properties if needed (could add created date, strength, etc.)
        ON CREATE SET r.createdAt = datetime()
        `,
        { statementId1, statementId2 },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Error creating direct relationship: ${error.message}`);
      throw error;
    }
  }

  /**
   * Removes a direct relationship between two statements
   */
  async removeDirectRelationship(
    statementId1: string,
    statementId2: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.neo4jService.write(
        `
        MATCH (s1:StatementNode {id: $statementId1})-[r:RELATED_TO]-(s2:StatementNode {id: $statementId2})
        DELETE r
        `,
        { statementId1, statementId2 },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Error removing direct relationship: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets all statements directly related to the given statement
   */
  async getDirectlyRelatedStatements(statementId: string) {
    if (!statementId || statementId.trim() === '') {
      throw new BadRequestException('Statement ID cannot be empty');
    }

    try {
      this.logger.debug(
        `Getting statements directly related to ${statementId}`,
      );

      const result = await this.neo4jService.read(
        `
        MATCH (s:StatementNode {id: $statementId})-[:RELATED_TO]-(related:StatementNode)
        RETURN related
        ORDER BY related.inclusionNetVotes DESC, related.contentNetVotes DESC
        `,
        { statementId },
      );

      return result.records.map((record) => record.get('related').properties);
    } catch (error) {
      this.logger.error(
        `Error getting directly related statements: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get directly related statements', error);
    }
  }

  // NETWORK AND DISCOVERY METHODS

  async getStatementNetwork(
    limit: number = 20,
    offset: number = 0,
    keywords?: string[],
    categories?: string[],
    userId?: string,
  ) {
    try {
      this.logger.debug(
        `Getting statement network with limit: ${limit}, offset: ${offset}`,
      );

      // Build dynamic query based on filters
      let whereClause = 'WHERE s.inclusionNetVotes >= -5'; // Hide heavily downvoted statements
      const params: any = { limit, offset };

      if (keywords && keywords.length > 0) {
        whereClause += ` AND EXISTS {
          MATCH (s)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
        }`;
        params.keywords = keywords;
      }

      if (categories && categories.length > 0) {
        whereClause += ` AND EXISTS {
          MATCH (s)-[:CATEGORIZED_AS]->(c:CategoryNode)
          WHERE c.id IN $categories
        }`;
        params.categories = categories;
      }

      if (userId) {
        whereClause += ` AND s.createdBy = $userId`;
        params.userId = userId;
      }

      const query = `
        MATCH (s:StatementNode)
        ${whereClause}
        
        // Get related statements via shared keywords
        OPTIONAL MATCH (s)-[shared:SHARED_TAG]->(related:StatementNode)
        WHERE related.inclusionNetVotes >= -5
        
        // Get directly related statements
        OPTIONAL MATCH (s)-[:RELATED_TO]-(direct:StatementNode)
        WHERE direct.inclusionNetVotes >= -5
        
        // Get keywords
        OPTIONAL MATCH (s)-[tagged:TAGGED]->(keyword:WordNode)
        
        // Get categories
        OPTIONAL MATCH (s)-[:CATEGORIZED_AS]->(category:CategoryNode)
        
        RETURN s {
          .*,
          keywords: collect(DISTINCT {
            word: keyword.word,
            frequency: tagged.frequency,
            source: tagged.source
          }),
          categories: collect(DISTINCT {
            id: category.id,
            name: category.name
          }),
          relatedStatements: collect(DISTINCT {
            nodeId: related.id,
            statement: related.statement,
            sharedWord: shared.word,
            strength: shared.strength
          }),
          directlyRelatedStatements: CASE 
            WHEN direct IS NOT NULL THEN 
              collect(DISTINCT {
                nodeId: direct.id,
                statement: direct.statement
              })
            ELSE []
          END
        } as statement
        
        ORDER BY s.inclusionNetVotes DESC, s.contentNetVotes DESC, s.createdAt DESC
        SKIP $offset
        LIMIT $limit
      `;

      // Execute the query
      const result = await this.neo4jService.read(query, params);

      this.logger.debug(`Retrieved ${result.records.length} statements`);

      // Process the results to include both relationship types
      const statements = result.records.map((record) => {
        const statement = record.get('statement');

        // Merge the two relationship types for frontend convenience
        if (
          statement.directlyRelatedStatements &&
          statement.directlyRelatedStatements.length > 0
        ) {
          if (!statement.relatedStatements) statement.relatedStatements = [];

          // Add any direct relationships not already in relatedStatements
          statement.directlyRelatedStatements.forEach((direct) => {
            const exists = statement.relatedStatements.some(
              (rel) => rel.nodeId === direct.nodeId,
            );
            if (!exists) {
              statement.relatedStatements.push({
                ...direct,
                sharedWord: 'direct',
                strength: 1.0, // Direct relationships have maximum strength
              });
            }
          });
        }

        // Remove the redundant property to clean up the response
        delete statement.directlyRelatedStatements;

        return statement;
      });

      // Convert Neo4j integers to JavaScript numbers for consistency
      statements.forEach((statement) => {
        // Ensure numeric conversions for both inclusion and content vote properties
        [
          'inclusionPositiveVotes',
          'inclusionNegativeVotes',
          'inclusionNetVotes',
          'contentPositiveVotes',
          'contentNegativeVotes',
          'contentNetVotes',
        ].forEach((prop) => {
          if (statement[prop] !== undefined) {
            statement[prop] = this.toNumber(statement[prop]);
          }
        });
      });

      return statements;
    } catch (error) {
      this.logger.error(
        `Error getting statement network: ${error.message}`,
        error.stack,
      );
      throw this.standardError('retrieve statement network', error);
    }
  }

  // UTILITY METHODS

  async checkStatements(): Promise<{ count: number }> {
    try {
      const result = await this.neo4jService.read(
        'MATCH (s:StatementNode) RETURN count(s) as count',
        {},
      );

      const count = this.toNumber(result.records[0].get('count'));
      this.logger.debug(`Total statements count: ${count}`);

      return { count };
    } catch (error) {
      this.logger.error(
        `Error checking statements: ${error.message}`,
        error.stack,
      );
      throw this.standardError('check statements', error);
    }
  }

  // ✅ INHERITED FROM BaseNodeSchema (No need to implement):
  // - findById() -> replaces basic getStatement() functionality
  // - update() -> replaces basic updateStatement() functionality (for simple updates)
  // - delete() -> replaces basic deleteStatement() functionality
  // - voteInclusion() -> replaces voteStatementInclusion()
  // - voteContent() -> replaces voteStatementContent() (with business logic override above)
  // - getVoteStatus() -> replaces getStatementVoteStatus()
  // - removeVote() -> replaces removeStatementVote()
  // - getVotes() -> replaces getStatementVotes()
  // - Standard validation, error handling, Neo4j utilities

  // ❌ REMOVED METHODS (replaced by inherited BaseNodeSchema methods):
  // - voteStatementInclusion() -> use voteInclusion()
  // - voteStatementContent() -> use voteContent()
  // - getStatementVoteStatus() -> use getVoteStatus()
  // - removeStatementVote() -> use removeVote()
  // - getStatementVotes() -> use getVotes()
  // - Basic updateStatement() -> use update() for simple updates
  // - Basic deleteStatement() -> use delete() for basic deletion

  // ✅ ENHANCED METHODS PRESERVED:
  // - createStatement(): Complex creation with keywords, categories, relationships
  // - getStatement(): Enhanced retrieval with relationships, categories, keywords
  // - updateStatement(): Complex updates with keyword/category relationship management
  // - setVisibilityStatus() / getVisibilityStatus(): Statement visibility management
  // - createDirectRelationship() / removeDirectRelationship(): Direct statement linking
  // - getDirectlyRelatedStatements(): Direct relationship queries
  // - getStatementNetwork(): Complex discovery with shared keywords + direct relationships
  // - checkStatements(): Utility method for statement counting
}
