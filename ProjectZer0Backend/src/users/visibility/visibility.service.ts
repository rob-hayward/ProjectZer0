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
      this.logger.log(
        `Getting visibility for user ${userId}, object ${objectId}`,
      );

      // If no userId, return community visibility
      if (!userId) {
        // Determine community visibility based on the passed parameters
        const defaultVisibility =
          this.determineCommunityVisibility(communityVisibility);
        this.logger.log(
          `No userId provided, using community visibility: ${defaultVisibility}`,
        );
        return defaultVisibility;
      }

      // Get user preference
      const userVisibilityPreference =
        await this.visibilitySchema.getVisibilityPreference(userId, objectId);

      this.logger.log(
        `User preference for object ${objectId}: ${userVisibilityPreference}`,
      );

      // If user has explicitly set a preference, use it
      if (userVisibilityPreference !== undefined) {
        this.logger.log(
          `Using explicit user preference: ${userVisibilityPreference}`,
        );
        return userVisibilityPreference;
      }

      // Otherwise use community visibility based on votes
      const communityVisibilityStatus =
        this.determineCommunityVisibility(communityVisibility);
      this.logger.log(
        `Using community visibility: ${communityVisibilityStatus}`,
      );
      return communityVisibilityStatus;
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
      this.logger.log(
        `Setting visibility preference - User: ${userId}, Node: ${nodeId}, Visible: ${isVisible}`,
      );

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
      this.logger.log(`Getting visibility preferences for user ${userId}`);

      if (!userId) {
        this.logger.warn(
          'Empty user ID passed to getUserVisibilityPreferences',
        );
        return {};
      }

      const preferences =
        await this.visibilitySchema.getAllVisibilityPreferences(userId);

      // Log the size of preferences for debugging
      const prefsCount = Object.keys(preferences || {}).length;
      this.logger.log(
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
