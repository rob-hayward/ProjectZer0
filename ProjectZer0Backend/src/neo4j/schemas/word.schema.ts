// src/neo4j/schemas/word.schema.ts

import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

@Injectable()
export class WordSchema {
  constructor(private readonly neo4jService: Neo4jService) {}

  async checkWordExistence(word: string): Promise<boolean> {
    const standardizedWord = this.standardizeWord(word);
    const result = await this.neo4jService.read(
      `
      MATCH (w:WordNode {word: $word})
      RETURN w
      `,
      { word: standardizedWord },
    );
    return result.records.length > 0;
  }

  private standardizeWord(word: string): string {
    return word.trim().toLowerCase();
  }

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
        w.createdBy = $createdBy,
        w.positiveVotes = 0,
        w.negativeVotes = 0
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
      OPTIONAL MATCH (w)-[:HAS_DEFINITION]->(d:DefinitionNode)
      RETURN w, collect(d) as definitions
      `,
      { word },
    );
    if (result.records.length === 0) return null;
    const wordNode = result.records[0].get('w').properties;
    wordNode.definitions = result.records[0]
      .get('definitions')
      .map((d) => d.properties);
    return wordNode;
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

  async voteWord(word: string, userId: string, isPositive: boolean) {
    const result = await this.neo4jService.write(
      `
      MATCH (w:WordNode {word: $word})
      MERGE (u:User {id: $userId})
      MERGE (u)-[v:VOTED_ON]->(w)
      ON CREATE SET v.vote = $isPositive
      ON MATCH SET v.vote = $isPositive
      WITH w, v
      SET w.positiveVotes = w.positiveVotes + CASE WHEN v.vote = true THEN 1 ELSE 0 END,
          w.negativeVotes = w.negativeVotes + CASE WHEN v.vote = false THEN 1 ELSE 0 END
      RETURN w
      `,
      { word, userId, isPositive },
    );
    return result.records[0].get('w').properties;
  }

  async getWordVotes(word: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (w:WordNode {word: $word})
      RETURN w.positiveVotes as positiveVotes, w.negativeVotes as negativeVotes
      `,
      { word },
    );
    if (result.records.length === 0) return null;
    return {
      positiveVotes: result.records[0].get('positiveVotes'),
      negativeVotes: result.records[0].get('negativeVotes'),
    };
  }
}
