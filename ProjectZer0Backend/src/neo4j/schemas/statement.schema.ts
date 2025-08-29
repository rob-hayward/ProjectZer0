// src/neo4j/schemas/statement.schema.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { VotingUtils } from '../../config/voting.config';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from './vote.schema';

@Injectable()
export class StatementSchema {
  private readonly logger = new Logger(StatementSchema.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly voteSchema: VoteSchema,
  ) {}

  async getStatementNetwork(options: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: string;
    keywords?: string[];
    userId?: string;
    categories?: string[];
  }): Promise<any[]> {
    try {
      const {
        limit = null,
        offset = 0,
        sortBy = 'netPositive',
        sortDirection = 'desc',
        keywords,
        userId,
        categories,
      } = options;

      this.logger.debug(
        `Getting statement network with params: ${JSON.stringify({
          limit,
          offset,
          sortBy,
          sortDirection,
          keywords,
          userId,
          categories,
        })}`,
      );

      // First, check if we have any statements in the database
      try {
        const countResult = await this.neo4jService.read(
          `MATCH (s:StatementNode) RETURN count(s) as count`,
        );
        const statementCount = countResult.records[0].get('count').toNumber();

        if (statementCount === 0) {
          this.logger.debug('No statements found in database');
          return [];
        }
      } catch (error) {
        this.logger.error(
          `Error counting statements: ${error.message}`,
          error.stack,
        );
      }

      // Build the query for fetching statement network
      let query = `
        MATCH (s:StatementNode)
        WHERE s.visibilityStatus <> false OR s.visibilityStatus IS NULL
      `;

      // Add keyword filter if specified
      if (keywords && keywords.length > 0) {
        query += `
          AND EXISTS {
            MATCH (s)-[:TAGGED]->(w:WordNode)
            WHERE w.word IN $keywords
          }
        `;
      }

      // Add category filter if specified
      if (categories && categories.length > 0) {
        query += `
          AND EXISTS {
            MATCH (s)-[:CATEGORIZED_AS]->(cat:CategoryNode)
            WHERE cat.id IN $categories
          }
        `;
      }

      // Add user filter if specified
      if (userId) {
        query += `
          AND s.createdBy = $userId
        `;
      }

      // Get all related statements and their connections
      query += `
        // Get keywords
        OPTIONAL MATCH (s)-[t:TAGGED]->(w:WordNode)
        
        // Get categories
        OPTIONAL MATCH (s)-[:CATEGORIZED_AS]->(cat:CategoryNode)
        
        // Get statements with shared keywords
        OPTIONAL MATCH (s)-[st:SHARED_TAG]->(o:StatementNode)
        WHERE o.visibilityStatus <> false OR o.visibilityStatus IS NULL
        
        // Get directly related statements
        OPTIONAL MATCH (s)-[:RELATED_TO]-(r:StatementNode)
        WHERE r.visibilityStatus <> false OR r.visibilityStatus IS NULL
        
        // Get vote counts - statements have both inclusion and content voting
        OPTIONAL MATCH (s)<-[ipv:VOTED_ON {kind: 'INCLUSION', status: 'agree'}]-()
        OPTIONAL MATCH (s)<-[inv:VOTED_ON {kind: 'INCLUSION', status: 'disagree'}]-()
        OPTIONAL MATCH (s)<-[cpv:VOTED_ON {kind: 'CONTENT', status: 'agree'}]-()
        OPTIONAL MATCH (s)<-[cnv:VOTED_ON {kind: 'CONTENT', status: 'disagree'}]-()
        
        WITH s,
             COUNT(DISTINCT ipv) as inclusionPositiveVotes,
             COUNT(DISTINCT inv) as inclusionNegativeVotes,
             COUNT(DISTINCT cpv) as contentPositiveVotes,
             COUNT(DISTINCT cnv) as contentNegativeVotes,
             collect(DISTINCT {
               word: w.word, 
               frequency: t.frequency,
               source: t.source
             }) as keywords,
             collect(DISTINCT {
               id: cat.id,
               name: cat.name,
               inclusionNetVotes: cat.inclusionNetVotes
             }) as categories,
             collect(DISTINCT {
               nodeId: o.id,
               statement: o.statement,
               sharedWord: st.word,
               strength: st.strength
             }) as relatedStatements,
             collect(DISTINCT {
               nodeId: r.id,
               statement: r.statement,
               relationshipType: 'direct'
             }) as directlyRelatedStatements
      `;

      // Add sorting based on parameter
      if (sortBy === 'netPositive') {
        query += `
          WITH s, keywords, categories, relatedStatements, directlyRelatedStatements, 
               inclusionPositiveVotes, inclusionNegativeVotes, contentPositiveVotes, contentNegativeVotes,
               (contentPositiveVotes - contentNegativeVotes) as contentNetVotes
          ORDER BY contentNetVotes ${sortDirection === 'desc' ? 'DESC' : 'ASC'}
        `;
      } else if (sortBy === 'totalVotes') {
        query += `
          WITH s, keywords, categories, relatedStatements, directlyRelatedStatements, 
               inclusionPositiveVotes, inclusionNegativeVotes, contentPositiveVotes, contentNegativeVotes,
               (inclusionPositiveVotes + inclusionNegativeVotes + contentPositiveVotes + contentNegativeVotes) as totalVotes
          ORDER BY totalVotes ${sortDirection === 'desc' ? 'DESC' : 'ASC'}
        `;
      } else if (sortBy === 'chronological') {
        query += `
          WITH s, keywords, categories, relatedStatements, directlyRelatedStatements, 
               inclusionPositiveVotes, inclusionNegativeVotes, contentPositiveVotes, contentNegativeVotes
          ORDER BY s.createdAt ${sortDirection === 'desc' ? 'DESC' : 'ASC'}
        `;
      }

      // Add pagination if specified
      if (limit !== null) {
        query += `
          SKIP $offset
          LIMIT $limit
        `;
      }

      // Return statement with all its data (both inclusion and content voting)
      query += `
        RETURN {
          id: s.id,
          statement: s.statement,
          createdBy: s.createdBy,
          publicCredit: s.publicCredit,
          initialComment: s.initialComment,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          // Both inclusion and content voting
          inclusionPositiveVotes: inclusionPositiveVotes,
          inclusionNegativeVotes: inclusionNegativeVotes,
          inclusionNetVotes: inclusionPositiveVotes - inclusionNegativeVotes,
          contentPositiveVotes: contentPositiveVotes,
          contentNegativeVotes: contentNegativeVotes,
          contentNetVotes: contentPositiveVotes - contentNegativeVotes,
          keywords: keywords,
          categories: categories,
          relatedStatements: CASE 
            WHEN size(relatedStatements) > 0 THEN relatedStatements
            ELSE []
          END,
          directlyRelatedStatements: CASE
            WHEN size(directlyRelatedStatements) > 0 THEN directlyRelatedStatements
            ELSE []
          END
        } as statement
      `;

      // Execute the query
      const result = await this.neo4jService.read(query, {
        limit,
        offset,
        keywords,
        categories,
        userId,
      });

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
      throw new Error(`Failed to retrieve statement network: ${error.message}`);
    }
  }

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
        // Process each keyword
        WITH s
        UNWIND $keywords as keyword
        
        // Find word node for each keyword (should already exist)
        MATCH (w:WordNode {word: keyword.word})
        
        // Create TAGGED relationship with frequency and source
        CREATE (s)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source
        }]->(w)
        
        // Connect to other statements that share this keyword
        WITH s, w, keyword
        OPTIONAL MATCH (o:StatementNode)-[t:TAGGED]->(w)
        WHERE o.id <> s.id
        
        // Create SHARED_TAG relationships between statements
        FOREACH (dummy IN CASE WHEN o IS NOT NULL THEN [1] ELSE [] END |
          MERGE (s)-[st:SHARED_TAG {word: w.word}]->(o)
          ON CREATE SET st.strength = keyword.frequency * t.frequency
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
        )
        `;
      }

      // Create discussion and initial comment
      query += `
        // Create CREATED relationship for user-created content
        WITH s, $createdBy as userId
        MATCH (u:User {sub: userId})
        CREATE (u)-[:CREATED {
            createdAt: datetime(),
            type: 'statement'
        }]->(s)
        
        // Create discussion node automatically
        WITH DISTINCT s
        CREATE (d:DiscussionNode {
          id: apoc.create.uuid(),
          createdAt: datetime(),
          createdBy: $createdBy,
          visibilityStatus: true
        })
        CREATE (s)-[:HAS_DISCUSSION]->(d)
        
        // Create initial comment only if provided
        WITH s, d, $initialComment as initialComment
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
        
        RETURN s
      `;

      // Prepare parameters
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

      throw new Error(`Failed to create statement: ${error.message}`);
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
        OPTIONAL MATCH (s)-[t:TAGGED]->(w:WordNode)
        
        // Get categories
        OPTIONAL MATCH (s)-[:CATEGORIZED_AS]->(cat:CategoryNode)
        
        // Get statements with shared keywords
        OPTIONAL MATCH (s)-[st:SHARED_TAG]->(o:StatementNode)
        WHERE o.visibilityStatus <> false OR o.visibilityStatus IS NULL
        
        // Get directly related statements
        OPTIONAL MATCH (s)-[:RELATED_TO]-(r:StatementNode)
        WHERE r.visibilityStatus <> false OR r.visibilityStatus IS NULL
        
        // Get discussion
        OPTIONAL MATCH (s)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        RETURN s,
               collect(DISTINCT {
                 word: w.word, 
                 frequency: t.frequency,
                 source: t.source
               }) as keywords,
               collect(DISTINCT {
                 id: cat.id,
                 name: cat.name,
                 inclusionNetVotes: cat.inclusionNetVotes
               }) as categories,
               collect(DISTINCT {
                 nodeId: o.id,
                 statement: o.statement,
                 sharedWord: st.word,
                 strength: st.strength
               }) as relatedStatements,
               collect(DISTINCT {
                 nodeId: r.id,
                 statement: r.statement,
                 relationshipType: 'direct'
               }) as directlyRelatedStatements,
               d.id as discussionId
        `,
        { id },
      );

      if (result.records.length === 0) {
        this.logger.warn(`Statement not found with ID: ${id}`);
        return null;
      }

      const statement = result.records[0].get('s').properties;
      statement.keywords = result.records[0].get('keywords');
      statement.categories = result.records[0].get('categories');
      statement.relatedStatements = result.records[0].get('relatedStatements');
      statement.directlyRelatedStatements = result.records[0].get(
        'directlyRelatedStatements',
      );
      statement.discussionId = result.records[0].get('discussionId');

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

      this.logger.debug(`Retrieved statement with ID: ${id}`);
      return statement;
    } catch (error) {
      this.logger.error(
        `Error retrieving statement ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to retrieve statement: ${error.message}`);
    }
  }

  async updateStatement(
    id: string,
    updateData: Partial<{
      statement: string;
      publicCredit: boolean;
      keywords: KeywordWithFrequency[];
      categoryIds: string[];
      discussionId: string;
    }>,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      // Validate category count if updating categories
      if (updateData.categoryIds && updateData.categoryIds.length > 3) {
        throw new BadRequestException(
          'Statement can have maximum 3 categories',
        );
      }

      this.logger.log(`Updating statement with ID: ${id}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateData)}`);

      // Complex update with keywords and/or categories
      if (
        (updateData.keywords && updateData.keywords.length > 0) ||
        updateData.categoryIds !== undefined
      ) {
        let query = `
          // Match the statement to update
          MATCH (s:StatementNode {id: $id})
          
          // Set updated properties
          SET s += $updateProperties,
              s.updatedAt = datetime()
        `;

        // Handle category updates
        if (updateData.categoryIds !== undefined) {
          query += `
          // Remove existing CATEGORIZED_AS relationships
          WITH s
          OPTIONAL MATCH (s)-[catRel:CATEGORIZED_AS]->()
          DELETE catRel
          
          // Create new category relationships if provided
          WITH s, $categoryIds as categoryIds
          WHERE size(categoryIds) > 0
          UNWIND categoryIds as categoryId
          MATCH (cat:CategoryNode {id: categoryId})
          WHERE cat.inclusionNetVotes > 0
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
        // Simple update without changing relationships
        const result = await this.neo4jService.write(
          `
          MATCH (s:StatementNode {id: $id})
          SET s += $updateProperties, s.updatedAt = datetime()
          RETURN s
          `,
          {
            id,
            updateProperties: {
              statement: updateData.statement,
              publicCredit: updateData.publicCredit,
              discussionId: updateData.discussionId,
            },
          },
        );

        if (!result.records || result.records.length === 0) {
          throw new NotFoundException(`Statement with ID ${id} not found`);
        }

        const updatedStatement = result.records[0].get('s').properties;
        this.logger.log(`Successfully updated statement with ID: ${id}`);
        this.logger.debug(
          `Updated statement: ${JSON.stringify(updatedStatement)}`,
        );

        return updatedStatement;
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

      throw new Error(`Failed to update statement: ${error.message}`);
    }
  }

  async deleteStatement(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.log(`Deleting statement with ID: ${id}`);

      // First check if the statement exists
      const checkResult = await this.neo4jService.read(
        `MATCH (s:StatementNode {id: $id}) RETURN s`,
        { id },
      );

      if (!checkResult.records || checkResult.records.length === 0) {
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
      return {
        success: true,
        message: `Statement with ID ${id} successfully deleted`,
      };
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

      throw new Error(`Failed to delete statement: ${error.message}`);
    }
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.log(`Setting visibility for statement ${id}: ${isVisible}`);

      const result = await this.neo4jService.write(
        `
        MATCH (s:StatementNode {id: $id})
        SET s.visibilityStatus = $isVisible, s.updatedAt = datetime()
        RETURN s
        `,
        { id, isVisible },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      const updatedStatement = result.records[0].get('s').properties;
      this.logger.log(`Successfully updated visibility for statement ${id}`);

      return updatedStatement;
    } catch (error) {
      this.logger.error(
        `Error setting visibility for statement ${id}: ${error.message}`,
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

  async getVisibilityStatus(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.debug(`Getting visibility status for statement ${id}`);

      const result = await this.neo4jService.read(
        `
        MATCH (s:StatementNode {id: $id})
        RETURN s.visibilityStatus
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      const visibilityStatus =
        result.records[0]?.get('s.visibilityStatus') ?? true;
      this.logger.debug(
        `Visibility status for statement ${id}: ${visibilityStatus}`,
      );

      return visibilityStatus;
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

      throw new Error(`Failed to get visibility status: ${error.message}`);
    }
  }

  // Voting methods - BOTH INCLUSION AND CONTENT for Statements

  async voteStatementInclusion(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      this.logger.log(
        `Processing inclusion vote on statement ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      const result = await this.voteSchema.vote(
        'StatementNode',
        { id },
        sub,
        isPositive,
        'INCLUSION',
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error voting on statement ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to vote on statement: ${error.message}`);
    }
  }

  async voteStatementContent(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      // Check if statement has passed inclusion threshold before allowing content voting
      const statement = await this.getStatement(id);
      if (
        !statement ||
        !VotingUtils.isStatementContentVotingUnlocked(
          statement.inclusionNetVotes,
        )
      ) {
        throw new BadRequestException(
          'Statement must pass inclusion threshold before content voting is allowed',
        );
      }

      this.logger.log(
        `Processing content vote on statement ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      const result = await this.voteSchema.vote(
        'StatementNode',
        { id },
        sub,
        isPositive,
        'CONTENT',
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error voting on statement content ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to vote on statement content: ${error.message}`);
    }
  }

  async getStatementVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      this.logger.debug(
        `Getting vote status for statement ${id} by user ${sub}`,
      );

      return await this.voteSchema.getVoteStatus('StatementNode', { id }, sub);
    } catch (error) {
      this.logger.error(
        `Error getting vote status for statement ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to get statement vote status: ${error.message}`);
    }
  }

  async removeStatementVote(
    id: string,
    sub: string,
    kind: 'INCLUSION' | 'CONTENT',
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      this.logger.log(
        `Removing ${kind} vote from statement ${id} by user ${sub}`,
      );

      const result = await this.voteSchema.removeVote(
        'StatementNode',
        { id },
        sub,
        kind,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error removing vote from statement ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to remove statement vote: ${error.message}`);
    }
  }

  async getStatementVotes(id: string): Promise<VoteResult | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.debug(`Getting votes for statement ${id}`);

      const voteStatus = await this.voteSchema.getVoteStatus(
        'StatementNode',
        { id },
        '', // Empty string as we don't need user-specific status
      );

      if (!voteStatus) {
        this.logger.debug(`No votes found for statement: ${id}`);
        return null;
      }

      const votes = {
        inclusionPositiveVotes: voteStatus.inclusionPositiveVotes,
        inclusionNegativeVotes: voteStatus.inclusionNegativeVotes,
        inclusionNetVotes: voteStatus.inclusionNetVotes,
        contentPositiveVotes: voteStatus.contentPositiveVotes,
        contentNegativeVotes: voteStatus.contentNegativeVotes,
        contentNetVotes: voteStatus.contentNetVotes,
      };

      this.logger.debug(`Votes for statement ${id}: ${JSON.stringify(votes)}`);
      return votes;
    } catch (error) {
      this.logger.error(
        `Error getting votes for statement ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to get statement votes: ${error.message}`);
    }
  }

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
    try {
      if (!statementId || statementId.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.debug(
        `Getting statements directly related to ${statementId}`,
      );

      const result = await this.neo4jService.read(
        `
        MATCH (s:StatementNode {id: $statementId})-[:RELATED_TO]-(r:StatementNode)
        RETURN collect({
          id: r.id,
          statement: r.statement,
          createdBy: r.createdBy,
          createdAt: r.createdAt,
          publicCredit: r.publicCredit
        }) as relatedStatements
        `,
        { statementId },
      );

      if (!result.records || result.records.length === 0) {
        return [];
      }

      const relatedStatements = result.records[0].get('relatedStatements');
      this.logger.debug(
        `Found ${relatedStatements.length} directly related statements`,
      );

      return relatedStatements;
    } catch (error) {
      this.logger.error(
        `Error getting directly related statements: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(
        `Failed to get directly related statements: ${error.message}`,
      );
    }
  }

  /**
   * Check if content voting is available for a statement (has passed inclusion threshold)
   */
  async isContentVotingAvailable(statementId: string): Promise<boolean> {
    try {
      const statement = await this.getStatement(statementId);
      if (!statement) return false;

      return VotingUtils.isStatementContentVotingUnlocked(
        statement.inclusionNetVotes,
      );
    } catch (error) {
      this.logger.error(
        `Error checking content voting availability: ${error.message}`,
      );
      return false;
    }
  }

  async checkStatements(): Promise<{ count: number }> {
    try {
      this.logger.debug('Checking statement count');

      const result = await this.neo4jService.read(
        `MATCH (s:StatementNode) RETURN count(s) as count`,
      );

      const count = this.toNumber(result.records[0].get('count'));
      this.logger.debug(`Found ${count} statements in database`);

      return { count };
    } catch (error) {
      this.logger.error(
        `Error checking statements: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to check statements: ${error.message}`);
    }
  }

  // DISCOVERY METHODS - New functionality for finding related content

  /**
   * Get statements that share categories with the given statement
   */
  async getRelatedContentBySharedCategories(
    statementId: string,
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
        `Getting related content by shared categories for statement ${statementId}`,
      );

      let query = `
        MATCH (current:StatementNode {id: $statementId})
        MATCH (current)-[:CATEGORIZED_AS]->(sharedCat:CategoryNode)
        MATCH (related)-[:CATEGORIZED_AS]->(sharedCat)
        WHERE (related.visibilityStatus <> false OR related.visibilityStatus IS NULL)
      `;

      // Exclude self if requested
      if (excludeSelf) {
        query += ` AND related.id <> $statementId`;
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
        statementId,
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
   * Get all categories associated with this statement
   */
  async getNodeCategories(statementId: string): Promise<any[]> {
    try {
      this.logger.debug(`Getting categories for statement ${statementId}`);

      const result = await this.neo4jService.read(
        `
        MATCH (s:StatementNode {id: $statementId})
        MATCH (s)-[:CATEGORIZED_AS]->(c:CategoryNode)
        
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
        { statementId },
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
        `Retrieved ${categories.length} categories for statement ${statementId}`,
      );
      return categories;
    } catch (error) {
      this.logger.error(
        `Error getting statement categories: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get statement categories: ${error.message}`);
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
