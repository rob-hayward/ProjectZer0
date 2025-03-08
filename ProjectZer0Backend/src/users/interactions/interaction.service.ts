// ProjectZer0Backend/src/users/interactions/interaction.service.ts
import { Injectable } from '@nestjs/common';
import { InteractionSchema } from '../../neo4j/schemas/interaction.schema';
import {
  UserInteractions,
  CreatedInteraction,
  VotedInteraction,
  CommentedInteraction,
  VisibilityPreference,
} from './interaction.model';

@Injectable()
export class InteractionService {
  constructor(private readonly interactionSchema: InteractionSchema) {}

  async addCreatedInteraction(
    userId: string,
    objectId: string,
    objectType: string,
  ): Promise<CreatedInteraction> {
    const interaction: CreatedInteraction = {
      type: objectType,
      timestamp: new Date().toISOString(),
    };
    return this.interactionSchema.createOrUpdateInteraction(userId, {
      created: { [objectId]: interaction },
    });
  }

  async addVoteInteraction(
    userId: string,
    objectId: string,
    objectType: string,
    voteValue: number,
  ): Promise<VotedInteraction> {
    const interaction: VotedInteraction = {
      type: objectType,
      value: voteValue,
      timestamp: new Date().toISOString(),
    };
    return this.interactionSchema.createOrUpdateInteraction(userId, {
      voted: { [objectId]: interaction },
    });
  }

  async addCommentInteraction(
    userId: string,
    objectId: string,
    objectType: string,
    commentId: string,
  ): Promise<CommentedInteraction> {
    return this.interactionSchema.addCommentInteraction(
      userId,
      objectId,
      objectType,
      commentId,
    );
  }

  async setVisibilityPreference(
    userId: string,
    objectId: string,
    isVisible: boolean,
  ): Promise<VisibilityPreference> {
    const result = await this.interactionSchema.setVisibilityPreference(
      userId,
      objectId,
      isVisible,
    );
    // Convert the boolean result to a VisibilityPreference object
    return { isVisible: result };
  }

  async getVisibilityPreference(
    userId: string,
    objectId: string,
  ): Promise<boolean | undefined> {
    return this.interactionSchema.getVisibilityPreference(userId, objectId);
  }

  async getAllInteractions(userId: string): Promise<UserInteractions> {
    return this.interactionSchema.getInteractions(userId);
  }

  async getInteractedObjects(
    userId: string,
    interactionType: 'created' | 'voted' | 'commented',
  ): Promise<string[]> {
    return this.interactionSchema.getInteractedObjects(userId, interactionType);
  }
}
