// src/neo4j/schemas/definition.schema.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { UserSchema } from './user.schema';
import { TEXT_LIMITS } from '../../constants/validation';

@Injectable()
export class DefinitionSchema {
  private readonly logger = new Logger(DefinitionSchema.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly userSchema: UserSchema,
  ) {}

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

    const isApiDefinition = definitionData.createdBy === 'FreeDictionaryAPI';
    const isAICreated = definitionData.createdBy === 'ProjectZeroAI';

    const result = await this.neo4jService.write(
      `
      // Create User if needed (for non-API creators)
      CALL {
        WITH $createdBy as userId
        WITH userId
        WHERE userId <> 'FreeDictionaryAPI' AND userId <> 'ProjectZeroAI'
        MERGE (u:User {sub: userId})
        RETURN u
      }

      // Match Word and Create Definition
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

      // Create CREATED relationship and handle voting for user-created content
      WITH d, $createdBy as userId
      WHERE NOT $isApiDefinition AND NOT $isAICreated
      MATCH (u:User {sub: userId})
      CREATE (u)-[:CREATED {
          createdAt: datetime(),
          type: 'definition'
      }]->(d)
      CREATE (u)-[:VOTED_ON {
          createdAt: datetime(),
          value: 1
      }]->(d)
      SET d.votes = 1

      RETURN d, 
        CASE WHEN $isApiDefinition OR $isAICreated THEN false ELSE true END as hasVoted
      `,
      {
        ...definitionData,
        isApiDefinition,
        isAICreated,
      },
    );

    this.logger.log(
      `Created definition: ${JSON.stringify(result.records[0].get('d').properties)}`,
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
    const definition =
      result.records.length > 0 ? result.records[0].get('d').properties : null;

    this.logger.log(`Retrieved definition: ${JSON.stringify(definition)}`);
    return definition;
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

    const updatedDefinition = result.records[0].get('d').properties;
    this.logger.log(`Updated definition: ${JSON.stringify(updatedDefinition)}`);
    return updatedDefinition;
  }

  async deleteDefinition(id: string) {
    this.logger.log(`Deleting definition: ${id}`);
    await this.neo4jService.write(
      `
      MATCH (d:DefinitionNode {id: $id})
      OPTIONAL MATCH (u)-[r:CREATED]->(d)
      OPTIONAL MATCH (u)-[v:VOTED_ON]->(d)
      DELETE r, v, d
      `,
      { id },
    );
    this.logger.log(`Deleted definition: ${id}`);
  }

  async voteDefinition(
    definitionId: string,
    userId: string,
    vote: 'agree' | 'disagree',
  ) {
    this.logger.log(
      `Processing vote for definition ${definitionId} by user ${userId}: ${vote}`,
    );

    const result = await this.neo4jService.write(
      `
      MATCH (d:DefinitionNode {id: $definitionId})
      MATCH (u:User {sub: $userId})
      WITH d, u
      
      OPTIONAL MATCH (u)-[currentVote:VOTED_ON]->(d)
      WITH d, u, currentVote
      
      // If agreeing and no current vote exists
      FOREACH (x IN CASE 
          WHEN $vote = 'agree' AND currentVote IS NULL 
          THEN [1] ELSE [] END |
          CREATE (u)-[:VOTED_ON {
              createdAt: datetime(),
              value: 1
          }]->(d)
          SET d.votes = d.votes + 1
      )
      
      // If disagreeing and a vote exists
      FOREACH (x IN CASE 
          WHEN $vote = 'disagree' AND currentVote IS NOT NULL 
          THEN [1] ELSE [] END |
          DELETE currentVote
          SET d.votes = d.votes - 1
      )
      
      // Add participation relationship if not already exists
      MERGE (u)-[p:PARTICIPATED_IN {type: 'voted'}]->(d)
      ON CREATE SET p.createdAt = datetime()
      ON MATCH SET p.updatedAt = datetime()
      
      RETURN d, 
          EXISTS((u)-[:VOTED_ON]->(d)) as hasVoted
      `,
      { definitionId, userId, vote },
    );

    if (!result.records.length) {
      throw new Error('Definition not found');
    }

    const voteResult = {
      definition: result.records[0].get('d').properties,
      hasVoted: result.records[0].get('hasVoted'),
    };

    this.logger.log(`Vote result: ${JSON.stringify(voteResult)}`);
    return voteResult;
  }

  async getDefinitionVote(definitionId: string, userId: string) {
    this.logger.log(
      `Getting vote status for definition ${definitionId} by user ${userId}`,
    );

    const result = await this.neo4jService.read(
      `
      MATCH (d:DefinitionNode {id: $definitionId})
      MATCH (u:User {sub: $userId})
      OPTIONAL MATCH (u)-[v:VOTED_ON]->(d)
      RETURN d, v.value IS NOT NULL as hasVoted
      `,
      { definitionId, userId },
    );

    if (result.records.length === 0) return null;

    const voteStatus = {
      definition: result.records[0].get('d').properties,
      hasVoted: result.records[0].get('hasVoted'),
    };

    this.logger.log(`Vote status: ${JSON.stringify(voteStatus)}`);
    return voteStatus;
  }

  async setVisibilityStatus(definitionId: string, isVisible: boolean) {
    this.logger.log(
      `Setting visibility status for definition ${definitionId}: ${isVisible}`,
    );

    const result = await this.neo4jService.write(
      `
      MATCH (d:DefinitionNode {id: $definitionId})
      SET d.visibilityStatus = $isVisible, d.updatedAt = datetime()
      RETURN d
      `,
      { definitionId, isVisible },
    );

    const updatedDefinition = result.records[0].get('d').properties;
    this.logger.log(
      `Updated definition visibility: ${JSON.stringify(updatedDefinition)}`,
    );
    return updatedDefinition;
  }

  async getVisibilityStatus(definitionId: string) {
    this.logger.log(`Getting visibility status for definition ${definitionId}`);

    const result = await this.neo4jService.read(
      `
      MATCH (d:DefinitionNode {id: $definitionId})
      RETURN d.visibilityStatus
      `,
      { definitionId },
    );

    const visibilityStatus =
      result.records[0]?.get('d.visibilityStatus') ?? true;
    this.logger.log(
      `Visibility status for definition ${definitionId}: ${visibilityStatus}`,
    );
    return visibilityStatus;
  }
}
