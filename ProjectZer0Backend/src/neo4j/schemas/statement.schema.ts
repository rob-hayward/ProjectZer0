// src/neo4j/schemas/statement.schema.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';

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
  }): Promise<any[]> {
    try {
      const {
        limit = null,
        offset = 0,
        sortBy = 'netPositive',
        sortDirection = 'desc',
        keywords,
        userId,
      } = options;

      this.logger.debug(
        `Getting statement network with params: ${JSON.stringify({
          limit,
          offset,
          sortBy,
          sortDirection,
          keywords,
          userId,
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
        
        // Get statements with shared keywords
        OPTIONAL MATCH (s)-[st:SHARED_TAG]->(o:StatementNode)
        WHERE o.visibilityStatus <> false OR o.visibilityStatus IS NULL
        
        // Get directly related statements
        OPTIONAL MATCH (s)-[:RELATED_TO]-(r:StatementNode)
        WHERE r.visibilityStatus <> false OR r.visibilityStatus IS NULL
        
        // Get vote counts - now all statements use the same consistent structure
        OPTIONAL MATCH (s)<-[pv:VOTED_ON {status: 'agree'}]-()
        OPTIONAL MATCH (s)<-[nv:VOTED_ON {status: 'disagree'}]-()
        
        WITH s,
             COUNT(DISTINCT pv) as positiveVotes,
             COUNT(DISTINCT nv) as negativeVotes,
             collect(DISTINCT {
               word: w.word, 
               frequency: t.frequency,
               source: t.source
             }) as keywords,
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

      // Add sorting based on parameter, but keep all vote data in scope
      if (sortBy === 'netPositive') {
        query += `
          WITH s, keywords, relatedStatements, directlyRelatedStatements, 
               positiveVotes, negativeVotes,
               (positiveVotes - negativeVotes) as netVotes
          ORDER BY netVotes ${sortDirection === 'desc' ? 'DESC' : 'ASC'}
        `;
      } else if (sortBy === 'totalVotes') {
        query += `
          WITH s, keywords, relatedStatements, directlyRelatedStatements, 
               positiveVotes, negativeVotes,
               (positiveVotes + negativeVotes) as totalVotes
          ORDER BY totalVotes ${sortDirection === 'desc' ? 'DESC' : 'ASC'}
        `;
      } else if (sortBy === 'chronological') {
        query += `
          WITH s, keywords, relatedStatements, directlyRelatedStatements, 
               positiveVotes, negativeVotes
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

      // Return statement with all its data
      query += `
        RETURN {
          id: s.id,
          statement: s.statement,
          createdBy: s.createdBy,
          publicCredit: s.publicCredit,
          initialComment: s.initialComment,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          positiveVotes: positiveVotes,
          negativeVotes: negativeVotes,
          netVotes: positiveVotes - negativeVotes,
          keywords: keywords,
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
        // Ensure numeric conversions for vote properties
        ['positiveVotes', 'negativeVotes', 'netVotes'].forEach((prop) => {
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

  private getDefaultRelationshipType(parentNodeType: string): string {
    const relationshipMap = {
      OpenQuestionNode: 'ANSWERS',
      StatementNode: 'RELATED_TO',
      QuantityNode: 'RESPONDS_TO',
    };

    return relationshipMap[parentNodeType] || 'RELATED_TO';
  }

  async createStatement(statementData: {
    id: string;
    createdBy: string;
    publicCredit: boolean;
    statement: string;
    keywords: KeywordWithFrequency[];
    initialComment: string;
    parentNode?: {
      id: string;
      type: 'OpenQuestionNode' | 'StatementNode' | 'QuantityNode';
      relationshipType?: string;
    };
  }) {
    try {
      if (!statementData.statement || statementData.statement.trim() === '') {
        throw new BadRequestException('Statement text cannot be empty');
      }

      this.logger.log(`Creating statement with ID: ${statementData.id}`);
      this.logger.debug(`Statement data: ${JSON.stringify(statementData)}`);

      // Build the base query
      let query = `
    // Create the statement node
    CREATE (s:StatementNode {
      id: $id,
      createdBy: $createdBy,
      publicCredit: $publicCredit,
      statement: $statement,
      initialComment: $initialComment,
      createdAt: datetime(),
      updatedAt: datetime(),
      positiveVotes: 0,
      negativeVotes: 0,
      netVotes: 0
    })
  `;

      // Handle parent node relationship if provided
      if (statementData.parentNode) {
        const relationshipType =
          statementData.parentNode.relationshipType ||
          this.getDefaultRelationshipType(statementData.parentNode.type);

        // Log the relationship being created
        this.logger.debug(
          `Creating relationship: ${relationshipType} from statement to ${statementData.parentNode.type}`,
        );

        // FIXED: Create relationship FROM statement TO parent for ANSWERS relationship
        // This ensures (Statement)-[:ANSWERS]->(OpenQuestion) which is semantically correct
        if (relationshipType === 'ANSWERS') {
          query += `
      WITH s
      MATCH (parent:${statementData.parentNode.type} {id: $parentNodeId})
      CREATE (s)-[:${relationshipType}]->(parent)
    `;
        } else {
          // For other relationship types, keep the original direction
          query += `
      WITH s
      MATCH (parent:${statementData.parentNode.type} {id: $parentNodeId})
      CREATE (parent)-[:${relationshipType}]->(s)
    `;
        }
      }

      // CRITICAL FIX: Handle keywords only if they exist and are not empty
      if (statementData.keywords && statementData.keywords.length > 0) {
        query += `
    // Process each keyword
    WITH s
    UNWIND $keywords as keyword
    
    // Find word node for each keyword (don't create - already done by WordService)
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
    
    // Create SHARED_TAG relationships between statements only if other statements exist
    FOREACH (dummy IN CASE WHEN o IS NOT NULL THEN [1] ELSE [] END |
      MERGE (s)-[st:SHARED_TAG {word: w.word}]->(o)
      ON CREATE SET st.strength = keyword.frequency * t.frequency
      ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
    )
    `;
      }

      // Continue with discussion creation
      query += `
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

      // Only add keywords if they exist and are not empty
      if (statementData.keywords && statementData.keywords.length > 0) {
        params.keywords = statementData.keywords;
      }

      // Add parent node ID if provided
      if (statementData.parentNode) {
        params.parentNodeId = statementData.parentNode.id;
      }

      // Log the final query and params for debugging
      this.logger.debug(`Executing createStatement query with params:`, params);

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error('Failed to create statement - no records returned');
      }

      const createdStatement = result.records[0].get('s').properties;
      this.logger.log(
        `Successfully created statement with ID: ${createdStatement.id}`,
      );

      if (statementData.parentNode) {
        this.logger.log(
          `Successfully linked statement ${createdStatement.id} to parent ${statementData.parentNode.type} ${statementData.parentNode.id}`,
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

      // Handle the case where the parent node doesn't exist
      if (error.message && error.message.includes('no rows available')) {
        throw new BadRequestException(
          `Parent node not found: ${statementData.parentNode?.id}. Please ensure the question exists.`,
        );
      }

      // Handle the specific case of missing word nodes
      if (error.message && error.message.includes('not found')) {
        throw new BadRequestException(
          `Some keywords don't have corresponding word nodes. Ensure all keywords exist as words before creating the statement.`,
        );
      }

      // Handle Neo4j syntax errors
      if (error.message && error.message.includes('SyntaxError')) {
        this.logger.error(`Cypher syntax error: ${error.message}`);
        throw new Error(`Database query error: ${error.message}`);
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
        
        // Get statements with shared keywords
        OPTIONAL MATCH (s)-[st:SHARED_TAG]->(o:StatementNode)
        
        // Get directly related statements
        OPTIONAL MATCH (s)-[:RELATED_TO]-(r:StatementNode)
        
        // Get discussion
        OPTIONAL MATCH (s)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        RETURN s,
               collect(DISTINCT {
                 word: w.word, 
                 frequency: t.frequency,
                 source: t.source
               }) as keywords,
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
      statement.relatedStatements = result.records[0].get('relatedStatements');
      statement.directlyRelatedStatements = result.records[0].get(
        'directlyRelatedStatements',
      );
      statement.discussionId = result.records[0].get('discussionId');

      // Convert Neo4j integers to JavaScript numbers
      if (statement.positiveVotes !== undefined) {
        statement.positiveVotes = this.toNumber(statement.positiveVotes);
      }
      if (statement.negativeVotes !== undefined) {
        statement.negativeVotes = this.toNumber(statement.negativeVotes);
      }
      if (statement.netVotes !== undefined) {
        statement.netVotes = this.toNumber(statement.netVotes);
      }

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
      discussionId: string;
    }>,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.log(`Updating statement with ID: ${id}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateData)}`);

      // If keywords are provided, update the relationships
      if (updateData.keywords && updateData.keywords.length > 0) {
        const result = await this.neo4jService.write(
          `
          // Match the statement to update
          MATCH (s:StatementNode {id: $id})
          
          // Set updated properties
          SET s += $updateProperties,
              s.updatedAt = datetime()
          
          // Remove existing TAGGED relationships
          WITH s
          OPTIONAL MATCH (s)-[r:TAGGED]->()
          DELETE r
          
          // Remove existing SHARED_TAG relationships
          WITH s
          OPTIONAL MATCH (s)-[st:SHARED_TAG]->()
          DELETE st
          
          // Process updated keywords
          WITH s
          UNWIND $keywords as keyword
          
          // Find word node for each keyword (don't create - already done by WordService)
          MATCH (w:WordNode {word: keyword.word})
          
          // Create new TAGGED relationship
          CREATE (s)-[:TAGGED {
            frequency: keyword.frequency,
            source: keyword.source
          }]->(w)
          
          // Reconnect to other statements that share this keyword
          WITH s, w, keyword
          MATCH (o:StatementNode)-[t:TAGGED]->(w)
          WHERE o.id <> s.id
          
          // Create new SHARED_TAG relationships
          MERGE (s)-[st:SHARED_TAG {word: w.word}]->(o)
          ON CREATE SET st.strength = keyword.frequency * t.frequency
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
          
          RETURN s
          `,
          {
            id,
            updateProperties: {
              statement: updateData.statement,
              publicCredit: updateData.publicCredit,
              discussionId: updateData.discussionId,
            },
            keywords: updateData.keywords,
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

      // Handle the specific case of missing word nodes
      if (error.message && error.message.includes('not found')) {
        throw new BadRequestException(
          `Some keywords don't have corresponding word nodes. Ensure all keywords exist as words before updating the statement.`,
        );
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

  // Standardized vote methods that match the pattern used in WordSchema and DefinitionSchema
  async voteStatement(id: string, sub: string, isPositive: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      this.logger.log(
        `Processing vote on statement ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      return await this.voteSchema.vote(
        'StatementNode',
        { id },
        sub,
        isPositive,
      );
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

  async getStatementVoteStatus(id: string, sub: string) {
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

  async removeStatementVote(id: string, sub: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      this.logger.log(`Removing vote from statement ${id} by user ${sub}`);

      return await this.voteSchema.removeVote('StatementNode', { id }, sub);
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

  async getStatementVotes(id: string) {
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
        positiveVotes: voteStatus.positiveVotes,
        negativeVotes: voteStatus.negativeVotes,
        netVotes: voteStatus.netVotes,
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
