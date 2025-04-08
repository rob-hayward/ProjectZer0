// src/neo4j/schemas/visibility.schema.ts

import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VisibilityPreference } from '../../users/dto/visibility.dto';

@Injectable()
export class VisibilitySchema {
  private readonly logger = new Logger(VisibilitySchema.name);
  private readonly PROPERTY_PREFIX = 'pref_';

  constructor(private readonly neo4jService: Neo4jService) {}

  /**
   * Sets a visibility preference for a user on a specific node
   */
  async setVisibilityPreference(
    userId: string,
    nodeId: string,
    isVisible: boolean,
  ): Promise<VisibilityPreference> {
    this.logger.log(
      `Setting visibility preference - User: ${userId}, Node: ${nodeId}, Visible: ${isVisible}`,
    );

    try {
      // First ensure the user exists
      await this.ensureUserExists(userId);

      // Create a preference object
      const preference: VisibilityPreference = {
        isVisible,
        source: 'user',
        timestamp: Date.now(),
      };

      // Create a safe property name
      const safeProperty = this.getSafePropertyName(nodeId);

      // Store preference as a string (JSON) to avoid Neo4j nested object limitations
      const preferenceJson = JSON.stringify(preference);

      // Use direct property access for reliable Neo4j operations
      const query = `
        MATCH (u:User {sub: $userId})
        MERGE (u)-[:HAS_VISIBILITY_PREFERENCES]->(vp:VisibilityPreferencesNode)
        SET vp.${safeProperty} = $preferenceJson
        RETURN vp.${safeProperty} as preferenceJson
      `;

      const result = await this.neo4jService.write(query, {
        userId,
        preferenceJson,
      });

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Failed to set visibility preference - no records returned',
        );
      }

      return preference; // Return the original preference object we created
    } catch (error) {
      this.logger.error(
        `Error setting visibility preference: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Gets a visibility preference for a user on a specific node
   */
  async getVisibilityPreference(
    userId: string,
    nodeId: string,
  ): Promise<boolean | undefined> {
    try {
      this.logger.log(
        `Getting visibility preference for user ${userId}, node ${nodeId}`,
      );

      const safeProperty = this.getSafePropertyName(nodeId);

      // Use direct property access
      const query = `
        MATCH (u:User {sub: $userId})
        OPTIONAL MATCH (u)-[:HAS_VISIBILITY_PREFERENCES]->(vp:VisibilityPreferencesNode)
        RETURN vp.${safeProperty} as preferenceJson
      `;

      const result = await this.neo4jService.read(query, { userId });

      if (
        result.records.length === 0 ||
        result.records[0].get('preferenceJson') === null
      ) {
        this.logger.log(`No preference found for node ${nodeId}`);
        return undefined;
      }

      // Parse the JSON to get the preference
      const preferenceString = result.records[0].get('preferenceJson');

      try {
        const preference = JSON.parse(preferenceString);
        return preference.isVisible;
      } catch (e) {
        this.logger.error(`Error parsing preference JSON: ${e.message}`);
        return undefined;
      }
    } catch (error) {
      this.logger.error(
        `Error getting visibility preference: ${error.message}`,
        error.stack,
      );
      return undefined;
    }
  }

  /**
   * Gets all visibility preferences for a user
   */
  async getAllVisibilityPreferences(
    userId: string,
  ): Promise<Record<string, VisibilityPreference | boolean>> {
    try {
      this.logger.log(`Getting all visibility preferences for user ${userId}`);

      // Get the entire visibility preferences node
      const query = `
        MATCH (u:User {sub: $userId})
        OPTIONAL MATCH (u)-[:HAS_VISIBILITY_PREFERENCES]->(vp:VisibilityPreferencesNode)
        RETURN vp
      `;

      const result = await this.neo4jService.read(query, { userId });

      if (result.records.length === 0 || !result.records[0].get('vp')) {
        this.logger.log(`No visibility preferences found for user ${userId}`);
        return {};
      }

      const vpNode = result.records[0].get('vp');
      const preferences: Record<string, VisibilityPreference | boolean> = {};

      // Process each property with our prefix
      for (const [propName, value] of Object.entries(vpNode.properties)) {
        if (propName.startsWith(this.PROPERTY_PREFIX)) {
          // Extract the node ID from the property name
          const nodeId = this.getNodeIdFromProperty(propName);

          try {
            // Try to parse the JSON value
            const parsedValue = JSON.parse(value as string);
            preferences[nodeId] = parsedValue;
          } catch (e) {
            this.logger.error(
              `Error parsing preference JSON for ${propName}: ${e.message}`,
            );
            // Skip this preference
          }
        }
      }

      return preferences;
    } catch (error) {
      this.logger.error(
        `Error getting all visibility preferences: ${error.message}`,
        error.stack,
      );
      return {};
    }
  }

  /**
   * Ensures a user exists in the database
   */
  private async ensureUserExists(userId: string): Promise<void> {
    try {
      const query = `
        MERGE (u:User {sub: $userId})
        RETURN u
      `;

      await this.neo4jService.write(query, { userId });
    } catch (error) {
      this.logger.error(
        `Error ensuring user exists: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Converts a node ID to a Neo4j-safe property name
   * with a consistent prefix
   */
  private getSafePropertyName(nodeId: string): string {
    return this.PROPERTY_PREFIX + nodeId.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Extracts the original node ID from a property name
   */
  private getNodeIdFromProperty(propName: string): string {
    // Remove the prefix
    return propName.substring(this.PROPERTY_PREFIX.length);
  }
}
