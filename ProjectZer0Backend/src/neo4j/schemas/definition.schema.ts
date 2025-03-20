import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { UserSchema } from './user.schema';
import { VoteSchema } from './vote.schema';
import { TEXT_LIMITS } from '../../constants/validation';

@Injectable()
export class DefinitionSchema {
  private readonly logger = new Logger(DefinitionSchema.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly userSchema: UserSchema,
    private readonly voteSchema: VoteSchema,
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
          positiveVotes: 0,
          negativeVotes: 0,
          netVotes: 0,
          visibilityStatus: true
      })
      CREATE (w)-[:HAS_DEFINITION]->(d)

      // Create CREATED relationship only (no initial vote)
      WITH d, $createdBy as userId
      WHERE NOT $isApiDefinition AND NOT $isAICreated
      MATCH (u:User {sub: userId})
      CREATE (u)-[:CREATED {
          createdAt: datetime(),
          type: 'definition'
      }]->(d)

      RETURN d
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
      DETACH DELETE d
      `,
      { id },
    );
    this.logger.log(`Deleted definition: ${id}`);
  }

  async getDefinitionVoteStatus(id: string, sub: string) {
    return this.voteSchema.getVoteStatus('DefinitionNode', { id }, sub);
  }

  async voteDefinition(id: string, sub: string, isPositive: boolean) {
    return this.voteSchema.vote('DefinitionNode', { id }, sub, isPositive);
  }

  async removeDefinitionVote(id: string, sub: string) {
    return this.voteSchema.removeVote('DefinitionNode', { id }, sub);
  }

  async getDefinitionVotes(id: string) {
    const voteStatus = await this.voteSchema.getVoteStatus(
      'DefinitionNode',
      { id },
      '', // Empty string as we don't need user-specific status
    );

    if (!voteStatus) {
      this.logger.log(`No votes found for definition: ${id}`);
      return null;
    }

    return {
      positiveVotes: voteStatus.positiveVotes,
      negativeVotes: voteStatus.negativeVotes,
      netVotes: voteStatus.netVotes,
    };
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
