// src/neo4j/schemas/belief.schema.ts

import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

@Injectable()
export class BeliefSchema {
  constructor(private readonly neo4jService: Neo4jService) {}

  async createBelief(beliefData: {
    id: string;
    createdBy: string;
    publicCredit: boolean;
    statement: string;
    tags: string[];
  }) {
    const result = await this.neo4jService.write(
      `
      CREATE (b:BeliefNode {
        id: $id,
        createdBy: $createdBy,
        publicCredit: $publicCredit,
        statement: $statement,
        positiveVotes: 0,
        negativeVotes: 0,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      WITH b
      UNWIND $tags as tag
      MERGE (w:WordNode {word: tag})
      CREATE (b)-[:TAGGED]->(w)
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
      OPTIONAL MATCH (b)-[:TAGGED]->(w:WordNode)
      RETURN b, collect(w.word) as tags
      `,
      { id },
    );
    if (result.records.length === 0) return null;
    const belief = result.records[0].get('b').properties;
    belief.tags = result.records[0].get('tags');
    return belief;
  }

  async updateBelief(
    id: string,
    updateData: Partial<{
      statement: string;
      publicCredit: boolean;
      tags: string[];
    }>,
  ) {
    const result = await this.neo4jService.write(
      `
      MATCH (b:BeliefNode {id: $id})
      SET b += $updateData, b.updatedAt = datetime()
      WITH b
      OPTIONAL MATCH (b)-[r:TAGGED]->()
      DELETE r
      WITH b
      UNWIND $tags as tag
      MERGE (w:WordNode {word: tag})
      CREATE (b)-[:TAGGED]->(w)
      RETURN b
      `,
      {
        id,
        updateData: {
          statement: updateData.statement,
          publicCredit: updateData.publicCredit,
        },
        tags: updateData.tags,
      },
    );
    return result.records[0].get('b').properties;
  }

  async deleteBelief(id: string) {
    await this.neo4jService.write(
      `
      MATCH (b:BeliefNode {id: $id})
      DETACH DELETE b
      `,
      { id },
    );
  }

  async voteBelief(id: string, voteType: 'positive' | 'negative') {
    const result = await this.neo4jService.write(
      `
      MATCH (b:BeliefNode {id: $id})
      SET b.${voteType}Votes = b.${voteType}Votes + 1
      RETURN b
      `,
      { id },
    );
    return result.records[0].get('b').properties;
  }
}
