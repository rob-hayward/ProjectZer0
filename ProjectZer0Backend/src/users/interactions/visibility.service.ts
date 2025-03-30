import { Injectable, Logger } from '@nestjs/common';
import { InteractionSchema } from '../../neo4j/schemas/interaction.schema';
import { VisibilityPreference } from './interaction.model';

@Injectable()
export class VisibilityService {
  private readonly logger = new Logger(VisibilityService.name);

  constructor(private readonly interactionSchema: InteractionSchema) {}

  async getObjectVisibility(
    userId: string,
    objectId: string,
    objectVisibilityStatus: boolean,
  ): Promise<boolean> {
    try {
      const userVisibilityPreference =
        await this.interactionSchema.getVisibilityPreference(userId, objectId);

      return userVisibilityPreference !== undefined
        ? userVisibilityPreference
        : objectVisibilityStatus;
    } catch (error) {
      this.logger.error(
        `Error getting object visibility: ${error.message}`,
        error.stack,
      );
      // Default to the provided community visibility status on error
      return objectVisibilityStatus;
    }
  }

  async setUserVisibilityPreference(
    userId: string,
    objectId: string,
    isVisible: boolean,
  ): Promise<VisibilityPreference> {
    try {
      this.logger.log(
        `Setting visibility preference for user ${userId}, object ${objectId}: ${isVisible}`,
      );
      return this.interactionSchema.setVisibilityPreference(
        userId,
        objectId,
        isVisible,
      );
    } catch (error) {
      this.logger.error(
        `Error setting user visibility preference: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getUserVisibilityPreferences(
    userId: string,
  ): Promise<Record<string, boolean | VisibilityPreference>> {
    try {
      this.logger.log(`Getting visibility preferences for user ${userId}`);
      return this.interactionSchema.getVisibilityPreferences(userId);
    } catch (error) {
      this.logger.error(
        `Error getting user visibility preferences: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
