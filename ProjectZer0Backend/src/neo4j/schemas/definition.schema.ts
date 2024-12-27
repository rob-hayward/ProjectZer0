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
            votes: 0,
            visibilityStatus: true
        })
        CREATE (w)-[:HAS_DEFINITION]->(d)
        WITH d, $createdBy as userId
        CALL {
            WITH d, userId
            WITH d, userId
            WHERE userId <> 'FreeDictionaryAPI'
            MERGE (u:User {id: userId})
            CREATE (u)-[:VOTED_ON {createdAt: datetime(), value: 1}]->(d)
            SET d.votes = 1
            RETURN true as hasVoted
        }
        RETURN d, CASE WHEN userId = 'FreeDictionaryAPI' THEN false ELSE true END as hasVoted
        `,
      definitionData,
    );

    return {
      definition: result.records[0].get('d').properties,
      hasVoted: result.records[0].get('hasVoted'),
    };
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

  async voteDefinition(
    definitionId: string,
    userId: string,
    vote: 'agree' | 'disagree',
  ) {
    const result = await this.neo4jService.write(
      `
        MATCH (d:DefinitionNode {id: $definitionId})
        MATCH (u:User {id: $userId})
        WITH d, u
        
        OPTIONAL MATCH (u)-[currentVote:VOTED_ON]->(d)
        WITH d, u, currentVote
        
        // If agreeing and no current vote exists
        FOREACH (x IN CASE 
            WHEN $vote = 'agree' AND currentVote IS NULL 
            THEN [1] ELSE [] END |
            CREATE (u)-[:VOTED_ON {createdAt: datetime(), value: 1}]->(d)
            SET d.votes = d.votes + 1
        )
        
        // If disagreeing and a vote exists
        FOREACH (x IN CASE 
            WHEN $vote = 'disagree' AND currentVote IS NOT NULL 
            THEN [1] ELSE [] END |
            DELETE currentVote
            SET d.votes = d.votes - 1
        )
        
        RETURN d, 
            EXISTS((u)-[:VOTED_ON]->(d)) as hasVoted
        `,
      { definitionId, userId, vote },
    );

    if (!result.records.length) {
      throw new Error('Definition not found');
    }

    return {
      // eslint-disable-next-line prettier/prettier
        definition: result.records[0].get('d').properties,
      hasVoted: result.records[0].get('hasVoted'),
    };
  }

  async getDefinitionVote(definitionId: string, userId: string) {
    const result = await this.neo4jService.read(
      `
        MATCH (d:DefinitionNode {id: $definitionId})
        MATCH (u:User {id: $userId})
        OPTIONAL MATCH (u)-[v:VOTED_ON]->(d)
        RETURN d, v.value IS NOT NULL as hasVoted
        `,
      { definitionId, userId },
    );

    if (result.records.length === 0) return null;

    return {
      definition: result.records[0].get('d').properties,
      hasVoted: result.records[0].get('hasVoted'),
    };
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
