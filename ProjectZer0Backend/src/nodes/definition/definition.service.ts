import { Injectable, Logger } from '@nestjs/common';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { v4 as uuidv4 } from 'uuid';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

@Injectable()
export class DefinitionService {
  private readonly logger = new Logger(DefinitionService.name);

  constructor(
    private readonly definitionSchema: DefinitionSchema,
    private readonly userSchema: UserSchema,
  ) {}

  async createDefinition(definitionData: {
    word: string;
    createdBy: string;
    definitionText: string;
  }) {
    this.logger.log(`Creating definition: ${JSON.stringify(definitionData)}`);
    const definitionWithId = {
      ...definitionData,
      id: uuidv4(),
    };

    const result =
      await this.definitionSchema.createDefinition(definitionWithId);

    // Track creation for non-API users
    if (
      definitionData.createdBy !== 'FreeDictionaryAPI' &&
      definitionData.createdBy !== 'ProjectZeroAI'
    ) {
      await this.userSchema.addCreatedNode(
        definitionData.createdBy,
        result.id,
        'definition',
      );
    }

    return result;
  }

  async getDefinition(id: string) {
    this.logger.log(`Retrieving definition: ${id}`);
    return this.definitionSchema.getDefinition(id);
  }

  async updateDefinition(id: string, updateData: { definitionText: string }) {
    this.logger.log(`Updating definition ${id}: ${JSON.stringify(updateData)}`);
    return this.definitionSchema.updateDefinition(id, updateData);
  }

  async deleteDefinition(id: string) {
    this.logger.log(`Deleting definition: ${id}`);
    return this.definitionSchema.deleteDefinition(id);
  }

  async voteDefinition(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    this.logger.log(
      `Processing vote on definition ${id} by user ${sub}: ${isPositive}`,
    );

    const result = await this.definitionSchema.voteDefinition(
      id,
      sub,
      isPositive,
    );

    // Track participation for voting
    await this.userSchema.addParticipation(sub, id, 'voted');

    return result;
  }

  async getDefinitionVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    this.logger.log(`Getting vote status for definition ${id} by user ${sub}`);
    return this.definitionSchema.getDefinitionVoteStatus(id, sub);
  }

  async removeDefinitionVote(id: string, sub: string): Promise<VoteResult> {
    this.logger.log(`Removing vote from definition ${id} by user ${sub}`);
    return this.definitionSchema.removeDefinitionVote(id, sub);
  }

  async getDefinitionVotes(id: string): Promise<VoteResult | null> {
    this.logger.log(`Getting votes for definition ${id}`);
    return this.definitionSchema.getDefinitionVotes(id);
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    this.logger.log(`Setting visibility for definition ${id}: ${isVisible}`);
    return this.definitionSchema.setVisibilityStatus(id, isVisible);
  }

  async getVisibilityStatus(id: string) {
    this.logger.log(`Getting visibility status for definition ${id}`);
    return this.definitionSchema.getVisibilityStatus(id);
  }
}
