// src/neo4j/schemas/statement.schema.ts

import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';

@Injectable()
export class StatementSchema {
  private readonly logger = new Logger(StatementSchema.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async createStatement(statementData: {
    id: string;
    createdBy: string;
    publicCredit: boolean;
    statement: string;
    keywords: KeywordWithFrequency[];
    initialComment: string;
  }) {
    this.logger.log(
      `Creating statement with ${statementData.keywords.length} keywords`,
    );

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
        updatedAt: datetime()
      })
      
      // Process each keyword
      WITH s
      UNWIND $keywords as keyword
      
      // Find or create word node for each keyword
      MERGE (w:WordNode {word: keyword.word})
      ON CREATE SET 
        w.id = apoc.create.uuid(),
        w.createdAt = datetime(),
        w.createdBy = 'StatementKeywordExtraction'
      
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
    this.logger.log(`Created statement: ${createdStatement.id}`);

    return createdStatement;
  }

  async getStatement(id: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (s:StatementNode {id: $id})
      OPTIONAL MATCH (s)-[t:TAGGED]->(w:WordNode)
      OPTIONAL MATCH (s)-[st:SHARED_TAG]->(o:StatementNode)
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
             }) as relatedStatements
      `,
      { id },
    );
    if (result.records.length === 0) return null;

    const statement = result.records[0].get('s').properties;
    statement.keywords = result.records[0].get('keywords');
    statement.relatedStatements = result.records[0].get('relatedStatements');

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
        
        // Find or create word node for each keyword
        MERGE (w:WordNode {word: keyword.word})
        ON CREATE SET 
          w.id = apoc.create.uuid(),
          w.createdAt = datetime(),
          w.createdBy = 'StatementKeywordExtraction'
        
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
}
