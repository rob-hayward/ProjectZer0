import { Injectable, Logger } from '@nestjs/common';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { v4 as uuidv4 } from 'uuid';

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
        result.definition.id,
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
    definitionId: string,
    userId: string,
    vote: 'agree' | 'disagree',
  ) {
    this.logger.log(
      `Processing vote on definition ${definitionId} by user ${userId}: ${vote}`,
    );

    const result = await this.definitionSchema.voteDefinition(
      definitionId,
      userId,
      vote,
    );

    // Track participation for voting
    if (vote === 'agree') {
      await this.userSchema.addParticipation(userId, definitionId, 'voted');
    }

    return result;
  }

  async getDefinitionVote(definitionId: string, userId: string) {
    this.logger.log(
      `Getting vote status for definition ${definitionId} by user ${userId}`,
    );
    return this.definitionSchema.getDefinitionVote(definitionId, userId);
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
