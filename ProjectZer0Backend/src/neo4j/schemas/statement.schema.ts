// src/neo4j/schemas/statement.schema.ts - REFACTORED

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
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { VotingUtils } from '../../config/voting.config';
import { Record } from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';

/**
 * StatementNode data interface
 * Declarative statements made by users
 */
export interface StatementData extends CategorizedNodeData {
  statement: string; // The statement text
  parentStatementId?: string; // Optional parent statement for threading
  directlyRelatedStatements?: any[]; // Statements connected via RELATED_TO
  // Inherited from CategorizedNodeData:
  // - categories (up to 3)
  // Inherited from TaggedNodeData through CategorizedNodeData:
  // - keywords (tagged with relevant words)
  // - relatedNodes (statements with similar tags/categories)
  // Inherited from BaseNodeData:
  // - All voting fields (both inclusion and content)
  // - discussionId, createdBy, publicCredit, etc.
}

/**
 * Schema for StatementNode - declarative statements in the system.
 *
 * Inheritance hierarchy:
 * BaseNodeSchema -> TaggedNodeSchema -> CategorizedNodeSchema -> StatementSchema
 *
 * Key characteristics:
 * - Uses standard 'id' field
 * - Both inclusion and content voting (dual voting)
 * - Has discussions (via injected DiscussionSchema)
 * - IS taggable (multiple keywords from the statement)
 * - IS categorizable (up to 3 categories)
 * - Can have parent statements (RELATED_TO relationships)
 * - Content voting only after inclusion threshold passed
 */
@Injectable()
export class StatementSchema extends CategorizedNodeSchema<StatementData> {
  protected readonly nodeLabel = 'StatementNode';
  protected readonly idField = 'id'; // Standard ID field
  protected readonly maxCategories = 3; // Statements can have up to 3 categories

  constructor(
    neo4jService: Neo4jService,
    voteSchema: VoteSchema,
    private readonly discussionSchema: DiscussionSchema,
    private readonly userSchema: UserSchema,
  ) {
    super(neo4jService, voteSchema, StatementSchema.name);
  }

  // ============================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================

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
      parentStatementId: props.parentStatementId,
      discussionId: props.discussionId,
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
    // Filter out complex fields that need special handling
    const setClause = Object.keys(data)
      .filter(
        (key) =>
          key !== 'id' &&
          key !== 'keywords' &&
          key !== 'categories' &&
          key !== 'categoryIds' &&
          key !== 'directlyRelatedStatements' &&
          key !== 'parentStatementId', // Don't allow changing parent
      )
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

  // ============================================
  // OVERRIDE VOTING METHODS WITH BUSINESS LOGIC
  // ============================================

  /**
   * Content voting with business logic validation.
   * Statements must pass inclusion threshold before content voting is allowed.
   */
  async voteContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<any> {
    this.validateId(id);
    this.validateUserId(userId);

    // Check if statement has passed inclusion threshold
    const statement = await this.findById(id);
    if (
      !statement ||
      !VotingUtils.hasPassedInclusion(statement.inclusionNetVotes || 0)
    ) {
      throw new BadRequestException(
        'Statement must pass inclusion threshold before content voting is allowed',
      );
    }

    // Call parent implementation
    return super.voteContent(id, userId, isPositive);
  }

  // ============================================
  // STATEMENT-SPECIFIC METHODS
  // ============================================

  /**
   * Creates a new statement with keywords and categories
   */
  async createStatement(statementData: {
    id?: string;
    createdBy: string;
    publicCredit: boolean;
    statement: string;
    keywords?: KeywordWithFrequency[];
    categoryIds?: string[];
    initialComment?: string;
    parentStatementId?: string;
  }): Promise<StatementData> {
    // Validate inputs
    if (!statementData.statement || statementData.statement.trim() === '') {
      throw new BadRequestException('Statement text cannot be empty');
    }

    if (
      statementData.categoryIds &&
      statementData.categoryIds.length > this.maxCategories
    ) {
      throw new BadRequestException(
        `Statement can have maximum ${this.maxCategories} categories`,
      );
    }

    const statementId = statementData.id || uuidv4();

    this.logger.log(`Creating statement with ID: ${statementId}`);

    try {
      let query = `
        CREATE (s:StatementNode {
          id: $id,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          statement: $statement,
          parentStatementId: $parentStatementId,
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

      const params: any = {
        id: statementId,
        createdBy: statementData.createdBy,
        publicCredit: statementData.publicCredit,
        statement: statementData.statement.trim(),
        parentStatementId: statementData.parentStatementId || null,
      };

      // Add parent relationship if provided
      if (statementData.parentStatementId) {
        query += `
        WITH s
        MATCH (parent:StatementNode {id: $parentStatementId})
        WHERE parent.inclusionNetVotes > 0
        CREATE (s)-[:RELATED_TO {
          createdAt: datetime(),
          relationshipType: 'child'
        }]->(parent)
        `;
      }

      // Add categories if provided
      if (statementData.categoryIds && statementData.categoryIds.length > 0) {
        query += `
        WITH s
        UNWIND $categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0
        CREATE (s)-[:CATEGORIZED_AS {
          createdAt: datetime()
        }]->(cat)
        
        // Create SHARED_CATEGORY relationships for discovery
        WITH s, cat
        OPTIONAL MATCH (other:StatementNode)-[:CATEGORIZED_AS]->(cat)
        WHERE other.id <> s.id AND other.inclusionNetVotes > 0
        FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (s)-[sc:SHARED_CATEGORY {categoryId: cat.id}]->(other)
          ON CREATE SET sc.strength = 1,
                        sc.categoryName = cat.name,
                        sc.createdAt = datetime()
          ON MATCH SET sc.strength = sc.strength + 1,
                       sc.updatedAt = datetime()
        )
        `;
        params.categoryIds = statementData.categoryIds;
      }

      // Add keywords if provided
      if (statementData.keywords && statementData.keywords.length > 0) {
        query += `
        WITH s
        UNWIND $keywords as keyword
        MATCH (w:WordNode {word: keyword.word})
        WHERE w.inclusionNetVotes > 0
        CREATE (s)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source,
          createdAt: datetime()
        }]->(w)
        
        // Create SHARED_TAG relationships for discovery
        WITH s, w, keyword
        OPTIONAL MATCH (other:StatementNode)-[t:TAGGED]->(w)
        WHERE other.id <> s.id
        FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (s)-[st:SHARED_TAG {word: w.word}]->(other)
          ON CREATE SET st.strength = keyword.frequency * t.frequency,
                        st.createdAt = datetime()
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency),
                       st.updatedAt = datetime()
        )
        `;
        params.keywords = statementData.keywords;
      }

      // Create user relationship
      query += `
        WITH s
        MATCH (u:User {sub: $createdBy})
        CREATE (u)-[:CREATED {
          createdAt: datetime(),
          nodeType: 'statement'
        }]->(s)
        
        RETURN s as n
      `;

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error('Failed to create statement');
      }

      const createdStatement = this.mapNodeFromRecord(result.records[0]);

      // Create discussion using the centralized DiscussionSchema
      const discussionResult =
        await this.discussionSchema.createDiscussionForNode({
          nodeId: statementId,
          nodeType: this.nodeLabel,
          nodeIdField: 'id',
          createdBy: statementData.createdBy,
          initialComment: statementData.initialComment,
        });

      createdStatement.discussionId = discussionResult.discussionId;

      // Track user participation
      try {
        await this.userSchema.addCreatedNode(
          statementData.createdBy,
          statementId,
          'statement',
        );
      } catch (error) {
        this.logger.warn(
          `Could not track user creation for statement ${statementId}: ${error.message}`,
        );
      }

      this.logger.log(
        `Successfully created statement with ID: ${createdStatement.id}`,
      );
      return createdStatement;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.message?.includes('parent')) {
        throw new BadRequestException(
          'Parent statement must exist and have passed inclusion threshold',
        );
      }

      if (error.message?.includes('not found')) {
        throw new BadRequestException(
          "Some categories or keywords don't exist or haven't passed inclusion threshold",
        );
      }

      this.logger.error(
        `Error creating statement: ${error.message}`,
        error.stack,
      );
      throw this.standardError('create statement', error);
    }
  }

  /**
   * Gets a statement with all its relationships
   */
  async getStatement(id: string): Promise<StatementData | null> {
    this.validateId(id);

    this.logger.debug(`Retrieving statement with ID: ${id}`);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (s:StatementNode {id: $id})
        
        // Get discussion
        OPTIONAL MATCH (s)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        
        // Get keywords
        OPTIONAL MATCH (s)-[t:TAGGED]->(w:WordNode)
        
        // Get categories
        OPTIONAL MATCH (s)-[:CATEGORIZED_AS]->(cat:CategoryNode)
        WHERE cat.inclusionNetVotes > 0
        
        // Get related statements through tags
        OPTIONAL MATCH (s)-[shared:SHARED_TAG]->(related:StatementNode)
        WHERE related.inclusionNetVotes >= -5
        
        // Get directly related statements
        OPTIONAL MATCH (s)-[:RELATED_TO]-(direct:StatementNode)
        WHERE direct.inclusionNetVotes >= -5
        
        RETURN s as n, 
               disc.id as discussionId,
               collect(DISTINCT {
                 word: w.word,
                 frequency: t.frequency,
                 source: t.source
               }) as keywords,
               collect(DISTINCT {
                 id: cat.id,
                 name: cat.name,
                 description: cat.description
               }) as categories,
               collect(DISTINCT {
                 id: related.id,
                 statement: related.statement,
                 sharedWord: shared.word,
                 strength: shared.strength,
                 inclusionNetVotes: related.inclusionNetVotes,
                 contentNetVotes: related.contentNetVotes
               }) as relatedStatements,
               collect(DISTINCT {
                 id: direct.id,
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
      const statement = this.mapNodeFromRecord(record);

      // Add related data
      statement.discussionId = record.get('discussionId');

      const keywords = record
        .get('keywords')
        .filter((k: any) => k.word !== null);
      const categories = record
        .get('categories')
        .filter((c: any) => c.id !== null);
      const relatedStatements = record
        .get('relatedStatements')
        .filter((r: any) => r.id !== null);
      const directlyRelated = record
        .get('directlyRelatedStatements')
        .filter((d: any) => d.id !== null);

      if (keywords.length > 0) statement.keywords = keywords;
      if (categories.length > 0) statement.categories = categories;
      if (relatedStatements.length > 0)
        statement.relatedNodes = relatedStatements;
      if (directlyRelated.length > 0)
        statement.directlyRelatedStatements = directlyRelated;

      this.logger.debug(`Retrieved statement with ID: ${id}`);
      return statement;
    } catch (error) {
      this.logger.error(
        `Error retrieving statement ${id}: ${error.message}`,
        error.stack,
      );
      throw this.standardError('retrieve statement', error);
    }
  }

  /**
   * Updates a statement including its keywords and categories
   */
  async updateStatement(
    id: string,
    updateData: {
      statement?: string;
      publicCredit?: boolean;
      categoryIds?: string[];
      keywords?: KeywordWithFrequency[];
    },
  ): Promise<StatementData | null> {
    this.validateId(id);

    if (
      updateData.categoryIds &&
      updateData.categoryIds.length > this.maxCategories
    ) {
      throw new BadRequestException(
        `Statement can have maximum ${this.maxCategories} categories`,
      );
    }

    // If no keywords or categories to update, use base update
    if (!updateData.keywords && updateData.categoryIds === undefined) {
      return await this.update(id, updateData);
    }

    // Complex update with keywords/categories
    try {
      // Update categories if provided
      if (updateData.categoryIds !== undefined) {
        await this.updateCategories(id, updateData.categoryIds);
      }

      // Update keywords if provided
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

      // Return updated statement
      return await this.getStatement(id);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Error updating statement: ${error.message}`,
        error.stack,
      );
      throw this.standardError('update statement', error);
    }
  }

  /**
   * Creates a direct RELATED_TO relationship between two statements
   */
  async createDirectRelationship(
    statementId1: string,
    statementId2: string,
    relationshipType: string = 'related',
  ): Promise<{ success: boolean }> {
    this.validateId(statementId1, 'First statement ID');
    this.validateId(statementId2, 'Second statement ID');

    try {
      await this.neo4jService.write(
        `
        MATCH (s1:StatementNode {id: $id1})
        MATCH (s2:StatementNode {id: $id2})
        WHERE s1.inclusionNetVotes > 0 AND s2.inclusionNetVotes > 0
        CREATE (s1)-[:RELATED_TO {
          createdAt: datetime(),
          relationshipType: $relationshipType
        }]->(s2)
        `,
        { id1: statementId1, id2: statementId2, relationshipType },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error creating statement relationship: ${error.message}`,
      );
      throw this.standardError('create statement relationship', error);
    }
  }

  /**
   * Removes a direct RELATED_TO relationship between two statements
   */
  async removeDirectRelationship(
    statementId1: string,
    statementId2: string,
  ): Promise<{ success: boolean }> {
    this.validateId(statementId1, 'First statement ID');
    this.validateId(statementId2, 'Second statement ID');

    try {
      await this.neo4jService.write(
        `
        MATCH (s1:StatementNode {id: $id1})-[r:RELATED_TO]-(s2:StatementNode {id: $id2})
        DELETE r
        `,
        { id1: statementId1, id2: statementId2 },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error removing statement relationship: ${error.message}`,
      );
      throw this.standardError('remove statement relationship', error);
    }
  }

  /**
   * Gets all directly related statements (via RELATED_TO)
   */
  async getDirectlyRelatedStatements(
    statementId: string,
  ): Promise<StatementData[]> {
    this.validateId(statementId);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (s:StatementNode {id: $id})-[:RELATED_TO]-(related:StatementNode)
        WHERE related.inclusionNetVotes >= -5
        RETURN related as n
        ORDER BY related.contentNetVotes DESC, related.inclusionNetVotes DESC
        `,
        { id: statementId },
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(
        `Error getting directly related statements: ${error.message}`,
      );
      throw this.standardError('get directly related statements', error);
    }
  }

  /**
   * Gets statement network for visualization
   */
  async getStatementNetwork(
    options: {
      limit?: number;
      offset?: number;
      keywords?: string[];
      categories?: string[];
      userId?: string;
    } = {},
  ): Promise<any> {
    const { limit = 50, offset = 0, keywords, categories, userId } = options;

    // Use inherited getGraphData method from CategorizedNodeSchema
    const filters = {
      limit,
      offset,
      keywords: keywords
        ? { mode: 'any' as const, values: keywords }
        : undefined,
      categories: categories
        ? { mode: 'any' as const, values: categories }
        : undefined,
      user: userId ? { mode: 'created' as const, userId } : undefined,
      minInclusionVotes: -5,
    };

    return await this.getGraphData(filters);
  }

  /**
   * Check statement statistics
   */
  async checkStatements(): Promise<{ count: number }> {
    try {
      const result = await this.neo4jService.read(
        'MATCH (s:StatementNode) RETURN count(s) as count',
      );

      const count = this.toNumber(result.records[0].get('count'));
      return { count };
    } catch (error) {
      this.logger.error(`Error checking statements: ${error.message}`);
      throw this.standardError('check statements', error);
    }
  }
}
