// src/neo4j/schemas/visibility.schema.ts

import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VisibilityPreference } from '../../users/dto/visibility.dto';

@Injectable()
export class VisibilitySchema {
  private readonly logger = new Logger(VisibilitySchema.name);

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
      const safeNodeId = this.getSafePropertyName(nodeId);

      // Store preference as a string (JSON) to avoid Neo4j nested object limitations
      const preferenceJson = JSON.stringify(preference);

      // Use string interpolation to create the query - we already know from the debug test
      // that this approach works in our Neo4j database
      const query = `
        MATCH (u:User {sub: $userId})
        MERGE (u)-[:HAS_VISIBILITY_PREFERENCES]->(vp:VisibilityPreferencesNode)
        SET vp.${safeNodeId} = $preferenceJson
        RETURN vp.${safeNodeId} as preference
      `;

      const result = await this.neo4jService.write(query, {
        userId,
        preferenceJson,
      });

      if (!result.records || result.records.length === 0) {
        throw new Error('Failed to set visibility preference');
      }

      // Parse the JSON string back to an object
      const preferenceString = result.records[0].get('preference');
      return JSON.parse(preferenceString);
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

      const safeNodeId = this.getSafePropertyName(nodeId);

      // Using string interpolation for the property name
      const query = `
        MATCH (u:User {sub: $userId})
        OPTIONAL MATCH (u)-[:HAS_VISIBILITY_PREFERENCES]->(vp:VisibilityPreferencesNode)
        RETURN vp.${safeNodeId} as preference
      `;

      const result = await this.neo4jService.read(query, { userId });

      if (
        result.records.length === 0 ||
        result.records[0].get('preference') === null
      ) {
        return undefined;
      }

      const preferenceString = result.records[0].get('preference');

      // Handle case where preference might be stored as a boolean (backward compatibility)
      if (typeof preferenceString === 'boolean') {
        return preferenceString;
      }

      // Parse JSON string to get the preference object
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
        return {};
      }

      const vpNode = result.records[0].get('vp');
      const preferences: Record<string, VisibilityPreference | boolean> = {};

      // Process each property, converting from safe names and parsing JSON strings
      for (const [propName, value] of Object.entries(vpNode.properties)) {
        const originalNodeId = this.getOriginalNodeId(propName);

        if (typeof value === 'boolean') {
          preferences[originalNodeId] = value;
        } else if (typeof value === 'string') {
          try {
            preferences[originalNodeId] = JSON.parse(value as string);
          } catch (e) {
            this.logger.error(
              `Error parsing preference JSON for ${propName}: ${e.message}`,
            );
            // Default to visible on error
            preferences[originalNodeId] = true;
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
  async ensureUserExists(userId: string): Promise<void> {
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
   */
  private getSafePropertyName(nodeId: string): string {
    return nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Converts a safe property name back to the original node ID
   * In a perfect world, we'd maintain a mapping of transformations,
   * but for now, assume property names are the original IDs with special chars replaced by underscores
   */
  private getOriginalNodeId(safePropertyName: string): string {
    // In a production system, you might need a mapping mechanism
    return safePropertyName;
  }
}
