// src/users/interactions/interaction.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InteractionSchema } from '../../neo4j/schemas/interaction.schema';
import {
  UserInteractions,
  CreatedInteraction,
  VotedInteraction,
  CommentedInteraction,
} from './interaction.model';

@Injectable()
export class InteractionService {
  private readonly logger = new Logger(InteractionService.name);

  constructor(private readonly interactionSchema: InteractionSchema) {}

  async addCreatedInteraction(
    userId: string,
    objectId: string,
    objectType: string,
  ): Promise<CreatedInteraction> {
    try {
      const interaction: CreatedInteraction = {
        type: objectType,
        timestamp: new Date().toISOString(),
      };

      return this.interactionSchema.createOrUpdateInteraction(userId, {
        created: { [objectId]: interaction },
      });
    } catch (error) {
      this.logger.error(
        `Error adding created interaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async addVoteInteraction(
    userId: string,
    objectId: string,
    objectType: string,
    voteValue: number,
  ): Promise<VotedInteraction> {
    try {
      const interaction: VotedInteraction = {
        type: objectType,
        value: voteValue,
        timestamp: new Date().toISOString(),
      };

      return this.interactionSchema.createOrUpdateInteraction(userId, {
        voted: { [objectId]: interaction },
      });
    } catch (error) {
      this.logger.error(
        `Error adding vote interaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async addCommentInteraction(
    userId: string,
    objectId: string,
    objectType: string,
    commentId: string,
  ): Promise<CommentedInteraction> {
    try {
      return this.interactionSchema.addCommentInteraction(
        userId,
        objectId,
        objectType,
        commentId,
      );
    } catch (error) {
      this.logger.error(
        `Error adding comment interaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getAllInteractions(userId: string): Promise<UserInteractions> {
    try {
      return this.interactionSchema.getInteractions(userId);
    } catch (error) {
      this.logger.error(
        `Error getting all interactions: ${error.message}`,
        error.stack,
      );
      return {};
    }
  }

  async getInteractedObjects(
    userId: string,
    interactionType: 'created' | 'voted' | 'commented',
  ): Promise<string[]> {
    try {
      return this.interactionSchema.getInteractedObjects(
        userId,
        interactionType,
      );
    } catch (error) {
      this.logger.error(
        `Error getting interacted objects: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }
}
