// src/neo4j/schemas/word.schema.ts

import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

@Injectable()
export class WordSchema {
  constructor(private readonly neo4jService: Neo4jService) {}

  async createWord(wordData: { word: string; createdBy: string }) {
    const result = await this.neo4jService.write(
      `
      MERGE (w:WordNode {word: $word})
      ON CREATE SET w.createdAt = datetime(), w.createdBy = $createdBy
      RETURN w
      `,
      wordData,
    );
    return result.records[0].get('w').properties;
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
