// src/neo4j/schemas/statement.schema.ts

import { Injectable, Logger } from '@nestjs/common';
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
    const {
      limit = null,
      offset = 0,
      sortBy = 'netPositive',
      sortDirection = 'desc',
      keywords,
      userId,
    } = options;

    // First, check if we have any statements in the database
    try {
      const countResult = await this.neo4jService.read(
        `MATCH (s:StatementNode) RETURN count(s) as count`,
      );
      const statementCount = countResult.records[0].get('count').toNumber();

      if (statementCount === 0) {
        return [];
      }
    } catch (error) {
      this.logger.error(`Error counting statements: ${error.message}`);
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

    try {
      // Execute the query
      const result = await this.neo4jService.read(query, {
        limit,
        offset,
        keywords,
        userId,
      });

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

      return statements;
    } catch (error) {
      this.logger.error(`Error getting statement network: ${error.message}`);
      throw error;
    }
  }

  async createStatement(statementData: {
    id: string;
    createdBy: string;
    publicCredit: boolean;
    statement: string;
    keywords: KeywordWithFrequency[];
    initialComment: string;
  }) {
    try {
      const result = await this.neo4jService.write(
        `
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
        MATCH (o:StatementNode)-[t:TAGGED]->(w)
        WHERE o.id <> s.id
        
        // Create SHARED_TAG relationships between statements
        MERGE (s)-[st:SHARED_TAG {word: w.word}]->(o)
        ON CREATE SET st.strength = keyword.frequency * t.frequency
        ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
        
        // Create discussion node and initial comment
        WITH DISTINCT s
        CREATE (d:DiscussionNode {
          id: apoc.create.uuid(),
          createdAt: datetime(),
          createdBy: $createdBy,
          visibilityStatus: true
        })
        CREATE (s)-[:HAS_DISCUSSION]->(d)
        
        WITH s, d
        CREATE (c:CommentNode {
          id: apoc.create.uuid(),
          createdBy: $createdBy,
          commentText: $initialComment,
          createdAt: datetime(),
          updatedAt: datetime(),
          positiveVotes: 0,
          negativeVotes: 0,
          visibilityStatus: true
        })
        CREATE (d)-[:HAS_COMMENT]->(c)
        
        RETURN s
        `,
        statementData,
      );

      const createdStatement = result.records[0].get('s').properties;
      return createdStatement;
    } catch (error) {
      this.logger.error(`Error in createStatement: ${error.message}`);

      // Handle the specific case of missing word nodes
      if (error.message.includes('not found')) {
        throw new Error(
          `Some keywords don't have corresponding word nodes. Ensure all keywords exist as words before creating the statement.`,
        );
      }

      throw error;
    }
  }

  async getStatement(id: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (s:StatementNode {id: $id})
      
      // Get keywords
      OPTIONAL MATCH (s)-[t:TAGGED]->(w:WordNode)
      
      // Get statements with shared keywords
      OPTIONAL MATCH (s)-[st:SHARED_TAG]->(o:StatementNode)
      
      // Get directly related statements
      OPTIONAL MATCH (s)-[:RELATED_TO]-(r:StatementNode)
      
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
             }) as directlyRelatedStatements
      `,
      { id },
    );

    if (result.records.length === 0) return null;

    const statement = result.records[0].get('s').properties;
    statement.keywords = result.records[0].get('keywords');
    statement.relatedStatements = result.records[0].get('relatedStatements');
    statement.directlyRelatedStatements = result.records[0].get(
      'directlyRelatedStatements',
    );

    return statement;
  }

  async updateStatement(
    id: string,
    updateData: Partial<{
      statement: string;
      publicCredit: boolean;
      keywords: KeywordWithFrequency[];
    }>,
  ) {
    // If keywords are provided, update the relationships
    if (updateData.keywords && updateData.keywords.length > 0) {
      try {
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
            },
            keywords: updateData.keywords,
          },
        );

        return result.records[0].get('s').properties;
      } catch (error) {
        this.logger.error(`Error in updateStatement: ${error.message}`);

        // Handle the specific case of missing word nodes
        if (error.message.includes('not found')) {
          throw new Error(
            `Some keywords don't have corresponding word nodes. Ensure all keywords exist as words before updating the statement.`,
          );
        }

        throw error;
      }
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
          },
        },
      );

      return result.records[0].get('s').properties;
    }
  }

  async deleteStatement(id: string) {
    await this.neo4jService.write(
      `
      MATCH (s:StatementNode {id: $id})
      OPTIONAL MATCH (s)-[r]-()
      DELETE r, s
      `,
      { id },
    );
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    const result = await this.neo4jService.write(
      `
      MATCH (s:StatementNode {id: $id})
      SET s.visibilityStatus = $isVisible, s.updatedAt = datetime()
      RETURN s
      `,
      { id, isVisible },
    );
    return result.records[0].get('s').properties;
  }

  async getVisibilityStatus(id: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (s:StatementNode {id: $id})
      RETURN s.visibilityStatus
      `,
      { id },
    );
    return result.records[0]?.get('s.visibilityStatus') ?? true;
  }

  // Standardized vote methods that match the pattern used in WordSchema and DefinitionSchema
  async voteStatement(id: string, sub: string, isPositive: boolean) {
    return this.voteSchema.vote('StatementNode', { id }, sub, isPositive);
  }

  async getStatementVoteStatus(id: string, sub: string) {
    return this.voteSchema.getVoteStatus('StatementNode', { id }, sub);
  }

  async removeStatementVote(id: string, sub: string) {
    return this.voteSchema.removeVote('StatementNode', { id }, sub);
  }

  async getStatementVotes(id: string) {
    const voteStatus = await this.voteSchema.getVoteStatus(
      'StatementNode',
      { id },
      '', // Empty string as we don't need user-specific status
    );

    if (!voteStatus) {
      return null;
    }

    return {
      positiveVotes: voteStatus.positiveVotes,
      negativeVotes: voteStatus.negativeVotes,
      netVotes: voteStatus.netVotes,
    };
  }

  /**
   * Creates a direct, undirected relationship between two statements
   */
  async createDirectRelationship(statementId1: string, statementId2: string) {
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

      return true;
    } catch (error) {
      this.logger.error(`Error creating direct relationship: ${error.message}`);
      throw error;
    }
  }

  /**
   * Removes a direct relationship between two statements
   */
  async removeDirectRelationship(statementId1: string, statementId2: string) {
    try {
      await this.neo4jService.write(
        `
        MATCH (s1:StatementNode {id: $statementId1})-[r:RELATED_TO]-(s2:StatementNode {id: $statementId2})
        DELETE r
        `,
        { statementId1, statementId2 },
      );

      return true;
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

      return result.records[0].get('relatedStatements');
    } catch (error) {
      this.logger.error(
        `Error getting directly related statements: ${error.message}`,
      );
      throw error;
    }
  }

  async checkStatements(): Promise<{ count: number }> {
    try {
      const result = await this.neo4jService.read(
        `MATCH (s:StatementNode) RETURN count(s) as count`,
      );
      const count = result.records[0].get('count').toNumber();
      return { count };
    } catch (error) {
      this.logger.error(`Error checking statements: ${error.message}`);
      throw error;
    }
  }
}
