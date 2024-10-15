import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

@Injectable()
export class DefinitionSchema {
  constructor(private readonly neo4jService: Neo4jService) {}

  async createDefinition(definitionData: {
    id: string;
    word: string;
    createdBy: string;
    definitionText: string;
  }) {
    const result = await this.neo4jService.write(
      `
      MATCH (w:WordNode {word: $word})
      CREATE (d:DefinitionNode {
        id: $id,
        definitionText: $definitionText,
        createdBy: $createdBy,
        createdAt: datetime(),
        updatedAt: datetime(),
        positiveVotes: 0,
        negativeVotes: 0,
        visibilityStatus: true
      })
      CREATE (w)-[:HAS_DEFINITION]->(d)
      RETURN d
      `,
      definitionData,
    );
    return result.records[0].get('d').properties;
  }

  async getDefinition(id: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (d:DefinitionNode {id: $id})
      RETURN d
      `,
      { id },
    );
    return result.records.length > 0
      ? result.records[0].get('d').properties
      : null;
  }

  async updateDefinition(
    id: string,
    updateData: {
      definitionText?: string;
    },
  ) {
    const result = await this.neo4jService.write(
      `
      MATCH (d:DefinitionNode {id: $id})
      SET d += $updateData, d.updatedAt = datetime()
      RETURN d
      `,
      { id, updateData },
    );
    return result.records[0].get('d').properties;
  }

  async deleteDefinition(id: string) {
    await this.neo4jService.write(
      `
      MATCH (d:DefinitionNode {id: $id})
      DETACH DELETE d
      `,
      { id },
    );
  }

  async setVisibilityStatus(definitionId: string, isVisible: boolean) {
    const result = await this.neo4jService.write(
      `
      MATCH (d:DefinitionNode {id: $definitionId})
      SET d.visibilityStatus = $isVisible, d.updatedAt = datetime()
      RETURN d
      `,
      { definitionId, isVisible },
    );
    return result.records[0].get('d').properties;
  }

  async getVisibilityStatus(definitionId: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (d:DefinitionNode {id: $definitionId})
      RETURN d.visibilityStatus
      `,
      { definitionId },
    );
    return result.records[0]?.get('d.visibilityStatus') ?? true;
  }
}
