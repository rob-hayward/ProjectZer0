// src/neo4j/schemas/definition.schema.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { TEXT_LIMITS } from '../../constants/validation';

@Injectable()
export class DefinitionSchema {
  constructor(private readonly neo4jService: Neo4jService) {}

  async createDefinition(definitionData: {
    id: string;
    word: string;
    createdBy: string;
    definitionText: string;
  }) {
    if (
      definitionData.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH
    ) {
      throw new BadRequestException(
        `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`,
      );
    }

    const result = await this.neo4jService.write(
      `
      MATCH (w:WordNode {word: $word})
      CREATE (d:DefinitionNode {
        id: $id,
        definitionText: $definitionText,
        createdBy: $createdBy,
        createdAt: datetime(),
        updatedAt: datetime(),
        votes: CASE WHEN $createdBy = 'FreeDictionaryAPI' THEN 0 ELSE 1 END,
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
    if (
      updateData.definitionText &&
      updateData.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH
    ) {
      throw new BadRequestException(
        `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`,
      );
    }

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
