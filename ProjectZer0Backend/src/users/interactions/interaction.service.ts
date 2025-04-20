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
      if (!userId || !objectId || !objectType) {
        throw new Error('Missing required parameters for created interaction');
      }

      this.logger.debug(
        `Adding created interaction: user=${userId}, objectId=${objectId}, type=${objectType}`,
      );

      const interaction: CreatedInteraction = {
        type: objectType,
        timestamp: new Date().toISOString(),
      };

      const result = await this.interactionSchema.createOrUpdateInteraction(
        userId,
        {
          created: { [objectId]: interaction },
        },
      );

      this.logger.debug(`Created interaction added successfully`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error adding created interaction: ${error.message}`,
        error.stack,
      );
      throw error; // Re-throw to allow tests to catch it
    }
  }

  async addVoteInteraction(
    userId: string,
    objectId: string,
    objectType: string,
    voteValue: number,
  ): Promise<VotedInteraction> {
    try {
      if (!userId || !objectId || !objectType) {
        throw new Error('Missing required parameters for vote interaction');
      }

      this.logger.debug(
        `Adding vote interaction: user=${userId}, objectId=${objectId}, type=${objectType}, value=${voteValue}`,
      );

      const interaction: VotedInteraction = {
        type: objectType,
        value: voteValue,
        timestamp: new Date().toISOString(),
      };

      const result = await this.interactionSchema.createOrUpdateInteraction(
        userId,
        {
          voted: { [objectId]: interaction },
        },
      );

      this.logger.debug(`Vote interaction added successfully`);
      return result;
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
      if (!userId || !objectId || !objectType || !commentId) {
        throw new Error('Missing required parameters for comment interaction');
      }

      this.logger.debug(
        `Adding comment interaction: user=${userId}, objectId=${objectId}, type=${objectType}, commentId=${commentId}`,
      );

      const result = await this.interactionSchema.addCommentInteraction(
        userId,
        objectId,
        objectType,
        commentId,
      );

      this.logger.debug(`Comment interaction added successfully`);
      return result;
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
      if (!userId) {
        this.logger.warn('Attempted to get interactions without userId');
        return {};
      }

      this.logger.debug(`Retrieving all interactions for user: ${userId}`);
      return await this.interactionSchema.getInteractions(userId);
    } catch (error) {
      this.logger.error(
        `Error getting all interactions: ${error.message}`,
        error.stack,
      );
      // Return empty object instead of throwing to provide graceful degradation
      return {};
    }
  }

  async getInteractedObjects(
    userId: string,
    interactionType: 'created' | 'voted' | 'commented',
  ): Promise<string[]> {
    try {
      if (!userId) {
        this.logger.warn('Attempted to get interacted objects without userId');
        return [];
      }

      this.logger.debug(
        `Retrieving ${interactionType} objects for user: ${userId}`,
      );
      return await this.interactionSchema.getInteractedObjects(
        userId,
        interactionType,
      );
    } catch (error) {
      this.logger.error(
        `Error getting interacted objects: ${error.message}`,
        error.stack,
      );
      // Return empty array instead of throwing to provide graceful degradation
      return [];
    }
  }

  async countUserInteractions(userId: string): Promise<{
    created: number;
    voted: number;
    commented: number;
  }> {
    try {
      if (!userId) {
        this.logger.warn('Attempted to count interactions without userId');
        return { created: 0, voted: 0, commented: 0 };
      }

      this.logger.debug(`Counting interactions for user: ${userId}`);

      const interactions = await this.getAllInteractions(userId);

      const counts = {
        created: Object.keys(interactions.created || {}).length,
        voted: Object.keys(interactions.voted || {}).length,
        commented: Object.keys(interactions.commented || {}).length,
      };

      this.logger.debug(`Interaction counts: ${JSON.stringify(counts)}`);
      return counts;
    } catch (error) {
      this.logger.error(
        `Error counting user interactions: ${error.message}`,
        error.stack,
      );
      return { created: 0, voted: 0, commented: 0 };
    }
  }
}
