// src/neo4j/schemas/statement.schema.ts

import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

interface KeywordWithFrequency {
  word: string;
  frequency: number;
}

@Injectable()
export class StatementSchema {
  [x: string]: any;
  constructor(private readonly neo4jService: Neo4jService) {}

  async createStatement(statementData: {
    id: string;
    createdBy: string;
    publicCredit: boolean;
    statement: string;
    keywords: KeywordWithFrequency[];
    initialComment: string;
  }) {
    const result = await this.neo4jService.write(
      `
      CREATE (s:StatementNode {
        id: $id,
        createdBy: $createdBy,
        publicCredit: $publicCredit,
        statement: $statement,
        initialComment: $initialComment,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      WITH s
      UNWIND $keywords as keyword
      MERGE (w:WordNode {word: keyword.word})
      CREATE (s)-[:TAGGED {frequency: keyword.frequency}]->(w)
      WITH s, w, keyword
      MATCH (o:StatementNode)-[t:TAGGED]->(w)
      WHERE o.id <> s.id
      MERGE (s)-[st:SHARED_TAG {word: w.word}]->(o)
      ON CREATE SET st.strength = keyword.frequency * t.frequency
      ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
      WITH s
      CREATE (d:DiscussionNode {
        id: apoc.create.uuid(),
        createdAt: datetime()
      })
      CREATE (s)-[:HAS_DISCUSSION]->(d)
      CREATE (c:CommentNode {
        id: apoc.create.uuid(),
        createdBy: $createdBy,
        commentText: $initialComment,
        createdAt: datetime()
      })
      CREATE (d)-[:HAS_COMMENT]->(c)
      RETURN s
    `,
      statementData,
    );
    return result.records[0].get('s').properties;
  }

  async getStatement(id: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (s:StatementNode {id: $id})
      OPTIONAL MATCH (s)-[t:TAGGED]->(w:WordNode)
      OPTIONAL MATCH (s)-[st:SHARED_TAG]->(o:StatementNode)
      RETURN s,
             collect(DISTINCT {word: w.word, frequency: t.frequency}) as keywords,
             collect(DISTINCT {
               nodeId: o.id,
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
    const result = await this.neo4jService.write(
      `
      MATCH (s:StatementNode {id: $id})
      SET s += $updateProperties, s.updatedAt = datetime()
      WITH s
      OPTIONAL MATCH (s)-[r:TAGGED]->()
      DELETE r
      WITH s
      UNWIND $keywords as keyword
      MERGE (w:WordNode {word: keyword.word})
      CREATE (s)-[:TAGGED {frequency: keyword.frequency}]->(w)
      WITH s, w, keyword
      MATCH (o:StatementNode)-[t:TAGGED]->(w)
      WHERE o.id <> s.id
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
