// src/neo4j/schemas/word.schema.ts

import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

@Injectable()
export class WordSchema {
  constructor(private readonly neo4jService: Neo4jService) {}

  async createWord(wordData: {
    word: string;
    createdBy: string;
    initialDefinition: string;
  }) {
    const result = await this.neo4jService.write(
      `
      MERGE (w:WordNode {word: $word})
      ON CREATE SET 
        w.createdAt = datetime(), 
        w.createdBy = $createdBy
      CREATE (d:DefinitionNode {
        id: apoc.create.uuid(),
        text: $initialDefinition,
        createdBy: $createdBy,
        createdAt: datetime(),
        votes: 0
      })
      CREATE (w)-[:HAS_DEFINITION]->(d)
      CREATE (disc:DiscussionNode {
        id: apoc.create.uuid(),
        createdAt: datetime()
      })
      CREATE (w)-[:HAS_DISCUSSION]->(disc)
      RETURN w
    `,
      wordData,
    );
    return result.records[0].get('w').properties;
  }

  async addDefinition(wordData: {
    word: string;
    createdBy: string;
    definitionText: string;
  }) {
    const result = await this.neo4jService.write(
      `
      MATCH (w:WordNode {word: $word})
      CREATE (d:DefinitionNode {
        id: apoc.create.uuid(),
        text: $definitionText,
        createdBy: $createdBy,
        createdAt: datetime(),
        votes: 0
      })
      CREATE (w)-[:HAS_DEFINITION]->(d)
      RETURN d
    `,
      wordData,
    );
    return result.records[0].get('d').properties;
  }

  async getWord(word: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (w:WordNode {word: $word})
      RETURN w
      `,
      { word },
    );
    return result.records.length > 0
      ? result.records[0].get('w').properties
      : null;
  }

  async updateWord(
    word: string,
    updateData: {
      liveDefinition?: string;
    },
  ) {
    const result = await this.neo4jService.write(
      `
      MATCH (w:WordNode {word: $word})
      SET w += $updateData
      RETURN w
      `,
      { word, updateData },
    );
    return result.records[0].get('w').properties;
  }

  async deleteWord(word: string) {
    await this.neo4jService.write(
      `
      MATCH (w:WordNode {word: $word})
      DETACH DELETE w
      `,
      { word },
    );
  }
}
