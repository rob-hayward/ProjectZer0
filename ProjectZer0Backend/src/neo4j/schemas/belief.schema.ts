// src/neo4j/schemas/belief.schema.ts

import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

interface KeywordWithFrequency {
  word: string;
  frequency: number;
}

@Injectable()
export class BeliefSchema {
  [x: string]: any;
  constructor(private readonly neo4jService: Neo4jService) {}

  async createBelief(beliefData: {
    id: string;
    createdBy: string;
    publicCredit: boolean;
    statement: string;
    keywords: KeywordWithFrequency[];
    initialComment: string;
  }) {
    const result = await this.neo4jService.write(
      `
      CREATE (b:BeliefNode {
        id: $id,
        createdBy: $createdBy,
        publicCredit: $publicCredit,
        statement: $statement,
        initialComment: $initialComment,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      WITH b
      UNWIND $keywords as keyword
      MERGE (w:WordNode {word: keyword.word})
      CREATE (b)-[:TAGGED {frequency: keyword.frequency}]->(w)
      WITH b, w, keyword
      MATCH (o:BeliefNode)-[t:TAGGED]->(w)
      WHERE o.id <> b.id
      MERGE (b)-[st:SHARED_TAG {word: w.word}]->(o)
      ON CREATE SET st.strength = keyword.frequency * t.frequency
      ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
      WITH b
      CREATE (d:DiscussionNode {
        id: apoc.create.uuid(),
        createdAt: datetime()
      })
      CREATE (b)-[:HAS_DISCUSSION]->(d)
      CREATE (c:CommentNode {
        id: apoc.create.uuid(),
        createdBy: $createdBy,
        commentText: $initialComment,
        createdAt: datetime()
      })
      CREATE (d)-[:HAS_COMMENT]->(c)
      RETURN b
    `,
      beliefData,
    );
    return result.records[0].get('b').properties;
  }

  async getBelief(id: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (b:BeliefNode {id: $id})
      OPTIONAL MATCH (b)-[t:TAGGED]->(w:WordNode)
      OPTIONAL MATCH (b)-[st:SHARED_TAG]->(o:BeliefNode)
      RETURN b,
             collect(DISTINCT {word: w.word, frequency: t.frequency}) as keywords,
             collect(DISTINCT {
               nodeId: o.id,
               sharedWord: st.word,
               strength: st.strength
             }) as relatedBeliefs
      `,
      { id },
    );
    if (result.records.length === 0) return null;
    const belief = result.records[0].get('b').properties;
    belief.keywords = result.records[0].get('keywords');
    belief.relatedBeliefs = result.records[0].get('relatedBeliefs');
    return belief;
  }

  async updateBelief(
    id: string,
    updateData: Partial<{
      statement: string;
      publicCredit: boolean;
      keywords: KeywordWithFrequency[];
    }>,
  ) {
    const result = await this.neo4jService.write(
      `
      MATCH (b:BeliefNode {id: $id})
      SET b += $updateProperties, b.updatedAt = datetime()
      WITH b
      OPTIONAL MATCH (b)-[r:TAGGED]->()
      DELETE r
      WITH b
      UNWIND $keywords as keyword
      MERGE (w:WordNode {word: keyword.word})
      CREATE (b)-[:TAGGED {frequency: keyword.frequency}]->(w)
      WITH b, w, keyword
      MATCH (o:BeliefNode)-[t:TAGGED]->(w)
      WHERE o.id <> b.id
      MERGE (b)-[st:SHARED_TAG {word: w.word}]->(o)
      ON CREATE SET st.strength = keyword.frequency * t.frequency
      ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
      RETURN b
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
    return result.records[0].get('b').properties;
  }

  async deleteBelief(id: string) {
    await this.neo4jService.write(
      `
      MATCH (b:BeliefNode {id: $id})
      OPTIONAL MATCH (b)-[r]-()
      DELETE r, b
      `,
      { id },
    );
  }
}
