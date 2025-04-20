// src/users/visibility/visibility.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { VisibilitySchema } from '../../neo4j/schemas/visibility.schema';
import { VisibilityPreference } from '../dto/visibility.dto';

@Injectable()
export class VisibilityService {
  private readonly logger = new Logger(VisibilityService.name);

  constructor(private readonly visibilitySchema: VisibilitySchema) {}

  /**
   * Determines visibility for an object based on both community status and user preferences
   * @param userId The user ID
   * @param objectId The object/node ID
   * @param communityVisibility Community visibility status or vote-based status
   * @returns The final visibility status
   */
  async getObjectVisibility(
    userId: string,
    objectId: string,
    communityVisibility: {
      netVotes?: number;
      isVisible?: boolean;
    },
  ): Promise<boolean> {
    try {
      this.logger.debug(
        `Getting visibility for user ${userId || 'anonymous'}, object ${objectId}`,
      );

      // If no userId, return community visibility
      if (!userId) {
        const defaultVisibility =
          this.determineCommunityVisibility(communityVisibility);
        this.logger.debug(
          `No user ID, returning community visibility: ${defaultVisibility}`,
        );
        return defaultVisibility;
      }

      // Get user preference
      const userVisibilityPreference =
        await this.visibilitySchema.getVisibilityPreference(userId, objectId);

      // If user has explicitly set a preference, use it
      if (userVisibilityPreference !== undefined) {
        this.logger.debug(`User preference found: ${userVisibilityPreference}`);
        return userVisibilityPreference;
      }

      // Otherwise use community visibility based on votes
      const communityVis =
        this.determineCommunityVisibility(communityVisibility);
      this.logger.debug(`Using community visibility: ${communityVis}`);
      return communityVis;
    } catch (error) {
      this.logger.error(
        `Error getting object visibility: ${error.message}`,
        error.stack,
      );
      // Default to true on error for better user experience
      return true;
    }
  }

  /**
   * Helper method to determine community visibility based on votes or explicit visibility status
   */
  private determineCommunityVisibility(communityVisibility: {
    netVotes?: number;
    isVisible?: boolean;
  }): boolean {
    // If an explicit visibility flag is provided, use it
    if (communityVisibility.isVisible !== undefined) {
      return communityVisibility.isVisible;
    }

    // Otherwise use vote-based logic: hide if net votes are negative
    if (communityVisibility.netVotes !== undefined) {
      return communityVisibility.netVotes >= 0;
    }

    // Default to visible if no information is available
    return true;
  }

  /**
   * Set a user's visibility preference for a specific node
   */
  async setUserVisibilityPreference(
    userId: string,
    nodeId: string,
    isVisible: boolean,
  ): Promise<VisibilityPreference> {
    try {
      if (!userId) {
        const error = new Error(
          'User ID is required to set visibility preferences',
        );
        this.logger.error(`${error.message}`);
        throw error;
      }

      if (!nodeId) {
        const error = new Error(
          'Node ID is required to set visibility preferences',
        );
        this.logger.error(`${error.message}`);
        throw error;
      }

      this.logger.debug(
        `Setting visibility preference - User: ${userId}, Node: ${nodeId}, Visible: ${isVisible}`,
      );

      // Call the schema to set the preference
      return this.visibilitySchema.setVisibilityPreference(
        userId,
        nodeId,
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

  /**
   * Get all visibility preferences for a user
   */
  async getUserVisibilityPreferences(
    userId: string,
  ): Promise<Record<string, VisibilityPreference | boolean>> {
    try {
      if (!userId) {
        this.logger.warn(
          'Empty user ID passed to getUserVisibilityPreferences',
        );
        return {};
      }

      this.logger.debug(`Getting visibility preferences for user ${userId}`);

      const preferences =
        await this.visibilitySchema.getAllVisibilityPreferences(userId);

      // Log the size of preferences for debugging
      const prefsCount = Object.keys(preferences || {}).length;
      this.logger.debug(
        `Retrieved ${prefsCount} visibility preferences for user ${userId}`,
      );

      return preferences || {};
    } catch (error) {
      this.logger.error(
        `Error getting user visibility preferences: ${error.message}`,
        error.stack,
      );
      // Return empty object on error to prevent cascading errors
      return {};
    }
  }
}
